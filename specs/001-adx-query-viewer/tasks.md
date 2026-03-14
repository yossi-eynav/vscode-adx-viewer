---

description: "Task list for ADX Query Viewer"
---

# Tasks: ADX Query Viewer

**Input**: Design documents from `specs/001-adx-query-viewer/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included per constitution Principle IV (Test Coverage) — unit + integration
tests are constitutionally required for all business logic and VS Code API interactions.

**Organization**: Tasks grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths included in all descriptions

## Path Conventions

- Single VS Code extension project: `src/`, `tests/`, `media/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize VS Code extension project and directory structure.

- [ ] T001 Initialize VS Code extension project: create `package.json` with `name`, `displayName`, `version`, `engines.vscode`, `main`, `activationEvents`, `contributes` skeleton and `scripts` (compile, watch, test, package)
- [ ] T002 [P] Create `tsconfig.json` with `"strict": true`, `"target": "ES2020"`, `"module": "commonjs"`, `"outDir": "out"`, `"rootDir": "src"`
- [ ] T003 [P] Create `webpack.config.js` for bundling extension output; add `copy-webpack-plugin` to copy `node_modules/chart.js/dist/chart.min.js` to `media/chart.min.js` at build time
- [ ] T004 [P] Create `.nvmrc` pinning the current Node.js LTS version; create `.gitignore` (node_modules, out, *.vsix, media/chart.min.js)
- [ ] T005 Install npm dependencies: `azure-kusto-data@7`, `@azure/identity@4`, `@types/vscode`, `webpack`, `webpack-cli`, `ts-loader`, `copy-webpack-plugin`, `typescript` (devDependency), `jest`, `ts-jest`, `@vscode/test-electron`
- [ ] T006 Create directory structure: `src/commands/`, `src/providers/`, `src/services/`, `src/webview/`, `src/types/`, `tests/unit/`, `tests/integration/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions and test configuration required by both user
stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Create shared message type definitions in `src/types/messages.ts`: `RenderLoadingMessage`, `RenderResultsMessage`, `RenderEmptyMessage`, `RenderErrorMessage`, `ReadyMessage`, `HostToWebviewMessage` (union type), `WebviewToHostMessage` (union type); also define `ResultColumn` (`name`, `type` as `ColumnType` enum) and `ColumnType` enum (`datetime`, `numeric`, `string`, `bool`, `timespan`, `other`)
- [ ] T008 [P] Configure Jest for unit tests: add `jest.config.js` with `ts-jest` preset targeting `tests/unit/**/*.test.ts`; add `test:unit` script to `package.json`
- [ ] T009 [P] Configure VS Code Extension Test Runner: create `tests/integration/runTests.ts` entry point using `@vscode/test-electron`; add `test:integration` script to `package.json`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Configure ADX Credentials (Priority: P1) 🎯 MVP

**Goal**: User can run "ADX: Configure Connection" from the command palette, enter
credentials, and have them stored at `~/.config/adx-viewer/credentials.json`.

**Independent Test**: Run the command, supply valid inputs, verify
`~/.config/adx-viewer/credentials.json` is created with `chmod 0o600`. Run again
to verify pre-population of existing values. No `.adx` file required.

### Tests for User Story 1 ⚠️ Write FIRST — must FAIL before implementation

- [ ] T010 [P] [US1] Write unit tests for `credentialService` in `tests/unit/credentialService.test.ts`: test `readCredentials()` returns null when file absent; test `writeCredentials()` creates file at correct path with correct content; test `writeCredentials()` sets file permissions to `0o600`; test `validateCredentials()` rejects missing required fields and invalid cluster URL
- [ ] T011 [P] [US1] Write integration test for `configureCredentials` command in `tests/integration/configureCredentials.test.ts`: test command is registered and appears in command palette; test that running command creates credentials file; test that re-running pre-populates existing values

### Implementation for User Story 1

- [ ] T012 [US1] Implement `src/services/credentialService.ts`: `readCredentials(): Promise<ADXCredentials | null>` (reads `~/.config/adx-viewer/credentials.json`, returns null if absent or invalid); `writeCredentials(creds: ADXCredentials): Promise<void>` (creates `~/.config/adx-viewer/` dir with `mkdir -p`, writes JSON, applies `chmod 0o600`); `validateCredentials(creds: Partial<ADXCredentials>): string | null` (returns error message or null); define `ADXCredentials` interface with `clusterUrl`, `tenantId`, `clientId`, `clientSecret`, optional `defaultDatabase` (depends on T007)
- [ ] T013 [US1] Implement `src/commands/configureCredentials.ts`: export `registerConfigureCredentials(context)` that registers command `adxViewer.configureCredentials`; uses 4-step `InputBox` sequence (cluster URL, tenant ID, client ID, client secret with `password: true`) showing `step N / 4` in title; pre-populates from `credentialService.readCredentials()`; on completion calls `credentialService.writeCredentials()`; shows `vscode.window.showInformationMessage('ADX connection configured successfully.')` on success; inline URL validation on step 1 (must start with `https://`) (depends on T012)
- [ ] T014 [US1] Create extension entry point `src/extension.ts`: export `activate(context)` that calls `registerConfigureCredentials(context)` and adds the subscription; export `deactivate()`
- [ ] T015 [US1] Update `package.json` `contributes` section: add command `{ "command": "adxViewer.configureCredentials", "title": "ADX: Configure Connection" }` to `contributes.commands`; add language `{ "id": "adx", "aliases": ["ADX"], "extensions": [".adx"] }` to `contributes.languages`; add `"onLanguage:adx"` to `activationEvents` (depends on T001)

