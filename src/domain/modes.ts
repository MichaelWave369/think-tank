import type {
  CollaborationMode,
  GateBehavior,
  GovernanceLabel,
  ClaimPolicyKind,
  RoleId,
  RouterPolicy,
  SynthesisTrigger
} from "./types";

export interface ModeDefinition{
  id:CollaborationMode;
  label:string;
  activeSet:string;
  router:RouterPolicy;
  gate:string;
  leaders:RoleId[];
  activeRoles:RoleId[];
  speakerQueue:RoleId[];
  maxRounds:number;
  timeoutMs:number;
  synthesisTrigger:SynthesisTrigger;
  gateBehavior:GateBehavior;
  outputLabel:GovernanceLabel;
  objectionRequired:boolean;
  actionRule:string;
  claimPolicy:ClaimPolicyKind;
}

export const MODE_MATRIX:ModeDefinition[]=[
  {
    id:"solo",label:"SOLO",activeSet:"1 pinned role or seat",router:"manual",
    gate:"informational",leaders:["vessie"],activeRoles:["vessie"],speakerQueue:["vessie"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"all-replied",gateBehavior:"informational",
    outputLabel:"STANDARD",objectionRequired:false,actionRule:"Gate is visible but does not block synthesis.",claimPolicy:"informational"
  },
  {
    id:"trio",label:"TRIO",activeSet:"3 complementary roles",router:"auto-trio",
    gate:"synthesis allowed at threshold",leaders:["dreamer","builder","challenger"],
    activeRoles:["dreamer","builder","challenger"],speakerQueue:["dreamer","builder","challenger"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"gate-passed",gateBehavior:"threshold",
    outputLabel:"STANDARD",objectionRequired:false,actionRule:"Below threshold, synthesis is withheld.",claimPolicy:"bound-fresh"
  },
  {
    id:"council",label:"COUNCIL",activeSet:"all assigned roles",router:"council-broadcast",
    gate:"synthesis withheld below threshold",leaders:["vessie"],
    activeRoles:["dreamer","builder","challenger","archivist","vessie"],
    speakerQueue:["dreamer","builder","challenger","archivist","vessie"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"gate-passed",gateBehavior:"threshold",
    outputLabel:"STANDARD",objectionRequired:false,actionRule:"All scheduled voices land before gate evaluation.",claimPolicy:"all-fresh"
  },
  {
    id:"debate",label:"DEBATE",activeSet:"challenger plus defenders",router:"debate-round-robin",
    gate:"objection + threshold required",leaders:["challenger","vessie"],
    activeRoles:["challenger","builder","vessie"],speakerQueue:["challenger","builder","vessie"],
    maxRounds:3,timeoutMs:30000,synthesisTrigger:"gate-passed",gateBehavior:"threshold-and-objection",
    outputLabel:"STANDARD",objectionRequired:true,actionRule:"At least one objection must land before synthesis.",claimPolicy:"bound-fresh"
  },
  {
    id:"dream",label:"DREAM",activeSet:"Dreamer leads; others dimmed",router:"dream-forward",
    gate:"informational; output marked speculative",leaders:["dreamer"],
    activeRoles:["dreamer"],speakerQueue:["dreamer"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"all-replied",gateBehavior:"informational",
    outputLabel:"SPECULATIVE",objectionRequired:false,actionRule:"Dream output is explicitly speculative and non-actionable.",claimPolicy:"informational"
  },
  {
    id:"build",label:"BUILD",activeSet:"Builder with Challenger + Archivist support",router:"build-forward",
    gate:"low-evidence plan remains draft",leaders:["builder"],
    activeRoles:["builder","challenger","archivist"],speakerQueue:["builder","challenger","archivist"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"gate-passed",gateBehavior:"threshold-or-draft",
    outputLabel:"DRAFT",objectionRequired:false,actionRule:"Below threshold, plan may exist only as DRAFT.",claimPolicy:"bound-fresh"
  },
  {
    id:"audit",label:"AUDIT",activeSet:"Challenger + Archivist lead",router:"audit-forward",
    gate:"no action until threshold passes",leaders:["challenger","archivist"],
    activeRoles:["challenger","archivist"],speakerQueue:["challenger","archivist"],
    maxRounds:1,timeoutMs:30000,synthesisTrigger:"gate-passed",gateBehavior:"threshold",
    outputLabel:"AUDIT",objectionRequired:false,actionRule:"Action phase remains locked until the gate passes.",claimPolicy:"audit-ready"
  }
];

export const modeDefinition=(mode:CollaborationMode):ModeDefinition=>
  MODE_MATRIX.find(item=>item.id===mode)??MODE_MATRIX[0];

export const routerForMode=(mode:CollaborationMode):RouterPolicy=>modeDefinition(mode).router;
