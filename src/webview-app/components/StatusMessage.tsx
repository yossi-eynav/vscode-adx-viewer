interface Props {
  text: string;
}

export function StatusMessage({ text }: Props) {
  return (
    <div style={{ padding: '12px', fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)' }}>
      {text}
    </div>
  );
}
