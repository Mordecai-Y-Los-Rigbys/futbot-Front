import { describe, expect, it } from 'vitest';
import {
  validateBehaviorCode,
  validateBehaviorCodeAll,
  validateBehaviorCodeLength,
} from './behaviorCodeValidator';

// Lista de primitivas INVENTADA, solo para probar la mecánica del validador
// (la lista real se prueba en el bloque "API real").
const API = {
  shared: { constants: ['ball'], functions: ['look'] },
  playerBehavior: { constants: ['move'], functions: ['shoot'] },
  coachBehavior: { constants: ['formation'], functions: ['swap_player'] },
};

describe('validateBehaviorCode: reglas sin lista de primitivas', () => {
  // Sin lista de primitivas: solo se bloquean los builtins de Python como llamadas.
  const run = (code) => validateBehaviorCode(code, undefined, null);

  it('acepta código válido, vacío, bloques y continuaciones', () => {
    expect(run('')).toBeNull();
    expect(run('if a:\n    x = 1\nelse:\n    x = 2')).toBeNull();
    expect(run('x = (1,\n  2)')).toBeNull();
    expect(run('x = 1 + \\\n  2')).toBeNull();
    expect(run('if (a):\n    x = not (b)')).toBeNull();
    expect(run('if a:\n        # c\n    x = 1')).toBeNull();
  });

  it.each([
    ['importNotAllowed', 'x = 1\nimport os', 2, 1],
    ['importNotAllowed', 'from math import pi', 1, 1],
    ['functionDefinitionNotAllowed', 'def f():\n  pass', 1, 1],
    ['classNotAllowed', 'class A:\n  pass', 1, 1],
    ['loopNotAllowed', 'for i in x:\n  pass', 1, 1],
    ['loopNotAllowed', 'a = 1\nwhile a:\n  pass', 2, 1],
    ['comprehensionNotAllowed', 'a = [i for i in x]', 1, 8],
    ['comprehensionNotAllowed', 'a = foo(i for i in x)', 1, 11],
    ['globalNotAllowed', 'global a', 1, 1],
    ['globalNotAllowed', 'if a:\n    nonlocal b', 2, 5],
    ['callNotAllowed', 'x = 1\nprint(x)', 2, 1],
  ])('%s en %j', (rule, code, line, column) => {
    expect(run(code)).toMatchObject({ rule, line, column });
  });

  it('ignora palabras dentro de comentarios y strings', () => {
    expect(run("# import os\nx = 'for while def'")).toBeNull();
    expect(run('x = """doc\nimport os"""')).toBeNull();
    expect(run("x = '{a} print(b)'")).toBeNull();
  });

  it('informa el primer error por posición', () => {
    expect(run('class A:\n  pass\nimport os')).toMatchObject({
      rule: 'classNotAllowed',
      line: 1,
    });
  });

  it('cuenta \\r\\n como un solo salto de línea', () => {
    expect(run('x = 1\r\nimport os')).toMatchObject({ line: 2, column: 1 });
  });

  it('sin lista de primitivas no juzga llamadas que no son builtins', () => {
    expect(run('foo()\nball.kick()')).toBeNull();
  });
});

describe('validateBehaviorCode: errores de sintaxis', () => {
  it.each([
    ['paréntesis sin cerrar', 'a = (1', 1, 5],
    ['paréntesis sin abrir', 'a = 1)', 1, 6],
    ['paréntesis cruzados', 'a = (1]', 1, 7],
    ['string sin cerrar', "a = 'hola", 1, 5],
    ['triple string sin cerrar', 'a = """hola', 1, 5],
    ['carácter inválido', 'a = $', 1, 5],
    ['indentación inesperada', 'x = 1\n  y = 2', 2, 3],
    ['bloque sin indentar', 'if a:\npass', 2, 1],
    ['bloque faltante al final', 'if a:', 1, 5],
    ['dedent que no coincide', 'if a:\n    x = 1\n  y = 2', 3, 3],
  ])('%s', (_, code, line, column) => {
    expect(validateBehaviorCode(code)).toMatchObject({ rule: 'syntaxError', line, column });
  });

  it('con un error de sintaxis no evalúa las otras reglas', () => {
    expect(validateBehaviorCode('import os\na = (1')).toMatchObject({ rule: 'syntaxError' });
  });
});

