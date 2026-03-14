# Data Model: Credential Validation, Live Reload & Query Error Enrichment

**Feature Branch**: `002-cred-validate-live-reload`
**Date**: 2026-03-14

---

## Entities

### 1. ValidationResult *(US1 — new)*

Discriminated union representing the outcome of a live credential test.
Defined in `src/services/queryService.ts`.

```typescript
export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      category: 'auth' | 'unreachable' | 'timeout';
      message: string;   // human-readable, shown directly to user
    };
```

**State transitions**: Produced by `testConnection(credentials)`. Never stored to
disk; exists only in-memory during the credential configuration flow.

**Validation rules**:
- `category` is always one of the three literals; never `'unknown'`
- `message` strings are fixed constants matched to spec acceptance scenarios:
  - auth → `'Authentication failed. Check your Client ID and Client Secret.'`
  - unreachable → `'Cannot reach cluster. Check the Cluster URL and your network.'`
  - timeout → `'Connection timed out after 10 seconds.'`

---

### 2. CredentialDraft *(US1 — conceptual)*

The in-memory credential values entered by the user during the `ADX: Configure
Connection` command, before validation passes and `writeCredentials()` is called.
Represented as `Partial<ADXCredentials>` (from `src/services/credentialService.ts`);
no dedicated type is needed.

**Constraint**: MUST NOT be passed to `writeCredentials()` until
`testConnection()` returns `{ ok: true }` (FR-005).

---

### 3. QueryError *(user input enhancement — extended)*

Existing class in `src/services/queryService.ts`, extended with optional HTTP
diagnostic fields.

```typescript
export class QueryError extends Error {
  readonly statusCode?: number;    // HTTP status code (e.g. 401, 400, 500)
  readonly responseBody?: string;  // truncated response body, max 500 chars + '…'

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message);
    this.name = 'QueryError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
```

**Population rules**:
- `statusCode` is set only when the underlying error carries an HTTP response
  (duck-typed: `typeof err === 'object' && err !== null && 'response' in err &&
  typeof (err as {response?: unknown}).response === 'object'`)
- `responseBody` is set only when `error.response.data` is non-null/undefined;
  stringified with `JSON.stringify` (fallback `String()`), then truncated to
  500 characters with `…` appended if longer
- Both fields remain `undefined` for non-HTTP errors (e.g. network timeout,
  empty query)

---

### 4. RenderErrorMessage *(user input enhancement — extended)*

Webview message contract in `src/types/messages.ts`, extended to carry the new
diagnostic fields.

```typescript
export interface RenderErrorMessage {
  command: 'renderError';
  message: string;           // human-readable error description (required)
  statusCode?: number;       // HTTP status code, forwarded from QueryError
  responseBody?: string;     // truncated response body, forwarded from QueryError
}
```

**Population**: `PanelManager.runQuery()` reads `err.statusCode` and
`err.responseBody` when the caught error is a `QueryError`, and includes them
in the `renderError` postMessage.

---

## Relationships

```
ADXCredentials ──── collectCredentials() ──▶ CredentialDraft
                                               │
                                               ▼
                                         testConnection()
                                               │
                                               ▼
                                        ValidationResult
                                         ┌────┴────┐
                                         ok:true  ok:false
                                           │         │
                                    writeCredentials  showErrorMessage
                                                      + Retry/Cancel

vscode.TextDocument ──── onDidSaveTextDocument (500ms debounce) ──▶ PanelManager.reloadForDocument()
                                                                            │
                                                                            ▼
                                                                       executeQuery()
                                                                            │
                                                                    QueryError (statusCode?, responseBody?)
                                                                            │
                                                                            ▼
                                                                    RenderErrorMessage → Webview
```
