# Implementation Plan: Explorer Tree Results View

**Branch**: `003-adx-explorer-results` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-adx-explorer-results/spec.md`

## Summary

When a user opens a `.adx` file, a `TreeDataProvider<AdxResultNode>` contributed to the
VS Code Explorer sidebar displays query results as collapsible row nodes. The existing
webview panel is preserved; the tree view is additive. The tree reflects loading, results
(up to 500 rows), empty, error, and idle states. Document save triggers a debounced
(500 ms) tree refresh using the existing mechanism in `adxDocumentProvider.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (`"strict": true`), Node.js 18+
**Primary Dependencies**: VS Code Extension API 1.74+, `azure-kusto-data` v7, `@azure/identity` v4
**Storage**: N/A (no new persistent state)
**Testing**: Jest (unit, outside VS Code host) + VS Code Extension Test Runner (integration)
**Target Platform**: VS Code 1.74+ (desktop)
**Project Type**: VS Code extension
**Performance Goals**: Tree refresh visible in < 50 ms after data arrives; tree scrolls
responsively at 500 rows (no virtualization needed at that count)
**Constraints**: No new runtime npm dependencies; TypeScript strict mode; zero `any` escapes
**Scale/Scope**: Single-user extension; up to 500 rows rendered in tree per query

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extension-First | ✅ PASS | Uses `vscode.window.registerTreeDataProvider` + `contributes.views.explorer` — native VS Code API; no standalone patterns |
| II. Simplicity (YAGNI) | ✅ PASS | Single new file (`adxResultsTreeProvider.ts`); 3 modified files; no new dependencies; `registerTreeDataProvider` chosen over `createTreeView` (simpler); no lazy-load pagination (not needed at 500 rows) |
| III. Data Accuracy | ✅ PASS | 500-row cap communicated via visible status node ("Showing 500 of N rows"); `totalRowCount` from `QueryResult` is surfaced; no silent truncation |
| IV. Test Coverage | ✅ PASS | Unit tests required for all `AdxResultsTreeProvider` methods; integration test required for tree registration + refresh signal |
| V. Incremental Delivery | ✅ PASS | Single user story; webview preserved; feature is independently deployable |

*Post-design re-check*: All five principles still pass after Phase 1 design. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-adx-explorer-results/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — all unknowns resolved
├── data-model.md        # Phase 1 output — AdxResultNode union + state machine
├── quickstart.md        # Phase 1 output — code samples + manual test steps
├── contracts/
│   └── package-json.md  # Phase 1 output — package.json contribution contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── extension.ts                        # MODIFIED — create + register treeProvider
├── providers/
│   ├── adxDocumentProvider.ts          # MODIFIED — call treeProvider.set*() methods
│   └── adxResultsTreeProvider.ts       # NEW — TreeDataProvider<AdxResultNode>
├── services/
│   ├── credentialService.ts            # UNCHANGED
│   └── queryService.ts                 # UNCHANGED
├── types/
│   └── messages.ts                     # UNCHANGED — ResultColumn, ResultRow reused
└── webview/
    ├── panelManager.ts                 # UNCHANGED
    ├── resultTransformer.ts            # UNCHANGED
    └── resultsHtml.ts                  # UNCHANGED

tests/
├── unit/
│   └── adxResultsTreeProvider.test.ts  # NEW — Jest unit tests
└── integration/
    └── treeView.test.ts                # NEW — VS Code integration test

