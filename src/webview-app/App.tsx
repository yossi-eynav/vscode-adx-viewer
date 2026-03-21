import { useEffect, useState } from 'react';
import type { HostToWebviewMessage, RenderResultsMessage, ActiveFilter } from '../types/messages';
import { getVsCodeApi } from './vscodeApi';
import { ResultsTable } from './components/ResultsTable';
import { ResultsChart } from './components/ResultsChart';
import { GraphView } from './components/GraphView';
import { ErrorMessage } from './components/ErrorMessage';
import { StatusMessage } from './components/StatusMessage';
import { QueryInfoBar } from './components/QueryInfoBar';

const isGraphMode = (window as { adxViewerMode?: string }).adxViewerMode === 'graph';

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
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent<HostToWebviewMessage>) => {
      const msg = event.data;
      switch (msg.command) {
        case 'renderLoading': setState({ kind: 'loading' }); break;
        case 'renderEmpty':   setState({ kind: 'empty' }); break;
        case 'renderError':   setState({ kind: 'error', message: msg.message, statusCode: msg.statusCode, responseBody: msg.responseBody }); break;
        case 'renderResults': setState(stateFromResults(msg)); break;
        case 'setConfig':
          setActiveFilters(msg.activeFilters);
          break;
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
      <ViewerContent state={state} activeFilters={activeFilters} />
    </div>
  );
}

function ViewerContent({ state, activeFilters }: { state: ViewerState; activeFilters: ActiveFilter[] }) {
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
          activeFilters={activeFilters}
        />
        <ResultsTable columns={state.columns} rows={state.rows} />
        <ResultsChart columns={state.columns} rows={state.rows} />
      </>
    );
  }
}

