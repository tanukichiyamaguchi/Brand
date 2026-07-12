@AGENTS.md

# Claude Code specific instructions

- Use the shared workflow and safety rules in `AGENTS.md`.
- Perform implementation work on a dedicated `claude/<task>` branch created from the latest `main`.
- Push completed work to GitHub and open a pull request against `main` before handing it to Codex.
- In the pull-request description, explain product intent, important design decisions, expected behavior, verification results, and unresolved concerns.
- Do not continue editing a branch while Codex is reviewing or refactoring it.
- After a Codex refactoring pull request is reviewed and merged, begin final adjustments from the latest `main` on a new Claude branch.
- Do not ask the user to perform local development; use the configured GitHub-connected cloud environment.
