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
  DossierSealError
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
