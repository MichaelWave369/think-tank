import type { ThinkTankEventInput } from "../domain/types";

export const demoEventInputs=(prompt:string):ThinkTankEventInput[]=>[
  {
    source:"operator",
    kind:"operator.prompt",
    phase:"intake",
    message:prompt.trim()||"Run deterministic Council demonstration."
  },
  {
    source:"system",
    kind:"session.started",
    phase:"routing",
    message:"Multi-mind session opened."
  },
  {
    source:"simulator",
    kind:"turn.started",
    phase:"independent",
    roleId:"dreamer",
    seatId:"kimi",
    message:"Dreamer begins."
  },
  {
    source:"simulator",
    kind:"utterance.complete",
    phase:"independent",
    roleId:"dreamer",
    seatId:"kimi",
    message:"What if the interface makes routing itself visible instead of hiding the handoff?"
  },
  {
    source:"simulator",
    kind:"turn.started",
    phase:"independent",
    roleId:"builder",
    seatId:"local",
    message:"Builder begins."
  },
  {
    source:"simulator",
    kind:"utterance.complete",
    phase:"independent",
    roleId:"builder",
    seatId:"local",
    message:"Every visible terminal state should be a projection of the same sequenced session events."
  },
  {
    source:"simulator",
    kind:"turn.started",
    phase:"challenge",
    roleId:"challenger",
    seatId:"openai",
    message:"Challenger begins."
  },
  {
    source:"simulator",
    kind:"challenge.raised",
    phase:"challenge",
    roleId:"challenger",
    seatId:"openai",
    message:"Objection logged: decorative motion must never imply evidence or routing that did not occur."
  },
  {
    source:"simulator",
    kind:"turn.started",
    phase:"revision",
    roleId:"archivist",
    seatId:"kimi",
    message:"Archivist begins."
  },
  {
    source:"simulator",
    kind:"utterance.complete",
    phase:"revision",
    roleId:"archivist",
    seatId:"kimi",
    message:"Ledger sequence and visible state remain aligned; replay can reconstruct the room."
  },
  {
    source:"simulator",
    kind:"turn.started",
    phase:"synthesis",
    roleId:"vessie",
    seatId:"local",
    message:"Vessie Prime begins synthesis review."
  },
  {
    source:"simulator",
    kind:"utterance.complete",
    phase:"synthesis",
    roleId:"vessie",
    seatId:"local",
    message:"Council round complete. Evidence scoring now determines whether synthesis may proceed."
  },
  {
    source:"system",
    kind:"gate.scored",
    phase:"synthesis",
    gateScore:.63,
    message:"Evidence score below threshold."
  },
  {
    source:"system",
    kind:"synthesis.withheld",
    phase:"synthesis",
    message:"Synthesis withheld until threshold or operator override."
  }
];
