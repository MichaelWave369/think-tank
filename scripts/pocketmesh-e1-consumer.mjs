import { createHash } from "node:crypto";

// Independent, read-only ThinkTank consumer for NBGPocketMesh E1.
// Never network, execute a model, import an agent, or authorize a council action.
export const POCKETMESH_E1_SCHEMA = "nbg-pocketmesh.council-evidence-exchange-e1.v0.1";
const E0_SCHEMA = "nbg-pocketmesh.council-keyhole-e0.v0.1";
const INTERPRETATION = "Synthetic contract output; no scientific corroboration";
const SEATS = Object.freeze([
  Object.freeze({ participant: "ThinkTank", repository: "MichaelWave369/think-tank", role: "HYPOTHESIS_CHALLENGER", claimTier: "HYPOTHESIS_ONLY", actions: ["CHALLENGE_AGGREGATE_EQUIVALENCE", "REVIEW_E0_RESULT"] }),
  Object.freeze({ participant: "PocketBrain", repository: "MichaelWave369/PocketBrain", role: "LOCAL_OBSERVER", claimTier: "DISPLAY_ONLY", actions: ["DISPLAY_K0_K1_CONTRAST", "DISPLAY_E0_RESULT"] }),
  Object.freeze({ participant: "Vessie", repository: "MichaelWave369/SuperPhiVessel", role: "GOVERNANCE_REVIEWER", claimTier: "REVIEW_ONLY", actions: ["HOLD_FOR_OPERATOR_REVIEW"] })
]);
const TOP_KEYS = ["schema", "policyEpoch", "caseId", "e0Schema", "e0ReceiptSha256", "origin", "privacy", "authority", "state", "sourceProvenance", "independentEvidence", "executionAuthorized", "mergeAuthorized", "sharingAuthorized", "externalCalls", "receipts", "exchangeSha256"];
const RECEIPT_KEYS = ["schema", "caseId", "participant", "repository", "sourceSha", "sourceIdentity", "role", "claimTier", "action", "parentE0Sha256", "origin", "privacy", "authority", "modelExecuted", "operatorApproved", "evidenceAuthenticated", "transportPerformed", "interpretation", "receiptSha256"];
const SHA256 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const ID = /^[A-Za-z0-9._:-]{1,64}$/;

function requireCondition(value, code) {
  if (!value) throw new Error(code);
}
function exactKeys(obj, expected, code) {
  requireCondition(obj !== null && typeof obj === "object" && !Array.isArray(obj) &&
    Object.getPrototypeOf(obj) === Object.prototype, code);
  requireCondition(JSON.stringify(Object.keys(obj).sort()) ===
    JSON.stringify([...expected].sort()), code);
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(
      key => JSON.stringify(key) + ":" + canonical(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}
function sha(record) {
  return createHash("sha256").update(canonical(record)).digest("hex");
}
function verifiedDigest(obj, digestField, code) {
  requireCondition(SHA256.test(obj[digestField] ?? ""), code);
  const { [digestField]: declared, ...unsigned } = obj;
  requireCondition(sha(unsigned) === declared, code);
}
function equalFields(value, spec, code) {
  for (const [key, expected] of Object.entries(spec)) {
    requireCondition(value[key] === expected, code);
  }
}

// Validates only the published fixed-size E1 data contract and its internal hashes.
// A malicious source can forge a self-consistent bundle. This is not authentication.
export function reviewPocketMeshE1(bundle) {
  exactKeys(bundle, TOP_KEYS, "E1_TOP_SCHEMA_REFUSED");
  equalFields(bundle, {
    schema: POCKETMESH_E1_SCHEMA, policyEpoch: 1, e0Schema: E0_SCHEMA,
    origin: "SIMULATED", privacy: "PUBLIC_SYNTHETIC", authority: "NONE",
    state: "HELD_FOR_OPERATOR_REVIEW", sourceProvenance: "DECLARED_UNVERIFIED",
    independentEvidence: false, executionAuthorized: false, mergeAuthorized: false,
    sharingAuthorized: false, externalCalls: 0
  }, "E1_TRUST_BOUNDARY_REFUSED");
  requireCondition(typeof bundle.caseId === "string" && ID.test(bundle.caseId),
    "E1_CASE_ID_REFUSED");
  requireCondition(typeof bundle.e0ReceiptSha256 === "string" &&
    SHA256.test(bundle.e0ReceiptSha256), "E1_PARENT_REFUSED");
  requireCondition(Array.isArray(bundle.receipts) &&
    bundle.receipts.length === SEATS.length, "E1_SEAT_COUNT_REFUSED");

  const actions = [];
  for (let i = 0; i < SEATS.length; i++) {
    const receipt = bundle.receipts[i];
    const seat = SEATS[i];
    exactKeys(receipt, RECEIPT_KEYS, "E1_RECEIPT_SCHEMA_REFUSED");
    equalFields(receipt, {
      schema: POCKETMESH_E1_SCHEMA,
      caseId: bundle.caseId,
      participant: seat.participant,
      repository: seat.repository,
      sourceIdentity: "DECLARED_UNVERIFIED",
      role: seat.role,
      claimTier: seat.claimTier,
      parentE0Sha256: bundle.e0ReceiptSha256,
      origin: "SIMULATED",
      privacy: "PUBLIC_SYNTHETIC",
      authority: "NONE",
      modelExecuted: false,
      operatorApproved: false,
      evidenceAuthenticated: false,
      transportPerformed: false,
      interpretation: INTERPRETATION
    }, "E1_SEAT_TRUST_REFUSED");
    requireCondition(typeof receipt.sourceSha === "string" &&
      SHA40.test(receipt.sourceSha), "E1_SOURCE_IDENTITY_REFUSED");
    requireCondition(seat.actions.includes(receipt.action), "E1_ACTION_REFUSED");
    verifiedDigest(receipt, "receiptSha256", "E1_RECEIPT_DIGEST_REFUSED");
    actions.push(receipt.action);
  }
  const isWitness = actions[0] === "CHALLENGE_AGGREGATE_EQUIVALENCE";
  requireCondition(actions[1] === (isWitness ? "DISPLAY_K0_K1_CONTRAST" : "DISPLAY_E0_RESULT"),
    "E1_ACTION_PAIR_REFUSED");
  requireCondition(actions[2] === "HOLD_FOR_OPERATOR_REVIEW", "E1_REVIEW_HOLD_REFUSED");
  verifiedDigest(bundle, "exchangeSha256", "E1_EXCHANGE_DIGEST_REFUSED");

  // Accepting a self-consistent packet only permits a local review preview.
  return Object.freeze({
    schema: "thinktank.pocketmesh-e1-consumer.v0.1",
    disposition: "HELD_UNTRUSTED_REVIEW_ONLY",
    contractConsistent: true,
    caseId: bundle.caseId,
    parentDigest: bundle.e0ReceiptSha256,
    bundleDigest: bundle.exchangeSha256,
    hypothesisChallengeSuggested: isWitness,
    seatCount: SEATS.length,
    sourceAuthenticated: false,
    independentlyVerified: false,
    scientificEvidence: false,
    modelExecuted: false,
    approvedForCouncil: false,
    executionAuthorized: false,
    sharingAuthorized: false,
    mergeAuthorized: false,
    explanation: "Self-consistent synthetic receipt; E0 input, GitHub source identities and producing software not independently checked"
  });
}
