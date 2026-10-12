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

## TT-42: First separate owned app, real DOM measurement

TT-41 ran Chromium against ThinkTank's own React interface while its comparison inputs were synthesized. TT-42 goes one rung further: it exercises **a separate application owned by this repository**, a deliberately small HTML counter at `tests/fixtures/observatory-owned-counter.html`.

The new `scripts/run-owned-browser-probe.mjs`:

- Serves **only** that checked-in HTML file, with strict CSP, on an operating-system-assigned `127.0.0.1` port. It accepts no target URL arguments, directories, executable file names, user filesystem paths, or externally hosted targets.
- Validates an exact, versioned and bounded `observatory-owned-counter.contract.json` with only one allowed target, one allowed fixture path and one permitted action: click the owned `advance` button. DOM selectors are restricted to data-testid values, not arbitrary CSS or script evaluation.
- Launches the same pinned Playwright Chromium installed for the existing browser preview check. All requests except GET for the exact loopback fixture URL are blocked. The test fails on attempted out-of-scope requests, unexpected mutation methods, or browser exceptions.
- **Measures actual DOM text** for `ui.mode` and `ui.count` before and after clicking, asserts day/0 then night/1, then reloads and repeats to verify deterministic behavior. These observations are **not typed into a pretend capture file**.
- Only on successful assertions, produces `tt42-owned-target-receipt.json` and `tt42-owned-target.png` under ignored `artifacts/observatory/`. The receipt records measured DOM values in both rounds, the checked-out commit SHA, fixture and contract file SHA-256 hashes, Chromium version, screenshot digest, and constrained pass scope. GitHub Actions uploads `tt42-owned-app-dom-probe` for 14 days.
- Adds pure Node negative-control tests rejecting different targets, remote URLs, traversal paths, arbitrary actions, invalid selectors, duplicate keys, and malformed observations.

This is real browser test execution, **but only of that small owned fixture**. It is not yet an arbitrary owned-app adapter, a program/binary reverse engineer, a signed provenance attestation or end-to-end validation of SPV/PhiOS/PhiOffice. TT-39 remains explicitly **operator-supplied**; TT-42 does not mislabel machine-observed DOM readings as human-authored notes or automatically promote them to canonical ThinkTank evidence.

Run locally from the repository with dependencies, Playwright and Chromium installed:
`node --test scripts/owned-browser-contract.node.mjs`
`node scripts/run-owned-browser-probe.mjs`

The actual execution is covered by the PR preview workflow, and its artifact is available only after a green browser run. Existing TT-41 and earlier trust/approval boundaries remain intact. A merged PR does not establish production Pages deployment or Anti-M DONE.

## TT-43: Read-only machine receipt intake with explicit non-authentication

TT-42 generates a genuine Chromium measurement receipt when the fixed first-party counter app is exercised. TT-43 gives the ThinkTank **browser UI** a way to review that JSON file, separately from the manual operator notes introduced in TT-38 and TT-39.

In Φ Observatory, expand **TT-43 MACHINE RECEIPT REVIEW** and choose `tt42-owned-target-receipt.json` from the TT-42 GitHub Actions artifact. The browser:

- Reads only the explicit local file selection; maximum 128 KiB. The file is never uploaded, executed or sent to another origin.
- Strictly validates the exact TT-42 v1 schema with no additional fields; scope must be the checked-in counter app. Two rounds must both report day/0 then night/1. Unexpected keys, changed expected values, false claims of network isolation, release authority, signature or canonical evidence are rejected.
- Displays the **reported** before/after DOM measurements and claimed commit, labeled *STRUCTURALLY CONSISTENT · NOT AUTHENTICATED*. This is a format/consistency validation, **not** independent proof that the app actually ran or that the uploader owns it.
- Optionally accepts the associated `tt42-owned-target.png` (maximum 3 MiB) and checks its actual PNG signature and SHA-256 against the digest declared inside the selected JSON. A matching digest confirms byte correspondence, not source authenticity. A mismatched screenshot is refused.
- Exports a distinct `thinktank.owned-receipt-review.v1` JSON with `originAuthenticated:false`, `testExecutionAuthenticated:false`, `evidenceVerified:false`, `releaseAuthorized:false`, `antiMDone:false`. Uploaded files and review output remain outside the canonical ThinkTank event/evidence/release ledger.

