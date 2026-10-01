import { evaluateGovernance,initialTurnPlan } from "../domain/scheduler";
import { evaluateClaimGovernance } from "../domain/claimGovernance";
import { evaluateArgumentGovernance } from "../domain/argumentGovernance";
import { createInitialState } from "../domain/state";
import type { CollaborationMode,RoleId,ThinkTankEventInput,ThinkTankState } from "../domain/types";

export type DemoScenario="happy"|"council-gate-block"|"timeout";

const utteranceFor=(roleId:RoleId,mode:CollaborationMode):string=>{
  const lines:Record<RoleId,string>={
    dreamer:"I am exploring the prompt for latent structure, alternatives, and useful leaps.",
    builder:"I am translating the prompt into an implementable structure with explicit seams.",
    challenger:"Objection logged: assumptions and unsupported transitions must survive scrutiny.",
    archivist:"I am checking continuity, provenance, and whether the ledger can reconstruct the decision.",
    vessie:"I am aligning the scheduled voices and preparing the governed synthesis."
  };
  return lines[roleId]+" MODE="+mode.toUpperCase()+".";
};

export function scenarioEventInputs(
  prompt:string,
  selectedMode:CollaborationMode,
  scenario:DemoScenario,
  governanceState?:ThinkTankState
):ThinkTankEventInput[]{
  const targetMode:CollaborationMode=scenario==="council-gate-block"?"council":selectedMode;
  const claimState=governanceState??createInitialState();
  const claimGovernance=evaluateClaimGovernance(claimState,targetMode);
  const argumentGovernance=evaluateArgumentGovernance(claimState,targetMode);
  const plan=initialTurnPlan(targetMode);
  const inputs:ThinkTankEventInput[]=[];

  if(targetMode!==selectedMode){
    inputs.push({
      source:"operator",
      kind:"mode.selected",
      mode:targetMode,
      phase:"intake",
      message:"Governance drill selected COUNCIL mode."
    });
  }

  inputs.push(
    {
      source:"operator",
      kind:"operator.prompt",
      phase:"intake",
      message:prompt.trim()||("Run "+targetMode.toUpperCase()+" governed demonstration.")
    },
    {
      source:"system",
      kind:"session.started",
      phase:"routing",
      message:"Governed "+targetMode.toUpperCase()+" session opened."
    },
    {
      source:"system",
      kind:"schedule.planned",
      phase:"routing",
      turnPlan:plan,
      message:"Scheduler locked "+plan.speakerQueue.join(" → ")+"; max rounds "+plan.maxRounds+"."
    },
    {
      source:"system",
      kind:"round.started",
      phase:"independent",
      round:1,
      message:"Round 1 started."
    }
  );

  if(scenario==="timeout"){
    const roleId=plan.speakerQueue[0];
    inputs.push(
      {
        source:"simulator",
        kind:"turn.started",
        phase:"independent",
        roleId,
        message:roleId.toUpperCase()+" turn started."
      },
      {
        source:"system",
        kind:"turn.timeout",
        phase:"independent",
        roleId,
        faultCode:"TURN_TIMEOUT",
        governanceReason:"Scheduled speaker exceeded the turn timeout.",
        message:"Turn timeout recorded for "+roleId.toUpperCase()+"."
      },
      {
        source:"system",
        kind:"governance.fault",
        phase:"synthesis",
        faultCode:"TURN_TIMEOUT",
        governanceReason:"Scheduler could not complete the required speaker queue.",
        message:"Governance fault: required queue did not complete."
      }
    );

    const decision=evaluateGovernance(
      targetMode,0,.75,0,true,claimGovernance,argumentGovernance
    );
    inputs.push({
      source:"system",
      kind:"synthesis.withheld",
      phase:"synthesis",
      claimGovernance,
      argumentGovernance,
      outputLabel:decision.outputLabel,
      actionAllowed:decision.actionAllowed,
      governanceReason:decision.reason,
      message:"Synthesis withheld after timeout."
    });

    return inputs;
  }

  let objectionCount=0;

  for(const roleId of plan.speakerQueue){
    inputs.push({
      source:"simulator",
      kind:"turn.started",
      phase:roleId==="challenger"?"challenge":"independent",
      roleId,
      message:roleId.toUpperCase()+" turn started."
    });

    if(roleId==="challenger"){
      objectionCount+=1;
      inputs.push({
        source:"simulator",
        kind:"challenge.raised",
        phase:"challenge",
        roleId,
        message:utteranceFor(roleId,targetMode)
      });
    }else{
      inputs.push({
        source:"simulator",
        kind:"utterance.complete",
        phase:roleId==="vessie"?"synthesis":"independent",
        roleId,
        message:utteranceFor(roleId,targetMode)
      });
    }
  }

  const score=scenario==="council-gate-block"?.52:.88;
  inputs.push({
    source:"system",
    kind:"gate.scored",
    phase:"synthesis",
    gateScore:score,
    message:"Reality Gate scored "+score.toFixed(2)+"."
  });

  const decision=evaluateGovernance(targetMode,score,.75,objectionCount,false,claimGovernance,argumentGovernance);

  inputs.push({
    source:"system",
    kind:decision.synthesisAllowed?"synthesis.completed":"synthesis.withheld",
    phase:decision.synthesisAllowed?"complete":"synthesis",
    claimGovernance,
    argumentGovernance,
    outputLabel:decision.outputLabel,
    actionAllowed:decision.actionAllowed,
    governanceReason:decision.reason,
    message:decision.synthesisAllowed
      ?"Governed synthesis completed as "+decision.outputLabel+"."
      :"Governed synthesis withheld."
  });

  return inputs;
}

/** Compatibility alias for kernel tests and older callers. */
export const demoEventInputs=(prompt:string):ThinkTankEventInput[]=>
  scenarioEventInputs(prompt,"council","council-gate-block");
