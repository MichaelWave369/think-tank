import type {
  ProviderErrorResponse,
  ProviderInvokeRequest,
  ProviderInvokeResponse,
  ProviderStatusResponse,
  EvidenceFetchReceipt,
  EvidenceFetchError,
  ResearchBackendStatusResponse,
  ResearchSearchResponse,
  ResearchSearchError,
  EvidenceProjectionResponse,
  EvidenceExcerptResponse,
  EvidenceProjectionError,
  DossierSealStatusResponse,
  DossierSealResponse,
  DossierVerifyResponse,
  DossierSealError,
  DossierTransparencyStatusResponse,
  DossierTransparencyAppendResponse,
  DossierTransparencyCheckpointResponse,
  DossierWitnessVerifyResponse,
  DossierRfc3161StatusResponse,
  DossierRfc3161TimestampResponse,
  DossierPublicationStatusResponse,
  DossierPublicationResponse,
  DossierReleaseSealStatusResponse,
  DossierReleaseSealResponse,
  DossierReleaseVerifyResponse,
  DossierReleaseRfc3161TimestampResponse,
  DossierReleasePublicationStatusResponse,
  DossierReleasePublicationResponse,
  DossierReleasePublicationAuditResponse,
  DossierPublisherOriginIdentityResponse
} from "./types";

const DEFAULT_BRIDGE="http://127.0.0.1:3691";
export const providerBridgeUrl=(import.meta.env.VITE_PROVIDER_BRIDGE_URL||DEFAULT_BRIDGE).replace(/\/$/,"");

const fetchWithTimeout=async(url:string,init:RequestInit={},timeoutMs=5000)=>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);

  if(init.signal){
    if(init.signal.aborted)controller.abort();
    else init.signal.addEventListener("abort",()=>controller.abort(),{once:true});
  }

  try{
    return await fetch(url,{...init,signal:controller.signal});
  }finally{
    window.clearTimeout(timer);
  }
};

export async function fetchProviderStatus():Promise<ProviderStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/providers/status",{},4000);
  if(!response.ok)throw new Error("Provider bridge status returned HTTP "+response.status+".");
  return response.json() as Promise<ProviderStatusResponse>;
}

export async function invokeProvider(
  request:ProviderInvokeRequest,
  signal?:AbortSignal
):Promise<ProviderInvokeResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/providers/invoke",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(request),
      signal
    },
    180000
  );

  const body=await response.json() as ProviderInvokeResponse|ProviderErrorResponse;
  if(!response.ok||!body.ok){
    const errorBody=body as ProviderErrorResponse;
    throw new Error(errorBody.error?.message||("Provider bridge returned HTTP "+response.status+"."));
  }

  return body;
}


export async function fetchMachineEvidence(
  uri:string,
  signal?:AbortSignal
):Promise<EvidenceFetchReceipt>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/evidence/fetch",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({uri}),
      signal
    },
    30000
  );

  const body=await response.json() as EvidenceFetchReceipt|EvidenceFetchError;
  if(!response.ok||!body.ok){
    const errorBody=body as EvidenceFetchError;
    throw new Error(errorBody.error?.message||("Evidence fetch returned HTTP "+response.status+"."));
  }

  return body;
}


export async function fetchResearchStatus():Promise<ResearchBackendStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/research/status",{},4000);
  if(!response.ok)throw new Error("Research bridge status returned HTTP "+response.status+".");
  return response.json() as Promise<ResearchBackendStatusResponse>;
}

export async function searchResearch(
  query:string,
  signal?:AbortSignal
):Promise<ResearchSearchResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/research/search",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({query}),
      signal
    },
    30000
  );

  const body=await response.json() as ResearchSearchResponse|ResearchSearchError;
  if(!response.ok||!body.ok){
    const errorBody=body as ResearchSearchError;
    throw new Error(errorBody.error?.message||("Research search returned HTTP "+response.status+"."));
  }

  return body;
}


export async function projectMachineEvidence(
  uri:string,
  expectedSha256:string,
  signal?:AbortSignal
):Promise<EvidenceProjectionResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/evidence/extract",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({uri,expectedSha256}),
      signal
    },
    30000
  );

  const body=await response.json() as EvidenceProjectionResponse|EvidenceProjectionError;
  if(!response.ok||!body.ok){
    const errorBody=body as EvidenceProjectionError;
    throw new Error(errorBody.error?.message||("Evidence projection returned HTTP "+response.status+"."));
  }
  return body;
}

export async function pinMachineEvidenceExcerpt(
  uri:string,
  expectedSha256:string,
  startChar:number,
  endChar:number,
  signal?:AbortSignal
):Promise<EvidenceExcerptResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/evidence/extract",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({uri,expectedSha256,startChar,endChar}),
      signal
    },
    30000
  );

  const body=await response.json() as EvidenceExcerptResponse|EvidenceProjectionError;
  if(!response.ok||!body.ok){
    const errorBody=body as EvidenceProjectionError;
    throw new Error(errorBody.error?.message||("Evidence excerpt returned HTTP "+response.status+"."));
  }
  return body;
}