CI now runs the TT-42 owned-app Chromium probe **before** the ThinkTank preview browser check. The preview test then loads those actually generated files through the new UI, verifies displayed values and matching PNG hash, exports the unauthenticated review, and injects a forged `releaseAuthorized:true` file to confirm fail-closed rejection. This proves the React UI works and handles the exact artifacts produced in that CI run, while still not authenticating an arbitrary user-supplied copy later.

No new dependencies, external network permissions, code reuse, or provider execution. Running `node scripts/check-pages-preview.mjs` locally without `TT43_REQUIRE_RECEIPT=1` keeps the historical preview behavior; CI sets that environment gate explicitly and fails if the real TT-42 files are missing.

Next development should consider cryptographically authenticated producer-to-reviewer transfer before treating an imported receipt as machine-verified evidence. Even that would not grant release or Anti-M DONE without explicit human authority.

## TT-44: GitHub OIDC-issued producer authenticity on reviewed main

TT-43 deliberately reports imported TT-42 receipt JSON as **structurally consistent, unauthenticated**. TT-44 adds a separate **producer-side, GitHub-hosted cryptographic attestation** instead of pretending a JSON file or locally calculated hash authenticates itself.

The new `.github/workflows/thinktank-owned-receipt-provenance.yml` is **restricted to pushes and manual dispatch on `refs/heads/main`**. Pull requests cannot mint a trusted-main credential under this workflow. After checking out the merged commit it:

1. Re-runs the fixed first-party counter fixture in headless Chromium with no remote target or model bridge. It emits the real `tt42-owned-target-receipt.json` and `tt42-owned-target.png` files.
2. Uses `actions/attest@v4` with GitHub Actions OIDC (`id-token:write`) to generate a Sigstore/SLSA provenance attestation for the **exact bytes of both files**. No static signing key or GitHub repository secret is needed.
3. Runs `node scripts/verify-tt44-main-provenance.mjs`, which invokes `gh attestation verify` on **both original files**. Verification is pinned to the repository `MichaelWave369/think-tank`, signer workflow `MichaelWave369/think-tank/.github/workflows/thinktank-owned-receipt-provenance.yml`, source ref `refs/heads/main`, and actual GitHub commit SHA. It requires runner-hosted provenance and CLI success, and refuses wrong image digests or a receipt referring to a different commit. An absent or invalid signature makes the trusted-main run fail closed.
4. Only following successful verification writes `tt44-verification-summary.json` and uploads the PNG, JSON receipt, and summary under `tt44-main-oidc-attested-owned-fixture` (14-day Actions artifact retention).

Verify a downloaded original file yourself from a trusted shell with the current GitHub CLI:

```bash
gh attestation verify artifacts/observatory/tt42-owned-target-receipt.json \
  --repo MichaelWave369/think-tank \
  --signer-workflow MichaelWave369/think-tank/.github/workflows/thinktank-owned-receipt-provenance.yml \
  --source-ref refs/heads/main \
  --source-digest YOUR_VERIFIED_MAIN_COMMIT_SHA \
  --deny-self-hosted-runners
```

Repeat for the PNG file. Validate its byte SHA-256 against the JSON receipt, too. Never use the receipt's untrusted `checkedOutCommit` **alone** as the expected source SHA. Pin it to an independently obtained merged commit or trusted workflow run.

**Important boundaries:** A successful GitHub CLI verification authenticates the provenance claim for these exact file bytes and GitHub workflow identity; it does **not** prove the browser fixture is bug-free or that a different application was tested. The machine-readable TT-44 verification summary is **not itself cryptographically signed** and is not a substitute for independent verification. The TT-43 browser receipt viewer continues to say **UNAUTHENTICATED**, because an arbitrary browser file-picker JSON input cannot validate Sigstore signatures on its own. This rung adds no generic web browsing, binary reverse engineering, AI execution, canonical ledger authority, release permission or Anti-M DONE.

PR verification tests only the hardcoded identity/digest policy. An actual GitHub OIDC attestation **cannot be considered tested until this is merged and the separate main-branch workflow succeeds**. If GitHub Actions attestation permissions or services are unavailable, the workflow must fail and no authenticated result should be claimed.

