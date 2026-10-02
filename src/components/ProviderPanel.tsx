import { providerBridgeUrl } from "../providers/client";
import type { ProviderSeatStatus,ProviderStatusResponse } from "../providers/types";

const stateLabel=(seat?:ProviderSeatStatus)=>seat?.state.toUpperCase()??"UNKNOWN";

export function ProviderPanel({
  status,
  error,
  localModel,
  liveBusy,
  liveReady,
  livePromptReady,
  liveProviderReady,
  directive,
  onLocalModel,
  onRefresh,
  onSync,
  onRunLive
}:{
  status:ProviderStatusResponse|null;
  error:string;
  localModel:string;
  liveBusy:boolean;
  liveReady:boolean;
  livePromptReady:boolean;
  liveProviderReady:boolean;
  directive:string;
  onLocalModel:(model:string)=>void;
  onRefresh:()=>void;
  onSync:()=>void;
  onRunLive:()=>void;
}){
  const local=status?.seats.find(seat=>seat.seatId==="local");

  return <section className="provider-panel">
    <header>
      <div>
        <strong>PROVIDER BRIDGE</strong>
        <span>LOCAL COMPANION · SECRETS NEVER ENTER THE BROWSER</span>
      </div>
      <b className={status?"provider-good":"provider-bad"}>{status?"BRIDGE ONLINE":"BRIDGE OFFLINE"}</b>
    </header>

    <div className="provider-meta">
      <span>{providerBridgeUrl}</span>
      <span>VERSION {status?.bridgeVersion??"—"}</span>
    </div>

    {error&&<div className="provider-error">{error}</div>}

    <div className="provider-grid">
      {(["local","openai","kimi"] as const).map(seatId=>{
        const seat=status?.seats.find(item=>item.seatId===seatId);
        return <div className={"provider-card provider-"+(seat?.state??"unknown")} key={seatId}>
          <strong>{seatId==="local"?"OLLAMA / LOCAL":seatId.toUpperCase()}</strong>
          <span>{stateLabel(seat)}</span>
          <small>{seat?.model??"NO MODEL"}</small>
          <p>{seat?.detail??"Provider bridge has not reported this seat."}</p>
        </div>;
      })}
    </div>

    <div className={"provider-live-directive "+(livePromptReady?"directive-ready":"directive-missing")}>
      <small>{liveBusy?"ACTIVE LIVE DIRECTIVE":"LIVE DIRECTIVE"}</small>
      <p>{directive.trim()||"ENTER OPERATOR DIRECTIVE BEFORE LIVE EXECUTION"}</p>
    </div>

    <div className="provider-controls">
      <label>
        <span>LOCAL OLLAMA MODEL</span>
        <select
          value={localModel}
          onChange={event=>onLocalModel(event.target.value)}
          disabled={liveBusy||!local?.models.length}
        >
          {!local?.models.length&&<option value="">NO LOCAL MODELS</option>}
          {local?.models.map(model=><option value={model} key={model}>{model}</option>)}
        </select>
      </label>

      <button type="button" onClick={onRefresh} disabled={liveBusy}>REFRESH PROVIDERS</button>
      <button type="button" onClick={onSync} disabled={liveBusy||!status}>SYNC HEALTH → CRANE FLY</button>
      <button type="button" className="live-run" onClick={onRunLive} disabled={liveBusy||!liveReady}>
        {liveBusy
          ?"LIVE PROVIDERS ACTIVE"
          :!livePromptReady
            ?"ENTER DIRECTIVE"
            :!liveProviderReady
              ?"PROVIDERS NOT READY"
              :"RUN LIVE PROVIDERS"}
      </button>
    </div>

    <footer>
      RUN LIVE PROVIDERS executes configured model backends. RUN SIMULATION in the operator rail uses deterministic fixtures.
      Remote providers remain disabled until both their server-side API key and model are configured.
      LIVE threshold modes fail closed at Reality Gate until a production evidence scorer exists.
    </footer>
  </section>;
}
