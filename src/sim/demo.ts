import type { CollaborationMode,ThinkTankEvent } from "../domain/types";

export const demoEvents=(sessionId:string,seed:string,mode:CollaborationMode,startSeq:number):ThinkTankEvent[]=>{
  const e=(offset:number,event:Omit<ThinkTankEvent,"sessionId"|"seed"|"mode"|"seq">):ThinkTankEvent=>({
    sessionId,seed,mode,seq:startSeq+offset,...event
  });

  return [
    e(1,{kind:"session.started",phase:"routing",message:"Multi-mind session opened."}),
    e(2,{kind:"turn.started",phase:"independent",roleId:"dreamer",seatId:"kimi",message:"Dreamer begins."}),
    e(3,{kind:"utterance.complete",phase:"independent",roleId:"dreamer",seatId:"kimi",message:"What if the interface makes routing itself visible instead of hiding the handoff?"}),
    e(4,{kind:"turn.started",phase:"independent",roleId:"builder",seatId:"local",message:"Builder begins."}),
    e(5,{kind:"utterance.complete",phase:"independent",roleId:"builder",seatId:"local",message:"Every visible terminal state should be a projection of the same sequenced session events."}),
    e(6,{kind:"turn.started",phase:"challenge",roleId:"challenger",seatId:"openai",message:"Challenger begins."}),
    e(7,{kind:"challenge.raised",phase:"challenge",roleId:"challenger",seatId:"openai",message:"Objection logged: decorative motion must never imply evidence or routing that did not occur."}),
    e(8,{kind:"turn.started",phase:"revision",roleId:"archivist",seatId:"kimi",message:"Archivist begins."}),
    e(9,{kind:"utterance.complete",phase:"revision",roleId:"archivist",seatId:"kimi",message:"Ledger sequence and visible state remain aligned; replay can reconstruct the room."}),
    e(10,{kind:"turn.started",phase:"synthesis",roleId:"vessie",seatId:"local",message:"Vessie Prime begins synthesis review."}),
    e(11,{kind:"utterance.complete",phase:"synthesis",roleId:"vessie",seatId:"local",message:"Council round complete. Evidence scoring now determines whether synthesis may proceed."}),
    e(12,{kind:"gate.scored",phase:"synthesis",gateScore:.63,message:"Evidence score below threshold."}),
    e(13,{kind:"synthesis.withheld",phase:"synthesis",message:"Synthesis withheld until threshold or operator override."})
  ];
};