## TT-45: Separate read-only consumer of main-branch provenance

TT-44 has a successful *producer-side* GitHub Actions OIDC/Sigstore attestation on reviewed main. TT-45 adds an **independent read-only GitHub Actions workflow** (`thinktank-independent-provenance-consumer.yml`) that starts after the `thinktank-owned-receipt-oidc-provenance` workflow completes successfully on `main`. It has only `contents:read` and `actions:read` permissions: no `id-token:write`, `attestations:write`, signing keys, deployment rights, model calls or canonical ThinkTank ledger access.

### Checks, in order

1. Query the GitHub Actions REST metadata for the specific producer run ID from the trusted workflow-run event. Refuse any run that is not the exact repository and head repository, exact workflow name and **exact workflow file path**, successful completion, `main` head branch, expected event (`push` or `workflow_dispatch`), and a 40-digit Git commit SHA.
2. Download only the fixed `tt44-main-oidc-attested-owned-fixture` artifact from that **run ID** into a new temporary directory using the GitHub CLI. Do not accept arbitrary URLs, subject paths, scripts, selectors, external app targets, or mutable JSON as authorizing evidence.
3. Read only the two known subjects: `tt42-owned-target-receipt.json` and `tt42-owned-target.png`. Confirm both are regular files under the temporary extraction root; enforce size limits and PNG magic, expected first-party fixture behavior, zero unauthorized browser/network exceptions, the source commit matching GitHub's independent run metadata, false canonical/release flags, and exact screenshot byte digest.
4. Independently run `gh attestation verify` on **both downloaded original subject files** using the already-tested TT-44 fixed repository, signer workflow, `refs/heads/main`, producer run's verified commit SHA and hosted-runner requirement. Both the CLI's cryptographic verification and parsable, nonempty verification output must succeed.
5. Delete temporary downloaded inputs after the check. On success, export a lightweight `thinktank.tt45-independent-consumer-review.v1` JSON and upload it as `tt45-independent-provenance-consumer-review` with 14-day retention.

The consumer's success makes a *narrow* claim: an independently run verifier authenticated the exact first-party counter-fixture file bytes and their GitHub producer workflow source, then checked the expected DOM observation statements. It does **not** establish that the counter example proves other products correct. The exported review is unsigned and should not be treated as cryptographic proof by anyone who hasn't independently verified the original attestation.

No new third-party runtime dependencies and no alteration of TT-43's **UNAUTHENTICATED** browser file-review label. A future UI provenance upgrade must incorporate its own trusted verification evidence, not accept the TT-45 JSON summary as a transferable self-authenticating seal.

### Staging / verification distinction

PR CI runs only independent policy and negative-control tests and parses the CLI program. It **cannot** claim that the separate consumer has verified a newly issued producer run. The TT-44 producer workflow is configured to rerun on TT-45's merged workflow/source changes. After human merge, require a successful **new producer run and independent TT-45 consumer run** on that merge before marking this rung green.

**Governance remains unchanged:** no release authorization, Reality Gate evidence promotion, canonical ThinkTank ledger mutation, or Anti-M DONE. Host Action OIDC provenance attests the GitHub workflow and file bytes, not the scientific correctness or trustworthiness of unrelated external inputs.

## TT-46: Live adversarial proof checks, not only positive attestations

TT-44's producer and TT-45's independent, read-only consumer both passed on reviewed `main`. TT-46 strengthens the **independent consumer**, without adding another signer or new authority. It challenges the *actual GitHub CLI cryptographic verifier* with four intentionally invalid variants of the current run's original OIDC-attested subjects:

1. **Altered receipt bytes:** convert only the terminal LF of the real JSON receipt to a space, preserving valid JSON but changing the exact signed SHA-256 digest.
2. **Altered PNG bytes:** flip one bit of a temporary copy of the real image while preserving its PNG signature.
3. **Incorrect source commit:** test the *untouched original receipt* with an intentionally different 40-character Git SHA.
4. **Incorrect signing workflow:** test the *untouched original receipt* while claiming the unrelated `MichaelWave369/think-tank/.github/workflows/ci.yml` signer.

