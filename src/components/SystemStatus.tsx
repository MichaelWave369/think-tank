import { schedulerStatus } from "../domain/scheduler";
import type { ThinkTankState } from "../domain/types";
import type { ReplayReport } from "../kernel/eventKernel";

export function SystemStatus({state,replayReport}:{state:ThinkTankState;replayReport:ReplayReport}){
  const gate=state.gateScore===null?"WAITING":state.gateScore.toFixed(2);
  const kernelOk=replayReport.valid&&replayReport.exact;

  return <section className="system-status">
    <strong>SYSTEM STATUS</strong>
    <span>Crane Fly: {state.routerPolicy.toUpperCase()}</span>
    <span>Scheduler: {schedulerStatus(state)}</span>
    <span>Round: {state.currentRound} / {state.turnPlan?.maxRounds??0}</span>
    <span>Reality Gate: {gate} / {state.gateThreshold.toFixed(2)}</span>
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
