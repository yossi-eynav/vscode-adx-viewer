# Feature Specification: ADX Query Viewer

**Feature Branch**: `001-adx-query-viewer`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "I want to build a vscode extension. 1. A command that accepts credentials for querying ADX and stores them in ~/. 2. On every .adx file, perform a query and present the result in a table + graph viewer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure ADX Credentials (Priority: P1)

A developer opens VS Code and needs to connect to an Azure Data Explorer cluster. They
run a dedicated command ("Configure ADX Connection") from the command palette. VS Code
prompts them to enter their cluster URL, tenant ID, client ID, and client secret. Once
submitted, the extension stores these credentials in the user's home directory so that
any subsequent .adx file query can use them without prompting again.

**Why this priority**: Without credentials, no query can run. This is the required
prerequisite for all other functionality and delivers standalone value — a developer
can verify their connection is configured before writing any .adx files.

**Independent Test**: Can be fully tested by running the "Configure ADX Connection"
command, supplying credentials, and verifying that the credentials file appears in the
home directory with the correct values. No .adx file is needed.

**Acceptance Scenarios**:

1. **Given** no credentials are stored, **When** the user runs "Configure ADX
   Connection" from the command palette, **Then** VS Code displays input prompts for
   cluster URL, tenant ID, client ID, and client secret in sequence.
2. **Given** the user completes all prompts, **When** they confirm the last input,
   **Then** the credentials are saved to the home directory and a success notification
   appears.
3. **Given** credentials are already stored, **When** the user runs "Configure ADX
   Connection" again, **Then** the existing values are pre-filled in each prompt so
   the user can update only what has changed.
4. **Given** the user leaves any required field blank, **When** they attempt to
   confirm, **Then** an error message appears and the prompt remains open for
   correction.

---

### User Story 2 - View .adx File Query Results (Priority: P2)

A developer has a `.adx` file containing a KQL (Kusto Query Language) query. When they
open the file in VS Code, the extension automatically executes the query against the
configured ADX cluster and opens a results panel displaying the data as a table (rows
and columns) and a chart (visual graph). The developer can explore both representations
without leaving VS Code.

**Why this priority**: This is the core value of the extension — turning static query
files into live, visual data exploration. Depends on P1 (credentials) being in place.

**Independent Test**: Can be fully tested by opening any `.adx` file after credentials
are configured. The results panel should appear with a table and chart independently
of any other new feature work.

**Acceptance Scenarios**:

1. **Given** credentials are configured and a `.adx` file is opened, **When** VS Code
   activates the file, **Then** a results panel opens showing a data table with all
   returned columns and rows.
2. **Given** the results panel is open and the query returned data, **When** the panel
   renders, **Then** a chart is displayed representing the result set visually.
3. **Given** no credentials are configured, **When** the user opens a `.adx` file,
   **Then** the extension shows a notification that credentials are missing and offers
   a direct action to launch "Configure ADX Connection".
4. **Given** credentials are configured but the query fails (syntax error, timeout, or
   permission denied), **When** the extension attempts to execute the query, **Then**
   the results panel displays a clear, human-readable error message instead of results.
5. **Given** a `.adx` file query returns zero rows, **When** the panel renders,
   **Then** an empty-state message ("No results returned") is shown rather than a
   blank panel.

---

### Edge Cases

- What happens when the credentials file exists but is corrupted or missing required
  fields? → Extension treats it as missing credentials and prompts re-configuration.
- How does the system handle a `.adx` file with an empty body? → Displays an error
  message: "Query is empty. Add a KQL query to this file."
- What happens if the ADX cluster is unreachable? → A timeout error is shown in the
  results panel with guidance to check the cluster URL and network connectivity.
- What if the query returns an extremely large number of rows? → Results are capped
  with a visible notice ("Showing first 1,000 rows of N total").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a VS Code command named "Configure ADX Connection"
  accessible from the command palette.
- **FR-002**: The "Configure ADX Connection" command MUST collect: cluster URL, tenant
  ID, client ID, and client secret.
- **FR-003**: Collected credentials MUST be persisted in the user's home directory upon
  successful completion of the command.
- **FR-004**: If credentials already exist, the "Configure ADX Connection" command MUST
  pre-populate all fields with stored values so the user can edit selectively.
- **FR-005**: System MUST automatically execute the KQL query in a `.adx` file when
  that file is opened in VS Code.
- **FR-006**: Query results MUST be displayed in a tabular format showing all returned
  columns and rows.
- **FR-007**: Query results MUST also be displayed as a chart in the same results panel.
- **FR-008**: When credentials are absent and a `.adx` file is opened, the system MUST
  notify the user and offer a direct action to launch "Configure ADX Connection".
- **FR-009**: Query errors (syntax, auth, connectivity) MUST be displayed as clear,
  human-readable messages in the results panel — not as raw stack traces.
- **FR-010**: Large result sets MUST be capped at 1,000 rows, with a visible indication
  of truncation (e.g., "Showing first 1,000 rows of N total") shown to the user.

### Key Entities

- **ADX Credentials**: Authentication configuration for an ADX cluster. Fields: cluster
  URL, tenant ID, client ID, client secret. Stored once per user in the home directory.
- **ADX Query**: The KQL query string contained in a `.adx` file. Executed as-is
  against the configured cluster when the file is opened.
- **Query Result**: Tabular data returned by an ADX query. Contains columns (names and
  types) and rows (values). Drives both the table and chart displays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can configure ADX credentials for the first time in under
  2 minutes using only the VS Code command palette.
- **SC-002**: After credentials are configured, opening a `.adx` file displays query
  results within 5 seconds for queries returning under 1,000 rows (assuming normal
  cluster response times).
- **SC-003**: 100% of query errors are surfaced as readable messages in the results
  panel — zero uncaught errors that produce blank or broken panels.
- **SC-004**: Credentials, once saved, persist across VS Code restarts without
  requiring re-entry by the user.
- **SC-005**: A developer can update stored credentials entirely through the "Configure
  ADX Connection" command, without manually editing any file.

## Assumptions

- **Auth method**: Application (service principal) authentication is assumed: cluster
  URL, tenant ID, client ID, and client secret. This is the most common non-interactive
  auth method for programmatic ADX access. Browser-based interactive login is out of
  scope for this version.
- **Credential storage format**: Credentials are stored in plaintext in a dedicated
  file within `~/`, consistent with common developer tooling conventions (e.g.,
  `~/.aws/credentials`, `~/.kube/config`). At-rest encryption is out of scope for v1.
- **File open trigger**: The query executes when the `.adx` file is activated/focused
  in the VS Code editor — not merely present in the workspace explorer.
- **Chart type**: Automatically selected based on result data shape (time-series → line
  chart, categorical/count data → bar chart). Manual chart-type selection is out of
  scope for v1.
- **Results display**: Rendered in a dedicated VS Code panel/tab alongside the editor,
  not as inline editor decorations.
