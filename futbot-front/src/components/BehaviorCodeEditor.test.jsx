import { act, render } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import BehaviorCodeEditor, { toDiagnostics } from './BehaviorCodeEditor';

const stateOf = (doc) => EditorState.create({ doc });

describe('toDiagnostics', () => {
  it('usa index y length para subrayar el token completo', () => {
    const [d] = toDiagnostics(stateOf('x = 1\nimport os'), [
      { rule: 'importNotAllowed', message: 'm', index: 6, length: 6 },
    ]);
    expect(d).toMatchObject({ from: 6, to: 12, severity: 'error', message: 'm', source: 'importNotAllowed' });
  });

  it('con solo línea y columna (error del servidor) subraya la palabra', () => {
    const [d] = toDiagnostics(stateOf('a = 1\nmove = 1'), [{ rule: 'r', message: 'm', line: 2, column: 1 }]);
    expect(d).toMatchObject({ from: 6, to: 10 });
  });

  it('ignora líneas fuera del documento y documentos vacíos', () => {
    expect(toDiagnostics(stateOf('x = 1'), [{ rule: 'r', message: 'm', line: 9, column: 1 }])).toEqual([]);
    expect(toDiagnostics(stateOf(''), [{ rule: 'r', message: 'm', line: 1, column: 1 }])).toEqual([]);
  });

  it('un error al final del texto subraya el último carácter', () => {
    const [d] = toDiagnostics(stateOf('a = ('), [{ rule: 'r', message: 'm', index: 5 }]);
    expect(d).toMatchObject({ from: 4, to: 5 });
  });
});

describe('BehaviorCodeEditor', () => {
  it('muestra números de línea y subraya el error con ondulado', () => {
    const { container } = render(
      <BehaviorCodeEditor
        value={'x = 1\nimport os'}
        onChange={vi.fn()}
        diagnostics={[
          { rule: 'importNotAllowed', message: 'No se permite usar import.', index: 6, length: 6, line: 2, column: 1 },
        ]}
      />,
    );

    expect(container.querySelector('.cm-lineNumbers')).toBeInTheDocument();
    expect(container.querySelector('.cm-lintRange-error')).toHaveTextContent('import');
  });

  it('avisa los cambios del documento con el texto completo', () => {
    const onChange = vi.fn();
    const { container } = render(<BehaviorCodeEditor value="x = 1" onChange={onChange} />);
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor'));

    act(() => view.dispatch({ changes: { from: 0, insert: 'a' } }));

    expect(onChange).toHaveBeenCalledWith('ax = 1');
  });

  it('en modo disabled no se puede editar', () => {
    const { container } = render(<BehaviorCodeEditor value="x" onChange={vi.fn()} disabled />);

    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false');
  });
});