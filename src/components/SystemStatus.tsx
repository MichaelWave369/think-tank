import { claimGraphSummary } from "../domain/claims";
import { claimCoverageSummary } from "../domain/claimCoverage";
import { evaluateClaimGovernance } from "../domain/claimGovernance";
import { schedulerStatus } from "../domain/scheduler";
import type { ThinkTankState } from "../domain/types";
import type { ReplayReport } from "../kernel/eventKernel";
import type { MotionMode } from "../motion/motion";

export function SystemStatus({
  state,
  replayReport,
  motionMode,
  playing,
  routeReady,
  unresolvedCount
}:{
  state:ThinkTankState;
  replayReport:ReplayReport;
  motionMode:MotionMode;
  playing:boolean;
  routeReady:boolean;
  unresolvedCount:number;
}){
  const gate=state.gateScore===null?"WAITING":state.gateScore.toFixed(2);
  const kernelOk=replayReport.valid&&replayReport.exact;
  const pinCount=Object.keys(state.pinnedAssignments).length;
  const onlineCount=Object.values(state.seatStatus).filter(status=>status!=="offline").length;
  const claimSummary=claimGraphSummary(state);
  const coverageSummary=claimCoverageSummary(state);
  const claimPolicy=evaluateClaimGovernance(state,state.mode);

  return <section className="system-status">
    <strong>SYSTEM STATUS</strong>
    <span>Crane Fly: {state.routerPolicy.toUpperCase()}</span>
    <span>Route: <b className={routeReady?"kernel-ok":"kernel-fault"}>{routeReady?"READY":"BLOCKED"}</b></span>
    <span>Unresolved: {unresolvedCount}</span>
    <span>Operator Pins: {pinCount}</span>
    <span>Seats Available: {onlineCount} / 3</span>
    <span>Scheduler: {schedulerStatus(state)}</span>
    <span>Playback: {playing?"ACTIVE":"IDLE"}</span>
    <span>Motion FX: {motionMode.toUpperCase()}</span>
    <span>Round: {state.currentRound} / {state.turnPlan?.maxRounds??0}</span>
    <span>Reality Gate: {gate} / {state.gateThreshold.toFixed(2)}</span>
    <span>Gate Cap: {state.gateBreakdown?.cap.toFixed(2)??"—"}</span>
    <span>Evidence: {state.evidenceRefs.length} refs</span>
    <span>Claims: {claimSummary.total} · {claimSummary.bindings} bindings</span>
    <span>Claims Unbound: {claimSummary.unbound}</span>
    <span>Claims Contested: {claimSummary.contested}</span>
    <span>Claim Audits: {coverageSummary.reviewed} reviewed</span>
    <span>Audits Stale: {coverageSummary.stale}</span>
    <span>Audits Missing: {coverageSummary.unreviewed}</span>
    <span>Claim Policy: {claimPolicy.passed?"PASS":"BLOCK"}</span>
    <span>Research: {state.researchSearches.length} searches</span>
    <span>Candidates: {state.researchCandidates.length}</span>
    <span>Output: {state.outputLabel??"PENDING"}</span>
    <span>Action: {state.actionAllowed?"AUTHORIZED":"LOCKED"}</span>
    <span>Event Kernel: <b className={kernelOk?"kernel-ok":"kernel-fault"}>{kernelOk?"REPLAY EXACT":"FAULT"}</b></span>
    <span>Ledger Seq: {state.seq} / {replayReport.eventCount}</span>
    <span>Compute: LOCAL_FIRST</span>
    <span>Atlas: SIM</span>
    <span>Professor Φ: SIM</span>
    <span>Ledger: ACTIVE</span>
  </section>;
}
