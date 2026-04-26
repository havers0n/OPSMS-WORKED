# Code Review Guide

## Review checklist

Use this before finishing any change:

### Correctness
- Is the domain rule implemented in the right layer (DB/BFF/UI)?
- Are payloads validated with current schemas?
- Are canonical quantities taken from authoritative data?
- Are packaging and storage-preset paths covered with tests?

### Safety
- Any data-mutation flow touched without transaction/RPC checks?
- Any auth/tenant checks removed or weakened?
- Any migration/schema edits without rollback/compatibility notes?
- Are destructive/empty payload operations intentionally handled?

### Maintainability
- Is the change minimal and scoped?
- Is naming consistent with existing domain language?
- Is duplicate logic avoided (especially for hierarchy/canonical calculations)?
- Are related docs updated (`AGENTS.md`, domain/API/DB docs)?

### Testing
- Relevant unit/integration tests exist and updated.
- For UI changes: component tests and Playwright flow test when relevant.
- For BFF/domain changes: request/DB contract tests added or adjusted.

## Suggested review output

| Severity | File | Problem | Suggested fix |
|---|---|---|---|
| P0 | - | breaks production behavior | stop and redesign |
| P1 | - | wrong domain logic | move logic to canonical layer |
| P2 | - | brittle or duplicated behavior | consolidate or document constraints |
