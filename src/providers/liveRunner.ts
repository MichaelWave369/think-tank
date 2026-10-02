import { planAssignments,routingEventInputs } from "../domain/craneFly";
import { evaluateEvidence } from "../domain/evidence";
import { evaluateClaimGovernance } from "../domain/claimGovernance";
import { evaluateArgumentGovernance } from "../domain/argumentGovernance";
import { projectEvent } from "../domain/reducer";
import { evaluateGovernance,initialTurnPlan } from "../domain/scheduler";
import type { RoleId,Seat,ThinkTankEvent,ThinkTankEventInput,ThinkTankState } from "../domain/types";
import { buildEvent } from "../kernel/eventKernel";
import { buildRoleMessages } from "./rolePrompts";
import type { ProviderInvokeRequest,ProviderInvokeResponse } from "./types";

export interface LiveRunnerOptions{
  initialState:ThinkTankState;
  seats:Seat[];
  prompt:string;
  localModel?:string;
  signal?:AbortSignal;
  invoke:(request:ProviderInvokeRequest,signal?:AbortSignal)=>Promise<ProviderInvokeResponse>;
  apply:(event:ThinkTankEvent)=>void;
}

export interface LiveRunnerResult{
  state:ThinkTankState;
  completed:boolean;
  aborted:boolean;
  error?:string;
}

const phaseForRole=(roleId:RoleId)=>roleId==="challenger"?"challenge":roleId==="vessie"?"synthesis":"independent";

export const requireLiveDirective=(prompt:string)=>{
  const directive=prompt.trim();
  if(!directive){
    throw new Error("LIVE provider execution requires a non-empty operator directive.");
  }
  return directive;
};

export async function runLiveProviderSession(options:LiveRunnerOptions):Promise<LiveRunnerResult>{
  let working=options.initialState;

  const emit=(input:ThinkTankEventInput)=>{
    const event=buildEvent(working,input);
    working=projectEvent(working,event);
    options.apply(event);
    return event;
  };

  const aborted=()=>Boolean(options.signal?.aborted);

  try{
    const directive=requireLiveDirective(options.prompt);
    const plan=planAssignments(working,options.seats,working.mode);
    if(plan.unresolved.length){
      throw new Error("Crane Fly cannot staff: "+plan.unresolved.map(role=>role.toUpperCase()).join(", ")+".");
    }

    emit({
      source:"operator",
      kind:"operator.prompt",
      phase:"intake",
      message:directive
    });

    for(const input of routingEventInputs(plan)){
      if(aborted())return {state:working,completed:false,aborted:true};
      emit(input);
    }

    emit({
      source:"system",
      kind:"session.started",
      phase:"routing",
      message:"LIVE provider session opened."
    });

    const turnPlan=initialTurnPlan(working.mode);
    emit({
      source:"system",
      kind:"schedule.planned",
      phase:"routing",
      turnPlan,
      message:"LIVE scheduler locked "+turnPlan.speakerQueue.join(" → ")+"."
    });

    emit({
      source:"system",
      kind:"round.started",
      phase:"independent",
      round:1,
      message:"LIVE round 1 started."
    });

    for(const roleId of turnPlan.speakerQueue){
      if(aborted())return {state:working,completed:false,aborted:true};

      const assignment=working.assignments.find(item=>item.roleId===roleId);
      if(!assignment)throw new Error("No live seat assignment exists for "+roleId.toUpperCase()+".");

      emit({
        source:"system",
        kind:"turn.started",
        phase:phaseForRole(roleId),
        roleId,
        seatId:assignment.seatId,
        message:"LIVE "+roleId.toUpperCase()+" turn routed to "+assignment.seatId.toUpperCase()+"."
      });

      try{
        const response=await options.invoke({
          seatId:assignment.seatId,
          roleId,
          model:assignment.seatId==="local"?options.localModel:undefined,
          messages:buildRoleMessages(roleId,working.mode,working.operatorPrompt,working.lastUtterance)
        },options.signal);

        if(aborted())return {state:working,completed:false,aborted:true};

        emit({
          source:"provider",
          kind:roleId==="challenger"?"challenge.raised":"utterance.complete",
          phase:phaseForRole(roleId),
          roleId,
          seatId:assignment.seatId,
          providerModel:response.model,
          providerLatencyMs:response.latencyMs,
          providerRequestId:response.requestId,
          message:response.text
        });
      }catch(error){
        if(aborted())return {state:working,completed:false,aborted:true};

        const message=error instanceof Error?error.message:String(error);
        emit({
          source:"provider",
          kind:"provider.failed",
          phase:phaseForRole(roleId),
          roleId,
          seatId:assignment.seatId,
          faultCode:"PROVIDER_FAILED",
          governanceReason:message,
          message:"Provider failure on "+roleId.toUpperCase()+": "+message
        });
        emit({
          source:"system",
          kind:"governance.fault",
          phase:"synthesis",
          faultCode:"PROVIDER_FAILED",
          governanceReason:"LIVE provider execution failed before the scheduled queue completed.",
          message:"Governance fault after provider failure."
        });

        const claimGovernance=evaluateClaimGovernance(working,working.mode);
        const argumentGovernance=evaluateArgumentGovernance(working,working.mode);
        const decision=evaluateGovernance(
          working.mode,0,working.gateThreshold,working.objectionCount,true,
          claimGovernance,argumentGovernance
        );
        emit({
          source:"system",
          kind:"synthesis.withheld",
          phase:"synthesis",
          claimGovernance,
          argumentGovernance,
          outputLabel:decision.outputLabel,
          actionAllowed:decision.actionAllowed,
          governanceReason:decision.reason,
          message:"Synthesis withheld after provider failure."
        });

        return {state:working,completed:false,aborted:false,error:message};
      }
    }

    const gateBreakdown=evaluateEvidence(working);
    emit({
      source:"system",
      kind:"gate.scored",
      phase:"synthesis",
      gateScore:gateBreakdown.finalScore,
      gateBreakdown,
      message:
        "Reality Gate evaluated evidence packet at "+gateBreakdown.finalScore.toFixed(2)+
        " (raw "+gateBreakdown.rawScore.toFixed(2)+", cap "+gateBreakdown.cap.toFixed(2)+")."
    });

    const claimGovernance=evaluateClaimGovernance(working,working.mode);
    const argumentGovernance=evaluateArgumentGovernance(working,working.mode);
    const decision=evaluateGovernance(
      working.mode,
      gateBreakdown.finalScore,
      working.gateThreshold,
      working.objectionCount,
      false,
      claimGovernance,
      argumentGovernance
    );

    emit({
      source:"system",
      kind:decision.synthesisAllowed?"synthesis.completed":"synthesis.withheld",
      claimGovernance,
      argumentGovernance,
      phase:decision.synthesisAllowed?"complete":"synthesis",
      outputLabel:decision.outputLabel,
      actionAllowed:decision.actionAllowed,
      governanceReason:decision.reason,
      message:decision.synthesisAllowed
        ?"LIVE session completed under "+working.mode.toUpperCase()+" gate law as "+decision.outputLabel+"."
        :"LIVE synthesis withheld by the deterministic evidence gate."
    });

    return {state:working,completed:true,aborted:false};
  }catch(error){
    return {
      state:working,
      completed:false,
      aborted:aborted(),
      error:error instanceof Error?error.message:String(error)
    };
  }
}
