export type RoleId="vessie"|"dreamer"|"builder"|"challenger"|"archivist";
export type SeatId="openai"|"kimi"|"local";
export type TerminalState="idle"|"selected"|"listening"|"thinking"|"speaking"|"warning"|"offline"|"dimmed";
export type CollaborationMode="solo"|"trio"|"council"|"debate"|"dream"|"build"|"audit";
export type RouterPolicy="manual"|"auto-trio"|"council-broadcast"|"debate-round-robin"|"dream-forward"|"build-forward"|"audit-forward";
export type SessionPhase="intake"|"routing"|"independent"|"challenge"|"revision"|"synthesis"|"action"|"complete"|"aborted";
export type EventSource="operator"|"system"|"simulator"|"provider"|"tool";
export type SynthesisTrigger="all-replied"|"gate-passed"|"operator-force"|"timeout";
export type GateBehavior="informational"|"threshold"|"threshold-or-draft"|"threshold-and-objection";
export type GovernanceLabel="STANDARD"|"SPECULATIVE"|"DRAFT"|"READY"|"AUDIT"|"WITHHELD";
export type CapabilityKey="REASON"|"CONTEXT"|"TOOLS"|"WEB"|"MEMORY"|"PRIVATE"|"OFFLINE"|"SPEED"|"BUILD"|"CRITIQUE"|"ARCHIVE"|"IMAGINE"|"SYNTHESIS";
export type SeatAvailability="online"|"degraded"|"offline";
export type SeatLocality="local"|"remote";
export type AssignmentOrigin="bootstrap"|"auto"|"operator-pin";
export type EvidenceKind="operator-reference"|"tool-result"|"external-source"|"provider-output";
export type EvidenceVerification="unverified"|"operator-attested"|"machine-verified";
export type ClaimRelation="supports"|"contradicts"|"context";
export type ClaimStatus="unbound"|"supported"|"challenged"|"contested"|"context-only";
export type ClaimCoverageState="unbound"|"thin"|"directional"|"contested"|"context-only";
export type ClaimPolicyKind="informational"|"bound-fresh"|"all-fresh"|"audit-ready";
export type ArgumentReviewStatus="draft"|"accepted"|"dismissed";
export type DecisionOutcome="completed"|"withheld";
export type ArgumentPolicyKind="informational"|"fresh-accepted-on-excerpts";
export type ClaimCoverageFlag=
  |"no-evidence"
  |"single-source"
  |"no-machine-verified"
  |"no-research-lineage"
  |"support-only"
  |"contradiction-only"
  |"mixed-direction"
  |"context-only";

export interface ResearchCandidate{
  id:string;
  claimId:string;
  query:string;
  title:string;
  uri:string;
  snippet:string;
  engine:string;
  rank:number;
  discoveredAt:string;
}

export interface ResearchSearchReceipt{
  id:string;
  tool:"searxng-search";
  provider:"searxng";
  claimId:string;
  query:string;
  searchedAt:string;
  resultDigest:string;
  candidates:ResearchCandidate[];
}

export interface RetrievalReceipt{
  tool:"url-fetch";
  requestedUri:string;
  finalUri:string;
  httpStatus:number;
  contentType:string;
  bytes:number;
  sha256:string;
  redirects:number;
  retrievedAt:string;
}

export interface RoleTerminal{ id:RoleId; name:string; accent:string; verbs:string[]; motif:string; }
export interface Seat{
  id:SeatId;
  name:string;
  model:string;
  provider:string;
  accent:string;
  locality:SeatLocality;
  capabilities:Record<CapabilityKey,number>;
}
export interface Assignment{ roleId:RoleId; seatId:SeatId; }

export interface Claim{
  id:string;
  text:string;
  addedBy:"operator";
}

export interface ClaimBinding{
  id:string;
  claimId:string;
  evidenceId:string;
  relation:ClaimRelation;
  note?:string;
  addedBy:"operator";
}

export interface ClaimReviewReceipt{
  id:string;
  claimId:string;
  reviewedAt:string;
  basisFingerprint:string;
  coverageState:ClaimCoverageState;
  boundEvidenceCount:number;
  supportCount:number;
  contradictionCount:number;
  contextCount:number;
  machineVerifiedCount:number;
  operatorAttestedCount:number;
  unverifiedCount:number;
  researchLineageCount:number;
  flags:ClaimCoverageFlag[];
}

