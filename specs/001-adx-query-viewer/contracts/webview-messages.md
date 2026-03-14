# Contract: Webview Message Protocol

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14

All communication between the VS Code extension host and the results `WebviewPanel`
uses `postMessage`. Message shapes are defined as TypeScript interfaces in
`src/types/messages.ts` and consumed in both the extension host and the Webview HTML.

---

## Direction: Host → Webview

### renderLoading

Sent immediately when a `.adx` file is opened, before the query executes. Displays
a loading indicator in the panel.

```typescript
interface RenderLoadingMessage {
  command: 'renderLoading';
}
```

---

### renderResults

Sent when the query completes successfully with one or more rows.

```typescript
interface RenderResultsMessage {
  command: 'renderResults';
  columns: Array<{
    name: string;
    type: 'datetime' | 'numeric' | 'string' | 'bool' | 'timespan' | 'other';
  }>;
  rows: Array<Array<string | number | boolean | null>>;
  truncated: boolean;       // true if row count exceeded 1,000
  totalRowCount: number;    // actual total rows from ADX
}
```

**Constraint**: `rows.length` ≤ 1,000. If `truncated` is `true`, the Webview MUST
display: `"Showing first 1,000 rows of {totalRowCount} total"`.

---

### renderEmpty

Sent when the query returns zero rows.

```typescript
interface RenderEmptyMessage {
  command: 'renderEmpty';
}
```

The Webview displays: `"No results returned"`.

---

### renderError

Sent when the query fails (auth error, syntax error, timeout, cluster unreachable)
or when the `.adx` file has an empty body.

```typescript
interface RenderErrorMessage {
  command: 'renderError';
  message: string;   // Human-readable; no raw stack traces
}
```

Common error messages:
- `"Query is empty. Add a KQL query to this file."`
- `"ADX credentials not configured. Run 'ADX: Configure Connection' to set up."`
- `"Query failed: <sanitized ADX error message>"`
- `"Connection timed out. Check the cluster URL and your network."`

---

## Direction: Webview → Host

### ready

Sent once when the Webview's JavaScript has initialized and is ready to receive data.
The extension host MUST wait for this message before dispatching `renderLoading` or
`renderResults`.

```typescript
interface ReadyMessage {
  command: 'ready';
}
```

---

## Message Flow

```
.adx file opened
      │
      ▼
panelManager.openOrReveal()
      │
      ├─► creates WebviewPanel
      │         │
      │         └─► Webview loads HTML + JS
      │                   │
      │                   └─► postMessage({ command: 'ready' })
      │                               │
      ◄───────────────────────────────┘
      │
      ├─► postMessage({ command: 'renderLoading' })
      │
      ├─► queryService.execute(credentials, queryText)
      │         │
      │    [success]─────────────────────────────────────────────┐
      │         │                                                │
      │    [empty]──► postMessage({ command: 'renderEmpty' })    │
      │         │                                                ▼
      │    [error]──► postMessage({ command: 'renderError' })  postMessage({
      │                                                  command: 'renderResults',
      │                                                  columns, rows,
      │                                                  truncated, totalRowCount
      │                                                })
```
