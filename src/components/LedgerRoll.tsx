import type { ThinkTankEvent } from "../domain/types";
export function LedgerRoll({events}:{events:ThinkTankEvent[]}){
 return <section className="ledger-roll">
  <header><strong>RECEIPT / LEDGER</strong><span>● LIVE &nbsp; AUTO SCROLL &nbsp; TEAR / EXPORT</span></header>
  <div className="ledger-paper">{events.length===0&&<p>[0000] SYSTEM &gt; Awaiting operator input.</p>}{events.map(e=><p key={e.seq}>[{String(e.seq).padStart(4,"0")}] {e.roleId?.toUpperCase()??"SYSTEM"} &gt; {e.message??e.kind}</p>)}</div>
 </section>;
}
