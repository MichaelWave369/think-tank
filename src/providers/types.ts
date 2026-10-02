import type { DossierRfc3161TimestampReceipt,DossierSealReceipt,DossierTransparencyCheckpoint,DossierTransparencyReceipt,DossierTransparencyWitnessReceipt,RoleId,SeatId,SynthesisDecisionDossier } from "../domain/types";

export type ProviderConnectionState="connected"|"configured"|"disconnected"|"error";

export interface ProviderSeatStatus{
  seatId:SeatId;
  provider:string;
  state:ProviderConnectionState;
  model:string|null;
  models:string[];
  detail:string;
}

export interface ProviderStatusResponse{
  ok:boolean;
  bridgeVersion:string;
  seats:ProviderSeatStatus[];
}

export interface ProviderMessage{
  role:"system"|"user"|"assistant";
  content:string;
}

export interface ProviderInvokeRequest{
  seatId:SeatId;
  roleId:RoleId;
  model?:string;
  messages:ProviderMessage[];
}

export interface ProviderInvokeResponse{
  ok:true;
  seatId:SeatId;
  provider:string;
  model:string;
  text:string;
  latencyMs:number;
  requestId?:string;
}

export interface ProviderErrorResponse{
  ok:false;
  error:{code:string;message:string};
}


export interface EvidenceFetchRequest{
  uri:string;
}

export interface EvidenceFetchReceipt{
  ok:true;
  tool:"url-fetch";
  requestedUri:string;
  finalUri:string;
  httpStatus:number;
  contentType:string;
  bytes:number;
  sha256:string;
  redirects:number;
  retrievedAt:string;
}

export interface EvidenceFetchError{
  ok:false;
  error:{code:string;message:string};
}


export interface ResearchBackendStatusResponse{
  ok:true;
  provider:"SearXNG";
  state:"configured"|"disabled";
  maxResults:number;
  detail:string;
}

export interface ResearchSearchResult{
  title:string;
  uri:string;
  snippet:string;
  engine:string;
  rank:number;
}

export interface ResearchSearchResponse{
  ok:true;
  tool:"searxng-search";
  provider:"searxng";
  query:string;
  searchedAt:string;
  resultDigest:string;
  results:ResearchSearchResult[];
}

export interface ResearchSearchError{
  ok:false;
  error:{code:string;message:string};
}


export interface EvidenceProjectionResponse{
  ok:true;
  tool:"text-projector";
  extractor:"text-projection-v1";
  sourceUri:string;
  sourceSha256:string;
  projectionSha256:string;
  contentType:string;
  charCount:number;
  totalCharCount:number;
  truncated:boolean;
  extractedAt:string;
  text:string;
}

export interface EvidenceExcerptResponse extends EvidenceProjectionResponse{
  startChar:number;
  endChar:number;
  excerptSha256:string;
}

export interface EvidenceProjectionError{
  ok:false;
  error:{code:string;message:string};
}


export interface DossierSealStatusResponse{
  ok:true;
  state:"configured"|"disabled";
  algorithm:"Ed25519";
  canonicalization:"json-stable-v1";
  keyFingerprint:string|null;
  signerLabel:string|null;
  trust:"self-attested-local-key";
  detail:string;
}

export interface DossierSealResponse{
  ok:true;
  seal:DossierSealReceipt;
}

export interface DossierVerifyResponse{
  ok:true;
  verified:boolean;
  reason:string;
  dossierId:string;
  sealId:string;
  digestSha256:string;
  publicKeyFingerprintSha256:string;
  verifiedAt:string;
}

export interface DossierSealError{
  ok:false;
  error:{code:string;message:string};
}

export interface DossierSealRequest{
  dossier:SynthesisDecisionDossier;
}

export interface DossierTransparencyStatusResponse{
  ok:true;
  state:"ready"|"disabled"|"corrupt";
  entryCount:number;
  headSha256:string|null;
  headEntryId:string|null;
  clock:"untrusted-local-clock";
  trust:"tamper-evident-local-journal";
  detail:string;
}

export interface DossierTransparencyAppendResponse{
  ok:true;
  entry:DossierTransparencyReceipt;
}

export interface DossierTransparencyCheckpointResponse{
  ok:true;
  checkpoint:DossierTransparencyCheckpoint;
}

export interface DossierWitnessVerifyResponse{
  ok:true;
  verified:boolean;
  reason:string;
  checkpointId:string;
  witnessId:string;
  checkpointSha256:string;
  publicKeyFingerprintSha256:string;
  verifiedAt:string;
}

export interface DossierWitnessVerifyRequest{
  checkpoint:DossierTransparencyCheckpoint;
  witness:DossierTransparencyWitnessReceipt;
}

export interface DossierRfc3161StatusResponse{
  ok:true;
  state:"configured"|"disabled"|"error";
  standard:"RFC3161";
  hashAlgorithm:"SHA-256";
  authorityUrl:string|null;
  trustAnchorSha256:string|null;
  openssl:string|null;
  detail:string;
}

export interface DossierRfc3161TimestampResponse{
  ok:true;
  timestamp:DossierRfc3161TimestampReceipt;
}
