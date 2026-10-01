import type { CollaborationMode,TurnPlan } from "./types";
export function initialTurnPlan(mode:CollaborationMode):TurnPlan{
 const base={phase:"routing" as const,round:0,maxRounds:mode==="debate"?3:1,timeoutMs:30000,synthesisTrigger:"all-replied" as const};
 switch(mode){
  case "solo": return {...base,speakerQueue:["vessie"]};
  case "trio": return {...base,speakerQueue:["dreamer","builder","challenger"]};
  case "debate": return {...base,speakerQueue:["challenger","builder","vessie"]};
  case "dream": return {...base,speakerQueue:["dreamer","challenger","vessie"]};
  case "build": return {...base,speakerQueue:["builder","challenger","archivist"]};
  case "audit": return {...base,speakerQueue:["challenger","archivist","vessie"]};
  default: return {...base,speakerQueue:["dreamer","builder","challenger","archivist","vessie"]};
 }
}
