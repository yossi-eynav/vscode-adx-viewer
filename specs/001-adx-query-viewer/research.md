# Research: ADX Query Viewer

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14
**Phase**: 0 — Resolve all NEEDS CLARIFICATION from Technical Context

---

## Decision 1: ADX Node.js Client Library

**Decision**: Use `azure-kusto-data@7` + `@azure/identity@4` with `ClientSecretCredential`.

**Rationale**: `azure-kusto-data` is the official Microsoft Kusto/ADX client for Node.js.
The `withTokenCredential` approach from `@azure/identity` is the recommended modern
pattern because it provides better token caching, aligns with the broader Azure SDK
credential chain, and is more maintainable than the built-in
`withAadApplicationKeyAuthentication` legacy method.

**Alternatives considered**:
- `withAadApplicationKeyAuthentication` (built-in to `azure-kusto-data`): Works but is
  a legacy pattern; does not benefit from `@azure/identity` token caching improvements.
- Azure REST API directly: Too low-level; requires manual auth token management and
  Kusto protocol handling. Not appropriate.

**Key facts**:
- `azure-kusto-data` v7 requires Node.js 18+, which is compatible with VS Code's
  extension host runtime.
- Results are in `results.primaryResults[0]` — an array of row objects with `.toJSON()`
  and named column accessors.
- Database name is required at query execution time; it is NOT embedded in the KQL
  query string for the `client.execute()` call.
- `azure-kusto-ingest` is NOT needed (read-only queries only).

---

## Decision 2: Webview API Choice

**Decision**: Use `vscode.window.createWebviewPanel()` (WebviewPanel), not
`WebviewView`.

**Rationale**: `WebviewPanel` renders in the editor area as a tab, giving full width
for a table + chart layout. `WebviewView` is for persistent sidebar/bottom-panel
widgets — appropriate for supplementary views, not for a primary data display. The
spec calls for results shown "alongside" the editor, which maps to a dedicated editor
column tab.

**Key configuration**:
```
{
  enableScripts: true,
  localResourceRoots: [extensionUri/media],
  retainContextWhenHidden: false   // set true only if re-render is too slow
}
```

---

## Decision 3: Charting Library

**Decision**: Bundle **Chart.js** (minified, ~63 KB gzipped) in the extension's
`media/` directory and load it via `panel.webview.asWebviewUri()`.

**Rationale**:
- Fully CSP-safe: pure Canvas rendering, no `eval`, no dynamic code generation.
- Smallest reliable bundle of the evaluated options.
- Supports all needed chart types: line (time series), bar (categorical), scatter.
  Auto-detecting the chart type from result column types covers the v1 requirement.
- Works out of the box with `enableScripts: true` in a sandboxed Webview.

**Alternatives considered**:
- **Apache ECharts**: Good second choice; requires tree-shaking to stay under ~200 KB.
  More feature-rich but heavier setup. Chart.js is simpler for v1.
- **Vega-Lite**: Uses `Function()` constructor by default — violates CSP
  `script-src` without `'unsafe-eval'`. A CSP-compliant interpreter mode exists but
  adds ~30% runtime overhead and setup complexity. Rejected.

**Auto chart-type selection logic** (to be implemented in Webview JS):
- If result has a datetime/date column + numeric column → line chart.
- Otherwise → bar chart (default).
- Scatter: deferred to v2.

---

## Decision 4: Credential Storage Path

**Decision**: Store credentials at `~/.config/adx-viewer/credentials.json` (XDG
Base Directory convention). Apply `chmod 0o600` immediately after write.

**Rationale**: XDG `~/.config/<app>/` is the modern standard followed by GitHub CLI,
kubectl, Terraform, and others. It is cleaner than dotfiles directly in `$HOME`.
File permissions `0o600` (owner read/write only) mitigate risks from other local
processes on the same account.

**Security note**: The client secret is stored as plain text on disk. This is a
deliberate v1 trade-off. The spec requires home directory file storage. A follow-up
improvement (v2) should store the `clientSecret` field in VS Code's `SecretStorage`
API (OS keychain-backed) while keeping non-sensitive fields in the config file.

**Non-sensitive fields** (cluster URL, tenant ID, client ID) could alternatively live
in `vscode.workspace.getConfiguration()`, but keeping all fields together in one file
simplifies the credential command flow and enables cross-tool use (e.g., reading from
a custom CLI).

---

## Decision 5: Multi-Step Credential Input

**Decision**: Use VS Code's `InputBox` API in a sequential multi-step pattern
(adapted from the official `vscode-extension-samples/quickinput-sample`
`MultiStepInput` helper).

**Rationale**: The official Microsoft multi-step input sample provides a `MultiStepInput`
helper class that handles Back navigation, cancellation, and step-function chaining.
It is widely copied into production extensions (including `vscode-python`). Collecting
4 fields (cluster URL, tenant ID, client ID, client secret) is well within the
recommended 4-step limit for `InputBox`-based flows.

**UX requirements from research**:
- Show `step N / 4` in the input box title.
- Pre-populate fields with existing stored values on re-run.
- Mask the client secret field (`password: true`).
- Inline validation for cluster URL format.

---

## Decision 6: .adx File Activation

**Decision**: Register `.adx` as a VS Code language (`contributes.languages` in
`package.json`) with `"id": "adx"`. Use `onLanguage:adx` activation event for
backward compatibility (VS Code < 1.74). Listen to
`vscode.workspace.onDidOpenTextDocument` (and handle already-open documents at
activation time) to trigger query execution.

**Rationale**: Language registration is the standard VS Code pattern for associating
file types. `onDidOpenTextDocument` fires for every document opened, including .adx
files, giving the hook needed to auto-execute queries.

**No CustomEditorProvider needed**: The results are shown in a separate WebviewPanel,
not within the .adx file's editor tab itself. The .adx file remains a standard text
editor. A `CustomEditorProvider` would replace the text editor entirely, which is more
complex and not required.

---

## Decision 7: File Content Reading

**Decision**: Use `activeEditor.document.getText()` for the currently active editor.
Fall back to `vscode.workspace.openTextDocument(uri).then(doc => doc.getText())` for
documents opened programmatically.

**Rationale**: `document.getText()` respects unsaved buffer content (the user may have
edited the query without saving). Raw `fs.readFile` misses these edits and bypasses
the VS Code virtual filesystem (breaks in SSH/WSL/Codespaces).

---

## Resolved NEEDS CLARIFICATION

All technical unknowns are now resolved. No NEEDS CLARIFICATION markers remain.

| Unknown | Resolution |
|---------|------------|
| ADX client library | `azure-kusto-data@7` + `@azure/identity@4` |
| Auth approach | `ClientSecretCredential` via `withTokenCredential` |
| Webview type | `WebviewPanel` (editor tab) |
| Charting library | Chart.js (bundled, ~63 KB gzipped) |
| Credential path | `~/.config/adx-viewer/credentials.json` with `chmod 0o600` |
| Multi-step input | `MultiStepInput` helper pattern (VS Code samples) |
| .adx file activation | `contributes.languages` + `onLanguage:adx` + `onDidOpenTextDocument` |
| File reading | `activeEditor.document.getText()` |
