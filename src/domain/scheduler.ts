import { modeDefinition } from "./modes";
import type {
  CollaborationMode,
  GovernanceLabel,
  ClaimGovernanceReport,
  ThinkTankState,
  TurnPlan
} from "./types";

export interface GovernanceDecision{
  synthesisAllowed:boolean;
  actionAllowed:boolean;
  outputLabel:GovernanceLabel;
  reason:string;
}

export function initialTurnPlan(mode:CollaborationMode):TurnPlan{
  const law=modeDefinition(mode);
  return {
    activeRoles:[...law.activeRoles],
    speakerQueue:[...law.speakerQueue],
    round:0,
    maxRounds:law.maxRounds,
    timeoutMs:law.timeoutMs,
    synthesisTrigger:law.synthesisTrigger,
    gateBehavior:law.gateBehavior,
    outputLabel:law.outputLabel,
    objectionRequired:law.objectionRequired
  };
}

export function evaluateGovernance(
  mode:CollaborationMode,
  score:number,
  threshold:number,
  objectionCount:number,
  timedOut=false,
  claimGovernance?:ClaimGovernanceReport
):GovernanceDecision{
  const law=modeDefinition(mode);

  if(timedOut){
    return {
      synthesisAllowed:false,
      actionAllowed:false,
      outputLabel:"WITHHELD",
      reason:"Scheduled turn timed out before the mode law completed."
    };
  }

  if(law.gateBehavior==="informational"){
    return {
      synthesisAllowed:true,
      actionAllowed:mode!=="dream",
      outputLabel:law.outputLabel,
      reason:mode==="dream"
        ?"Reality Gate is informational in DREAM; result remains SPECULATIVE."
        :"Reality Gate is informational in SOLO."
    };
  }

  if(law.gateBehavior==="threshold-and-objection"&&objectionCount<1){
    return {
      synthesisAllowed:false,
      actionAllowed:false,
      outputLabel:"WITHHELD",
      reason:"DEBATE requires at least one logged objection before synthesis."
    };
  }

  if(law.gateBehavior==="threshold-or-draft"&&score<threshold){
    return {
      synthesisAllowed:true,
      actionAllowed:false,
      outputLabel:"DRAFT",
      reason:"Evidence is below threshold; BUILD output is retained only as DRAFT."
    };
  }

  if(law.gateBehavior==="threshold-or-draft"&&claimGovernance&&!claimGovernance.passed){
    return {
      synthesisAllowed:true,
      actionAllowed:false,
      outputLabel:"DRAFT",
      reason:"Claim review policy is not satisfied; BUILD output is retained only as DRAFT. "+claimGovernance.reason
    };
  }

  if(score<threshold){
    return {
      synthesisAllowed:false,
      actionAllowed:false,
      outputLabel:"WITHHELD",
      reason:"Reality Gate score is below the required threshold."
    };
  }

  if(claimGovernance&&!claimGovernance.passed){
    return {
      synthesisAllowed:false,
      actionAllowed:false,
      outputLabel:"WITHHELD",
      reason:claimGovernance.reason
    };
  }

  return {
    synthesisAllowed:true,
    actionAllowed:true,
    outputLabel:mode==="build"?"READY":law.outputLabel,
    reason:"Mode law satisfied; synthesis may proceed."
  };
}

export function schedulerStatus(state:ThinkTankState):string{
  if(!state.turnPlan)return "UNPLANNED";
  if(state.faultCode)return "FAULT";
  if(state.synthesisWithheld)return "WITHHELD";
  if(state.phase==="complete")return "COMPLETE";
  if(state.currentSpeaker)return "TURN ACTIVE";
  if(state.currentRound>0)return "ROUND "+state.currentRound;
  return "PLANNED";
}
