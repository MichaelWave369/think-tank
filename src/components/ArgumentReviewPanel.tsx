import { useEffect,useMemo,useState } from "react";
import {
  argumentReviewEligibility,
  argumentReviewIsFresh
} from "../domain/argumentReview";
import type { ThinkTankState } from "../domain/types";

const short=(value:string)=>value.slice(0,12)+"…";

export function ArgumentReviewPanel({
  state,
  busy,
  running,
  providerReady,
  providerLabel,
  error,
  onRun,
  onAccept,
  onDismiss
}:{
  state:ThinkTankState;
  busy:boolean;
  running:boolean;
  providerReady:boolean;
  providerLabel:string;
  error:string;
  onRun:(claimId:string)=>void;
  onAccept:(reviewId:string)=>void;
  onDismiss:(reviewId:string)=>void;
}){
  const [claimId,setClaimId]=useState(state.claims[0]?.id??"");

  useEffect(()=>{
    if(claimId&&state.claims.some(claim=>claim.id===claimId))return;
    setClaimId(state.claims[0]?.id??"");
  },[state.claims,claimId]);

  const eligibility=useMemo(
    ()=>claimId?argumentReviewEligibility(state,claimId):null,
    [state,claimId]
  );

  const reviews=[...state.argumentReviews]
    .filter(review=>!claimId||review.claimId===claimId)
    .reverse();

  return <section className="argument-review-panel">
    <header>
      <div>
        <strong>CHALLENGER / ARGUMENT REVIEW</strong>
        <span>PROVIDER ANALYSIS ≠ EVIDENCE · ACCEPTED ≠ TRUE · EXACT QUOTES COME ONLY FROM PINNED EXCERPTS</span>
      </div>
      <b>{providerReady?"CHALLENGER READY":"CHALLENGER OFFLINE"}</b>
    </header>

    <div className="argument-review-controls">
      <label>
        <span>CLAIM</span>
        <select value={claimId} onChange={event=>setClaimId(event.target.value)} disabled={busy||state.claims.length===0}>
          {state.claims.length===0&&<option value="">NO CLAIMS</option>}
          {state.claims.map(claim=><option key={claim.id} value={claim.id}>{claim.id} · {claim.text}</option>)}
        </select>
      </label>

      <div className="argument-review-readiness">
        <small>PROVIDER</small>
        <strong>{providerLabel}</strong>
        <span>
          {eligibility
            ?eligibility.excerptCount+" EXCERPTS · "+eligibility.totalChars.toLocaleString()+" CHARS"
            :"NO CLAIM SELECTED"}
        </span>
        <p>{eligibility?.reason??"Register a claim and pin bound source excerpts."}</p>
      </div>

      <button
        type="button"
        onClick={()=>claimId&&onRun(claimId)}
        disabled={busy||!claimId||!providerReady||!eligibility?.allowed}
      >
        {running?"CHALLENGER REVIEWING…":"RUN ARGUMENT REVIEW"}
      </button>
    </div>

    {error&&<div className="argument-review-error">ARGUMENT REVIEW: {error}</div>}

    <div className="argument-review-list">
      {reviews.length===0&&<p className="argument-review-empty">
        No provider argument reviews for this claim. Pin exact excerpts from bound machine evidence first.
      </p>}

      {reviews.map(review=>{
        const fresh=argumentReviewIsFresh(state,review);
        return <article className={"argument-review-card review-"+review.status} key={review.id}>
          <header>
            <div>
              <strong>{review.id} · {review.claimId}</strong>
              <span>{review.seatId.toUpperCase()} · {review.providerModel}</span>
              <small>
                BASIS {short(review.basisFingerprint)}
                {review.providerRequestId?" · REQUEST "+review.providerRequestId:""}
              </small>
            </div>
            <div className="argument-review-badges">
              <b>{review.status.toUpperCase()}</b>
              <b className={fresh?"review-fresh":"review-stale"}>{fresh?"FRESH":"STALE"}</b>
            </div>
          </header>

          <div className="argument-review-summary">
            <small>CHALLENGER SUMMARY</small>
            <p>{review.summary}</p>
          </div>

          <div className="argument-points">
            {review.points.map(point=>{
              const excerpt=state.evidenceExcerpts.find(item=>item.id===point.excerptId);
              const binding=excerpt
                ?state.claimBindings.find(item=>
                    item.claimId===review.claimId&&item.evidenceId===excerpt.evidenceId
                  )
                :undefined;

              return <section className="argument-point" key={point.excerptId}>
                <div className="argument-point-head">
                  <strong>{point.excerptId}</strong>
                  <span>OPERATOR RELATION · {binding?.relation.toUpperCase()??"STALE / UNBOUND"}</span>
                </div>

                <div className="argument-quote">
                  <small>CANONICAL EXACT EXCERPT</small>
                  <blockquote>{excerpt?.text??"Excerpt no longer exists in current canonical state."}</blockquote>
                </div>

                <div className="argument-reasoning">
                  <div><small>PREMISE</small><p>{point.premise}</p></div>
                  <div><small>INFERENCE</small><p>{point.inference}</p></div>
                  <div><small>OBJECTION</small><p>{point.objection}</p></div>
                </div>
              </section>;
            })}
          </div>

          <div className="argument-gaps">
            <small>UNRESOLVED GAPS</small>
            {review.unresolvedGaps.length
              ?<ul>{review.unresolvedGaps.map((gap,index)=><li key={index}>{gap}</li>)}</ul>
              :<p>No unresolved gaps reported by this provider review.</p>}
          </div>

          <footer>
            <span>{review.createdAt}</span>
            <div>
              {review.status==="draft"&&
                <button type="button" onClick={()=>onAccept(review.id)} disabled={busy||!fresh}>
                  {fresh?"ACCEPT ANALYSIS MAP":"STALE · RERUN REQUIRED"}
                </button>}
              {review.status!=="dismissed"&&
                <button type="button" onClick={()=>onDismiss(review.id)} disabled={busy}>DISMISS</button>}
            </div>
          </footer>
        </article>;
      })}
    </div>

    <footer className="argument-review-law">
      Provider reasoning is an analytical artifact. Acceptance records operator approval of the map, not factual truth.
    </footer>
  </section>;
}
