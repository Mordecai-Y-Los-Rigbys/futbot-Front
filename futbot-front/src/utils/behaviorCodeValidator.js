import { BEHAVIOR_API } from './behaviorApi';

// Validador del código de un behavior, del lado del cliente. Replica las reglas de la
// API de código de comportamientos y devuelve el PRIMER error:
// { rule, line, column, message }, o null. No es un parser completo de Python:
// el servidor sigue siendo la autoridad (409).

export const MAX_CODE_LINES = 250;
export const MAX_CODE_CHARS = 20000;

const MESSAGES = {
  importNotAllowed: 'No se permite usar import.',
  functionDefinitionNotAllowed: 'No se permite definir funciones (def, lambda).',
  classNotAllowed: 'No se permite definir clases.',
  loopNotAllowed: 'No se permiten bucles ni generadores (for, while, yield).',
  comprehensionNotAllowed: 'No se permiten comprensiones ni expresiones generadoras.',
  globalNotAllowed: 'No se permite global ni nonlocal.',
  primitiveAssignmentNotAllowed: 'No se puede asignar a una primitiva del sistema.',
};

// Palabras reservadas prohibidas: [regla, mensaje].
const CONSTRUCT = 'constructNotAllowed';
const KEYWORD_RULES = {
  lambda: ['functionDefinitionNotAllowed', 'No se permite lambda.'],
  yield: ['loopNotAllowed', 'No se permiten generadores (yield).'],
  await: [CONSTRUCT, 'No se permite await.'],
  try: [CONSTRUCT, 'No se permite try.'],
  with: [CONSTRUCT, 'No se permite with.'],
  del: [CONSTRUCT, 'No se permite del.'],
  assert: [CONSTRUCT, 'No se permite assert.'],
};

const TYPE_LABELS = { playerBehavior: 'jugador', coachBehavior: 'DT' };

const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield',
]);

// Funciones nativas de Python. Solo se usan como respaldo cuando no hay lista de primitivas.
const BUILTINS = new Set([
  'abs', 'min', 'max', 'len', 'round', 'print', 'range', 'int', 'float', 'str', 'list',
  'dict', 'set', 'tuple', 'bool', 'sum', 'sorted', 'map', 'filter', 'zip', 'enumerate',
  'input', 'open', 'eval', 'exec', 'type', 'isinstance', 'pow', 'divmod',
]);

const ASSIGN_OPS = new Set([
  '=', '+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '>>=', '<<=', '@=',
]);
const MULTI_OPS = [
  '**=', '//=', '>>=', '<<=', '...', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '@=', '->', ':=', '**', '//', '<<', '>>',
];
const SINGLE_OPS = '+-*/%&|^~<>=.,:@';
const PAIRS = { ')': '(', ']': '[', '}': '{' };
const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
const STRING_PREFIX = /^[rRbBuUfF]{1,2}$/;
const NAME = /[\p{L}_][\p{L}\p{N}_]*/uy;
const NUMBER = /\d[\w.]*/y;

