import type {
  DossierProvenanceAssuranceReport,
  ProvenanceAssurancePolicyKind,
  ProvenanceAssuranceRequirementKind,
  ProvenanceAssuranceRequirementResult,
  ThinkTankState
} from "./types";

export const PROVENANCE_ASSURANCE_POLICIES:Record<
  ProvenanceAssurancePolicyKind,
  ProvenanceAssuranceRequirementKind[]
>={
  integrity:["verified-seal","journal-entry","checkpoint"],
  witnessed:["verified-seal","journal-entry","checkpoint","verified-witness"],
  "time-attested":["verified-seal","journal-entry","checkpoint","rfc3161-time"],
  published:["verified-seal","journal-entry","checkpoint","verified-publication"],
  "full-provenance":[
    "verified-seal",
    "journal-entry",
    "checkpoint",
    "verified-witness",
    "rfc3161-time",
    "verified-publication"
  ]
};

export const PROVENANCE_ASSURANCE_POLICY_LABELS:Record<ProvenanceAssurancePolicyKind,string>={
  integrity:"Integrity",
  witnessed:"Witnessed",
  "time-attested":"Time-attested",
  published:"Published",
  "full-provenance":"Full provenance"
};

export const PROVENANCE_ASSURANCE_REQUIREMENT_LABELS:Record<
  ProvenanceAssuranceRequirementKind,
  string
>={
  "verified-seal":"Verified dossier seal",
  "journal-entry":"Transparency journal entry",
  checkpoint:"Portable checkpoint",
  "verified-witness":"Verified detached witness",
  "rfc3161-time":"RFC 3161 time attestation",
  "verified-publication":"Verified external publication"
};

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

const linkedArtifacts=(state:ThinkTankState,dossierId:string)=>{
  const seals=state.dossierSeals.filter(item=>item.dossierId===dossierId);
  const sealIds=new Set(seals.map(item=>item.id));

  const sealVerifications=state.dossierSealVerifications
    .filter(item=>sealIds.has(item.sealId));

  const journalEntries=state.dossierTransparencyEntries
    .filter(item=>sealIds.has(item.sealId));
  const journalEntryIds=new Set(journalEntries.map(item=>item.id));

  const checkpoints=state.dossierTransparencyCheckpoints
    .filter(item=>journalEntryIds.has(item.headEntryId));
  const checkpointIds=new Set(checkpoints.map(item=>item.id));

  const witnesses=state.dossierTransparencyWitnesses
    .filter(item=>checkpointIds.has(item.checkpointId));
  const witnessIds=new Set(witnesses.map(item=>item.id));

  const witnessVerifications=state.dossierTransparencyWitnessVerifications
    .filter(item=>witnessIds.has(item.witnessId));

  const timestamps=state.dossierRfc3161Timestamps
    .filter(item=>checkpointIds.has(item.checkpointId));

  const publications=state.dossierCheckpointPublications
    .filter(item=>checkpointIds.has(item.checkpointId));

  return {
    seals,
    sealVerifications,
    journalEntries,
    checkpoints,
    witnesses,
    witnessVerifications,
    timestamps,
    publications
  };
};

export const provenanceAssuranceBasisFingerprint=(state:ThinkTankState,dossierId:string)=>{
  const dossier=state.decisionDossiers.find(item=>item.id===dossierId);
  const linked=linkedArtifacts(state,dossierId);
  return fnv1a32({
    dossier:dossier??null,
    seals:linked.seals,
    sealVerifications:linked.sealVerifications,
    journalEntries:linked.journalEntries,
    checkpoints:linked.checkpoints,
    witnesses:linked.witnesses,
    witnessVerifications:linked.witnessVerifications,
    timestamps:linked.timestamps,
    publications:linked.publications
  });
};

const evidenceForCheckpoint=(
  state:ThinkTankState,
  dossierId:string,
  checkpointId:string
):Record<ProvenanceAssuranceRequirementKind,string[]>=>{
  const checkpoint=state.dossierTransparencyCheckpoints.find(item=>item.id===checkpointId);
  const entry=checkpoint
    ?state.dossierTransparencyEntries.find(item=>item.id===checkpoint.headEntryId)
    :undefined;
  const seal=entry
    ?state.dossierSeals.find(item=>item.id===entry.sealId&&item.dossierId===dossierId)
    :undefined;

  const sealVerification=seal
    ?[...state.dossierSealVerifications].reverse()
      .find(item=>item.sealId===seal.id&&item.verified)
    :undefined;

  const witnessPairs=checkpoint
    ?state.dossierTransparencyWitnesses
      .filter(item=>item.checkpointId===checkpoint.id)
      .map(witness=>({
        witness,
        verification:state.dossierTransparencyWitnessVerifications.find(item=>
          item.witnessId===witness.id&&
          item.checkpointId===checkpoint.id&&
          item.verified===true
        )
      }))
      .filter(pair=>Boolean(pair.verification))
    :[];

  const timestamps=checkpoint
    ?state.dossierRfc3161Timestamps.filter(item=>item.checkpointId===checkpoint.id)
    :[];
  const publications=checkpoint
    ?state.dossierCheckpointPublications.filter(item=>item.checkpointId===checkpoint.id)
    :[];

  return {
    "verified-seal":seal&&sealVerification?[seal.id,sealVerification.id]:[],
    "journal-entry":entry?[entry.id]:[],
    checkpoint:checkpoint?[checkpoint.id]:[],
    "verified-witness":witnessPairs.flatMap(pair=>[
      pair.witness.id,
      pair.verification!.id
    ]),
    "rfc3161-time":timestamps.map(item=>item.id),
    "verified-publication":publications.map(item=>item.id)
  };
};

