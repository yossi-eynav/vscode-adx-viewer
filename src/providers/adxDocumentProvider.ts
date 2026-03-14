import * as vscode from 'vscode';
import { readCredentials } from '../services/credentialService';
import { PanelManager } from '../webview/panelManager';

export function registerAdxDocumentProvider(
  context: vscode.ExtensionContext,
  panelManager: PanelManager
): void {
  const handleDocument = async (document: vscode.TextDocument): Promise<void> => {
    if (!document.fileName.endsWith('.kusto')) return;

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

  for (const doc of vscode.workspace.textDocuments) {
    void handleDocument(doc);
  }

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(handleDocument));

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!document.fileName.endsWith('.kusto')) return;

      const key = document.uri.toString();
      const existing = saveTimers.get(key);
      if (existing !== undefined) clearTimeout(existing);

      saveTimers.set(
        key,
        setTimeout(() => {
          saveTimers.delete(key);
          void (async () => {
            const creds = await readCredentials();
            if (!creds) return;
            panelManager.reloadForDocument(creds, document);
          })();
        }, 500)
      );
    })
  );
}
