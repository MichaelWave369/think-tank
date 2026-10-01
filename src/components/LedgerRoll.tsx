import type { ThinkTankEvent } from "../domain/types";
import type { ReplayReport } from "../kernel/eventKernel";

const shortFingerprint=(value:string)=>value.replace("fnv1a32:","").slice(0,8);

export function LedgerRoll({
  events,
  replayReport,
  onReplay
}:{
  events:ThinkTankEvent[];
  replayReport:ReplayReport;
  onReplay:()=>void;
}){
  const verified=replayReport.valid&&replayReport.exact;

  return <section className="ledger-roll">
    <header>
      <strong>RECEIPT / LEDGER</strong>
      <div className="ledger-controls">
        <span className={verified?"kernel-ok":"kernel-fault"}>{verified?"✓ REPLAY EXACT":"! REPLAY FAULT"}</span>
        <button type="button" onClick={onReplay} disabled={!replayReport.valid}>REPLAY LEDGER</button>
      </div>
    </header>

    {!replayReport.valid&&<div className="ledger-fault">
      KERNEL INTEGRITY ERROR: {replayReport.error}
    </div>}

    <div className="ledger-paper">
      {events.length===0&&<p>[0000] SYSTEM &gt; Awaiting operator input.</p>}
      {events.map(event=><p key={event.seq}>
        <span>
          [{String(event.seq).padStart(4,"0")}] {event.source.toUpperCase()} / {event.roleId?.toUpperCase()??"SYSTEM"} / {event.kind}
          {" > "}{event.message??event.kind}
        </span>
        <small>{shortFingerprint(event.stateBefore)} → {shortFingerprint(event.stateAfter)}</small>
      </p>)}
    </div>
  </section>;
}
