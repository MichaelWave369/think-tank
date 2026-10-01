import { MODE_MATRIX } from "../domain/modes";
import type { CollaborationMode } from "../domain/types";

export function ModeBar({
  mode,
  disabled=false,
  onChange
}:{
  mode:CollaborationMode;
  disabled?:boolean;
  onChange:(mode:CollaborationMode)=>void;
}){
  return <nav className="mode-bar" aria-label="Collaboration mode">
    {MODE_MATRIX.map(item=><button
      key={item.id}
      className={mode===item.id?"active":""}
      onClick={()=>onChange(item.id)}
      title={item.gate}
      disabled={disabled}
    >{item.label}</button>)}
  </nav>;
}
