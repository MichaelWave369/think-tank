import type {
  DossierReleaseAvailabilityAssuranceReport,
  ReleaseAvailabilityAssurancePolicyKind,
  ReleaseAvailabilityAssuranceRequirementKind,
  ReleaseAvailabilityAssuranceRequirementResult,
  ReleaseAvailabilityPublicationSummary,
  ThinkTankState
} from "./types";
import {releasePackageBasisFingerprint} from "./releasePackage";

export const RELEASE_AVAILABILITY_ASSURANCE_POLICIES:Record<
  ReleaseAvailabilityAssurancePolicyKind,
  ReleaseAvailabilityAssuranceRequirementKind[]
>={
  published:["verified-release-publication"],
  rechecked:["verified-release-publication","successful-recheck"],
  repeated:["verified-release-publication","multiple-rechecks"],
  "multi-origin":[
    "verified-release-publication",
    "multiple-retrieval-origins",
    "rechecked-each-origin"
  ],
  resilient:[
    "verified-release-publication",
    "multiple-retrieval-origins",
    "multiple-rechecks-each-origin"
  ]
};

export const RELEASE_AVAILABILITY_ASSURANCE_POLICY_LABELS:Record<
  ReleaseAvailabilityAssurancePolicyKind,
  string
>={
  published:"Published",
  rechecked:"Rechecked",
  repeated:"Repeated",
  "multi-origin":"Multi-origin",
  resilient:"Resilient"
};

export const RELEASE_AVAILABILITY_ASSURANCE_REQUIREMENT_LABELS:Record<
  ReleaseAvailabilityAssuranceRequirementKind,
  string
>={
  "verified-release-publication":"Verified release publication",
  "successful-recheck":"At least one successful repeat retrieval",
  "multiple-rechecks":"At least two successful repeat retrievals",
  "multiple-retrieval-origins":"At least two distinct retrieval origins",
  "rechecked-each-origin":"At least two origins with a successful repeat retrieval",
  "multiple-rechecks-each-origin":"At least two origins with two successful repeat retrievals"
};

const stable=(value:unknown):string=>{
  if(value===undefined)return "null";
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  const record=value as Record<string,unknown>;
  return "{"+Object.keys(record)
    .filter(key=>record[key]!==undefined)
    .sort()
    .map(key=>JSON.stringify(key)+":"+stable(record[key]))
    .join(",")+"}";
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

const originFor=(raw:string)=>{
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:"||url.username||url.password||url.hash){
      throw new Error("invalid");
    }
    return url.origin;
  }catch{
    throw new Error("Release availability assurance encountered an invalid RPUB retrieval URL.");
  }
};

const matchingEvidence=(
  state:ThinkTankState,
  releaseId:string,
  packageSha256:string
)=>{
  if(!/^[a-f0-9]{64}$/.test(packageSha256)){
    throw new Error("Release availability assurance requires a lowercase SHA-256 package digest.");
  }
  const release=state.dossierReleaseManifests.find(item=>item.id===releaseId);
  if(!release)throw new Error("Release availability assurance requires an existing REL manifest.");

  const publications=state.dossierReleasePublications
    .filter(item=>item.releaseId===releaseId&&item.packageSha256===packageSha256)
    .sort((a,b)=>a.id.localeCompare(b.id));

  if(!publications.length){
    throw new Error("Release availability assurance requires at least one RPUB for the selected package SHA-256.");
  }

  const basisFingerprints=[...new Set(publications.map(item=>item.packageBasisFingerprint))];
  if(basisFingerprints.length!==1){
    throw new Error(
      "RPUB receipts for one package SHA-256 disagree on package-basis fingerprint."
    );
  }

  const publicationIds=new Set(publications.map(item=>item.id));
  const audits=state.dossierReleasePublicationAudits
    .filter(item=>
      publicationIds.has(item.publicationReceiptId)&&
      item.releaseId===releaseId&&
      item.packageSha256===packageSha256&&
      item.exactMatch===true
    )
    .sort((a,b)=>a.id.localeCompare(b.id));

  const summaries:ReleaseAvailabilityPublicationSummary[]=publications.map(publication=>{
    const linked=audits.filter(item=>item.publicationReceiptId===publication.id);
    return {
      publicationReceiptId:publication.id,
      retrievalOrigin:originFor(publication.retrievalUrl),
      auditCount:linked.length,
      auditIds:linked.map(item=>item.id)
    };
  });

  return {
    release,
    publications,
    audits,
    summaries,
    packageBasisFingerprint:basisFingerprints[0]!
  };
};

export const releaseAvailabilityAssuranceBasisFingerprint=(
  state:ThinkTankState,
  releaseId:string,
  packageSha256:string
)=>{
  const evidence=matchingEvidence(state,releaseId,packageSha256);
  return fnv1a32({
    releaseId,
    packageSha256,
    packageBasisFingerprint:evidence.packageBasisFingerprint,
    publications:evidence.publications,
    audits:evidence.audits
  });
};

