import * as vscode from 'vscode';
import {
  readAllConnections,
  writeConnection,
  setActiveConnection,
  validateCredentials,
  ADXCredentials,
} from '../services/credentialService';
import { testConnection } from '../services/queryService';

export function registerConfigureCredentials(
  context: vscode.ExtensionContext,
  onConnectionActivated?: () => Promise<void>
): void {
  const disposable = vscode.commands.registerCommand(
    'adxViewer.configureCredentials',
    async () => {
      const store = await readAllConnections();
      const connectionNames = store ? Object.keys(store.connections) : [];

      // Step 0: pick an existing connection to edit, or create a new one
      let connectionName: string | undefined;

      if (connectionNames.length === 0) {
        connectionName = await vscode.window.showInputBox({
          title: 'ADX: Add Connection — Name',
          prompt: 'Enter a name for this connection',
          placeHolder: 'prod, staging, dev...',
          value: 'default',
          ignoreFocusOut: true,
        });
      } else {
        const items: vscode.QuickPickItem[] = [
          ...connectionNames.map(n => ({
            label: n,
            description: n === store?.activeConnection ? '(active)' : undefined,
          })),
          { label: '$(add) New connection...', description: '' },
        ];
        const pick = await vscode.window.showQuickPick(items, {
          title: 'ADX: Add / Edit Connection',
          placeHolder: 'Select a connection to edit, or add a new one',
        });
        if (!pick) return;

        if (pick.label === '$(add) New connection...') {
          connectionName = await vscode.window.showInputBox({
            title: 'ADX: New Connection — Name',
            prompt: 'Enter a name for this connection',
            placeHolder: 'prod, staging, dev...',
            ignoreFocusOut: true,
          });
        } else {
          connectionName = pick.label;
        }
      }

      if (!connectionName) return;

      const existing = store?.connections[connectionName];
      let prefill: Partial<ADXCredentials> | undefined = existing ?? undefined;

      // Retry loop: re-collect and re-validate until success or the user cancels.
      while (true) {
        const creds = await collectCredentials(prefill);
        if (creds === undefined) return;

        const validationError = validateCredentials(creds);
        if (validationError) {
          void vscode.window.showErrorMessage(validationError);
          prefill = creds;
          continue;
        }

        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'ADX: Validating credentials…',
            cancellable: false,
          },
          () => testConnection(creds)
        );

        if (result.ok) {
          await writeConnection(connectionName, creds);
          const isAlreadyActive = store?.activeConnection === connectionName;

          if (isAlreadyActive) {
            void vscode.window.showInformationMessage(
              `ADX connection "${connectionName}" updated successfully.`
            );
            await onConnectionActivated?.();
          } else {
            const setActive = await vscode.window.showInformationMessage(
              `Connection "${connectionName}" saved. Set as active connection?`,
              'Yes',
              'No'
            );
            if (setActive === 'Yes') {
              await setActiveConnection(connectionName);
              await onConnectionActivated?.();
            }
          }
          return;
        }

        // On failure do NOT save; offer Retry or Cancel.
        const choice = await vscode.window.showErrorMessage(
          result.message,
          'Retry',
          'Cancel'
        );
        if (choice !== 'Retry') return;
        prefill = creds;
      }
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Walks the user through the credential input sequence.
 * Returns undefined if the user cancels any step.
 */
async function collectCredentials(
  prefill?: Partial<ADXCredentials>
): Promise<ADXCredentials | undefined> {
  const clusterUrl = await promptStep({
    title: 'ADX: Configure Connection (1 / 5)',
    prompt: 'Enter your ADX cluster URL',
    placeholder: 'https://mycluster.eastus.kusto.windows.net',
    value: prefill?.clusterUrl ?? '',
    validateInput: (v) => {
      if (!v) return 'Cluster URL is required';
      if (!v.startsWith('https://')) return 'Cluster URL must start with https://';
      return null;
    },
  });
  if (clusterUrl === undefined) return undefined;

  const tenantId = await promptStep({
    title: 'ADX: Configure Connection (2 / 5)',
    prompt: 'Enter your Azure AD Tenant ID',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    value: prefill?.tenantId ?? '',
    validateInput: (v) => (v ? null : 'Tenant ID is required'),
  });
  if (tenantId === undefined) return undefined;

  const clientId = await promptStep({
    title: 'ADX: Configure Connection (3 / 5)',
    prompt: 'Enter your Azure AD Client (Application) ID',
    placeholder: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
    value: prefill?.clientId ?? '',
    validateInput: (v) => (v ? null : 'Client ID is required'),
  });
  if (clientId === undefined) return undefined;

  const existingSecret = prefill?.clientSecret;
  const secretPlaceholder = existingSecret ? '***' : '';
  const rawSecret = await promptStep({
    title: 'ADX: Configure Connection (4 / 5)',
    prompt: 'Enter your Azure AD Client Secret',
    placeholder: 'Leave blank to keep existing secret',
    value: secretPlaceholder,
    password: true,
    validateInput: (v) => {
      if (!existingSecret && !v) return 'Client Secret is required';
      return null;
    },
  });
  if (rawSecret === undefined) return undefined;

  const clientSecret =
    rawSecret === '' || rawSecret === '***'
      ? existingSecret ?? rawSecret
      : rawSecret;

  const defaultDatabase = await promptStep({
    title: 'ADX: Configure Connection (5 / 5)',
    prompt: 'Enter the default database name',
    placeholder: 'MyDatabase',
    value: prefill?.defaultDatabase ?? '',
    validateInput: (v) => (v ? null : 'Default database is required'),
  });
  if (defaultDatabase === undefined) return undefined;

  return { clusterUrl, tenantId, clientId, clientSecret, defaultDatabase };
}

interface PromptOptions {
  title: string;
  prompt: string;
  placeholder: string;
  value?: string;
  password?: boolean;
  validateInput?: (v: string) => string | null;
}

async function promptStep(options: PromptOptions): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: options.title,
    prompt: options.prompt,
    placeHolder: options.placeholder,
    value: options.value,
    password: options.password,
    validateInput: options.validateInput ?? undefined,
    ignoreFocusOut: true,
  });
}
