interface Props {
  totalRowCount: number;
}

export function TruncationNotice({ totalRowCount }: Props) {
  return (
    <div style={{
      padding: '8px',
      background: 'var(--vscode-inputValidation-warningBackground)',
      border: '1px solid var(--vscode-inputValidation-warningBorder)',
      marginBottom: '12px',
    }}>
      Showing first 1,000 rows of {totalRowCount.toLocaleString()} total
    </div>
  );
}
