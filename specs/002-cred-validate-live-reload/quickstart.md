# Quickstart: Manual Test Scenarios

**Feature Branch**: `002-cred-validate-live-reload`
**Date**: 2026-03-14

Use these scenarios to verify the feature end-to-end in a live VS Code session.
All scenarios assume `vsce package` has been run and the `.vsix` has been installed,
or the extension is launched via **F5** (Extension Development Host).

---

## Scenario 1 — Credential validation: happy path (US1)

**Setup**: No credentials configured (or wipe `~/.config/adx-viewer/credentials.json`).

1. Open command palette → `ADX: Configure Connection`
2. Enter a valid cluster URL (`https://help.kusto.windows.net`)
3. Enter a valid Tenant ID, Client ID, and Client Secret
4. Observe: progress notification `"ADX: Validating credentials…"` appears during step 4
5. **Expected**: Information notification `"ADX connection configured and verified successfully."`
6. **Expected**: `~/.config/adx-viewer/credentials.json` contains the entered credentials

---

## Scenario 2 — Credential validation: wrong secret (US1)

1. Open command palette → `ADX: Configure Connection`
2. Enter valid cluster URL and Tenant ID / Client ID, but enter `wrong-secret` as the secret
3. **Expected**: Progress notification appears, then error notification:
   `"Authentication failed. Check your Client ID and Client Secret."`
4. **Expected**: `"Retry"` and `"Cancel"` buttons appear alongside the error
5. **Expected**: `credentials.json` is NOT updated or created
6. Click `"Retry"` → form re-opens with all four fields pre-filled with the values just entered
7. Correct the secret and complete → success notification appears

---

## Scenario 3 — Credential validation: unreachable cluster (US1)

1. Open command palette → `ADX: Configure Connection`
2. Enter `https://no-such-cluster.invalid` as the cluster URL
3. Complete remaining fields with any values
4. **Expected**: Error notification: `"Cannot reach cluster. Check the Cluster URL and your network."`
5. **Expected**: No credentials saved

---

## Scenario 4 — Credential validation: timeout (US1)

*(Simulated by blocking network to the cluster.)*

1. Disconnect from network or use a firewall rule to drop packets to the cluster
2. Open command palette → `ADX: Configure Connection` with otherwise valid credentials
3. **Expected**: After ~10 seconds, error notification: `"Connection timed out after 10 seconds."`
4. **Expected**: No credentials saved

---

## Scenario 5 — Live reload: query edit triggers refresh (US2)

**Setup**: Valid credentials configured, at least one `.adx` file with a valid query.

1. Open the `.adx` file; confirm the results panel opens beside it
2. Edit the query (e.g., add `| take 5`)
3. Press Cmd+S / Ctrl+S
4. **Expected**: Results panel immediately shows the loading indicator
5. **Expected**: Within a few seconds, the panel shows the updated results

---

## Scenario 6 — Live reload: debounce (US2)

1. Open a `.adx` file with the results panel visible
2. Press Cmd+S five times in rapid succession (within 1 second)
3. **Expected**: The loading indicator appears only once; the query runs exactly once
4. Verify by checking that the panel only briefly enters loading state then shows final results

---

## Scenario 7 — Live reload: closed panel is not reloaded (US2)

1. Open a `.adx` file, then close its results panel
2. Edit and save the `.adx` file
3. **Expected**: No query is executed; no panel opens or errors appear

---

## Scenario 8 — Query error enrichment: syntax error displays HTTP details

*(User input requirement: "present a better error message when an invalid status code is received")*

**Setup**: Valid credentials configured.

1. Open a `.adx` file and write an intentionally broken KQL query, e.g.:
   ```
   ThisIsNotAValidTable | take 10
   ```
2. Wait for (or save to trigger) query execution
3. **Expected**: The results panel shows the human-readable error message
4. **Expected**: Below the message, `"HTTP 400"` (or relevant status code) is visible
5. **Expected**: A collapsible `"Response details"` section shows the raw Kusto error JSON

---

## Scenario 9 — Query error enrichment: auth error displays status code

1. Configure valid credentials, then manually corrupt `clientSecret` in
   `~/.config/adx-viewer/credentials.json`
2. Open or reload a `.adx` file
3. **Expected**: Results panel shows error message with `"HTTP 401"` and response body details

---

## Scenario 10 — Query error enrichment: network error has no HTTP details

1. Disconnect from network, then save a `.adx` file with the results panel open
2. **Expected**: Results panel shows connection error message only — no `"HTTP"` label and
   no `"Response details"` section (because there was no HTTP response)