export interface EvidenceExcerpt{
  id:string;
  evidenceId:string;
  tool:"text-projector";
  extractor:"text-projection-v1";
  sourceUri:string;
  sourceSha256:string;
  projectionSha256:string;
  excerptSha256:string;
  contentType:string;
  startChar:number;
  endChar:number;
  text:string;
  extractedAt:string;
  addedBy:"tool";
}

export interface ArgumentReviewPoint{
  excerptId:string;
  premise:string;
  inference:string;
  objection:string;
}

export interface ArgumentReview{
  id:string;
  claimId:string;
  roleId:"challenger";
  seatId:SeatId;
  providerModel:string;
  providerRequestId?:string;
  createdAt:string;
  basisFingerprint:string;
  points:ArgumentReviewPoint[];
  unresolvedGaps:string[];
  summary:string;
  status:ArgumentReviewStatus;
}

export interface DecisionClaimRef{
  id:string;
  text:string;
}

export interface DecisionBindingRef{
  id:string;
  claimId:string;
  evidenceId:string;
  relation:ClaimRelation;
  note:string;
}

export interface DecisionEvidenceRef{
  id:string;
  verification:EvidenceVerification;
  kind:EvidenceKind;
  uri:string;
  retrievalSha256:string;
  researchCandidateId:string;
}

export interface DecisionExcerptRef{
  id:string;
  evidenceId:string;
  sourceSha256:string;
  projectionSha256:string;
  excerptSha256:string;
  startChar:number;
  endChar:number;
}

export interface DecisionClaimReviewRef{
  id:string;
  claimId:string;
  basisFingerprint:string;
  coverageState:ClaimCoverageState;
}

export interface DecisionArgumentReviewRef{
  id:string;
  claimId:string;
  status:ArgumentReviewStatus;
  basisFingerprint:string;
  providerModel:string;
  providerRequestId:string;
}

export interface DecisionProviderTurnRef{
  seq:number;
  roleId:RoleId;
  seatId:SeatId;
  providerModel:string;
  providerRequestId:string;
}

export interface SynthesisDecisionDossier{
  id:string;
  sessionId:string;
  seed:string;
  decisionSeq:number;
  mode:CollaborationMode;
  operatorPrompt:string;
  outcome:DecisionOutcome;
  outputLabel:GovernanceLabel;
  actionAllowed:boolean;
  gateScore:number;
  gateThreshold:number;
  gateBreakdown:GateBreakdown|null;
  claimGovernance:ClaimGovernanceReport;
  argumentGovernance:ArgumentGovernanceReport;
  objectionCount:number;
  faultCode:string;
  assignments:Assignment[];
  claims:DecisionClaimRef[];
  bindings:DecisionBindingRef[];
  evidence:DecisionEvidenceRef[];
  excerpts:DecisionExcerptRef[];
  claimReviews:DecisionClaimReviewRef[];
  argumentReviews:DecisionArgumentReviewRef[];
  providerTurns:DecisionProviderTurnRef[];
  basisFingerprint:string;
  governanceReason:string;
}

export interface DossierSealReceipt{
  id:string;
  dossierId:string;
  tool:"ed25519-dossier-sealer";
  algorithm:"Ed25519";
  canonicalization:"json-stable-v1";
  digestSha256:string;
  publicKeyPem:string;
  publicKeyFingerprintSha256:string;
  signatureBase64:string;
  signedAt:string;
  signerLabel:string;
  trust:"self-attested-local-key";
}

export interface DossierSealVerificationReceipt{
  id:string;
  dossierId:string;
  sealId:string;
  tool:"ed25519-dossier-verifier";
  algorithm:"Ed25519";
  digestSha256:string;
  publicKeyFingerprintSha256:string;
  verified:boolean;
  verifiedAt:string;
}

