import * as vscode from 'vscode';
import {
  readCredentials,
  writeCredentials,
  validateCredentials,
  ADXCredentials,
} from '../services/credentialService';

export function registerConfigureCredentials(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'adxViewer.configureCredentials',
    async () => {
      const existing = await readCredentials();

      const clusterUrl = await promptStep({
        title: 'ADX: Configure Connection (1 / 4)',
        prompt: 'Enter your ADX cluster URL',
        placeholder: 'https://mycluster.eastus.kusto.windows.net',
        value: existing?.clusterUrl ?? '',
        validateInput: (v) => {
          if (!v) return 'Cluster URL is required';
          if (!v.startsWith('https://')) return 'Cluster URL must start with https://';
          return null;
        },
      });
      if (clusterUrl === undefined) return;

      const tenantId = await promptStep({
        title: 'ADX: Configure Connection (2 / 4)',
        prompt: 'Enter your Azure AD Tenant ID',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        value: existing?.tenantId ?? '',
        validateInput: (v) => (v ? null : 'Tenant ID is required'),
      });
      if (tenantId === undefined) return;

      const clientId = await promptStep({
        title: 'ADX: Configure Connection (3 / 4)',
        prompt: 'Enter your Azure AD Client (Application) ID',
        placeholder: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
        value: existing?.clientId ?? '',
        validateInput: (v) => (v ? null : 'Client ID is required'),
      });
      if (clientId === undefined) return;

      const secretPlaceholder = existing?.clientSecret ? '***' : '';
      const rawSecret = await promptStep({
        title: 'ADX: Configure Connection (4 / 4)',
        prompt: 'Enter your Azure AD Client Secret',
        placeholder: 'Leave blank to keep existing secret',
        value: secretPlaceholder,
        password: true,
        validateInput: (v) => {
          if (!existing?.clientSecret && !v) return 'Client Secret is required';
          return null;
        },
      });
      if (rawSecret === undefined) return;

      // If user left the placeholder or blank but existing secret exists, retain it
      const clientSecret =
        rawSecret === '' || rawSecret === '***'
          ? existing?.clientSecret ?? rawSecret
          : rawSecret;

      const creds: ADXCredentials = {
        clusterUrl,
        tenantId,
        clientId,
        clientSecret,
        defaultDatabase: existing?.defaultDatabase,
      };

      const validationError = validateCredentials(creds);
      if (validationError) {
        void vscode.window.showErrorMessage(validationError);
        return;
      }

      await writeCredentials(creds);
      void vscode.window.showInformationMessage('ADX connection configured successfully.');
    }
  );

  context.subscriptions.push(disposable);
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
