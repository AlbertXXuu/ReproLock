# Saved run readiness — actual acceptance

Base `9e630b8b2fe5720e5848d01cbf44476aecfe5b06`. PR #7 introduced the verified local candidate
workflow; both PR jobs passed. Its subsequent main run `33902484660` passed all 82 unit/process
checks but failed the saved-run browser scenario on Node 24. The original log is preserved in
ignored `output/main-9e630b8-ci-failure.log`.

Diagnosis: the UI presented a clickable saved-run link while `active` or `pendingControl` still
caused its handler to ignore clicks. The server could also return old active state with refreshed
terminal content. No evidence corruption or false differential was observed.

The new browser regression holds a real start response after backend completion. Before the fix
it failed because the saved link lacked its disabled state. After the fix, the link is disabled
and a forced click sends no saved-run request; releasing the start response enables it. Selection
then shows the saved result and survives a subsequent poll.

Actual checks:

- Focused regression before patch: failed, `aria-disabled` expected `true`, actual missing.
- `node node_modules/@playwright/test/cli.js test tests/playwright/demo.spec.ts`: 4/4 passed after
  patch, including 390/900/1440 geometry, font/asset loading, keyboard and reduced-motion state.
- Ordinary-user pnpm 11.19.0 `pnpm check`: **82/82 unit/process + 5/5 browser passed**. Historical
  evidence and recorded exports passed without changes. Log: `output/saved-run-readiness-check.log`.
- Parent brand and workspace validation: both passed.
- Independent read-only review: no remaining submission blocker.

No CSS, canonical assets, header geometry, original experiments or verifier contract changed.
The fix preserves source and product Gate separation; `SPIKE_CONDITIONAL` remains unchanged.
