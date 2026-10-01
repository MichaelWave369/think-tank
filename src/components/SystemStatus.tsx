import type { ThinkTankState } from "../domain/types";
export function SystemStatus({state}:{state:ThinkTankState}){
 const gate=state.gateScore===null?"WAITING":state.gateScore.toFixed(2);
 return <section className="system-status"><strong>SYSTEM STATUS</strong><span>Crane Fly: {state.routerPolicy.toUpperCase()}</span><span>Reality Gate: {gate} / {state.gateThreshold.toFixed(2)}</span><span>Compute: LOCAL_FIRST</span><span>Atlas: SIM</span><span>Professor Φ: SIM</span><span>Ledger: ACTIVE</span></section>;
}
