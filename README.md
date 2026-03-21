# ADX Query Viewer

A VS Code extension for running KQL queries against Azure Data Explorer directly from `.kusto` files, with interactive results tables, time-series graphs, reusable filter variables, and syntax highlighting.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Features](#features)
  - [Syntax Highlighting](#syntax-highlighting)
  - [Multiple Connections](#multiple-connections)
  - [Running Queries](#running-queries)
  - [Results Table](#results-table)
  - [Graph View](#graph-view)
  - [Query Variables (Filters)](#query-variables-filters)
- [Query Parameters Example](#query-parameters-example)
- [Development](#development)

---

## Requirements

- VS Code 1.74+
- An Azure Data Explorer cluster
- A service principal with **Viewer** (or higher) permissions on the target database

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

Before running any query you must configure at least one connection.

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
ADX: Add / Edit Connection
```

You will be prompted for:

| Field | Example |
|---|---|
| Connection name | `prod` |
| Cluster URL | `https://mycluster.eastus.kusto.windows.net` |
| Tenant ID | Azure AD tenant ID |
| Client ID | Azure AD application (client) ID |
| Client Secret | Azure AD client secret |
| Default database | `MyDatabase` |

Credentials are stored at `~/.config/adx-viewer/credentials.json` with `0600` permissions (owner read/write only).

---

## Features

### Syntax Highlighting

`.kusto` files get full KQL syntax highlighting out of the box:

- Tabular operators — `where`, `summarize`, `project`, `join`, `extend`, `render`, …
- Aggregation functions — `count`, `sum`, `avg`, `dcount`, `make_list`, …
- Scalar functions — `ago`, `now`, `bin`, `format_datetime`, `parse_json`, …
- String operators — `has`, `contains`, `startswith`, `matches regex`, …
- Type names — `string`, `datetime`, `dynamic`, `bool`, `timespan`, …
- `let` / `declare` / `set` statements
- Comments (`//`), strings, numbers, timespans, booleans

Also included: bracket matching, auto-close pairs, and `//` comment toggling.

---

### Multiple Connections

You can configure multiple named connections (e.g. `prod`, `staging`, `dev`) and switch between them at any time.

| Command | Description |
|---|---|
| `ADX: Add / Edit Connection` | Create or update a connection |
| `ADX: Switch Connection` | Choose the active connection |

The active connection is shown in the status bar (bottom right). Click it to switch. Switching connections automatically re-runs all open query panels.

---

### Running Queries

Create a `.kusto` file with any KQL query:

```kusto
StormEvents
| summarize EventCount = count() by State
| order by EventCount desc
| take 20
```

**Open the results panel** using any of:

- The **run button** (▷) in the editor title bar
- Command Palette → `ADX: Open Query Results`

**Open the graph panel** using:

- The **graph button** in the editor title bar
- Command Palette → `ADX: Show Graph`

The results panel re-executes automatically every time you save the file.

---

### Results Table

The table view shows up to **5,000 rows** with:

- **Sorting** — click any column header to sort ascending/descending
- **Filtering** — real-time text search across all columns simultaneously
- **Group by** — aggregate rows by a column value, showing counts and a distribution bar chart; click any group to filter the table to that value
- **JSON expansion** — dynamic columns render as an interactive JSON tree
- **Info bar** — total row count, execution time, timestamp, and active filter badges
- **Chart** — auto-generated chart below the table (line chart for time-series data, bar chart otherwise)

---

### Graph View

The graph view visualizes event distribution over time. Requires at least one `datetime` column in the results.

**Controls:**

| Control | Description |
|---|---|
| Bucket size | `auto`, `5s`, `30s`, `1m`, `5m`, `30m`, `1h`, `6h`, `1d` |
| Group by | Split lines by a string or boolean column (top 8 groups shown) |

**Statistics cards** are shown above the chart:

- Total events
- Time range (start → end)
- Peak bucket count + timestamp
- Average events per bucket
- Total bucket count

---

### Query Variables (Filters)

Query variables let you define reusable filter parameters that can be changed without editing the `.kusto` file. Active filters are injected into the query as KQL `declare query_parameters` values at runtime.

#### Define a variable

Command Palette → `ADX: Define Query Variable`

You will be prompted for:

- **Variable name** — used as the KQL parameter name (suffix `_query` is appended automatically, e.g. `env` → `env_query`)
- **Column name** — the column the filter applies to
- **Source** — where the selectable values come from:
  - **Query** — a KQL query whose first column becomes the option list (fetched live from ADX)
  - **Values** — a static comma-separated list you provide

#### Set a filter value

Command Palette → `ADX: Configure Query Variable`

Or click the filter indicator in the status bar (bottom right). Select a variable, then pick a value from the list. Choose "Clear filter" to remove the filter.

Active filters are shown as colored badges in the results info bar.

---

## Query Parameters Example

Query variables are passed to ADX as typed query parameters using `declare query_parameters`. This lets you write parameterised queries where each parameter can be set to either a **hard-coded value** or the result of a **live KQL query** against your cluster.

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

### How to wire it up

1. **Define the variable** (`ADX: Define Query Variable`):
   - Variable name: `timeframe_start`  →  parameter name becomes `timeframe_start_query`
   - Source: **Values** → `1h,4h,12h,1d,7d`

2. **Define another variable** for `my_column`:
   - Source: **Query** → `MyTable | distinct myColumn | order by myColumn asc`
   - This fetches the current distinct values live from ADX each time you open the picker.

3. **Set a value** (`ADX: Configure Query Variable`) → pick `4h` for `timeframe_start`.

4. Save the `.kusto` file — the extension injects `timeframe_start_query = "4h"` at query time and re-runs.

### Parameter value sources

| Source type | Example | When to use |
|---|---|---|
| **Hard-coded values** | `1h,4h,12h,1d` | Fixed set of known options |
| **KQL query** | `MyTable \| distinct myColumn` | Dynamic list from real data |

The `declare query_parameters` block in your `.kusto` file defines the **defaults** (used when no filter is set). The extension overrides them at runtime with the values you pick in the UI.

---

## Development

```bash
npm install
npm run compile      # compile + bundle (webpack)
npm run watch        # watch mode
npm test             # unit + integration tests
npm run lint         # ESLint
```

Press `F5` in VS Code to launch the Extension Development Host.