export async function fetchDossierSealStatus():Promise<DossierSealStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/dossier/seal/status",{},4000);
  const body=await response.json() as DossierSealStatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Dossier seal status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function sealDecisionDossier(
  dossier:import("../domain/types").SynthesisDecisionDossier,
  signal?:AbortSignal
):Promise<DossierSealResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/seal",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({dossier}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierSealResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Dossier sealing returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchDossierTransparencyStatus():Promise<DossierTransparencyStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/dossier/transparency/status",{},4000);
  const body=await response.json() as DossierTransparencyStatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Transparency journal status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function appendDossierTransparency(
  seal:import("../domain/types").DossierSealReceipt,
  signal?:AbortSignal
):Promise<DossierTransparencyAppendResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/transparency/append",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({seal}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierTransparencyAppendResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Transparency journal append returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchDossierTransparencyCheckpoint(
  signal?:AbortSignal
):Promise<DossierTransparencyCheckpointResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/transparency/checkpoint",
    {signal},
    10000
  );
  const body=await response.json() as DossierTransparencyCheckpointResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Transparency checkpoint returned HTTP "+response.status+"."));
  }
  return body;
}

export async function verifyDossierTransparencyWitness(
  checkpoint:import("../domain/types").DossierTransparencyCheckpoint,
  witness:import("../domain/types").DossierTransparencyWitnessReceipt,
  signal?:AbortSignal
):Promise<DossierWitnessVerifyResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/witness/verify",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({checkpoint,witness}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierWitnessVerifyResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Detached witness verification returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchDossierRfc3161Status():Promise<DossierRfc3161StatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/dossier/timestamp/status",{},4000);
  const body=await response.json() as DossierRfc3161StatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("RFC3161 status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function requestDossierRfc3161Timestamp(
  checkpoint:import("../domain/types").DossierTransparencyCheckpoint,
  signal?:AbortSignal
):Promise<DossierRfc3161TimestampResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/timestamp",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({checkpoint}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierRfc3161TimestampResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("RFC3161 timestamp request returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchDossierPublicationStatus():Promise<DossierPublicationStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/dossier/publication/status",{},4000);
  const body=await response.json() as DossierPublicationStatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Checkpoint publication status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function publishDossierCheckpoint(
  checkpoint:import("../domain/types").DossierTransparencyCheckpoint,
  signal?:AbortSignal
):Promise<DossierPublicationResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/publication",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({checkpoint}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierPublicationResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Checkpoint publication returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchReleaseSealStatus():Promise<DossierReleaseSealStatusResponse>{
  const response=await fetchWithTimeout(providerBridgeUrl+"/dossier/release/seal/status",{},4000);
  const body=await response.json() as DossierReleaseSealStatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release seal status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function sealDossierRelease(
  manifest:import("../domain/types").DossierReleaseManifest,
  signal?:AbortSignal
):Promise<DossierReleaseSealResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/seal",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({manifest}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierReleaseSealResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release sealing returned HTTP "+response.status+"."));
  }
  return body;
}

export async function verifyDossierReleaseSeal(
  manifest:import("../domain/types").DossierReleaseManifest,
  seal:import("../domain/types").DossierReleaseSealReceipt,
  signal?:AbortSignal
):Promise<DossierReleaseVerifyResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/verify",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({manifest,seal}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierReleaseVerifyResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release seal verification returned HTTP "+response.status+"."));
  }
  return body;
}

export async function requestDossierReleaseRfc3161Timestamp(
  manifest:import("../domain/types").DossierReleaseManifest,
  seal:import("../domain/types").DossierReleaseSealReceipt,
  signal?:AbortSignal
):Promise<DossierReleaseRfc3161TimestampResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/timestamp",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({manifest,seal}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierReleaseRfc3161TimestampResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release RFC3161 timestamp returned HTTP "+response.status+"."));
  }
  return body;
}

export async function fetchReleasePublicationStatus():Promise<DossierReleasePublicationStatusResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/publication/status",
    {},
    4000
  );
  const body=await response.json() as DossierReleasePublicationStatusResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release publication status returned HTTP "+response.status+"."));
  }
  return body;
}

export async function publishDossierReleasePackage(
  releasePackage:import("../domain/releasePackage").DossierReleasePackage,
  packageBasisFingerprint:string,
  signal?:AbortSignal
):Promise<DossierReleasePublicationResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/publication",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({releasePackage,packageBasisFingerprint}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierReleasePublicationResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release publication returned HTTP "+response.status+"."));
  }
  return body;
}

export async function auditDossierReleasePublication(
  releasePackage:import("../domain/releasePackage").DossierReleasePackage,
  publication:import("../domain/types").DossierReleasePublicationReceipt,
  signal?:AbortSignal
):Promise<DossierReleasePublicationAuditResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/publication/audit",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({releasePackage,publication}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierReleasePublicationAuditResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Release publication durability audit returned HTTP "+response.status+"."));
  }
  return body;
}

export async function verifyDossierPublisherOriginIdentity(
  releasePackage:import("../domain/releasePackage").DossierReleasePackage,
  publication:import("../domain/types").DossierReleasePublicationReceipt,
  signal?:AbortSignal
):Promise<DossierPublisherOriginIdentityResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/release/publisher/identity",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({releasePackage,publication}),
      signal
    },
    45000
  );
  const body=await response.json() as DossierPublisherOriginIdentityResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Publisher-origin identity verification returned HTTP "+response.status+"."));
  }
  return body;
}

export async function verifyDecisionDossierSeal(
  dossier:import("../domain/types").SynthesisDecisionDossier,
  seal:import("../domain/types").DossierSealReceipt,
  signal?:AbortSignal
):Promise<DossierVerifyResponse>{
  const response=await fetchWithTimeout(
    providerBridgeUrl+"/dossier/verify",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({dossier,seal}),
      signal
    },
    15000
  );
  const body=await response.json() as DossierVerifyResponse|DossierSealError;
  if(!response.ok||!body.ok){
    const errorBody=body as DossierSealError;
    throw new Error(errorBody.error?.message||("Dossier verification returned HTTP "+response.status+"."));
  }
  return body;
}