const resultFor=(
  requirement:ReleaseAvailabilityAssuranceRequirementKind,
  summaries:ReleaseAvailabilityPublicationSummary[],
  publicationIds:string[],
  auditIds:string[]
):ReleaseAvailabilityAssuranceRequirementResult=>{
  const origins=[...new Set(summaries.map(item=>item.retrievalOrigin))].sort();

  if(requirement==="verified-release-publication"){
    return {
      requirement,
      satisfied:publicationIds.length>=1,
      evidenceIds:publicationIds
    };
  }

  if(requirement==="successful-recheck"){
    return {
      requirement,
      satisfied:auditIds.length>=1,
      evidenceIds:auditIds
    };
  }

  if(requirement==="multiple-rechecks"){
    const candidates=summaries.filter(item=>item.auditCount>=2);
    return {
      requirement,
      satisfied:candidates.length>=1,
      evidenceIds:candidates.flatMap(item=>item.auditIds)
    };
  }

  if(requirement==="multiple-retrieval-origins"){
    return {
      requirement,
      satisfied:origins.length>=2,
      evidenceIds:summaries.map(item=>item.publicationReceiptId)
    };
  }

  if(requirement==="rechecked-each-origin"){
    const grouped=new Map<string,ReleaseAvailabilityPublicationSummary[]>();
    for(const summary of summaries){
      grouped.set(summary.retrievalOrigin,[
        ...(grouped.get(summary.retrievalOrigin)??[]),
        summary
      ]);
    }
    const qualifyingOrigins=origins.filter(origin=>
      (grouped.get(origin)??[]).some(item=>item.auditCount>=1)
    );
    const qualifying=new Set(qualifyingOrigins);
    return {
      requirement,
      satisfied:qualifyingOrigins.length>=2,
      evidenceIds:summaries
        .filter(item=>qualifying.has(item.retrievalOrigin)&&item.auditCount>=1)
        .flatMap(item=>[item.publicationReceiptId,...item.auditIds])
    };
  }

  const grouped=new Map<string,ReleaseAvailabilityPublicationSummary[]>();
  for(const summary of summaries){
    grouped.set(summary.retrievalOrigin,[
      ...(grouped.get(summary.retrievalOrigin)??[]),
      summary
    ]);
  }
  const qualifyingOrigins=origins.filter(origin=>
    (grouped.get(origin)??[]).some(item=>item.auditCount>=2)
  );
  const qualifying=new Set(qualifyingOrigins);
  return {
    requirement,
    satisfied:qualifyingOrigins.length>=2,
    evidenceIds:summaries
      .filter(item=>qualifying.has(item.retrievalOrigin)&&item.auditCount>=2)
      .flatMap(item=>[item.publicationReceiptId,...item.auditIds])
  };
};

export function evaluateReleaseAvailabilityAssurance(
  state:ThinkTankState,
  releaseId:string,
  packageSha256:string,
  policy:ReleaseAvailabilityAssurancePolicyKind
):DossierReleaseAvailabilityAssuranceReport{
  const requirements=RELEASE_AVAILABILITY_ASSURANCE_POLICIES[policy];
  if(!requirements)throw new Error("Unsupported release availability assurance policy.");

  const evidence=matchingEvidence(state,releaseId,packageSha256);
  const publicationIds=evidence.publications.map(item=>item.id);
  const auditIds=evidence.audits.map(item=>item.id);
  const retrievalOrigins=[...new Set(evidence.summaries.map(item=>item.retrievalOrigin))].sort();
  const results=requirements.map(requirement=>
    resultFor(requirement,evidence.summaries,publicationIds,auditIds)
  );
  const missing=results.filter(item=>!item.satisfied).map(item=>item.requirement);
  const passed=missing.length===0;
  const basisFingerprint=releaseAvailabilityAssuranceBasisFingerprint(
    state,
    releaseId,
    packageSha256
  );

  let packageStatus:"current"|"historical"="historical";
  try{
    packageStatus=
      releasePackageBasisFingerprint(state,releaseId)===evidence.packageBasisFingerprint
        ?"current"
        :"historical";
  }catch{
    packageStatus="historical";
  }

  const reason=passed
    ?"Policy satisfied by recorded RPUB/RAUD observations for this exact release package."
    :"Policy missing: "+missing.map(item=>RELEASE_AVAILABILITY_ASSURANCE_REQUIREMENT_LABELS[item]).join("; ")+
      ". Availability observations never establish continuous uptime.";

  return {
    id:"RAVA-"+releaseId+"-"+policy+"-"+basisFingerprint.replace("fnv1a32:",""),
    releaseId,
    packageBasisFingerprint:evidence.packageBasisFingerprint,
    packageSha256,
    policy,
    basisFingerprint,
    packageStatus,
    requirements:results,
    missing,
    publicationIds,
    auditIds,
    retrievalOrigins,
    publications:evidence.summaries,
    passed,
    reason,
    continuousAvailability:false,
    immutabilityAuthority:false,
    originIndependenceAuthority:false,
    truthAuthority:false
  };
}

export function releaseAvailabilityAssuranceIsFresh(
  state:ThinkTankState,
  report:DossierReleaseAvailabilityAssuranceReport
){
  try{
    return report.basisFingerprint===releaseAvailabilityAssuranceBasisFingerprint(
      state,
      report.releaseId,
      report.packageSha256
    );
  }catch{
    return false;
  }
}
