/* TT-34: review-only URL fragment handoff from Vessie.
 * No cookies, provider requests, URL query transmission, session startup,
 * role/mode mutation, or inherited authority.
 */
export type SpvDraft={
 schema:"spv-thinktank-draft.v0.1";
 kind:"operator-directive-draft";
 source:"vessie-human-composed";
 directive:string;
 suggestedMode:"council"|"debate"|"audit"|"trio"|"build";
 runRequested:false;
 executionAuthorityGranted:false;
 providerKeysTransferred:false;
};
const PREFIX="#spv-draft=";
const valid=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const ERR=(code:string):never=>{throw Error("SPV_DRAFT_"+code)};
export function inspectSpvDraft(input:unknown):SpvDraft{
 if(!valid(input))return ERR("FIELDS");
 const expected=["schema","kind","source","directive","suggestedMode","runRequested",
  "executionAuthorityGranted","providerKeysTransferred"];
 if(Object.keys(input).sort().join("|")!==expected.sort().join("|"))return ERR("FIELDS");
 if(input.schema!=="spv-thinktank-draft.v0.1"||
    input.kind!=="operator-directive-draft"||input.source!=="vessie-human-composed")
  return ERR("SCHEMA");
 if(typeof input.directive!=="string"||input.directive.trim().length<3||
    input.directive.length>1200||/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(input.directive))
  return ERR("DIRECTIVE");
 if(!["council","debate","audit","trio","build"].includes(String(input.suggestedMode)))return ERR("MODE");
 if(input.runRequested!==false||input.executionAuthorityGranted!==false||
    input.providerKeysTransferred!==false)return ERR("AUTHORITY");
 return input as SpvDraft;
}
export function readSpvFragment(hash:string):SpvDraft|null{
 if(!hash.startsWith(PREFIX))return null;
 if(hash.length>PREFIX.length+4100)return ERR("SIZE");
 const payload=hash.slice(PREFIX.length);
 if(!/^[A-Za-z0-9_-]+$/.test(payload))return ERR("BASE64");
 let bytes:string;
 try{
  const raw=atob(payload.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(payload.length/4)*4,"="));
  bytes=new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from(raw,ch=>ch.charCodeAt(0)));
 }catch{return ERR("BASE64")}
 let json:unknown;
 try{json=JSON.parse(bytes)}catch{return ERR("JSON")}
 return inspectSpvDraft(json)
}
export const SPV_DRAFT_HASH_PREFIX=PREFIX;
