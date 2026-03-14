# Research: Credential Validation, Live Reload & Query Error Enrichment

**Feature Branch**: `002-cred-validate-live-reload`
**Date**: 2026-03-14

---

## Decision 1: Live connection test mechanism (US1)

**Decision**: Use `client.execute(database, 'print "ok"')` with a local 10-second
`Promise.race` timeout rather than reusing the existing `executeWithTimeout` helper.

**Rationale**: `executeWithTimeout` throws a `QueryError` on timeout, but
`testConnection` must return a typed `ValidationResult` rather than throw.
Using a local timeout sentinel (`TimeoutError`) keeps the categorisation logic
self-contained and avoids coupling the new code to the existing error type.

**Alternatives considered**: `client.executeMgmt('', '.show databases')` —
valid but introduces an `ExecutionType.Mgmt` call path not covered by existing
mocks; `print "ok"` is a lighter, database-agnostic query that exercises the
same auth + network path.

---

## Decision 2: Error categorisation heuristics (US1)

**Decision**: Classify `testConnection` failures into three categories
(`'auth'`, `'unreachable'`, `'timeout'`) by inspecting the lowercased error
message for well-known substrings: `'aadsts'`, `'authentication'`,
`'unauthorized'`, `'401'`, `'403'`, `'forbidden'` → auth;
`'econnrefused'`, `'enotfound'` → unreachable; `TimeoutError` sentinel →
timeout. Everything else falls through to `'unreachable'`.

**Rationale**: The Kusto SDK does not expose structured HTTP status codes in its
own error types except for 429 (`ThrottlingError`). Auth errors surface via
`KustoAuthenticationError` (wraps `@azure/identity` token errors whose messages
contain AADSTS codes) or as raw axios errors with status 401/403. Network errors
surface as Node.js `ECONNREFUSED`/`ENOTFOUND` strings. String inspection is the
only reliable cross-version approach.

**Alternatives considered**: Importing `axios.isAxiosError` to check
`error.response.status` directly — possible but couples the extension to
`axios` as a direct dependency; heuristic approach avoids this and covers
non-HTTP error types too.

---

## Decision 3: Query error enrichment — HTTP status code + response body (user input)

**Decision**: Extend `QueryError` with optional `statusCode?: number` and
`responseBody?: string`. In `executeQuery`, detect axios-style errors via
duck-type check (`'response' in err`), extract `err.response.status` and
stringify + truncate `err.response.data` to 500 characters. Pass both fields
through the `renderError` webview message so the results panel can display
them.

**Rationale**: `axios` is present as an indirect dependency
(`node_modules/axios`) but not listed in `package.json`. Rather than adding a
direct dependency solely for `axios.isAxiosError`, a minimal duck-type guard
(`typeof err === 'object' && err !== null && 'response' in err`) achieves the
same narrowing safely. The Kusto SDK sets `validateStatus: status => status === 200`,
so any non-200 response triggers an axios error with `error.response.status`
(number) and `error.response.data` (parsed JSON object or string).

**Truncation**: Response body is stringified with `JSON.stringify` (fallback to
`String()`) and sliced to 500 characters followed by `…`. This fits comfortably
in the panel without scrolling and avoids overwhelming users with multi-kilobyte
Kusto error envelopes.

**Alternatives considered**: Importing `AxiosError` type and `isAxiosError`
guard from `'axios'` — cleaner TypeScript but adds a direct dependency.
Re-throwing with a structured `KustoHttpError` subclass — more complete but
over-engineers a display-only concern.

---

## Decision 4: Webview rendering of error details

**Decision**: Extend the `showError(message)` JavaScript function in
`resultsHtml.ts` to accept `statusCode` and `responseBody` parameters.
When present, render them in a `<details>`/`<summary>` collapsible block
below the main error message using only `textContent` (never `innerHTML`)
to prevent XSS.

**Rationale**: The `<details>` element is supported in all VS Code webview
environments (Chromium-based). Showing the response body in a collapsible
block keeps the panel clean for common errors while making full details
accessible for debugging. Using `textContent` exclusively is mandatory
since response bodies from ADX may contain arbitrary text.

**Alternatives considered**: Always-expanded `<pre>` block — clutters the view
for simple errors. Inline after the message — mixes the human-readable message
with raw debug data, reducing readability.

---

## Decision 5: Debounce implementation for live reload (US2)

**Decision**: Use `Map<string, ReturnType<typeof setTimeout>>` per-document
debounce timers inside `registerAdxDocumentProvider`, inline. Timer is cleared
and restarted on each save event; after 500 ms without further saves the query
executes.

**Rationale**: VS Code's `onDidSaveTextDocument` fires once per explicit save
(Ctrl+S / Cmd+S), not on keystrokes. The 500 ms window is specified in
FR-010 and SC-004. A per-document map handles multiple simultaneously open
`.adx` files without cross-contamination. No external debounce library is
needed.

**Alternatives considered**: RxJS `debounceTime` — adds a runtime dependency;
single shared timer — races when multiple files are open.
