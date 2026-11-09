// Textarea que imita a BehaviorCodeEditor: así los tests del formulario siguen
// usando fireEvent.change sin depender de CodeMirror.
export default function BehaviorCodeEditorMock({ value, onChange, diagnostics = [], disabled }) {
  return (
    <>
      <textarea
        aria-label="Código"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {diagnostics.map((d) => (
        <span key={`${d.line}:${d.column}:${d.rule}`} data-testid="code-diagnostic">
          {`${d.line}:${d.column}`}
        </span>
      ))}
    </>
  );
}