import type { EvidenceRef,GateBreakdown,RoleId,SeatId,ThinkTankState } from "./types";

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const round=(value:number)=>Number(value.toFixed(4));

const verificationWeight=(ref:EvidenceRef)=>{
  if(ref.verification==="machine-verified")return 1;
  if(ref.verification==="operator-attested")return .65;
  return .1;
};

export function evaluateEvidence(state:ThinkTankState):GateBreakdown{
  const planRoles=state.turnPlan?.speakerQueue??[];
  const roleSet=new Set<RoleId>(planRoles);
  const providerEvents=state.events.filter(event=>
    event.source==="provider"&&
    Boolean(event.roleId)&&
    (event.kind==="utterance.complete"||event.kind==="challenge.raised")
  );

  const completedRoles=new Set(
    providerEvents.map(event=>event.roleId).filter((roleId):roleId is RoleId=>Boolean(roleId))
  );

  const provenanceItems=providerEvents.map(event=>
    event.providerModel&&event.providerLatencyMs!==undefined&&event.seatId?1:.5
  );
  const provenance=provenanceItems.length
    ?provenanceItems.reduce((sum,value)=>sum+value,0)/provenanceItems.length
    :0;

  const roleCoverage=roleSet.size
    ?[...roleSet].filter(roleId=>completedRoles.has(roleId)).length/roleSet.size
    :0;

  const providerSeats=new Set<SeatId>(
    providerEvents.map(event=>event.seatId).filter((seatId):seatId is SeatId=>Boolean(seatId))
  );
  const expectedSeatBreadth=Math.max(1,Math.min(3,roleSet.size));
  const seatDiversity=clamp(providerSeats.size/expectedSeatBreadth);

  const challengerRequired=roleSet.has("challenger");
  const challengeCoverage=challengerRequired
    ?(state.objectionCount>0?1:0)
    :1;

  const externalRefs=state.evidenceRefs.filter(ref=>ref.kind!=="provider-output");
  const verifiedEvidenceCount=externalRefs.filter(ref=>ref.verification==="machine-verified").length;
  const attestedEvidenceCount=externalRefs.filter(ref=>ref.verification==="operator-attested").length;

  const quality=externalRefs.length
    ?externalRefs.reduce((sum,ref)=>sum+verificationWeight(ref),0)/externalRefs.length
    :0;
  const breadth=clamp(externalRefs.length/2);
  const externalSupport=quality*breadth;

  const rawScore=
    provenance*.20+
    roleCoverage*.20+
    seatDiversity*.10+
    challengeCoverage*.15+
    externalSupport*.35;

  let cap=1;
  let capReason="Evidence packet may use the full scoring range.";

  if(verifiedEvidenceCount===0&&attestedEvidenceCount===0){
    cap=.65;
    capReason="No verified or operator-attested external evidence; model output alone cannot pass the normal Reality Gate.";
  }else if(verifiedEvidenceCount===0&&attestedEvidenceCount<2){
    cap=.74;
    capReason="Only one operator-attested external reference; a single attestation cannot pass the normal 0.75 threshold.";
  }

  const finalScore=Math.min(rawScore,cap);

  return {
    provenance:round(provenance),
    roleCoverage:round(roleCoverage),
    seatDiversity:round(seatDiversity),
    challengeCoverage:round(challengeCoverage),
    externalSupport:round(externalSupport),
    rawScore:round(rawScore),
    finalScore:round(finalScore),
    cap:round(cap),
    capReason,
    evidenceCount:externalRefs.length,
    verifiedEvidenceCount,
    attestedEvidenceCount
  };
}
