# Synthesis Decision Dossier

PR 17 packages the complete normal synthesis basis into one deterministic, replayable receipt.

## Core law

**DOSSIER ≠ NEW AUTHORITY.**

The dossier does not:
- increase Reality Gate score
- satisfy Claim Policy
- satisfy Argument Policy
- make a claim true
- make a provider output trustworthy
- authorize an override

It records why the existing normal decision existed.

## Normal dossier

Every normal synthesis resolution creates one immutable SynthesisDecisionDossier.

The dossier stores:

- dossier id
- session id
- seed
- decision sequence
- mode
- operator prompt
- normal outcome: completed or withheld
- output label
- normal action authority
- Reality Gate score
- Reality Gate threshold
- full Gate breakdown
- deterministic ClaimGovernanceReport
- deterministic ArgumentGovernanceReport
- objection count
- fault code
- governance reason
- role-to-seat assignments
- registered claims
- claim-to-evidence bindings and relations
- evidence ids / verification / source URI / retrieval SHA-256
- research-candidate lineage ids
- exact-excerpt ids / source, projection, and excerpt SHA-256
- excerpt character offsets
- structural claim-review basis fingerprints
- provider argument-review basis fingerprints and acceptance status
- current-run provider turn provenance
- deterministic decision-basis fingerprint

The dossier intentionally does not copy entire fetched source bodies or exact excerpt text.

Canonical exact text already lives in EvidenceExcerpt state and remains referenced by id + digest.

## Deterministic fingerprint

The compact decision basis is stable-serialized and fingerprinted with the repository's existing FNV-1a 32-bit replay checksum convention.

Example:

fnv1a32:1a2b3c4d

This is a deterministic replay/basis checksum.

It is not a cryptographic signature and must not be presented as one.

## Provider turn provenance

Only provider turns from the current governed run are included.

Each provider turn records:

- event sequence
- role
- seat
- provider model
- provider request id when available

Old provider turns from earlier runs in the same ledger are not mixed into the new dossier.

## Kernel law

For synthesis.completed and synthesis.withheld:

1. kernel recomputes Claim Policy
2. kernel recomputes Argument Policy
3. kernel recomputes the scheduler decision
4. event governance reason must match that decision
5. event must contain a decision dossier
6. kernel independently rebuilds the dossier
7. supplied dossier must exactly match deterministic recomputation

A forged basis fingerprint, changed policy receipt, changed action state, changed provider-turn basis, or changed governance reason invalidates the event.

## Automatic minting

The event builder automatically mints the dossier for normal synthesis events.

LIVE and SIM callers do not manually construct it.

This avoids a path where a caller can accidentally omit the receipt.

## Historical storage

ThinkTankState stores decisionDossiers as historical receipts.

Mode changes, evidence mutations, later reviews, and new runs do not delete or rewrite old dossiers.

A dossier explains the basis used by its own decision sequence.

## Human override

FORCE SYNTHESIS never edits the normal dossier.

Instead the operator event creates a separate DecisionOverrideReceipt containing:

- override id
- referenced dossier id
- override event sequence
- resulting output label
- actionAllowed: true
- operator override reason

Example:

DOS-0042
NORMAL OUTCOME: WITHHELD

OVR-0043
OPERATOR OVERRIDE → DOS-0042

The original dossier remains WITHHELD.

## Override law

An override:

- must be operator-originated
- must be explicit
- requires a prior withheld decision dossier
- must reference the latest withheld dossier
- may occur only once for that dossier
- is replayable
- cannot attach to a normally completed dossier

The kernel recomputes the expected override receipt before accepting the event.

## UI

The Decision Dossier panel exposes:

- dossier id / decision sequence
- mode
- basis fingerprint
- normal outcome
- output label
- normal action authority
- Reality Gate
- Claim Policy
- Argument Policy
- objection count
- fault state
- claim / binding / evidence / excerpt counts
- structural review count
- argument-map count
- provider-turn count
- normal governance reason
- current-run provider provenance
- linked human override if present

TEAR / EXPORT DOSSIER exports JSON containing:

- dossier
- linked override or null

## Ledger

