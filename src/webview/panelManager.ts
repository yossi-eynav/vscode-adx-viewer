import * as vscode from 'vscode';
import { executeQuery, QueryError, EmptyQueryError } from '../services/queryService';
import { ADXCredentials } from '../services/credentialService';
import { getResultsHtml } from './resultsHtml';
import { HostToWebviewMessage } from '../types/messages';

export class PanelManager {
  private panels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  openOrReveal(credentials: ADXCredentials, document: vscode.TextDocument): void {
    this.openOrRevealWithMode('table', credentials, document);
  }

  openOrRevealGraph(credentials: ADXCredentials, document: vscode.TextDocument): void {
    this.openOrRevealWithMode('graph', credentials, document);
  }

  private openOrRevealWithMode(
    mode: 'table' | 'graph',
    credentials: ADXCredentials,
    document: vscode.TextDocument
  ): void {
    const key = `${mode}:${document.uri.toString()}`;

    if (this.panels.has(key)) {
      this.panels.get(key)!.reveal();
      return;
    }

    const filename = document.fileName.split('/').pop() ?? 'Results';
    const title = mode === 'graph' ? `ADX Graph: ${filename}` : `ADX: ${filename}`;

    const panel = vscode.window.createWebviewPanel(
      'adxQueryResults',
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')],
      }
    );

    panel.webview.html = getResultsHtml(panel.webview, this.extensionUri, mode);
    this.panels.set(key, panel);
    panel.onDidDispose(() => this.panels.delete(key));

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      if (message.command === 'ready') {
        const jsonColumns: string[] = vscode.workspace
          .getConfiguration('adxViewer')
          .get<string[]>('jsonColumns', ['customDimensions']);
        void panel.webview.postMessage({ command: 'setConfig', jsonColumns } satisfies HostToWebviewMessage);
        await this.runQuery(panel, credentials, document);
      }
    });
  }

  reloadForDocument(credentials: ADXCredentials, document: vscode.TextDocument): void {
    const key = `table:${document.uri.toString()}`;
    const panel = this.panels.get(key);
    if (!panel) return;
    void this.runQuery(panel, credentials, document);
  }

  private async runQuery(
    panel: vscode.WebviewPanel,
    credentials: ADXCredentials,
    document: vscode.TextDocument
  ): Promise<void> {
    void panel.webview.postMessage({ command: 'renderLoading' } satisfies HostToWebviewMessage);

    const queryText = document.getText();
    const database = credentials.defaultDatabase ?? '';

    try {
      const result = await executeQuery(credentials, queryText, database);

      if (result.rows.length === 0) {
        void panel.webview.postMessage({ command: 'renderEmpty' } satisfies HostToWebviewMessage);
      } else {
        void panel.webview.postMessage({
          command: 'renderResults',
          columns: result.columns,
          rows: result.rows,
          truncated: result.truncated,
          totalRowCount: result.totalRowCount,
          executedAt: result.executedAt.toISOString(),
          queryDurationMs: result.queryDurationMs,
        } satisfies HostToWebviewMessage);
      }
    } catch (err) {
      const message =
        err instanceof EmptyQueryError || err instanceof QueryError
          ? err.message
          : `Query failed: ${err instanceof Error ? err.message : String(err)}`;

      void panel.webview.postMessage({
        command: 'renderError',
        message,
        statusCode: err instanceof QueryError ? err.statusCode : undefined,
        responseBody: err instanceof QueryError ? err.responseBody : undefined,
      } satisfies HostToWebviewMessage);
    }
  }
}
