import { claimReviewIsFresh,latestClaimReview } from "./claimCoverage";
import { modeDefinition } from "./modes";
import type {
  ClaimGovernanceReport,
  CollaborationMode,
  ThinkTankState
} from "./types";

export function evaluateClaimGovernance(
  state:ThinkTankState,
  mode:CollaborationMode=state.mode
):ClaimGovernanceReport{
  const law=modeDefinition(mode);
  const allClaimIds=state.claims.map(claim=>claim.id);
  const boundClaimIds=state.claims
    .filter(claim=>state.claimBindings.some(binding=>binding.claimId===claim.id))
    .map(claim=>claim.id);

  const applicableClaimIds=
    law.claimPolicy==="bound-fresh"
      ?boundClaimIds
      :allClaimIds;

  const freshClaimIds:string[]=[];
  const missingReviewClaimIds:string[]=[];
  const staleReviewClaimIds:string[]=[];
  const coverageBlockedClaimIds:string[]=[];

  for(const claimId of applicableClaimIds){
    const review=latestClaimReview(state,claimId);

    if(!review){
      missingReviewClaimIds.push(claimId);
      continue;
    }

    if(!claimReviewIsFresh(state,review)){
      staleReviewClaimIds.push(claimId);
      continue;
    }

    freshClaimIds.push(claimId);

    if(
      law.claimPolicy==="audit-ready"&&
      (review.coverageState==="unbound"||review.coverageState==="thin")
    ){
      coverageBlockedClaimIds.push(claimId);
    }
  }

  if(law.claimPolicy==="informational"){
    return {
      mode,
      policy:law.claimPolicy,
      applicableClaimIds,
      freshClaimIds,
      missingReviewClaimIds,
      staleReviewClaimIds,
      coverageBlockedClaimIds,
      passed:true,
      reason:"Claim review policy is informational in "+mode.toUpperCase()+"."
    };
  }

  const passed=
    missingReviewClaimIds.length===0&&
    staleReviewClaimIds.length===0&&
    coverageBlockedClaimIds.length===0;

  let reason:string;
  if(passed){
    reason=applicableClaimIds.length===0
      ?"No claims require review under "+mode.toUpperCase()+" claim policy."
      :"Claim review policy satisfied for "+applicableClaimIds.length+" applicable claim(s).";
  }else{
    const parts:string[]=[];
    if(missingReviewClaimIds.length){
      parts.push("missing review: "+missingReviewClaimIds.join(", "));
    }
    if(staleReviewClaimIds.length){
      parts.push("stale review: "+staleReviewClaimIds.join(", "));
    }
    if(coverageBlockedClaimIds.length){
      parts.push("insufficient AUDIT coverage: "+coverageBlockedClaimIds.join(", "));
    }
    reason="Claim review policy failed · "+parts.join(" · ")+".";
  }

  return {
    mode,
    policy:law.claimPolicy,
    applicableClaimIds,
    freshClaimIds,
    missingReviewClaimIds,
    staleReviewClaimIds,
    coverageBlockedClaimIds,
    passed,
    reason
  };
}
