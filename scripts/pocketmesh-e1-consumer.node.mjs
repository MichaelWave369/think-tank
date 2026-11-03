import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewPocketMeshE1, POCKETMESH_E1_SCHEMA as SCHEMA } from "./pocketmesh-e1-consumer.mjs";
import { inspectPocketMeshFile } from "./inspect-pocketmesh-e1.mjs";

// Independent fixture producer matches PocketMesh E1 public canonical format.
// Deliberately self-generated: it proves contract interoperability, NOT provenance.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
const sha = o => createHash("sha256").update(canonical(o)).digest("hex");
const seats = [
  ["ThinkTank","MichaelWave369/think-tank","HYPOTHESIS_CHALLENGER","HYPOTHESIS_ONLY","CHALLENGE_AGGREGATE_EQUIVALENCE"],
  ["PocketBrain","MichaelWave369/PocketBrain","LOCAL_OBSERVER","DISPLAY_ONLY","DISPLAY_K0_K1_CONTRAST"],
  ["Vessie","MichaelWave369/SuperPhiVessel","GOVERNANCE_REVIEWER","REVIEW_ONLY","HOLD_FOR_OPERATOR_REVIEW"]
];
function fixture(witness = true) {
  const parent = sha({ e0: "synthetic-source-hash" });
  const receipts = seats.map(([participant, repository, role, claimTier, action]) => {
    const core = {
      schema: SCHEMA, caseId: "council-sim-001", participant, repository,
      sourceSha: "a".repeat(40), sourceIdentity: "DECLARED_UNVERIFIED",
      role, claimTier,
      action: !witness && participant === "ThinkTank" ? "REVIEW_E0_RESULT" :
        !witness && participant === "PocketBrain" ? "DISPLAY_E0_RESULT" : action,
      parentE0Sha256: parent, origin: "SIMULATED", privacy: "PUBLIC_SYNTHETIC",
      authority: "NONE", modelExecuted: false, operatorApproved: false,
      evidenceAuthenticated: false, transportPerformed: false,
      interpretation: "Synthetic contract output; no scientific corroboration"
    };
    return { ...core, receiptSha256: sha(core) };
  });
  const main = {
    schema: SCHEMA, policyEpoch: 1, caseId: "council-sim-001",
    e0Schema: "nbg-pocketmesh.council-keyhole-e0.v0.1",
    e0ReceiptSha256: parent, origin: "SIMULATED", privacy: "PUBLIC_SYNTHETIC",
    authority: "NONE", state: "HELD_FOR_OPERATOR_REVIEW",
    sourceProvenance: "DECLARED_UNVERIFIED", independentEvidence: false,
    executionAuthorized: false, mergeAuthorized: false, sharingAuthorized: false,
    externalCalls: 0, receipts
  };
  return { ...main, exchangeSha256: sha(main) };
}
function resign(f) {
  for (const r of f.receipts) {
    const { receiptSha256: ignored, ...unsigned } = r;
    r.receiptSha256 = sha(unsigned);
  }
  const { exchangeSha256: ignored, ...unsigned } = f;
  f.exchangeSha256 = sha(unsigned);
  return f;
}

test("accept exact PocketMesh E1 fixture only as HELD_UNTRUSTED_REVIEW_ONLY", () => {
  const review = reviewPocketMeshE1(fixture());
  assert.equal(review.disposition, "HELD_UNTRUSTED_REVIEW_ONLY");
  assert.equal(review.contractConsistent, true);
  assert.equal(review.seatCount, 3);
  assert.equal(review.hypothesisChallengeSuggested, true);
  for (const key of ["sourceAuthenticated", "independentlyVerified", "scientificEvidence", "modelExecuted", "approvedForCouncil", "executionAuthorized", "sharingAuthorized", "mergeAuthorized"]) {
    assert.equal(review[key], false, key);
  }
});

test("null witness remains review only and does not suggest subgroup challenge", () => {
  const result = reviewPocketMeshE1(fixture(false));
  assert.equal(result.hypothesisChallengeSuggested, false);
  assert.equal(result.disposition, "HELD_UNTRUSTED_REVIEW_ONLY");
});

test("detect independent mutation to seat record", () => {
  const f = fixture();
  f.receipts[0].sourceSha = "b".repeat(40);
  assert.throws(() => reviewPocketMeshE1(f), /E1_RECEIPT_DIGEST_REFUSED/);
});

test("detect outer record tampering after valid internal receipts", () => {
  const f = fixture();
  f.caseId = "new-case";
  assert.throws(() => reviewPocketMeshE1(f), /E1_SEAT_TRUST_REFUSED/);
});

