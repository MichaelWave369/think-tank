import {useState} from "react";
import {type BehaviorStep,type BehaviorStudy} from "../behaviorLab";
import {type BehaviorCapture} from "../behaviorCapture";
import {
 appendCaptureExpectation,createExpectationPlan,evaluateCaptureExpectations,
 exportCaptureEvaluation,EXPECTATION_MAX_RULES,type CaptureExpectation,
 type ExpectationOperator,type ExpectationPlan
} from "../captureExpectations";

function downloadReport(contents:string){
 const url=URL.createObjectURL(new Blob([contents],{type:"application/json"}));
 const anchor=document.createElement("a");
 anchor.href=url;anchor.download="thinktank-capture-expectation-review.json";
 document.body.append(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function CaptureExpectationPanel({
 study,trace,candidate,candidateSha256
}:{
 study:BehaviorStudy;trace:BehaviorStep;candidate:BehaviorCapture;candidateSha256:string;
}){
 const [plan,setPlan]=useState<ExpectationPlan>(()=>createExpectationPlan(study,trace.id));
 const [field,setField]=useState("ui.visible-state");
 const [operator,setOperator]=useState<ExpectationOperator>("equals");
 const [expected,setExpected]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const add=()=>{
  setError("");setNotice("");
  try{
   const rule:CaptureExpectation={
    id:"RULE-"+crypto.randomUUID(),key:field.trim(),operator,
    expected:operator==="equals"||operator==="differs"?expected:null
   };
   setPlan(appendCaptureExpectation(plan,rule));
   setExpected("");
   setNotice("Rule added to this browser session only; no target application was tested.");
  }catch(e){setError(String(e))}
 };
 const remove=(id:string)=>{
  setPlan(p=>({...p,rules:p.rules.filter(x=>x.id!==id)}));
  setNotice("Rule removed from the transient review.");
 };
 const evaluation=plan.rules.length?evaluateCaptureExpectations(plan,candidate):null;
 const exportReport=()=>{
  setError("");setNotice("");
  try{
   if(!evaluation)throw Error("EXPECTATION_NO_RULES");
   downloadReport(exportCaptureEvaluation(plan,evaluation,candidateSha256));
   setNotice("Capture-only evaluation exported, unsigned and not a test execution receipt.");
  }catch(e){setError(String(e))}
 };
 return <section className="expectation-lab" aria-label="Capture-only expectation review">
  <header><strong>TT-40 · EXPECTATION CHECKS</strong><small>OPERATOR RULES · NOT APP TESTS</small></header>
  <p className="capture-note">Evaluate explicit rules against the currently selected candidate JSON.
   An agreement only describes these operator-supplied values. It does not verify the source,
   execute the target, establish correctness, grant release authority, or mark Anti-M DONE.</p>
  <div className="expectation-entry">
   <label>OBSERVATION KEY
    <input value={field} maxLength={80} list="behavior-candidate-keys"
     onChange={e=>setField(e.target.value)} placeholder="ui.mode"/>
    <datalist id="behavior-candidate-keys">{candidate.observations.map(o=>
     <option key={o.key} value={o.key}/>)}</datalist>
   </label>
   <label>OPERATOR
    <select value={operator} onChange={e=>setOperator(e.target.value as ExpectationOperator)}>
     <option value="equals">Equals (exact string)</option>
     <option value="differs">Differs (exact string)</option>
     <option value="present">Present in capture</option>
     <option value="absent">Absent from capture</option>
    </select>
   </label>
   {(operator==="equals"||operator==="differs")&&<label>EXPECTED STRING
    <input value={expected} maxLength={1000} onChange={e=>setExpected(e.target.value)}
     placeholder="Enter expected value from your own specification"/>
   </label>}
  </div>
  <div className="behavior-actions">
   <button type="button" onClick={add} disabled={plan.rules.length>=EXPECTATION_MAX_RULES}>
    ADD RULE · {plan.rules.length}/{EXPECTATION_MAX_RULES}
   </button>
   <button type="button" onClick={exportReport} disabled={!evaluation}>
    EXPORT REVIEW-ONLY RULE REPORT
   </button>
  </div>
  {error&&<p className="behavior-error" role="alert">{error}</p>}
  {notice&&<p className="behavior-notice" role="status">{notice}</p>}
  {evaluation&&<div className="capture-summary" aria-label="Capture rule evaluation totals">
   <strong>CAPTURE-ONLY RULE REVIEW · NOT A TEST RESULT</strong>
   <span>AGREES {evaluation.counts.agrees} · CONTRADICTS {evaluation.counts.contradicts} · NOT CAPTURED {evaluation.counts.notCaptured}</span>
  </div>}
  {plan.rules.length>0&&<div className="expectation-results">
   {plan.rules.map((rule,i)=>{
    const result=evaluation?.results[i];
    return <article key={rule.id}>
     <div><strong>RULE {i+1} · {rule.operator.toUpperCase()}</strong>
      <button type="button" onClick={()=>remove(rule.id)}>REMOVE</button></div>
     <p>Key: <b>{rule.key}</b></p>
     <p>Expected: {rule.expected??"(no value required)"}</p>
     <p>Captured: {result?.observed??"(not captured)"}</p>
     <small>CAPTURE REVIEW: {result?.status??"NOT EVALUATED"}</small>
    </article>;
   })}
  </div>}
  <small className="behavior-footer">Rules and results stay in session memory only.
   Changing the candidate resets the rule list. Exported JSON is unsigned, mutable,
   and cannot promote itself to the ThinkTank canonical evidence ledger.</small>
 </section>;
}
