import {useRef,useState} from "react";
import {
 OWNED_RECEIPT_MAX_BYTES,OWNED_IMAGE_MAX_BYTES,
 buildOwnedReceiptReview,parseOwnedProbeReceipt,
 type OwnedProbeReceipt
} from "../ownedReceiptReview";

type SelectedReceipt={data:OwnedProbeReceipt;sha256:string;fileName:string};
const hex=(data:ArrayBuffer)=>[...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function hash(bytes:ArrayBuffer){
 if(!crypto.subtle)throw Error("RECEIPT_REQUIRES_SECURE_BROWSER_CONTEXT");
 return hex(await crypto.subtle.digest("SHA-256",bytes));
}
function downloadJson(raw:string){
 const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="tt43-owned-receipt-review.json";
 document.body.append(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function OwnedReceiptReviewPanel(){
 const [receipt,setReceipt]=useState<SelectedReceipt|null>(null);
 const [imageMatch,setImageMatch]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(0);
 const openReceipt=async(file:File)=>{
  const request=++generation.current;
  setReceipt(null);setImageMatch(false);setError("");setNotice("");setBusy(true);
  try{
   if(file.size>OWNED_RECEIPT_MAX_BYTES)throw Error("RECEIPT_FILE_TOO_LARGE");
   const bytes=await file.arrayBuffer();
   const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   const data=parseOwnedProbeReceipt(raw);
   const digest=await hash(bytes);
   if(request!==generation.current)return;
   setReceipt({data,sha256:digest,fileName:file.name});
   setNotice("STRUCTURE AND TWO-ROUND VALUES CONSISTENT. SOURCE/EXECUTION NOT AUTHENTICATED.");
  }catch(e){
   if(request===generation.current)setError("RECEIPT REFUSED: "+String(e));
  }finally{if(request===generation.current)setBusy(false)}
 };
 const checkImage=async(file:File)=>{
  if(!receipt)return;
  const request=generation.current;
  setImageMatch(false);setError("");setNotice("");setBusy(true);
  try{
   if(file.size>OWNED_IMAGE_MAX_BYTES||file.size<8)throw Error("RECEIPT_INVALID_IMAGE_SIZE");
   const bytes=await file.arrayBuffer();
   const h=new Uint8Array(bytes.slice(0,8));
   if(h.join(",")!=="137,80,78,71,13,10,26,10")
    throw Error("RECEIPT_IMAGE_NOT_PNG");
   const digest=await hash(bytes);
   if(request!==generation.current)return;
   if(digest!==receipt.data.screenshot.sha256)
    throw Error("RECEIPT_SCREENSHOT_MISMATCH");
   setImageMatch(true);
   setNotice("SCREENSHOT SHA-256 MATCHES DECLARED BYTES. ORIGIN REMAINS UNAUTHENTICATED.");
  }catch(e){if(request===generation.current)setError("SCREENSHOT REFUSED: "+String(e))}
  finally{if(request===generation.current)setBusy(false)}
 };
 const exportReview=()=>{
  setError("");setNotice("");
  try{
   if(!receipt)throw Error("RECEIPT_MISSING");
   const review=buildOwnedReceiptReview(receipt.data,receipt.sha256,imageMatch?true:null);
   downloadJson(JSON.stringify(review,null,2)+"\n");
   setNotice("REVIEW EXPORTED AS UNAUTHENTICATED. NO TEST OR RELEASE AUTHORITY IMPORTED.");
  }catch(e){setError(String(e))}
 };
 const changeRows=receipt?.data.rounds[0];
 return <details className="owned-receipt-lab" aria-label="TT-43 machine receipt review">
  <summary>TT-43 · MACHINE RECEIPT REVIEW <span>LOCAL FILES · UNAUTHENTICATED</span></summary>
  <div className="owned-receipt-body">
   <p>Import the JSON receipt from a TT-42 GitHub Actions artifact for <b>offline, read-only</b>
    inspection. This checks schema, fixed target, expected transitions and repeated rounds.
    It does not confirm GitHub origin, execution, ownership, or signature.</p>
   <label>TT-42 RECEIPT JSON (MAX 128 KiB)
    <input type="file" accept=".json,application/json" disabled={busy}
     onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";
      if(f)void openReceipt(f);}}/>
   </label>
   {receipt&&<>
    <div className="owned-receipt-summary">
     <strong>STRUCTURALLY CONSISTENT · NOT AUTHENTICATED</strong>
     <small>{receipt.fileName} · SHA-256 {receipt.sha256}</small>
     <span>Claimed build commit: {receipt.data.checkedOutCommit}</span>
     <span>Reported Chromium: {receipt.data.browserVersion} · 2 consistent rounds</span>
    </div>
    {changeRows&&<div className="capture-scroll">
     <table className="capture-table">
      <thead><tr><th>MEASURED FIELD (AS REPORTED)</th><th>BEFORE</th><th>AFTER</th></tr></thead>
      <tbody>{(["ui.mode","ui.count"] as const).map(key=><tr key={key}>
       <td>{key}</td><td>{changeRows.before[key]}</td><td>{changeRows.after[key]}</td>
      </tr>)}</tbody>
     </table>
    </div>}
    <label>OPTIONAL MATCHING TT-42 PNG (MAX 3 MiB)
     <input type="file" accept=".png,image/png" disabled={busy}
      onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";
       if(f)void checkImage(f);}}/>
    </label>
    <small>Screenshot byte digest: {imageMatch?"MATCHES RECEIPT":"NOT CHECKED OR REFUSED"}</small>
    <div className="behavior-actions">
     <button type="button" onClick={exportReview} disabled={busy}>EXPORT UNAUTHENTICATED REVIEW</button>
    </div>
   </>}
   {busy&&<p className="capture-note" role="status">Checking selected file locally…</p>}
   {error&&<p className="behavior-error" role="alert">{error}</p>}
   {notice&&<p className="behavior-notice" role="status">{notice}</p>}
   <small className="behavior-footer">No file network upload, code execution or app scanning.
    A matching hash shows byte equality only. Review results never enter the canonical
    ThinkTank ledger, authorize release, or set Anti-M DONE. Files remain in page memory
    until you replace them or leave this panel.</small>
  </div>
 </details>;
}
