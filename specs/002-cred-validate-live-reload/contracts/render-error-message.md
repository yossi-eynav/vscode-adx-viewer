# Contract: RenderErrorMessage (Webview Message)

**Interface type**: VS Code Webview postMessage (host → webview)
**Direction**: Extension host → Results panel webview
**Trigger**: Query execution fails in `PanelManager.runQuery()`

---

## Message Schema

```typescript
interface RenderErrorMessage {
  command: 'renderError';

  /**
   * Human-readable error description shown as the primary error text.
   * Always present. Never a raw stack trace.
   * Examples:
   *   - "Query is empty. Add a KQL query to this file."
   *   - "Query failed: Kusto request had errors. ..."
   *   - "Query failed: Connection timed out. Check the cluster URL and your network."
   */
  message: string;

  /**
   * HTTP status code of the failed request, if the error originated from
   * an HTTP response (e.g. 400, 401, 403, 404, 429, 500).
   * Absent for non-HTTP errors (empty query, network timeout before response).
   */
  statusCode?: number;

  /**
   * Truncated response body as a string, max 500 characters.
   * Appended with '…' if the original was longer.
   * Absent when there is no HTTP response body.
   * The webview MUST render this with textContent (never innerHTML).
   */
  responseBody?: string;
}
```

---

## Producer

**File**: `src/webview/panelManager.ts` — `PanelManager.runQuery()`

**Conditions**:

| Scenario | `message` | `statusCode` | `responseBody` |
|---|---|---|---|
| Empty `.adx` file | `"Query is empty. Add a KQL query to this file."` | absent | absent |
| KQL syntax error (HTTP 400) | `"Query failed: Kusto request had errors. ..."` | `400` | Kusto error JSON |
| Authentication failure (HTTP 401) | `"Query failed: Request failed with status code 401"` | `401` | Auth error JSON |
| Cluster unreachable (network error) | `"Query failed: connect ECONNREFUSED ..."` | absent | absent |
| Query timeout (30 s) | `"Connection timed out. Check the cluster URL and your network."` | absent | absent |
| Rate-limited (HTTP 429) | `"Query failed: POST request failed with status 429 ..."` | `429` | Rate-limit JSON |

---

## Consumer

**File**: `src/webview/resultsHtml.ts` — `showError(msg)` JavaScript function

**Rendering rules**:
1. Always show `message` as the primary error text.
2. If `statusCode` is present: render `"HTTP {statusCode}"` as a secondary
   label alongside the message.
3. If `responseBody` is present: render it in a `<details>`/`<summary>`
   collapsible block labelled `"Response details"`.
4. All values MUST be set via `element.textContent` (never `element.innerHTML`)
   to prevent XSS from untrusted Kusto response content.
5. If neither `statusCode` nor `responseBody` is present, render only `message`
   (identical to current behaviour — fully backwards compatible).

---

## Backwards Compatibility

`statusCode` and `responseBody` are both optional. Existing webview code that
only reads `msg.message` continues to work; the new fields are ignored unless
the consumer explicitly handles them.
