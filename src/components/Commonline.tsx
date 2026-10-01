import type { Assignment,RoleId,Seat } from "../domain/types";
import type { MotionCue,MotionMode } from "../motion/motion";

interface Props{
  assignments:Assignment[];
  activeRole?:RoleId;
  seats:Seat[];
  cue:MotionCue;
  motionMode:MotionMode;
}

export function Commonline({assignments,activeRole,seats,cue,motionMode}:Props){
  const seatName=seats.find(seat=>seat.id===cue.seatId)?.name??"SYSTEM";
  const roleName=cue.roleId?.toUpperCase()??"ROOM";
  const routed=cue.kind==="route"||cue.kind==="speak"||cue.kind==="challenge";

  return <section className={"commonline commonline-"+cue.kind} data-motion={motionMode}>
    <header>
      <div><strong>COMMONLINE</strong><span>SHARED SESSION / MULTI-MIND BUS</span></div>
      <small>IDEAS › ANALYSIS › DEBATE › SYNTHESIS › ACTION</small>
    </header>

    <div className="commonline-map">
      <div className="nodes left">
        {assignments.slice(0,3).map(assignment=><span className={assignment.roleId===activeRole?"active":""} key={assignment.roleId}>{assignment.roleId.toUpperCase()}</span>)}
      </div>

      <div className="commonline-core-wrap">
        <div className={"route-trace route-in"+(routed?" active":"")}>
          <i/><span>{seatName}</span>
        </div>
        <div className={"core"+(routed?" motion-core":"")}><span>Φ</span><small>EVENT BUS</small></div>
        <div className={"route-trace route-out"+(routed?" active":"")}>
          <i/><span>{roleName}</span>
        </div>
      </div>

      <div className="nodes right">
        {assignments.slice(3).map(assignment=><span className={assignment.roleId===activeRole?"active":""} key={assignment.roleId}>{assignment.roleId.toUpperCase()}</span>)}
        {seats.map(seat=><span className={seat.id===cue.seatId?"active":""} key={seat.id}>{seat.name}</span>)}
      </div>
    </div>

    <div className="commonline-cue">
      <span>SEQ {String(cue.seq).padStart(4,"0")}</span>
      <strong>{cue.label}</strong>
      <span>{motionMode.toUpperCase()}</span>
    </div>

    <footer>IF A LIGHT CHANGES, A SEQUENCED EVENT EXPLAINS WHY.</footer>
  </section>;
}