const fallbackEvidence=(
  state:ThinkTankState,
  dossierId:string
):Record<ProvenanceAssuranceRequirementKind,string[]>=>{
  const seals=state.dossierSeals.filter(item=>item.dossierId===dossierId);
  const latestSeal=seals[seals.length-1];
  const sealVerification=latestSeal
    ?[...state.dossierSealVerifications].reverse()
      .find(item=>item.sealId===latestSeal.id&&item.verified)
    :undefined;
  const entries=latestSeal
    ?state.dossierTransparencyEntries.filter(item=>item.sealId===latestSeal.id)
    :[];
  const latestEntry=entries[entries.length-1];

  return {
    "verified-seal":latestSeal&&sealVerification?[latestSeal.id,sealVerification.id]:[],
    "journal-entry":latestEntry?[latestEntry.id]:[],
    checkpoint:[],
    "verified-witness":[],
    "rfc3161-time":[],
    "verified-publication":[]
  };
};

const resultsFor=(
  requirements:ProvenanceAssuranceRequirementKind[],
  evidence:Record<ProvenanceAssuranceRequirementKind,string[]>
):ProvenanceAssuranceRequirementResult[]=>
  requirements.map(requirement=>({
    requirement,
    satisfied:evidence[requirement].length>0,
    evidenceIds:[...evidence[requirement]]
  }));

export function evaluateProvenanceAssurance(
  state:ThinkTankState,
  dossierId:string,
  policy:ProvenanceAssurancePolicyKind
):DossierProvenanceAssuranceReport{
  const dossier=state.decisionDossiers.find(item=>item.id===dossierId);
  if(!dossier)throw new Error("Provenance assurance requires an existing decision dossier.");

  const requirements=PROVENANCE_ASSURANCE_POLICIES[policy];
  if(!requirements)throw new Error("Unsupported provenance assurance policy.");

  const linked=linkedArtifacts(state,dossierId);
  let selectedCheckpointId="";
  let selectedResults:ProvenanceAssuranceRequirementResult[]|null=null;

  for(const checkpoint of [...linked.checkpoints].reverse()){
    const results=resultsFor(
      requirements,
      evidenceForCheckpoint(state,dossierId,checkpoint.id)
    );
    if(results.every(item=>item.satisfied)){
      selectedCheckpointId=checkpoint.id;
      selectedResults=results;
      break;
    }
  }

  if(!selectedResults){
    const latestCheckpoint=linked.checkpoints[linked.checkpoints.length-1];
    if(latestCheckpoint){
      selectedCheckpointId=latestCheckpoint.id;
      selectedResults=resultsFor(
        requirements,
        evidenceForCheckpoint(state,dossierId,latestCheckpoint.id)
      );
    }else{
      selectedResults=resultsFor(requirements,fallbackEvidence(state,dossierId));
    }
  }

  const missing=selectedResults
    .filter(item=>!item.satisfied)
    .map(item=>item.requirement);
  const passed=missing.length===0;

  const selectedCheckpoint=selectedCheckpointId
    ?state.dossierTransparencyCheckpoints.find(item=>item.id===selectedCheckpointId)
    :undefined;
  const latestJournal=state.dossierTransparencyEntries[state.dossierTransparencyEntries.length-1];
  const journalHeadStatus=selectedCheckpoint
    ?latestJournal?.id===selectedCheckpoint.headEntryId
      ?"current" as const
      :"historical" as const
    :"unavailable" as const;

  const basisFingerprint=provenanceAssuranceBasisFingerprint(state,dossierId);
  const reason=passed
    ?"Policy requirements are satisfied by one linked provenance chain."
    :"Missing required provenance: "+
      missing.map(item=>PROVENANCE_ASSURANCE_REQUIREMENT_LABELS[item]).join(", ")+".";

  return {
    id:
      "ASSURE-"+dossierId+"-"+policy+"-"+
      basisFingerprint.replace("fnv1a32:",""),
    dossierId,
    policy,
    basisFingerprint,
    checkpointId:selectedCheckpointId,
    journalHeadStatus,
    requirements:selectedResults,
    missing,
    passed,
    reason,
    truthAuthority:false
  };
}

export function provenanceAssuranceIsFresh(
  state:ThinkTankState,
  report:DossierProvenanceAssuranceReport
){
  return report.basisFingerprint===
    provenanceAssuranceBasisFingerprint(state,report.dossierId);
}
