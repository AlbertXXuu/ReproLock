# AlvenX brand contract

ReproLock consumes the owner-approved AlvenX brand revision **2026-08-24.1** and interface
revision **2026-08-25.2**. The canonical sources remain in `AlvenX/foundation/brand`:
`brand-tokens.json`, `assets/README.md`, `interface/alvenx-ui.css`, `interface/README.md` and
`INTERFACE_DESIGN_SYSTEM.md`. Read these and the parent `AGENTS.md` before changing a visual surface.

The wordmark also uses approved canvas-alignment revision **2026-09-04.1**. Only the master
translation changed to center its artwork; paths, colors, scale and the 330×100 canvas are unchanged.

`docs/assets/provenance.json` records source paths and SHA-256 of the exact controlled copies.
It is an inventory, not a second token source. Runtime, standalone export and CI use only the
committed copies. Instrument Sans and its SIL Open Font License are included. The README uses
the subtitle-free 330×100 master, centered at 320px, followed by `<br>` and the separate
`<sub>FUNCTIONAL REGRESSION EVIDENCE</sub>` line before the H1. The Demo reuses that SVG at
160px inside `.ax-product-header`.

The shared CSS controls the static four-layer background, typography, glass surfaces and header
geometry. Product CSS may arrange the case/run workflow and add visible focus/reduced-motion
behavior; it must not override approved header values or redraw the logo.

The product interface is English, consistent with the other AlvenX Demos. Keep document language,
accessible labels, controls, status/error messages, setup instructions and current screenshots
consistent. Historical reports and earlier screenshots remain original evidence, not translation inputs.

Run `pnpm brand:verify` and `pnpm check` in a standalone checkout. In AlvenX also run
`python foundation/brand/validate_brand.py` and `python operations/tools/validate_workspace.py`.
Check actual asset/font loading and browser layout at 390, 900 and 1440px, compare computed desktop
header styles against an accepted Studio, and inspect GitHub's actual README rendering.

AlvenX is a non-Git workspace. The parent already registers ReproLock's controlled assets.
`docs/brand-registration.patch` is the unchanged historical snapshot of that first registration;
its earlier README assertion is not the current contract. Do not replay the historical patch.
Later cross-project changes update the current parent tokens, release manifest and validator
directly; the parent contract and this repository's standalone check govern the current header.
