export type RoleId="vessie"|"dreamer"|"builder"|"challenger"|"archivist";
export type SeatId="openai"|"kimi"|"local";
export type TerminalState="idle"|"selected"|"listening"|"thinking"|"speaking"|"warning"|"offline"|"dimmed";
export type CollaborationMode="solo"|"trio"|"council"|"debate"|"dream"|"build"|"audit";
export type RouterPolicy="manual"|"auto-trio"|"council-broadcast"|"debate-round-robin"|"dream-forward"|"build-forward"|"audit-forward";
export type SessionPhase="intake"|"routing"|"independent"|"challenge"|"revision"|"synthesis"|"action"|"complete"|"aborted";
export type EventSource="operator"|"system"|"simulator"|"provider";
export type SynthesisTrigger="all-replied"|"gate-passed"|"operator-force"|"timeout";
export type GateBehavior="informational"|"threshold"|"threshold-or-draft"|"threshold-and-objection";
export type GovernanceLabel="STANDARD"|"SPECULATIVE"|"DRAFT"|"READY"|"AUDIT"|"WITHHELD";

export interface RoleTerminal{ id:RoleId; name:string; accent:string; verbs:string[]; motif:string; }
export interface Seat{ id:SeatId; name:string; model:string; provider:string; accent:string; capabilities:Record<string,number>; }
export interface Assignment{ roleId:RoleId; seatId:SeatId; }

export interface TurnPlan{
  activeRoles:RoleId[];
  speakerQueue:RoleId[];
  round:number;
  maxRounds:number;
  timeoutMs:number;
  synthesisTrigger:SynthesisTrigger;
  gateBehavior:GateBehavior;
  outputLabel:GovernanceLabel;
  objectionRequired:boolean;
}

export type ThinkTankEventKind=
  |"mode.selected"
  |"session.started"
  |"operator.prompt"
  |"role.assigned"
  |"schedule.planned"
  |"round.started"
  |"turn.started"
  |"turn.timeout"
  |"utterance.complete"
  |"challenge.raised"
  |"gate.scored"
  |"governance.fault"
  |"synthesis.withheld"
  |"synthesis.completed"
  |"operator.override"
  |"session.aborted";

export interface ThinkTankEvent{
  schemaVersion:1;
  sessionId:string;
  seq:number;
  seed:string;
  source:EventSource;
  mode:CollaborationMode;
  kind:ThinkTankEventKind;
  phase:SessionPhase;
  roleId?:RoleId;
  seatId?:SeatId;
  message?:string;
  gateScore?:number;
  override?:boolean;
  turnPlan?:TurnPlan;
  round?:number;
  faultCode?:string;
  outputLabel?:GovernanceLabel;
  actionAllowed?:boolean;
  governanceReason?:string;
  stateBefore:string;
  stateAfter:string;
}

export interface ThinkTankEventInput{
  source:EventSource;
  mode?:CollaborationMode;
  kind:ThinkTankEventKind;
  phase?:SessionPhase;
  roleId?:RoleId;
  seatId?:SeatId;
  message?:string;
  gateScore?:number;
  override?:boolean;
  turnPlan?:TurnPlan;
  round?:number;
  faultCode?:string;
  outputLabel?:GovernanceLabel;
  actionAllowed?:boolean;
  governanceReason?:string;
}

export interface ThinkTankState{
  sessionId:string;
  seed:string;
  mode:CollaborationMode;
  routerPolicy:RouterPolicy;
  phase:SessionPhase;
  seq:number;
  operatorPrompt:string;
  gateThreshold:number;
  gateScore:number|null;
  synthesisWithheld:boolean;
  assignments:Assignment[];
  terminalStates:Record<RoleId,TerminalState>;
  lastUtterance:Partial<Record<RoleId,string>>;
  turnPlan:TurnPlan|null;
  currentRound:number;
  speakerIndex:number;
  currentSpeaker:RoleId|null;
  objectionCount:number;
  outputLabel:GovernanceLabel|null;
  actionAllowed:boolean;
  governanceReason:string;
  faultCode:string|null;
  events:ThinkTankEvent[];
}
