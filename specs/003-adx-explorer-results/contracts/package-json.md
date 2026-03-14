# Contract: package.json Contributions

**Feature**: `003-adx-explorer-results`
**Date**: 2026-03-14
**Type**: VS Code Extension Manifest — public contribution points

This document defines the additions to `package.json` required for the Explorer tree view.
These are the public-facing contracts this feature exposes to VS Code and its users.

---

## Addition: contributes.views.explorer

```json
"views": {
  "explorer": [
    {
      "id": "adxQueryResults",
      "name": "ADX Results",
      "when": "true"
    }
  ]
}
```

| Field | Value | Notes |
|-------|-------|-------|
| `id` | `"adxQueryResults"` | Must match `VIEW_ID` constant in `adxResultsTreeProvider.ts` |
| `name` | `"ADX Results"` | Displayed as section header in Explorer sidebar |
| `when` | `"true"` | Always visible (not conditional on file type; idle state shown when no .adx open) |

**No new commands contributed** — the tree view is display-only in this feature. Refresh is triggered programmatically via document open/save.

---

## Full contributes diff (additions only)

Before:
```json
"contributes": {
  "commands": [...],
  "languages": [...]
}
```

After:
```json
"contributes": {
  "commands": [...],
  "languages": [...],
  "views": {
    "explorer": [
      {
        "id": "adxQueryResults",
        "name": "ADX Results",
        "when": "true"
      }
    ]
  }
}
```

---

## Registration in extension.ts

```typescript
// src/extension.ts (addition)
import { AdxResultsTreeProvider } from './providers/adxResultsTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  registerConfigureCredentials(context);

  const panelManager = new PanelManager(context.extensionUri);

  // NEW: create tree provider and register with VS Code
  const treeProvider = new AdxResultsTreeProvider();
  const treeDisposable = vscode.window.registerTreeDataProvider(
    'adxQueryResults',  // must match contributes.views.explorer[].id
    treeProvider
  );
  context.subscriptions.push(treeDisposable);

  registerAdxDocumentProvider(context, panelManager, treeProvider);
}
```

---

## AdxResultsTreeProvider public interface

This is the internal API between `adxDocumentProvider.ts` and the tree provider:

```typescript
// src/providers/adxResultsTreeProvider.ts (public API surface)
export class AdxResultsTreeProvider
  implements vscode.TreeDataProvider<AdxResultNode>
{
  readonly onDidChangeTreeData: vscode.Event<AdxResultNode | undefined | void>;

  // Called by adxDocumentProvider before query execution
  setLoading(): void;

  // Called by adxDocumentProvider on successful query result
  setResults(result: QueryResult): void;

  // Called by adxDocumentProvider on query failure
  setError(message: string): void;

  // Called by adxDocumentProvider when no credentials exist
  setNoCredentials(): void;

  // VS Code TreeDataProvider protocol
  getTreeItem(element: AdxResultNode): vscode.TreeItem;
  getChildren(element?: AdxResultNode): vscode.ProviderResult<AdxResultNode[]>;
}
```
