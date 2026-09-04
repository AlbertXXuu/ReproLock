## Problem and behavior

Describe the concrete trigger and the user-visible or evidence result before and after this change.

## Validation

List commands that actually ran and their results. Link inspectable evidence when applicable.

## Review checklist

- [ ] The change stays within local functional QA scope and uses only explicit trusted commands.
- [ ] Candidate, target, evidence, path, timeout, cancellation and cleanup boundaries remain honest.
- [ ] Portable artifacts contain no credentials, private data, raw logs, or machine-specific paths.
- [ ] Product-stage and reliability claims do not exceed the executed evidence.
- [ ] Relevant focused checks and `corepack pnpm check` pass.
