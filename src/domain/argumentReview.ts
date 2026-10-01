import type { ArgumentReview,ThinkTankState } from "./types";

export const ARGUMENT_REVIEW_MAX_EXCERPTS=12;
export const ARGUMENT_REVIEW_MAX_CHARS=12000;

const fnv1a32=(text:string)=>{
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return "fnv1a32:"+hash.toString(16).padStart(8,"0");
};

export function argumentReviewBasis(state:ThinkTankState,claimId:string){
  const claim=state.claims.find(item=>item.id===claimId);
  if(!claim)return null;

  const bindings=state.claimBindings
    .filter(binding=>binding.claimId===claimId)
    .map(binding=>{
      const evidence=state.evidenceRefs.find(ref=>ref.id===binding.evidenceId);
      const excerpts=state.evidenceExcerpts
        .filter(excerpt=>excerpt.evidenceId===binding.evidenceId)
        .map(excerpt=>({
          id:excerpt.id,
          evidenceId:excerpt.evidenceId,
          sourceSha256:excerpt.sourceSha256,
          projectionSha256:excerpt.projectionSha256,
          excerptSha256:excerpt.excerptSha256,
          startChar:excerpt.startChar,
          endChar:excerpt.endChar,
          text:excerpt.text
        }))
        .sort((a,b)=>a.id.localeCompare(b.id));

      return {
        id:binding.id,
        evidenceId:binding.evidenceId,
        relation:binding.relation,
        note:binding.note??"",
        evidence:evidence?{
          verification:evidence.verification,
          kind:evidence.kind,
          uri:evidence.uri??"",
          retrievalSha256:evidence.retrieval?.sha256??""
        }:null,
        excerpts
      };
    })
    .sort((a,b)=>a.id.localeCompare(b.id));

  return {
    claim:{id:claim.id,text:claim.text},
    bindings
  };
}

export function argumentReviewBasisFingerprint(state:ThinkTankState,claimId:string){
  const basis=argumentReviewBasis(state,claimId);
  return basis?fnv1a32(JSON.stringify(basis)):null;
}

export function argumentReviewEligibleExcerpts(state:ThinkTankState,claimId:string){
  const boundEvidence=new Set(
    state.claimBindings
      .filter(binding=>binding.claimId===claimId)
      .map(binding=>binding.evidenceId)
  );

  return state.evidenceExcerpts
    .filter(excerpt=>boundEvidence.has(excerpt.evidenceId))
    .sort((a,b)=>a.id.localeCompare(b.id));
}

export function argumentReviewEligibility(state:ThinkTankState,claimId:string){
  const claim=state.claims.find(item=>item.id===claimId);
  if(!claim)return {allowed:false,reason:"Unknown claim.",excerptCount:0,totalChars:0};

  const excerpts=argumentReviewEligibleExcerpts(state,claimId);
  const totalChars=excerpts.reduce((sum,item)=>sum+item.text.length,0);

  if(excerpts.length===0){
    return {
      allowed:false,
      reason:"Pin at least one exact excerpt from evidence bound to this claim.",
      excerptCount:0,
      totalChars:0
    };
  }

  if(excerpts.length>ARGUMENT_REVIEW_MAX_EXCERPTS){
    return {
      allowed:false,
      reason:"Argument review exceeds the "+ARGUMENT_REVIEW_MAX_EXCERPTS+" excerpt limit; narrow the evidence basis.",
      excerptCount:excerpts.length,
      totalChars
    };
  }

  if(totalChars>ARGUMENT_REVIEW_MAX_CHARS){
    return {
      allowed:false,
      reason:"Argument review exceeds the "+ARGUMENT_REVIEW_MAX_CHARS+" character limit; narrow the evidence basis.",
      excerptCount:excerpts.length,
      totalChars
    };
  }

  return {allowed:true,reason:"Review basis ready.",excerptCount:excerpts.length,totalChars};
}

export function argumentReviewIsFresh(state:ThinkTankState,review:ArgumentReview){
  return argumentReviewBasisFingerprint(state,review.claimId)===review.basisFingerprint;
}

export function argumentReviewSummary(state:ThinkTankState){
  const active=state.argumentReviews.filter(review=>review.status!=="dismissed");
  return {
    total:state.argumentReviews.length,
    active:active.length,
    accepted:active.filter(review=>review.status==="accepted").length,
    drafts:active.filter(review=>review.status==="draft").length,
    stale:active.filter(review=>!argumentReviewIsFresh(state,review)).length
  };
}