package.json                            # MODIFIED — adds contributes.views.explorer
```

**Structure Decision**: Option 1 (single project). All changes are within the existing
`src/providers/` directory pattern. One new source file, one new unit test file, one
new integration test file.

## Complexity Tracking

> No constitution violations — this table is empty.

---

## Phase 0: Research

**Output**: [research.md](./research.md) — all five unknowns resolved.

| Unknown | Resolution |
|---------|-----------|
| VS Code Tree View API | `registerTreeDataProvider` + `contributes.views.explorer` |
| Explorer vs custom sidebar | Explorer sidebar (no new icon required) |
| Data model for nodes | Discriminated union `AdxResultNode` with 3 variants |
| Truncation limit | 500 rows with visible status node |
| Integration point | Extend `adxDocumentProvider`, pass tree provider as dependency |

---

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for full entity definitions.

**Summary**:
- `AdxResultNode` discriminated union: `StatusNode | RowNode | CellNode`
- `TreeProviderState` internal state machine: `idle → loading → results/error`
- Reuses `ResultColumn`, `ResultRow`, `QueryResult` from existing code unchanged

### Tree State → Node Mapping

| Provider State | Root nodes rendered |
|---------------|-------------------|
| `idle` | `StatusNode("Open a .adx file to see results")` |
| `loading` | `StatusNode("Loading query results…")` |
| `results` (empty) | `StatusNode("No results")` |
| `results` (truncated) | `StatusNode("Showing 500 of N rows")`, `RowNode(0…499)` |
| `results` (full) | `RowNode(0…N-1)` |
| `error` | `StatusNode("Error: <message>")` |
| no credentials | `StatusNode("ADX credentials not configured")` |

### Interface Contracts

See [contracts/package-json.md](./contracts/package-json.md) for the public contribution contract.

**Public API of `AdxResultsTreeProvider`**:
```typescript
class AdxResultsTreeProvider implements vscode.TreeDataProvider<AdxResultNode> {
  readonly onDidChangeTreeData: vscode.Event<AdxResultNode | undefined | void>;
  setLoading(): void;
  setResults(result: QueryResult): void;
  setError(message: string): void;
  setNoCredentials(): void;
  getTreeItem(element: AdxResultNode): vscode.TreeItem;
  getChildren(element?: AdxResultNode): vscode.ProviderResult<AdxResultNode[]>;
}
```

### Integration Flow

```
User opens .adx file
  └─ adxDocumentProvider.handleDocument()
       ├─ readCredentials() → null → treeProvider.setNoCredentials()
       └─ readCredentials() → ok
            ├─ treeProvider.setLoading()
            ├─ panelManager.openOrReveal(credentials, doc)  [existing — UNCHANGED]
            └─ queryService.executeQuery()
                 ├─ success → treeProvider.setResults(result)
                 └─ error   → treeProvider.setError(message)

User saves .adx file (debounced 500ms — existing mechanism)
  └─ panelManager.reloadForDocument(credentials, doc)  [existing — UNCHANGED]
  └─ [same query path above for tree update]
```

> **Note on panelManager integration**: The query execution currently happens *inside*
> `panelManager.runQuery()`. To share results with the tree provider without duplicating
> the query call, the tree provider calls will be threaded through the same
> `handleDocument` / `reloadForDocument` path — either by:
>
> (a) passing `treeProvider` into `PanelManager` and calling it from `runQuery()`, or
> (b) restructuring `handleDocument` to call `queryService` directly, then dispatch to
>     both `panelManager` and `treeProvider`.
>
> Option (b) is preferred (cleaner separation); `PanelManager` receives the pre-computed
> `QueryResult` instead of owning the query call. This is a small refactor within the
> existing file pair and does not change the external contract.

### Quickstart

See [quickstart.md](./quickstart.md) for runnable code samples and manual test steps.

---

## Implementation Checklist (for /speckit.tasks)

- [ ] Add `contributes.views.explorer` to `package.json`
- [ ] Create `src/providers/adxResultsTreeProvider.ts` with `AdxResultNode` union and `AdxResultsTreeProvider` class
- [ ] Refactor `panelManager.ts` to accept pre-executed `QueryResult` (extracts query call upward)
- [ ] Update `adxDocumentProvider.ts` to accept `treeProvider` param, call `set*()` methods
- [ ] Update `extension.ts` to instantiate and register `AdxResultsTreeProvider`
- [ ] Write unit tests: `tests/unit/adxResultsTreeProvider.test.ts`
- [ ] Write integration test: `tests/integration/treeView.test.ts`
- [ ] Run `npm test && npm run lint` — must pass clean
