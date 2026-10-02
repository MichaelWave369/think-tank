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
