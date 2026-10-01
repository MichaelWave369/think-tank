import type { ThinkTankState } from "../domain/types";
import { stableStringify } from "./stable";

export function projectionSnapshot(state:ThinkTankState){
  return {
    sessionId:state.sessionId,
    seed:state.seed,
    mode:state.mode,
    routerPolicy:state.routerPolicy,
    phase:state.phase,
    seq:state.seq,
    operatorPrompt:state.operatorPrompt,
    gateThreshold:state.gateThreshold,
    gateScore:state.gateScore,
    gateBreakdown:state.gateBreakdown,
    evidenceRefs:state.evidenceRefs,
    claims:state.claims,
    claimBindings:state.claimBindings,
    claimReviews:state.claimReviews,
    researchSearches:state.researchSearches,
    researchCandidates:state.researchCandidates,
    synthesisWithheld:state.synthesisWithheld,
    assignments:state.assignments,
    pinnedAssignments:state.pinnedAssignments,
    assignmentScores:state.assignmentScores,
    assignmentReasons:state.assignmentReasons,
    assignmentOrigins:state.assignmentOrigins,
    seatStatus:state.seatStatus,
    terminalStates:state.terminalStates,
    lastUtterance:state.lastUtterance,
    turnPlan:state.turnPlan,
    currentRound:state.currentRound,
    speakerIndex:state.speakerIndex,
    currentSpeaker:state.currentSpeaker,
    objectionCount:state.objectionCount,
    outputLabel:state.outputLabel,
    actionAllowed:state.actionAllowed,
    governanceReason:state.governanceReason,
    faultCode:state.faultCode
  };
}

export function fingerprintProjection(state:ThinkTankState):string{
  const text=stableStringify(projectionSnapshot(state));
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return "fnv1a32:"+hash.toString(16).padStart(8,"0");
}
