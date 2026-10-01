import { useCallback,useEffect,useRef,useState } from "react";
import type { ThinkTankEvent } from "../domain/types";
import type { MotionMode } from "./motion";

export function useEventPlayback(
  applyEvent:(event:ThinkTankEvent)=>void,
  motionMode:MotionMode
){
  const timerRef=useRef<number|null>(null);
  const generationRef=useRef(0);
  const [playing,setPlaying]=useState(false);

  const cancel=useCallback(()=>{
    generationRef.current+=1;
    if(timerRef.current!==null){
      window.clearTimeout(timerRef.current);
      timerRef.current=null;
    }
    setPlaying(false);
  },[]);

  const play=useCallback((events:ThinkTankEvent[])=>{
    cancel();
    if(events.length===0)return;

    const generation=generationRef.current;
    const pace=motionMode==="reduced"?70:motionMode==="paused"?40:260;
    let index=0;
    setPlaying(true);

    const step=()=>{
      if(generation!==generationRef.current)return;
      applyEvent(events[index]);
      index+=1;

      if(index>=events.length){
        timerRef.current=null;
        setPlaying(false);
        return;
      }

      timerRef.current=window.setTimeout(step,pace);
    };

    step();
  },[applyEvent,cancel,motionMode]);

  useEffect(()=>cancel,[cancel]);

  return {playing,play,cancel};
}