// ---------------------------------------------------------------------------
// Tokenizer. Cada token: { type, value, index, depth, indent?, fstring? }.
// `depth` es el nivel de paréntesis/corchetes que lo contiene. `indent` solo está en
// el primer token de cada línea lógica. Los saltos de línea dentro de paréntesis no
// generan token 'newline'.
// ---------------------------------------------------------------------------
function tokenize(code) {
  const tokens = [];
  const syntaxErrors = [];
  const stack = [];
  const n = code.length;
  let i = 0;
  let atLineStart = true;
  let lineIndent = null;

  const push = (type, value, index) => {
    const token = { type, value, index, depth: stack.length };
    if (lineIndent !== null) {
      token.indent = lineIndent;
      lineIndent = null;
    }
    tokens.push(token);
    return token;
  };

  const readString = (from, quoteIndex, isF = false) => {
    const q = code[quoteIndex];
    const triple = code.startsWith(q.repeat(3), quoteIndex);
    const delim = triple ? q.repeat(3) : q;
    let j = quoteIndex + delim.length;
    const finish = (end) => {
      const token = push('string', '', from);
      if (isF) token.fstring = true;
      return end;
    };
    while (j < n) {
      if (code[j] === '\\') {
        j += 2;
      } else if (code.startsWith(delim, j)) {
        return finish(j + delim.length);
      } else if (!triple && code[j] === '\n') {
        break;
      } else {
        j += 1;
      }
    }
    syntaxErrors.push({ index: from, message: 'Cadena de texto sin cerrar.' });
    return finish(Math.min(j, n));
  };

  while (i < n) {
    // Inicio de línea lógica: medir indentación; las líneas vacías o de comentario no cuentan.
    if (atLineStart && stack.length === 0) {
      let j = i;
      let col = 0;
      while (j < n && (code[j] === ' ' || code[j] === '\t')) {
        col = code[j] === '\t' ? (Math.floor(col / 8) + 1) * 8 : col + 1;
        j += 1;
      }
      if (j >= n || '\r\n#'.includes(code[j])) {
        while (j < n && code[j] !== '\n') j += 1;
        i = j + 1;
        continue;
      }
      lineIndent = col;
      atLineStart = false;
      i = j;
      continue;
    }

    const c = code[i];

    if (c === '\n') {
      if (stack.length === 0) {
        tokens.push({ type: 'newline', value: '\n', index: i, depth: 0 });
        atLineStart = true;
      }
      i += 1;
    } else if (c === ' ' || c === '\t' || c === '\r' || c === '\f') {
      i += 1;
    } else if (c === '\\' && (code[i + 1] === '\n' || code.startsWith('\r\n', i + 1))) {
      i += code[i + 1] === '\n' ? 2 : 3; // continuación de línea
    } else if (c === '#') {
      while (i < n && code[i] !== '\n') i += 1;
    } else if (c === '"' || c === "'") {
      i = readString(i, i);
    } else if (c >= '0' && c <= '9') {
      NUMBER.lastIndex = i;
      const match = NUMBER.exec(code);
      push('number', match[0], i);
      i += match[0].length;
    } else if (c === ';' && stack.length === 0) {
      tokens.push({ type: 'newline', value: ';', index: i, depth: 0 });
      i += 1;
    } else if (OPEN.has(c)) {
      push('op', c, i);
      stack.push({ ch: c, index: i });
      i += 1;
    } else if (CLOSE.has(c)) {
      const top = stack.pop();
      if (!top || top.ch !== PAIRS[c]) {
        syntaxErrors.push({ index: i, message: 'Paréntesis o corchete sin pareja.' });
      }
      push('op', c, i);
      i += 1;
    } else {
      NAME.lastIndex = i;
      const match = NAME.exec(code);
      if (match) {
        const word = match[0];
        const after = i + word.length;
        // Prefijos de string (f'...', r"...", b'...'): el prefijo no es un nombre.
        if (STRING_PREFIX.test(word) && (code[after] === '"' || code[after] === "'")) {
          i = readString(i, after, /[fF]/.test(word));
        } else {
          push('name', word, i);
          i = after;
        }
      } else {
        const op = MULTI_OPS.find((candidate) => code.startsWith(candidate, i));
        if (op) {
          push('op', op, i);
          i += op.length;
        } else if (SINGLE_OPS.includes(c)) {
          push('op', c, i);
          i += 1;
        } else {
          syntaxErrors.push({ index: i, message: 'Carácter no válido.' });
          i += 1;
        }
      }
    }
  }

  stack.forEach((open) =>
    syntaxErrors.push({ index: open.index, message: 'Paréntesis o corchete sin cerrar.' }),
  );

  return { tokens, syntaxErrors };
}

// Errores de indentación (inesperada, bloque faltante, dedent que no coincide).
function checkIndentation(tokens) {
  const errors = [];
  const levels = [0];
  let prev = null;

  for (const token of tokens) {
    if (token.type === 'newline') continue;
    if (token.indent !== undefined) {
      const opensBlock = prev?.type === 'op' && prev.value === ':';
      const top = levels[levels.length - 1];
      if (token.indent > top) {
        if (opensBlock) levels.push(token.indent);
        else errors.push({ index: token.index, message: 'Indentación inesperada.' });
      } else {
        if (opensBlock) errors.push({ index: token.index, message: 'Se esperaba un bloque indentado.' });
        while (levels.length > 1 && levels[levels.length - 1] > token.indent) levels.pop();
        if (levels[levels.length - 1] !== token.indent) {
          errors.push({
            index: token.index,
            message: 'La indentación no coincide con la de ningún bloque anterior.',
          });
        }
      }
    }
    prev = token;
  }
  if (prev?.type === 'op' && prev.value === ':') {
    errors.push({ index: prev.index, message: 'Se esperaba un bloque indentado.' });
  }
  return errors;
}

