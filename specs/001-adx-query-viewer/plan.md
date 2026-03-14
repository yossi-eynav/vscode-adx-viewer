# Implementation Plan: ADX Query Viewer

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-adx-query-viewer/spec.md`

## Summary

Build a VS Code extension that (1) provides a "Configure ADX Connection" command to
collect and store Azure Data Explorer service-principal credentials in
`~/.config/adx-viewer/credentials.json`, and (2) automatically executes the KQL query
in any `.adx` file when it is opened, showing results in a WebviewPanel with a data
table and Chart.js chart. Uses `azure-kusto-data@7` + `@azure/identity@4` for queries
and Chart.js (bundled) for visualization.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (`"strict": true`). Node.js 18+
(VS Code extension host runtime).

**Primary Dependencies**:
- `azure-kusto-data@7` — ADX/Kusto query client
- `@azure/identity@4` — `ClientSecretCredential` for service principal auth
- `chart.js` (bundled static asset in `media/`) — chart rendering in Webview
- `@types/vscode` — VS Code extension type definitions
- `webpack` — bundler for extension output

**Storage**: `~/.config/adx-viewer/credentials.json` (plain JSON, `chmod 0o600`)

**Testing**:
- VS Code Extension Test Runner (Mocha-based) for integration tests
- Jest (or Vitest) for unit tests that run outside the VS Code host

**Target Platform**: VS Code desktop 1.74+ on Windows, macOS, Linux

**Project Type**: VS Code extension

**Performance Goals**: Query results rendered within 5 seconds for queries returning
up to 1,000 rows, assuming normal ADX cluster response times (SC-002).

**Constraints**:
- Result rows capped at 1,000 with visible truncation notice (FR-010)
- Webview CSP: `default-src 'none'`, per-load nonce for scripts, no `'unsafe-eval'`
- Client secret stored as plain text (v1 trade-off; see research.md Decision 4)

**Scale/Scope**: Single-user, single ADX cluster connection per credentials file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design — all gates pass.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extension-First | ✅ PASS | Command palette command for credentials; `WebviewPanel` for results — both VS Code native APIs. Webview is the only available VS Code mechanism for chart rendering (justified below). |
| II. Simplicity (YAGNI) | ✅ PASS | Two focused user stories, minimal dependencies. Webview complexity is justified (see Complexity Tracking). Each component has one purpose. |
| III. Data Accuracy | ✅ PASS | Raw KQL results rendered directly from `primaryResults[0]`; 1,000-row cap is explicitly disclosed to the user (not silently truncated). |
| IV. Test Coverage | ✅ PASS | Unit tests for `credentialService`, `queryService`, result transformer; integration tests for command registration and WebviewPanel lifecycle; contract test for ADX `client.execute()`. |
| V. Incremental Delivery | ✅ PASS | US1 (credentials command) is fully deployable without US2 (viewer). Each merged story leaves the extension in a publishable state. |

## Project Structure

### Documentation (this feature)

```text
specs/001-adx-query-viewer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── commands.md
│   ├── webview-messages.md
│   └── credentials-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # Extension entry point: activate() / deactivate()
├── commands/
│   └── configureCredentials.ts   # "Configure ADX Connection" command handler
├── providers/
│   └── adxDocumentProvider.ts    # onDidOpenTextDocument handler for .adx files
├── services/
│   ├── credentialService.ts      # Read/write ~/.config/adx-viewer/credentials.json
│   └── queryService.ts           # Execute KQL via azure-kusto-data
├── webview/
│   ├── panelManager.ts           # Create/update/dispose WebviewPanel instances
│   └── resultsHtml.ts            # Generate HTML string for the results panel
└── types/
    └── messages.ts               # Shared message type definitions (host ↔ webview)

media/
└── chart.min.js                  # Bundled Chart.js (copied from node_modules at build)

tests/
├── unit/
│   ├── credentialService.test.ts
│   ├── queryService.test.ts
│   └── resultTransformer.test.ts
└── integration/
    ├── configureCredentials.test.ts
    └── adxDocumentProvider.test.ts

package.json                      # Extension manifest (contributes, activationEvents)
tsconfig.json                     # strict: true
webpack.config.js
.nvmrc                            # Node LTS version pin
```

**Structure Decision**: Single-project VS Code extension (Option 1). Source organized
by responsibility layer (commands, providers, services, webview) following VS Code
extension conventions. No backend/frontend split needed — the Webview HTML is
server-side-rendered as a string by `resultsHtml.ts` and delivered via
`panel.webview.html`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| `WebviewPanel` (custom UI) vs native VS Code UI | Chart rendering requires HTML Canvas. VS Code has no native chart component. | Tree views and quick picks cannot render charts. Status bar items are too small. There is no simpler VS Code-native alternative. |
