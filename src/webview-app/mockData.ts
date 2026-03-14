import type { RenderResultsMessage, RenderErrorMessage } from '../types/messages';
import { mapColumnType } from '../webview/resultTransformer';
import rawResults from './mock-results.json';

// Columns and rows are driven by mock-results.json — regenerate with: npm run webview:fetch
export const MOCK_RESULTS: RenderResultsMessage = {
  command: 'renderResults',
  columns: rawResults.columns.map(col => ({
    name: col.name,
    type: mapColumnType(col.type),
  })),
  rows: rawResults.rows as RenderResultsMessage['rows'],
  truncated: rawResults.totalRowCount > rawResults.rows.length,
  totalRowCount: rawResults.totalRowCount,
  executedAt: new Date().toISOString(),
  queryDurationMs: 842,
};

export const MOCK_RESULTS_TRUNCATED: RenderResultsMessage = {
  ...MOCK_RESULTS,
  truncated: true,
  totalRowCount: 50_000,
  queryDurationMs: 3210,
};

export const MOCK_ERROR: RenderErrorMessage = {
  command: 'renderError',
  message: 'Failed to execute query: Request failed with status 400',
  statusCode: 400,
  responseBody: JSON.stringify(
    { error: { code: 'SyntaxError', message: "Syntax error: Expected 'pipe_operator', got 'eof'" } },
    null, 2
  ),
};

export const MOCK_ERROR_AUTH: RenderErrorMessage = {
  command: 'renderError',
  message: 'Authentication failed: The provided credentials are invalid.',
  statusCode: 401,
};
