export type RoleId="vessie"|"dreamer"|"builder"|"challenger"|"archivist";
export type SeatId="openai"|"kimi"|"local";
export type TerminalState="idle"|"selected"|"listening"|"thinking"|"speaking"|"warning"|"offline"|"dimmed";
export type CollaborationMode="solo"|"trio"|"council"|"debate"|"dream"|"build"|"audit";
export type RouterPolicy="manual"|"auto-trio"|"council-broadcast"|"debate-round-robin"|"dream-forward"|"build-forward"|"audit-forward";
export type SessionPhase="intake"|"routing"|"independent"|"challenge"|"revision"|"synthesis"|"action"|"complete"|"aborted";
export interface RoleTerminal{ id:RoleId; name:string; accent:string; verbs:string[]; motif:string; }
export interface Seat{ id:SeatId; name:string; model:string; provider:string; accent:string; capabilities:Record<string,number>; }
export interface Assignment{ roleId:RoleId; seatId:SeatId; }
export interface TurnPlan{ phase:SessionPhase; speakerQueue:RoleId[]; round:number; maxRounds:number; timeoutMs:number; synthesisTrigger:"all-replied"|"gate-passed"|"operator-force"|"timeout"; }
export interface ThinkTankEvent{
  sessionId:string; seq:number; seed:string; mode:CollaborationMode;
  kind:"session.started"|"operator.prompt"|"role.assigned"|"turn.started"|"utterance.complete"|"challenge.raised"|"gate.scored"|"synthesis.withheld"|"synthesis.completed"|"operator.override"|"session.aborted";
  phase:SessionPhase; roleId?:RoleId; seatId?:SeatId; message?:string; gateScore?:number; override?:boolean; stateBefore?:string; stateAfter?:string;
}
export interface ThinkTankState{
  sessionId:string; seed:string; mode:CollaborationMode; routerPolicy:RouterPolicy; phase:SessionPhase; seq:number;
  gateThreshold:number; gateScore:number|null; synthesisWithheld:boolean; assignments:Assignment[];
  terminalStates:Record<RoleId,TerminalState>; lastUtterance:Partial<Record<RoleId,string>>; events:ThinkTankEvent[];
}
