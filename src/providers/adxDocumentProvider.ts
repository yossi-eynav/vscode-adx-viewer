import * as vscode from 'vscode';
import { readCredentials } from '../services/credentialService';
import { PanelManager } from '../webview/panelManager';

export function registerAdxDocumentProvider(
  context: vscode.ExtensionContext,
  panelManager: PanelManager
): void {
  const handleDocument = async (document: vscode.TextDocument): Promise<void> => {
    if (!document.fileName.endsWith('.adx')) return;

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

    panelManager.openOrReveal(credentials, document);
  };

  // Handle documents already open at activation time
  for (const doc of vscode.workspace.textDocuments) {
    void handleDocument(doc);
  }

  const disposable = vscode.workspace.onDidOpenTextDocument(handleDocument);
  context.subscriptions.push(disposable);
}