// Qué es una primitiva y cuáles puede usar el tipo. null si no hay lista cargada.
function buildLookup(api, type) {
  if (!api) return null;
  const restricted = Object.hasOwn(api, type ?? '') && type !== 'shared';
  const known = new Set();
  const allConstants = new Set();
  const allowed = new Set();
  const allowedFunctions = new Set();

  for (const [key, section] of Object.entries(api)) {
    const usable = !restricted || key === 'shared' || key === type;
    for (const name of section?.constants ?? []) {
      known.add(name);
      allConstants.add(name);
      if (usable) allowed.add(name);
    }
    for (const name of section?.functions ?? []) {
      known.add(name);
      if (usable) {
        allowed.add(name);
        allowedFunctions.add(name);
      }
    }
  }

  // Si la lista del tipo (o de alguno, sin tipo) está incompleta, una llamada
  // desconocida podría ser una primitiva válida: no se juzga en el cliente.
  const skipUnknownCalls = restricted
    ? api[type]?.complete === false
    : Object.values(api).some((section) => section?.complete === false);

  return { known, allConstants, allowed, allowedFunctions, skipUnknownCalls };
}

/**
 * @param {string} code
 * @param {'playerBehavior'|'coachBehavior'} [type]
 * @param {object|null} [api]  Lista de primitivas (por defecto BEHAVIOR_API).
 * @returns {null | { rule: string, line: number, column: number, message: string }}
 */
