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

## TT-39: Browser-local capture comparison

Each manual study can select an existing trace and download an operator-editable, strictly scoped `thinktank.behavior-capture.v1` JSON template. Populate observation key/value pairs by manually examining software you own or are permitted to study, then select a baseline and candidate file using two explicit browser file pickers.

- No filesystem traversal or background scanning. Only selected files are read using browser `File.text()`; no target app network calls.
- Files must be JSON, max 64 KiB. The validator requires exact fields, bounded observation keys/values, no duplicate keys, false `sourceVerified`, `testExecuted` and `executionAuthority`.
- Files must match the selected study ID, trace ID and exact target string. Mismatches are rejected.
- A pure comparator reports `UNCHANGED`, `CHANGED`, `ADDED` or `MISSING` per key. A changed value is **not** by itself an acceptance-test failure; an unchanged value is **not** a pass.
- Browser Web Crypto computes SHA-256 over each selected file's exact UTF-8 text. Digests support byte identification only and do not verify who made the capture, whether observations were accurate, or whether access was authorized.
- Selected contents live in transient React state; no capture contents are stored in `localStorage`. Export of the comparison is operator-triggered and produces a mutable, unsigned, review-only JSON report.
- No execution, package import, browser automation, binary scanning, decompilation, provider calls, evidence promotion, canonical event mutation, release permission or Anti-M DONE.

**How to try:** Create an owned-software behavior study and trace, pick that trace under TT-39, download the template twice, modify the `observations` values in the two copies, and select them as baseline and candidate. The app compares only the entries supplied. Never put secrets or private customer data in captures intended to be shared.

**Review gates:** `npm test`, `npm run bridge:check`, `npm run bridge:test`, `npm run build`, `npm run pages:build`, `npm run pages:check`, and GitHub Pages preview Chromium smoke. A separate post-merge Pages deployment smoke establishes public availability.

## TT-40: Capture-only expectation review

TT-40 adds a narrow, deterministic expectation evaluator to the already manual TT-38/TT-39 workflow. After selecting baseline and candidate JSON for an existing trace, create zero or more **operator-authored** rules against the candidate's captured keys.

- `equals`: captured string must exactly equal the operator's expected string.
- `differs`: captured string must differ from the operator's expected string.
- `present`: the named observation key must exist.
- `absent`: the named observation key must not exist.

No regular expressions, shell commands, JavaScript, dynamic property reads, executable predicates, numeric coercion, network calls, or installed dependencies. A rule can report `AGREES_WITH_RULE`, `CONTRADICTS_RULE`, or `NOT_CAPTURED`. These describe **only operator-supplied capture values**, never app test results. `NOT_CAPTURED` is distinct from agreement and disagreement. Absence rules agree only when the key is absent from the supplied capture. Rules are validated, bounded to 32 per plan, and kept in browser memory until the candidate selection changes.

An explicit export produces an unsigned JSON review with the chosen candidate's file-byte SHA-256 hash and the canonical non-authority flags `testsPassed:false`, `evidenceVerified:false`, and `executionAuthority:false`. The exported evaluation is re-computed from the validated candidate capture at export time, not accepted from a caller's report. No rule or report is promoted to ThinkTank's evidence ledger, Reality Gate, release authority, or Anti-M DONE.

**Example:** For your owned prototype, record one TT-38 trace. Select that trace in TT-39, capture a candidate JSON with `ui.mode=night`, and author `ui.mode equals night`. The screen may report `AGREES_WITH_RULE`, but that is not proof that any target software was exercised.

Merge gates: unit and kernel tests, TypeScript/React build, Pages packaging checks, and Chromium preview. Post-merge production deployment and browser smoke remain separate checks.

## TT-41: Reproducible first-party Chromium workflow receipt

TT-41 adds a **real browser execution test for ThinkTank itself** to the existing `thinktank-pages-preview-browser` workflow. This is not a general-purpose program runner or reverse-engineering engine.

The CI test checks out the actual pull-request merge candidate, builds the production-path Vite assets, and runs Chromium against the loopback-only `/think-tank/` preview. It interacts with the rendered Φ Observatory using the same UI controls as a person would:

1. Create a temporary owned-software study and trace with test-only text.
2. Download the application's own capture JSON template; assert its non-authority schema flags.
3. Upload two synthetic JSON observations via the browser's file inputs and assert all four comparison categories.
4. Add operator-style expectation rules; assert agreement, contradiction and missing-capture distinctions.
5. Download the resulting review report and assert its SHA-256 input hash, count totals, and explicit `testsPassed:false`, `evidenceVerified:false`, `executionAuthority:false` flags.
6. Preserve the existing browser smoke's no-local-bridge/no-mutation-request/no-runtime-exception checks across this extended flow.

**CI-generated evidence:** only after all browser assertions pass, the test writes `artifacts/observatory/tt41-owned-ui-receipt.json` and `tt41-owned-ui.png`. The workflow uploads them as an Actions artifact with 14-day retention. The receipt includes exact checked-out commit, test run time, fixture input file hashes, asserted counts, and screenshot digest. It is not signed or a canonical ThinkTank evidence artifact; SHA-256 alone does not authenticate the runner or the observations.

The `TEST_ASSERTIONS_PASSED` outcome is accurate *only for the listed first-party browser-test assertions*. No external application or binary was accessed. The baseline and candidate data are test fixtures created by the test script, **not measured output from an independent target application**. The event kernel, Reality Gate, release authorization and Anti-M DONE remain unaffected.

Run locally only inside the owned repository with an installed Playwright Chromium runner (the existing preview workflow pins `playwright@1.56.1`): `npm run pages:build`, `npm run pages:check`, and `node scripts/check-pages-preview.mjs`. The script starts and stops a loopback Vite preview and does not start a model bridge. Never include secrets, customer records, or private operational data in browser fixtures or downloadable CI artifacts.

Merging a PR does not prove public deployment. Verify `thinktank-pages` and the separate deployed-browser smoke before claiming the public site is updated.
