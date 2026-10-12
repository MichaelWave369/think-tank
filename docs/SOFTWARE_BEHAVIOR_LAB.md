# TT-38: Software Behavior Lab

A first-party, manual, review-only software behavior investigation workspace for Φ ThinkTank. It supports independently designing our own software based on authorized observation, not copying third-party code.

## Investigation method

INSPECT → TRACE → ABSTRACT → DESIGN → TEST.

- Identify a target, scope and operator-reported access basis (owned, explicitly permitted, or publicly observable interface).
- Describe starting state, action, resulting state, and possible interpretation.
- Keep observed, documented and hypothetical claims distinct. All entries remain unverified operator notes.
- Write an independent design and proposed acceptance test for each trace.
- Export reviewable structured JSON and a draft acceptance checklist, without executing either.

## Guardrails

No automatic crawling, binaries, decompilation, app/network access, model invocation, copied code, or premium access bypass. Public interface visibility alone does not grant permission for deeper inspection. No imported dependencies.

The lab uses only browser-local storage. This is not a signed or tamper-evident ledger. No entries may grant approval, affect the Reality Gate, canonical event kernel, Vessie release, or Anti-M DONE. Access assertions, observations and test plans are NOT independently validated.

## Acceptance

Run npm test, npm run build, npm run pages:build, npm run pages:check. GitHub Pages deployment and browser smoke are separate gates. No pass state is claimed just because a draft exists.