export interface DossierTransparencyReceipt{
  id:string;
  dossierId:string;
  sealId:string;
  tool:"sha256-dossier-transparency-journal";
  canonicalization:"json-stable-v1";
  sequence:number;
  previousEntrySha256:string;
  entrySha256:string;
  dossierSha256:string;
  publicKeyFingerprintSha256:string;
  loggedAt:string;
  clock:"untrusted-local-clock";
  trust:"tamper-evident-local-journal";
  journalVerifiedAtAppend:true;
}

export interface DossierTransparencyCheckpoint{
  id:string;
  tool:"sha256-transparency-checkpoint";
  canonicalization:"json-stable-v1";
  entryCount:number;
  headEntryId:string;
  headSha256:string;
  checkpointSha256:string;
  createdAt:string;
  clock:"untrusted-local-clock";
  trust:"portable-local-checkpoint";
}

export interface DossierTransparencyWitnessReceipt{
  id:string;
  checkpointId:string;
  tool:"ed25519-transparency-witness";
  algorithm:"Ed25519";
  canonicalization:"json-stable-v1";
  checkpointSha256:string;
  publicKeyPem:string;
  publicKeyFingerprintSha256:string;
  signatureBase64:string;
  witnessedAt:string;
  witnessLabel:string;
  trust:"self-attested-external-witness-key";
}

export interface DossierTransparencyWitnessVerificationReceipt{
  id:string;
  checkpointId:string;
  witnessId:string;
  tool:"ed25519-transparency-witness-verifier";
  algorithm:"Ed25519";
  checkpointSha256:string;
  publicKeyFingerprintSha256:string;
  verified:true;
  verifiedAt:string;
}

export interface DossierRfc3161TimestampReceipt{
  id:string;
  checkpointId:string;
  tool:"rfc3161-timestamp-verifier";
  standard:"RFC3161";
  hashAlgorithm:"SHA-256";
  checkpointSha256:string;
  tokenSha256:string;
  tokenBase64:string;
  tsaPolicyOid:string;
  tsaSerialNumber:string;
  genTime:string;
  tsaSubject:string;
  authorityUrl:string;
  trustAnchorSha256:string;
  verifiedAt:string;
  trust:"configured-rfc3161-trust-anchor";
}

export interface DossierCheckpointPublicationReceipt{
  id:string;
  checkpointId:string;
  tool:"verified-checkpoint-publisher";
  protocol:"phi-checkpoint-publication-v1";
  checkpointSha256:string;
  publisherUrl:string;
  retrievalUrl:string;
  publicationId:string;
  publisherClaimedAt:string;
  payloadSha256:string;
  retrievalHttpStatus:number;
  retrievalContentType:string;
  retrievalVerifiedAt:string;
  receiptSha256:string;
  trust:"externally-retrieved-publication";
}

export type ProvenanceAssurancePolicyKind=
  |"integrity"
  |"witnessed"
  |"time-attested"
  |"published"
  |"full-provenance";

export type ProvenanceAssuranceRequirementKind=
  |"verified-seal"
  |"journal-entry"
  |"checkpoint"
  |"verified-witness"
  |"rfc3161-time"
  |"verified-publication";

export interface ProvenanceAssuranceRequirementResult{
  requirement:ProvenanceAssuranceRequirementKind;
  satisfied:boolean;
  evidenceIds:string[];
}

export interface DossierProvenanceAssuranceReport{
  id:string;
  dossierId:string;
  policy:ProvenanceAssurancePolicyKind;
  basisFingerprint:string;
  checkpointId:string;
  journalHeadStatus:"current"|"historical"|"unavailable";
  requirements:ProvenanceAssuranceRequirementResult[];
  missing:ProvenanceAssuranceRequirementKind[];
  passed:boolean;
  reason:string;
  truthAuthority:false;
}

export interface DossierReleaseManifest{
  schemaVersion:1;
  id:string;
  dossierId:string;
  policy:ProvenanceAssurancePolicyKind;
  assuranceReportId:string;
  assuranceBasisFingerprint:string;
  checkpointId:string;
  operatorOverrideId:string;
  artifactIds:string[];
  manifestFingerprint:string;
  releaseAuthority:"fresh-passing-provenance-policy";
  truthAuthority:false;
}

