# Data Model: ADX Query Viewer

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14

---

## Entity: ADXCredentials

Represents the authentication configuration required to connect to an Azure Data
Explorer cluster using service principal authentication.

**Persistence**: Stored as JSON at `~/.config/adx-viewer/credentials.json`.
File permissions MUST be set to `0o600` (owner read/write only) after every write.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `clusterUrl` | string | Yes | Must start with `https://`; non-empty |
| `tenantId` | string | Yes | Non-empty GUID or domain string |
| `clientId` | string | Yes | Non-empty GUID |
| `clientSecret` | string | Yes | Non-empty |
| `defaultDatabase` | string | No | Optional default database name for queries |

**State transitions**:
- `absent` → `configured`: User completes "Configure ADX Connection" command
- `configured` → `configured`: User re-runs command and updates one or more fields
- `configured` → `absent`: User manually deletes the credentials file (out of scope
  for v1; no delete command provided)

**Validation rules**:
- `clusterUrl` must begin with `https://` and be a valid URL.
- `tenantId`, `clientId` must be non-empty strings; GUID format is recommended but
  not strictly enforced at input time.
- `clientSecret` must be non-empty; shown as masked input (`password: true`).
- Empty submissions on any required field are rejected with an inline error message.

---

## Entity: KQLQuery

Represents the KQL query contained in a `.adx` file to be executed against ADX.

**Source**: Buffer content of the active `.adx` document (`document.getText()`).
Not persisted independently — the `.adx` file IS the query.

| Field | Type | Notes |
|-------|------|-------|
| `text` | string | Raw KQL query string from the file buffer |
| `sourceUri` | URI | VS Code URI of the `.adx` file |
| `database` | string | Resolved database: `ADXCredentials.defaultDatabase` if set, otherwise NEEDS TO BE SPECIFIED in file header comment or prompt (v1 assumption: from credentials) |

**Validation rules**:
- `text` must be non-empty after trimming whitespace. Empty body → display error
  "Query is empty. Add a KQL query to this file."
- `database` must be known before execution; if `defaultDatabase` is not set in
  credentials, the extension will use an empty string and rely on the query itself
  to include a `database()` expression, or show an error.

---

## Entity: QueryResult

Represents the tabular data returned from executing a KQLQuery. Drives both the table
and the chart views.

| Field | Type | Notes |
|-------|------|-------|
| `columns` | `ResultColumn[]` | Ordered list of column definitions |
| `rows` | `ResultRow[]` | Ordered list of data rows (max 1,000) |
| `totalRowCount` | number | Actual total from ADX (may exceed `rows.length`) |
| `truncated` | boolean | `true` if `totalRowCount > rows.length` |
| `executedAt` | Date | Timestamp when the query was executed |

**State transitions**:
- Created fresh on each query execution; not cached between file opens.

---

## Entity: ResultColumn

A single column in a QueryResult.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Column name from ADX schema |
| `type` | ColumnType | Semantic type for chart auto-detection |

### ColumnType enum

| Value | ADX types it covers | Chart hint |
|-------|--------------------|-----------|
| `datetime` | `datetime`, `date` | Candidate for X-axis (line chart) |
| `numeric` | `int`, `long`, `real`, `decimal` | Candidate for Y-axis |
| `string` | `string`, `guid`, `dynamic` | Categorical label |
| `bool` | `bool` | Rendered as string (`true`/`false`) in table |
| `timespan` | `timespan` | Rendered as string in table; excluded from auto chart |
| `other` | Any unmapped type | Rendered as string; excluded from auto chart |

---

## Entity: ResultRow

A single data row in a QueryResult.

| Field | Type | Notes |
|-------|------|-------|
| `values` | `(string \| number \| boolean \| null)[]` | One value per column, in column order |

---

## Entity: WebviewMessage

Messages exchanged between the extension host and the results WebviewPanel via
`postMessage`. Two directions: **host → webview** and **webview → host**.

### Host → Webview messages

| `command` | Payload fields | Purpose |
|-----------|---------------|---------|
| `"renderResults"` | `columns: ResultColumn[], rows: ResultRow[], truncated: boolean, totalRowCount: number` | Deliver query results for rendering |
| `"renderError"` | `message: string` | Display a human-readable error |
| `"renderEmpty"` | *(none)* | Display "No results returned" empty state |
| `"renderLoading"` | *(none)* | Display a loading indicator while query executes |

### Webview → Host messages

| `command` | Payload fields | Purpose |
|-----------|---------------|---------|
| `"ready"` | *(none)* | Webview signals it is initialized and ready to receive data |

---

## Relationships

```
ADXCredentials ──(used by)──► QueryService ──(executes)──► KQLQuery
                                    │
                                    ▼
                              QueryResult
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                  ResultColumn[]          ResultRow[]
                         │
                         ▼
                  WebviewMessage(renderResults)
                         │
                         ▼
                   WebviewPanel
                   (table + chart)
```
