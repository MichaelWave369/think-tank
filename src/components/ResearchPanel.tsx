import { useEffect,useMemo,useState } from "react";
import type { Claim,ResearchCandidate,ResearchSearchReceipt } from "../domain/types";
import type { ResearchBackendStatusResponse } from "../providers/types";

const shortDigest=(value:string)=>value.slice(0,14)+"…";

export function ResearchPanel({
  claims,
  candidates,
  searches,
  status,
  error,
  busy,
  searchBusy,
  promotedCandidateIds,
  onSearch,
  onVerify
}:{
  claims:Claim[];
  candidates:ResearchCandidate[];
  searches:ResearchSearchReceipt[];
  status:ResearchBackendStatusResponse|null;
  error:string;
  busy:boolean;
  searchBusy:boolean;
  promotedCandidateIds:string[];
  onSearch:(claimId:string,query:string)=>void;
  onVerify:(candidate:ResearchCandidate)=>void;
}){
  const [claimId,setClaimId]=useState("");
  const [query,setQuery]=useState("");

  useEffect(()=>{
    if(claimId&&claims.some(claim=>claim.id===claimId))return;
    setClaimId(claims[0]?.id??"");
  },[claims,claimId]);

  const selected=claims.find(claim=>claim.id===claimId);
  const visibleCandidates=useMemo(
    ()=>candidates.filter(candidate=>candidate.claimId===claimId),
    [candidates,claimId]
  );
  const lastSearch=useMemo(
    ()=>[...searches].reverse().find(search=>search.claimId===claimId),
    [searches,claimId]
  );

  const useClaimText=()=>{
    if(selected)setQuery(selected.text);
  };

  const submit=()=>{
    const value=query.trim();
    if(!claimId||!value||busy)return;
    onSearch(claimId,value);
  };

  return <section className="research-panel">
    <header className="research-header">
      <div>
        <strong>GOVERNED RESEARCH / CANDIDATE QUARANTINE</strong>
        <span>SEARCH RESULT ≠ EVIDENCE · DISCOVERY MUST PASS RETRIEVAL VERIFICATION</span>
      </div>
      <b className={status?.state==="configured"?"research-ready":"research-offline"}>
        {status?.state==="configured"?"SEARXNG READY":"SEARCH OFFLINE"}
      </b>
    </header>

    <div className="research-controls">
      <label>
        <span>CLAIM</span>
        <select value={claimId} onChange={e=>setClaimId(e.target.value)} disabled={busy||claims.length===0}>
          {claims.length===0&&<option value="">REGISTER A CLAIM FIRST</option>}
          {claims.map(claim=><option key={claim.id} value={claim.id}>{claim.id} · {claim.text}</option>)}
        </select>
      </label>
      <label className="research-query">
        <span>SEARCH QUERY</span>
        <input value={query} onChange={e=>setQuery(e.target.value)} disabled={busy||!claimId} placeholder="Search for external material bearing on this claim"/>
      </label>
      <div className="research-actions">
        <button type="button" onClick={useClaimText} disabled={busy||!selected}>USE CLAIM TEXT</button>
        <button className="research-run" type="button" onClick={submit} disabled={busy||!claimId||!query.trim()||status?.state!=="configured"}>
          {searchBusy?"SEARCHING…":"RUN GOVERNED SEARCH"}
        </button>
      </div>
    </div>

    <div className="research-meta">
      <span>{status?.detail??"Research bridge status unavailable."}</span>
      {status&&<span>MAX {status.maxResults} CANDIDATES / SEARCH</span>}
      {lastSearch&&<span>LAST {lastSearch.id} · SHA-256 {shortDigest(lastSearch.resultDigest)}</span>}
    </div>

    {error&&<div className="research-error">RESEARCH TOOL: {error}</div>}

    <div className="research-results">
      {claimId&&visibleCandidates.length===0&&<p className="research-empty">No candidates recorded for this claim. Discovery results contribute zero to Reality Gate until machine verification creates an evidence receipt.</p>}
      {visibleCandidates.map(candidate=>{
        const promoted=promotedCandidateIds.includes(candidate.id);
        return <article className={"research-candidate"+(promoted?" candidate-promoted":"")} key={candidate.id}>
          <div className="candidate-rank">#{candidate.rank}</div>
          <div className="candidate-body">
            <strong>{candidate.title}</strong>
            <span>{candidate.id} · {candidate.engine.toUpperCase()} · CANDIDATE / NOT EVIDENCE</span>
            <small>{candidate.uri}</small>
            {candidate.snippet&&<p>{candidate.snippet}</p>}
          </div>
          <button type="button" onClick={()=>onVerify(candidate)} disabled={busy||promoted}>
            {promoted?"PROMOTED":"VERIFY → EVIDENCE"}
          </button>
        </article>;
      })}
    </div>

    <footer>
      <span>{searches.length} SEARCH RECEIPTS · {candidates.length} CANDIDATES</span>
      <p>Promotion verifies retrieval provenance only. Bind SUPPORTS / CONTRADICTS / CONTEXT separately in the Claim Board.</p>
    </footer>
  </section>;
}
