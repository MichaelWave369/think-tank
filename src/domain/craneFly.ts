import { modeDefinition } from "./modes";
import type {
  AssignmentOrigin,
  CapabilityKey,
  CollaborationMode,
  RoleId,
  Seat,
  SeatId,
  ThinkTankState
} from "./types";

export interface RoleRequirement{
  weights:Partial<Record<CapabilityKey,number>>;
  localBonus:number;
}

export interface AssignmentDecision{
  roleId:RoleId;
  seatId:SeatId;
  score:number;
  origin:AssignmentOrigin;
  reason:string;
}

export interface AssignmentPlan{
  mode:CollaborationMode;
  decisions:AssignmentDecision[];
  unresolved:RoleId[];
}

export const ROLE_REQUIREMENTS:Record<RoleId,RoleRequirement>={
  vessie:{weights:{SYNTHESIS:5,REASON:4,CONTEXT:3,MEMORY:2},localBonus:.35},
  dreamer:{weights:{IMAGINE:5,CONTEXT:4,REASON:2,MEMORY:2},localBonus:.05},
  builder:{weights:{BUILD:5,TOOLS:4,REASON:4,SPEED:2,PRIVATE:1},localBonus:.35},
  challenger:{weights:{CRITIQUE:5,REASON:5,WEB:3,CONTEXT:2},localBonus:.05},
  archivist:{weights:{ARCHIVE:5,MEMORY:5,CONTEXT:4,PRIVATE:1},localBonus:.2}
};

const statusMultiplier=(status:ThinkTankState["seatStatus"][SeatId])=>{
  if(status==="offline")return 0;
  if(status==="degraded")return .78;
  return 1;
};

export function scoreSeatForRole(
  roleId:RoleId,
  seat:Seat,
  state:ThinkTankState,
  currentLoad=0
):number{
  const status=state.seatStatus[seat.id];
  if(status==="offline")return Number.NEGATIVE_INFINITY;

  const requirement=ROLE_REQUIREMENTS[roleId];
  let weighted=0;
  let totalWeight=0;

  for(const [key,weight] of Object.entries(requirement.weights) as [CapabilityKey,number][]){
    weighted+=(seat.capabilities[key]??0)*weight;
    totalWeight+=weight;
  }

  let score=totalWeight?weighted/totalWeight:0;
  score*=statusMultiplier(status);

  if(seat.locality==="local")score+=requirement.localBonus;

  // Prefer diversity when capability fit is otherwise close.
  score-=currentLoad*.18;

  // Stable, tiny deterministic tie-break toward seat id order.
  const tieBreak:Record<SeatId,number>={local:.003,openai:.002,kimi:.001};
  score+=tieBreak[seat.id];

  return Number(score.toFixed(3));
}

export function planAssignments(
  state:ThinkTankState,
  seats:Seat[],
  mode:CollaborationMode=state.mode
):AssignmentPlan{
  const activeRoles=modeDefinition(mode).activeRoles;
  const load:Record<SeatId,number>={openai:0,kimi:0,local:0};
  const decisions:AssignmentDecision[]=[];
  const unresolved:RoleId[]=[];

  for(const roleId of activeRoles){
    const pinned=state.pinnedAssignments[roleId];

    if(pinned){
      if(state.seatStatus[pinned]==="offline"){
        unresolved.push(roleId);
        continue;
      }

      const seat=seats.find(candidate=>candidate.id===pinned);
      if(!seat){
        unresolved.push(roleId);
        continue;
      }

      const score=scoreSeatForRole(roleId,seat,state,load[pinned]);
      load[pinned]+=1;
      decisions.push({
        roleId,
        seatId:pinned,
        score,
        origin:"operator-pin",
        reason:"Operator pin is authoritative; automatic routing did not override it."
      });
      continue;
    }

    const ranked=seats
      .filter(seat=>state.seatStatus[seat.id]!=="offline")
      .map(seat=>({seat,score:scoreSeatForRole(roleId,seat,state,load[seat.id])}))
      .sort((a,b)=>b.score-a.score||a.seat.id.localeCompare(b.seat.id));

    const winner=ranked[0];
    if(!winner){
      unresolved.push(roleId);
      continue;
    }

    load[winner.seat.id]+=1;
    const topNeeds=Object.entries(ROLE_REQUIREMENTS[roleId].weights)
      .sort((a,b)=>(b[1]??0)-(a[1]??0))
      .slice(0,3)
      .map(([key])=>key)
      .join("/");

    decisions.push({
      roleId,
      seatId:winner.seat.id,
      score:winner.score,
      origin:"auto",
      reason:
        "Best available fit for "+roleId.toUpperCase()+
        " across "+topNeeds+
        "; "+winner.seat.locality.toUpperCase()+
        ", status "+state.seatStatus[winner.seat.id].toUpperCase()+"."
    });
  }

  return {mode,decisions,unresolved};
}
