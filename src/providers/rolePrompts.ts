import type { CollaborationMode,RoleId } from "../domain/types";
import type { ProviderMessage } from "./types";

const ROLE_SYSTEM:Record<RoleId,string>={
  dreamer:"You are staffing DREAMER. Explore novel structures, alternatives, and useful connections. Clearly label speculation and do not fabricate evidence.",
  builder:"You are staffing BUILDER. Convert the task into concrete architecture, implementation steps, constraints, and failure modes. Prefer feasible details over flourish.",
  challenger:"You are staffing CHALLENGER. Stress-test claims, surface assumptions, identify missing evidence, and state objections clearly. Do not manufacture objections when none exist.",
  archivist:"You are staffing ARCHIVIST. Preserve provenance, summarize what prior roles established, distinguish observation from inference, and flag missing source continuity.",
  vessie:"You are staffing VESSIE PRIME. Coordinate the other cognitive roles, identify agreements and unresolved objections, and produce a candidate synthesis without pretending the Reality Gate has passed."
};

export function buildRoleMessages(
  roleId:RoleId,
  mode:CollaborationMode,
  operatorPrompt:string,
  prior:Partial<Record<RoleId,string>>
):ProviderMessage[]{
  const context=Object.entries(prior)
    .map(([role,text])=>role.toUpperCase()+": "+text)
    .join("\n\n");

  const user=[
    "MODE: "+mode.toUpperCase(),
    "OPERATOR REQUEST:",
    operatorPrompt,
    context?"PRIOR ROLE OUTPUTS:\n"+context:"",
    "Respond only as "+roleId.toUpperCase()+". Keep the answer concise enough for the terminal speech viewport while still being useful."
  ].filter(Boolean).join("\n\n");

  return [
    {role:"system",content:ROLE_SYSTEM[roleId]},
    {role:"user",content:user}
  ];
}