All challenges use `gh attestation verify` with the fixed repository/main identity policy. **Each must be rejected**. A variant that verifies successfully makes the independent consumer job fail immediately. Process crashes, timeouts or missing CLI are not counted as successful rejections. After the four rejections, the consumer **re-verifies the two unmodified original subjects** and requires both the real GitHub CLI exit success and a nonempty verified output. This reduces the risk of treating broken network/authentication infrastructure as an effective tamper-detection check.

Tampered files are created only in an isolated temporary directory and are deleted in `finally`; the attested originals remain unchanged. TT-46 runs only in a GitHub Actions consumer with `actions:read`/`contents:read` permissions, without signing keys or OIDC write permission.

On success, TT-45's existing unsigned report remains, and the workflow separately uploads an additional **unsigned, review-only** `tt46-adversarial-attestation-challenges` JSON report. It records the four rejection labels, their mutated/original byte digests, both subsequent successful positive checks, the independently obtained producer commit and run ID, and explicit `releaseAuthorized:false`/`antiMDone:false`. This JSON is not a transferable cryptographic credential and must not be ingested by TT-43 as self-verifying source authority.

### Acceptance boundaries

PR CI executes deterministic test cases for all four challenge argument contracts, expected process exit handling, mutation logic, and policy parsing. **The actual negative `gh attestation verify` calls happen only in the trusted second workflow after merge.** We intentionally do not report TT-46's real cryptographic challenge coverage as green merely because the PR unit tests pass.

The producer workflow's main-path trigger is updated so merging TT-46 re-runs TT-44 issuance and TT-45/TT-46 consumer testing against that new reviewed commit. No external apps or binaries are probed. Release authorization, canonical event ledger, Reality Gate and Anti-M DONE remain unchanged.

## TT-47: Portable Sigstore evidence for offline-capable, independently pinned verification

The trusted TT-44 producer, independent TT-45 consumer, and all six real TT-46 cryptographic challenges have passed on reviewed main. TT-47 packages the **original** attested first-party counter-app JSON and PNG alongside the two associated GitHub attestation bundles and a fresh Sigstore trusted root, so an operator can independently verify the signed workflow identity without fetching attestations from the GitHub API during that local verification.

