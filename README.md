# ADX Query Viewer

A VS Code extension that executes KQL queries in `.adx` files against Azure Data Explorer and displays results in an interactive panel.

## Features

- **Configure ADX Connection** — store service principal credentials via the command palette
- **Auto-execute `.adx` files** — opening any `.adx` file automatically runs the KQL query
- **Results panel** — displays a data table with up to 1,000 rows and a Chart.js chart
- **Error handling** — shows readable error messages for auth failures, empty queries, and timeouts

## Installation

1. Download the `.vsix` file from the releases page.
2. In VS Code: **Extensions → ⋯ → Install from VSIX…** and select the file.

Or install via the CLI:

```bash
code --install-extension adx-vscode-viewer-*.vsix
```

## Usage

### Configure credentials

Open the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
ADX: Configure Connection
```

Enter your Azure Data Explorer service principal credentials:
- **Cluster URL** — e.g. `https://mycluster.eastus.kusto.windows.net`
- **Tenant ID** — Azure AD tenant ID
- **Client ID** — Azure AD application (client) ID
- **Client Secret** — Azure AD client secret

Credentials are stored at `~/.config/adx-viewer/credentials.json` with `0600` permissions.

### Query results

Create a `.adx` file containing a KQL query:

```kql
StormEvents
| summarize EventCount = count() by State
| order by EventCount desc
| take 20
```

Open the file in VS Code. The extension automatically executes the query and opens a results panel alongside the editor showing:
- A scrollable data table
- A Chart.js chart (line chart for time-series data; bar chart otherwise)
- A truncation notice if results exceed 1,000 rows

### Screenshot

*[Results panel screenshot placeholder]*

## Requirements

- VS Code 1.74+
- An Azure Data Explorer cluster with a service principal that has **Viewer** permissions on the target database

## Development

```bash
npm install
npm run build   # compile + bundle
npm run test:unit          # Jest unit tests
npm run test:integration   # VS Code integration tests (requires display)
```

Press `F5` in VS Code to launch the Extension Development Host.
