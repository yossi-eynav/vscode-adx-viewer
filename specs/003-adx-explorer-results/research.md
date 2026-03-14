# Research: Explorer Tree Results View

**Feature**: `003-adx-explorer-results`
**Date**: 2026-03-14
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: VS Code Tree View API

**Decision**: Use `vscode.window.registerTreeDataProvider` with a `TreeDataProvider<AdxResultNode>` implementation contributed to `views.explorer` in `package.json`.

**Rationale**: `registerTreeDataProvider` is the simplest registration path and requires no extra handle management. `createTreeView` (the alternative) returns a `TreeView` object enabling programmatic reveal/selection, which is not needed for this feature. Using `views.explorer` puts the panel in the standard file explorer sidebar — no custom activity-bar icon is needed.

**Alternatives considered**:
- `vscode.window.createTreeView` — discarded (over-engineering; the extra `TreeView` handle is only needed for `reveal()` or programmatic expand/collapse).
- Custom `viewsContainers` (new sidebar icon) — discarded (would require a custom icon asset and creates unnecessary navigation surface; the Explorer is the natural home for result data).

**Key API facts** (confirmed from `node_modules/@types/vscode/index.d.ts`):
```typescript
// Registration
vscode.window.registerTreeDataProvider(viewId: string, provider: TreeDataProvider<T>): Disposable

// Provider interface (two required methods)
interface TreeDataProvider<T> {
  onDidChangeTreeData?: Event<T | undefined | null | void>;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
  getChildren(element?: T): ProviderResult<T[]>;
}

// Node type
class TreeItem {
  label?: string | TreeItemLabel;
  id?: string;
  description?: string | boolean;
  tooltip?: string | MarkdownString;
  collapsibleState?: TreeItemCollapsibleState;
  iconPath?: string | IconPath;
  command?: Command;
}

// Refresh trigger
class EventEmitter<T> {
  event: Event<T>;
  fire(data?: T): void;
  dispose(): void;
}

// ProviderResult type
type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;
```

---

## Decision 2: Tree Node Data Model

**Decision**: Use a discriminated union `AdxResultNode` type with three variants: `StatusNode`, `RowNode`, `CellNode`.

**Rationale**: A discriminated union keeps `getTreeItem` and `getChildren` exhaustively type-checked. Three variants cover all states without over-modelling.

**Alternatives considered**:
- Class hierarchy (`BaseNode → RowNode, CellNode`) — discarded (classes add boilerplate; plain union + switch is idiomatic TypeScript and simpler).
- Single class with optional fields — discarded (violates strict-mode expectations and makes null-checking verbose).

**Node structure**:
```typescript
type AdxResultNode =
  | { kind: 'status'; label: string; description?: string }
  | { kind: 'row';    index: number; row: ResultRow; columns: ResultColumn[] }
  | { kind: 'cell';   column: ResultColumn; value: string | number | boolean | null };
```

**Tree shape** (rendered by the provider):
```
ADX Results                    ← view title (in package.json)
  Loading query results…       ← status node (while loading)
  ─────────────────────────────
  Showing 500 of 1234 rows     ← status node (only when truncated=true)
  Row 0               ▶        ← row node (collapsed)
    timestamp: 2026-03-01      ← cell node
    value: 42                  ← cell node
  Row 1               ▶
    …
  ─────────────────────────────
  No results                   ← status node (empty result set)
  ADX credentials not conf…    ← status node (no credentials)
  Error: <message>             ← status node (query failure)
```

---

## Decision 3: Integration with Existing Provider

**Decision**: Extend `adxDocumentProvider.ts` to call `AdxResultsTreeProvider.setLoading()` / `setResults()` / `setError()` alongside the existing `panelManager` calls. The webview panel is preserved (NFR-004).

**Rationale**: The document provider already handles `.adx` open, credential check, and save-debounce logic. Adding tree-update calls there avoids duplication and keeps the trigger logic in one place. Passing the tree provider as a dependency (like `PanelManager`) maintains the existing clean separation between layers.

**Alternatives considered**:
- Separate `onDidOpenTextDocument` listener registered in `extension.ts` — discarded (would duplicate the `.adx` filter and credential-check logic already in `adxDocumentProvider`).
- Embed query execution in the tree provider — discarded (violates single-responsibility; query execution belongs in `queryService`).

---

## Decision 4: Row Truncation Limit

**Decision**: Display up to **500 rows** in the tree (half the 1 000-row webview limit). A prominent `StatusNode` at the top communicates the truncation.

**Rationale**: Tree view items are expensive to render (DOM nodes per row) compared to an HTML `<table>`. 500 rows keeps scrolling responsive. The spec (FR-005) sets this limit. Data accuracy is preserved because the `totalRowCount` from `QueryResult` is shown in the status node.

**Alternatives considered**:
- Use the same 1 000-row limit — discarded (performance risk with deeply nested items).
- Lazy-load additional rows on scroll — discarded (YAGNI; `getChildren(element)` supports lazy loading but requires `TreeItemCollapsibleState` toggling at the root level, adding complexity not warranted for an MVP).

---

## Decision 5: No New Runtime Dependencies

**Decision**: All tree functionality is implemented using the VS Code Extension API only — no new npm packages.

**Rationale**: `TreeDataProvider`, `TreeItem`, `EventEmitter` are all provided by `@types/vscode` (compile-time types) and the VS Code runtime (no bundle weight). Adding a dependency for a view abstraction would violate the Simplicity principle.

**Alternatives considered**:
- A tree-view helper library — discarded (no such library is needed; the VS Code API is complete for this use case).

---

## Summary of Resolved Unknowns

| Unknown | Resolved As |
|---------|-------------|
| Which VS Code API for tree view? | `registerTreeDataProvider` + `contributes.views.explorer` |
| Explorer sidebar vs custom container? | Explorer sidebar (no new icon required) |
| Data model for nodes? | Discriminated union `AdxResultNode` with 3 variants |
| Truncation limit? | 500 rows with visible notice |
| Integration point with existing code? | Extend `adxDocumentProvider`, pass tree provider as dependency |
| New dependencies needed? | None |
