import {
  claimReviewIsFresh,
  evaluateClaimCoverage,
  latestClaimReview
} from "../domain/claimCoverage";
import type { ThinkTankState } from "../domain/types";

const shortFingerprint=(value:string)=>value.replace("fnv1a32:","").slice(0,8);

export function ClaimCoverageMatrix({
  state,
  busy,
  onReview
}:{
  state:ThinkTankState;
  busy:boolean;
  onReview:(claimId:string)=>void;
}){
  return <section className="coverage-matrix">
    <header className="coverage-header">
      <div>
        <strong>CHALLENGER / CLAIM COVERAGE MATRIX</strong>
        <span>STRUCTURAL AUDIT · NOT A TRUTH SCORE · REVIEW SNAPSHOTS ARE IMMUTABLE</span>
      </div>
      <b>{state.claims.length} CLAIMS</b>
    </header>

    <div className="coverage-table">
      <div className="coverage-row coverage-columns" aria-hidden="true">
        <span>CLAIM</span>
        <span>STATE</span>
        <span>S / X / C</span>
        <span>VERIFIED</span>
        <span>RESEARCH</span>
        <span>AUDIT</span>
      </div>

      {state.claims.length===0&&
        <p className="coverage-empty">Register a claim before Challenger can audit evidence coverage.</p>}

      {state.claims.map(claim=>{
        const live=evaluateClaimCoverage(
          state,
          claim.id,
          "LIVE",
          "1970-01-01T00:00:00.000Z"
        );
        const review=latestClaimReview(state,claim.id);
        const fresh=review?claimReviewIsFresh(state,review):false;

        return <article className={"coverage-row coverage-"+live.coverageState} key={claim.id}>
          <div className="coverage-claim">
            <strong>{claim.id}</strong>
            <span>{claim.text}</span>
            <div className="coverage-flags">
              {live.flags.map(flag=><small key={flag}>{flag.toUpperCase().split("-").join(" ")}</small>)}
            </div>
          </div>

          <div className="coverage-cell">
            <small>LIVE</small>
            <b>{live.coverageState.toUpperCase().split("-").join(" ")}</b>
            <span>{live.boundEvidenceCount} BOUND</span>
          </div>

          <div className="coverage-cell coverage-counts">
            <small>RELATIONS</small>
            <b>{live.supportCount} / {live.contradictionCount} / {live.contextCount}</b>
            <span>SUPPORT / CONTRA / CONTEXT</span>
          </div>

          <div className="coverage-cell">
            <small>PROVENANCE</small>
            <b>{live.machineVerifiedCount} MACHINE</b>
            <span>{live.operatorAttestedCount} ATTESTED · {live.unverifiedCount} UNVERIFIED</span>
          </div>

          <div className="coverage-cell">
            <small>LINEAGE</small>
            <b>{live.researchLineageCount}</b>
            <span>RESEARCH-DISCOVERED</span>
          </div>

          <div className="coverage-audit">
            {review
              ?<>
                <b className={fresh?"audit-fresh":"audit-stale"}>{fresh?"FRESH":"STALE"}</b>
                <span>{review.id} · {shortFingerprint(review.basisFingerprint)}</span>
                <small>{review.reviewedAt}</small>
              </>
              :<>
                <b className="audit-none">UNREVIEWED</b>
                <span>NO CHALLENGER SNAPSHOT</span>
              </>}
            <button type="button" onClick={()=>onReview(claim.id)} disabled={busy}>
              {review?"RUN FRESH AUDIT":"RUN CHALLENGER AUDIT"}
            </button>
          </div>
        </article>;
      })}
    </div>

    <footer>
      <span>S / X / C = SUPPORTS / CONTRADICTS / CONTEXT</span>
      <p>Coverage describes the evidence graph. It does not determine whether a claim is factually true.</p>
    </footer>
  </section>;
}
