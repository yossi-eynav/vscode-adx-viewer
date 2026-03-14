# Quickstart: Explorer Tree Results View

**Feature**: `003-adx-explorer-results`
**Date**: 2026-03-14

---

## What This Feature Does

When you open a `.adx` file, ADX query results now appear in the **ADX Results** section
of the VS Code Explorer sidebar — in addition to the existing webview panel.

Each result row is a collapsible tree item. Expanding a row shows its column-value pairs.

---

## How to Verify It Works (Manual Test)

**Prerequisites**: Credentials configured via "ADX: Configure Connection".

1. Open VS Code with this extension installed.
2. Open the Explorer sidebar (Ctrl+Shift+E / ⌘⇧E).
3. Scroll down to the **ADX Results** section — it should show "Open a .adx file to see results".
4. Open any `.adx` file.
5. The **ADX Results** section immediately shows "Loading query results…".
6. Once the query completes:
   - If there are rows: you see "Row 0", "Row 1", … as collapsed items.
   - Click the expand arrow on "Row 0" to see `column_name: value` pairs.
   - If truncated: a "Showing 500 of N rows" notice appears at the top.
   - If empty: a "No results" notice appears.
7. Edit the `.adx` query text and save. After 500 ms, the tree refreshes.
8. Close the `.adx` file. The tree returns to the idle state.

---

## Development Quickstart

### 1. Create the tree provider

```typescript
// src/providers/adxResultsTreeProvider.ts

import * as vscode from 'vscode';
import { QueryResult } from '../services/queryService';
import { ResultColumn, ResultRow } from '../types/messages';

const MAX_TREE_ROWS = 500;
const VIEW_ID = 'adxQueryResults';

type AdxResultNode =
  | { kind: 'status'; id: string; label: string; description?: string }
  | { kind: 'row'; index: number; row: ResultRow; columns: ResultColumn[] }
  | { kind: 'cell'; rowIndex: number; column: ResultColumn; value: string | number | boolean | null };

export class AdxResultsTreeProvider
  implements vscode.TreeDataProvider<AdxResultNode>
{
  private readonly _emitter = new vscode.EventEmitter<AdxResultNode | undefined | void>();
  readonly onDidChangeTreeData = this._emitter.event;

  private _state: 'idle' | 'loading' | 'error' | 'results' = 'idle';
  private _nodes: AdxResultNode[] = [{ kind: 'status', id: 'idle', label: 'Open a .adx file to see results' }];

  setLoading(): void {
    this._state = 'loading';
    this._nodes = [{ kind: 'status', id: 'loading', label: 'Loading query results\u2026' }];
    this._emitter.fire(undefined);
  }

  setResults(result: QueryResult): void {
    this._state = 'results';
    const capped = result.rows.slice(0, MAX_TREE_ROWS);
    this._nodes = [];
    if (result.truncated || result.rows.length > MAX_TREE_ROWS) {
      const shown = Math.min(result.rows.length, MAX_TREE_ROWS);
      this._nodes.push({ kind: 'status', id: 'truncated', label: `Showing ${shown} of ${result.totalRowCount} rows` });
    }
    if (capped.length === 0) {
      this._nodes.push({ kind: 'status', id: 'empty', label: 'No results' });
    } else {
      for (let i = 0; i < capped.length; i++) {
        this._nodes.push({ kind: 'row', index: i, row: capped[i], columns: result.columns });
      }
    }
    this._emitter.fire(undefined);
  }

  setError(message: string): void {
    this._state = 'error';
    this._nodes = [{ kind: 'status', id: 'error', label: `Error: ${message}` }];
    this._emitter.fire(undefined);
  }

  setNoCredentials(): void {
    this._nodes = [{ kind: 'status', id: 'no-creds', label: 'ADX credentials not configured' }];
    this._emitter.fire(undefined);
  }

  getTreeItem(element: AdxResultNode): vscode.TreeItem {
    switch (element.kind) {
      case 'status': {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        if (element.description) item.description = element.description;
        return item;
      }
      case 'row':
        return new vscode.TreeItem(`Row ${element.index}`, vscode.TreeItemCollapsibleState.Collapsed);
      case 'cell': {
        const display = element.value === null ? '(null)' : String(element.value);
        const item = new vscode.TreeItem(`${element.column.name}: ${display}`, vscode.TreeItemCollapsibleState.None);
        item.description = element.column.type;
        return item;
      }
    }
  }

  getChildren(element?: AdxResultNode): vscode.ProviderResult<AdxResultNode[]> {
    if (!element) return this._nodes;
    if (element.kind === 'row') {
      return element.columns.map((col, i) => ({
        kind: 'cell' as const,
        rowIndex: element.index,
        column: col,
        value: element.row[i] ?? null,
      }));
    }
    return [];
  }
}
```

### 2. Register in extension.ts

```typescript
import { AdxResultsTreeProvider } from './providers/adxResultsTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  registerConfigureCredentials(context);
  const panelManager = new PanelManager(context.extensionUri);
  const treeProvider = new AdxResultsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('adxQueryResults', treeProvider)
  );
  registerAdxDocumentProvider(context, panelManager, treeProvider);
}
```

### 3. Update adxDocumentProvider.ts

```typescript
export function registerAdxDocumentProvider(
  context: vscode.ExtensionContext,
  panelManager: PanelManager,
  treeProvider: AdxResultsTreeProvider  // NEW parameter
): void {
  const handleDocument = async (document: vscode.TextDocument): Promise<void> => {
    if (!document.fileName.endsWith('.adx')) return;
    const credentials = await readCredentials();
    if (!credentials) {
      treeProvider.setNoCredentials();  // NEW
      // existing credential error prompt …
      return;
    }
    treeProvider.setLoading();          // NEW
    panelManager.openOrReveal(credentials, document);
    // panelManager internally calls queryService and posts results to webview;
    // treeProvider.setResults() is called from the same execution path.
  };
  // … rest unchanged
}
```

### 4. Add view to package.json

```json
"views": {
  "explorer": [
    { "id": "adxQueryResults", "name": "ADX Results", "when": "true" }
  ]
}
```

---

## Running Tests

```bash
npm test          # unit + integration
npm run lint      # zero errors required
```

Unit test file: `tests/unit/adxResultsTreeProvider.test.ts`
