# Feature Specification: Explorer Tree Results View

**Feature Branch**: `003-adx-explorer-results`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "when the user opens a .adx file, use vscode explorer to display the query results"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Display Query Results in Explorer Tree (Priority: P1)

When a developer opens a `.adx` file in VS Code, the extension executes the KQL query
and populates a tree view in the Explorer sidebar with the results. Each row from the
query result appears as a collapsible tree node, and expanding a row reveals its
column-value pairs. The developer can browse results without leaving the Explorer panel.

**Why this priority**: This is the core delivery for the feature — surfacing ADX results
inside the native VS Code Explorer with zero additional chrome and no separate panel.
It is the only user story in this spec.

**Independent Test**: Can be fully tested by opening a `.adx` file with credentials
configured. The "ADX Results" tree view in the Explorer panel should populate with
rows from the query, expandable to show column values.

**Acceptance Scenarios**:

1. **Given** credentials are configured and a `.adx` file is opened, **When** the
   extension activates, **Then** an "ADX Results" tree view appears in the Explorer
   sidebar and enters a loading state.
2. **Given** the query executes successfully, **When** results arrive, **Then** each
   result row appears as a collapsed tree node labelled "Row N" and the tree shows
   the total row count.
3. **Given** a "Row N" node is expanded, **When** the user clicks the expand icon,
   **Then** each column is shown as a child item in the format `column_name: value`.
4. **Given** the query returns no rows, **When** rendering completes, **Then** the
   tree shows a single informational node "No results".
5. **Given** the result set exceeds 500 rows, **When** rendering completes, **Then**
   only the first 500 rows appear and a visible "Showing 500 of N rows (truncated)"
   node is added at the top to communicate the limitation.
6. **Given** a `.adx` file is saved after editing, **When** the debounce period
   (500 ms) elapses, **Then** the tree refreshes with the results of the updated query.
7. **Given** the query fails (network error, ADX error, credential error), **When**
   the error is returned, **Then** the tree shows a single error node with the error
   message; no stale rows are left visible.
8. **Given** credentials are not configured and a `.adx` file is opened, **When** the
   extension detects missing credentials, **Then** the tree shows a single node
   "ADX credentials not configured" and the existing error prompt is shown.

---

### Edge Cases

- What happens when the `.adx` file contains multiple KQL statements (only first
  statement runs; inform the user if multi-statement is attempted)?
- What if the query returns a very large number of columns (>50)? Tree items should
  truncate long values with `…` to prevent layout issues.
- What happens when a second `.adx` file is opened while the first is still loading?
  The tree should reflect the results of the most-recently activated `.adx` document.
- What if the workspace has no `.adx` files open? The tree should show an empty / idle
  state ("Open a .adx file to see results").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST register a `TreeDataProvider` under the VS Code
  Explorer view container (`views.explorer` in `package.json`).
- **FR-002**: When a `.adx` file is opened, the tree MUST enter a "loading" state
  while the query executes.
- **FR-003**: On successful query completion, the tree MUST display one root-level
  `TreeItem` per result row, labelled "Row N" (0-indexed), in collapsed state.
- **FR-004**: Expanding a row node MUST reveal one child `TreeItem` per column in the
  format `column_name: value`.
- **FR-005**: The tree MUST display a truncation notice when the row count exceeds 500.
- **FR-006**: On query failure, the tree MUST display a single error `TreeItem` with
  the error message; all previous rows MUST be cleared.
- **FR-007**: When a `.adx` file is saved, the tree MUST debounce re-execution (500 ms,
  reusing the existing debounce in `adxDocumentProvider.ts`).
- **FR-008**: The tree MUST track the currently active `.adx` document and update
  automatically when focus switches between open `.adx` files.
- **FR-009**: When no `.adx` file is open or active, the tree MUST show an idle state
  node ("Open a .adx file to see results").

### Non-Functional Requirements

- **NFR-001**: Tree refresh latency (from result arrival to visible render) MUST be
  imperceptible (<50 ms); the `onDidChangeTreeData` event should fire immediately after
  data is set.
- **NFR-002**: No `innerHTML` assignments in webview-adjacent code; only `textContent`
  for user-facing strings (per existing project convention).
- **NFR-003**: TypeScript strict mode — zero `any` escapes, zero compilation errors.
- **NFR-004**: The existing webview panel behavior is preserved; the tree view is
  additive (does not remove the panel).

### Out of Scope

- Sorting or filtering rows from within the tree view (future feature).
- Inline editing of cell values in the tree (future feature).
- Multi-query `.adx` files — only the first statement is executed (existing behavior).
- Custom icons per column type in tree items (future enhancement).
