import type { RoleTerminal,Seat } from "../domain/types";
export const roles:RoleTerminal[]=[
{id:"dreamer",name:"DREAMER",accent:"magenta",verbs:["IMAGINE","EXPLORE","COMBINE","DIVERGE"],motif:"nested bubble gears"},
{id:"builder",name:"BUILDER",accent:"cyan",verbs:["DESIGN","ARCHITECT","IMPLEMENT","DEPLOY"],motif:"blueprint stack"},
{id:"vessie",name:"VESSIE PRIME",accent:"green",verbs:["COORDINATE","SYNTHESIZE","PRIORITIZE","ALIGN"],motif:"circumpunct command core"},
{id:"challenger",name:"CHALLENGER",accent:"amber",verbs:["QUESTION","STRESS TEST","FIND FLAWS","SEEK EVIDENCE"],motif:"scope waveform"},
{id:"archivist",name:"ARCHIVIST",accent:"sepia",verbs:["PRESERVE","ORGANIZE","RETRIEVE","REMEMBER"],motif:"tape and ledger"}
];
export const seats:Seat[]=[
{id:"openai",name:"OPENAI SEAT",provider:"OpenAI",model:"unbound",accent:"teal",capabilities:{WEB:4,MEMORY:3,REASON:5,TOOLS:4}},
{id:"kimi",name:"KIMI SEAT",provider:"Kimi",model:"unbound",accent:"blue",capabilities:{CONTEXT:5,MEMORY:4,ANALYZE:5,TOOLS:3}},
{id:"local",name:"LOCAL BRAIN",provider:"Ollama",model:"auto",accent:"instrument",capabilities:{PRIVATE:5,OFFLINE:5,TOOLS:4,SPEED:4}}
];
