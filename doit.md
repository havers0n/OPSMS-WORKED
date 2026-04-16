Good direction overall, but revise the PR plan.

Main issues to fix:

1. The plan front-loads too much foundation work before attacking the highest-payoff structural violations.
I do not want 3 foundation PRs in a row before the real hot surfaces are split.

2. The plan defines entities/*/ui for read-only domain display, but does not give that layer a real implementation PR.
That is a gap.

3. PR6 focused on cn.ts upgrade is lower architectural payoff than a PR that introduces the first domain display components and applies them to real consumers.

Revise the plan with these constraints:

- Keep the same responsibility model.
- Keep shared/ui generic.
- Keep entities/*/ui read-only only.
- Keep editor-store decomposition out of scope for now.

But change the PR plan so that:
- minimal foundation is built only to support immediate migration targets
- overloaded surfaces are split earlier
- a dedicated PR exists for the first domain display UI components
- cn.ts upgrade is optional or folded into a later adoption PR, not treated as a top-level structural PR

I want a revised PR plan with 5–6 PRs max.

For each PR, state:
- why this PR must exist now
- which current consumer files will adopt the result immediately
- why this PR is higher payoff than delaying it