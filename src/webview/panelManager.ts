import * as vscode from 'vscode';
import { executeQuery, QueryError, EmptyQueryError } from '../services/queryService';
import { ADXCredentials } from '../services/credentialService';
import { getResultsHtml } from './resultsHtml';
import { HostToWebviewMessage } from '../types/messages';
import { getVariables, getActiveFilters } from '../services/variableService';

interface PanelEntry {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
}

export class PanelManager {
  private panels = new Map<string, PanelEntry>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly globalState: vscode.Memento
  ) {}

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
      this.panels.get(key)!.panel.reveal();
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
    this.panels.set(key, { panel, document });
    panel.onDidDispose(() => this.panels.delete(key));

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      if (message.command === 'ready') {
        this.sendConfig(panel);
        await this.runQuery(panel, credentials, document);
      }
    });
  }

  /** Push current config (active filters) to all open panels. */
  broadcastConfig(): void {
    for (const { panel } of this.panels.values()) {
      this.sendConfig(panel);
    }
  }

  /** Re-run queries on all open panels with new credentials (e.g. after connection switch). */
  reloadAll(credentials: ADXCredentials): void {
    for (const { panel, document } of this.panels.values()) {
      void this.runQuery(panel, credentials, document);
    }
  }

  private sendConfig(panel: vscode.WebviewPanel): void {
    const activeFilters = getActiveFilters(getVariables(this.globalState))
      .map(f => ({ name: f.name, value: f.value }));
    void panel.webview.postMessage({
      command: 'setConfig',
      activeFilters,
    } satisfies HostToWebviewMessage);
  }

  reloadForDocument(credentials: ADXCredentials, document: vscode.TextDocument): void {
    const key = `table:${document.uri.toString()}`;
    const entry = this.panels.get(key);
    if (!entry) return;
    void this.runQuery(entry.panel, credentials, document);
  }

  private async runQuery(
    panel: vscode.WebviewPanel,
    credentials: ADXCredentials,
    document: vscode.TextDocument
  ): Promise<void> {
    void panel.webview.postMessage({ command: 'renderLoading' } satisfies HostToWebviewMessage);

    const queryText = document.getText();
    const variables = getVariables(this.globalState);
    const activeFilters = getActiveFilters(variables);
    const queryParameters = Object.fromEntries(activeFilters.map(f => [f.name, f.value]));
    const database = credentials.defaultDatabase ?? '';

    try {
      const result = await executeQuery(credentials, queryText, database, queryParameters);

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
