# Quickstart: ADX Query Viewer (Developer Guide)

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14

This guide covers setting up the development environment, running the extension
locally, and validating the two user stories manually.

---

## Prerequisites

- Node.js LTS (see `.nvmrc` for the pinned version): `nvm use`
- VS Code 1.74+
- An Azure Data Explorer cluster with a service principal that has at least
  **Viewer** permissions on the target database.

---

## Setup

```bash
# Install dependencies
npm install

# Build (compile TypeScript + bundle with Webpack)
npm run build

# Or watch mode for development
npm run watch
```

---

## Run the Extension (Development)

1. Open the project folder in VS Code.
2. Press `F5` (or **Run → Start Debugging**) to launch the **Extension Development Host**.
3. A new VS Code window opens with the extension loaded.

---

## Validate User Story 1: Configure ADX Credentials

1. In the Extension Development Host window, open the command palette (`Cmd+Shift+P`
   / `Ctrl+Shift+P`).
2. Type `ADX: Configure Connection` and select it.
3. Complete the 4-step input:
   - Cluster URL: `https://<your-cluster>.<region>.kusto.windows.net`
   - Tenant ID: `<your-tenant-id>`
   - Client ID: `<your-client-id>`
   - Client Secret: `<your-client-secret>`
4. Confirm a success notification appears: `"ADX connection configured successfully."`
5. Verify the credentials file was created:

```bash
cat ~/.config/adx-viewer/credentials.json
ls -la ~/.config/adx-viewer/credentials.json   # should show -rw------- (0600)
```

**Test re-run**: Run the command again. Existing values should appear pre-filled.
Update one field and verify the file is updated.

---

## Validate User Story 2: View .adx File Query Results

1. Create a test file `test.adx` with a valid KQL query, e.g.:

```kql
StormEvents
| take 50
```

2. Open `test.adx` in the Extension Development Host window.
3. Verify:
   - A results panel opens (WebviewPanel tab) alongside the editor.
   - A loading indicator appears briefly.
   - The panel renders a data table showing columns and up to 50 rows.
   - A chart is rendered below the table.

**Test truncation**: Try a query returning more than 1,000 rows:

```kql
StormEvents
| take 2000
```

Verify the panel shows `"Showing first 1,000 rows of 2000 total"`.

**Test error handling**:
- Open a `.adx` file with an invalid query (e.g., `THIS IS NOT KQL`).
  Verify a readable error message appears — no stack trace.
- Open a `.adx` file with empty content.
  Verify: `"Query is empty. Add a KQL query to this file."`

**Test missing credentials**:
- Delete `~/.config/adx-viewer/credentials.json`.
- Open a `.adx` file.
- Verify a notification prompts to run `ADX: Configure Connection`.

---

## Run Tests

```bash
# Unit tests (Jest — no VS Code host required)
npm run test:unit

# Integration tests (VS Code Extension Test Runner)
npm run test:integration
```

All tests must pass before submitting a PR.

---

## Build for Distribution

```bash
npm run package
# Produces a .vsix file in the project root
```

Install locally to verify the packaged extension:

```bash
code --install-extension adx-vscode-viewer-*.vsix
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point: `activate()` registers command + document listener |
| `src/commands/configureCredentials.ts` | 4-step credential input flow |
| `src/services/credentialService.ts` | Read/write `~/.config/adx-viewer/credentials.json` |
| `src/services/queryService.ts` | Execute KQL via `azure-kusto-data` |
| `src/providers/adxDocumentProvider.ts` | `onDidOpenTextDocument` handler for `.adx` files |
| `src/webview/panelManager.ts` | WebviewPanel lifecycle management |
| `src/webview/resultsHtml.ts` | Generates HTML string with nonce + CSP |
| `src/types/messages.ts` | Shared message type interfaces (host ↔ webview) |
| `media/chart.min.js` | Bundled Chart.js static asset |
| `specs/001-adx-query-viewer/contracts/` | Interface contracts (commands, messages, schema) |
