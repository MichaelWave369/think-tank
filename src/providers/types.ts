import type { RoleId,SeatId } from "../domain/types";

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