describe('validateBehaviorCode: con una lista de primitivas de prueba', () => {
  const run = (code, type) => validateBehaviorCode(code, type, API);

  it('acepta las primitivas compartidas y las del propio tipo', () => {
    expect(run('if ball:\n    shoot()\nlook()', 'playerBehavior')).toBeNull();
    expect(run('swap_player()\nx = formation', 'coachBehavior')).toBeNull();
  });

  it('sin tipo permite cualquier primitiva', () => {
    expect(run('shoot()\nswap_player()', undefined)).toBeNull();
  });

  it('callNotAllowed para toda llamada que no sea una primitiva', () => {
    expect(run('foo()', 'playerBehavior')).toMatchObject({ rule: 'callNotAllowed', line: 1, column: 1 });
    expect(run('ball.kick()', 'playerBehavior')).toMatchObject({ rule: 'callNotAllowed', line: 1, column: 6 });
    expect(run('x = max(1, 2)', 'playerBehavior')).toMatchObject({ rule: 'callNotAllowed', column: 5 });
  });

  it('primitiveNotAllowedForType para primitivas del otro tipo', () => {
    expect(run('shoot()', 'coachBehavior')).toMatchObject({ rule: 'primitiveNotAllowedForType', line: 1, column: 1 });
    expect(run('x = 1\nswap_player()', 'playerBehavior')).toMatchObject({
      rule: 'primitiveNotAllowedForType',
      line: 2,
    });
  });

  it.each([
    ['move = 1', 1, 1],
    ['x = 1\nmove += 1', 2, 1],
    ['a, move = 1, 2', 1, 4],
    ['a = move = 1', 1, 5],
  ])('primitiveAssignmentNotAllowed en %j', (code, line, column) => {
    expect(run(code, 'playerBehavior')).toMatchObject({ rule: 'primitiveAssignmentNotAllowed', line, column });
  });

  it('no marca como asignación lo que no lo es', () => {
    expect(run('x = move', 'playerBehavior')).toBeNull();
    expect(run('move.x = 1', 'playerBehavior')).toBeNull();
    expect(run('look(move=1)', 'playerBehavior')).toBeNull();
    expect(run('if move == 1:\n    x = 1', 'playerBehavior')).toBeNull();
  });

  it('en un empate de posición gana la asignación', () => {
    expect(run('move = 1', 'coachBehavior')).toMatchObject({ rule: 'primitiveAssignmentNotAllowed' });
  });

  it('con una sección marcada complete: false no juzga las llamadas desconocidas de ese tipo', () => {
    const partial = { ...API, coachBehavior: { constants: [], functions: [], complete: false } };
    expect(validateBehaviorCode('algo_del_dt(1)', 'coachBehavior', partial)).toBeNull();
    expect(validateBehaviorCode('algo_del_dt(1)', 'playerBehavior', partial)).toMatchObject({
      rule: 'callNotAllowed',
    });
  });
});

