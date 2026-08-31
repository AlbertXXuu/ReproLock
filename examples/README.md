# Examples

This directory is reserved for small, runnable examples admitted after the relevant product Gate.
It intentionally contains no application in Wave 0.

## Purpose

An example demonstrates one supported user path from a clean install with inspectable inputs and
outputs. It is verification and teaching material, not proof of external adoption. A fixture built
specifically for ReproLock must always be labelled as a fixture.

Potential examples, after acceptance by the owning phase, are:

- `demo-app/` for the deterministic core's Bug/Fix differential path; and
- `github-demo/` for the least-privilege GitHub Action installation path.

These names are candidates, not instructions to create empty directories.

## Admission criteria

Each example must:

- map to a current charter criterion or accepted architecture path;
- run from documented fresh-install commands;
- use deterministic local data and an explicit reset;
- contain no real credentials, production endpoints, or irreversible account actions;
- expose the expected oracle and failure classification;
- include an executable test and package/installation smoke path;
- state which capability is fixture-specific; and
- remain small enough for a new contributor to understand and remove.

A real external case study stays in the external project's own repository or an explicitly scoped
case-study area. It must not be redesigned to make ReproLock appear successful, and an internally
owned demo is never counted as an adopter.

Examples do not add dashboards, marketing surfaces, provider SDKs, or alternate product runtimes.
