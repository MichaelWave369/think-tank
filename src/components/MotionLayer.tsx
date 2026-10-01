import type { MotionCue,MotionMode } from "../motion/motion";

export function MotionLayer({cue,mode}:{cue:MotionCue;mode:MotionMode}){
  return <div
    className={"motion-layer cue-"+cue.kind+" motion-"+mode+" intensity-"+cue.intensity}
    data-seq={cue.seq}
    aria-hidden="true"
  >
    <div className="motion-wash"/>
    <div className="motion-sweep"/>
    <div className="motion-rings"><i/><i/><i/></div>
    <div className="motion-particles">
      {Array.from({length:8},(_,index)=><i key={index}/>)}
    </div>
  </div>;
}