describe('validateBehaviorCode: API real (BEHAVIOR_API)', () => {
  const player = (code) => validateBehaviorCode(code, 'playerBehavior');
  const coach = (code) => validateBehaviorCode(code, 'coachBehavior');

  it('acepta un comportamiento de jugador típico', () => {
    const code = [
      'bx, by = ball_position()',
      'if i_have_ball():',
      '    kick_to(opponent_goal[0], opponent_goal[1], 80)',
      'elif distance(bx, by, my_goal[0], my_goal[1]) < 30 and not opponent_has_ball():',
      '    go_to(bx, by)',
      'else:',
      '    move_in_direction(1, 0)',
    ].join('\n');
    expect(player(code)).toBeNull();
  });

  it('usa las primitivas generales en ambos tipos', () => {
    expect(player('x = elapsed_time() + remaining_time() + current_period()')).toBeNull();
    expect(coach('x = teammate_stat(1, "speed")')).toBeNull();
  });

  it('llamadas a algo que no es primitiva: callNotAllowed', () => {
    expect(player('foo()')).toMatchObject({ rule: 'callNotAllowed', line: 1, column: 1 });
    expect(player('x = max(1, 2)')).toMatchObject({ rule: 'callNotAllowed', column: 5 });
    expect(player('x = my_goal()')).toMatchObject({ rule: 'callNotAllowed' });
  });

  it('primitivas de jugador en un DT: primitiveNotAllowedForType', () => {
    expect(coach('kick()')).toMatchObject({ rule: 'primitiveNotAllowedForType', line: 1, column: 1 });
    expect(coach('x = 1\ngo_to(1, 2)')).toMatchObject({ rule: 'primitiveNotAllowedForType', line: 2 });
  });

  it('un DT solo puede usar las primitivas generales', () => {
    expect(coach('x = distance(0, 0, 1, 1)\nif nobody_has_ball():\n    y = ball_position()')).toBeNull();
  });

  it('un DT no tiene primitivas propias: toda otra llamada es inválida', () => {
    expect(coach('swap_player(1, 2)')).toMatchObject({ rule: 'callNotAllowed', line: 1, column: 1 });
    expect(player('swap_player(1, 2)')).toMatchObject({ rule: 'callNotAllowed' });
  });

  it.each([
    ['field_length = 5', 1, 1],
    ['x = 1\nmy_goal = (0, 0)', 2, 1],
    ['distance = 3', 1, 1],
    ['a, ball_radius = 1, 2', 1, 4],
  ])('asignar a una primitiva: %j', (code, line, column) => {
    expect(player(code)).toMatchObject({ rule: 'primitiveAssignmentNotAllowed', line, column });
  });

  it('leer una primitiva o usar variables propias no es asignación', () => {
    expect(player('x = field_length\nmove = 1')).toBeNull();
    expect(player('kick(force=50)')).toBeNull();
  });
});

describe('validateBehaviorCode: construcciones prohibidas', () => {
  const run = (code) => validateBehaviorCode(code, 'playerBehavior');

  it.each([
    ['functionDefinitionNotAllowed', 'f = lambda x: x', 1, 5],
    ['loopNotAllowed', 'yield 1', 1, 1],
    ['constructNotAllowed', 'await a', 1, 1],
    ['constructNotAllowed', 'try:\n  pass', 1, 1],
    ['constructNotAllowed', 'with a:\n  pass', 1, 1],
    ['constructNotAllowed', 'del a', 1, 1],
    ['constructNotAllowed', 'assert a', 1, 1],
    ['constructNotAllowed', 'x = (y := 1)', 1, 8],
    ['constructNotAllowed', 'x = f"hola"', 1, 5],
    ['constructNotAllowed', 'x = [1]\ny = x[0:1]', 2, 8],
    ['constructNotAllowed', 'x = a[:1]', 1, 7],
    ['constructNotAllowed', 'x = a[::2]', 1, 7],
    ['constructNotAllowed', 'if a in b:\n  pass', 1, 6],
    ['constructNotAllowed', 'if a not in b:\n  pass', 1, 6],
    ['constructNotAllowed', 'x = {1, 2}', 1, 5],
    ['constructNotAllowed', 'x = {"a": 1}', 1, 5],
    ['constructNotAllowed', '@deco\nx = 1', 1, 1],
    ['constructNotAllowed', 'x = a.__class__', 1, 7],
    ['constructNotAllowed', 'x = __a', 1, 5],
  ])('%s en %j', (rule, code, line, column) => {
    expect(run(code)).toMatchObject({ rule, line, column });
  });

  it('lo permitido sigue andando: índices, tuplas, if/elif/else, operadores lógicos', () => {
    expect(
      run('p = ball_position()\nif p[0] > 50 and not (p[1] < 10):\n    x = (1, 2)[0]\nelif True:\n    x = None'),
    ).toBeNull();
    expect(run('x = [1, 2]\ny = x[0]')).toBeNull();
  });

  it('las palabras prohibidas dentro de strings o comentarios no cuentan', () => {
    expect(run('x = "try with in del"  # lambda yield')).toBeNull();
    expect(run("x = 'a:b'")).toBeNull();
  });
});

