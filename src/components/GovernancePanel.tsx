import { modeDefinition } from "../domain/modes";
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
      <div><small>OBJECTIONS</small><span>{state.objectionCount}{law.objectionRequired?" · REQUIRED":""}</span></div>
      <div><small>ACTION</small><span>{state.actionAllowed?"AUTHORIZED":"LOCKED"}</span></div>
    </div>

    <p>{state.governanceReason||law.actionRule}</p>

    {state.faultCode&&<div className="governance-fault">FAULT: {state.faultCode}</div>}

    <footer>
      <span>SIMULATION DRILLS</span>
      <button type="button" onClick={onGateBlock} disabled={busy}>COUNCIL GATE BLOCK</button>
      <button type="button" onClick={onTimeout} disabled={busy}>TURN TIMEOUT</button>
    </footer>
  </section>;
}