test("reject all authority and source-laundering attempts even with recomputed digests", () => {
  for (const [key, value] of [
    ["authority", "HUMAN"],["executionAuthorized", true],["mergeAuthorized", true],
    ["sharingAuthorized", true],["independentEvidence", true],["sourceProvenance","ATTESTED"],
    ["origin","MEASURED"],["privacy","PRIVATE"],["externalCalls",1]
  ]) {
    const f = fixture();
    f[key] = value;
    assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_TRUST_BOUNDARY_REFUSED/, key);
  }
});

test("refuse fake source attribution, role, altered action and participant identity", () => {
  for (const [key, value] of [
    ["role", "EXECUTOR"],["repository", "MichaelWave369/Agentora"],
    ["sourceIdentity", "GITHUB_VERIFIED"],["participant", "GAIA"],
    ["action", "EXECUTE"],["claimTier", "PHYSICAL_EVIDENCE"],
    ["operatorApproved", true],["evidenceAuthenticated", true],
    ["modelExecuted", true],["transportPerformed", true]
  ]) {
    const f = fixture();
    f.receipts[0][key] = value;
    assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_SEAT_TRUST_REFUSED|E1_ACTION_REFUSED/, key);
  }
});

test("refuse inconsistent ThinkTank / PocketBrain Keyhole action pairing", () => {
  const f = fixture();
  f.receipts[1].action = "DISPLAY_E0_RESULT";
  assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_ACTION_PAIR_REFUSED/);
});

test("refuse malicious extra raw text or special action keys", () => {
  const f = fixture();
  f.receipts[0].prompt = "secret";
  assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_RECEIPT_SCHEMA_REFUSED/);
  const g = fixture();
  g.token = "secret";
  assert.throws(() => reviewPocketMeshE1(resign(g)), /E1_TOP_SCHEMA_REFUSED/);
});

test("refuse malformed SHA, duplicate seat, bad parent and future schema", () => {
  const f = fixture();
  f.receipts[1].sourceSha = "not-a-sha";
  assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_SOURCE_IDENTITY_REFUSED/);
  const g = fixture();
  g.receipts[1] = structuredClone(g.receipts[0]);
  assert.throws(() => reviewPocketMeshE1(resign(g)), /E1_SEAT_TRUST_REFUSED/);
  const h = fixture();
  h.e0ReceiptSha256 = "x".repeat(64);
  assert.throws(() => reviewPocketMeshE1(resign(h)), /E1_PARENT_REFUSED/);
  const i = fixture();
  i.schema = "future";
  assert.throws(() => reviewPocketMeshE1(resign(i)), /E1_TRUST_BOUNDARY_REFUSED/);
});

test("reject missing, reordered, and oversized seat arrays", () => {
  const f = fixture();
  f.receipts.pop();
  assert.throws(() => reviewPocketMeshE1(resign(f)), /E1_SEAT_COUNT_REFUSED/);
  const g = fixture();
  g.receipts.reverse();
  assert.throws(() => reviewPocketMeshE1(resign(g)), /E1_SEAT_TRUST_REFUSED/);
  const h = fixture();
  h.receipts.push(h.receipts[0]);
  assert.throws(() => reviewPocketMeshE1(resign(h)), /E1_SEAT_COUNT_REFUSED/);
});

test("self-consistent intentional forgery is still labeled UNVERIFIED, never authentic", () => {
  const forged = fixture();
  forged.receipts.forEach(r => r.sourceSha = "b".repeat(40));
  const review = reviewPocketMeshE1(resign(forged));
  assert.equal(review.sourceAuthenticated, false);
  assert.equal(review.independentlyVerified, false);
  assert.equal(review.scientificEvidence, false);
});

test("read-only file inspector handles bounded operator-selected local JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "thinktank-e1-"));
  try {
    const file = join(dir, "synthetic.json");
    writeFileSync(file, JSON.stringify(fixture()));
    assert.equal(inspectPocketMeshFile(file).disposition, "HELD_UNTRUSTED_REVIEW_ONLY");
    const link = join(dir, "symlink.json");
    symlinkSync(file, link);
    assert.throws(() => inspectPocketMeshFile(link), /E1_FILE_REFUSED|ELOOP/);
    const huge = join(dir, "large.json");
    writeFileSync(huge, "x".repeat(65537));
    assert.throws(() => inspectPocketMeshFile(huge), /E1_FILE_REFUSED/);
    const invalid = join(dir, "invalid.json");
    writeFileSync(invalid, '{"hello":"world"}');
    assert.throws(() => inspectPocketMeshFile(invalid), /E1_TOP_SCHEMA_REFUSED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no receipt or review gains external execution or raw prompts", () => {
  const review = reviewPocketMeshE1(fixture());
  const serialized = JSON.stringify(review);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("APPROVED"), false);
  assert.equal(review.executionAuthorized, false);
});
