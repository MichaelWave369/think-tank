# TT-35 R9 · Detached Ed25519 Replay Report Signing

**Status:** opt-in, offline, **cryptographic key-possession proof** for an already generated R8 replay verification JSON file. This does not change kernel replay, run an AI model, grant execution authority, establish factual truth, or independently authenticate real-world signer identity.

## What this builds

Use an existing operator-controlled Ed25519 private key. The signer accepts exactly the R8 `KERNEL_REPLAY_PASS` schema, checks zero-authority flags, and signs a **domain-separated SHA-256 digest of the report's exact raw file bytes**. It writes a detached JSON signature document with the Ed25519 SPKI public key, SHA-256 fingerprint of its DER bytes, signature, and all authority flags set to false.

No signing key is generated or supplied by this command. Keys stay on the operator's own computer; the private PEM is never embedded in the signature document. The signature file is written with `wx` to refuse overwriting.

### Human-controlled usage

```sh
# First produce an R8 verifier report with the real ThinkTank kernel:
npm run council:verify -- /absolute/path/council-ledger.json /absolute/path/council-dossier.json

# Reuse an existing locally controlled Ed25519 private key.
# ThinkTank already provides npm run dossier:keygen to create one separately.
npm run council:sign -- \
  /absolute/path/replay-verification-RECEIPT.json \
  /absolute/path/.secrets/dossier-ed25519-private.pem \
  /absolute/path/replay-verification-RECEIPT.sig.json \
  --confirm-sign-only
```

You must provide **all three local file paths and `--confirm-sign-only`**. The sign command does not re-run the verifier, contact Ollama, sign in to GitHub, call an external endpoint, or publish anything.

### Signature contract

```json
{
  "schema": "phi-thinktank-local-replay-signature.v0.1",
  "domain": "PHI_THINKTANK_LOCAL_REPLAY_SIGNATURE_V1",
  "algorithm": "Ed25519",
  "messageEncoding": "utf8-domain-plus-sha256-hex",
  "reportSha256": "64-lowercase-hex-from-exact-report-file-bytes",
  "publicKeySpkiBase64": "base64-Ed25519-SPKI-DER",
  "publicKeyFingerprintSha256": "sha256-of-public-key-SPKI-DER",
  "signatureBase64": "base64-Ed25519-signature",
  "signerLabel": "operator-selected-local-key",
  "authGranted": false,
  "externalDone": false,
  "truthAuthority": false,
  "signerAuthenticated": false
}
```

The exact signature message bytes are UTF-8 of:

```
PHI_THINKTANK_LOCAL_REPLAY_SIGNATURE_V1\n<lowercase sha256 of raw report bytes>
```

The public key fingerprint is SHA-256 of the **SPKI DER public key**. Human reviewers must acquire and pin that fingerprint by an **independent trusted route**. A key published only in the signature file does not establish the keyholder's identity: an attacker could generate a new key and self-sign forged data.

### Trust boundaries

A valid signature proves only that the provided public key verifies a signature over the specified report digest. It does **not** prove the named person signed it, or that a local AI inference really occurred, the event kernel ran, evidence is true, or external actions were authorized. The report remains a local, unsigned-at-origin self-report until signed; signature authentication still requires external trust establishment.

Never commit a private PEM, private-key path in a shared log, or sensitive report data. Avoid using an inappropriate deployment signing key for local reports; separate keys and key-rotation practices are preferable.

## Acceptance

The existing synthetic ThinkTank TT-35 CLI test extends its mock bridge run to sign the newly verified report using a temporary Ed25519 test key. It cryptographically verifies the detached signature, rejects altered message digests and confirms the command did not cause additional provider requests. Other production and web tests are unaffected.

```sh
npm run build
npm run test
npm run council:build
node --test scripts/local-council-cli.node.mjs
```

**Ledger Above Ego. Cryptographic possession is not identity, and identity is not truth.**
