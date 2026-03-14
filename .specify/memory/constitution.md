<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (MAJOR: initial adoption, all placeholders replaced)

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Extension-First
  - [PRINCIPLE_2_NAME] → II. Simplicity (YAGNI)
  - [PRINCIPLE_3_NAME] → III. Data Accuracy
  - [PRINCIPLE_4_NAME] → IV. Test Coverage
  - [PRINCIPLE_5_NAME] → V. Incremental Delivery

Added sections:
  - Technology Constraints (replaces [SECTION_2_NAME])
  - Development Workflow (replaces [SECTION_3_NAME])

Removed sections: none

Templates reviewed:
  - .specify/templates/plan-template.md   ✅ Constitution Check section present; no updates needed
  - .specify/templates/spec-template.md   ✅ No constitution-specific references; no updates needed
  - .specify/templates/tasks-template.md  ✅ Task structure aligns with incremental delivery principle
  - .claude/commands/speckit.plan.md      ✅ References constitution.md correctly; no agent-specific issues
  - .claude/commands/speckit.specify.md   ✅ No constitution references; no updates needed
  - .claude/commands/speckit.tasks.md     ✅ No constitution references; no updates needed
  - .claude/commands/speckit.constitution.md ✅ Uses generic "agent" language; no updates needed

Deferred TODOs: none
-->

# adx-vscode-viewer Constitution

## Core Principles

### I. Extension-First

All functionality MUST be exposed through VS Code's native extension APIs—commands,
tree data providers, custom editors, webviews, and status bar items. Features MUST
follow VS Code UX conventions (command palette, activity bar, explorer context menus)
rather than inventing parallel navigation. Standalone application patterns (embedded
servers, OS-level UI, browser windows) are prohibited unless no VS Code API equivalent
exists; any such exception MUST be justified in the plan's Complexity Tracking table.

**Rationale**: Consistent VS Code integration ensures users discover features
naturally, reduces maintenance surface, and keeps the extension lightweight.

### II. Simplicity (YAGNI)

Every component MUST have a single, clearly stated purpose. Build only what is needed
for the current user story; do not add configurability, abstractions, or helpers for
hypothetical future requirements. Prefer VS Code native UI components (tree views,
quick picks, input boxes) over custom Webview UI. Each added dependency MUST be
justified against a simpler native alternative. Complexity violations MUST be recorded
in the plan's Complexity Tracking table before implementation begins.

**Rationale**: Over-engineering a VS Code extension leads to slow activation times,
fragile code, and maintenance burden. The simplest solution that satisfies the user
story is the correct solution.

### III. Data Accuracy

ADX query results MUST be rendered without data loss or silent truncation. Any
transformation applied to data before display MUST be documented and reversible or
explicitly disclosed to the user. Schema-breaking changes to stored state (e.g.,
workspace settings, cached connection configs) MUST include a migration path. Lossy
operations (e.g., pagination, sampling for large result sets) MUST be visually
communicated to the user.

**Rationale**: Users rely on the viewer to trust that what they see reflects the
actual data in Azure Data Explorer. Silent inaccuracies erode confidence and lead to
downstream decisions based on wrong data.

### IV. Test Coverage

Unit tests are required for all business logic (query builders, result transformers,
connection managers). Integration tests are required for all VS Code API interactions
(tree provider updates, command registration, configuration reads). Contract tests are
required at the ADX API boundary. Tests MUST be written and confirmed failing before
their corresponding implementation (Red before Green). The test suite MUST pass in CI
before any PR is merged.

**Rationale**: A data viewer is only as trustworthy as its test coverage. Regressions
in rendering or querying are silent and dangerous.

### V. Incremental Delivery

Features MUST be structured so each user story is independently deployable as an
extension update. No single PR should span multiple user stories unless they share a
blocking foundational dependency that cannot be split. Each merged story MUST leave
the extension in a working, publishable state.

**Rationale**: Incremental delivery reduces integration risk, enables early user
feedback, and ensures the extension can be released at any checkpoint.

## Technology Constraints

- **Language**: TypeScript with strict mode enabled (`"strict": true` in tsconfig).
- **Runtime**: VS Code Extension API (current stable release at time of development).
- **ADX client**: Azure Data Explorer SDK / Kusto client library for Node.js.
- **Bundler**: Webpack (esbuild acceptable as an alternative if build times are a
  concern; document the choice in the feature plan).
- **Testing**: VS Code Extension Test Runner (Mocha-based) for integration tests;
  Jest or Vitest for unit tests outside the VS Code host.
- **Node version**: LTS version in use at project inception; pin in `.nvmrc` or
  `engines` field of `package.json`.
- **New dependencies** MUST be evaluated against the Simplicity principle before
  addition; each new runtime dependency requires a brief justification comment in
  `package.json` or the PR description.

## Development Workflow

- All work MUST happen on feature branches created by `/speckit.specify`. Branch
  naming follows the speckit convention (`###-short-name`).
- Pull requests require at least one reviewer approval before merge.
- The PR description MUST include a Constitution Check confirming compliance with all
  five core principles, or explicitly documenting justified exceptions.
- The full test suite MUST pass in CI (no skipped tests without issue reference).
- `main` MUST remain in a releasable state at all times; do not merge incomplete
  features without a feature flag or conditional activation.
- TypeScript compilation MUST produce zero errors and zero `any` escapes without
  explicit suppression comments.

## Governance

This constitution supersedes all other stated practices, coding conventions, or verbal
agreements. In the event of conflict, the constitution wins. Amendments follow this
procedure:

1. Open a PR that modifies `.specify/memory/constitution.md` with a clear rationale.
2. Bump `CONSTITUTION_VERSION` according to semantic versioning:
   - **MAJOR**: A principle removed, renamed with changed meaning, or governance rule
     fundamentally altered.
   - **MINOR**: A new principle added or a section materially expanded.
   - **PATCH**: Wording clarification, typo fix, or non-semantic refinement.
3. Update `LAST_AMENDED_DATE` to the merge date.
4. Run `/speckit.constitution` after merging to propagate changes to dependent
   templates and command files.
5. All open feature branches MUST re-run their Constitution Check against the new
   version before merging.

All PRs and design reviews MUST include a Constitution Check (see plan-template.md).
Complexity that violates any principle MUST be justified before implementation.
Refer to `.specify/memory/constitution.md` as the authoritative runtime guidance
during development.

**Version**: 1.0.0 | **Ratified**: 2026-03-14 | **Last Amended**: 2026-03-14
