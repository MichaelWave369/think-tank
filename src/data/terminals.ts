import type { RoleTerminal,Seat } from "../domain/types";

export const roles:RoleTerminal[]=[
  {id:"dreamer",name:"DREAMER",accent:"magenta",verbs:["IMAGINE","EXPLORE","COMBINE","DIVERGE"],motif:"nested bubble gears"},
  {id:"builder",name:"BUILDER",accent:"cyan",verbs:["DESIGN","ARCHITECT","IMPLEMENT","DEPLOY"],motif:"blueprint stack"},
  {id:"vessie",name:"VESSIE PRIME",accent:"green",verbs:["COORDINATE","SYNTHESIZE","PRIORITIZE","ALIGN"],motif:"circumpunct command core"},
  {id:"challenger",name:"CHALLENGER",accent:"amber",verbs:["QUESTION","STRESS TEST","FIND FLAWS","SEEK EVIDENCE"],motif:"scope waveform"},
  {id:"archivist",name:"ARCHIVIST",accent:"sepia",verbs:["PRESERVE","ORGANIZE","RETRIEVE","REMEMBER"],motif:"tape and ledger"}
];

export const seats:Seat[]=[
  {
    id:"openai",name:"OPENAI SEAT",provider:"OpenAI",model:"unbound",accent:"teal",locality:"remote",
    capabilities:{REASON:5,CONTEXT:4,TOOLS:5,WEB:5,MEMORY:3,PRIVATE:1,OFFLINE:0,SPEED:4,BUILD:5,CRITIQUE:5,ARCHIVE:3,IMAGINE:4,SYNTHESIS:5}
  },
  {
    id:"kimi",name:"KIMI SEAT",provider:"Kimi",model:"unbound",accent:"blue",locality:"remote",
    capabilities:{REASON:4,CONTEXT:5,TOOLS:3,WEB:4,MEMORY:4,PRIVATE:1,OFFLINE:0,SPEED:4,BUILD:3,CRITIQUE:4,ARCHIVE:5,IMAGINE:5,SYNTHESIS:4}
  },
  {
    id:"local",name:"LOCAL BRAIN",provider:"Ollama",model:"auto",accent:"instrument",locality:"local",
    capabilities:{REASON:4,CONTEXT:3,TOOLS:5,WEB:1,MEMORY:4,PRIVATE:5,OFFLINE:5,SPEED:5,BUILD:5,CRITIQUE:3,ARCHIVE:4,IMAGINE:3,SYNTHESIS:4}
  }
];