Synthesis lines display their DOS id.

Override lines display:

OVR-id → DOS-id

The text ledger export includes the receipt id as well.

## Historical truth

A room may correctly show:

- old DOSSIER: WITHHELD
- linked OVERRIDE: ACTION AUTHORIZED
- current policies: PASS

or any other later combination.

The dossier is historical evidence of a decision process, not a live policy oracle.

## Non-goals

PR 17 does not:

- add new governance scoring
- add cryptographic signatures
- add remote attestation
- archive full web bodies
- duplicate exact excerpt text into dossiers
- merge human overrides into normal machine decisions
- change provider prompts
- change mode policy


## Optional cryptographic sealing

PR 18 can attach one or more Ed25519 DossierSealReceipt objects to a historical dossier.

The normal dossier remains unchanged.

A seal is an external cryptographic receipt over the canonical dossier content and seal metadata.

The same signer key may seal a dossier only once; different signer keys may coexist.

Verification does not require the private key.

See [CRYPTOGRAPHIC_SEALING.md](CRYPTOGRAPHIC_SEALING.md).

## Optional local transparency journal

PR 19 can append a PR 18 dossier seal to a persistent local JSONL transparency journal.

Each accepted DossierTransparencyReceipt records:
- dossier id
- seal id
- journal sequence
- previous entry SHA-256
- entry SHA-256
- dossier SHA-256
- signer-key fingerprint
- local append time
- explicit untrusted-local-clock label
- explicit tamper-evident-local-journal trust label

The exported dossier package includes linked transparency entries.

The journal does not mutate the decision dossier or the seal. It adds a later integrity receipt.

See [TRANSPARENCY_JOURNAL.md](TRANSPARENCY_JOURNAL.md).

## Portable checkpoint and witness receipts

PR 20 extends exported dossier packages with any transparency checkpoints whose journal head is linked to the dossier's transparency entries, plus matching detached witness receipts and local verification receipts.

The checkpoint/witness layer remains additive historical integrity evidence.

It does not rewrite:
- the synthesis decision
- the dossier
- the dossier seal
- the journal entry
- any human override

See [DETACHED_WITNESS.md](DETACHED_WITNESS.md).

## RFC 3161 timestamp receipts

PR 21 extends exported dossier packages with RFC 3161 timestamp receipts linked to included transparency checkpoints.

The timestamp receipt preserves:
- checkpoint linkage
- TSA generation time
- token SHA-256
- raw DER token as Base64
- policy OID / serial / TSA subject
- authority URL
- configured trust-anchor file SHA-256
- local verification time

This is time-attestation evidence, not a change to the synthesis decision or governance result.

See [RFC3161_TIMESTAMP.md](RFC3161_TIMESTAMP.md).

## Verified external checkpoint publication receipts

PR 22 extends exported dossier packages with verified external publication receipts linked to included transparency checkpoints.

Each receipt preserves:
- checkpoint linkage
- publisher endpoint
- external retrieval URL
- publisher-defined publication id
- publisher-claimed time
- exact stable-canonical checkpoint payload SHA-256
- retrieval status/content type
- local read-back verification time
- publication receipt SHA-256

The publisher's claimed time is not trusted time. RFC 3161 receipts remain the timestamp-attestation layer.

Publication is additive provenance evidence and does not rewrite the dossier, journal, checkpoint, witness, timestamp, governance result, or human override.

See [CHECKPOINT_PUBLICATION.md](CHECKPOINT_PUBLICATION.md).

## Provenance assurance reports

PR 23 adds deterministic post-decision provenance assurance reports linked to a historical dossier.

Available policy profiles:
- integrity
- witnessed
- time-attested
- published
- full-provenance

Reports evaluate one coherent linked checkpoint chain and record explicit MET / MISSING requirements.

A report also carries:
- deterministic provenance basis fingerprint
- selected checkpoint id
- current/historical/unavailable journal-head status
- pass/fail result
- deterministic reason
- truthAuthority: false

Reports become stale when linked provenance state changes, but stale reports are retained as historical receipts.

A historical journal head does not itself make a report stale.

These reports do not rewrite the original dossier or add synthesis authority.

