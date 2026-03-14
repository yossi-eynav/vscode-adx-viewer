import * as vscode from 'vscode';
import {
  readCredentials,
  writeCredentials,
  validateCredentials,
  ADXCredentials,
} from '../services/credentialService';
import { testConnection } from '../services/queryService';

export function registerConfigureCredentials(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'adxViewer.configureCredentials',
    async () => {
      const existing = await readCredentials();
      let prefill: Partial<ADXCredentials> | undefined = existing ?? undefined;

      // Retry loop: re-collect and re-validate until success or the user cancels.
      while (true) {
        const creds = await collectCredentials(prefill);
        if (creds === undefined) return; // user cancelled the form

        const validationError = validateCredentials(creds);
        if (validationError) {
          void vscode.window.showErrorMessage(validationError);
          prefill = creds;
          continue;
        }

        // FR-002: Show a progress indicator during the live connection test.
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'ADX: Validating credentials…',
            cancellable: false,
          },
          () => testConnection(creds)
        );

        if (result.ok) {
          // FR-003: Save on success and notify the user.
          await writeCredentials(creds);
          void vscode.window.showInformationMessage(
            'ADX connection configured and verified successfully.'
          );
          return;
        }

        // FR-004 / FR-005 / FR-006: On failure do NOT save; offer Retry or Cancel.
        const choice = await vscode.window.showErrorMessage(
          result.message,
          'Retry',
          'Cancel'
        );

        if (choice !== 'Retry') return; // 'Cancel' or dismissed — exit without saving

        // Pre-fill the retry form with the credentials that just failed.
        prefill = creds;
      }
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Walks the user through the four-step credential input sequence.
 * Accepts optional pre-fill values so the form can be re-opened after a
 * failed connection attempt with the previously entered data intact.
 *
 * Returns undefined if the user cancels any step.
 */
async function collectCredentials(
  prefill?: Partial<ADXCredentials>
): Promise<ADXCredentials | undefined> {
  const clusterUrl = await promptStep({
    title: 'ADX: Configure Connection (1 / 4)',
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
    title: 'ADX: Configure Connection (2 / 4)',
    prompt: 'Enter your Azure AD Tenant ID',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    value: prefill?.tenantId ?? '',
    validateInput: (v) => (v ? null : 'Tenant ID is required'),
  });
  if (tenantId === undefined) return undefined;

  const clientId = await promptStep({
    title: 'ADX: Configure Connection (3 / 4)',
    prompt: 'Enter your Azure AD Client (Application) ID',
    placeholder: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
    value: prefill?.clientId ?? '',
    validateInput: (v) => (v ? null : 'Client ID is required'),
  });
  if (clientId === undefined) return undefined;

  const existingSecret = prefill?.clientSecret;
  const secretPlaceholder = existingSecret ? '***' : '';
  const rawSecret = await promptStep({
    title: 'ADX: Configure Connection (4 / 4)',
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

  // If the user left the placeholder or blank but an existing secret is available, retain it.
  const clientSecret =
    rawSecret === '' || rawSecret === '***'
      ? existingSecret ?? rawSecret
      : rawSecret;

  return {
    clusterUrl,
    tenantId,
    clientId,
    clientSecret,
    defaultDatabase: prefill?.defaultDatabase,
  };
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