export interface DossierReleaseSealReceipt{
  id:string;
  releaseId:string;
  dossierId:string;
  tool:"ed25519-release-sealer";
  algorithm:"Ed25519";
  canonicalization:"json-stable-v1";
  manifestSha256:string;
  publicKeyPem:string;
  publicKeyFingerprintSha256:string;
  signatureBase64:string;
  signedAt:string;
  clock:"untrusted-local-clock";
  signerLabel:string;
  trust:"self-attested-local-release-key";
}

export interface DossierReleaseSealVerificationReceipt{
  id:string;
  releaseId:string;
  sealId:string;
  tool:"ed25519-release-verifier";
  algorithm:"Ed25519";
  manifestSha256:string;
  publicKeyFingerprintSha256:string;
  verified:true;
  verifiedAt:string;
}

export interface DossierReleaseRfc3161TimestampReceipt{
  id:string;
  releaseId:string;
  sealId:string;
  tool:"rfc3161-release-seal-timestamp-verifier";
  standard:"RFC3161";
  hashAlgorithm:"SHA-256";
  releaseSealSha256:string;
  manifestSha256:string;
  publicKeyFingerprintSha256:string;
  tokenSha256:string;
  tokenBase64:string;
  tsaPolicyOid:string;
  tsaSerialNumber:string;
  genTime:string;
  tsaSubject:string;
  authorityUrl:string;
  trustAnchorSha256:string;
  verifiedAt:string;
  trust:"configured-rfc3161-trust-anchor";
}

export interface DossierReleasePublicationReceipt{
  id:string;
  releaseId:string;
  tool:"verified-release-package-publisher";
  protocol:"phi-release-publication-v1";
  packageBasisFingerprint:string;
  manifestSha256:string;
  packageSha256:string;
  publisherUrl:string;
  retrievalUrl:string;
  publicationId:string;
  publisherClaimedAt:string;
  retrievalHttpStatus:number;
  retrievalContentType:string;
  retrievalVerifiedAt:string;
  releaseSealIds:string[];
  releaseVerificationIds:string[];
  releaseTimestampIds:string[];
  artifactIds:string[];
  receiptSha256:string;
  trust:"externally-retrieved-release-publication";
}

export interface DossierReleasePublicationAuditReceipt{
  id:string;
  releaseId:string;
  publicationReceiptId:string;
  publicationReceiptSha256:string;
  tool:"release-publication-durability-auditor";
  protocol:"phi-release-publication-audit-v1";
  packageBasisFingerprint:string;
  packageSha256:string;
  retrievalUrl:string;
  retrievalHttpStatus:number;
  retrievalContentType:string;
  checkedAt:string;
  clock:"untrusted-local-clock";
  readbackSha256:string;
  exactMatch:true;
  receiptSha256:string;
  trust:"repeat-external-retrieval";
}

export interface DecisionOverrideReceipt{
  id:string;
  dossierId:string;
  overrideSeq:number;
  outputLabel:GovernanceLabel;
  actionAllowed:true;
  reason:string;
}

export interface EvidenceRef{
  id:string;
  kind:EvidenceKind;
  verification:EvidenceVerification;
  label:string;
  uri?:string;
  note?:string;
  retrieval?:RetrievalReceipt;
  researchCandidateId?:string;
  addedBy:"operator"|"system"|"tool";
}

export interface ArgumentGovernanceReport{
  mode:CollaborationMode;
  policy:ArgumentPolicyKind;
  applicableClaimIds:string[];
  freshAcceptedClaimIds:string[];
  missingAcceptedClaimIds:string[];
  staleAcceptedClaimIds:string[];
  draftOnlyClaimIds:string[];
  passed:boolean;
  reason:string;
}

export interface ClaimGovernanceReport{
  mode:CollaborationMode;
  policy:ClaimPolicyKind;
  applicableClaimIds:string[];
  freshClaimIds:string[];
  missingReviewClaimIds:string[];
  staleReviewClaimIds:string[];
  coverageBlockedClaimIds:string[];
  passed:boolean;
  reason:string;
}

export interface GateBreakdown{
  provenance:number;
  roleCoverage:number;
  seatDiversity:number;
  challengeCoverage:number;
  externalSupport:number;
  rawScore:number;
  finalScore:number;
  cap:number;
  capReason:string;
  evidenceCount:number;
  verifiedEvidenceCount:number;
  attestedEvidenceCount:number;
}

