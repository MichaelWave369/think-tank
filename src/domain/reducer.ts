import type { RoleId,ThinkTankEvent,ThinkTankState,TerminalState } from "./types";
import { routerForMode } from "./modes";

export type ThinkTankAction=
  |{type:"APPLY_EVENT";event:ThinkTankEvent}
  |{type:"RESET";state:ThinkTankState};

const listeningWall=(state:ThinkTankState):Record<keyof ThinkTankState["terminalStates"],TerminalState>=>({
  vessie:state.terminalStates.vessie==="offline"?"offline":"listening",
  dreamer:state.terminalStates.dreamer==="offline"?"offline":"listening",
  builder:state.terminalStates.builder==="offline"?"offline":"listening",
  challenger:state.terminalStates.challenger==="offline"?"offline":"listening",
  archivist:state.terminalStates.archivist==="offline"?"offline":"listening"
});

const scheduledWall=(state:ThinkTankState,activeRoles:RoleId[]):ThinkTankState["terminalStates"]=>{
  const active=new Set(activeRoles);
  const next={...state.terminalStates};

  (Object.keys(next) as RoleId[]).forEach(roleId=>{
    if(next[roleId]==="offline")return;
    next[roleId]=active.has(roleId)?"listening":"dimmed";
  });

  return next;
};

