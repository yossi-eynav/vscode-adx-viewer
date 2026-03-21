import * as vscode from 'vscode';
import {
  readAllConnections,
  setActiveConnection,
  ADXCredentials,
} from '../services/credentialService';

export function registerSwitchConnection(
  context: vscode.ExtensionContext,
  onSwitch: (creds: ADXCredentials) => Promise<void>
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.switchConnection', async () => {
      const store = await readAllConnections();
      const names = store ? Object.keys(store.connections) : [];

      if (names.length === 0) {
        void vscode.window.showErrorMessage(
          'No connections configured. Run "ADX: Add / Edit Connection" first.'
        );
        return;
      }

      const items: vscode.QuickPickItem[] = names.map(name => ({
        label: name === store!.activeConnection ? `$(check) ${name}` : name,
        description: store!.connections[name].clusterUrl,
      }));

      const pick = await vscode.window.showQuickPick(items, {
        title: 'ADX: Switch Connection',
        placeHolder: 'Select the active connection',
      });
      if (!pick) return;

      const name = pick.label.replace(/^\$\(check\) /, '');
      if (name === store!.activeConnection) return; // already active

      await setActiveConnection(name);
      await onSwitch(store!.connections[name]);
    })
  );
}