export interface TurnPlan{
  activeRoles:RoleId[];
  speakerQueue:RoleId[];
  round:number;
  maxRounds:number;
  timeoutMs:number;
  synthesisTrigger:SynthesisTrigger;
  gateBehavior:GateBehavior;
  outputLabel:GovernanceLabel;
  objectionRequired:boolean;
}

export type ThinkTankEventKind=
  |"mode.selected"
  |"session.started"
  |"operator.prompt"
  |"seat.status"
  |"role.pinned"
  |"role.unpinned"
  |"role.assigned"
  |"routing.completed"
  |"claim.added"
  |"claim.removed"
  |"claim.review.requested"
  |"claim.review.completed"
  |"argument.review.requested"
  |"argument.review.completed"
  |"argument.review.failed"
  |"argument.review.accepted"
  |"argument.review.dismissed"
  |"evidence.bound"
  |"evidence.unbound"
  |"research.search.requested"
  |"research.search.completed"
  |"research.search.failed"
  |"evidence.fetch.requested"
  |"evidence.fetch.failed"
  |"evidence.added"
  |"evidence.removed"
  |"evidence.excerpt.requested"
  |"evidence.excerpt.failed"
  |"evidence.excerpt.added"
  |"evidence.excerpt.removed"
  |"provider.failed"
  |"schedule.planned"
  |"round.started"
  |"turn.started"
  |"turn.timeout"
  |"utterance.complete"
  |"challenge.raised"
  |"gate.scored"
  |"governance.fault"
  |"synthesis.withheld"
  |"synthesis.completed"
  |"operator.override"
  |"dossier.seal.requested"
  |"dossier.seal.completed"
  |"dossier.seal.failed"
  |"dossier.verify.requested"
  |"dossier.verify.completed"
  |"dossier.verify.failed"
  |"dossier.transparency.requested"
  |"dossier.transparency.completed"
  |"dossier.transparency.failed"
  |"dossier.checkpoint.requested"
  |"dossier.checkpoint.completed"
  |"dossier.checkpoint.failed"
  |"dossier.witness.requested"
  |"dossier.witness.completed"
  |"dossier.witness.failed"
  |"dossier.timestamp.requested"
  |"dossier.timestamp.completed"
  |"dossier.timestamp.failed"
  |"dossier.publication.requested"
  |"dossier.publication.completed"
  |"dossier.publication.failed"
  |"dossier.assurance.requested"
  |"dossier.assurance.completed"
  |"dossier.release.requested"
  |"dossier.release.authorized"
  |"dossier.release.seal.requested"
  |"dossier.release.seal.completed"
  |"dossier.release.seal.failed"
  |"dossier.release.verify.requested"
  |"dossier.release.verify.completed"
  |"dossier.release.verify.failed"
  |"dossier.release.timestamp.requested"
  |"dossier.release.timestamp.completed"
  |"dossier.release.timestamp.failed"
  |"dossier.release.publication.requested"
  |"dossier.release.publication.completed"
  |"dossier.release.publication.failed"
  |"dossier.release.publication.audit.requested"
  |"dossier.release.publication.audit.completed"
  |"dossier.release.publication.audit.failed"
  |"session.aborted";

