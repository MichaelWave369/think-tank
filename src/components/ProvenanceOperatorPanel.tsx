import {useState} from "react";
import {
 buildOperatorCommand,TT51_PROOF_ARTIFACT,
 type TT51Platform
} from "../provenanceOperatorGuide";

/* No file imports, network requests, trust promotion or code execution. */
export function ProvenanceOperatorPanel(){
 const [commit,setCommit]=useState("");
 const [root,setRoot]=useState("");
 const [runId,setRunId]=useState("");
 const [platform,setPlatform]=useState<TT51Platform>("powershell");
 const [error,setError]=useState("");
 const [command,setCommand]=useState<ReturnType<typeof buildOperatorCommand>|null>(null);
 const invalidate=()=>{setError("");setCommand(null)};
 const prepare=()=>{
  invalidate();
  try{setCommand(buildOperatorCommand(commit,root,runId,platform))}
  catch(e){setError(String(e))}
 };
 return <details className="owned-receipt-lab tt51-operator-guide" aria-label="TT-51 portable proof operator guide">
  <summary>TT-51 · VERIFY PORTABLE PROOF ON YOUR OWN COMPUTER <span>COMMAND PLANNER · NEVER BROWSER AUTHENTICATION</span></summary>
  <div className="owned-receipt-body">
   <p>The GitHub Actions pipeline can now sign, challenge, and verify proof inside a network-disabled
    container. Here you can prepare a <b>local GitHub CLI verification command</b> for your own
    computer. This page does not authenticate files or run that command.</p>
   <p>Download <b>{TT51_PROOF_ARTIFACT}</b> from a trusted <a href="https://github.com/MichaelWave369/think-tank/actions/workflows/thinktank-independent-provenance-consumer.yml" target="_blank" rel="noreferrer">independent consumer workflow</a> and extract the six proof files into an <code>unpacked-proof</code> directory beside your trusted ThinkTank checkout.
    Install Node.js and GitHub CLI locally. The CLI must support attestation verification.</p>
   <p><strong>Obtain these two values independently.</strong> Confirm the reviewed main commit from GitHub's
    run metadata and the Sigstore trusted-root SHA-256 from a separately trusted retrieval.
    Do not copy either solely from the editable proof manifest.</p>
   <div className="tt51-operator-fields">
    <label>INDEPENDENT MAIN COMMIT · EXACT 40 LOWERCASE HEX
     <input type="text" spellCheck={false} value={commit} maxLength={40}
      placeholder="reviewed main-branch Git SHA"
      onChange={e=>{invalidate();setCommit(e.target.value)}}/>
    </label>
    <label>INDEPENDENT TRUSTED-ROOT SHA-256 · EXACT 64 LOWERCASE HEX
     <input type="text" spellCheck={false} value={root} maxLength={64}
      placeholder="SHA-256 of independently retrieved trusted root"
      onChange={e=>{invalidate();setRoot(e.target.value)}}/>
    </label>
    <label>GITHUB PRODUCER/CONSUMER RUN ID · OPTIONAL NAVIGATION ONLY
     <input type="text" inputMode="numeric" spellCheck={false} maxLength={16}
      value={runId} placeholder="run ID, never proof of execution"
      onChange={e=>{invalidate();setRunId(e.target.value)}}/>
    </label>
    <label>LOCAL SHELL
     <select value={platform} onChange={e=>{invalidate();setPlatform(e.target.value as TT51Platform)}}>
      <option value="powershell">Windows PowerShell</option>
      <option value="bash">Linux / macOS shell</option>
     </select>
    </label>
   </div>
   <div className="behavior-actions">
    <button type="button" onClick={prepare}>PREPARE LOCAL COMMAND · NO EXECUTION</button>
   </div>
   {command&&<div className="tt51-operator-result" role="status">
    <strong>COMMAND PREPARED · SIGNATURES NOT VERIFIED BY THIS BROWSER</strong>
    <pre>{command.command}</pre>
    {command.runUrl&&<a href={command.runUrl} target="_blank" rel="noreferrer">
     Open specified GitHub Actions run · navigation only, status not checked</a>}
    <small>Execute this yourself from your trusted ThinkTank checkout, with the proof
     directory in place. The command will fail if the root fingerprint differs or
     GitHub CLI cannot cryptographically verify both exact signed subjects.</small>
   </div>}
   {error&&<p role="alert" className="behavior-error">COMMAND REFUSED: {error}</p>}
   <small className="behavior-footer">Browser state is ephemeral. No GitHub API calls, file uploads,
    auto-verification or bridge/model execution. Passing the local CLI checks signatures and
    pinned source identity; it does NOT by itself prove your computer was offline, grant
    canonical evidence, authorize release, or set Anti-M DONE.</small>
  </div>
 </details>;
}
