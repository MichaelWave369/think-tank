import type { ThinkTankState } from "./types";
export const createInitialState=():ThinkTankState=>({
 sessionId:"PHI-0001",seed:"369042",mode:"council",routerPolicy:"council-broadcast",phase:"intake",seq:0,
 gateThreshold:.75,gateScore:null,synthesisWithheld:false,
 assignments:[{roleId:"vessie",seatId:"local"},{roleId:"dreamer",seatId:"kimi"},{roleId:"builder",seatId:"local"},{roleId:"challenger",seatId:"openai"},{roleId:"archivist",seatId:"kimi"}],
 terminalStates:{vessie:"idle",dreamer:"idle",builder:"idle",challenger:"idle",archivist:"idle"},
 lastUtterance:{},events:[]
});
