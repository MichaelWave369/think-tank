/* TT-37: Original, manual, browser-local idea notes, not canonical evidence. */
export const INSPIRATION_STORAGE_KEY="thinktank-original-inspiration-v1";
export const INSPIRATION_MAX_ENTRIES=40;
const schema="thinktank.inspiration.v1";
const bundleSchema="thinktank.inspiration.bundle.v1";
export type InspirationDraft={
 title:string; sourceUrl:string; inspire:string; abstract:string;
 invent:string; prototype:string; verify:string;
};
export type InspirationEntry=InspirationDraft&{
 schema:typeof schema;id:string;capturedAt:string;
 sourceProvenance:"operator-unverified";sourceVerified:false;
 executionAuthority:false;codeImported:false;
};
const fields=["title","sourceUrl","inspire","abstract","invent","prototype","verify"] as const;
function record(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==="object"&&!Array.isArray(x);
}
function keysMatch(x:Record<string,unknown>,wanted:string[]):boolean{
 return Object.keys(x).sort().join("|")===wanted.sort().join("|");
}
function note(x:unknown,name:string,max:number){
 if(typeof x!=="string"||x.trim().length<3||x.length>max||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x)){
   throw Error("INSPIRATION_INVALID_"+name.toUpperCase());
 }
 return x.trim();
}
export function createInspirationEntry(
 draft:InspirationDraft,id:string,capturedAt:string
):InspirationEntry{
 if(!/^INSP-[\w-]{8,80}$/.test(id))throw Error("INSPIRATION_INVALID_ID");
 if(!/^\d{4}-\d{2}-\d{2}T/.test(capturedAt)||!Number.isFinite(Date.parse(capturedAt)))
   throw Error("INSPIRATION_INVALID_TIME");
 const title=note(draft.title,"title",120);
 const raw=note(draft.sourceUrl,"source",500);
 let url:URL;try{url=new URL(raw)}catch{throw Error("INSPIRATION_INVALID_URL")}
 if(url.protocol!=="https:"||!url.hostname||url.username||url.password)
   throw Error("INSPIRATION_HTTPS_ONLY");
 return {
  schema,id,capturedAt,sourceProvenance:"operator-unverified",sourceVerified:false,
  executionAuthority:false,codeImported:false,title,sourceUrl:url.href,
  inspire:note(draft.inspire,"inspire",1500),
  abstract:note(draft.abstract,"abstract",1500),
  invent:note(draft.invent,"invent",1500),
  prototype:note(draft.prototype,"prototype",1500),
  verify:note(draft.verify,"verify",1500)
 };
}
function inspect(entry:unknown):InspirationEntry{
 if(!record(entry)||!keysMatch(entry,[
   ...fields,"schema","id","capturedAt","sourceProvenance","sourceVerified",
   "executionAuthority","codeImported"
 ]))throw Error("INSPIRATION_INVALID_FIELDS");
 if(entry.schema!==schema||entry.sourceProvenance!=="operator-unverified"||
    entry.sourceVerified!==false||entry.executionAuthority!==false||entry.codeImported!==false)
   throw Error("INSPIRATION_AUTHORITY_REFUSED");
 const draft=Object.fromEntries(fields.map(key=>[key,entry[key]])) as InspirationDraft;
 const normalized=createInspirationEntry(draft,entry.id as string,entry.capturedAt as string);
 if(normalized.sourceUrl!==entry.sourceUrl)throw Error("INSPIRATION_INVALID_URL");
 return normalized;
}
export function serializeInspirationEntries(entries:InspirationEntry[]):string{
 if(entries.length>INSPIRATION_MAX_ENTRIES)throw Error("INSPIRATION_LIMIT");
 const checked=entries.map(inspect);
 if(new Set(checked.map(x=>x.id)).size!==checked.length)throw Error("INSPIRATION_DUPLICATE");
 const json=JSON.stringify({schema:bundleSchema,kind:"review-only-local-notes",entries:checked},null,2);
 if(new TextEncoder().encode(json).length>512000)throw Error("INSPIRATION_STORAGE_LIMIT");
 return json;
}
export function parseInspirationEntries(raw:string|null):InspirationEntry[]{
 if(raw===null)return [];
 if(raw.length>512000)throw Error("INSPIRATION_STORAGE_LIMIT");
 let x:unknown;try{x=JSON.parse(raw)}catch{throw Error("INSPIRATION_INVALID_JSON")}
 if(!record(x)||!keysMatch(x,["schema","kind","entries"])||
    x.schema!==bundleSchema||x.kind!=="review-only-local-notes"||
    !Array.isArray(x.entries)||x.entries.length>INSPIRATION_MAX_ENTRIES)
   throw Error("INSPIRATION_INVALID_BUNDLE");
 const entries=x.entries.map(inspect);
 if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error("INSPIRATION_DUPLICATE");
 return entries;
}
