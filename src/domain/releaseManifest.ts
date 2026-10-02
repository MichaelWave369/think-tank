import type {
  DossierProvenanceAssuranceReport,
  DossierReleaseManifest,
  ProvenanceAssurancePolicyKind,
  ThinkTankState
} from "./types";
import {provenanceAssuranceIsFresh} from "./provenanceAssurance";

const stable=(value:unknown):string=>{
  if(value===undefined)return "null";
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  const record=value as Record<string,unknown>;
  return "{"+Object.keys(record)
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

export function releaseEligibleAssurance(
  state:ThinkTankState,
  dossierId:string,
  policy:ProvenanceAssurancePolicyKind,
  assuranceReportId?:string
):DossierProvenanceAssuranceReport|null{
  const reports=state.dossierProvenanceAssurances.filter(item=>
    item.dossierId===dossierId&&
    item.policy===policy&&
    item.passed&&
    item.truthAuthority===false&&
    provenanceAssuranceIsFresh(state,item)
  );

  if(assuranceReportId){
    return reports.find(item=>item.id===assuranceReportId)??null;
  }
  return reports[reports.length-1]??null;
}

export function releaseArtifactIds(
  state:ThinkTankState,
  report:DossierProvenanceAssuranceReport
):string[]{
  const dossier=state.decisionDossiers.find(item=>item.id===report.dossierId);
  if(!dossier)throw new Error("Release manifest requires an existing decision dossier.");

  const override=[...state.decisionOverrides]
    .reverse()
    .find(item=>item.dossierId===dossier.id);

  return [...new Set([
    dossier.id,
    override?.id??"",
    report.id,
    ...report.requirements.flatMap(item=>item.evidenceIds)
  ].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

export function buildDossierReleaseManifest(
  state:ThinkTankState,
  dossierId:string,
  policy:ProvenanceAssurancePolicyKind,
  assuranceReportId:string
):DossierReleaseManifest{
  const dossier=state.decisionDossiers.find(item=>item.id===dossierId);
  if(!dossier)throw new Error("Release manifest requires an existing decision dossier.");

  const report=releaseEligibleAssurance(state,dossierId,policy,assuranceReportId);
  if(!report){
    throw new Error(
      "Release requires an existing fresh passing provenance assurance report for the selected policy."
    );
  }
  if(!report.checkpointId){
    throw new Error("Release assurance must reference a checkpoint.");
  }

  const override=[...state.decisionOverrides]
    .reverse()
    .find(item=>item.dossierId===dossier.id);
  const artifactIds=releaseArtifactIds(state,report);

  const basis={
    schemaVersion:1 as const,
    dossierId:dossier.id,
    policy,
    assuranceReportId:report.id,
    assuranceBasisFingerprint:report.basisFingerprint,
    checkpointId:report.checkpointId,
    operatorOverrideId:override?.id??"",
    artifactIds,
    releaseAuthority:"fresh-passing-provenance-policy" as const,
    truthAuthority:false as const
  };
  const manifestFingerprint=fnv1a32(basis);

  return {
    id:
      "REL-"+dossier.id+"-"+policy+"-"+
      manifestFingerprint.replace("fnv1a32:",""),
    ...basis,
    manifestFingerprint
  };
}

export function releaseManifestIsCurrent(
  state:ThinkTankState,
  manifest:DossierReleaseManifest
){
  try{
    const expected=buildDossierReleaseManifest(
      state,
      manifest.dossierId,
      manifest.policy,
      manifest.assuranceReportId
    );
    return stable(expected)===stable(manifest);
  }catch{
    return false;
  }
}