Official references: [GitHub verifying attestations offline](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline), [GitHub CLI download](https://cli.github.com/manual/gh_attestation_download), and [GitHub CLI verify](https://cli.github.com/manual/gh_attestation_verify).

### Producer and independent consumer

- TT-44's main-only GitHub Actions workflow still produces the actual source files and OIDC signatures. TT-45 still downloads the exact producer artifact and verifies the genuine original subjects. TT-46 still rejects four altered/misattributed variants and re-verifies both untouched subjects.
- TT-47 then downloads the two `gh attestation download` JSONL bundles, obtains a current `gh attestation trusted-root` file, and produces `artifacts/observatory/tt47-portable/` with the original receipt, original PNG, receipt attestation JSONL, PNG attestation JSONL, `trusted-root.jsonl`, and an **unsigned manifest** with the SHA-256 of each component.
- The separate read-only consumer verifies both original subjects again using `gh attestation verify --bundle <LOCAL_JSONL> --custom-trusted-root <LOCAL_ROOT>`, pinned to exact repository, trusted signer workflow, main branch and **independently obtained producer main commit SHA**. Its CLI process receives no GitHub authentication token; the GitHub API is not needed to look up signatures for these local checks.
- Only on success does GitHub Actions upload the portable directory under `tt47-portable-offline-verification-proof` (14-day retention). The output is not an executable installer, local model service, generic web crawler or software disassembler.

### How to inspect a downloaded TT-47 bundle

Extract the GitHub Actions `tt47-portable-offline-verification-proof` ZIP into a local folder, without modifying file bytes. Install the GitHub CLI and use a trusted checkout of the ThinkTank repository with Node.js. Obtain the expected **40-character main commit SHA independently** from the associated trusted GitHub producer workflow or reviewed merge, not solely from the editable manifest.

```bash
node scripts/verify-tt47-portable-proof.mjs ./unpacked-proof YOUR_TRUSTED_MAIN_COMMIT_SHA
```

The command enforces a six-file allowlist, maximum file sizes, receipt-to-screenshot hash match, manifest byte digests, fixed owned-fixture observations and scope, and both Sigstore verifications using the locally provided bundle and trusted root. It fails closed if input bytes, roots, workflow identity, or SHA expectations disagree. Downloading a ZIP or seeing a positive JSON manifest is **not itself** the verification.

**Offline boundary:** GitHub's documented `--bundle` plus `--custom-trusted-root` verifier supports local verification without API access; this initial CI run executes on a networked GitHub runner with credentials excluded from the verification subprocess. Consequently we should describe this as *offline-capable verification tested with local proof materials*, not claim that a physically network-isolated computer has been tested. A real disconnected-machine check is a separate future acceptance gate.

**Governance:** The SHA-256 manifest and local verifier's output are unsigned explanatory records. Trust comes from locally verifying the actual Sigstore bundles with trusted root, identity and independently pinned source SHA, not from those editable JSON labels. Root freshness and revocation status still matter and may need refreshing when verification moves to a disconnected device. The signed subjects cover only the small checked-in owned counter application, not unrelated programs. No Third-party app testing, source-code transfer, canonical ThinkTank evidence promotion, Reality Gate or Anti-M DONE.

## TT-48: Network-isolated verification with independently pinned Sigstore root

TT-47 builds a portable artifact with the original signed receipt, screenshot, two attestation bundles, and a trusted-root file. Importantly, that trusted-root file is **part of the editable package**; its manifest hash alone is **not** a sufficient independently anchored trust claim.

TT-48 tightens the consumer gate in two ways:

1. **Out-of-band trust-root pin:** After the trusted TT-44 producer and independent TT-45/46/47 checks, the consumer runs `gh attestation trusted-root` **separately** on the GitHub Actions host and SHA-256 hashes those returned bytes. The trusted-root fingerprint is passed into the isolated verifier through the verified job's own environment, **not read from the portable package manifest**. The isolated verifier fails if the packaged root bytes do not match this separately obtained pin. Future replay on another machine must independently retrieve and pin the trusted root or use a previously authenticated trusted-root snapshot. Sigstore root rotation or expired trust material can require updated, independently obtained pins.
2. **Real disabled-network container:** CI tests the environment with `docker run --network none` against the Node 24 Debian container using the system's GitHub CLI binary mounted read-only. The sandbox has no network interface other than loopback, no Linux capabilities, a read-only filesystem, a writable private `/tmp`, and a read-only checkout and proof mount. The verifier checks network interfaces and deliberately attempts a direct outbound IP connection, requiring a genuine routing-disabled failure. A timeout, DNS failure, or connection refusal is **not** accepted as conclusive isolation. It then checks the external trust-root SHA-256 pin and **cryptographically verifies both original subjects** using local Sigstore bundles and root, with no `GH_TOKEN` or `GITHUB_TOKEN`.

Once TT-48 is merged, the existing main-only trusted producer path triggers a fresh run, then the read-only TT-45 consumer generates and checks the complete TT-47 proof. The new workflow step retrieves the independent trust-root fingerprint and runs the network-disconnected verifier. Only after success is a scoped `tt48-isolated-pinned-root-verification` log artifact uploaded. This proof does **not** grant canonical ThinkTank evidence promotion, third-party target access, release approval, or Anti-M DONE.

The PR CI can prove Docker `--network none` is actually working and mounted `gh` can run, plus exercise fail-closed trust-pin logic. The **cryptographic** TT-48 gate only runs with genuine post-merge producer attestations, so do not claim full TT-48 until that second-stage action is green.

**Scope/limits:** Docker's network-disabled namespace on GitHub's hosted runner is a real blocked-network test, **not** a physically air-gapped machine. The root retrieved from GitHub's CLI is independently sourced relative to the portable package but remains subject to the usual root distribution and freshness assumptions. The manifest, CI transcript, and machine-written reports remain unsigned assertions unless original Sigstore bundles are verified against authenticated root material.

## TT-49: Adversarial challenges *within* the isolated proof verifier

The TT-48 main-branch consumer passed its actual Docker `--network none` check, independent trusted-root fingerprint comparison, and two locally supplied Sigstore bundle verifications for the original owned-counter fixture. TT-49 requires that **the same network-isolated verifier reject deliberately counterfeit portable materials**, not merely authenticate the real inputs.

The new `tt49-offline-adversarial.mjs` operates only inside Docker's disabled-network namespace. It validates loopback-only networking, confirms direct IP egress fails with a routing error, checks the independent root pin and **cryptographically verifies both unmodified original subjects first**. It then copies the six-file TT-47 package to temporary private directories (never modifying the read-only originals) and performs five challenges:

1. **Mutated JSON receipt:** change only the final line-feed into a space, leaving well-formed JSON. Recalculate the **unsigned manifest's** receipt SHA-256 so that a weak hash-only check would accept it; the actual local Sigstore verification **must** reject the modified signed bytes.
2. **Swapped attestation bundle:** place the PNG's genuine bundle in the receipt's bundle slot, then rewrite the **unsigned manifest's** bundle digest. The CLI must refuse verification of the mismatched subject and attestation.
3. **Substituted trusted root:** change root bytes and rewrite the **unsigned manifest's** matching digest. The independently obtained external root pin **must** refuse the substitution.
4. **Wrong out-of-band commit:** supply a different, well-formed commit SHA from outside the manifest. The receipt-to-source-commit binding **must** reject it.
5. **Forged unsigned authority:** change `releaseAuthorized` to `true` in the portable manifest. The strict schema/authority policy must refuse the claim.

After **all five** negative checks, TT-49 cryptographically verifies the untouched original signed receipt and screenshot **again**, still with no network access. The required order (authentic proof PASS, five counterfeits REFUSED, authentic proof PASS) prevents a broken reject-everything verifier from appearing trustworthy. CLI crashes, missing executables, and obvious network errors cannot be counted as signature rejection.

The consumer job uploads `tt49-offline-adversarial-signature-checks`, containing the bounded unsigned transcript. This proves only that the isolated verification workflow exercised these fixed known cases and generated the stated result. Do not treat the transcript as a transferable signature, and do not transfer its assertions into the canonical evidence ledger, release status or Anti-M DONE. As with TT-48, this is a network-disabled GitHub-hosted container, not a physically air-gapped independently owned computer.

PR CI covers policy tests and counterexample generation using test doubles. **The live signed-subject cryptographic challenges remain unverified until this PR is merged, TT-44 regenerates attested originals, and the independent TT-45/46/47/48/49 workflow succeeds.**

## TT-49 gate failure and TT-50 exact signed-subject repair

The first real TT-49 post-merge consumer run **FAILED**, despite passing normal PR CI. The trusted main producer and all earlier independent checks through the TT-48 network-isolated proof passed, but TT-49's initial tampered-receipt case returned no correctly classified verifier error. **Do not label TT-49 successful or advance its evidence authority.**

The root issue is the structure of GitHub's downloadable Sigstore attestations: a single in-toto SLSA statement can contain **both** the original JSON receipt and PNG as signed subjects, while `gh attestation download` may return multiple JSONL bundles for earlier runs when identical PNG bytes are reused. The real checked-in screenshot attestation JSONL contained six statements spanning different reviewed commits. Swapping the entire receipt bundle with the screenshot bundle was therefore **not a valid universally rejected forgery**. Equally, simply recalculating the hash inside our unsigned JSON manifest cannot substitute for comparing the actual artifact SHA-256 to the digest asserted in the signed DSSE in-toto statement.

TT-50 corrects both assumptions:

1. `subjectScopedAttestationBundle` parses bounded, read-only untrusted DSSE JSONL statements and **selects only unmodified statements** whose subject name and SHA-256 match the actual downloaded original bytes. It also requires the expected, *independently supplied* reviewed source commit and the exact first-party GitHub Actions builder workflow identity inside the statement. If no statement matches, reject **before** claiming signature validity.
2. Only the selected, byte-identical signed JSONL lines are passed to `gh attestation verify` with the established fixed repo, workflow, main branch and exact source SHA plus locally pinned trusted root. The parser does not verify signatures itself, and cannot promote metadata into trust without a successful CLI cryptographic check. A screenshot bundle containing historical valid statements is filtered to the expected commit, not treated as a generic all-purpose certificate.
3. TT-49's first negative case now deliberately rewrites its unsigned manifest to match the changed-but-valid JSON receipt, and expects an **exact signed-subject digest mismatch**. The second case corrupts the actual DSSE signature in a copied receipt bundle, again recomputing the unsigned manifest hash, and requires the real GitHub CLI cryptographic verifier to refuse it. We no longer pretend that exchanging two bundles containing the **same valid signed statement** is a forgery.
4. Remaining negative controls independently reject changed root bytes (external root pin), wrong source commit and forged unsigned release authorization. Two complete verifications of the original proof must pass, one before and one after all negative controls. All challenges happen in the same Docker `--network none` environment.
5. Deterministic CI tests reproduce multi-attestation cases with different commits, shared screenshot digests, altered JSON, incorrect signer, corrupted DSSE signatures and false release claims. The producer's reviewed-main path triggers include TT-50 fixes so a **new post-merge OIDC run and independent consumer run are mandatory**.

**Validation policy:** Until TT-50 is merged and the new independent consumer completes with two authentic subject verifications plus all five corrected negative controls, TT-49/TT-50 are **HELD**. Earlier successful TT-44 to TT-48 results remain true for their original exact files and workflows, but are not proof that TT-49 passed. No release authorization, canonical ledger evidence promotion, or Anti-M DONE is granted. 

## TT-50 post-merge resolution and TT-51 operator proof verification

TT-50 repair was merged at `ade3d4013fc83aa817003ecaaa1a8d3d01716bb3`. The independent GitHub Actions consumer completed successfully on [run 38204692731](https://github.com/MichaelWave369/think-tank/actions/runs/38204692731), with TT-49's five actual offline adversarial cases refused and two full original-proof positive rounds verified. This resolves the TT-49-held issue; it does not authorize a release or canonical evidence promotion.

TT-51 makes local verification practical for operators on Windows, Linux, and macOS without requiring them to run the CI Docker workflow. This does **not** weaken the root/commit trust policy or claim the operator's machine is physically isolated.

### Procedure

1. Obtain a TT-47 portable proof artifact ZIP from the **trusted independent consumer Actions workflow** of the first-party ThinkTank repository. Unzip the six files together into a folder `unpacked-proof` in your trusted ThinkTank checkout.
2. Independently confirm the **reviewed `main` source commit** from GitHub's producer run metadata and obtain the **Sigstore trusted root hash** from independently retrieved root bytes, not merely the editable archive manifest. For example, on a trusted online host run `gh attestation trusted-root > independent-trusted-root.jsonl`, and hash that file with your OS SHA-256 tool. Root rotation can make previously captured hashes obsolete.
3. Install Node.js and GitHub CLI with its `attestation verify` subcommand. On Windows PowerShell:

```powershell
node scripts/verify-tt51-operator-proof.mjs .\unpacked-proof INDEPENDENT_40_CHAR_MAIN_SHA INDEPENDENT_64_CHAR_ROOT_SHA256
```

On Linux/macOS bash:

```bash
node scripts/verify-tt51-operator-proof.mjs ./unpacked-proof INDEPENDENT_40_CHAR_MAIN_SHA INDEPENDENT_64_CHAR_ROOT_SHA256
```

4. The checker refuses malformed source/root pins, missing or symlinked root material, or a packaged trusted-root byte digest inconsistent with the **independent SHA**. It then invokes TT-47/TT-50 verification on both original subject bytes using locally supplied Sigstore bundles, the pinned workflow identity, `main` source commit and trusted root. The GitHub CLI's cryptographic signature verification is required to complete.
5. The exported JSON is a strictly scoped, **unsigned** explanation. It never modifies ledger events, releases or Anti-M DONE. A successful local CLI establishes signer/subject provenance under the selected trust assumptions; it does not test an unrelated app or establish that the operator's machine was physically network-isolated.

The Software Behavior Lab includes the **TT-51 portable proof operator guide**. It accepts only exact lower-case hexadecimal commit/root values and optionally a decimal GitHub Actions run ID for **navigation**, then prepares Windows PowerShell or bash command text. It does not upload files, call GitHub APIs, execute a local command, check signature status inside the browser, or import its outcome as canonical evidence.

The PR acceptance requires normal full CI, Node tests of the local CLI's independent trust-pin policy, and a **real Chromium run** that exercises the React command guide and rejects forged/invalid input. This is distinct from executing a copy of the portable proof on a physical Windows computer; that separate operator acceptance remains a future real-device test.
