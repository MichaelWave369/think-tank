import { useCallback,useEffect,useMemo,useReducer,useRef,useState } from "react";
import { roles,seats } from "../data/terminals";
import { planAssignments,routingEventInputs,scoreSeatForRole } from "../domain/craneFly";
import { evaluateClaimCoverage } from "../domain/claimCoverage";
import { argumentReviewBasisFingerprint,argumentReviewEligibility } from "../domain/argumentReview";
import { projectEvent,thinkTankReducer } from "../domain/reducer";
import { createInitialState } from "../domain/state";
import type {
  ArgumentReview,
  CollaborationMode,
  ClaimRelation,
  EvidenceExcerpt,
  EvidenceRef,
  ResearchCandidate,
  RoleId,
  SeatAvailability,
  SeatId,
  TerminalState,
  ThinkTankEvent,
  ThinkTankEventInput,
  ThinkTankState
} from "../domain/types";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "../kernel/eventKernel";
import { deriveMotionCue } from "../motion/motion";
import { useEventPlayback } from "../motion/useEventPlayback";
import { useMotionPolicy } from "../motion/useMotionPolicy";
import { fetchDossierSealStatus,fetchMachineEvidence,fetchProviderStatus,fetchResearchStatus,invokeProvider,pinMachineEvidenceExcerpt,projectMachineEvidence,sealDecisionDossier,searchResearch,verifyDecisionDossierSeal } from "../providers/client";
import { runLiveProviderSession } from "../providers/liveRunner";
import { buildArgumentReviewMessages,parseArgumentReviewResponse } from "../providers/argumentReview";
import type { DossierSealStatusResponse,EvidenceProjectionResponse,ProviderStatusResponse,ResearchBackendStatusResponse } from "../providers/types";
import { scenarioEventInputs,type DemoScenario } from "../sim/demo";
import { TerminalPanel } from "./TerminalPanel";
import { ArgumentReviewPanel } from "./ArgumentReviewPanel";
import { Commonline } from "./Commonline";
import { ClaimBoard } from "./ClaimBoard";
import { ClaimCoverageMatrix } from "./ClaimCoverageMatrix";
import { CraneFlyPanel } from "./CraneFlyPanel";
import { EvidencePanel } from "./EvidencePanel";
import { GovernancePanel } from "./GovernancePanel";
import { OperatorRail } from "./OperatorRail";
import { ModeBar } from "./ModeBar";
import { MotionLayer } from "./MotionLayer";
import { ProviderPanel } from "./ProviderPanel";
import { ResearchPanel } from "./ResearchPanel";
import { SourceExcerptPanel } from "./SourceExcerptPanel";
import { SystemStatus } from "./SystemStatus";
import { LedgerRoll } from "./LedgerRoll";
import { DecisionDossierPanel } from "./DecisionDossierPanel";

const seatStatePriority:TerminalState[]=["warning","speaking","thinking","selected","listening","idle","dimmed","offline"];

