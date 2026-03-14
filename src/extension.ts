import * as vscode from 'vscode';
import { registerConfigureCredentials } from './commands/configureCredentials';
import { registerAdxDocumentProvider } from './providers/adxDocumentProvider';
import { readCredentials } from './services/credentialService';
import { PanelManager } from './webview/panelManager';

export function activate(context: vscode.ExtensionContext): void {
  registerConfigureCredentials(context);
  const panelManager = new PanelManager(context.extensionUri);
  registerAdxDocumentProvider(context, panelManager);

  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.openViewer', async () => {
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
      panelManager.openOrReveal(credentials, doc);
    })
  );

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
