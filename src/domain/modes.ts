import type { CollaborationMode,RoleId,RouterPolicy } from "./types";
export interface ModeDefinition{ id:CollaborationMode; label:string; activeSet:string; router:RouterPolicy; gate:string; leaders:RoleId[]; }
export const MODE_MATRIX:ModeDefinition[]=[
{id:"solo",label:"SOLO",activeSet:"1 pinned role or seat",router:"manual",gate:"informational",leaders:["vessie"]},
{id:"trio",label:"TRIO",activeSet:"3 pinned or complementary",router:"auto-trio",gate:"threshold synthesis",leaders:["vessie","builder","challenger"]},
{id:"council",label:"COUNCIL",activeSet:"all assigned, then Vessie",router:"council-broadcast",gate:"withhold below threshold",leaders:["vessie"]},
{id:"debate",label:"DEBATE",activeSet:"challenger + defenders",router:"debate-round-robin",gate:"objections before synthesis",leaders:["challenger","vessie"]},
{id:"dream",label:"DREAM",activeSet:"Dreamer leads",router:"dream-forward",gate:"speculative label",leaders:["dreamer"]},
{id:"build",label:"BUILD",activeSet:"Builder + support",router:"build-forward",gate:"unsupported plan stays draft",leaders:["builder"]},
{id:"audit",label:"AUDIT",activeSet:"Challenger + Archivist",router:"audit-forward",gate:"no action until pass",leaders:["challenger","archivist"]}
];
export const routerForMode=(mode:CollaborationMode):RouterPolicy=>MODE_MATRIX.find(x=>x.id===mode)?.router??"manual";
