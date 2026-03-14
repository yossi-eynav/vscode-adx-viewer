# gallant-williams Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-14

## Active Technologies

- TypeScript 5.x, strict mode (`"strict": true`). Node.js 18+ (001-adx-query-viewer)
- VS Code Extension API 1.74+, `azure-kusto-data` v7 (axios), `@azure/identity` v4 (002-cred-validate-live-reload)

## Project Structure

```text
src/
  commands/        # VS Code command handlers
  services/        # ADX credential + query logic
  providers/       # Document open/save listeners
  types/           # Shared TypeScript interfaces (webview messages)
  webview/         # Webview panel management + HTML generation
tests/
  unit/            # Jest tests (outside VS Code host)
  integration/     # VS Code Extension Test Runner
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x, strict mode (`"strict": true`). Node.js 18+: Follow standard conventions

## Key Patterns (002)

- Webview messages use discriminated unions in `src/types/messages.ts`
- `QueryError` carries optional `statusCode` and `responseBody` for HTTP error details
- Debounce with `Map<string, ReturnType<typeof setTimeout>>` per-document timers
- Duck-type axios error detection: `'response' in err && typeof err.response === 'object'`
- Always use `element.textContent` (never `innerHTML`) for user-facing error content in webviews

## Recent Changes

- 001-adx-query-viewer: Added TypeScript 5.x, strict mode (`"strict": true`). Node.js 18+
- 002-cred-validate-live-reload: Added VS Code Extension API patterns, azure-kusto-data v7, @azure/identity v4

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
