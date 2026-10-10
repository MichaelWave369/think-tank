import {useState} from "react";
import {
 createInspirationEntry,INSPIRATION_MAX_ENTRIES,INSPIRATION_STORAGE_KEY,
 parseInspirationEntries,serializeInspirationEntries,
 type InspirationDraft,type InspirationEntry
} from "../inspirationLedger";

const blank:InspirationDraft={
 title:"",sourceUrl:"",inspire:"",abstract:"",invent:"",prototype:"",verify:""
};
const steps=[
 ["inspire","INSPIRE · What caught your attention?"],
 ["abstract","ABSTRACT · What general problem is solved?"],
 ["invent","INVENT · What is our original approach?"],
 ["prototype","PROTOTYPE · How could we test our own implementation?"],
 ["verify","VERIFY · What independent observation would demonstrate success?"]
] as const;
function initial(){
 try{return {entries:parseInspirationEntries(localStorage.getItem(INSPIRATION_STORAGE_KEY)),error:""}}
 catch(e){return {entries:[] as InspirationEntry[],error:"LOCAL STORAGE REFUSED: "+String(e)}}
}
export function InspirationLedgerPanel(){
 const [loaded]=useState(initial);
 const [entries,setEntries]=useState<InspirationEntry[]>(loaded.entries);
 const [draft,setDraft]=useState<InspirationDraft>(blank);
 const [error,setError]=useState(loaded.error);
 const [status,setStatus]=useState("");
 const update=(name:keyof InspirationDraft,value:string)=>setDraft(d=>({...d,[name]:value}));
 const persist=(next:InspirationEntry[])=>{
   localStorage.setItem(INSPIRATION_STORAGE_KEY,serializeInspirationEntries(next));
   setEntries(next);
 };
 const save=()=>{
  setStatus("");setError("");
  try{
   if(entries.length>=INSPIRATION_MAX_ENTRIES)throw Error("INSPIRATION_LIMIT");
   const next=[createInspirationEntry(draft,"INSP-"+crypto.randomUUID(),new Date().toISOString()),...entries];
   persist(next);setDraft(blank);setStatus("Browser-local operator draft saved; source NOT verified.");
  }catch(e){setError(String(e))}
 };
 const remove=(id:string)=>{
  setStatus("");setError("");
  try{persist(entries.filter(e=>e.id!==id));setStatus("Local draft deleted; no immutable receipt exists.")}
  catch(e){setError(String(e))}
 };
 const exportJson=()=>{
  setError("");
  try{
   const url=URL.createObjectURL(new Blob([serializeInspirationEntries(entries)],{type:"application/json"}));
   const a=document.createElement("a");a.href=url;a.download="thinktank-inspiration-ledger.json";
   document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(String(e))}
 };
 return <section className="inspiration-panel" aria-label="Original inspiration ledger">
  <header>
   <div><strong>INSPIRATION LEDGER · ORIGINAL DESIGN LAB</strong>
   <span>IDEA ≠ CODE · LINK ≠ LICENSE · DRAFT ≠ EVIDENCE · NO AUTO-EXECUTION</span></div>
   <b>REVIEW ONLY</b>
  </header>
  <p className="inspiration-warning">Manually authored ideas only. No external code is fetched,
   cloned, copied or installed. The browser-only notes are editable and clearable;
   <strong> this is NOT the canonical or tamper-evident ThinkTank event ledger.</strong>
   Entries cannot affect agents, Reality Gate, releases, or Anti-M DONE.</p>
  <div className="inspiration-fields">
   <label>TITLE<input value={draft.title} maxLength={120} onChange={e=>update("title",e.target.value)}
    placeholder="Interesting capability, original solution"/></label>
   <label>UNVERIFIED REFERENCE URL · HTTPS ONLY
    <input value={draft.sourceUrl} type="url" maxLength={500}
     onChange={e=>update("sourceUrl",e.target.value)} placeholder="https://github.com/owner/repo"/></label>
   {steps.map(([name,label])=><label key={name}>{label}
    <textarea rows={2} maxLength={1500} value={draft[name]}
     placeholder="Write in our own words. No third-party implementation."
     onChange={e=>update(name,e.target.value)}/></label>)}
  </div>
  <div className="inspiration-actions">
   <button type="button" onClick={save} disabled={entries.length>=INSPIRATION_MAX_ENTRIES}>SAVE DRAFT (NO RUN)</button>
   <button type="button" onClick={exportJson}>EXPORT LOCAL JSON · {entries.length}</button>
  </div>
  {error&&<p role="alert" className="inspiration-error">{error}</p>}
  {status&&<p role="status">{status}</p>}
  <div className="inspiration-entries">
   {entries.length===0&&<p>No drafts yet. Record the idea and invent our own mechanism.</p>}
   {entries.map(item=><article key={item.id}>
    <div className="inspiration-entry-title">
     <strong>{item.title}</strong>
     <button type="button" onClick={()=>remove(item.id)}>DELETE LOCAL DRAFT</button>
    </div>
    <small>{item.id} · OPERATOR UNVERIFIED · LOCAL CLOCK {item.capturedAt}</small>
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">OPEN EXTERNAL REFERENCE (UNVERIFIED)</a>
    {steps.map(([name,label])=><p key={name}><b>{label}</b><span>{item[name]}</span></p>)}
   </article>)}
  </div>
 </section>;
}