export function ThinkTankRoom(){
  const [state,dispatch]=useReducer(thinkTankReducer,createInitialState());
  const stateRef=useRef<ThinkTankState>(state);
  stateRef.current=state;

  const [prompt,setPrompt]=useState("");
  const [providerStatus,setProviderStatus]=useState<ProviderStatusResponse|null>(null);
  const [providerError,setProviderError]=useState("");
  const [localModel,setLocalModel]=useState("");
  const [liveRunning,setLiveRunning]=useState(false);
  const [evidenceFetching,setEvidenceFetching]=useState(false);
  const [evidenceToolError,setEvidenceToolError]=useState("");
  const [researchStatus,setResearchStatus]=useState<ResearchBackendStatusResponse|null>(null);
  const [researchSearching,setResearchSearching]=useState(false);
  const [researchError,setResearchError]=useState("");
  const [excerptBusy,setExcerptBusy]=useState(false);
  const [excerptError,setExcerptError]=useState("");
  const [argumentReviewBusy,setArgumentReviewBusy]=useState(false);
  const [argumentReviewError,setArgumentReviewError]=useState("");
  const [dossierSealStatus,setDossierSealStatus]=useState<DossierSealStatusResponse|null>(null);
  const [dossierSealBusy,setDossierSealBusy]=useState(false);
  const [dossierSealError,setDossierSealError]=useState("");
  const liveAbortRef=useRef<AbortController|null>(null);
  const evidenceAbortRef=useRef<AbortController|null>(null);
  const researchAbortRef=useRef<AbortController|null>(null);
  const excerptAbortRef=useRef<AbortController|null>(null);
  const argumentReviewAbortRef=useRef<AbortController|null>(null);
  const dossierSealAbortRef=useRef<AbortController|null>(null);
  const motionMode=useMotionPolicy();

  const applyEvent=useCallback((event:ThinkTankEvent)=>{
    stateRef.current=projectEvent(stateRef.current,event);
    dispatch({type:"APPLY_EVENT",event});
  },[]);

  const playback=useEventPlayback(applyEvent,motionMode);
  const busy=playback.playing||liveRunning||evidenceFetching||researchSearching||excerptBusy||argumentReviewBusy||dossierSealBusy;

  const refreshProviders=useCallback(async()=>{
    try{
      const next=await fetchProviderStatus();
      setProviderStatus(next);
      setProviderError("");
      const local=next.seats.find(seat=>seat.seatId==="local");
      setLocalModel(current=>
        current&&local?.models.includes(current)
          ?current
          :(local?.model||local?.models[0]||"")
      );
    }catch(error){
      setProviderStatus(null);
      setProviderError(error instanceof Error?error.message:String(error));
    }
  },[]);

  const refreshResearch=useCallback(async()=>{
    try{
      const next=await fetchResearchStatus();
      setResearchStatus(next);
      setResearchError("");
    }catch(error){
      setResearchStatus(null);
      setResearchError(error instanceof Error?error.message:String(error));
    }
  },[]);

  const refreshDossierSeal=useCallback(async()=>{
    try{
      const next=await fetchDossierSealStatus();
      setDossierSealStatus(next);
      setDossierSealError("");
    }catch(error){
      setDossierSealStatus(null);
      setDossierSealError(error instanceof Error?error.message:String(error));
    }
  },[]);

  useEffect(()=>{
    void refreshProviders();
    void refreshResearch();
    void refreshDossierSeal();
  },[refreshProviders,refreshResearch,refreshDossierSeal]);

  const latestEvent=state.events[state.events.length-1];
  const cue=useMemo(()=>deriveMotionCue(latestEvent,state),[latestEvent,state]);

  const routingPreview=useMemo(
    ()=>planAssignments(state,seats,state.mode),
    [state]
  );
  const routeReady=routingPreview.unresolved.length===0;

  const liveReady=useMemo(()=>{
    if(!providerStatus||!routeReady)return false;

    return routingPreview.decisions.every(decision=>{
      const provider=providerStatus.seats.find(item=>item.seatId===decision.seatId);
      if(!provider)return false;
      if(decision.seatId==="local"){
        return provider.state==="connected"&&Boolean(localModel);
      }
      return provider.state==="configured"||provider.state==="connected";
    });
  },[providerStatus,routeReady,routingPreview,localModel]);

  const challengerProvider=useMemo(()=>{
    const assignment=state.assignments.find(item=>item.roleId==="challenger");
    if(!assignment)return {ready:false,label:"UNASSIGNED",seatId:null as SeatId|null};

    const provider=providerStatus?.seats.find(item=>item.seatId===assignment.seatId);
    const ready=assignment.seatId==="local"
      ?provider?.state==="connected"&&Boolean(localModel)
      :provider?.state==="configured"||provider?.state==="connected";

    const model=assignment.seatId==="local"
      ?localModel
      :(provider?.model??"NO MODEL");

    return {
      ready:Boolean(ready),
      label:assignment.seatId.toUpperCase()+" · "+model,
      seatId:assignment.seatId
    };
  },[state.assignments,providerStatus,localModel]);

  const activeRole=useMemo(
    ()=>[...state.events].reverse().find(event=>event.roleId)?.roleId,
    [state.events]
  );

  const activeArgumentReviews=useMemo(
    ()=>state.argumentReviews.filter(review=>review.status!=="dismissed"),
    [state.argumentReviews]
  );
  const reviewLockedClaimIds=useMemo(
    ()=>[...new Set(activeArgumentReviews.map(review=>review.claimId))],
    [activeArgumentReviews]
  );
  const reviewLockedExcerptIds=useMemo(
    ()=>[...new Set(activeArgumentReviews.flatMap(review=>review.points.map(point=>point.excerptId)))],
    [activeArgumentReviews]
  );

  const replayReport=useMemo(
    ()=>verifyReplay(createInitialState(),state.events,state),
    [state]
  );

  const seatName=(roleId:string)=>{
    const assignment=state.assignments.find(item=>item.roleId===roleId);
    return seats.find(seat=>seat.id===assignment?.seatId)?.name??"UNASSIGNED";
  };

  const assignmentMeta=(roleId:RoleId)=>{
    const origin=state.assignmentOrigins[roleId]?.toUpperCase()??"UNROUTED";
    const score=state.assignmentScores[roleId];
    const pinned=state.pinnedAssignments[roleId]?"PIN · ":"";
    return pinned+origin+" · "+(score===undefined?"—":score.toFixed(3));
  };

  const phaseForRole=(roleId:RoleId)=>{
    return [...state.events].reverse().find(event=>event.roleId===roleId)?.phase;
  };

  const assignedRolesForSeat=(seatId:string)=>{
    return state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId.toUpperCase());
  };

  const stateForSeat=(seatId:SeatId):TerminalState=>{
    if(state.seatStatus[seatId]==="offline")return "offline";
    const roleIds=state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId);
    if(roleIds.length===0)return "idle";
    const states=roleIds.map(roleId=>state.terminalStates[roleId]);
    return seatStatePriority.find(candidate=>states.includes(candidate))??"idle";
  };

  const emitInput=(input:ThinkTankEventInput)=>{
    const base=stateRef.current;
    const event=buildEvent(base,input);
    applyEvent(event);
  };

  const playInputs=(inputs:ThinkTankEventInput[])=>{
    if(busy)return;
    const events=buildEventBatch(stateRef.current,inputs);
    playback.play(events);
  };

  const addEvidence=(label:string,uri:string,note:string)=>{
    if(busy)return;
    const evidenceRef:EvidenceRef={
      id:"EV-"+String(stateRef.current.seq+1).padStart(4,"0"),
      kind:"operator-reference",
      verification:"operator-attested",
      label,
      uri:uri||undefined,
      note:note||undefined,
      addedBy:"operator"
    };
    emitInput({
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef,
      message:"Operator attested evidence "+evidenceRef.id+": "+label+"."
    });
  };

  const verifyEvidence=async(label:string,uri:string,note:string,researchCandidateId?:string)=>{
    if(busy)return;

    const controller=new AbortController();
    evidenceAbortRef.current=controller;
    setEvidenceFetching(true);
    setEvidenceToolError("");

    emitInput({
      source:"operator",
      kind:"evidence.fetch.requested",
      phase:"intake",
      evidenceUri:uri,
      researchCandidateId,
      message:"Operator requested machine verification of "+uri+"."
    });

    try{
      const receipt=await fetchMachineEvidence(uri,controller.signal);
      const {ok:_,...retrieval}=receipt;
      const evidenceRef:EvidenceRef={
        id:"EV-"+String(stateRef.current.seq+1).padStart(4,"0"),
        kind:"external-source",
        verification:"machine-verified",
        label,
        uri:receipt.finalUri,
        note:note||undefined,
        retrieval,
        researchCandidateId,
        addedBy:"tool"
      };

      emitInput({
        source:"tool",
        kind:"evidence.added",
        phase:"intake",
        evidenceUri:uri,
        researchCandidateId,
        evidenceRef,
        message:
          "URL retrieval verified "+evidenceRef.id+
          " · SHA-256 "+receipt.sha256.slice(0,16)+"… · "+receipt.bytes+" bytes."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setEvidenceToolError(message);

      try{
        emitInput({
          source:"tool",
          kind:"evidence.fetch.failed",
          phase:"intake",
          evidenceUri:uri,
          message:"Evidence retrieval failed: "+message
        });
      }catch{}
    }finally{
      evidenceAbortRef.current=null;
      setEvidenceFetching(false);
    }
  };

  const previewEvidenceSource=async(evidenceId:string):Promise<EvidenceProjectionResponse>=>{
    if(busy)throw new Error("Room is busy.");
    const ref=stateRef.current.evidenceRefs.find(item=>item.id===evidenceId);
    if(!ref?.uri||!ref.retrieval||ref.verification!=="machine-verified"){
      throw new Error("Source projection requires machine-verified evidence.");
    }

    const controller=new AbortController();
    excerptAbortRef.current=controller;
    setExcerptBusy(true);
    setExcerptError("");

    try{
      return await projectMachineEvidence(ref.uri,ref.retrieval.sha256,controller.signal);
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setExcerptError(message);
      throw error;
    }finally{
      excerptAbortRef.current=null;
      setExcerptBusy(false);
    }
  };

  const pinEvidenceExcerpt=async(evidenceId:string,start:number,end:number)=>{
    if(busy)return;
    const ref=stateRef.current.evidenceRefs.find(item=>item.id===evidenceId);
    if(!ref?.uri||!ref.retrieval||ref.verification!=="machine-verified")return;

    const controller=new AbortController();
    excerptAbortRef.current=controller;
    setExcerptBusy(true);
    setExcerptError("");

    emitInput({
      source:"operator",
      kind:"evidence.excerpt.requested",
      phase:"intake",
      evidenceId,
      excerptStart:start,
      excerptEnd:end,
      message:"Operator requested exact excerpt "+start+"→"+end+" from "+evidenceId+"."
    });

    try{
      const receipt=await pinMachineEvidenceExcerpt(
        ref.uri,ref.retrieval.sha256,start,end,controller.signal
      );

      const evidenceExcerpt:EvidenceExcerpt={
        id:"EX-"+String(stateRef.current.seq+1).padStart(4,"0"),
        evidenceId,
        tool:"text-projector",
        extractor:"text-projection-v1",
        sourceUri:receipt.sourceUri,
        sourceSha256:receipt.sourceSha256,
        projectionSha256:receipt.projectionSha256,
        excerptSha256:receipt.excerptSha256,
        contentType:receipt.contentType,
        startChar:receipt.startChar,
        endChar:receipt.endChar,
        text:receipt.text,
        extractedAt:receipt.extractedAt,
        addedBy:"tool"
      };

      emitInput({
        source:"tool",
        kind:"evidence.excerpt.added",
        phase:"intake",
        evidenceId,
        evidenceExcerpt,
        excerptStart:start,
        excerptEnd:end,
        message:
          "Pinned exact excerpt "+evidenceExcerpt.id+" from "+evidenceId+
          " · SHA-256 "+evidenceExcerpt.excerptSha256.slice(0,16)+"…."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setExcerptError(message);
      try{
        emitInput({
          source:"tool",
          kind:"evidence.excerpt.failed",
          phase:"intake",
          evidenceId,
          excerptStart:start,
          excerptEnd:end,
          message:"Excerpt extraction failed: "+message
        });
      }catch{}
    }finally{
      excerptAbortRef.current=null;
      setExcerptBusy(false);
    }
  };

  const removeEvidenceExcerpt=(evidenceExcerptId:string)=>{
    if(busy||reviewLockedExcerptIds.includes(evidenceExcerptId))return;
    emitInput({
      source:"operator",
      kind:"evidence.excerpt.removed",
      phase:"intake",
      evidenceExcerptId,
      message:"Operator removed evidence excerpt "+evidenceExcerptId+"."
    });
  };

  const runArgumentReview=async(claimId:string)=>{
    if(busy)return;

    const eligibility=argumentReviewEligibility(stateRef.current,claimId);
    if(!eligibility.allowed){
      setArgumentReviewError(eligibility.reason);
      return;
    }

    const assignment=stateRef.current.assignments.find(item=>item.roleId==="challenger");
    if(!assignment||!challengerProvider.ready){
      setArgumentReviewError("Assigned Challenger provider is not ready.");
      return;
    }

    const controller=new AbortController();
    argumentReviewAbortRef.current=controller;
    setArgumentReviewBusy(true);
    setArgumentReviewError("");

    emitInput({
      source:"operator",
      kind:"argument.review.requested",
      phase:"intake",
      roleId:"challenger",
      seatId:assignment.seatId,
      claimId,
      message:"Operator requested excerpt-aware Challenger argument review for "+claimId+"."
    });

    try{
      const messages=buildArgumentReviewMessages(stateRef.current,claimId);
      const response=await invokeProvider({
        seatId:assignment.seatId,
        roleId:"challenger",
        model:assignment.seatId==="local"?localModel:undefined,
        messages
      },controller.signal);

      const parsed=parseArgumentReviewResponse(stateRef.current,claimId,response.text);
      const basisFingerprint=argumentReviewBasisFingerprint(stateRef.current,claimId);
      if(!basisFingerprint)throw new Error("Argument review basis is unavailable.");

      const argumentReview:ArgumentReview={
        id:"AR-"+String(stateRef.current.seq+1).padStart(4,"0"),
        claimId,
        roleId:"challenger",
        seatId:assignment.seatId,
        providerModel:response.model,
        providerRequestId:response.requestId,
        createdAt:new Date().toISOString(),
        basisFingerprint,
        points:parsed.points,
        unresolvedGaps:parsed.unresolvedGaps,
        summary:parsed.summary,
        status:"draft"
      };

      emitInput({
        source:"provider",
        kind:"argument.review.completed",
        phase:"intake",
        roleId:"challenger",
        seatId:assignment.seatId,
        claimId,
        argumentReview,
        providerModel:response.model,
        providerLatencyMs:response.latencyMs,
        providerRequestId:response.requestId,
        message:"Challenger drafted argument review "+argumentReview.id+" for "+claimId+"."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setArgumentReviewError(message);

      try{
        emitInput({
          source:"provider",
          kind:"argument.review.failed",
          phase:"intake",
          roleId:"challenger",
          seatId:assignment.seatId,
          claimId,
          message:"Challenger argument review failed: "+message
        });
      }catch{}
    }finally{
      argumentReviewAbortRef.current=null;
      setArgumentReviewBusy(false);
    }
  };

  const acceptArgumentReview=(argumentReviewId:string)=>{
    if(busy)return;
    emitInput({
      source:"operator",
      kind:"argument.review.accepted",
      phase:"intake",
      argumentReviewId,
      message:"Operator accepted analytical map "+argumentReviewId+"."
    });
  };

  const dismissArgumentReview=(argumentReviewId:string)=>{
    if(busy)return;
    emitInput({
      source:"operator",
      kind:"argument.review.dismissed",
      phase:"intake",
      argumentReviewId,
      message:"Operator dismissed analytical map "+argumentReviewId+"."
    });
  };

  const runResearch=async(claimId:string,query:string)=>{
    if(busy)return;
    const normalized=query.trim();
    if(!normalized)return;

    const controller=new AbortController();
    researchAbortRef.current=controller;
    setResearchSearching(true);
    setResearchError("");

    emitInput({
      source:"operator",
      kind:"research.search.requested",
      phase:"intake",
      claimId,
      researchQuery:normalized,
      message:"Operator requested governed research for "+claimId+": "+normalized
    });

    try{
      const response=await searchResearch(normalized,controller.signal);
      const receiptSeq=stateRef.current.seq+1;
      const receiptId="RS-"+String(receiptSeq).padStart(4,"0");
      const existingUris=new Set(
        stateRef.current.researchCandidates
          .filter(candidate=>candidate.claimId===claimId)
          .map(candidate=>candidate.uri)
      );
      const novelResults=response.results.filter(result=>!existingUris.has(result.uri));
      const researchReceipt={
        id:receiptId,
        tool:"searxng-search" as const,
        provider:"searxng" as const,
        claimId,
        query:response.query,
        searchedAt:response.searchedAt,
        resultDigest:response.resultDigest,
        candidates:novelResults.map((result,index)=>({
          id:"RC-"+String(receiptSeq).padStart(4,"0")+"-"+String(index+1).padStart(2,"0"),
          claimId,
          query:response.query,
          title:result.title,
          uri:result.uri,
          snippet:result.snippet,
          engine:result.engine,
          rank:index+1,
          discoveredAt:response.searchedAt
        }))
      };

      emitInput({
        source:"tool",
        kind:"research.search.completed",
        phase:"intake",
        claimId,
        researchQuery:response.query,
        researchReceipt,
        message:
          "Governed research "+receiptId+" returned "+
          researchReceipt.candidates.length+" quarantined candidate(s)."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setResearchError(message);
      try{
        emitInput({
          source:"tool",
          kind:"research.search.failed",
          phase:"intake",
          claimId,
          researchQuery:normalized,
          message:"Governed research failed: "+message
        });
      }catch{}
    }finally{
      researchAbortRef.current=null;
      setResearchSearching(false);
      void refreshResearch();
    }
  };

  const verifyResearchCandidate=(candidate:ResearchCandidate)=>{
    if(busy)return;
    const note=[
      "Discovered by "+candidate.engine+" for "+candidate.claimId+".",
      candidate.snippet
    ].filter(Boolean).join(" ");
    void verifyEvidence(candidate.title,candidate.uri,note,candidate.id);
  };

  const reviewClaimCoverage=(claimId:string)=>{
    if(busy)return;

    const request=buildEvent(stateRef.current,{
      source:"operator",
      kind:"claim.review.requested",
      phase:"intake",
      roleId:"challenger",
      claimId,
      message:"Operator requested Challenger structural audit for "+claimId+"."
    });
    applyEvent(request);

    const reviewedAt=new Date().toISOString();
    const review=evaluateClaimCoverage(
      stateRef.current,
      claimId,
      "CR-"+String(stateRef.current.seq+1).padStart(4,"0"),
      reviewedAt
    );

    const completed=buildEvent(stateRef.current,{
      source:"system",
      kind:"claim.review.completed",
      phase:"intake",
      roleId:"challenger",
      claimId,
      claimReview:review,
      message:
        "Challenger structural audit "+review.id+" · "+
        review.coverageState.toUpperCase()+" · "+
        review.boundEvidenceCount+" bound evidence."
    });
    applyEvent(completed);
  };

  const addClaim=(text:string)=>{
    if(busy)return;
    const claim={
      id:"CL-"+String(stateRef.current.seq+1).padStart(4,"0"),
      text,
      addedBy:"operator" as const
    };
    emitInput({
      source:"operator",
      kind:"claim.added",
      phase:"intake",
      claim,
      message:"Operator registered claim "+claim.id+": "+text
    });
  };

  const removeClaim=(claimId:string)=>{
    if(
      busy||
      stateRef.current.claimBindings.some(binding=>binding.claimId===claimId)||
      stateRef.current.argumentReviews.some(review=>review.claimId===claimId&&review.status!=="dismissed")
    )return;
    emitInput({
      source:"operator",
      kind:"claim.removed",
      phase:"intake",
      claimId,
      message:"Operator removed claim "+claimId+"."
    });
  };

  const bindEvidence=(claimId:string,evidenceId:string,relation:ClaimRelation,note:string)=>{
    if(busy)return;
    const claimBinding={
      id:"CB-"+String(stateRef.current.seq+1).padStart(4,"0"),
      claimId,
      evidenceId,
      relation,
      note:note||undefined,
      addedBy:"operator" as const
    };
    emitInput({
      source:"operator",
      kind:"evidence.bound",
      phase:"intake",
      claimBinding,
      message:
        "Operator bound "+evidenceId+" "+relation.toUpperCase()+" "+claimId+
        (note?" · "+note:"")+"."
    });
  };

  const unbindEvidence=(claimBindingId:string)=>{
    if(busy)return;
    emitInput({
      source:"operator",
      kind:"evidence.unbound",
      phase:"intake",
      claimBindingId,
      message:"Operator removed claim binding "+claimBindingId+"."
    });
  };

  const removeEvidence=(evidenceId:string)=>{
    if(busy||stateRef.current.claimBindings.some(binding=>binding.evidenceId===evidenceId)||stateRef.current.evidenceExcerpts.some(excerpt=>excerpt.evidenceId===evidenceId))return;
    emitInput({
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId,
      message:"Operator removed evidence "+evidenceId+"."
    });
  };

  const sealDossier=async(dossierId:string)=>{
    if(busy)return;
    const dossier=stateRef.current.decisionDossiers.find(item=>item.id===dossierId);
    if(!dossier)return;

    const controller=new AbortController();
    dossierSealAbortRef.current=controller;
    setDossierSealBusy(true);
    setDossierSealError("");

    emitInput({
      source:"operator",
      kind:"dossier.seal.requested",
      phase:stateRef.current.phase,
      decisionDossierId:dossierId,
      message:"Operator requested cryptographic seal for "+dossierId+"."
    });

    try{
      const response=await sealDecisionDossier(dossier,controller.signal);
      emitInput({
        source:"tool",
        kind:"dossier.seal.completed",
        phase:stateRef.current.phase,
        decisionDossierId:dossierId,
        dossierSeal:response.seal,
        message:
          "Ed25519 seal "+response.seal.id+" created for "+dossierId+
          " · key "+response.seal.publicKeyFingerprintSha256.slice(0,16)+"…."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setDossierSealError(message);
      try{
        emitInput({
          source:"tool",
          kind:"dossier.seal.failed",
          phase:stateRef.current.phase,
          decisionDossierId:dossierId,
          message:"Dossier sealing failed: "+message
        });
      }catch{}
    }finally{
      dossierSealAbortRef.current=null;
      setDossierSealBusy(false);
      void refreshDossierSeal();
    }
  };

  const verifyDossierSeal=async(dossierId:string,dossierSealId:string)=>{
    if(busy)return;
    const dossier=stateRef.current.decisionDossiers.find(item=>item.id===dossierId);
    const seal=stateRef.current.dossierSeals.find(item=>item.id===dossierSealId);
    if(!dossier||!seal)return;

    const controller=new AbortController();
    dossierSealAbortRef.current=controller;
    setDossierSealBusy(true);
    setDossierSealError("");

    emitInput({
      source:"operator",
      kind:"dossier.verify.requested",
      phase:stateRef.current.phase,
      decisionDossierId:dossierId,
      dossierSealId,
      message:"Operator requested cryptographic verification for "+dossierSealId+"."
    });

    try{
      const response=await verifyDecisionDossierSeal(dossier,seal,controller.signal);
      emitInput({
        source:"tool",
        kind:"dossier.verify.completed",
        phase:stateRef.current.phase,
        decisionDossierId:dossierId,
        dossierSealId,
        dossierVerification:{
          id:"VER-"+String(stateRef.current.seq+1).padStart(4,"0"),
          dossierId:response.dossierId,
          sealId:response.sealId,
          tool:"ed25519-dossier-verifier",
          algorithm:"Ed25519",
          digestSha256:response.digestSha256,
          publicKeyFingerprintSha256:response.publicKeyFingerprintSha256,
          verified:response.verified,
          verifiedAt:response.verifiedAt
        },
        message:
          "Dossier seal "+dossierSealId+" verification: "+
          (response.verified?"VALID":"INVALID")+" · "+response.reason
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setDossierSealError(message);
      try{
        emitInput({
          source:"tool",
          kind:"dossier.verify.failed",
          phase:stateRef.current.phase,
          decisionDossierId:dossierId,
          dossierSealId,
          message:"Dossier verification failed: "+message
        });
      }catch{}
    }finally{
      dossierSealAbortRef.current=null;
      setDossierSealBusy(false);
    }
  };

  const runAutoRoute=()=>playInputs(routingEventInputs(routingPreview));

  const pinRole=(roleId:RoleId,seatId:SeatId)=>{
    if(busy)return;
    const seat=seats.find(candidate=>candidate.id===seatId);
    if(!seat||state.seatStatus[seatId]==="offline")return;

    const score=scoreSeatForRole(roleId,seat,state,0);
    playInputs([
      {
        source:"operator",kind:"role.pinned",phase:"routing",roleId,seatId,
        message:"Operator pinned "+roleId.toUpperCase()+" to "+seatId.toUpperCase()+"."
      },
      {
        source:"system",kind:"role.assigned",phase:"routing",roleId,seatId,
        assignmentScore:score,assignmentOrigin:"operator-pin",
        assignmentReason:"Operator pin is authoritative; Crane Fly recorded the forced staffing assignment.",
        message:"Pinned staffing applied: "+roleId.toUpperCase()+" → "+seatId.toUpperCase()+"."
      }
    ]);
  };

  const unpinRole=(roleId:RoleId)=>{
    if(busy||!state.pinnedAssignments[roleId])return;
    emitInput({
      source:"operator",kind:"role.unpinned",phase:"routing",roleId,
      message:"Operator removed pin from "+roleId.toUpperCase()+"."
    });
  };

  const setSeatStatus=(seatId:SeatId,seatStatus:SeatAvailability)=>{
    if(busy||state.seatStatus[seatId]===seatStatus)return;
    emitInput({
      source:"operator",kind:"seat.status",phase:"routing",seatId,seatStatus,
      message:"Operator set "+seatId.toUpperCase()+" seat to "+seatStatus.toUpperCase()+"."
    });
  };

  const syncProviderHealth=()=>{
    if(busy||!providerStatus)return;
    const inputs:ThinkTankEventInput[]=providerStatus.seats
      .map(provider=>{
        const seatStatus:SeatAvailability=
          provider.state==="connected"||provider.state==="configured"?"online":"offline";
        return {provider,seatStatus};
      })
      .filter(({provider,seatStatus})=>state.seatStatus[provider.seatId]!==seatStatus)
      .map(({provider,seatStatus})=>({
        source:"operator" as const,
        kind:"seat.status" as const,
        phase:"routing" as const,
        seatId:provider.seatId,
        seatStatus,
        message:"Operator synced "+provider.seatId.toUpperCase()+" to "+seatStatus.toUpperCase()+" from provider bridge health."
      }));

    if(inputs.length)playInputs(inputs);
  };

  const runScenario=(scenario:DemoScenario)=>{
    if(busy)return;

    const targetMode:CollaborationMode=scenario==="council-gate-block"?"council":state.mode;
    const routePlan=planAssignments(state,seats,targetMode);
    if(routePlan.unresolved.length)return;

    const scenarioInputs=scenarioEventInputs(prompt,state.mode,scenario,stateRef.current);
    const routeInputs=routingEventInputs(routePlan);
    const hasModePrefix=scenarioInputs[0]?.kind==="mode.selected";

    const inputs=hasModePrefix
      ?[scenarioInputs[0],scenarioInputs[1],...routeInputs,...scenarioInputs.slice(2)]
      :[scenarioInputs[0],...routeInputs,...scenarioInputs.slice(1)];

    playInputs(inputs);
    setPrompt("");
  };

  const runLive=async()=>{
    if(busy||!liveReady)return;

    const controller=new AbortController();
    liveAbortRef.current=controller;
    setLiveRunning(true);
    setProviderError("");
    const livePrompt=prompt;
    setPrompt("");

    try{
      const result=await runLiveProviderSession({
        initialState:stateRef.current,
        seats,
        prompt:livePrompt,
        localModel,
        signal:controller.signal,
        invoke:invokeProvider,
        apply:applyEvent
      });

      if(result.error&&!result.aborted)setProviderError(result.error);
    }finally{
      liveAbortRef.current=null;
      setLiveRunning(false);
      void refreshProviders();
    }
  };

  const selectMode=(mode:CollaborationMode)=>{
    if(busy)return;
    emitInput({
      source:"operator",kind:"mode.selected",mode,phase:"intake",
      message:"Operator selected "+mode.toUpperCase()+" mode."
    });
  };

  const abort=()=>{
    const sessionActive=liveRunning||playback.playing;
    evidenceAbortRef.current?.abort();
    researchAbortRef.current?.abort();
    excerptAbortRef.current?.abort();
    argumentReviewAbortRef.current?.abort();
    dossierSealAbortRef.current?.abort();
    liveAbortRef.current?.abort();
    playback.cancel();
    setLiveRunning(false);

    if(sessionActive){
      emitInput({
        source:"operator",kind:"session.aborted",phase:"aborted",
        message:"Operator abort. Session halted."
      });
    }
  };

  const canForce=state.synthesisWithheld||Boolean(state.faultCode);

  const force=()=>{
    if(busy||!canForce)return;
    emitInput({
      source:"operator",kind:"operator.override",phase:"synthesis",override:true,
      outputLabel:state.mode==="audit"?"AUDIT":"STANDARD",actionAllowed:true,
      governanceReason:"Human operator explicitly overrode the withheld/faulted synthesis state.",
      message:"Operator override recorded: FORCE SYNTHESIS."
    });
  };

  const replayExact=()=>{
    if(busy)return;
    const restored=replayEvents(createInitialState(),state.events);
    stateRef.current=restored;
    dispatch({type:"RESET",state:restored});
  };

  const focusRouter=()=>{
    document.getElementById("crane-fly-panel")?.scrollIntoView({
      behavior:motionMode==="full"?"smooth":"auto",block:"center"
    });
  };

  return <main className="room-shell" data-motion={motionMode} data-cue={cue.kind} data-seq={cue.seq}>
    <div className="scanlines" aria-hidden="true"/>
    <MotionLayer cue={cue} mode={motionMode}/>

    <header className="room-header">
      <div><small>SUPER Φ.VESSEL</small><strong>Φ THINK TANK</strong><span>Multi-Mind Terminal for Super Φ.Vessel</span></div>
      <p>MULTI-MIND COLLABORATION<br/>A BRIGHTER REALITY TOGETHER.</p>
    </header>

    <button className="room-map-chip" aria-label="Room map">ROOM MAP · ROLES / COMMONLINE / OPERATOR / LEDGER</button>

    <section className="role-wall" aria-label="Cognitive role terminals">
      {roles.map(role=><TerminalPanel
        key={role.id}
        kind="role"
        terminal={role}
        state={state.terminalStates[role.id]}
        utterance={state.lastUtterance[role.id]}
        staffedBy={seatName(role.id)}
        assignmentMeta={assignmentMeta(role.id)}
        phase={phaseForRole(role.id)}
        motionActive={cue.roleId===role.id}
        motionKind={cue.kind}
      />)}
    </section>

    <section className="operations-grid">
      <aside className="seat-stack" aria-label="Provider and model seats">
        {seats.map(seat=><TerminalPanel
          key={seat.id}
          kind="seat"
          terminal={seat}
          assignedRoles={assignedRolesForSeat(seat.id)}
          state={stateForSeat(seat.id)}
          availability={state.seatStatus[seat.id]}
          motionActive={cue.seatId===seat.id}
          motionKind={cue.kind}
        />)}
      </aside>

      <div className="center-stack">
        <Commonline assignments={state.assignments} activeRole={activeRole} seats={seats} cue={cue} motionMode={motionMode}/>

        <CraneFlyPanel
          state={state}
          seats={seats}
          preview={routingPreview}
          busy={busy}
          onAutoRoute={runAutoRoute}
          onPin={pinRole}
          onUnpin={unpinRole}
          onSeatStatus={setSeatStatus}
        />

        <ProviderPanel
          status={providerStatus}
          error={providerError}
          localModel={localModel}
          liveBusy={liveRunning}
          liveReady={liveReady}
          onLocalModel={setLocalModel}
          onRefresh={()=>void refreshProviders()}
          onSync={syncProviderHealth}
          onRunLive={()=>void runLive()}
        />

        <EvidencePanel
          refs={state.evidenceRefs}
          breakdown={state.gateBreakdown}
          threshold={state.gateThreshold}
          busy={busy}
          verifyBusy={evidenceFetching}
          verifyError={evidenceToolError}
          boundEvidenceIds={state.claimBindings.map(binding=>binding.evidenceId)}
          excerptEvidenceIds={state.evidenceExcerpts.map(excerpt=>excerpt.evidenceId)}
          onAdd={addEvidence}
          onVerify={(label,uri,note)=>void verifyEvidence(label,uri,note)}
          onRemove={removeEvidence}
        />

        <SourceExcerptPanel
          evidence={state.evidenceRefs}
          excerpts={state.evidenceExcerpts}
          busy={busy}
          toolError={excerptError}
          lockedExcerptIds={reviewLockedExcerptIds}
          onPreview={previewEvidenceSource}
          onPin={pinEvidenceExcerpt}
          onRemove={removeEvidenceExcerpt}
        />

        <ClaimBoard
          claims={state.claims}
          bindings={state.claimBindings}
          evidence={state.evidenceRefs}
          busy={busy}
          reviewLockedClaimIds={reviewLockedClaimIds}
          onAdd={addClaim}
          onRemove={removeClaim}
          onBind={bindEvidence}
          onUnbind={unbindEvidence}
        />

        <ArgumentReviewPanel
          state={state}
          busy={busy}
          running={argumentReviewBusy}
          providerReady={challengerProvider.ready}
          providerLabel={challengerProvider.label}
          error={argumentReviewError}
          onRun={claimId=>void runArgumentReview(claimId)}
          onAccept={acceptArgumentReview}
          onDismiss={dismissArgumentReview}
        />

        <ClaimCoverageMatrix
          state={state}
          busy={busy}
          onReview={reviewClaimCoverage}
        />

        <ResearchPanel
          claims={state.claims}
          candidates={state.researchCandidates}
          searches={state.researchSearches}
          status={researchStatus}
          error={researchError}
          busy={busy}
          searchBusy={researchSearching}
          promotedCandidateIds={state.evidenceRefs.map(ref=>ref.researchCandidateId).filter((id):id is string=>Boolean(id))}
          existingEvidenceUris={state.evidenceRefs.map(ref=>ref.uri).filter((uri):uri is string=>Boolean(uri))}
          onSearch={(claimId,query)=>void runResearch(claimId,query)}
          onVerify={verifyResearchCandidate}
        />

        <GovernancePanel
          state={state}
          busy={busy}
          onGateBlock={()=>runScenario("council-gate-block")}
          onTimeout={()=>runScenario("timeout")}
        />

        <DecisionDossierPanel
          state={state}
          sealStatus={dossierSealStatus}
          busy={busy}
          sealBusy={dossierSealBusy}
          error={dossierSealError}
          onSeal={dossierId=>void sealDossier(dossierId)}
          onVerify={(dossierId,sealId)=>void verifyDossierSeal(dossierId,sealId)}
        />

        {state.synthesisWithheld&&<div className="gate-block">
          <strong>SYNTHESIS WITHHELD</strong>
          <span>{state.governanceReason||"The active mode law did not authorize synthesis."}</span>
        </div>}

        <OperatorRail
          sessionId={state.sessionId}
          seed={state.seed}
          prompt={prompt}
          canForce={canForce}
          canRun={routeReady}
          busy={busy}
          onPrompt={setPrompt}
          onSend={()=>runScenario("happy")}
          onAbort={abort}
          onRouter={focusRouter}
          onForce={force}
        />

        <ModeBar mode={state.mode} disabled={busy} onChange={selectMode}/>
      </div>

      <SystemStatus
        state={state}
        replayReport={replayReport}
        motionMode={motionMode}
        playing={busy}
        routeReady={routeReady}
        unresolvedCount={routingPreview.unresolved.length}
      />
    </section>

    <LedgerRoll events={state.events} replayReport={replayReport} busy={busy} onReplay={replayExact}/>
  </main>;
}
