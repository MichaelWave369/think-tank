import { modeDefinition } from "../domain/modes";
import { evaluateClaimGovernance } from "../domain/claimGovernance";
import { evaluateArgumentGovernance } from "../domain/argumentGovernance";
import { schedulerStatus } from "../domain/scheduler";
import type { ThinkTankState } from "../domain/types";

export function GovernancePanel({
  state,
  busy=false,
  onGateBlock,
  onTimeout
}:{
  state:ThinkTankState;
  busy?:boolean;
  onGateBlock:()=>void;
  onTimeout:()=>void;
}){
  const law=modeDefinition(state.mode);
  const plan=state.turnPlan;
  const claimPolicy=evaluateClaimGovernance(state,state.mode);
  const lastClaimPolicy=state.claimGovernance;
  const argumentPolicy=evaluateArgumentGovernance(state,state.mode);
  const lastArgumentPolicy=state.argumentGovernance;
  const latestPromptSeq=[...state.events].reverse()
    .find(event=>event.kind==="operator.prompt")?.seq??0;
  const runEvents=state.events.filter(event=>event.seq>=latestPromptSeq);
  const fixtureRunDetected=runEvents.some(event=>
    event.source==="simulator"||
    event.message?.includes("SIMULATION FIXTURE")
  );
  const liveRunDetected=runEvents.some(event=>
    event.source==="provider"||
    (event.kind==="session.started"&&event.message?.includes("LIVE provider"))
  );
  const executionSource=fixtureRunDetected
    ?"SIMULATION FIXTURE"
    :liveRunDetected
      ?"LIVE PROVIDERS"
      :"NOT STARTED";
  const fixtureRun=executionSource==="SIMULATION FIXTURE";

  return <section className="governance-panel">
    <header>
      <div>
        <strong>MODE LAW / SCHEDULER</strong>
        <span>{law.label} · {schedulerStatus(state)}</span>
      </div>
      <b className={state.synthesisWithheld?"gov-bad":"gov-good"}>
        {state.outputLabel??"PENDING"}
      </b>
    </header>

    <div className="governance-grid">
      <div><small>ACTIVE SET</small><span>{law.activeSet}</span></div>
      <div><small>CRANE FLY</small><span>{law.router}</span></div>
      <div><small>QUEUE</small><span>{(plan?.speakerQueue??law.speakerQueue).join(" → ")}</span></div>
      <div><small>ROUND</small><span>{state.currentRound} / {plan?.maxRounds??law.maxRounds}</span></div>
      <div><small>TRIGGER</small><span>{plan?.synthesisTrigger??law.synthesisTrigger}</span></div>
      <div><small>GATE LAW</small><span>{law.gate}</span></div>
      <div><small>CLAIM POLICY</small><span>{law.claimPolicy.toUpperCase()}</span></div>
      <div><small>ARGUMENT POLICY</small><span>{law.argumentPolicy.toUpperCase()}</span></div>
      <div><small>EXECUTION</small><span>{executionSource}</span></div>
      <div><small>{fixtureRun?"FIXTURE SCORE":"GATE SCORE"}</small><span>{state.gateScore===null?"WAITING":state.gateScore.toFixed(2)}</span></div>
      <div><small>GATE CAP</small><span>{state.gateBreakdown?.cap.toFixed(2)??"—"}</span></div>
      <div><small>EVIDENCE</small><span>{state.evidenceRefs.length} REFS</span></div>
      <div><small>CLAIMS APPLICABLE</small><span>{claimPolicy.applicableClaimIds.length}</span></div>
      <div><small>CLAIMS FRESH</small><span>{claimPolicy.freshClaimIds.length}</span></div>
      <div><small>CLAIMS MISSING</small><span>{claimPolicy.missingReviewClaimIds.length}</span></div>
      <div><small>CLAIMS STALE</small><span>{claimPolicy.staleReviewClaimIds.length}</span></div>
      <div><small>CLAIMS BLOCKED</small><span>{claimPolicy.coverageBlockedClaimIds.length}</span></div>
      <div><small>CLAIM POLICY NOW</small><span>{claimPolicy.passed?"PASS":"BLOCK"}</span></div>
      <div><small>LAST CLAIM RECEIPT</small><span>{lastClaimPolicy?(lastClaimPolicy.passed?"PASS":"BLOCK"):"—"}</span></div>
      <div><small>ARGUMENT APPLICABLE</small><span>{argumentPolicy.applicableClaimIds.length}</span></div>
      <div><small>ARGUMENT ACCEPTED</small><span>{argumentPolicy.freshAcceptedClaimIds.length}</span></div>
      <div><small>ARGUMENT MISSING</small><span>{argumentPolicy.missingAcceptedClaimIds.length}</span></div>
      <div><small>ARGUMENT STALE</small><span>{argumentPolicy.staleAcceptedClaimIds.length}</span></div>
      <div><small>ARGUMENT DRAFT ONLY</small><span>{argumentPolicy.draftOnlyClaimIds.length}</span></div>
      <div><small>ARGUMENT POLICY NOW</small><span>{argumentPolicy.passed?"PASS":"BLOCK"}</span></div>
      <div><small>LAST ARGUMENT RECEIPT</small><span>{lastArgumentPolicy?(lastArgumentPolicy.passed?"PASS":"BLOCK"):"—"}</span></div>
      <div><small>OBJECTIONS</small><span>{state.objectionCount}{law.objectionRequired?" · REQUIRED":""}</span></div>
      <div><small>ACTION</small><span>{state.actionAllowed?"AUTHORIZED":"LOCKED"}</span></div>
    </div>

    {fixtureRun&&<p className="gov-fixture">
      SIMULATION FIXTURE · deterministic drill output · NOT LIVE PROVIDER EVIDENCE
    </p>}
    <p>{state.governanceReason||law.actionRule}</p>
    <p className={claimPolicy.passed?"gov-good":"gov-bad"}>
      CLAIM POLICY: {claimPolicy.reason}
    </p>
    <p className={argumentPolicy.passed?"gov-good":"gov-bad"}>
      ARGUMENT POLICY: {argumentPolicy.reason}
    </p>

    {state.faultCode&&<div className="governance-fault">FAULT: {state.faultCode}</div>}

    <footer>
      <span>SIMULATION DRILLS</span>
      <button type="button" onClick={onGateBlock} disabled={busy}>COUNCIL GATE BLOCK</button>
      <button type="button" onClick={onTimeout} disabled={busy}>TURN TIMEOUT</button>
    </footer>
  </section>;
}
