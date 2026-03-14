# Data Model: Explorer Tree Results View

**Feature**: `003-adx-explorer-results`
**Date**: 2026-03-14

---

## Entities

### AdxResultNode (discriminated union — new)

The element type `T` used throughout `TreeDataProvider<AdxResultNode>`.

```typescript
// src/providers/adxResultsTreeProvider.ts

type AdxResultNode =
  | StatusNode
  | RowNode
  | CellNode;

interface StatusNode {
  readonly kind: 'status';
  readonly id: string;       // unique stable ID for VS Code state preservation
  readonly label: string;    // displayed text
  readonly description?: string;  // secondary text (row count, etc.)
}

interface RowNode {
  readonly kind: 'row';
  readonly index: number;            // 0-based row index
  readonly row: ResultRow;           // from src/types/messages.ts
  readonly columns: ResultColumn[];  // from src/types/messages.ts
}

interface CellNode {
  readonly kind: 'cell';
  readonly rowIndex: number;         // parent row index (for unique ID)
  readonly column: ResultColumn;     // column metadata
  readonly value: string | number | boolean | null;
}
```

**Fields**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `kind` | `'status' \| 'row' \| 'cell'` | Yes | Discriminant |
| `id` | `string` | StatusNode only | Must be unique across the tree |
| `label` | `string` | StatusNode only | Human-readable |
| `description` | `string` | StatusNode, optional | Secondary text |
| `index` | `number` | RowNode only | 0-based, ≥ 0 |
| `row` | `ResultRow` | RowNode only | From existing `messages.ts` |
| `columns` | `ResultColumn[]` | RowNode only | From existing `messages.ts` |
| `rowIndex` | `number` | CellNode only | Parent row index |
| `column` | `ResultColumn` | CellNode only | Column name + type |
| `value` | `string \| number \| boolean \| null` | CellNode only | Raw cell value |

**Validation rules**:
- `RowNode.row.length === RowNode.columns.length` (enforced by queryService)
- `CellNode.value` is the entry at `row[column_index]`; nulls are rendered as `(null)`

---

### TreeProviderState (internal to AdxResultsTreeProvider)

Tracks the current display state of the tree. Not exposed to VS Code; drives `getChildren` logic.

```typescript
type TreeProviderState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; data: TreeResultData }
  | { status: 'error';   message: string };

interface TreeResultData {
  columns: ResultColumn[];
  rows: ResultRow[];      // already capped at MAX_TREE_ROWS (500)
  truncated: boolean;
  totalRowCount: number;
}
```

**State transitions**:

```
idle ──────────────────────────────────────────────────►
 ▲                                                      │
 │  .adx file closed / no .adx file active              │ .adx file opened
 │                                                      ▼
 │                                                   loading
 │                                                      │
 │◄──────────── (error) ─────────────────────────── queryService
 │                                                      │
 │◄────────────────────────────── (success) ────────────►
                                                     results
```

---

### Reused Entities (unchanged)

These are defined in `src/types/messages.ts` and `src/services/queryService.ts`:

| Entity | Source | Used by tree |
|--------|--------|-------------|
| `ResultColumn` | `messages.ts` | `RowNode.columns`, `CellNode.column` |
| `ResultRow` | `messages.ts` | `RowNode.row` |
| `QueryResult` | `queryService.ts` | Input to `setResults()` |
| `ADXCredentials` | `credentialService.ts` | Passed through; unchanged |
| `QueryError` | `queryService.ts` | Caught; message → `StatusNode.label` |

---

## Constants

```typescript
// src/providers/adxResultsTreeProvider.ts
const MAX_TREE_ROWS = 500;         // Cap for rows rendered in the tree
const VIEW_ID = 'adxQueryResults'; // Must match package.json contributes.views.explorer[].id
```

---

## Tree Rendering Map

| State | Root-level nodes |
|-------|-----------------|
| `idle` | `[StatusNode("Open a .adx file to see results")]` |
| `loading` | `[StatusNode("Loading query results…")]` |
| `results` (empty) | `[StatusNode("No results")]` |
| `results` (with rows, truncated) | `[StatusNode("Showing 500 of N rows"), RowNode(0), RowNode(1), …]` |
| `results` (with rows, not truncated) | `[RowNode(0), RowNode(1), …]` |
| `error` | `[StatusNode("Error: <message>")]` |
| no credentials | `[StatusNode("ADX credentials not configured")]` |

---

## Source File Impact

| File | Change |
|------|--------|
| `src/providers/adxResultsTreeProvider.ts` | **NEW** — implements `TreeDataProvider<AdxResultNode>` |
| `src/providers/adxDocumentProvider.ts` | **MODIFIED** — calls `treeProvider.set*()` methods |
| `src/extension.ts` | **MODIFIED** — creates tree provider, passes to `registerAdxDocumentProvider` |
| `package.json` | **MODIFIED** — adds `contributes.views.explorer` entry |
| `src/types/messages.ts` | **UNCHANGED** — `ResultColumn`, `ResultRow` reused as-is |
