# Saved run readiness

Observed problem: main `9e630b8` CI run `33902484660`, Node 24 browser test at
`tests/playwright/demo.spec.ts:104`, displayed `Startup failed` after clicking its retained run.
All 82 unit/process tests passed; Node 22 passed. The failure log is preserved in local ignored
`output/main-9e630b8-ci-failure.log`.

The saved link is rendered as enabled while its click handler silently rejects active/pending
controls. Final verification appears before asynchronous final publication finishes; a state
response also snapshots `active` before awaiting refresh. This is an availability mismatch.

Sole writer on `codex/demo-saved-run-race`, clean base `9e630b8`; allowed paths are this plan,
matching phase context, Demo app.js/server.ts and focused browser regression. Canonical assets,
geometry, historical evidence, new verifier and the separate pre-only DrawDB experiment are excluded.

Add a deterministic browser test holding the start response while the backend finishes, proving
saved controls remain disabled until available. Then synchronize their accessible disabled state
with the existing guard, and read active after asynchronous state refresh. Re-run browser/resource/
390/900/1440 header checks, full required checks and parent brand checks; independent review,
commit/PR/CI/merge, sync D main. Do not hide this failure with a retry or a longer assertion timeout.
No product Gate changes. Roll back only this focused patch if it breaks live controls.

Completed locally: deterministic regression failed before the patch and passed after it; all
82 unit/process and 5 browser checks passed, parent brand/workspace checks passed and independent
review found no remaining blocker. Exact observations are in the matching phase context.
