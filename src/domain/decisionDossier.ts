import { evaluateArgumentGovernance } from "./argumentGovernance";
import { evaluateClaimGovernance } from "./claimGovernance";
import type {
  DecisionOverrideReceipt,
  GovernanceLabel,
  SynthesisDecisionDossier,
  ThinkTankState
} from "./types";

const stable=(value:unknown):string=>{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  const record=value as Record<string,unknown>;
  return "{"+Object.keys(record).sort().map(key=>JSON.stringify(key)+":"+stable(record[key])).join(",")+"}";
};

const fnv1a32=(value:unknown)=>{
  const text=stable(value);
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return "fnv1a32:"+hash.toString(16).padStart(8,"0");
};

const currentRunStartSeq=(state:ThinkTankState)=>{
  const started=[...state.events].reverse().find(event=>event.kind==="session.started");
  return started?.seq??0;
};

export const decisionExecutionSource=(
  state:ThinkTankState,
  decisionSeq:number
):"live-provider"|"simulation-fixture"|"governed-system"=>{
  const runStart=currentRunStartSeq(state);
  const runEvents=state.events.filter(event=>event.seq>=runStart&&event.seq<=decisionSeq);
  if(runEvents.some(event=>event.source==="provider"))return "live-provider";
  if(runEvents.some(event=>event.source==="simulator"))return "simulation-fixture";
  return "governed-system";
};

export function decisionDossierBasis(
  state:ThinkTankState,
  decisionSeq:number,
  outcome:"completed"|"withheld",
  outputLabel:GovernanceLabel,
  actionAllowed:boolean,
  governanceReason:string
){
  const runStart=currentRunStartSeq(state);
  const claimGovernance=evaluateClaimGovernance(state,state.mode);
  const argumentGovernance=evaluateArgumentGovernance(state,state.mode);

  return {
    sessionId:state.sessionId,
    seed:state.seed,
    decisionSeq,
    mode:state.mode,
    executionSource:decisionExecutionSource(state,decisionSeq),
    operatorPrompt:state.operatorPrompt,
    outcome,
    outputLabel,
    actionAllowed,
    gateScore:state.gateScore??0,
    gateThreshold:state.gateThreshold,
    gateBreakdown:state.gateBreakdown,
    claimGovernance,
    argumentGovernance,
    objectionCount:state.objectionCount,
    faultCode:state.faultCode??"",
    governanceReason,
    assignments:[...state.assignments]
      .map(item=>({...item}))
      .sort((a,b)=>a.roleId.localeCompare(b.roleId)),
    claims:[...state.claims]
      .map(claim=>({id:claim.id,text:claim.text}))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    bindings:[...state.claimBindings]
      .map(binding=>({
        id:binding.id,
        claimId:binding.claimId,
        evidenceId:binding.evidenceId,
        relation:binding.relation,
        note:binding.note??""
      }))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    evidence:[...state.evidenceRefs]
      .map(ref=>({
        id:ref.id,
        verification:ref.verification,
        kind:ref.kind,
        uri:ref.uri??"",
        retrievalSha256:ref.retrieval?.sha256??"",
        researchCandidateId:ref.researchCandidateId??""
      }))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    excerpts:[...state.evidenceExcerpts]
      .map(excerpt=>({
        id:excerpt.id,
        evidenceId:excerpt.evidenceId,
        sourceSha256:excerpt.sourceSha256,
        projectionSha256:excerpt.projectionSha256,
        excerptSha256:excerpt.excerptSha256,
        startChar:excerpt.startChar,
        endChar:excerpt.endChar
      }))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    claimReviews:[...state.claimReviews]
      .map(review=>({
        id:review.id,
        claimId:review.claimId,
        basisFingerprint:review.basisFingerprint,
        coverageState:review.coverageState
      }))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    argumentReviews:[...state.argumentReviews]
      .map(review=>({
        id:review.id,
        claimId:review.claimId,
        status:review.status,
        basisFingerprint:review.basisFingerprint,
        providerModel:review.providerModel,
        providerRequestId:review.providerRequestId??""
      }))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    providerTurns:state.events
      .filter(event=>
        event.seq>runStart&&
        event.source==="provider"&&
        Boolean(event.roleId)&&
        Boolean(event.seatId)&&
        (event.kind==="utterance.complete"||event.kind==="challenge.raised")
      )
      .map(event=>({
        seq:event.seq,
        roleId:event.roleId!,
        seatId:event.seatId!,
        providerModel:event.providerModel??"",
        providerRequestId:event.providerRequestId??""
      }))
  };
}

export function buildSynthesisDecisionDossier(
  state:ThinkTankState,
  decisionSeq:number,
  outcome:"completed"|"withheld",
  outputLabel:GovernanceLabel,
  actionAllowed:boolean,
  governanceReason:string
):SynthesisDecisionDossier{
  const basis=decisionDossierBasis(
    state,decisionSeq,outcome,outputLabel,actionAllowed,governanceReason
  );

  return {
    id:"DOS-"+String(decisionSeq).padStart(4,"0"),
    ...basis,
    basisFingerprint:fnv1a32(basis)
  };
}

export function latestDecisionDossier(state:ThinkTankState){
  return [...state.decisionDossiers].sort((a,b)=>b.decisionSeq-a.decisionSeq)[0]??null;
}

export function buildDecisionOverrideReceipt(
  state:ThinkTankState,
  overrideSeq:number,
  outputLabel:GovernanceLabel,
  reason:string
):DecisionOverrideReceipt{
  const dossier=latestDecisionDossier(state);
  if(!dossier||dossier.outcome!=="withheld"){
    throw new Error("Operator override requires a prior withheld decision dossier.");
  }
  if(state.decisionOverrides.some(item=>item.dossierId===dossier.id)){
    throw new Error("Decision dossier already has an operator override.");
  }

  return {
    id:"OVR-"+String(overrideSeq).padStart(4,"0"),
    dossierId:dossier.id,
    overrideSeq,
    outputLabel,
    actionAllowed:true,
    reason
  };
}

export function overrideForDossier(state:ThinkTankState,dossierId:string){
  return state.decisionOverrides.find(item=>item.dossierId===dossierId)??null;
}
