interface Props {
  message: string;
  statusCode?: number;
  responseBody?: string;
}

export function ErrorMessage({ message, statusCode, responseBody }: Props) {
  return (
    <div style={{ color: 'var(--vscode-errorForeground)', padding: '12px' }}>
      {message}
      {statusCode !== undefined && (
        <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>· HTTP {statusCode}</span>
      )}
      {responseBody !== undefined && (
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer' }}>Response details</summary>
          <pre style={{
            fontFamily: 'monospace',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '8px',
            background: 'var(--vscode-editor-lineHighlightBackground)',
            margin: '4px 0 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {responseBody}
          </pre>
        </details>
      )}
    </div>
  );
}