export interface ThinkTankEvent{
  schemaVersion:1;
  sessionId:string;
  seq:number;
  seed:string;
  source:EventSource;
  mode:CollaborationMode;
  kind:ThinkTankEventKind;
  phase:SessionPhase;
  roleId?:RoleId;
  seatId?:SeatId;
  seatStatus?:SeatAvailability;
  assignmentScore?:number;
  assignmentReason?:string;
  assignmentOrigin?:AssignmentOrigin;
  providerModel?:string;
  providerLatencyMs?:number;
  providerRequestId?:string;
  claim?:Claim;
  claimId?:string;
  claimBinding?:ClaimBinding;
  claimBindingId?:string;
  claimReview?:ClaimReviewReceipt;
  argumentReview?:ArgumentReview;
  argumentReviewId?:string;
  researchQuery?:string;
  researchReceipt?:ResearchSearchReceipt;
  researchCandidateId?:string;
  evidenceRef?:EvidenceRef;
  evidenceId?:string;
  evidenceUri?:string;
  evidenceExcerpt?:EvidenceExcerpt;
  evidenceExcerptId?:string;
  excerptStart?:number;
  excerptEnd?:number;
  gateBreakdown?:GateBreakdown;
  claimGovernance?:ClaimGovernanceReport;
  argumentGovernance?:ArgumentGovernanceReport;
  decisionDossier?:SynthesisDecisionDossier;
  decisionDossierId?:string;
  decisionOverride?:DecisionOverrideReceipt;
  dossierSeal?:DossierSealReceipt;
  dossierSealId?:string;
  dossierVerification?:DossierSealVerificationReceipt;
  dossierTransparency?:DossierTransparencyReceipt;
  dossierTransparencyId?:string;
  dossierCheckpoint?:DossierTransparencyCheckpoint;
  dossierCheckpointId?:string;
  dossierWitness?:DossierTransparencyWitnessReceipt;
  dossierWitnessVerification?:DossierTransparencyWitnessVerificationReceipt;
  dossierTimestamp?:DossierRfc3161TimestampReceipt;
  dossierPublication?:DossierCheckpointPublicationReceipt;
  provenancePolicy?:ProvenanceAssurancePolicyKind;
  provenanceAssurance?:DossierProvenanceAssuranceReport;
  provenanceAssuranceId?:string;
  dossierRelease?:DossierReleaseManifest;
  dossierReleaseId?:string;
  dossierReleaseSeal?:DossierReleaseSealReceipt;
  dossierReleaseSealId?:string;
  dossierReleaseVerification?:DossierReleaseSealVerificationReceipt;
  dossierReleaseTimestamp?:DossierReleaseRfc3161TimestampReceipt;
  dossierReleasePackageFingerprint?:string;
  dossierReleasePublication?:DossierReleasePublicationReceipt;
  dossierReleasePublicationId?:string;
  dossierReleasePublicationAudit?:DossierReleasePublicationAuditReceipt;
  message?:string;
  gateScore?:number;
  override?:boolean;
  turnPlan?:TurnPlan;
  round?:number;
  faultCode?:string;
  outputLabel?:GovernanceLabel;
  actionAllowed?:boolean;
  governanceReason?:string;
  stateBefore:string;
  stateAfter:string;
}

export interface ThinkTankEventInput{
  source:EventSource;
  mode?:CollaborationMode;
  kind:ThinkTankEventKind;
  phase?:SessionPhase;
  roleId?:RoleId;
  seatId?:SeatId;
  seatStatus?:SeatAvailability;
  assignmentScore?:number;
  assignmentReason?:string;
  assignmentOrigin?:AssignmentOrigin;
  providerModel?:string;
  providerLatencyMs?:number;
  providerRequestId?:string;
  claim?:Claim;
  claimId?:string;
  claimBinding?:ClaimBinding;
  claimBindingId?:string;
  claimReview?:ClaimReviewReceipt;
  argumentReview?:ArgumentReview;
  argumentReviewId?:string;
  researchQuery?:string;
  researchReceipt?:ResearchSearchReceipt;
  researchCandidateId?:string;
  evidenceRef?:EvidenceRef;
  evidenceId?:string;
  evidenceUri?:string;
  evidenceExcerpt?:EvidenceExcerpt;
  evidenceExcerptId?:string;
  excerptStart?:number;
  excerptEnd?:number;
  gateBreakdown?:GateBreakdown;
  claimGovernance?:ClaimGovernanceReport;
  argumentGovernance?:ArgumentGovernanceReport;
  decisionDossier?:SynthesisDecisionDossier;
  decisionDossierId?:string;
  decisionOverride?:DecisionOverrideReceipt;
  dossierSeal?:DossierSealReceipt;
  dossierSealId?:string;
  dossierVerification?:DossierSealVerificationReceipt;
  dossierTransparency?:DossierTransparencyReceipt;
  dossierTransparencyId?:string;
  dossierCheckpoint?:DossierTransparencyCheckpoint;
  dossierCheckpointId?:string;
  dossierWitness?:DossierTransparencyWitnessReceipt;
  dossierWitnessVerification?:DossierTransparencyWitnessVerificationReceipt;
  dossierTimestamp?:DossierRfc3161TimestampReceipt;
  dossierPublication?:DossierCheckpointPublicationReceipt;
  provenancePolicy?:ProvenanceAssurancePolicyKind;
  provenanceAssurance?:DossierProvenanceAssuranceReport;
  provenanceAssuranceId?:string;
  dossierRelease?:DossierReleaseManifest;
  dossierReleaseId?:string;
  dossierReleaseSeal?:DossierReleaseSealReceipt;
  dossierReleaseSealId?:string;
  dossierReleaseVerification?:DossierReleaseSealVerificationReceipt;
  dossierReleaseTimestamp?:DossierReleaseRfc3161TimestampReceipt;
  dossierReleasePackageFingerprint?:string;
  dossierReleasePublication?:DossierReleasePublicationReceipt;
  dossierReleasePublicationId?:string;
  dossierReleasePublicationAudit?:DossierReleasePublicationAuditReceipt;
  message?:string;
  gateScore?:number;
  override?:boolean;
  turnPlan?:TurnPlan;
  round?:number;
  faultCode?:string;
  outputLabel?:GovernanceLabel;
  actionAllowed?:boolean;
  governanceReason?:string;
}