**Checkpoint**: User Story 1 fully functional. Run `npm run test:unit` and
`npm run test:integration`. Verify manual steps in `quickstart.md` US1 section.

---

## Phase 4: User Story 2 - View .adx File Query Results (Priority: P2)

**Goal**: Opening a `.adx` file triggers the extension to execute the KQL query and
show a WebviewPanel with a data table and Chart.js chart.

**Independent Test**: Open a `.adx` file with a valid KQL query after credentials
are configured. Verify the results panel opens with a table and chart. Verify error
states (empty file, missing credentials, bad query) each show correct messages.

### Tests for User Story 2 ⚠️ Write FIRST — must FAIL before implementation

- [ ] T016 [P] [US2] Write unit tests for `queryService` in `tests/unit/queryService.test.ts`: test `executeQuery()` returns `QueryResult` with correct columns and rows; test `executeQuery()` caps rows at 1,000 and sets `truncated: true` with correct `totalRowCount`; test `executeQuery()` throws typed error on auth failure; test `executeQuery()` throws typed error on empty query text; mock `azure-kusto-data` client
- [ ] T017 [P] [US2] Write unit tests for result transformer in `tests/unit/resultTransformer.test.ts`: test `mapColumnType()` maps ADX type strings to `ColumnType` enum correctly (datetime, int, string, etc.); test `selectChartType()` returns `'line'` for datetime+numeric columns and `'bar'` otherwise; test `rowsToChartData()` produces correct Chart.js dataset structure
- [ ] T018 [P] [US2] Write integration test for `adxDocumentProvider` in `tests/integration/adxDocumentProvider.test.ts`: test that opening a `.adx` file triggers provider and a WebviewPanel is created; test that missing credentials triggers notification message; test that provider disposes panel correctly on document close

### Implementation for User Story 2

- [ ] T019 [US2] Implement `src/services/queryService.ts`: export `executeQuery(credentials: ADXCredentials, queryText: string, database: string): Promise<QueryResult>`; uses `KustoConnectionStringBuilder.withTokenCredential` + `ClientSecretCredential`; fetches `primaryResults[0]` and maps to `QueryResult` (columns via `mapColumnType()`, rows as `ResultRow[]`, caps at 1,000, sets `truncated` and `totalRowCount`); throws `QueryError` with `message` string for auth/syntax/timeout failures; throws `EmptyQueryError` when `queryText.trim()` is empty (depends on T007)
- [ ] T020 [P] [US2] Implement `src/webview/resultsHtml.ts`: export `getResultsHtml(webview: vscode.Webview, extensionUri: vscode.Uri, nonce: string): string` that returns full HTML string with `<meta http-equiv="Content-Security-Policy">` (`default-src 'none'`, `script-src 'nonce-${nonce}'`, `style-src ${webview.cspSource} 'unsafe-inline'`); includes Chart.js script tag with nonce via `webview.asWebviewUri()`; includes a `<table id="results-table">` and `<canvas id="results-chart">`; includes inline JS (with nonce) that listens for `window.addEventListener('message', ...)` and renders table rows + Chart.js chart based on `renderResults` messages; handles `renderLoading`, `renderEmpty`, `renderError` states; implement `generateNonce(): string` helper (depends on T007)
- [ ] T021 [US2] Implement `src/webview/panelManager.ts`: export `PanelManager` class with `openOrReveal(extensionUri, document): void` that creates or reveals a `vscode.window.createWebviewPanel` for a given `.adx` document URI; waits for `ready` message from webview then sends `renderLoading`; calls `queryService.executeQuery()` and sends appropriate `renderResults` / `renderEmpty` / `renderError` message; disposes panel on document close; handles one panel per document URI (depends on T019, T020)
- [ ] T022 [US2] Implement `src/providers/adxDocumentProvider.ts`: export `registerAdxDocumentProvider(context, panelManager)` that registers `vscode.workspace.onDidOpenTextDocument` listener; on `.adx` file open: reads credentials via `credentialService.readCredentials()`; if null, shows `vscode.window.showErrorMessage('ADX credentials not configured.', 'Configure Now')` with action to run `adxViewer.configureCredentials`; if present, calls `panelManager.openOrReveal()`; also processes already-open `.adx` documents at activation time via `vscode.workspace.textDocuments` (depends on T021, T012)
- [ ] T023 [US2] Update `src/extension.ts` to instantiate `PanelManager` and call `registerAdxDocumentProvider(context, panelManager)` in `activate()`; push subscriptions to `context.subscriptions` (depends on T022, T014)

