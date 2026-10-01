import type {
  ClaimCoverageFlag,
  ClaimCoverageState,
  ClaimReviewReceipt,
  ThinkTankState
} from "./types";

const fnv1a32=(text:string)=>{
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return "fnv1a32:"+hash.toString(16).padStart(8,"0");
};

export function claimCoverageBasis(state:ThinkTankState,claimId:string){
  const claim=state.claims.find(item=>item.id===claimId);
  if(!claim)return null;

  const bindings=state.claimBindings
    .filter(binding=>binding.claimId===claimId)
    .map(binding=>{
      const evidence=state.evidenceRefs.find(ref=>ref.id===binding.evidenceId);
      return {
        id:binding.id,
        evidenceId:binding.evidenceId,
        relation:binding.relation,
        note:binding.note??"",
        evidence:evidence?{
          id:evidence.id,
          verification:evidence.verification,
          kind:evidence.kind,
          uri:evidence.uri??"",
          researchCandidateId:evidence.researchCandidateId??"",
          sha256:evidence.retrieval?.sha256??"",
          excerpts:state.evidenceExcerpts
            .filter(excerpt=>excerpt.evidenceId===evidence.id)
            .map(excerpt=>({
              id:excerpt.id,
              projectionSha256:excerpt.projectionSha256,
              excerptSha256:excerpt.excerptSha256,
              startChar:excerpt.startChar,
              endChar:excerpt.endChar
            }))
            .sort((a,b)=>a.id.localeCompare(b.id))
        }:null
      };
    })
    .sort((a,b)=>a.id.localeCompare(b.id));

  return {
    claim:{id:claim.id,text:claim.text},
    bindings
  };
}

export function claimCoverageFingerprint(state:ThinkTankState,claimId:string){
  const basis=claimCoverageBasis(state,claimId);
  if(!basis)return null;
  return fnv1a32(JSON.stringify(basis));
}

export function evaluateClaimCoverage(
  state:ThinkTankState,
  claimId:string,
  id:string,
  reviewedAt:string
):ClaimReviewReceipt{
  const claim=state.claims.find(item=>item.id===claimId);
  if(!claim)throw new Error("Unknown claim: "+claimId);

  const bindings=state.claimBindings.filter(binding=>binding.claimId===claimId);
  const evidence=bindings
    .map(binding=>state.evidenceRefs.find(ref=>ref.id===binding.evidenceId))
    .filter((ref):ref is NonNullable<typeof ref>=>Boolean(ref));

  const supportCount=bindings.filter(binding=>binding.relation==="supports").length;
  const contradictionCount=bindings.filter(binding=>binding.relation==="contradicts").length;
  const contextCount=bindings.filter(binding=>binding.relation==="context").length;
  const boundEvidenceCount=bindings.length;
  const machineVerifiedCount=evidence.filter(ref=>ref.verification==="machine-verified").length;
  const operatorAttestedCount=evidence.filter(ref=>ref.verification==="operator-attested").length;
  const unverifiedCount=evidence.filter(ref=>ref.verification==="unverified").length;
  const researchLineageCount=evidence.filter(ref=>Boolean(ref.researchCandidateId)).length;

  let coverageState:ClaimCoverageState;
  if(boundEvidenceCount===0)coverageState="unbound";
  else if(supportCount===0&&contradictionCount===0)coverageState="context-only";
  else if(supportCount>0&&contradictionCount>0)coverageState="contested";
  else if(boundEvidenceCount===1)coverageState="thin";
  else coverageState="directional";

  const flags:ClaimCoverageFlag[]=[];
  if(boundEvidenceCount===0)flags.push("no-evidence");
  if(boundEvidenceCount===1)flags.push("single-source");
  if(machineVerifiedCount===0)flags.push("no-machine-verified");
  if(researchLineageCount===0)flags.push("no-research-lineage");
  if(supportCount>0&&contradictionCount===0)flags.push("support-only");
  if(contradictionCount>0&&supportCount===0)flags.push("contradiction-only");
  if(supportCount>0&&contradictionCount>0)flags.push("mixed-direction");
  if(contextCount>0&&supportCount===0&&contradictionCount===0)flags.push("context-only");

  return {
    id,
    claimId,
    reviewedAt,
    basisFingerprint:claimCoverageFingerprint(state,claimId)!,
    coverageState,
    boundEvidenceCount,
    supportCount,
    contradictionCount,
    contextCount,
    machineVerifiedCount,
    operatorAttestedCount,
    unverifiedCount,
    researchLineageCount,
    flags
  };
}

export function latestClaimReview(state:ThinkTankState,claimId:string){
  return [...state.claimReviews].reverse().find(review=>review.claimId===claimId)??null;
}

export function claimReviewIsFresh(state:ThinkTankState,review:ClaimReviewReceipt){
  return claimCoverageFingerprint(state,review.claimId)===review.basisFingerprint;
}

export function claimCoverageSummary(state:ThinkTankState){
  const latest=state.claims.map(claim=>latestClaimReview(state,claim.id));
  return {
    reviewed:latest.filter(Boolean).length,
    stale:latest.filter(review=>review&&!claimReviewIsFresh(state,review)).length,
    unreviewed:latest.filter(review=>!review).length
  };
}