export interface ThinkTankState{
  sessionId:string;
  seed:string;
  mode:CollaborationMode;
  routerPolicy:RouterPolicy;
  phase:SessionPhase;
  seq:number;
  operatorPrompt:string;
  gateThreshold:number;
  gateScore:number|null;
  gateBreakdown:GateBreakdown|null;
  claimGovernance:ClaimGovernanceReport|null;
  argumentGovernance:ArgumentGovernanceReport|null;
  decisionDossiers:SynthesisDecisionDossier[];
  decisionOverrides:DecisionOverrideReceipt[];
  dossierSeals:DossierSealReceipt[];
  dossierSealVerifications:DossierSealVerificationReceipt[];
  dossierTransparencyEntries:DossierTransparencyReceipt[];
  dossierTransparencyCheckpoints:DossierTransparencyCheckpoint[];
  dossierTransparencyWitnesses:DossierTransparencyWitnessReceipt[];
  dossierTransparencyWitnessVerifications:DossierTransparencyWitnessVerificationReceipt[];
  dossierRfc3161Timestamps:DossierRfc3161TimestampReceipt[];
  dossierCheckpointPublications:DossierCheckpointPublicationReceipt[];
  dossierProvenanceAssurances:DossierProvenanceAssuranceReport[];
  dossierReleaseManifests:DossierReleaseManifest[];
  dossierReleaseSeals:DossierReleaseSealReceipt[];
  dossierReleaseSealVerifications:DossierReleaseSealVerificationReceipt[];
  dossierReleaseRfc3161Timestamps:DossierReleaseRfc3161TimestampReceipt[];
  dossierReleasePublications:DossierReleasePublicationReceipt[];
  dossierReleasePublicationAudits:DossierReleasePublicationAuditReceipt[];
  evidenceRefs:EvidenceRef[];
  evidenceExcerpts:EvidenceExcerpt[];
  claims:Claim[];
  claimBindings:ClaimBinding[];
  claimReviews:ClaimReviewReceipt[];
  argumentReviews:ArgumentReview[];
  researchSearches:ResearchSearchReceipt[];
  researchCandidates:ResearchCandidate[];
  synthesisWithheld:boolean;
  assignments:Assignment[];
  pinnedAssignments:Partial<Record<RoleId,SeatId>>;
  assignmentScores:Partial<Record<RoleId,number>>;
  assignmentReasons:Partial<Record<RoleId,string>>;
  assignmentOrigins:Partial<Record<RoleId,AssignmentOrigin>>;
  seatStatus:Record<SeatId,SeatAvailability>;
  terminalStates:Record<RoleId,TerminalState>;
  lastUtterance:Partial<Record<RoleId,string>>;
  turnPlan:TurnPlan|null;
  currentRound:number;
  speakerIndex:number;
  currentSpeaker:RoleId|null;
  objectionCount:number;
  outputLabel:GovernanceLabel|null;
  actionAllowed:boolean;
  governanceReason:string;
  faultCode:string|null;
  events:ThinkTankEvent[];
}
