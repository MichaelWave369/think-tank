import type { DossierReleaseManifest,DossierReleasePublicationReceipt,ThinkTankState } from "./types";

export interface DossierReleasePackage{
  schemaVersion:1;
  releaseManifest:DossierReleaseManifest;
  releaseSeals:ThinkTankState["dossierReleaseSeals"];
  releaseSealVerifications:ThinkTankState["dossierReleaseSealVerifications"];
  releaseRfc3161Timestamps:ThinkTankState["dossierReleaseRfc3161Timestamps"];
  artifacts:unknown[];
}

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

const byId=<T extends {id:string}>(items:T[])=>[...items].sort((a,b)=>a.id.localeCompare(b.id));

export function buildDossierReleasePackage(
  state:ThinkTankState,
  releaseId:string
):DossierReleasePackage{
  const manifest=state.dossierReleaseManifests.find(item=>item.id===releaseId);
  if(!manifest)throw new Error("Release package requires an existing release manifest.");

  const candidates:unknown[]=[
    ...state.decisionDossiers,
    ...state.decisionOverrides,
    ...state.dossierSeals,
    ...state.dossierSealVerifications,
    ...state.dossierTransparencyEntries,
    ...state.dossierTransparencyCheckpoints,
    ...state.dossierTransparencyWitnesses,
    ...state.dossierTransparencyWitnessVerifications,
    ...state.dossierRfc3161Timestamps,
    ...state.dossierCheckpointPublications,
    ...state.dossierProvenanceAssurances
  ];
  const index=new Map<string,unknown>();
  for(const candidate of candidates){
    if(
      candidate&&
      typeof candidate==="object"&&
      "id" in candidate&&
      typeof (candidate as {id?:unknown}).id==="string"
    ){
      index.set((candidate as {id:string}).id,candidate);
    }
  }

  const artifacts=manifest.artifactIds.map(id=>{
    const artifact=index.get(id);
    if(!artifact)throw new Error("Release manifest references missing artifact "+id+".");
    return artifact;
  });

  const releaseSeals=byId(
    state.dossierReleaseSeals.filter(item=>item.releaseId===manifest.id)
  );
  const sealIds=new Set(releaseSeals.map(item=>item.id));
  const releaseSealVerifications=byId(
    state.dossierReleaseSealVerifications.filter(item=>sealIds.has(item.sealId))
  );
  const releaseRfc3161Timestamps=byId(
    state.dossierReleaseRfc3161Timestamps.filter(item=>sealIds.has(item.sealId))
  );

  return {
    schemaVersion:1,
    releaseManifest:manifest,
    releaseSeals,
    releaseSealVerifications,
    releaseRfc3161Timestamps,
    artifacts
  };
}

export function buildDossierReleasePackageForPublication(
  state:ThinkTankState,
  publication:DossierReleasePublicationReceipt
):DossierReleasePackage{
  const manifest=state.dossierReleaseManifests.find(item=>item.id===publication.releaseId);
  if(!manifest)throw new Error("Publication audit requires its historical release manifest.");

  if(
    stable(manifest.artifactIds)!==stable(publication.artifactIds)
  ){
    throw new Error("Publication artifact-id basis no longer matches the release manifest.");
  }

  const candidates:unknown[]=[
    ...state.decisionDossiers,
    ...state.decisionOverrides,
    ...state.dossierSeals,
    ...state.dossierSealVerifications,
    ...state.dossierTransparencyEntries,
    ...state.dossierTransparencyCheckpoints,
    ...state.dossierTransparencyWitnesses,
    ...state.dossierTransparencyWitnessVerifications,
    ...state.dossierRfc3161Timestamps,
    ...state.dossierCheckpointPublications,
    ...state.dossierProvenanceAssurances
  ];
  const index=new Map<string,unknown>();
  for(const candidate of candidates){
    if(
      candidate&&
      typeof candidate==="object"&&
      "id" in candidate&&
      typeof (candidate as {id?:unknown}).id==="string"
    ){
      index.set((candidate as {id:string}).id,candidate);
    }
  }

  const artifacts=publication.artifactIds.map(id=>{
    const artifact=index.get(id);
    if(!artifact)throw new Error("Historical publication references missing artifact "+id+".");
    return artifact;
  });

  const sealIndex=new Map(state.dossierReleaseSeals.map(item=>[item.id,item] as const));
  const verificationIndex=new Map(
    state.dossierReleaseSealVerifications.map(item=>[item.id,item] as const)
  );
  const timestampIndex=new Map(
    state.dossierReleaseRfc3161Timestamps.map(item=>[item.id,item] as const)
  );

  const releaseSeals=publication.releaseSealIds.map(id=>{
    const value=sealIndex.get(id);
    if(!value)throw new Error("Historical publication references missing release seal "+id+".");
    if(value.releaseId!==manifest.id){
      throw new Error("Historical publication references a release seal from another REL manifest.");
    }
    return value;
  });
  const sealIds=new Set(releaseSeals.map(item=>item.id));

  const releaseSealVerifications=publication.releaseVerificationIds.map(id=>{
    const value=verificationIndex.get(id);
    if(!value)throw new Error("Historical publication references missing release verification "+id+".");
    if(!sealIds.has(value.sealId)||value.releaseId!==manifest.id){
      throw new Error("Historical publication contains invalid release verification linkage.");
    }
    return value;
  });

  const releaseRfc3161Timestamps=publication.releaseTimestampIds.map(id=>{
    const value=timestampIndex.get(id);
    if(!value)throw new Error("Historical publication references missing release timestamp "+id+".");
    if(!sealIds.has(value.sealId)||value.releaseId!==manifest.id){
      throw new Error("Historical publication contains invalid release timestamp linkage.");
    }
    return value;
  });

  const packageValue={
    schemaVersion:1 as const,
    releaseManifest:manifest,
    releaseSeals,
    releaseSealVerifications,
    releaseRfc3161Timestamps,
    artifacts
  };

  if(fnv1a32(packageValue)!==publication.packageBasisFingerprint){
    throw new Error("Historical publication package basis no longer reconstructs exactly.");
  }

  return packageValue;
}

export function releasePublicationHistoricalBasisFingerprint(
  state:ThinkTankState,
  publication:DossierReleasePublicationReceipt
){
  return fnv1a32(buildDossierReleasePackageForPublication(state,publication));
}

export function releasePackageBasisFingerprint(
  state:ThinkTankState,
  releaseId:string
){
  return fnv1a32(buildDossierReleasePackage(state,releaseId));
}

export function releasePackageHasVerifiedSeal(
  state:ThinkTankState,
  releaseId:string
){
  const packageValue=buildDossierReleasePackage(state,releaseId);
  const verificationIds=new Set(packageValue.releaseSealVerifications.map(item=>item.sealId));
  return packageValue.releaseSeals.some(item=>verificationIds.has(item.id));
}
