import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { python } from '@codemirror/lang-python';
import { tags } from '@lezer/highlight';
import './BehaviorCodeEditor.css';

// Colores por variable CSS (definidas en BehaviorCodeEditor.css, con modo claro y oscuro).
const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--cm-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--cm-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--cm-number)' },
  { tag: tags.comment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--cm-function)' },
]);

const theme = EditorView.theme({
  '&': {
    height: '260px',
    fontSize: '15px',
    color: 'var(--text-h)',
    backgroundColor: 'var(--code-bg)',
    textAlign: 'left',
  },
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '150%', letterSpacing: 'normal', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--text-h)' },
  '.cm-cursor': { borderLeftColor: 'var(--text-h)' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--text)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--accent-bg)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-h)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: 'var(--accent-border)',
  },
  '.cm-tooltip': {
    color: 'var(--text-h)',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
  },
});

const editableExtensions = (disabled) => [
  EditorView.editable.of(!disabled),
  EditorState.readOnly.of(disabled),
];

/**
 * Convierte errores del validador (o del servidor) en diagnósticos de CodeMirror.
 * Usa `index`/`length` si vienen; si no (el `codeError` del servidor solo trae línea y
 * columna), calcula el offset y subraya la palabra que empieza ahí.
 */
export function toDiagnostics(state, errors) {
  const { doc } = state;
  if (doc.length === 0) return [];

  return errors.flatMap((error) => {
    let from;
    if (Number.isInteger(error.index)) {
      from = error.index;
    } else if (error.line >= 1 && error.line <= doc.lines) {
      from = doc.line(error.line).from + error.column - 1;
    } else {
      return [];
    }
    from = Math.min(Math.max(from, 0), doc.length);

    let to = error.length ? from + error.length : (state.wordAt(from)?.to ?? from + 1);
    to = Math.min(Math.max(to, from), doc.length);
    if (to === from) {
      if (from < doc.length) to = from + 1;
      else from -= 1; // error al final del texto: se subraya el último carácter
    }
    return [{ from, to, severity: 'error', message: error.message, source: error.rule }];
  });
}

/**
 * Editor de código de comportamientos. No valida nada: dibuja los `diagnostics`
 * que le pasa el formulario (una única fuente de verdad).
 *
 * @param value        texto actual (controlado)
 * @param onChange     (texto) => void
 * @param diagnostics  [{ rule, message, line, column, index?, length? }]
 * @param disabled     solo lectura mientras se envía
 * @param labelledBy   id del elemento que rotula al editor
 */
export default function BehaviorCodeEditor({ value, onChange, diagnostics = [], disabled = false, labelledBy }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const editableRef = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          lintGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          python(), // coloreado y autoindentado de Python
          syntaxHighlighting(highlightStyle),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({
            ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
            spellcheck: 'false',
          }),
          theme,
          editableRef.current.of(editableExtensions(disabled)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
    // El editor se crea una sola vez; value/disabled/diagnostics se sincronizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios de `value` hechos desde afuera (si coincide con el documento, no hace nada).
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editableRef.current.reconfigure(editableExtensions(disabled)) });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(setDiagnostics(view.state, toDiagnostics(view.state, diagnostics)));
  }, [diagnostics, value]);

  return <div ref={hostRef} className="behavior-code-editor" data-testid="behavior-code-editor" />;
}