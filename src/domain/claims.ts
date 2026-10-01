import type { ClaimBinding,ClaimStatus,ThinkTankState } from "./types";

export function claimBindingsFor(state:ThinkTankState,claimId:string):ClaimBinding[]{
  return state.claimBindings.filter(binding=>binding.claimId===claimId);
}

export function claimStatusFromBindings(bindings:ClaimBinding[]):ClaimStatus{
  if(bindings.length===0)return "unbound";

  const supports=bindings.some(binding=>binding.relation==="supports");
  const contradicts=bindings.some(binding=>binding.relation==="contradicts");
  const context=bindings.some(binding=>binding.relation==="context");

  if(supports&&contradicts)return "contested";
  if(supports)return "supported";
  if(contradicts)return "challenged";
  if(context)return "context-only";
  return "unbound";
}

export function claimStatus(state:ThinkTankState,claimId:string):ClaimStatus{
  return claimStatusFromBindings(claimBindingsFor(state,claimId));
}

export function claimGraphSummary(state:ThinkTankState){
  const statuses=state.claims.map(claim=>claimStatus(state,claim.id));
  return {
    total:state.claims.length,
    unbound:statuses.filter(status=>status==="unbound").length,
    supported:statuses.filter(status=>status==="supported").length,
    challenged:statuses.filter(status=>status==="challenged").length,
    contested:statuses.filter(status=>status==="contested").length,
    contextOnly:statuses.filter(status=>status==="context-only").length,
    bindings:state.claimBindings.length
  };
}
