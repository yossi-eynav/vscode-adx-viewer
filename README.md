# ADX Query Viewer

A VS Code extension for running KQL queries against Azure Data Explorer directly from `.kusto` files — with interactive results tables, time-series graphs, reusable filter variables, and full syntax highlighting.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Credential Storage](#credential-storage)
- [Features](#features)
  - [Commands](#commands)
  - [Editor Title Bar Buttons](#editor-title-bar-buttons)
  - [Syntax Highlighting](#syntax-highlighting)
  - [Language Support](#language-support)
  - [Connection Management](#connection-management)
  - [Status Bar](#status-bar)
  - [Running Queries](#running-queries)
  - [Live Reload on Save](#live-reload-on-save)
  - [Results Table](#results-table)
  - [Graph View](#graph-view)
  - [Query Variables](#query-variables)
- [Query Parameters Example](#query-parameters-example)
- [Development](#development)

---

## Requirements

- VS Code 1.74+
- An Azure Data Explorer cluster
- One of the following for authentication:
  - A service principal with **Viewer** (or higher) permissions on the target database, **or**
  - An active [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/) login (`az login`) with access to the cluster

---

## Installation

1. Download the `.vsix` file from the releases page.
2. In VS Code: **Extensions → ⋯ → Install from VSIX…** and select the file.

Or via the CLI:

```bash
code --install-extension adx-vscode-viewer-*.vsix
```

---

## First-Time Setup

Before running any query you must configure at least one connection. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
ADX: Add / Edit Connection
```

After entering the cluster URL you will be asked to choose an authentication method:

**Option A — Azure CLI** (2 steps total):

| Step | Field | Example |
|---|---|---|
| 1 | Cluster URL | `https://mycluster.eastus.kusto.windows.net` |
| 2 | Default database | `MyDatabase` |

Requires an active `az login` session. No credentials are stored — the extension uses the Azure CLI token at query time.

**Option B — Client Secret / Service Principal** (5 steps total):

| Step | Field | Example |
|---|---|---|
| 1 | Cluster URL | `https://mycluster.eastus.kusto.windows.net` |
| 2 | Tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| 3 | Client ID | `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy` |
| 4 | Client Secret | *(masked input)* |
| 5 | Default database | `MyDatabase` |

The connection is validated against the live cluster before being saved. If validation fails you can retry or cancel. When editing an existing connection the secret field is pre-filled with `***` — leave it unchanged to keep the existing secret.

---

## Credential Storage

Credentials are saved to a plain JSON file on your local machine:

```
~/.config/adx-viewer/credentials.json
```

The file is written with **`0600` permissions** — readable and writable by the current OS user only, no group or world access.

File structure:

```json
{
  "activeConnection": "prod",
  "connections": {
    "prod": {
      "clusterUrl": "https://mycluster.eastus.kusto.windows.net",
      "authMethod": "clientSecret",
      "tenantId": "...",
      "clientId": "...",
      "clientSecret": "...",
      "defaultDatabase": "MyDatabase"
    },
    "staging": {
      "clusterUrl": "https://stagingcluster.eastus.kusto.windows.net",
      "authMethod": "azureCli",
      "defaultDatabase": "StagingDB"
    }
  }
}
```

`authMethod` is `"clientSecret"` or `"azureCli"`. Connections saved before this field was introduced default to `"clientSecret"`.

Query variable definitions and their selected values are stored separately in **VS Code global state** (not in this file).

---

## Features

### Commands

All commands are available via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

| Command | Description |
|---|---|
| `ADX: Add / Edit Connection` | Create a new ADX connection or edit an existing one |
| `ADX: Switch Connection` | Switch the active connection from among all configured connections |
| `ADX: Open Query Results` | Execute the current `.kusto` file and open the results table panel |
| `ADX: Show Graph` | Execute the current `.kusto` file and open the time-series graph panel |
| `ADX: Define Query Variable` | Create or update a named filter variable |
| `ADX: Configure Query Variable` | Set or clear the active value for a defined filter variable |

---

### Editor Title Bar Buttons

When a `.kusto` file is open and active in the editor, two buttons appear in the editor title bar:

| Button | Command | Description |
|---|---|---|
| ▷ (run icon) | `ADX: Open Query Results` | Open the results table panel |
| graph icon | `ADX: Show Graph` | Open the graph panel |

---

### Language Support

The extension registers **Kusto Query Language** as a VS Code language for the `.kusto` file extension.

- Language ID: `kusto`
- Aliases: `Kusto`, `Kusto Query Language`
- File extension: `.kusto`
- The extension activates automatically when any `.kusto` file is opened

---

### Syntax Highlighting

`.kusto` files receive full KQL syntax highlighting automatically when opened in VS Code, covering tabular operators, aggregation and scalar functions, string/logical operators, type names, literals, and comments. Also included: bracket matching, auto-close pairs, comment toggling, and smart pipe-aware indentation.

---

### Connection Management

Multiple named connections can be configured (e.g. `prod`, `staging`, `dev`).

| Command | Description |
|---|---|
| `ADX: Add / Edit Connection` | Create a new connection or edit an existing one |
| `ADX: Switch Connection` | Choose which connection is active |

**Add / Edit:** If connections already exist, a picker lets you select one to edit or choose "New connection…". After entering the cluster URL, choose an authentication method: **Azure CLI** (2 steps) or **Client Secret** (5 steps). The wizard pre-fills existing values when editing. A live connection test runs before saving — credentials are never saved if the test fails.

**Switch connection:** A quick-pick lists all connections with a checkmark on the active one and the cluster URL shown as a description. Picking a different connection immediately re-runs all open result panels against it.

---

### Status Bar

Two indicators are always visible in the bottom-right status bar.

**Connection indicator** (rightmost, priority 101):

| Display | Meaning |
|---|---|
| `⬡ prod` | Active connection name — click to open Switch Connection |
| `⬡ ADX: no connection` | No connection configured — click to open Add/Edit Connection |

**Filter indicator** (left of connection, priority 100):

| Display | Meaning |
|---|---|
| `⊘ ADX: no filters` | No variable filters active |
| `⊘ env: production` | One filter active — shown in warning colour |
| `⊘ 3 filters active` | Multiple filters active — shown in warning colour — hover to see all values |

Clicking the filter indicator opens the Configure Query Variable picker.

---

### Running Queries

Create a `.kusto` file with any valid KQL query:

```kusto
StormEvents
| summarize EventCount = count() by State
| order by EventCount desc
| take 20
```

**Table view** — open via:
- The **▷ run button** in the editor title bar (visible only for `.kusto` files)
- Command Palette → `ADX: Open Query Results`
- Automatically when opening a `.kusto` file if a connection is already configured

**Graph view** — open via:
- The **graph button** in the editor title bar (visible only for `.kusto` files)
- Command Palette → `ADX: Show Graph`

Both views open in a panel beside the editor, titled `ADX: filename.kusto` (table) or `ADX Graph: filename.kusto` (graph).

If no connection is configured when opening a panel, an error message appears with a "Configure Now" button.

---

### Live Reload on Save

The table view re-executes automatically whenever the `.kusto` file is saved. A 500 ms debounce prevents duplicate executions on rapid saves. The graph view does not auto-reload on save.

---

### Results Table

Displays up to **5,000 rows**. If the query returns more, the display is capped and a truncation notice is shown.

**Query limits:**

| Limit | Value |
|---|---|
| Rows displayed | 5,000 |
| Max records fetched from ADX | 1,000,000 |
| Max result size | 1 GB |
| Query timeout | 3 minutes |

**Info bar** (above the table):

- Total row count (formatted with thousands separators)
- Truncation notice when results exceed 5,000 rows — shows "showing first 5,000 of N"
- Query execution duration in ms or seconds
- Execution timestamp (hh:mm:ss)
- Active filter badges — each shows `name = "value"` in a coloured badge

**Toolbar:**

| Control | Behaviour |
|---|---|
| Filter rows… | Real-time text search across every column simultaneously; shows "X / Y rows" |
| Group by | Picks a column; shows distinct values with counts and a percentage distribution bar; click any group to filter the table to that value; clear to return to full results |

**Table columns:**

- Click any column header to sort ascending / descending; clicking again reverses order
- `datetime` columns are sorted numerically (not lexicographically)
- Each column header shows the ADX data type (`datetime`, `string`, `dynamic`, etc.)
- `dynamic` columns show a `{ … }` button — click to open a full interactive JSON tree with copy-to-clipboard support, collapsed to depth 2 by default
- `null` values are displayed as `(null)`

**Chart** (below the table):

An auto-generated chart is shown when results contain numeric columns:
- **Line chart** — when results contain both a `datetime` column and at least one `numeric` column
- **Bar chart** — all other cases with numeric columns

The first non-numeric column is used as labels; all numeric columns become datasets.

**Errors:**

| Condition | Message |
|---|---|
| 401 / 403 / auth keywords in error | "Authentication failed. Check your Client ID and Client Secret." |
| Query times out (3 min) | "Query timed out after 3 minutes. Check the cluster URL and your network." |
| Cluster unreachable | "Cannot reach cluster. Check the Cluster URL and your network." |
| Empty `.kusto` file | "Query is empty. Add a KQL query to this file." |
| Other errors | Raw error message + HTTP status code (if available) + expandable response body (truncated at 500 chars) |

---

### Graph View

Visualises event distribution over time. Requires the query results to contain at least one `datetime` column.

**Bucket size:**

| Option | Description |
|---|---|
| `auto` | Automatically selected based on the time range of the data |
| `5s` `30s` `1m` `5m` `30m` `1h` `6h` `1d` | Fixed bucket intervals |

Auto mode picks the most appropriate interval — e.g. `5s` for a range under 5 minutes, `1d` for a range over 14 days.

**Group by:**

Select any `string` or `bool` column to split the chart into separate lines — one per distinct value. Up to 8 groups are shown (top by total event count). A legend is displayed when multiple groups are active.

**Statistics cards** (above the chart):

| Card | Value |
|---|---|
| Total events | Sum of all events across all buckets |
| Time range | Start → end time of the data (hh:mm) |
| Peak | Highest event count in a single bucket + that bucket's timestamp |
| Avg / bucket | Average events per time bucket |
| Buckets | Total number of time buckets |

Point markers are hidden automatically when more than 80 data points are present.

---

### Query Variables

Query variables let you define named filter parameters that can be changed interactively from the status bar — without editing the `.kusto` file. The active value is injected into the query at runtime as a KQL query parameter.

There are **two commands** and they must be used in order:

1. **`ADX: Define Query Variable`** — creates the variable (name + source of options). You must do this first.
2. **`ADX: Configure Query Variable`** — sets the active value for an already-defined variable. This command does nothing until at least one variable has been defined.

---

#### Step 1 — Define a variable

Command Palette → `ADX: Define Query Variable`

**Name prompt:** Enter a variable name using only letters, digits, and underscores (e.g. `environment`).
This name is used as the KQL parameter name with `_query` appended automatically:

| Variable name | KQL parameter injected |
|---|---|
| `environment` | `environment_query` |
| `timeframe_start` | `timeframe_start_query` |
| `my_column` | `my_column_query` |

**Source prompt:** Choose how the list of selectable values is populated:

| Source | When to use | Example |
|---|---|---|
| **Run a KQL query** | Options come from real data in your cluster and may change over time | `MyTable \| distinct environment \| order by environment asc` |
| **Use fixed values** | Options are a known, static set | `production,staging,dev` |

The variable definition is saved in VS Code global state and persists across sessions. You can re-run `ADX: Define Query Variable` at any time to update an existing variable's name or source.

---

#### Step 2 — Set a value

Command Palette → `ADX: Configure Query Variable`, or click the filter indicator in the status bar.

1. A list of all defined variables is shown — the current value (if any) is shown next to each name
2. Select the variable you want to set
3. Pick a value from the options list — for query-sourced variables the list is fetched live from ADX at this moment
4. Or pick **"Clear filter"** to remove the active value for that variable

As soon as a value is selected, all open result panels re-execute with the new parameter injected.

---

#### Step 3 — Use the variable in your query

In your `.kusto` file, declare the parameter using `declare query_parameters` and reference it in the query body. The parameter name must match the variable name with `_query` appended.

```kusto
declare query_parameters(
    environment_query: string = ""
);
MyTable
| where isempty(environment_query) or environment == environment_query
```

The `declare query_parameters` block defines the **default value** — used when no filter is set in the UI. The extension overrides it at runtime with the value you selected.

The pattern `isempty(param) or column == param` is the recommended way to make a filter optional: when the parameter is empty (no filter set), all rows are returned; when a value is set, only matching rows are returned.

---

#### Variable status in the status bar

After setting a value, the filter indicator in the status bar updates:

| Display | Meaning |
|---|---|
| `⊘ ADX: no filters` | No variables have an active value |
| `⊘ environment: production` | One variable is active |
| `⊘ 2 filters active` | Multiple variables are active — hover to see all values |

Click the indicator at any time to open `ADX: Configure Query Variable` and change or clear values.

---

## Query Parameters Example

Query variables are passed to ADX at execution time using `ClientRequestProperties.setParameter()`. This maps directly to KQL's `declare query_parameters` statement.

### Example query

```kusto
declare query_parameters(
    timeframe_start_query: string = "4h",
    timeframe_end_query:   string = "0",
    my_column_query:       string = ""
);
exceptions
| where timestamp > ago(totimespan(timeframe_start_query))
    and timestamp < ago(totimespan(timeframe_end_query))
| where isempty(my_column_query) or myColumn == my_column_query
```

The `declare query_parameters` block sets the **default values** that are used when no filter is active. The extension overrides them at runtime with whatever value you select in the UI.

### Wiring it up

**1. Define `timeframe_start`** (`ADX: Define Query Variable`):
- Name: `timeframe_start` → injects as `timeframe_start_query`
- Source: **Fixed values** → `1h,4h,12h,1d,7d`

**2. Define `timeframe_end`** (`ADX: Define Query Variable`):
- Name: `timeframe_end` → injects as `timeframe_end_query`
- Source: **Fixed values** → `0,1h,6h,1d`

**3. Define `my_column`** (`ADX: Define Query Variable`):
- Name: `my_column` → injects as `my_column_query`
- Source: **KQL query** → `exceptions | distinct myColumn | order by myColumn asc`
- The options list is fetched live from ADX each time you open the picker

**4. Set values** (`ADX: Configure Query Variable`): pick `4h` for `timeframe_start`, `0` for `timeframe_end`, and leave `my_column` unset to return all values.

**5. Save the `.kusto` file** — the extension injects `timeframe_start_query = "4h"` and `timeframe_end_query = "0"` and re-runs the query.

### When to use each source type

| Source | When to use |
|---|---|
| **Fixed values** | The options are known in advance and don't change with the data (e.g. time ranges, environment names) |
| **KQL query** | The options come from real data in your cluster and change over time (e.g. distinct values of a column) |

---

## Development

```bash
npm install
npm run compile        # compile + bundle via webpack
npm run watch          # watch mode
npm test               # unit tests (Jest) + integration tests
npm run lint           # ESLint
```

Press `F5` in VS Code to launch the Extension Development Host.
