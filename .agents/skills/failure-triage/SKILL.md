# Failure Triage

Use this when a command/test fails during implementation or validation.

1. Capture the first relevant failure line (command + first actionable error).
2. Classify failure as one of: `expected validation`, `code regression`, `baseline failure`, `environment blocker`, `wrong command or cwd`.
3. Distinguish baseline/environment issues from current-patch regressions using evidence (prior runs, untouched files, or reproducible pre-existing behavior).
4. Do not retry the same failed command more than twice without changing conditions.
5. Pick the smallest next diagnostic step that can change evidence (path/tool check, narrowed test, corrected cwd/flags, targeted log).
6. Report evidence and next action before expanding scope into broader fixes.
