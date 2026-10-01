import { useEffect,useMemo,useRef,useState } from "react";
import type { EvidenceExcerpt,EvidenceRef } from "../domain/types";
import type { EvidenceProjectionResponse } from "../providers/types";

const short=(value:string)=>value.slice(0,14)+"…";

export function SourceExcerptPanel({
  evidence,
  excerpts,
  busy,
  toolError,
  lockedExcerptIds,
  onPreview,
  onPin,
  onRemove
}:{
  evidence:EvidenceRef[];
  excerpts:EvidenceExcerpt[];
  busy:boolean;
  toolError:string;
  lockedExcerptIds:string[];
  onPreview:(evidenceId:string)=>Promise<EvidenceProjectionResponse>;
  onPin:(evidenceId:string,start:number,end:number)=>Promise<void>;
  onRemove:(excerptId:string)=>void;
}){
  const machine=useMemo(
    ()=>evidence.filter(ref=>ref.verification==="machine-verified"&&ref.retrieval&&ref.uri),
    [evidence]
  );
  const [evidenceId,setEvidenceId]=useState("");
  const [projection,setProjection]=useState<EvidenceProjectionResponse|null>(null);
  const [previewBusy,setPreviewBusy]=useState(false);
  const [selection,setSelection]=useState({start:0,end:0});
  const textareaRef=useRef<HTMLTextAreaElement|null>(null);

  useEffect(()=>{
    if(evidenceId&&machine.some(ref=>ref.id===evidenceId))return;
    setEvidenceId(machine[0]?.id??"");
    setProjection(null);
    setSelection({start:0,end:0});
  },[machine,evidenceId]);

  const preview=async()=>{
    if(!evidenceId||busy)return;
    setPreviewBusy(true);
    try{
      const next=await onPreview(evidenceId);
      setProjection(next);
      setSelection({start:0,end:0});
    }catch{
      setProjection(null);
    }finally{
      setPreviewBusy(false);
    }
  };

  const captureSelection=()=>{
    const node=textareaRef.current;
    if(!node)return;
    setSelection({start:node.selectionStart,end:node.selectionEnd});
  };

  const pin=async()=>{
    if(!evidenceId||selection.end<=selection.start||busy)return;
    await onPin(evidenceId,selection.start,selection.end);
  };

  const selectedLength=selection.end-selection.start;

  return <section className="excerpt-panel">
    <header>
      <div>
        <strong>SOURCE EXCERPT CONSOLE</strong>
        <span>EXACT TEXT FROM HASH-MATCHED MACHINE EVIDENCE · NO MODEL REWRITE</span>
      </div>
      <b>{excerpts.length} PINNED</b>
    </header>

    <div className="excerpt-controls">
      <label>
        <span>MACHINE-VERIFIED SOURCE</span>
        <select value={evidenceId} onChange={e=>{setEvidenceId(e.target.value);setProjection(null);}} disabled={busy||machine.length===0}>
          {machine.length===0&&<option value="">NO MACHINE EVIDENCE</option>}
          {machine.map(ref=><option key={ref.id} value={ref.id}>{ref.id} · {ref.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={()=>void preview()} disabled={busy||!evidenceId}>
        {previewBusy?"PROJECTING…":"EXTRACT SOURCE TEXT"}
      </button>
    </div>

    {projection&&<div className="excerpt-workbench">
      <div className="excerpt-meta">
        <span>SOURCE {short(projection.sourceSha256)}</span>
        <span>PROJECTION {short(projection.projectionSha256)}</span>
        <span>{projection.charCount.toLocaleString()} CHARS{projection.truncated?" · TRUNCATED":""}</span>
        <span>{projection.contentType}</span>
      </div>

      <textarea
        ref={textareaRef}
        value={projection.text}
        readOnly
        onSelect={captureSelection}
        aria-label="Projected source text"
      />

      <div className="excerpt-selection">
        <span>SELECTED {selection.start} → {selection.end} · {selectedLength} CHARS</span>
        <button type="button" onClick={()=>void pin()} disabled={busy||selectedLength<1||selectedLength>1600}>
          PIN SELECTED EXCERPT
        </button>
      </div>
    </div>}

    {toolError&&<div className="excerpt-error">EXCERPT TOOL: {toolError}</div>}

    <div className="excerpt-list">
      {excerpts.length===0&&<p>No pinned excerpts. Machine verification proves retrieval; excerpts pin exact source text for later review.</p>}
      {excerpts.map(excerpt=><article key={excerpt.id}>
        <div>
          <strong>{excerpt.id} · {excerpt.evidenceId}</strong>
          <span>{excerpt.startChar}→{excerpt.endChar} · SHA {short(excerpt.excerptSha256)}</span>
          <blockquote>{excerpt.text}</blockquote>
          <small>PROJECTION {short(excerpt.projectionSha256)} · {excerpt.extractedAt}</small>
        </div>
        <button type="button" onClick={()=>onRemove(excerpt.id)} disabled={busy||lockedExcerptIds.includes(excerpt.id)}>
          {lockedExcerptIds.includes(excerpt.id)?"DISMISS REVIEW FIRST":"REMOVE"}
        </button>
      </article>)}
    </div>

    <footer>
      <span>PDF sources remain verifiable but are not text-projectable in PR 14.</span>
    </footer>
  </section>;
}