export function validateBehaviorCode(code, type, api = BEHAVIOR_API) {
  if (typeof code !== 'string' || code === '') return null;

  const lineStarts = [0];
  for (let i = 0; i < code.length; i += 1) if (code[i] === '\n') lineStarts.push(i + 1);
  const locate = (index) => {
    let line = 0;
    while (line + 1 < lineStarts.length && lineStarts[line + 1] <= index) line += 1;
    return { line: line + 1, column: index - lineStarts[line] + 1 };
  };
  const build = (rule, index, message) => ({
    rule,
    ...locate(index),
    message: message ?? MESSAGES[rule],
  });

  // 1) Sintaxis. Con errores de sintaxis no se evalúan las demás reglas (igual que el servidor).
  const { tokens, syntaxErrors } = tokenize(code);
  syntaxErrors.push(...checkIndentation(tokens));
  if (syntaxErrors.length > 0) {
    const first = syntaxErrors.reduce((a, b) => (b.index < a.index ? b : a));
    return build('syntaxError', first.index, first.message);
  }

  // 2) Reglas de validez: gana la primera por posición (línea y después columna).
  let best = null;
  const consider = (rule, index, message) => {
    if (best === null || index < best.index) best = { rule, index, message };
  };
  const lookup = buildLookup(api, type);

  // Asignaciones a primitivas (constantes o funciones). Se evalúan primero para ganar un empate.
  if (lookup) {
    const segments = [[]];
    for (const token of tokens) {
      if (token.type === 'newline') segments.push([]);
      else segments[segments.length - 1].push(token);
    }
    for (const segment of segments) {
      let lastAssign = -1;
      segment.forEach((token, idx) => {
        if (token.type === 'op' && token.depth === 0 && ASSIGN_OPS.has(token.value)) lastAssign = idx;
      });
      for (let idx = 0; idx < lastAssign; idx += 1) {
        const token = segment[idx];
        if (token.type !== 'name' || token.depth !== 0 || !lookup.known.has(token.value)) continue;
        const prev = segment[idx - 1];
        const next = segment[idx + 1];
        if (prev?.type === 'op' && prev.value === '.') continue;
        if (next?.type === 'op' && ['.', '(', '['].includes(next.value)) continue; // asigna a un atributo o elemento
        consider('primitiveAssignmentNotAllowed', token.index);
      }
    }
  }

  // Construcciones prohibidas a nivel de operador, string y paréntesis:
  // f-strings, literales {}, slices, :=, decoradores.
  const brackets = [];
  tokens.forEach((token, k) => {
    if (token.type === 'string' && token.fstring) {
      consider(CONSTRUCT, token.index, 'No se permiten f-strings.');
      return;
    }
    if (token.type !== 'op') return;
    const { value } = token;
    if (OPEN.has(value)) {
      if (value === '{') {
        consider(CONSTRUCT, token.index, 'No se permiten literales de diccionario ni de conjunto.');
      }
      const prev = tokens[k - 1];
      const isSubscript =
        value === '[' &&
        prev &&
        (prev.type === 'string' ||
          (prev.type === 'name' && !KEYWORDS.has(prev.value)) ||
          (prev.type === 'op' && (prev.value === ')' || prev.value === ']')));
      brackets.push({ isSubscript });
    } else if (CLOSE.has(value)) {
      brackets.pop();
    } else if (value === ':' && brackets[brackets.length - 1]?.isSubscript) {
      consider(CONSTRUCT, token.index, 'No se permiten slices.');
    } else if (value === ':=') {
      consider(CONSTRUCT, token.index, 'No se permite el operador := .');
    } else if (value === '@' && token.indent !== undefined) {
      consider(CONSTRUCT, token.index, 'No se permiten decoradores.');
    }
  });

  for (let k = 0; k < tokens.length; k += 1) {
    const token = tokens[k];
    if (token.type !== 'name') continue;
    const word = token.value;
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    const isAttribute = prev?.type === 'op' && prev.value === '.';
    const isCall = next?.type === 'op' && next.value === '(';

    if (word.startsWith('__')) {
      consider(CONSTRUCT, token.index, 'No se permiten nombres que comiencen con "__".');
    } else if (word === 'import') {
      consider('importNotAllowed', token.index);
    } else if (word === 'from') {
      if (!prev || prev.type === 'newline') consider('importNotAllowed', token.index);
    } else if (word === 'def') {
      consider('functionDefinitionNotAllowed', token.index);
    } else if (word === 'class') {
      consider('classNotAllowed', token.index);
    } else if (word === 'global' || word === 'nonlocal') {
      consider('globalNotAllowed', token.index);
    } else if (word === 'while') {
      consider('loopNotAllowed', token.index);
    } else if (word === 'for') {
      consider(token.depth > 0 ? 'comprehensionNotAllowed' : 'loopNotAllowed', token.index);
    } else if (word === 'in') {
      const isNotIn = prev?.type === 'name' && prev.value === 'not';
      consider(
        CONSTRUCT,
        isNotIn ? prev.index : token.index,
        isNotIn ? 'No se permite el operador not in.' : 'No se permite el operador in.',
      );
    } else if (KEYWORD_RULES[word]) {
      const [rule, message] = KEYWORD_RULES[word];
      consider(rule, token.index, message);
    } else if (KEYWORDS.has(word)) {
      // otras palabras reservadas (if, return, not...): no son llamadas ni primitivas
    } else if (isAttribute) {
      // objeto.atributo(): solo es válido si el atributo es una primitiva usable.
      if (isCall && lookup && !lookup.skipUnknownCalls && !lookup.allowedFunctions.has(word)) {
        consider('callNotAllowed', token.index, `No se permite llamar a ".${word}()": no es una primitiva del sistema.`);
      }
    } else {
      const isKeywordArgument =
        token.depth > 0 && next?.type === 'op' && next.value === '=' &&
        (prev?.value === '(' || prev?.value === ',');
      if (isKeywordArgument) continue;

      if (lookup) {
        if (lookup.known.has(word) && !lookup.allowed.has(word)) {
          consider(
            'primitiveNotAllowedForType',
            token.index,
            `La primitiva "${word}" no se puede usar en un comportamiento de ${TYPE_LABELS[type] ?? 'este tipo'}.`,
          );
        } else if (isCall && lookup.allConstants.has(word) && !lookup.allowedFunctions.has(word)) {
          consider('callNotAllowed', token.index, `"${word}" es una constante, no se puede llamar.`);
        } else if (isCall && !lookup.known.has(word) && !lookup.skipUnknownCalls) {
          consider('callNotAllowed', token.index, `No se permite llamar a "${word}()": no es una primitiva del sistema.`);
        }
      } else if (isCall && BUILTINS.has(word)) {
        consider('callNotAllowed', token.index, `No se permite llamar a "${word}()": no es una primitiva del sistema.`);
      }
    }
  }

  return best ? build(best.rule, best.index, best.message) : null;
}

/**
 * Límites de largo (el servidor responde 409 codeTooLong). No tiene ubicación,
 * por eso no forma parte de CodeError. Un salto de línea final no suma una línea.
 * @returns {null | { rule: 'codeTooLong', message: string }}
 */
export function validateBehaviorCodeLength(code) {
  if (typeof code !== 'string') return null;
  const lines = code.split('\n').length - (code.endsWith('\n') ? 1 : 0);
  if (lines > MAX_CODE_LINES) {
    return {
      rule: 'codeTooLong',
      message: `El código supera el máximo de ${MAX_CODE_LINES} líneas (tiene ${lines}).`,
    };
  }
  const chars = [...code].length;
  if (chars > MAX_CODE_CHARS) {
    return {
      rule: 'codeTooLong',
      message: `El código supera el máximo de ${MAX_CODE_CHARS} caracteres (tiene ${chars}).`,
    };
  }
  return null;
}