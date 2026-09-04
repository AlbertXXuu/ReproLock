# AlvenX brand contract

ReproLock consumes the owner-approved AlvenX brand revision **2026-08-24.1** and interface
revision **2026-08-25.2**. The canonical sources remain in `AlvenX/foundation/brand`:
`brand-tokens.json`, `assets/README.md`, `interface/alvenx-ui.css`, `interface/README.md` and
`INTERFACE_DESIGN_SYSTEM.md`. Read these and the parent `AGENTS.md` before changing a visual surface.

`docs/assets/provenance.json` records source paths and SHA-256 of the exact controlled copies.
It is an inventory, not a second token source. Runtime, standalone export and CI use only the
committed copies. Instrument Sans and its SIL Open Font License are included. The README uses
the subtitle-free 330×100 master, centered at 320px before the H1. The Demo reuses that SVG at
160px inside `.ax-product-header`; do not map ReproLock into the older 430×150 subtitle lockups.

The shared CSS controls the static four-layer background, typography, glass surfaces and header
geometry. Product CSS may arrange the case/run workflow and add visible focus/reduced-motion
behavior; it must not override approved header values or redraw the logo.

Run `pnpm brand:verify` and `pnpm check` in a standalone checkout. In AlvenX also run
`python foundation/brand/validate_brand.py` and `python operations/tools/validate_workspace.py`.
Check actual asset/font loading and browser layout at 390, 900 and 1440px, compare computed desktop
header styles against an accepted Studio, and inspect GitHub's actual README rendering.

AlvenX is a non-Git workspace. The registration-only companion patch records the shared consumer
and validator changes; it does not regenerate or alter published product/website assets.
