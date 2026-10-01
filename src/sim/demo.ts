import type { CollaborationMode,ThinkTankEvent } from "../domain/types";
export const demoEvents=(sessionId:string,seed:string,mode:CollaborationMode,startSeq:number):ThinkTankEvent[]=>{
 const e=(offset:number,event:Omit<ThinkTankEvent,"sessionId"|"seed"|"mode"|"seq">):ThinkTankEvent=>({sessionId,seed,mode,seq:startSeq+offset,...event});
 return [
  e(1,{kind:"session.started",phase:"routing",message:"Multi-mind session opened."}),
  e(2,{kind:"turn.started",phase:"independent",roleId:"dreamer",seatId:"kimi",message:"Dreamer begins."}),
  e(3,{kind:"utterance.complete",phase:"independent",roleId:"dreamer",seatId:"kimi",message:"What if the interface makes routing itself visible?"}),
  e(4,{kind:"turn.started",phase:"challenge",roleId:"challenger",seatId:"openai",message:"Challenger begins."}),
  e(5,{kind:"challenge.raised",phase:"challenge",roleId:"challenger",seatId:"openai",message:"Objection logged: visibility must reflect real events, not decorative motion."}),
  e(6,{kind:"utterance.complete",phase:"revision",roleId:"builder",seatId:"local",message:"Builder: project every light from the event reducer."}),
  e(7,{kind:"gate.scored",phase:"synthesis",gateScore:.63,message:"Evidence score below threshold."}),
  e(8,{kind:"synthesis.withheld",phase:"synthesis",message:"Synthesis withheld until threshold or operator override."})
 ];
};
