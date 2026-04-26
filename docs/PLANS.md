# Execution Plan Template

This template is for large/multi-step tasks.

## 1) Understand

- Restate the goal and constraints.
- List impacted modules (`apps/web`, `apps/bff`, `apps/supabase`, `packages/domain`).
- Identify unknowns before implementation begins.

## 2) Audit

Collect current behavior:

- existing API routes/DTOs
- repositories and queries
- migrations/functions/views
- existing tests and fixtures

## 3) Plan

For each step include:

- files to edit
- rollback risk
- validation command
- expected data impact

## 4) Implement

- apply minimal scoped patchset
- keep changes reversible where possible
- avoid unrelated refactors

## 5) Verify

- run lint/typecheck/tests
- run relevant e2E when UI changes
- capture failing cases and retest after fix

## 6) Report

Final response should include:
- changed files
- behavior impact
- validation commands + results
- edge cases still open
