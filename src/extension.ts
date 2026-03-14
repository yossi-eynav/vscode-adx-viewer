import * as vscode from 'vscode';
import { registerConfigureCredentials } from './commands/configureCredentials';
import { registerAdxDocumentProvider } from './providers/adxDocumentProvider';
import { registerDefineVariable, registerConfigureVariable } from './commands/manageVariables';
import { readCredentials } from './services/credentialService';
import { getVariables, getActiveFilters } from './services/variableService';
import { PanelManager } from './webview/panelManager';

export function activate(context: vscode.ExtensionContext): void {
  registerConfigureCredentials(context);
  const panelManager = new PanelManager(context.extensionUri, context.globalState);
  registerAdxDocumentProvider(context, panelManager);

  // ── Status bar ────────────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'adxViewer.configureVariable';
  context.subscriptions.push(statusBar);

  function refreshStatusBar(): void {
    const active = getActiveFilters(getVariables(context.globalState));
    if (active.length === 0) {
      statusBar.text = '$(filter) ADX: no filters';
      statusBar.tooltip = 'No variable filters active. Click to configure.';
      statusBar.color = undefined;
    } else if (active.length === 1) {
      statusBar.text = `$(filter) ${active[0].name}: ${active[0].value}`;
      statusBar.tooltip = 'ADX variable filter active. Click to change.';
      statusBar.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    } else {
      statusBar.text = `$(filter) ${active.length} filters active`;
      statusBar.tooltip = active.map(f => `${f.name} = "${f.value}"`).join('\n');
      statusBar.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    statusBar.show();
  }
  refreshStatusBar();

  // ── Variable commands ─────────────────────────────────────────────────────
  const onVariablesChanged = (): void => {
    refreshStatusBar();
    panelManager.broadcastConfig();
  };

  registerDefineVariable(context, onVariablesChanged);
  registerConfigureVariable(context, onVariablesChanged);

  // ── Viewer commands ───────────────────────────────────────────────────────
  async function openKustoPanel(mode: 'table' | 'graph'): Promise<void> {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || !doc.fileName.endsWith('.kusto')) {
      vscode.window.showErrorMessage('Open a .kusto file first.');
      return;
    }
    const credentials = await readCredentials();
    if (!credentials) {
      const action = await vscode.window.showErrorMessage(
        "ADX credentials not configured. Run 'ADX: Configure Connection' to set up.",
        'Configure Now'
      );
      if (action === 'Configure Now') {
        await vscode.commands.executeCommand('adxViewer.configureCredentials');
      }
      return;
    }
    if (mode === 'graph') {
      panelManager.openOrRevealGraph(credentials, doc);
    } else {
      panelManager.openOrReveal(credentials, doc);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.openViewer', () => openKustoPanel('table'))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.showGraph', () => openKustoPanel('graph'))
  );

  // ── JSON columns command ──────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.configureJsonColumns', async () => {
      const config = vscode.workspace.getConfiguration('adxViewer');
      const current = config.get<string[]>('jsonColumns', ['customDimensions']);
      const input = await vscode.window.showInputBox({
        title: 'Configure JSON Columns',
        prompt: 'Comma-separated list of column names to render as JSON',
        value: current.join(', '),
        placeHolder: 'customDimensions, details',
      });
      if (input === undefined) return;
      const jsonColumns = input
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      await config.update('jsonColumns', jsonColumns, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`JSON columns updated: ${jsonColumns.join(', ') || '(none)'}`);
    })
  );
}

export function deactivate(): void {
  // nothing to clean up
}
