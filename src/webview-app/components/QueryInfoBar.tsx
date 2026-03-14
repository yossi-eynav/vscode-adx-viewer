import type { ActiveFilter } from '../../types/messages';

interface Props {
  totalRowCount: number;
  displayedRowCount: number;
  truncated: boolean;
  executedAt: string;
  queryDurationMs: number;
  activeFilters: ActiveFilter[];
}

export function QueryInfoBar({
  totalRowCount,
  displayedRowCount,
  truncated,
  executedAt,
  queryDurationMs,
  activeFilters,
}: Props) {
  const time = new Date(executedAt).toLocaleTimeString();
  const duration = queryDurationMs >= 1000
    ? `${(queryDurationMs / 1000).toFixed(2)}s`
    : `${queryDurationMs}ms`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '6px 10px',
      marginBottom: '10px',
      background: 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 60%, transparent)',
      borderRadius: '4px',
      fontSize: '0.82em',
      color: 'var(--vscode-descriptionForeground)',
      flexWrap: 'wrap',
    }}>
      {/* Row count */}
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

      {/* Timing */}
      <span>
        query time <strong style={{ color: 'var(--vscode-foreground)' }}>{duration}</strong>
      </span>
      <span>at {time}</span>

      {/* Active variable filters */}
      {activeFilters.length > 0 && (
        <>
          <span style={{ opacity: 0.4 }}>|</span>
          {activeFilters.map(f => (
            <span
              key={f.name}
              title="Variable filter — run 'ADX: Configure Query Variable' to change"
              style={{
                padding: '2px 9px',
                background: 'color-mix(in srgb, var(--vscode-textLink-foreground, #4daafc) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--vscode-textLink-foreground, #4daafc) 35%, transparent)',
                borderRadius: '10px',
                color: 'var(--vscode-textLink-foreground, #4daafc)',
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                fontSize: '0.9em',
                whiteSpace: 'nowrap',
              }}
            >
              {f.name} = &quot;{f.value}&quot;
            </span>
          ))}
        </>
      )}
    </div>
  );
}
