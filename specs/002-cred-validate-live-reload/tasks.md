# Tasks: Credential Validation, Live Reload & Query Error Enrichment

**Feature Branch**: `002-cred-validate-live-reload`
**Input**: Design documents from `/specs/002-cred-validate-live-reload/`
**Available docs**: spec.md, plan.md, data-model.md, contracts/render-error-message.md, research.md, quickstart.md

**Tech stack**: TypeScript 5.x strict, VS Code Extension API 1.74+, `azure-kusto-data` v7 (axios), `@azure/identity` v4, Jest 29, Webpack

**Tests**: Not requested in spec — no test tasks included.

**Organization**: Tasks grouped by user story. US1 (Credential Validation) and US2 (Live Reload) are complete. US3 (Query Error Enrichment) adds HTTP diagnostic details to the results panel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Verify clean baseline before adding feature code

- [X] T001 Run `npm test && npm run lint` from the repo root and confirm all checks pass before beginning feature work

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No new shared infrastructure required — existing services and webview infrastructure are sufficient for all three user stories.

> No tasks — all three user stories start directly from Phase 1 completion.

**Checkpoint**: Foundation ready — user story implementation may begin.

---

## Phase 3: User Story 1 — Validate Credentials on Save (Priority: P1) ✅ COMPLETE

**Goal**: After the user submits all four credential fields, perform a live test connection before saving. On success save and notify. On failure show a categorised error (auth / unreachable / timeout) and offer Retry or Cancel without persisting credentials.

**Independent Test**: Run `ADX: Configure Connection`, complete all four steps with valid credentials → success notification appears and credentials are saved. Repeat with an incorrect client secret → error notification appears and no credentials are saved.

### Implementation for User Story 1

- [X] T002 [US1] Add `ValidationResult` discriminated union type and `testConnection()` function to `src/services/queryService.ts` — type: `{ ok: true } | { ok: false; category: 'auth' | 'unreachable' | 'timeout'; message: string }`; function runs `print "ok"` with a 10-second timeout and maps errors to categories
- [X] T003 [US1] Refactor `src/commands/configureCredentials.ts` — extract four-step form into `collectCredentials(prefill?: Partial<ADXCredentials>)` helper; add `vscode.window.withProgress()` wrapping `testConnection()`; call `writeCredentials()` only on `result.ok === true`
- [X] T004 [US1] Add Retry/Cancel loop to `src/commands/configureCredentials.ts` — on `result.ok === false` show categorised error message and prompt "Retry" / "Cancel"; on Retry re-call `collectCredentials(failedCreds)` and re-validate; success message: `"ADX connection configured and verified successfully."`

**Checkpoint**: User Story 1 is fully functional and testable.

---

## Phase 4: User Story 2 — Live Reload Results on Query Change (Priority: P2) ✅ COMPLETE

**Goal**: When a `.adx` file that has an open results panel is saved, the results panel automatically re-executes the query and refreshes. Rapid saves are debounced (500 ms) to avoid flooding the ADX cluster.

**Independent Test**: Open a `.adx` file so the results panel appears; edit the query text; press Cmd+S → results panel shows loading then refreshes. Save five times in rapid succession → query executes exactly once.

### Implementation for User Story 2

- [X] T005 [US2] Add `reloadForDocument(credentials: ADXCredentials, document: vscode.TextDocument): void` method to `src/webview/panelManager.ts` — if panel exists in `this.panels`, post `renderLoading` then call `this.runQuery()`; return without action if no panel open (FR-012)
- [X] T006 [US2] Add debounced `onDidSaveTextDocument` listener inside `registerAdxDocumentProvider()` in `src/providers/adxDocumentProvider.ts` — `Map<string, ReturnType<typeof setTimeout>>` for per-document timers; 500 ms debounce; calls `panelManager.reloadForDocument()` only if credentials are available

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 — Query Error Enrichment (Priority: P3) ✅ COMPLETE

**Goal**: When a query execution fails with an HTTP error response, the results panel displays the HTTP status code and a collapsible truncated response body alongside the human-readable error message, enabling in-VS-Code debugging without needing external tools.

**Independent Test**: (1) Write a broken KQL query (e.g. `NoSuchTable | take 1`) → results panel shows the error message AND an HTTP status label (e.g. `HTTP 400`) AND a collapsible "Response details" section with the Kusto error JSON. (2) Disconnect network then save a valid `.adx` file → panel shows error message only, no HTTP badge and no details section.

### Implementation for User Story 3

