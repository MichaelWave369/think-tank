import { useState } from "react";
import { roles } from "../data/terminals";
import type { AssignmentPlan } from "../domain/craneFly";
import type { RoleId,Seat,SeatAvailability,SeatId,ThinkTankState } from "../domain/types";

const statusOrder:SeatAvailability[]=["online","degraded","offline"];

export function CraneFlyPanel({
  state,
  seats,
  preview,
  busy,
  onAutoRoute,
  onPin,
  onUnpin,
  onSeatStatus
}:{
  state:ThinkTankState;
  seats:Seat[];
  preview:AssignmentPlan;
  busy:boolean;
  onAutoRoute:()=>void;
  onPin:(roleId:RoleId,seatId:SeatId)=>void;
  onUnpin:(roleId:RoleId)=>void;
  onSeatStatus:(seatId:SeatId,status:SeatAvailability)=>void;
}){
  const [selectedRole,setSelectedRole]=useState<RoleId>("dreamer");
  const [selectedSeat,setSelectedSeat]=useState<SeatId>("kimi");

  const selectedSeatStatus=state.seatStatus[selectedSeat];
  const pin=state.pinnedAssignments[selectedRole];

  return <section className="crane-panel" id="crane-fly-panel">
    <header>
      <div>
        <strong>CRANE FLY ROUTER</strong>
        <span>{state.routerPolicy.toUpperCase()} · ROLE ↔ SEAT SWITCHBOARD</span>
      </div>
      <b className={preview.unresolved.length?"router-bad":"router-good"}>
        {preview.unresolved.length?"UNRESOLVED "+preview.unresolved.length:"ROUTE READY"}
      </b>
    </header>

    <div className="crane-controls">
      <label>
        <span>ROLE</span>
        <select value={selectedRole} onChange={event=>setSelectedRole(event.target.value as RoleId)} disabled={busy}>
          {roles.map(role=><option value={role.id} key={role.id}>{role.name}</option>)}
        </select>
      </label>

      <label>
        <span>SEAT</span>
        <select value={selectedSeat} onChange={event=>setSelectedSeat(event.target.value as SeatId)} disabled={busy}>
          {seats.map(seat=><option value={seat.id} key={seat.id}>{seat.name}</option>)}
        </select>
      </label>

      <button
        type="button"
        onClick={()=>onPin(selectedRole,selectedSeat)}
        disabled={busy||selectedSeatStatus==="offline"}
      >
        PIN ROLE → SEAT
      </button>

      <button
        type="button"
        onClick={()=>onUnpin(selectedRole)}
        disabled={busy||!pin}
      >
        UNPIN {pin?"("+pin.toUpperCase()+")":""}
      </button>

      <button type="button" className="route-now" onClick={onAutoRoute} disabled={busy}>
        AUTO ROUTE ACTIVE MODE
      </button>
    </div>

    <div className="seat-status-grid">
      {seats.map(seat=><div className={"seat-status-card status-"+state.seatStatus[seat.id]} key={seat.id}>
        <div>
          <strong>{seat.name}</strong>
          <span>{seat.locality.toUpperCase()} · {seat.provider}</span>
        </div>
        <div className="status-buttons">
          {statusOrder.map(status=><button
            type="button"
            key={status}
            className={state.seatStatus[seat.id]===status?"active":""}
            onClick={()=>onSeatStatus(seat.id,status)}
            disabled={busy}
          >{status.toUpperCase()}</button>)}
        </div>
      </div>)}
    </div>

    <div className="assignment-table">
      <div className="assignment-row assignment-head">
        <span>ROLE</span><span>SEAT</span><span>SCORE</span><span>ORIGIN</span><span>WHY</span>
      </div>
      {roles.map(role=>{
        const current=state.assignments.find(item=>item.roleId===role.id);
        const decision=preview.decisions.find(item=>item.roleId===role.id);
        const active=Boolean(decision);
        const score=active?decision?.score:state.assignmentScores[role.id];
        const reason=active?decision?.reason:state.assignmentReasons[role.id];
        const origin=active?decision?.origin:state.assignmentOrigins[role.id];

        return <div className={"assignment-row"+(state.pinnedAssignments[role.id]?" pinned":"")+(active?" active-role":"")} key={role.id}>
          <span>{role.name}{state.pinnedAssignments[role.id]?" 📌":""}</span>
          <span>{(decision?.seatId??current?.seatId??"unassigned").toUpperCase()}</span>
          <span>{score?.toFixed(3)??"—"}</span>
          <span>{origin?.toUpperCase()??"—"}</span>
          <span>{reason??"No routing receipt yet."}</span>
        </div>;
      })}
    </div>

    {preview.unresolved.length>0&&<div className="routing-warning">
      UNRESOLVED ACTIVE ROLES: {preview.unresolved.map(role=>role.toUpperCase()).join(", ")}.
      An operator pin may point to an unavailable seat. AUTO will not override it.
    </div>}
  </section>;
}