describe('validateBehaviorCodeAll', () => {
  it('informa todos los errores, ordenados por posición', () => {
    const errors = validateBehaviorCodeAll('import os\nx = 1\nclass A:\n  pass', 'playerBehavior');
    expect(errors.map((e) => [e.rule, e.line])).toEqual([
      ['importNotAllowed', 1],
      ['classNotAllowed', 3],
    ]);
  });

  it('con errores de sintaxis informa solo los de sintaxis', () => {
    const errors = validateBehaviorCodeAll('import os\na = (1\nb = $', 'playerBehavior');
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.rule === 'syntaxError')).toBe(true);
  });

  it('devuelve index y length del token completo', () => {
    expect(validateBehaviorCodeAll('x = 1\nimport os')[0]).toMatchObject({ index: 6, length: 6, line: 2, column: 1 });
    expect(validateBehaviorCodeAll('x = f"hola"')[0]).toMatchObject({ index: 4, length: 7 });
    expect(validateBehaviorCodeAll('if a not in b:\n  pass')[0]).toMatchObject({ index: 5, length: 6 });
  });

  it('sin errores o con código vacío devuelve []', () => {
    expect(validateBehaviorCodeAll('')).toEqual([]);
    expect(validateBehaviorCodeAll('x = 1', 'playerBehavior')).toEqual([]);
  });
});

describe('validateBehaviorCodeLength', () => {
  it('acepta hasta 250 líneas y no cuenta el salto final', () => {
    expect(validateBehaviorCodeLength('x = 1\n'.repeat(250))).toBeNull();
  });

  it('rechaza más de 250 líneas', () => {
    expect(validateBehaviorCodeLength('x = 1\n'.repeat(251))).toMatchObject({ rule: 'codeTooLong' });
  });

  it('rechaza más de 20000 caracteres', () => {
    expect(validateBehaviorCodeLength('x'.repeat(20000))).toBeNull();
    expect(validateBehaviorCodeLength('x'.repeat(20001))).toMatchObject({ rule: 'codeTooLong' });
  });

  it('cuenta caracteres, no bytes', () => {
    expect(validateBehaviorCodeLength('ñ'.repeat(20000))).toBeNull();
  });
});

describe('validateBehaviorCode: sintaxis real y nombres sin definir', () => {
  const player = (code) => validateBehaviorCode(code, 'playerBehavior');

  it('un nombre suelto que no existe es un error', () => {
    expect(player('hola')).toMatchObject({ rule: 'undefinedName', line: 1, column: 1 });
    expect(player('x = hola')).toMatchObject({ rule: 'undefinedName', column: 5 });
  });

  it('un nombre usado antes de asignarse es un error; después, no', () => {
    expect(player('x = y\ny = 1')).toMatchObject({ rule: 'undefinedName', line: 1 });
    expect(player('y = 1\nx = y')).toBeNull();
  });

  it('errores de sintaxis que el tokenizer no ve', () => {
    expect(player('x = = 1')).toMatchObject({ rule: 'syntaxError' });
    expect(player('if i_have_ball()\n    kick()')).toMatchObject({ rule: 'syntaxError' });
  });

  it('las primitivas y variables asignadas siguen siendo válidas', () => {
    expect(player('bx, by = ball_position()\ngo_to(bx, by)')).toBeNull();
  });
});