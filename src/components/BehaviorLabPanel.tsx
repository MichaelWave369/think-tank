import {BehaviorCapturePanel} from "./BehaviorCapturePanel";
import {useState} from "react";
import {
 BEHAVIOR_MAX_STEPS,BEHAVIOR_MAX_STUDIES,BEHAVIOR_STORAGE_KEY,
 appendBehaviorStep,buildBehaviorAcceptanceDraft,createBehaviorStudy,
 parseBehaviorStudies,serializeBehaviorStudies,
 type BehaviorStudy,type StudyDraft,type TraceDraft
} from "../behaviorLab";

const freshStudy:StudyDraft={
 target:"",scope:"",access:"owned",accessNote:""
};
const freshTrace:TraceDraft={
 kind:"operator-observed",before:"",action:"",after:"",
 interpretation:"",originalDesign:"",acceptanceCheck:""
};
const fields=[
 ["before","BEFORE · What was the visible state?"],
 ["action","ACTION · What did the operator do?"],
 ["after","AFTER · What outcome was reported?"],
 ["interpretation","INTERPRET · What might explain the result?"],
 ["originalDesign","INVENT · What is our independent design?"],
 ["acceptanceCheck","TEST · What would we independently check?"]
] as const;
function initial():{studies:BehaviorStudy[];error:string}{
 try{return {studies:parseBehaviorStudies(localStorage.getItem(BEHAVIOR_STORAGE_KEY)),error:""}}
 catch(e){return {studies:[],error:"STORAGE REFUSED: "+String(e)}}
}
function download(name:string,content:string,mime:string){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const anchor=document.createElement("a");anchor.href=url;anchor.download=name;
 document.body.append(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function BehaviorLabPanel(){
 const [loaded]=useState(initial);
 const [studies,setStudies]=useState(loaded.studies);
 const [selected,setSelected]=useState("");
 const [newStudy,setNewStudy]=useState<StudyDraft>(freshStudy);
 const [newTrace,setNewTrace]=useState<TraceDraft>(freshTrace);
 const [error,setError]=useState(loaded.error);
 const [notice,setNotice]=useState("");
 const active=studies.find(s=>s.id===selected);
 const save=(next:BehaviorStudy[])=>{
  localStorage.setItem(BEHAVIOR_STORAGE_KEY,serializeBehaviorStudies(next));
  setStudies(next);
 };
 const create=()=>{
  setNotice("");setError("");
  try{
   if(studies.length>=BEHAVIOR_MAX_STUDIES)throw Error("BEHAVIOR_STUDY_LIMIT");
   const s=createBehaviorStudy(newStudy,"STUDY-"+crypto.randomUUID(),new Date().toISOString());
   save([s,...studies]);setSelected(s.id);setNewStudy(freshStudy);
   setNotice("Study saved locally. Access declaration is NOT independently verified.");
  }catch(e){setError(String(e))}
 };
 const add=()=>{
  setNotice("");setError("");
  try{
   if(!active)throw Error("SELECT_A_STUDY");
   const updated=appendBehaviorStep(active,newTrace,"STEP-"+crypto.randomUUID(),new Date().toISOString());
   save(studies.map(s=>s.id===active.id?updated:s));
   setNewTrace(freshTrace);
   setNotice("Manual trace recorded, NOT verified or executed.");
  }catch(e){setError(String(e))}
 };
 const remove=()=>{
  setNotice("");setError("");
  try{
   if(!active)return;
   save(studies.filter(s=>s.id!==active.id));setSelected("");
   setNotice("Browser-local study deleted. No immutable receipt was created.");
  }catch(e){setError(String(e))}
 };
 const exportJson=()=>{
  setError("");
  try{download("thinktank-behavior-studies.json",serializeBehaviorStudies(studies),"application/json")}
  catch(e){setError(String(e))}
 };
 const exportPlan=()=>{
  setError("");
  try{
   if(!active)throw Error("SELECT_A_STUDY");
   download("thinktank-behavior-acceptance-draft.md",buildBehaviorAcceptanceDraft(active),"text/markdown");
  }catch(e){setError(String(e))}
 };
 return <section className="behavior-lab" aria-label="Software behavior lab">
  <header className="behavior-header">
   <div><strong>SOFTWARE BEHAVIOR LAB · Φ OBSERVATORY</strong>
    <span>INSPECT → TRACE → ABSTRACT → DESIGN → TEST</span></div>
   <b>LOCAL · REVIEW ONLY</b>
  </header>
  <p className="behavior-warning">First-party investigation notebook. No target is contacted or executed.
   All access assertions, observations, documentation notes and hypotheses are operator-unverified.
   No borrowed implementation, agent execution, canonical evidence, release authority or Anti-M DONE.</p>
  <div className="behavior-create">
   <label>TARGET / APP NAME
    <input value={newStudy.target} maxLength={120} placeholder="Our owned prototype"
     onChange={e=>setNewStudy(s=>({...s,target:e.target.value}))}/></label>
   <label>ACCESS BASIS · OPERATOR ASSERTION ONLY
    <select value={newStudy.access} onChange={e=>setNewStudy(s=>({...s,access:e.target.value as StudyDraft["access"]}))}>
     <option value="owned">Owned software</option>
     <option value="explicit-permission">Explicit permission (not verified)</option>
     <option value="public-interface">Publicly observable interface only</option>
    </select></label>
   <label>IN-SCOPE BEHAVIOR
    <textarea rows={2} maxLength={550} value={newStudy.scope}
     placeholder="UI actions and expected outputs to investigate"
     onChange={e=>setNewStudy(s=>({...s,scope:e.target.value}))}/></label>
   <label>SCOPE / PERMISSION NOTE
    <textarea rows={2} maxLength={550} value={newStudy.accessNote}
     placeholder="Why this study is within scope. This is not a verified permission grant."
     onChange={e=>setNewStudy(s=>({...s,accessNote:e.target.value}))}/></label>
  </div>
  <div className="behavior-actions">
   <button type="button" onClick={create} disabled={studies.length>=BEHAVIOR_MAX_STUDIES}>CREATE LOCAL STUDY</button>
   <button type="button" onClick={exportJson}>EXPORT ALL JSON · {studies.length}</button>
  </div>
  <div className="behavior-divider">
   <label>ACTIVE STUDY
    <select value={selected} onChange={e=>setSelected(e.target.value)}>
     <option value="">Select saved study</option>
     {studies.map(s=><option key={s.id} value={s.id}>{s.target} · {s.steps.length} traces</option>)}
    </select></label>
  </div>
  {active&&<>
   <div className="behavior-summary">
    <strong>{active.target}</strong>
    <span>{active.scope}</span>
    <small>{active.access} · access NOT verified · {active.steps.length}/{BEHAVIOR_MAX_STEPS} traces · no source attestation</small>
   </div>
   <div className="behavior-create">
    <label>TRACE CLASSIFICATION
     <select value={newTrace.kind} onChange={e=>setNewTrace(t=>({...t,kind:e.target.value as TraceDraft["kind"]}))}>
      <option value="operator-observed">Operator-reported observation</option>
      <option value="public-documentation">Public documentation note</option>
      <option value="hypothesis">Hypothesis, not observed</option>
     </select></label>
    {fields.map(([name,label])=><label key={name}>{label}
     <textarea rows={2} maxLength={1200} value={newTrace[name]}
      onChange={e=>setNewTrace(t=>({...t,[name]:e.target.value}))}/></label>)}
   </div>
   <div className="behavior-actions">
    <button type="button" onClick={add} disabled={active.steps.length>=BEHAVIOR_MAX_STEPS}>RECORD TRACE (NO RUN)</button>
    <button type="button" onClick={exportPlan}>EXPORT DRAFT TEST PLAN</button>
    <button type="button" className="behavior-danger" onClick={remove}>DELETE LOCAL STUDY</button>
   </div>
   <BehaviorCapturePanel key={active.id} study={active}/>
   <div className="behavior-traces">
    {active.steps.length===0&&<p>No traces yet. Start with one observable interaction or an explicitly labeled hypothesis.</p>}
    {active.steps.map((s,i)=><article key={s.id}>
     <strong>TRACE {i+1} · {s.kind}</strong><small>{s.capturedAt} · NOT VERIFIED · NOT TESTED</small>
     <p><b>Before:</b> {s.before}</p><p><b>Action:</b> {s.action}</p>
     <p><b>After:</b> {s.after}</p><p><b>Interpretation:</b> {s.interpretation}</p>
     <p><b>Our design:</b> {s.originalDesign}</p>
     <p><b>Candidate check:</b> {s.acceptanceCheck}</p>
    </article>)}
   </div>
  </>}
  {error&&<p className="behavior-error" role="alert">{error}</p>}
  {notice&&<p className="behavior-notice" role="status">{notice}</p>}
  <small className="behavior-footer">Browser-local notes are editable, clearable and unsigned. JSON export is not a canonical ThinkTank receipt.</small>
 </section>;
}
