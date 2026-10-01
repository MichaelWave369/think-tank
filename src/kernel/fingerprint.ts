import type { ThinkTankState } from "../domain/types";
import { stableStringify } from "./stable";

export function projectionSnapshot(state:ThinkTankState){
  return {
    sessionId:state.sessionId,
    seed:state.seed,
    mode:state.mode,
    routerPolicy:state.routerPolicy,
    phase:state.phase,
    seq:state.seq,
    operatorPrompt:state.operatorPrompt,
    gateThreshold:state.gateThreshold,
    gateScore:state.gateScore,
    synthesisWithheld:state.synthesisWithheld,
    assignments:state.assignments,
    terminalStates:state.terminalStates,
    lastUtterance:state.lastUtterance
  };
}

/**
 * Fast deterministic projection fingerprint.
 *
 * This is an integrity/replay checksum, not a cryptographic security hash.
 * The event ledger is intentionally excluded to avoid self-referential hashes.
 */
export function fingerprintProjection(state:ThinkTankState):string{
  const text=stableStringify(projectionSnapshot(state));
  let hash=0x811c9dc5;

  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }

  return "fnv1a32:"+hash.toString(16).padStart(8,"0");
}