TEAR / EXPORT DOSSIER includes linked `provenanceAssurances`.

See [PROVENANCE_ASSURANCE.md](PROVENANCE_ASSURANCE.md).

## Assurance-gated release manifests

PR 24 adds a separate governed release/export receipt linked to a historical dossier and one fresh passing provenance assurance report.

DossierReleaseManifest records:
- dossier id
- selected provenance policy
- assurance report id and basis fingerprint
- selected checkpoint id
- linked human override id when present
- deterministic sorted artifact ids
- deterministic manifest fingerprint
- releaseAuthority: fresh-passing-provenance-policy
- truthAuthority: false

The release manifest does not change the normal dossier outcome or human override history.

TEAR / EXPORT DOSSIER includes historical release manifests for inspection.

EXPORT RELEASE PACKAGE is the explicit assurance-gated release path and contains only the manifest plus canonical artifacts named by its artifact list.

See [ASSURANCE_GATED_RELEASE.md](ASSURANCE_GATED_RELEASE.md).

## Cryptographic release seals

PR 25 extends release and dossier exports with optional Ed25519 signatures over DossierReleaseManifest objects.

Each DossierReleaseSealReceipt preserves:
- release id and dossier id
- stable-canonical REL manifest SHA-256
- public key + SHA-256 key fingerprint
- Ed25519 signature
- signer label
- signed-at claim
- explicit untrusted-local-clock
- self-attested-local-release-key trust label

Successful independent verification produces a linked DossierReleaseSealVerificationReceipt.

Release authorization, release signing, and signature verification remain distinct historical states.

The release signature does not change the dossier outcome, assurance result, operator override, or release authority.

See [CRYPTOGRAPHIC_RELEASE_SEALING.md](CRYPTOGRAPHIC_RELEASE_SEALING.md).

## RFC 3161 release timestamp receipts

PR 26 extends release-package and dossier exports with RFC 3161 receipts linked to verified RSEAL release signatures.

Each DossierReleaseRfc3161TimestampReceipt preserves:
- release id and RSEAL id
- SHA-256 of the complete RSEAL receipt used as the message imprint
- linked REL manifest SHA-256
- linked release signer key fingerprint
- raw RFC 3161 token + token SHA-256
- TSA policy / serial / generation time / subject
- authority URL
- configured trust-anchor file SHA-256
- local verification time

The TSA generation time is trusted only within the configured RFC 3161 trust boundary. It does not identify the release signer or change release/synthesis authority.

See [RFC3161_RELEASE_TIMESTAMP.md](RFC3161_RELEASE_TIMESTAMP.md).

## Verified external release publication receipts

PR 27 adds RPUB receipts for externally published governed release packages.

DossierReleasePublicationReceipt preserves:
- REL id
- package-basis fingerprint
- REL manifest SHA-256
- full release-package SHA-256
- publisher URL + public retrieval URL
- publication id
- publisher-claimed time
- local read-back verification metadata
- exact included RSEAL / RVER / RTSA ids
- exact REL artifact ids
- receipt SHA-256

RPUB is deliberately excluded from the release package it attests, preventing recursive package mutation.

Dossier export includes linked releasePublications separately.

See [RELEASE_PUBLICATION.md](RELEASE_PUBLICATION.md).

## Release publication durability receipts

PR 28 adds repeat RAUD receipts linked to historical RPUB release-publication receipts.

DossierReleasePublicationAuditReceipt preserves:
- REL id
- RPUB id + RPUB receipt SHA-256
- package-basis fingerprint
- historical package SHA-256
- frozen public retrieval URL
- successful HTTP/content-type metadata
- local checkedAt with explicit untrusted-local-clock
- fresh read-back SHA-256
- exactMatch: true
- RAUD receipt SHA-256
- repeat-external-retrieval trust label

RAUD reconstructs the exact historical package described by RPUB instead of auditing the latest release state.

Dossier export includes linked releasePublicationAudits separately.

Repeated RAUD receipts are allowed and represent separate availability observations, not continuous-uptime proof.

See [RELEASE_DURABILITY.md](RELEASE_DURABILITY.md).
