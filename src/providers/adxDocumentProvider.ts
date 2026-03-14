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

  const openDisposable = vscode.workspace.onDidOpenTextDocument(handleDocument);
  context.subscriptions.push(openDisposable);

  // FR-008: Reload the results panel when a .adx file is saved.
  // FR-010: Debounce rapid saves — wait 500 ms after the last save before executing.
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
    if (!document.fileName.endsWith('.adx')) return;

    const key = document.uri.toString();
    const existing = saveTimers.get(key);
    if (existing !== undefined) clearTimeout(existing);

    saveTimers.set(
      key,
      setTimeout(() => {
        saveTimers.delete(key);
        void (async () => {
          // FR-012: Skip reload silently if credentials are not configured.
          const creds = await readCredentials();
          if (!creds) return;
          panelManager.reloadForDocument(creds, document);
        })();
      }, 500)
    );
  });

  context.subscriptions.push(saveDisposable);
}
