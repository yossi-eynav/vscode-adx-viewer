import * as vscode from 'vscode';
import type { QueryVariable, VariableSource } from '../types/variables';
import { getVariables, saveVariables } from '../services/variableService';
import { readCredentials } from '../services/credentialService';
import { executeQuery } from '../services/queryService';

// ── Define Variable ───────────────────────────────────────────────────────────

export function registerDefineVariable(
  context: vscode.ExtensionContext,
  onChanged: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.defineVariable', async () => {
      const existing = getVariables(context.globalState);

      const name = await vscode.window.showInputBox({
        title: 'Define Query Variable (1 / 2)',
        prompt: 'Variable name — used as the KQL query parameter name (with _query suffix)',
        placeHolder: 'query_name',
        ignoreFocusOut: true,
        validateInput: v => {
          if (!v.trim()) return 'Name is required';
          if (!/^\w+$/.test(v.trim())) return 'Only letters, digits and underscores allowed';
          return null;
        },
      });
      if (name === undefined) return;
      const trimmedName = name.trim();
      const columnName = trimmedName;

      const sourceChoice = await vscode.window.showQuickPick(
        [
          { label: '$(run) Run a KQL query', description: 'Execute a query to fetch the options list', sourceKind: 'query' as const },
          { label: '$(list-unordered) Use fixed values', description: 'Enter a static comma-separated list', sourceKind: 'values' as const },
        ],
        { title: 'Define Query Variable (2 / 2)', placeHolder: 'How should the options list be populated?' }
      );
      if (!sourceChoice) return;

      let source: VariableSource;

      if (sourceChoice.sourceKind === 'query') {
        const kql = await vscode.window.showInputBox({
          title: `Define Query Variable — KQL source for "${trimmedName}"`,
          prompt: 'Query whose first column provides the selectable values',
          placeHolder: 'table | where t > ago(1h) | distinct site',
          ignoreFocusOut: true,
          validateInput: v => (v.trim() ? null : 'Query is required'),
        });
        if (kql === undefined) return;
        source = { kind: 'query', kql: kql.trim() };
      } else {
        const raw = await vscode.window.showInputBox({
          title: `Define Query Variable — values for "${trimmedName}"`,
          prompt: 'Comma-separated list of values',
          placeHolder: 'value1,value2,value3',
          ignoreFocusOut: true,
          validateInput: v => (v.trim() ? null : 'At least one value is required'),
        });
        if (raw === undefined) return;
        source = { kind: 'values', items: raw.split(',').map(s => s.trim()).filter(Boolean) };
      }

      const variable: QueryVariable = { name: trimmedName, columnName, source };
      const existingIdx = existing.findIndex(v => v.name === trimmedName);
      const updated =
        existingIdx >= 0
          ? existing.map((v, i) =>
              i === existingIdx ? { ...variable, selectedValue: v.selectedValue } : v
            )
          : [...existing, variable];

      await saveVariables(context.globalState, updated);
      onChanged();

      const action = await vscode.window.showInformationMessage(
        `Variable "${trimmedName}" saved.`,
        'Configure now'
      );
      if (action === 'Configure now') {
        await vscode.commands.executeCommand('adxViewer.configureVariable');
      }
    })
  );
}

// ── Configure Variable ────────────────────────────────────────────────────────

export function registerConfigureVariable(
  context: vscode.ExtensionContext,
  onChanged: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('adxViewer.configureVariable', async () => {
      const variables = getVariables(context.globalState);

      if (variables.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No query variables defined yet.',
          'Define one now'
        );
        if (action === 'Define one now') {
          await vscode.commands.executeCommand('adxViewer.defineVariable');
        }
        return;
      }

      // Step 1: pick which variable
      const varPick = await vscode.window.showQuickPick(
        variables.map(v => ({
          label: v.name,
          description: v.selectedValue ? `= "${v.selectedValue}"` : '— not set',
          detail: v.columnName !== v.name ? `filters column: ${v.columnName}` : undefined,
          variable: v,
        })),
        { title: 'Configure Query Variable', placeHolder: 'Select a variable to configure' }
      );
      if (!varPick) return;
      const variable = varPick.variable;

      // Step 2: load options
      let options: string[];
      if (variable.source.kind === 'values') {
        options = variable.source.items;
      } else {
        const creds = await readCredentials();
        if (!creds) {
          vscode.window.showErrorMessage(
            "ADX credentials not configured. Run 'ADX: Configure Connection' first."
          );
          return;
        }
        const kql = variable.source.kind === 'query' ? variable.source.kql : '';
        options = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Loading options for "${variable.name}"…`,
            cancellable: false,
          },
          async () => {
            try {
              const result = await executeQuery(
                creds,
                kql,
                creds.defaultDatabase ?? ''
              );
              return result.rows
                .map(row => String(row[0] ?? ''))
                .filter(Boolean);
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to load options: ${err instanceof Error ? err.message : String(err)}`
              );
              return [];
            }
          }
        );
        if (options.length === 0) return;
      }

      // Step 3: pick a value
      const CLEAR_LABEL = '$(circle-slash)  Clear filter';
      const valuePick = await vscode.window.showQuickPick(
        [
          { label: CLEAR_LABEL, alwaysShow: true },
          ...options.map(o => ({
            label: o,
            picked: o === variable.selectedValue,
          })),
        ],
        {
          title: `Set value for "${variable.name}"`,
          placeHolder: `Filter ${variable.columnName} by…`,
          matchOnDescription: true,
        }
      );
      if (!valuePick) return;

      const newValue = valuePick.label === CLEAR_LABEL ? undefined : valuePick.label;
      const updated = variables.map(v =>
        v.name === variable.name ? { ...v, selectedValue: newValue } : v
      );
      await saveVariables(context.globalState, updated);
      onChanged();

      vscode.window.showInformationMessage(
        newValue
          ? `Filter active: ${variable.columnName} == "${newValue}"`
          : `Filter cleared for "${variable.name}"`
      );
    })
  );
}