**Checkpoint**: User Story 2 fully functional. Run full test suite. Validate all
manual steps in `quickstart.md` US2 section including truncation and error states.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Quality hardening across both user stories.

- [ ] T024 [P] Add `README.md` to repository root with extension name, features overview, installation steps, and screenshot placeholders for the results panel
- [ ] T025 [P] Add timeout handling in `src/services/queryService.ts`: wrap `client.execute()` in a 30-second `Promise.race()` with `setTimeout`; catch timeout and throw `QueryError('Connection timed out. Check the cluster URL and your network.')`
- [ ] T026 Run full test suite (`npm run test:unit && npm run test:integration`); fix all failures; ensure zero TypeScript errors (`npx tsc --noEmit`)
- [ ] T027 [P] Build and package: run `npm run package` to produce `.vsix`; install locally with `code --install-extension` and execute manual quickstart validation end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002/T003/T004 can run in parallel with T001
- **Foundational (Phase 2)**: Depends on Phase 1 completion — blocks all user stories; T008/T009 can run in parallel
- **User Story 1 (Phase 3)**: Depends on Phase 2; T010/T011 can run in parallel (tests); T012 starts after T010; T013 after T012; T014 after T013; T015 any time after T001
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T007) and US1 `credentialService` (T012); T016/T017/T018 can run in parallel (tests + HTML); T019 after T016; T020 after T007; T021 after T019+T020; T022 after T021+T012; T023 after T022+T014
- **Polish (Phase 5)**: Depends on all user stories; T024/T025/T027 can run in parallel after T026

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependency on US2.
- **US2 (P2)**: Can start after Phase 2. Depends on `credentialService` (T012) from US1 — read credentials to decide whether to open a panel.

### Within Each User Story

- Constitution Principle IV: Tests MUST be written and confirmed failing before implementation
- `credentialService` before `configureCredentials` command
- Type definitions (T007) before any service implementation
- `resultsHtml` and `queryService` before `panelManager`
- `panelManager` before `adxDocumentProvider`
- `adxDocumentProvider` before extension wiring

### Parallel Opportunities

- Phase 1: T002, T003, T004 all parallel with T001
- Phase 2: T008 and T009 parallel with each other
- Phase 3: T010 and T011 parallel (both tests, different files)
- Phase 4: T016, T017, T018 all parallel (tests + HTML generator, all different files)
- Phase 5: T024, T025, T027 parallel (different files/concerns)

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel (write before implement):
Task: "tests/unit/credentialService.test.ts"         [T010]
Task: "tests/integration/configureCredentials.test.ts" [T011]

# Confirm both FAIL, then implement:
Task: "src/services/credentialService.ts"            [T012]
# → then:
Task: "src/commands/configureCredentials.ts"         [T013]
```

## Parallel Example: User Story 2

```bash
# Launch tests + HTML in parallel (write before implement):
Task: "tests/unit/queryService.test.ts"              [T016]
Task: "tests/unit/resultTransformer.test.ts"         [T017]
Task: "tests/integration/adxDocumentProvider.test.ts" [T018]
Task: "src/webview/resultsHtml.ts"                   [T020]

# Confirm tests FAIL, then implement services:
Task: "src/services/queryService.ts"                 [T019]
# → then:
Task: "src/webview/panelManager.ts"                  [T021]
# → then:
Task: "src/providers/adxDocumentProvider.ts"         [T022]
# → then:
Task: "src/extension.ts (US2 wiring)"               [T023]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T009)
3. Complete Phase 3: User Story 1 (T010–T015)
4. **STOP and VALIDATE**: Run `test:unit`, `test:integration`; follow quickstart.md US1 steps
5. Deploy/demo credentials command as standalone value

### Incremental Delivery

1. Phase 1 + Phase 2 → Project skeleton ready
2. Phase 3 → US1 complete → credentials command works → ship as v0.1.0
3. Phase 4 → US2 complete → `.adx` viewer works → ship as v0.2.0
4. Phase 5 → Polish → ship as v1.0.0

---

## Notes

- [P] tasks = different files, no blocking dependencies
- [US1]/[US2] labels map tasks to spec user stories for traceability
- Tests MUST fail before implementation (constitution Principle IV)
- Commit after each task or logical group
- Validate each story independently at its checkpoint before moving to the next
- `media/chart.min.js` is generated at build time by `copy-webpack-plugin` — do not commit it; add to `.gitignore`
