import * as vscode from 'vscode';
import { registerConfigureCredentials } from './commands/configureCredentials';
import { registerAdxDocumentProvider } from './providers/adxDocumentProvider';
import { PanelManager } from './webview/panelManager';

export function activate(context: vscode.ExtensionContext): void {
  registerConfigureCredentials(context);

  const panelManager = new PanelManager(context.extensionUri);
  registerAdxDocumentProvider(context, panelManager);
}

export function deactivate(): void {
  // nothing to clean up
}
