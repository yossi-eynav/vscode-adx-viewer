import { useEffect, useState } from 'react';
import type { HostToWebviewMessage, RenderResultsMessage } from '../types/messages';
import { isVsCodeWebview, getVsCodeApi } from './vscodeApi';
import { ResultsTable } from './components/ResultsTable';
import { ResultsChart } from './components/ResultsChart';
import { GraphView } from './components/GraphView';
import { ErrorMessage } from './components/ErrorMessage';
import { StatusMessage } from './components/StatusMessage';
import { QueryInfoBar } from './components/QueryInfoBar';

const isGraphMode = (window as { adxViewerMode?: string }).adxViewerMode === 'graph';
import { MOCK_RESULTS, MOCK_RESULTS_TRUNCATED, MOCK_ERROR, MOCK_ERROR_AUTH } from './mockData';

type ViewerState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; statusCode?: number; responseBody?: string }
  | { kind: 'results'; columns: RenderResultsMessage['columns']; rows: RenderResultsMessage['rows']; truncated: boolean; totalRowCount: number; executedAt: string; queryDurationMs: number };

function stateFromResults(msg: RenderResultsMessage): ViewerState {
  return { kind: 'results', columns: msg.columns, rows: msg.rows, truncated: msg.truncated, totalRowCount: msg.totalRowCount, executedAt: msg.executedAt, queryDurationMs: msg.queryDurationMs };
}

export function App() {
  const [state, setState] = useState<ViewerState>({ kind: 'loading' });
  const [jsonColumns, setJsonColumns] = useState<string[]>(['customDimensions']);
  const inVsCode = isVsCodeWebview();

  useEffect(() => {
    if (!inVsCode) {
      setState(stateFromResults(MOCK_RESULTS));
      return;
    }

    const handler = (event: MessageEvent<HostToWebviewMessage>) => {
      const msg = event.data;
      switch (msg.command) {
        case 'renderLoading': setState({ kind: 'loading' }); break;
        case 'renderEmpty':   setState({ kind: 'empty' }); break;
        case 'renderError':   setState({ kind: 'error', message: msg.message, statusCode: msg.statusCode, responseBody: msg.responseBody }); break;
        case 'renderResults': setState(stateFromResults(msg)); break;
        case 'setConfig':     setJsonColumns(msg.jsonColumns); break;
      }
    };

    window.addEventListener('message', handler);
    getVsCodeApi()?.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      fontFamily: 'var(--vscode-font-family)',
      fontSize: 'var(--vscode-font-size)',
      color: 'var(--vscode-foreground)',
      background: 'var(--vscode-editor-background)',
      margin: 0,
      padding: '16px',
    }}>
      {!inVsCode && <DevToolbar onStateChange={setState} graphMode={isGraphMode} />}
      <ViewerContent state={state} jsonColumns={jsonColumns} />
    </div>
  );
}

function ViewerContent({ state, jsonColumns }: { state: ViewerState; jsonColumns: string[] }) {
  switch (state.kind) {
    case 'loading': return <StatusMessage text="Loading query results..." />;
    case 'empty':   return <StatusMessage text="No results returned." />;
    case 'error':   return <ErrorMessage message={state.message} statusCode={state.statusCode} responseBody={state.responseBody} />;
    case 'results': return isGraphMode ? (
      <GraphView
        columns={state.columns}
        rows={state.rows}
        totalRowCount={state.totalRowCount}
        executedAt={state.executedAt}
        queryDurationMs={state.queryDurationMs}
      />
    ) : (
      <>
        <QueryInfoBar
          totalRowCount={state.totalRowCount}
          displayedRowCount={state.rows.length}
          truncated={state.truncated}
          executedAt={state.executedAt}
          queryDurationMs={state.queryDurationMs}
        />
        <ResultsTable columns={state.columns} rows={state.rows} jsonColumns={jsonColumns} />
        <ResultsChart columns={state.columns} rows={state.rows} />
      </>
    );
  }
}

function DevToolbar({ onStateChange, graphMode }: { onStateChange: (s: ViewerState) => void; graphMode: boolean }) {
  const scenarios: Array<{ label: string; state: ViewerState }> = [
    { label: 'Results',   state: stateFromResults(MOCK_RESULTS) },
    { label: 'Truncated', state: stateFromResults(MOCK_RESULTS_TRUNCATED) },
    { label: 'Loading',   state: { kind: 'loading' } },
    { label: 'Empty',     state: { kind: 'empty' } },
    { label: 'Error 400', state: { kind: 'error', message: MOCK_ERROR.message, statusCode: MOCK_ERROR.statusCode, responseBody: MOCK_ERROR.responseBody } },
    { label: 'Error 401', state: { kind: 'error', message: MOCK_ERROR_AUTH.message, statusCode: MOCK_ERROR_AUTH.statusCode } },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 10px',
      marginBottom: '12px',
      background: '#2d2d30',
      borderRadius: '4px',
      fontSize: '11px',
    }}>
      <span style={{ color: '#9d9d9d', marginRight: '4px' }}>Dev {graphMode ? '(graph)' : '(table)'}:</span>
      {scenarios.map(s => (
        <button
          key={s.label}
          onClick={() => onStateChange(s.state)}
          style={{
            padding: '2px 8px',
            background: '#3c3c3c',
            border: '1px solid #555',
            borderRadius: '3px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
