import * as vscode from 'vscode';
import { registerConfigureCredentials } from './commands/configureCredentials';
import { registerSwitchConnection } from './commands/switchConnection';
import { registerAdxDocumentProvider } from './providers/adxDocumentProvider';
import { registerDefineVariable, registerConfigureVariable } from './commands/manageVariables';
import { readCredentials, getActiveConnectionName } from './services/credentialService';
import { getVariables, getActiveFilters } from './services/variableService';
import { PanelManager } from './webview/panelManager';

export function activate(context: vscode.ExtensionContext): void {
  const panelManager = new PanelManager(context.extensionUri, context.globalState);
  registerAdxDocumentProvider(context, panelManager);

  // ── Connection status bar ─────────────────────────────────────────────────
  const connectionBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  connectionBar.command = 'adxViewer.switchConnection';
  context.subscriptions.push(connectionBar);

  async function refreshConnectionBar(): Promise<void> {
    const name = await getActiveConnectionName();
    if (name) {
      connectionBar.text = `$(plug) ${name}`;
      connectionBar.tooltip = `Active ADX connection: ${name}. Click to switch.`;
    } else {
      connectionBar.text = '$(plug) ADX: no connection';
      connectionBar.tooltip = 'No ADX connection configured. Run "ADX: Add / Edit Connection".';
    }
    connectionBar.show();
  }
  void refreshConnectionBar();

  // ── Variable status bar ───────────────────────────────────────────────────
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

  // ── Credentials command ───────────────────────────────────────────────────
  registerConfigureCredentials(context, async () => {
    void refreshConnectionBar();
    const creds = await readCredentials();
    if (creds) panelManager.reloadAll(creds);
  });

  // ── Switch connection command ─────────────────────────────────────────────
  registerSwitchConnection(context, async (creds) => {
    void refreshConnectionBar();
    panelManager.reloadAll(creds);
  });

  // ── Variable commands ─────────────────────────────────────────────────────
  const onVariablesChanged = (): void => {
    refreshStatusBar();
    panelManager.broadcastConfig();
    void readCredentials().then(creds => { if (creds) panelManager.reloadAll(creds); });
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
        "ADX credentials not configured. Run 'ADX: Add / Edit Connection' to set up.",
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
}

export function deactivate(): void {
  // nothing to clean up
}
