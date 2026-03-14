# Contract: VS Code Commands

**Branch**: `001-adx-query-viewer` | **Date**: 2026-03-14

This document defines all VS Code commands contributed by the extension.
Commands are registered in `package.json` under `contributes.commands` and
implemented in `src/commands/`.

---

## Command: adxViewer.configureCredentials

| Property | Value |
|----------|-------|
| **Command ID** | `adxViewer.configureCredentials` |
| **Display title** | `ADX: Configure Connection` |
| **Palette accessible** | Yes (always shown in command palette) |
| **Source file** | `src/commands/configureCredentials.ts` |

### Behavior

1. Opens a 4-step `InputBox` flow collecting:
   - Step 1/4: Cluster URL (pre-populated if credentials exist)
   - Step 2/4: Tenant ID (pre-populated if credentials exist)
   - Step 3/4: Client ID (pre-populated if credentials exist)
   - Step 4/4: Client Secret (masked; pre-populated with `***` placeholder if
     credentials exist — clearing the field and leaving it blank retains the old
     value; entering a new value replaces it)
2. On completion: writes `~/.config/adx-viewer/credentials.json` and applies
   `chmod 0o600`.
3. Shows a VS Code information notification: `"ADX connection configured successfully."`
4. On cancellation (Escape at any step): aborts without writing; shows no notification.

### Validation

| Field | Rule | Error message |
|-------|------|---------------|
| Cluster URL | Must start with `https://` and be non-empty | `"Cluster URL must start with https://"` |
| Tenant ID | Non-empty | `"Tenant ID is required"` |
| Client ID | Non-empty | `"Client ID is required"` |
| Client Secret | Non-empty (or retain existing) | `"Client Secret is required"` |

---

## Activation Event

```json
"activationEvents": ["onLanguage:adx"]
```

The extension activates the first time any `.adx` file is opened. Once active, the
command `adxViewer.configureCredentials` is available from the command palette
regardless of the active file type.

---

## Language Contribution

```json
"contributes": {
  "languages": [{
    "id": "adx",
    "aliases": ["ADX", "Kusto Query Language (ADX)"],
    "extensions": [".adx"]
  }]
}
```

No grammar/tokenizer is required for v1. Syntax highlighting is out of scope.
