import {CaptureExpectationPanel} from "./CaptureExpectationPanel";
import {useRef,useState} from "react";
import {type BehaviorStep,type BehaviorStudy} from "../behaviorLab";
import {
 CAPTURE_MAX_BYTES,buildBehaviorComparisonReport,compareBehaviorCaptures,
 makeBehaviorCaptureTemplate,parseBehaviorCapture,type BehaviorCapture
} from "../behaviorCapture";

type SelectedCapture={capture:BehaviorCapture;name:string;sha256:string};
type Lane="baseline"|"candidate";
function download(name:string,contents:string,mime:string){
 const url=URL.createObjectURL(new Blob([contents],{type:mime}));
 const a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function sha256(raw:string){
 if(!crypto.subtle)throw Error("SHA256_REQUIRES_SECURE_BROWSER_CONTEXT");
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function LocalCaptureComparator({study,trace}:{study:BehaviorStudy;trace:BehaviorStep}){
 const [baseline,setBaseline]=useState<SelectedCapture|null>(null);
 const [candidate,setCandidate]=useState<SelectedCapture|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState<Lane|null>(null);
 const serial=useRef({baseline:0,candidate:0});
 const load=async(file:File,lane:Lane)=>{
  const request=++serial.current[lane];
  const setter=lane==="baseline"?setBaseline:setCandidate;
  setter(null);setError("");setNotice("");setBusy(lane);
  try{
   if(file.size>CAPTURE_MAX_BYTES)throw Error("CAPTURE_FILE_TOO_LARGE");
   const contents=await file.text();
   const capture=parseBehaviorCapture(contents,study,trace.id);
   const hash=await sha256(contents);
   if(request!==serial.current[lane])return;
   setter({capture,name:file.name,sha256:hash});
   setNotice(lane.toUpperCase()+" FILE LOADED LOCALLY; CONTENTS NOT VERIFIED AS TRUE.");
  }catch(e){
   if(request===serial.current[lane])setError("CAPTURE REFUSED: "+String(e));
  }finally{
   if(request===serial.current[lane])setBusy(null);
  }
 };
 const comparison=baseline&&candidate?
  compareBehaviorCaptures(baseline.capture,candidate.capture):null;
 const template=()=>{
  try{
   const contents=makeBehaviorCaptureTemplate(study,trace,new Date().toISOString());
   download("thinktank-capture-template.json",contents,"application/json");
   setNotice("Template generated locally. Replace placeholder values with observations from your authorized software.");
  }catch(e){setError(String(e))}
 };
 const exportReport=()=>{
  if(!comparison||!baseline||!candidate)return;
  try{
   const report=buildBehaviorComparisonReport(comparison,baseline.sha256,candidate.sha256);
   download("thinktank-capture-comparison-draft.json",report,"application/json");
   setNotice("Review-only comparison exported; no test, source or permission verified.");
  }catch(e){setError(String(e))}
 };
 return <div className="capture-workspace">
  <p className="capture-note">Only files you manually select are read, entirely in this browser.
   Maximum {CAPTURE_MAX_BYTES/1024} KiB per file. No folder access, filesystem writes,
   external calls, application launches, model runs or automatic scanning.
   Selected file contents are held in memory until you leave or change the study.</p>
  <div className="behavior-actions">
   <button type="button" onClick={template}>DOWNLOAD JSON CAPTURE TEMPLATE</button>
  </div>
  <div className="capture-inputs">
   {(["baseline","candidate"] as const).map(lane=><label key={lane}>
    {lane.toUpperCase()} · OPERATOR-SUPPLIED .JSON
    <input type="file" accept=".json,application/json"
     onChange={e=>{
      const file=e.currentTarget.files?.[0];
      e.currentTarget.value="";
      if(file)void load(file,lane);
     }}/>
    <small>{lane==="baseline"?
     (baseline?baseline.name+" · SHA-256 "+baseline.sha256:"No baseline loaded"):
     (candidate?candidate.name+" · SHA-256 "+candidate.sha256:"No candidate loaded")}</small>
   </label>)}
  </div>
  {busy&&<p className="capture-note" role="status">Reading {busy} locally…</p>}
  {error&&<p className="behavior-error" role="alert">{error}</p>}
  {notice&&<p className="behavior-notice" role="status">{notice}</p>}
  {comparison&&<>
   <div className="capture-summary">
    <strong>OPERATOR-SUPPLIED COMPARISON · NOT A TEST RESULT</strong>
    <span>UNCHANGED {comparison.counts.unchanged} · CHANGED {comparison.counts.changed} · ADDED {comparison.counts.added} · MISSING {comparison.counts.missing}</span>
   </div>
   <div className="capture-scroll">
    <table className="capture-table">
     <thead><tr><th>FIELD</th><th>BASELINE</th><th>CANDIDATE</th><th>COMPARISON</th></tr></thead>
     <tbody>{comparison.differences.map(row=><tr key={row.key}>
      <td>{row.key}</td><td>{row.baseline??"(not captured)"}</td>
      <td>{row.candidate??"(not captured)"}</td><td>{row.change}</td>
     </tr>)}</tbody>
    </table>
   </div>
   <div className="behavior-actions">
    <button type="button" onClick={exportReport}>EXPORT REVIEW-ONLY COMPARISON</button>
   </div>
   {candidate&&<CaptureExpectationPanel key={candidate.sha256} study={study}
    trace={trace} candidate={candidate.capture} candidateSha256={candidate.sha256}/>}
  </>}
  <small className="behavior-footer">SHA-256 fingerprints the exact selected file bytes.
   It does not certify file origin, observational accuracy, test results or permission.
   Exported reports are mutable, unsigned, outside the canonical ledger and not Anti-M DONE.</small>
 </div>;
}
export function BehaviorCapturePanel({study}:{study:BehaviorStudy}){
 const [selectedTrace,setSelectedTrace]=useState("");
 const trace=study.steps.find(s=>s.id===selectedTrace);
 return <section className="capture-lab" aria-label="Read-only capture comparison">
  <header><strong>TT-39 · LOCAL BEHAVIOR CAPTURE COMPARATOR</strong><b>READ ONLY · DRAFT</b></header>
  <p className="capture-note">Compare two operator-authored observation snapshots from one trace of
   your own or otherwise authorized software. This tool never contacts the target app.</p>
  <label className="capture-trace-select">TRACE TO COMPARE
   <select value={selectedTrace} onChange={e=>setSelectedTrace(e.target.value)}>
    <option value="">Select an existing study trace</option>
    {study.steps.map((step,i)=><option key={step.id} value={step.id}>
     Trace {i+1} · {step.action.slice(0,74)}
    </option>)}
   </select>
  </label>
  {trace?<LocalCaptureComparator key={trace.id} study={study} trace={trace}/>:
   <p className="capture-note">Record a manual trace first, then select it to generate the capture template.</p>}
 </section>;
}
