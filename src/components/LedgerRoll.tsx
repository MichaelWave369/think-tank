import { useEffect,useRef,useState } from "react";
import type { ThinkTankEvent } from "../domain/types";
import type { ReplayReport } from "../kernel/eventKernel";

const shortFingerprint=(value:string)=>value.replace("fnv1a32:","").slice(0,8);

const exportLedger=(events:ThinkTankEvent[])=>{
  const text=events.map(event=>
    [
      "["+String(event.seq).padStart(4,"0")+"]",
      event.source.toUpperCase(),
      event.roleId?.toUpperCase()??"SYSTEM",
      event.kind,
      event.message??"",
      event.stateBefore+" -> "+event.stateAfter
    ].join(" | ")
  ).join("\n");

  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="phi-think-tank-ledger.txt";
  link.click();
  URL.revokeObjectURL(url);
};

export function LedgerRoll({
  events,
  replayReport,
  busy=false,
  onReplay
}:{
  events:ThinkTankEvent[];
  replayReport:ReplayReport;
  busy?:boolean;
  onReplay:()=>void;
}){
  const verified=replayReport.valid&&replayReport.exact;
  const [paused,setPaused]=useState(false);
  const paperRef=useRef<HTMLDivElement|null>(null);
  const lastSeq=events.length?events[events.length-1].seq:0;

  useEffect(()=>{
    if(paused)return;
    const paper=paperRef.current;
    if(paper)paper.scrollTop=paper.scrollHeight;
  },[events.length,paused]);

  return <section className={"ledger-roll"+(paused?" ledger-paused":"")}>
    <header>
      <strong>RECEIPT / LEDGER</strong>
      <div className="ledger-controls">
        <span className={verified?"kernel-ok":"kernel-fault"}>{verified?"✓ REPLAY EXACT":"! REPLAY FAULT"}</span>
        <button type="button" onClick={()=>setPaused(value=>!value)}>{paused?"RESUME PRINT":"PAUSE PRINT"}</button>
        <button type="button" onClick={()=>exportLedger(events)} disabled={events.length===0}>TEAR / EXPORT</button>
        <button type="button" onClick={onReplay} disabled={busy||!replayReport.valid}>REPLAY LEDGER</button>
      </div>
    </header>

    {!replayReport.valid&&<div className="ledger-fault">
      KERNEL INTEGRITY ERROR: {replayReport.error}
    </div>}

    <div className="ledger-paper" ref={paperRef}>
      {events.length===0&&<p>[0000] SYSTEM &gt; Awaiting operator input.</p>}
      {events.map(event=><p key={event.seq} className={event.seq===lastSeq?"ledger-new":""}>
        <span>
          [{String(event.seq).padStart(4,"0")}] {event.source.toUpperCase()} / {event.roleId?.toUpperCase()??"SYSTEM"} / {event.kind}
          {" > "}{event.message??event.kind}
        </span>
        <small>{shortFingerprint(event.stateBefore)} → {shortFingerprint(event.stateAfter)}</small>
      </p>)}
    </div>
  </section>;
}
