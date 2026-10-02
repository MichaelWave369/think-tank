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
  return "SIMULATION FIXTURE · "+lines[roleId]+" MODE="+mode.toUpperCase()+".";
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
      message:"SIMULATION FIXTURE · Governance drill selected COUNCIL mode."
    });
  }

  inputs.push(
    {
      source:"operator",
      kind:"operator.prompt",
      phase:"intake",
      message:prompt.trim()||("SIMULATION FIXTURE · Run "+targetMode.toUpperCase()+" governed demonstration.")
    },
    {
      source:"system",
      kind:"session.started",
      phase:"routing",
      message:"SIMULATION FIXTURE · Governed "+targetMode.toUpperCase()+" session opened. No live provider execution."
    },
    {
      source:"system",
      kind:"schedule.planned",
      phase:"routing",
      turnPlan:plan,
      message:"SIMULATION FIXTURE · Scheduler locked "+plan.speakerQueue.join(" → ")+"; max rounds "+plan.maxRounds+"."
    },
    {
      source:"system",
      kind:"round.started",
      phase:"independent",
      round:1,
      message:"SIMULATION FIXTURE · Round 1 started."
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
        message:"SIMULATION FIXTURE · "+roleId.toUpperCase()+" turn started."
      },
      {
        source:"system",
        kind:"turn.timeout",
        phase:"independent",
        roleId,
        faultCode:"TURN_TIMEOUT",
        governanceReason:"Scheduled speaker exceeded the turn timeout.",
        message:"SIMULATION FIXTURE · Turn timeout recorded for "+roleId.toUpperCase()+". Not a live provider timeout."
      },
      {
        source:"system",
        kind:"governance.fault",
        phase:"synthesis",
        faultCode:"TURN_TIMEOUT",
        governanceReason:"Scheduler could not complete the required speaker queue.",
        message:"SIMULATION FIXTURE · Governance fault: required fixture queue did not complete."
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
      message:"SIMULATION FIXTURE · Synthesis withheld after deterministic timeout drill."
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
      message:"SIMULATION FIXTURE · "+roleId.toUpperCase()+" turn started."
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
    message:"SIMULATION FIXTURE SCORE "+score.toFixed(2)+" · deterministic fixture value, not live evidence."
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
      ?"SIMULATION FIXTURE · Governed fixture synthesis completed as "+decision.outputLabel+". Not live-provider evidence."
      :"SIMULATION FIXTURE · Governed fixture synthesis withheld."
  });

  return inputs;
}

/** Compatibility alias for kernel tests and older callers. */
export const demoEventInputs=(prompt:string):ThinkTankEventInput[]=>
  scenarioEventInputs(prompt,"council","council-gate-block");
