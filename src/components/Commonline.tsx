import type { Assignment,RoleId,Seat } from "../domain/types";
interface Props{assignments:Assignment[];activeRole?:RoleId;seats:Seat[];}
export function Commonline({assignments,activeRole,seats}:Props){
 return <section className="commonline">
  <header><div><strong>COMMONLINE</strong><span>SHARED SESSION / MULTI-MIND BUS</span></div><small>IDEAS › ANALYSIS › DEBATE › SYNTHESIS › ACTION</small></header>
  <div className="commonline-map">
   <div className="nodes left">{assignments.slice(0,3).map(a=><span className={a.roleId===activeRole?"active":""} key={a.roleId}>{a.roleId.toUpperCase()}</span>)}</div>
   <div className="core"><span>Φ</span><small>EVENT BUS</small></div>
   <div className="nodes right">{assignments.slice(3).map(a=><span className={a.roleId===activeRole?"active":""} key={a.roleId}>{a.roleId.toUpperCase()}</span>)}{seats.map(s=><span key={s.id}>{s.name}</span>)}</div>
  </div>
  <footer>IF A LIGHT CHANGES, A SEQUENCED EVENT EXPLAINS WHY.</footer>
 </section>;
}
