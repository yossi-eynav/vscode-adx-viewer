# Contract: Credentials File Schema

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14

---

## File Location

```
~/.config/adx-viewer/credentials.json
```

- Created by `src/services/credentialService.ts` on first save.
- File permissions: `0o600` (owner read/write only). Applied after every write.
- Directory `~/.config/adx-viewer/` is created with `mkdir -p` if absent.

---

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ADX Viewer Credentials",
  "type": "object",
  "required": ["clusterUrl", "tenantId", "clientId", "clientSecret"],
  "additionalProperties": false,
  "properties": {
    "clusterUrl": {
      "type": "string",
      "description": "ADX cluster endpoint URL",
      "pattern": "^https://",
      "example": "https://mycluster.eastus.kusto.windows.net"
    },
    "tenantId": {
      "type": "string",
      "description": "Azure Active Directory tenant ID (GUID or domain)",
      "example": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    },
    "clientId": {
      "type": "string",
      "description": "Azure AD application (client) ID (GUID)",
      "example": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
    },
    "clientSecret": {
      "type": "string",
      "description": "Azure AD application client secret (plain text — see security note)"
    },
    "defaultDatabase": {
      "type": "string",
      "description": "Optional default database name used when executing queries",
      "example": "myDatabase"
    }
  }
}
```

---

## Example File

```json
{
  "clusterUrl": "https://mycluster.eastus.kusto.windows.net",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "clientSecret": "my-secret-value",
  "defaultDatabase": "telemetry"
}
```

---

## Security Note

The `clientSecret` field is stored as plain text. This is a v1 trade-off enabling
cross-tool credential sharing and simplicity. Mitigation: file permissions `0o600`
restrict access to the file owner only. A future version (v2) should move
`clientSecret` to VS Code's `SecretStorage` API (OS keychain-backed encryption)
and retain only non-sensitive fields in this file.

---

## Backward Compatibility

If the file is present but missing `defaultDatabase`, the extension treats it as
absent (no default database). Missing required fields (`clusterUrl`, `tenantId`,
`clientId`, `clientSecret`) cause the extension to treat credentials as unconfigured
and prompt the user to re-run the "Configure ADX Connection" command.
