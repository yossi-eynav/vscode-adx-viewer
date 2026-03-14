# Tasks: Explorer Tree Results View

**Input**: Design documents from `/specs/003-adx-explorer-results/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — required by Constitution IV ("Unit tests are required for all business logic; Integration tests are required for all VS Code API interactions").

**Organization**: Tasks are grouped by phase; single user story (US1) with a refactor foundational phase that extracts query dispatch from `PanelManager` before the tree provider can be wired in.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US1]**: User Story 1 — Display Query Results in Explorer Tree
- Paths follow single-project layout at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the VS Code contribution point so the "ADX Results" view appears in the Explorer sidebar.

- [x] T001 Add `contributes.views.explorer` entry (`"id": "adxQueryResults"`, `"name": "ADX Results"`, `"when": "true"`) to `package.json`

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Extract query execution out of `PanelManager` so one `queryService.executeQuery()` call can fan-out results to both the webview panel and the new tree provider. This refactor MUST be complete before any tree provider work can land.

**⚠️ CRITICAL**: US1 implementation cannot begin until this phase is complete.

- [x] T002 Refactor `src/webview/panelManager.ts` — remove internal `queryService` calls from `openOrReveal()` / `reloadForDocument()`; add `renderResults(panel, result: QueryResult)`, `renderLoading(panel)`, `renderError(panel, message, statusCode?, responseBody?)` methods that accept pre-computed data
- [x] T003 Update `src/providers/adxDocumentProvider.ts` — move `queryService.executeQuery()` call here; dispatch `QueryResult` to `panelManager.render*()` and stub calls to `treeProvider.set*()` (stubs replaced in T010)

**Checkpoint**: Existing webview behaviour must pass `npm test && npm run lint` after T003 before proceeding.

---

## Phase 3: User Story 1 — Display Query Results in Explorer Tree (Priority: P1) 🎯 MVP

**Goal**: When a `.adx` file is opened (or saved), the "ADX Results" section of the VS Code Explorer sidebar is populated with collapsible row nodes from the query result. Status nodes communicate loading, truncation (500-row cap), empty, error, and idle states.

**Independent Test**: Open any `.adx` file with credentials configured → Explorer sidebar "ADX Results" section shows "Loading query results…" then populates with "Row 0", "Row 1", … each expandable to `column: value` pairs.

### Tests for User Story 1 ⚠️ Write FIRST — confirm FAILING before implementation

- [x] T004 [US1] Write Jest unit tests for all `AdxResultsTreeProvider` methods — `setLoading()`, `setResults()`, `setError()`, `setNoCredentials()`, `getTreeItem()` (all 3 node kinds), `getChildren()` (root, row, cell levels), 500-row truncation logic — in `tests/unit/adxResultsTreeProvider.test.ts`
- [x] T005 [P] [US1] Write VS Code integration test verifying tree provider registration and `onDidChangeTreeData` fires on `setLoading()` / `setResults()` in `tests/integration/treeView.test.ts`

### Implementation for User Story 1

- [x] T006 [US1] Create `src/providers/adxResultsTreeProvider.ts` — declare `AdxResultNode` discriminated union (`StatusNode | RowNode | CellNode`) and constants `MAX_TREE_ROWS = 500`, `VIEW_ID = 'adxQueryResults'`
- [x] T007 [US1] Implement `AdxResultsTreeProvider` class shell in `src/providers/adxResultsTreeProvider.ts` — `EventEmitter`, internal `_nodes: AdxResultNode[]`, `setLoading()`, `setResults(result: QueryResult)` (cap at 500 rows + truncation notice), `setError(message)`, `setNoCredentials()`
- [x] T008 [US1] Implement `getTreeItem(element: AdxResultNode): vscode.TreeItem` in `src/providers/adxResultsTreeProvider.ts` — `StatusNode → TreeItemCollapsibleState.None`, `RowNode → Collapsed`, `CellNode → None` with `column.name: value` label and `column.type` as description
- [x] T009 [US1] Implement `getChildren(element?: AdxResultNode): vscode.ProviderResult<AdxResultNode[]>` in `src/providers/adxResultsTreeProvider.ts` — root returns `_nodes`; `RowNode` returns `CellNode[]` for each column; all others return `[]`
- [x] T010 [US1] Replace stubs in `src/providers/adxDocumentProvider.ts` — import `AdxResultsTreeProvider`; call `treeProvider.setNoCredentials()` on missing credentials, `treeProvider.setLoading()` before query, `treeProvider.setResults(result)` on success, `treeProvider.setError(message)` on failure
- [x] T011 [US1] Update `src/extension.ts` — import `AdxResultsTreeProvider`; instantiate `treeProvider`; push `vscode.window.registerTreeDataProvider('adxQueryResults', treeProvider)` to `context.subscriptions`; pass `treeProvider` to `registerAdxDocumentProvider`

**Checkpoint**: At this point, the full user story should be functional. Run the manual test in `quickstart.md` to verify.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T012 Run `npm test && npm run lint` — fix all failures; TypeScript strict mode must produce zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS US1 implementation
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
  - Tests (T004, T005): can be written immediately after Phase 2 starts (mock the provider under test)
  - Implementation (T006–T011): must follow T004/T005 (Red before Green)
- **Polish (Phase 4)**: Depends on Phase 3 completion

### User Story Dependencies

- **US1 (P1)**: Only user story — no inter-story dependencies

### Within Phase 3

```
T004 (unit tests)     ─┐
T005 (integration)    ─┤ (write & confirm FAILING)
                        ↓
T006 (union type)   → T007 (state methods) → T008 (getTreeItem) → T009 (getChildren)
                                                                         ↓
                                                               T010 (wire document provider)
                                                                         ↓
                                                               T011 (wire extension.ts)
```

T004 and T005 can be authored in parallel (different files).
T006–T009 are sequential (same file, building incrementally).
T010–T011 can start once T007 is done (public API is defined).

---

## Parallel Example: User Story 1

```bash
# Write tests in parallel (different files):
Task: T004 "Write Jest unit tests for AdxResultsTreeProvider in tests/unit/adxResultsTreeProvider.test.ts"
Task: T005 "Write VS Code integration test for tree registration in tests/integration/treeView.test.ts"

# Once T007 is done (API surface known):
Task: T010 "Wire treeProvider calls in src/providers/adxDocumentProvider.ts"
Task: T011 "Register treeProvider in src/extension.ts"
```

---

## Implementation Strategy

### MVP (Single Story — this IS the MVP)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational refactor (T002, T003)
3. Write failing tests: T004, T005
4. Implement T006 → T007 → T008 → T009 → T010 → T011
5. Confirm tests pass
6. **VALIDATE**: Follow manual test steps in `quickstart.md`
7. Run Phase 4: T012 (`npm test && npm run lint`)

### Incremental Delivery

Each task leaves the extension in a compilable, non-regressing state:
- After T001: Explorer sidebar shows empty "ADX Results" section (no registration yet — VS Code hides unregistered views)
- After T003: Webview behaviour unchanged; document provider drives query dispatch
- After T011: Full tree view functional alongside existing webview panel
- After T012: Clean test + lint pass → PR-ready

---

## Notes

- [P] tasks = different files, no shared state dependencies
- Constitution IV requires Red-before-Green: T004/T005 MUST fail before T006–T011
- `element.textContent` (never `innerHTML`) for any user-facing string (CLAUDE.md pattern)
- No new runtime dependencies — all tree API from `@types/vscode` (compile-time only)
- `VIEW_ID` constant in `adxResultsTreeProvider.ts` must exactly match `package.json` `"id"` field
- Commit after each checkpoint to enable easy rollback
