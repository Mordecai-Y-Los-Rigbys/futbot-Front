import { describe, expect, it } from 'vitest';
import { validateBehaviorCode, validateBehaviorCodeLength } from './behaviorCodeValidator';

const API = {
  shared: { constants: ['ball'], functions: ['look'] },
  playerBehavior: { constants: ['move'], functions: ['shoot'] },
  coachBehavior: { constants: ['formation'], functions: ['swap_player'] },
};

describe('validateBehaviorCode: reglas sin lista de primitivas', () => {
  it('acepta código válido, vacío, lambdas, bloques y continuaciones', () => {
    expect(validateBehaviorCode('')).toBeNull();
    expect(validateBehaviorCode('if a:\n    x = 1\nelse:\n    x = 2')).toBeNull();
    expect(validateBehaviorCode('f = lambda x: x')).toBeNull();
    expect(validateBehaviorCode('x = (1,\n  2)')).toBeNull();
    expect(validateBehaviorCode('x = 1 + \\\n  2')).toBeNull();
    expect(validateBehaviorCode('if (a):\n    x = not (b)')).toBeNull();
    expect(validateBehaviorCode('if a:\n        # c\n    x = 1')).toBeNull();
  });

  it.each([
    ['importNotAllowed', 'x = 1\nimport os', 2, 1],
    ['importNotAllowed', 'from math import pi', 1, 1],
    ['functionDefinitionNotAllowed', 'def f():\n  pass', 1, 1],
    ['classNotAllowed', 'class A:\n  pass', 1, 1],
    ['loopNotAllowed', 'for i in x:\n  pass', 1, 1],
    ['loopNotAllowed', 'a = 1\nwhile a:\n  pass', 2, 1],
    ['comprehensionNotAllowed', 'a = [i for i in x]', 1, 8],
    ['comprehensionNotAllowed', 'a = sum(i for i in x)', 1, 11],
    ['globalNotAllowed', 'global a', 1, 1],
    ['globalNotAllowed', 'if a:\n    nonlocal b', 2, 5],
    ['callNotAllowed', 'x = 1\nprint(x)', 2, 1],
  ])('%s en %j', (rule, code, line, column) => {
    expect(validateBehaviorCode(code)).toMatchObject({ rule, line, column });
  });

  it('ignora palabras dentro de comentarios, strings y f-strings', () => {
    expect(validateBehaviorCode("# import os\nx = 'for while def'")).toBeNull();
    expect(validateBehaviorCode('x = """doc\nimport os"""')).toBeNull();
    expect(validateBehaviorCode("x = f'{a} print(b)'")).toBeNull();
  });

  it('informa el primer error por posición', () => {
    expect(validateBehaviorCode('class A:\n  pass\nimport os')).toMatchObject({
      rule: 'classNotAllowed',
      line: 1,
    });
  });

  it('cuenta \\r\\n como un solo salto de línea', () => {
    expect(validateBehaviorCode('x = 1\r\nimport os')).toMatchObject({ line: 2, column: 1 });
  });

  it('sin lista de primitivas no juzga llamadas que no son builtins', () => {
    expect(validateBehaviorCode('foo()\nball.kick()')).toBeNull();
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

describe('validateBehaviorCode: con lista de primitivas', () => {
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