export function projectEvent(state:ThinkTankState,event:ThinkTankEvent):ThinkTankState{
  const next:ThinkTankState={
    ...state,
    seq:event.seq,
    mode:event.mode,
    routerPolicy:routerForMode(event.mode),
    phase:event.phase,
    gateScore:event.gateScore??state.gateScore,
    gateBreakdown:event.gateBreakdown??state.gateBreakdown,
    events:[...state.events,event]
  };

  if(event.kind==="mode.selected"){
    next.turnPlan=null;
    next.currentRound=0;
    next.speakerIndex=0;
    next.currentSpeaker=null;
    next.objectionCount=0;
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.synthesisWithheld=false;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.governanceReason="";
    next.faultCode=null;
    next.terminalStates={vessie:"idle",dreamer:"idle",builder:"idle",challenger:"idle",archivist:"idle"};
  }

  if(event.kind==="operator.prompt"){
    next.operatorPrompt=event.message??"";
  }

  if(event.kind==="claim.added"&&event.claim){
    next.claims=[...state.claims,event.claim];
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Claim graph changed; rerun required.";
  }

  if(event.kind==="claim.removed"&&event.claimId){
    next.claims=state.claims.filter(claim=>claim.id!==event.claimId);
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Claim graph changed; rerun required.";
  }

  if(event.kind==="evidence.bound"&&event.claimBinding){
    next.claimBindings=[...state.claimBindings,event.claimBinding];
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Claim graph changed; rerun required.";
  }

  if(event.kind==="evidence.unbound"&&event.claimBindingId){
    next.claimBindings=state.claimBindings.filter(binding=>binding.id!==event.claimBindingId);
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Claim graph changed; rerun required.";
  }

  if(event.kind==="claim.review.completed"&&event.claimReview){
    next.claimReviews=[...state.claimReviews,event.claimReview];
  }

  if(event.kind==="argument.review.completed"&&event.argumentReview){
    next.argumentReviews=[...state.argumentReviews,event.argumentReview];
  }

  if(event.kind==="argument.review.accepted"&&event.argumentReviewId){
    next.argumentReviews=state.argumentReviews.map(review=>
      review.id===event.argumentReviewId?{...review,status:"accepted"}:review
    );
  }

  if(event.kind==="argument.review.dismissed"&&event.argumentReviewId){
    next.argumentReviews=state.argumentReviews.map(review=>
      review.id===event.argumentReviewId?{...review,status:"dismissed"}:review
    );
  }

  if(event.kind==="research.search.completed"&&event.researchReceipt){
    next.researchSearches=[...state.researchSearches,event.researchReceipt];
    next.researchCandidates=[
      ...state.researchCandidates,
      ...event.researchReceipt.candidates
    ];
  }

  if(event.kind==="evidence.added"&&event.evidenceRef){
    next.evidenceRefs=[
      ...state.evidenceRefs.filter(ref=>ref.id!==event.evidenceRef?.id),
      event.evidenceRef
    ];
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Evidence packet changed; rerun required.";
  }

  if(event.kind==="evidence.removed"&&event.evidenceId){
    next.evidenceRefs=state.evidenceRefs.filter(ref=>ref.id!==event.evidenceId);
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Evidence packet changed; rerun required.";
  }

  if(event.kind==="evidence.excerpt.added"&&event.evidenceExcerpt){
    next.evidenceExcerpts=[
      ...state.evidenceExcerpts.filter(excerpt=>excerpt.id!==event.evidenceExcerpt?.id),
      event.evidenceExcerpt
    ];
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Evidence excerpt changed; rerun required.";
  }

  if(event.kind==="evidence.excerpt.removed"&&event.evidenceExcerptId){
    next.evidenceExcerpts=state.evidenceExcerpts.filter(excerpt=>excerpt.id!==event.evidenceExcerptId);
    next.gateScore=null;
    next.gateBreakdown=null;
    next.claimGovernance=null;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.synthesisWithheld=false;
    next.governanceReason="Evidence excerpt changed; rerun required.";
  }

  if(event.kind==="seat.status"&&event.seatId&&event.seatStatus){
    next.seatStatus={...state.seatStatus,[event.seatId]:event.seatStatus};
  }

  if(event.kind==="role.pinned"&&event.roleId&&event.seatId){
    next.pinnedAssignments={...state.pinnedAssignments,[event.roleId]:event.seatId};
  }

  if(event.kind==="role.unpinned"&&event.roleId){
    const pins={...state.pinnedAssignments};
    delete pins[event.roleId];
    next.pinnedAssignments=pins;
  }

  if(event.kind==="role.assigned"&&event.roleId&&event.seatId){
    next.assignments=[
      ...state.assignments.filter(assignment=>assignment.roleId!==event.roleId),
      {roleId:event.roleId,seatId:event.seatId}
    ];
    next.assignmentScores={...state.assignmentScores,[event.roleId]:event.assignmentScore??0};
    next.assignmentReasons={...state.assignmentReasons,[event.roleId]:event.assignmentReason??event.message??"Assignment updated."};
    next.assignmentOrigins={...state.assignmentOrigins,[event.roleId]:event.assignmentOrigin??"auto"};
  }

  if(event.kind==="routing.completed"){
    next.governanceReason=event.message??state.governanceReason;
  }

  if(event.kind==="session.started"){
    next.turnPlan=null;
    next.currentRound=0;
    next.speakerIndex=0;
    next.currentSpeaker=null;
    next.objectionCount=0;
    next.gateScore=null;
    next.gateBreakdown=null;
    next.synthesisWithheld=false;
    next.outputLabel=null;
    next.actionAllowed=false;
    next.governanceReason="";
    next.faultCode=null;
    next.terminalStates=listeningWall(state);
  }

  if(event.kind==="schedule.planned"&&event.turnPlan){
    next.turnPlan=event.turnPlan;
    next.currentRound=0;
    next.speakerIndex=0;
    next.currentSpeaker=null;
    next.terminalStates=scheduledWall(state,event.turnPlan.activeRoles);
  }

  if(event.kind==="round.started"&&event.round!==undefined){
    next.currentRound=event.round;
    next.speakerIndex=0;
    next.currentSpeaker=null;
  }

  if(event.kind==="turn.started"&&event.roleId){
    next.currentSpeaker=event.roleId;
    next.speakerIndex=state.speakerIndex+1;
    next.terminalStates={...state.terminalStates,[event.roleId]:"speaking"};
  }

  if(event.kind==="turn.timeout"){
    next.currentSpeaker=null;
    next.faultCode=event.faultCode??"TURN_TIMEOUT";
    next.governanceReason=event.governanceReason??"Scheduled turn timed out.";
  }

  if(event.kind==="provider.failed"){
    next.currentSpeaker=null;
    next.faultCode=event.faultCode??"PROVIDER_FAILED";
    next.governanceReason=event.governanceReason??event.message??"Provider execution failed.";
  }

  if(event.roleId&&event.message&&(event.kind==="utterance.complete"||event.kind==="challenge.raised")){
    next.lastUtterance={...state.lastUtterance,[event.roleId]:event.message};
    next.currentSpeaker=null;
    next.terminalStates={
      ...next.terminalStates,
      [event.roleId]:event.kind==="challenge.raised"?"warning":"listening"
    };
  }

  if(event.kind==="challenge.raised"){
    next.objectionCount=state.objectionCount+1;
  }

  if(event.kind==="gate.scored"){
    next.gateScore=event.gateScore??state.gateScore;
    next.gateBreakdown=event.gateBreakdown??state.gateBreakdown;
  }

  if(event.kind==="governance.fault"){
    next.faultCode=event.faultCode??"GOVERNANCE_FAULT";
    next.governanceReason=event.governanceReason??event.message??"Governance fault.";
    next.synthesisWithheld=true;
    next.actionAllowed=false;
    next.outputLabel="WITHHELD";
  }

  if(event.kind==="synthesis.withheld"){
    next.claimGovernance=event.claimGovernance??state.claimGovernance;
    next.synthesisWithheld=true;
    next.actionAllowed=false;
    next.outputLabel=event.outputLabel??"WITHHELD";
    next.governanceReason=event.governanceReason??event.message??"Synthesis withheld.";
  }

  if(event.kind==="synthesis.completed"){
    next.claimGovernance=event.claimGovernance??state.claimGovernance;
    next.synthesisWithheld=false;
    next.actionAllowed=event.actionAllowed??false;
    next.outputLabel=event.outputLabel??"STANDARD";
    next.governanceReason=event.governanceReason??event.message??"Synthesis completed.";
    next.currentSpeaker=null;
  }

  if(event.kind==="operator.override"){
    next.synthesisWithheld=false;
    next.actionAllowed=true;
    next.outputLabel=event.outputLabel??(state.mode==="audit"?"AUDIT":"STANDARD");
    next.governanceReason=event.governanceReason??"Operator override authorized synthesis.";
    next.faultCode=null;
  }

  if(event.kind==="session.aborted"){
    next.phase="aborted";
    next.currentSpeaker=null;
    next.actionAllowed=false;
    next.terminalStates={vessie:"idle",dreamer:"idle",builder:"idle",challenger:"idle",archivist:"idle"};
  }

  return next;
}

export function thinkTankReducer(state:ThinkTankState,action:ThinkTankAction):ThinkTankState{
  if(action.type==="RESET")return action.state;
  return projectEvent(state,action.event);
}
