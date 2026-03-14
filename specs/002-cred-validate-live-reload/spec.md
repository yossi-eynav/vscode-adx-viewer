# Feature Specification: Credential Validation & Live Query Reload

**Feature Branch**: `002-cred-validate-live-reload`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "1- when the user is adding the credentials, perform a request and verify if the credentials are valid. 2- in the preview page, reload the viewer when there are changes being made to the query. (adx file)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate Credentials on Save (Priority: P1)

When a user completes the "Configure ADX Connection" command and submits their credentials, the extension immediately attempts a lightweight test query against the ADX cluster to confirm the credentials work. If the connection succeeds, the user sees a success confirmation. If it fails, they see a clear error message explaining what went wrong and are prompted to correct their input before saving.

**Why this priority**: Saving invalid credentials silently is the primary source of confusion — users only discover the problem later when opening a `.adx` file. Validating at entry time prevents wasted time and gives immediate, actionable feedback.

**Independent Test**: Can be fully tested by running `ADX: Configure Connection`, completing all four steps, and verifying that valid credentials produce a success notification while invalid credentials (wrong secret, wrong cluster URL, etc.) produce a specific error message — no `.adx` file required.

**Acceptance Scenarios**:

1. **Given** the user completes all four credential fields with valid service principal details, **When** they confirm the final step, **Then** the extension performs a test connection, shows a progress indicator during validation, saves the credentials on success, and displays "ADX connection configured and verified successfully."
2. **Given** the user completes the credential fields with an incorrect client secret, **When** they confirm the final step, **Then** the extension performs a test connection, shows a clear error message ("Authentication failed. Check your Client ID and Client Secret."), and does **not** save the credentials.
3. **Given** the user enters an unreachable or misspelled cluster URL, **When** they confirm the final step, **Then** the extension shows an error ("Cannot reach cluster. Check the Cluster URL and your network.") and does not save.
4. **Given** validation fails, **When** the error is shown, **Then** the user is offered the option to retry (re-open the credential form with values pre-filled) or cancel.
5. **Given** the validation request takes longer than the timeout threshold, **When** the timeout expires, **Then** the extension treats it as a connection failure and shows an appropriate timeout error.

---

### User Story 2 - Live Reload Results on Query Change (Priority: P2)

When a user edits and saves a `.adx` file that already has a results panel open, the results panel automatically re-executes the query and refreshes the displayed results — without the user needing to close and reopen the file.

**Why this priority**: Without live reload, users must close and reopen the file after every edit to see updated results, which breaks the iterative query-writing workflow. This is a key quality-of-life improvement that makes the tool genuinely useful for query development.

**Independent Test**: Can be fully tested by opening a `.adx` file (results panel opens), editing the query text, saving the file, and confirming the results panel updates automatically with the new query's results.

**Acceptance Scenarios**:

1. **Given** a `.adx` file is open with a results panel visible, **When** the user edits the query and saves the file, **Then** the results panel shows a loading indicator and then refreshes with the updated query results.
2. **Given** the results panel is reloading after a file save, **When** the new query is executing, **Then** the previous results are replaced with a loading indicator (not left stale).
3. **Given** a `.adx` file is open with a results panel and the user edits and saves multiple times in quick succession, **When** the saves arrive rapidly, **Then** the extension debounces the reload — only executing the query after a short pause in edits — to avoid flooding the ADX cluster.
4. **Given** the updated query has a syntax error or returns an error from ADX, **When** the reload completes, **Then** the results panel shows the error message (same as the initial error state), not the previous stale results.
5. **Given** a `.adx` file is edited and saved but its results panel has been closed, **When** the file is saved, **Then** no automatic reload occurs (no panel to update).

---

### Edge Cases

- What happens when credential validation succeeds but the `defaultDatabase` field refers to a database the service principal cannot access?
- What happens when the user closes the credential input mid-validation (while the test request is in flight)?
- What if the ADX cluster is temporarily unreachable during live reload (intermittent network failure)?
- What if a `.adx` file is renamed or moved while its results panel is open?

## Requirements *(mandatory)*

### Functional Requirements

**Credential Validation (US1)**

- **FR-001**: After the user submits all four credential fields, the system MUST perform a lightweight test connection to the specified ADX cluster before saving credentials.
- **FR-002**: The system MUST display a visible progress indicator during the validation request so the user knows a connection attempt is in progress.
- **FR-003**: On successful validation, the system MUST save the credentials and display a success notification to the user.
- **FR-004**: On validation failure, the system MUST display an error message that indicates the likely cause (authentication failure vs. unreachable cluster vs. timeout) without exposing raw stack traces.
- **FR-005**: On validation failure, the system MUST NOT save the credentials to disk.
- **FR-006**: On validation failure, the system MUST offer the user the option to retry (return to the credential form with values pre-filled) or cancel.
- **FR-007**: The validation test connection MUST complete or time out within 10 seconds; if it exceeds this threshold, the system MUST treat it as a failure.

**Live Query Reload (US2)**

- **FR-008**: When a `.adx` file that has an open results panel is saved, the system MUST automatically re-execute the query and update the results panel.
- **FR-009**: When a reload is triggered, the system MUST immediately replace the displayed content with a loading indicator; stale results MUST NOT remain visible during execution.
- **FR-010**: The system MUST debounce rapid consecutive file saves, waiting at least 500 ms after the last save event before executing the query.
- **FR-011**: If the re-executed query returns an error, the results panel MUST display the error message in place of any previous results.
- **FR-012**: If the results panel for a `.adx` file has been closed, saving that file MUST NOT trigger any query execution.

### Key Entities

- **ValidationResult**: The outcome of a test connection attempt — success or failure, with a human-readable reason on failure.
- **CredentialDraft**: The in-memory credential values entered by the user before validation and save; never persisted until validation passes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with valid credentials see a success confirmation within 10 seconds of submitting the credential form.
- **SC-002**: Users with invalid credentials receive a specific, actionable error message (not a generic failure) 100% of the time.
- **SC-003**: The results panel reflects the latest saved query within 3 seconds of a file save under normal ADX cluster response conditions.
- **SC-004**: Saving a `.adx` file 5 times in rapid succession triggers exactly 1 query execution (debounce behaviour is reliable).
- **SC-005**: Zero cases where invalid credentials are persisted to disk after a failed validation.

## Assumptions

- The test connection for credential validation uses the same `executeQuery` mechanism as the query viewer, running a minimal query (e.g., `.show databases` or equivalent) against the cluster. The specific query is an implementation detail.
- "Saving" in the live reload context means an explicit file save (Ctrl+S / Cmd+S), not every keystroke. VS Code's `onDidSaveTextDocument` event is the trigger.
- The debounce window of 500 ms is a reasonable default; it may be tuned during implementation if needed.
- Credential validation failure messages need not enumerate every possible ADX error code — grouping into auth failure / unreachable / timeout covers the primary cases.
