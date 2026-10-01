import {
  argumentReviewEligibleExcerpts,
  argumentReviewIsFresh
} from "./argumentReview";
import { modeDefinition } from "./modes";
import type {
  ArgumentGovernanceReport,
  CollaborationMode,
  ThinkTankState
} from "./types";

export function evaluateArgumentGovernance(
  state:ThinkTankState,
  mode:CollaborationMode=state.mode
):ArgumentGovernanceReport{
  const law=modeDefinition(mode);
  const applicableClaimIds=state.claims
    .filter(claim=>argumentReviewEligibleExcerpts(state,claim.id).length>0)
    .map(claim=>claim.id);

  const freshAcceptedClaimIds:string[]=[];
  const missingAcceptedClaimIds:string[]=[];
  const staleAcceptedClaimIds:string[]=[];
  const draftOnlyClaimIds:string[]=[];

  for(const claimId of applicableClaimIds){
    const active=state.argumentReviews.filter(review=>
      review.claimId===claimId&&review.status!=="dismissed"
    );
    const accepted=active.filter(review=>review.status==="accepted");
    const freshAccepted=accepted.find(review=>argumentReviewIsFresh(state,review));

    if(freshAccepted){
      freshAcceptedClaimIds.push(claimId);
      continue;
    }

    if(accepted.length){
      staleAcceptedClaimIds.push(claimId);
      continue;
    }

    const freshDraft=active.find(review=>
      review.status==="draft"&&argumentReviewIsFresh(state,review)
    );
    if(freshDraft){
      draftOnlyClaimIds.push(claimId);
      continue;
    }

    missingAcceptedClaimIds.push(claimId);
  }

  if(law.argumentPolicy==="informational"){
    return {
      mode,
      policy:law.argumentPolicy,
      applicableClaimIds,
      freshAcceptedClaimIds,
      missingAcceptedClaimIds,
      staleAcceptedClaimIds,
      draftOnlyClaimIds,
      passed:true,
      reason:"Argument-map policy is informational in "+mode.toUpperCase()+"."
    };
  }

  const passed=
    missingAcceptedClaimIds.length===0&&
    staleAcceptedClaimIds.length===0&&
    draftOnlyClaimIds.length===0;

  let reason:string;
  if(passed){
    reason=applicableClaimIds.length===0
      ?"No excerpt-bearing claims require an accepted argument map in "+mode.toUpperCase()+"."
      :"Fresh accepted argument maps satisfy "+mode.toUpperCase()+" policy for "+
        applicableClaimIds.length+" applicable claim(s).";
  }else{
    const parts:string[]=[];
    if(missingAcceptedClaimIds.length){
      parts.push("missing accepted map: "+missingAcceptedClaimIds.join(", "));
    }
    if(staleAcceptedClaimIds.length){
      parts.push("stale accepted map: "+staleAcceptedClaimIds.join(", "));
    }
    if(draftOnlyClaimIds.length){
      parts.push("draft only: "+draftOnlyClaimIds.join(", "));
    }
    reason="Argument-map policy failed · "+parts.join(" · ")+".";
  }

  return {
    mode,
    policy:law.argumentPolicy,
    applicableClaimIds,
    freshAcceptedClaimIds,
    missingAcceptedClaimIds,
    staleAcceptedClaimIds,
    draftOnlyClaimIds,
    passed,
    reason
  };
}
