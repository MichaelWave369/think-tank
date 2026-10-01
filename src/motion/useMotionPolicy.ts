import { useEffect,useState } from "react";
import type { MotionMode } from "./motion";

const reducedPreference=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const documentVisible=()=>typeof document==="undefined"||document.visibilityState!=="hidden";

export function useMotionPolicy():MotionMode{
  const [reduced,setReduced]=useState(reducedPreference);
  const [visible,setVisible]=useState(documentVisible);

  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference=()=>setReduced(media.matches);
    const onVisibility=()=>setVisible(document.visibilityState!=="hidden");

    media.addEventListener("change",onPreference);
    document.addEventListener("visibilitychange",onVisibility);

    return ()=>{
      media.removeEventListener("change",onPreference);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  if(!visible)return "paused";
  return reduced?"reduced":"full";
}
