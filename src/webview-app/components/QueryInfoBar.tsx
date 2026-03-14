interface Props {
  totalRowCount: number;
  displayedRowCount: number;
  truncated: boolean;
  executedAt: string;
  queryDurationMs: number;
}

export function QueryInfoBar({ totalRowCount, displayedRowCount, truncated, executedAt, queryDurationMs }: Props) {
  const time = new Date(executedAt).toLocaleTimeString();
  const duration = queryDurationMs >= 1000
    ? `${(queryDurationMs / 1000).toFixed(2)}s`
    : `${queryDurationMs}ms`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '6px 10px',
      marginBottom: '10px',
      background: 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 60%, transparent)',
      borderRadius: '4px',
      fontSize: '0.82em',
      color: 'var(--vscode-descriptionForeground)',
      flexWrap: 'wrap',
    }}>
      <span>
        <strong style={{ color: 'var(--vscode-foreground)' }}>{totalRowCount.toLocaleString()}</strong> rows
        {truncated && (
          <span style={{
            marginLeft: '6px',
            padding: '1px 6px',
            background: 'var(--vscode-inputValidation-warningBackground)',
            border: '1px solid var(--vscode-inputValidation-warningBorder)',
            borderRadius: '3px',
            fontSize: '0.9em',
          }}>
            showing first {displayedRowCount.toLocaleString()}
          </span>
        )}
      </span>
      <span>query time <strong style={{ color: 'var(--vscode-foreground)' }}>{duration}</strong></span>
      <span>at {time}</span>
    </div>
  );
}