- [X] T007 [P] [US3] Extend `QueryError` constructor in `src/services/queryService.ts` — add `readonly statusCode?: number` and `readonly responseBody?: string` properties; update constructor to `constructor(message: string, statusCode?: number, responseBody?: string)` and assign both fields (`this.statusCode = statusCode; this.responseBody = responseBody;`)
- [X] T008 [P] [US3] Extend `RenderErrorMessage` interface in `src/types/messages.ts` — add `statusCode?: number` and `responseBody?: string` as optional fields to the existing interface; both fields are optional for full backwards compatibility
- [X] T009 [US3] Add `extractHttpErrorDetails()` helper and update `executeQuery()` catch block in `src/services/queryService.ts` — helper duck-type checks `typeof err === 'object' && err !== null && 'response' in err`; if true reads `(err as {response?: {status?: number; data?: unknown}}).response?.status` (number) and `.data` (unknown); stringifies data with `JSON.stringify` fallback to `String()`, slices to 500 chars and appends `…` if truncated; updates `throw new QueryError(...)` calls that handle non-`QueryError` errors to pass `statusCode` and `responseBody` (depends on T007, same file — must run after T007)
- [X] T010 [P] [US3] Update `PanelManager.runQuery()` catch block in `src/webview/panelManager.ts` — when `err instanceof QueryError`, spread `statusCode: err.statusCode` and `responseBody: err.responseBody` into the `renderError` postMessage alongside `message`; for non-`QueryError` errors keep existing behaviour with no new fields (depends on T007, T008, T009)
- [X] T011 [P] [US3] Update `showError()` in `src/webview/resultsHtml.ts` — (1) update `case 'renderError': showError(msg.message, msg.statusCode, msg.responseBody)` call site; (2) update `showError(message, statusCode, responseBody)` signature; (3) always set `error-message` div via `textContent = message`; (4) if `statusCode` is defined, append ` · HTTP {statusCode}` label as a styled `<span>`; (5) if `responseBody` is defined, append `<details><summary>Response details</summary><pre></pre></details>` and set `pre.textContent = responseBody`; (6) add CSS `#error-message details pre { font-family: monospace; max-height: 200px; overflow-y: auto; padding: 8px; background: var(--vscode-editor-lineHighlightBackground); margin: 4px 0 0; }`; use only `textContent`, `createElement`, `appendChild` — never `innerHTML` (depends on T008, different file from T009/T010 — can run in parallel with T010 after T008 is done)

**Checkpoint**: User Story 3 fully functional — HTTP errors show status + details, network errors show message only, all existing tests still pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm no regressions after all three user stories

- [X] T012 [P] Verify error message strings match spec acceptance scenarios in `src/commands/configureCredentials.ts` and `src/services/queryService.ts`
- [X] T013 [P] Run `npm test && npm run lint` after US1/US2 — confirmed 78/78 tests pass, webpack compiles clean
- [X] T014 Run `npm test && npm run lint` from repo root after US3 implementation and fix any TypeScript or lint violations introduced by the error enrichment changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Skipped — no blocking shared infrastructure
- **US1 (Phase 3)**: Depends on Phase 1 — ✅ COMPLETE
- **US2 (Phase 4)**: Depends on Phase 1 — ✅ COMPLETE
- **US3 (Phase 5)**: Depends on Phase 1 only — independent of US1 and US2
- **Polish (Phase 6)**: T014 depends on Phase 5 completion

### User Story 3 Internal Dependencies

```
T007 (queryService.ts — extend QueryError)     ──┐
                                                  ├──▶ T009 (queryService.ts — update executeQuery) ──┐
T008 (messages.ts — extend RenderErrorMessage)    │                                                    ├──▶ T010 [P] (panelManager.ts)
                                                  │                                                    └──▶ T011 [P] (resultsHtml.ts)
                                                  └──▶ T011 [P] (resultsHtml.ts, depends only on T008)

All four (T010 + T011) → T014
```

### Parallel Opportunities

- **T007 + T008**: Different files — start simultaneously as soon as Phase 1 is complete
- **T010 + T011**: Different files — start simultaneously after T008 + T009 both complete

---

## Parallel Example: User Story 3

```
# Wave 1 — start together (different files, no unfinished deps)
Task T007: Extend QueryError in src/services/queryService.ts
Task T008: Extend RenderErrorMessage in src/types/messages.ts

# Wave 2 — after T007 completes (same file, must be sequential)
Task T009: Add extractHttpErrorDetails + update executeQuery catch in src/services/queryService.ts

# Wave 3 — after BOTH T008 and T009 complete (different files, run together)
Task T010: Update PanelManager.runQuery in src/webview/panelManager.ts
Task T011: Update showError() in src/webview/resultsHtml.ts

# Wave 4 — after T010 + T011
Task T014: Run npm test && npm run lint
```

---

## Implementation Strategy

### Current State

- T001–T006 (US1 + US2) fully implemented; T012–T013 (polish) verified
- **Remaining work**: T007 → T008 → T009 → {T010, T011} → T014

### US3 Delivery Steps

1. T007 + T008 in parallel — extend types (no behaviour change; safe to ship mid-cycle)
2. T009 — wire HTTP error extraction in `executeQuery` (now `QueryError` carries details)
3. T010 + T011 in parallel — pipe details to panel display
4. T014 — verify no regressions → ready to ship

---

## Notes

- [P] tasks = different files, no incomplete task dependencies — safe to parallelize
- T007 and T009 are in `queryService.ts` — must run sequentially (T007 first)
- T010 (`panelManager.ts`) and T011 (`resultsHtml.ts`) are different files — safe to run in parallel
- Duck-type guard for axios errors (no direct `axios` import needed): `typeof err === 'object' && err !== null && 'response' in err`
- Response body stringify + truncate: `JSON.stringify(data)` → fallback `String(data)` → `.slice(0, 500)` + `…` if over 500 chars
- XSS safety: **only** `element.textContent`, `document.createElement`, `appendChild` — **never** `element.innerHTML` for any error content
- `<details>`/`<summary>` supported in all VS Code webview environments (Chromium-based)
- When `statusCode` and `responseBody` are both `undefined`, `showError()` renders identically to the current behaviour (fully backwards compatible)
