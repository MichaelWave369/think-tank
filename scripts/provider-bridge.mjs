import http from "node:http";
import https from "node:https";
import {createHash} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {pathToFileURL} from "node:url";

try{process.loadEnvFile(".env");}catch{}

const HOST=process.env.THINK_TANK_BRIDGE_HOST||"127.0.0.1";
const PORT=Number(process.env.THINK_TANK_BRIDGE_PORT||3691);
const OLLAMA_BASE_URL=(process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434").replace(/\/$/,"");
const KIMI_BASE_URL=(process.env.KIMI_BASE_URL||"https://api.moonshot.ai/v1").replace(/\/$/,"");
const MAX_BODY_BYTES=512_000;
const MAX_OUTPUT_TOKENS=Math.max(64,Number(process.env.PROVIDER_MAX_OUTPUT_TOKENS||1200));
const EVIDENCE_MAX_BYTES=Math.max(1024,Number(process.env.EVIDENCE_MAX_BYTES||2_000_000));
const EVIDENCE_MAX_REDIRECTS=Math.max(0,Math.min(5,Number(process.env.EVIDENCE_MAX_REDIRECTS||3)));

const explicitOrigins=(process.env.THINK_TANK_ORIGIN||"")
  .split(",").map(value=>value.trim()).filter(Boolean);

const isAllowedOrigin=(origin)=>{
  if(!origin)return true;
  if(explicitOrigins.includes(origin))return true;
  try{
    const url=new URL(origin);
    return (url.hostname==="localhost"||url.hostname==="127.0.0.1")&&(url.protocol==="http:"||url.protocol==="https:");
  }catch{
    return false;
  }
};

const corsHeaders=(origin)=>({
  "access-control-allow-origin":origin&&isAllowedOrigin(origin)?origin:"null",
  "access-control-allow-methods":"GET,POST,OPTIONS",
  "access-control-allow-headers":"content-type",
  "cache-control":"no-store",
  "content-type":"application/json; charset=utf-8",
  "vary":"origin"
});

const send=(res,status,body,origin)=>{
  res.writeHead(status,corsHeaders(origin));
  res.end(JSON.stringify(body));
};

const readJson=(req)=>new Promise((resolve,reject)=>{
  let size=0;
  let data="";
  req.setEncoding("utf8");
  req.on("data",chunk=>{
    size+=Buffer.byteLength(chunk);
    if(size>MAX_BODY_BYTES){
      reject(new Error("Request body exceeds provider bridge limit."));
      req.destroy();
      return;
    }
    data+=chunk;
  });
  req.on("end",()=>{
    try{resolve(data?JSON.parse(data):{});}
    catch{reject(new Error("Invalid JSON request body."));}
  });
  req.on("error",reject);
});

export const isBlockedIpv4=(address)=>{
  const parts=address.split(".").map(Number);
  if(parts.length!==4||parts.some(value=>!Number.isInteger(value)||value<0||value>255))return true;
  const [a,b]=parts;
  return (
    a===0||
    a===10||
    a===127||
    (a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||
    (a===172&&b>=16&&b<=31)||
    (a===192&&b===168)||
    (a===198&&(b===18||b===19))||
    a>=224
  );
};

export const isBlockedIpv6=(address)=>{
  const value=address.toLowerCase();
  if(value==="::"||value==="::1")return true;
  if(value.startsWith("fe8")||value.startsWith("fe9")||value.startsWith("fea")||value.startsWith("feb"))return true;
  if(value.startsWith("fc")||value.startsWith("fd")||value.startsWith("ff"))return true;
  if(value.startsWith("::ffff:")){
    const mapped=value.slice(7);
    return isIP(mapped)===4?isBlockedIpv4(mapped):true;
  }
  return false;
};

export const assertPublicHttpUrl=async(raw)=>{
  let url;
  try{url=new URL(raw);}catch{throw new Error("Evidence URI must be a valid absolute URL.");}
  if(url.protocol!=="https:"&&url.protocol!=="http:")throw new Error("Evidence URI must use http or https.");
  if(url.username||url.password)throw new Error("Evidence URI must not contain credentials.");
  if(url.protocol==="http:"&&url.port&&url.port!=="80")throw new Error("HTTP evidence URI may only use port 80.");
  if(url.protocol==="https:"&&url.port&&url.port!=="443")throw new Error("HTTPS evidence URI may only use port 443.");

  const rawHost=url.hostname.startsWith("[")&&url.hostname.endsWith("]")
    ?url.hostname.slice(1,-1)
    :url.hostname;
  const direct=isIP(rawHost);
  const addresses=direct
    ?[{address:rawHost,family:direct}]
    :await lookup(rawHost,{all:true,verbatim:true});

  if(!addresses.length)throw new Error("Evidence host did not resolve.");

  for(const entry of addresses){
    const blocked=entry.family===4?isBlockedIpv4(entry.address):isBlockedIpv6(entry.address);
    if(blocked)throw new Error("Evidence host resolves to a private, local, multicast, or reserved address.");
  }

  return {url,address:addresses[0].address,family:addresses[0].family};
};

const allowedEvidenceType=(contentType)=>{
  const type=(contentType||"").split(";")[0].trim().toLowerCase();
  return (
    type.startsWith("text/")||
    type==="application/json"||
    type==="application/xml"||
    type==="application/xhtml+xml"||
    type==="application/pdf"
  );
};

const requestPinned=({url,address,family},maxBytes)=>new Promise((resolve,reject)=>{
  const transport=url.protocol==="https:"?https:http;
  let settled=false;

  const finishError=(error)=>{
    if(settled)return;
    settled=true;
    reject(error);
  };

  const request=transport.request(url,{
    method:"GET",
    headers:{
      "accept":"text/html,text/plain,application/json,application/xml,application/pdf;q=0.8,*/*;q=0.2",
      "user-agent":"PhiThinkTank-EvidenceVerifier/0.2"
    },
    timeout:20_000,
    servername:url.hostname,
    lookup:(_hostname,_options,callback)=>callback(null,address,family)
  },response=>{
    const chunks=[];
    let total=0;

    response.on("data",chunk=>{
      total+=chunk.length;
      if(total>maxBytes){
        response.destroy(new Error("Evidence response exceeds the configured byte limit."));
        return;
      }
      chunks.push(chunk);
    });

    response.on("end",()=>{
      if(settled)return;
      settled=true;
      resolve({
        status:response.statusCode||0,
        headers:response.headers,
        body:Buffer.concat(chunks,total)
      });
    });

    response.on("error",finishError);
  });

  request.on("timeout",()=>request.destroy(new Error("Evidence retrieval timed out.")));
  request.on("error",finishError);
  request.end();
});

const fetchEvidenceReceipt=async(requestedUri)=>{
  let target=await assertPublicHttpUrl(requestedUri);
  let redirects=0;

  while(true){
    const response=await requestPinned(target,EVIDENCE_MAX_BYTES);
    const status=response.status;

    if([301,302,303,307,308].includes(status)){
      if(redirects>=EVIDENCE_MAX_REDIRECTS)throw new Error("Evidence redirect limit exceeded.");
      const location=Array.isArray(response.headers.location)
        ?response.headers.location[0]
        :response.headers.location;
      if(!location)throw new Error("Evidence redirect did not include a Location header.");
      target=await assertPublicHttpUrl(new URL(location,target.url).toString());
      redirects+=1;
      continue;
    }

    if(status<200||status>=300)throw new Error("Evidence fetch returned HTTP "+status+".");

    const contentType=String(response.headers["content-type"]||"application/octet-stream");
    if(!allowedEvidenceType(contentType)){
      throw new Error("Evidence content type is not allowed: "+contentType+".");
    }

    const sha256=createHash("sha256").update(response.body).digest("hex");

    return {
      ok:true,
      tool:"url-fetch",
      requestedUri,
      finalUri:target.url.toString(),
      httpStatus:status,
      contentType,
      bytes:response.body.length,
      sha256,
      redirects,
      retrievedAt:new Date().toISOString()
    };
  }
};

const ollamaStatus=async()=>{
  try{
    const {body}=await fetchJson(OLLAMA_BASE_URL+"/api/tags",{},3500);
    const models=Array.isArray(body.models)
      ?body.models.map(item=>item?.name||item?.model).filter(Boolean)
      :[];
    const preferred=process.env.OLLAMA_MODEL||models[0]||null;
    return {
      seatId:"local",
      provider:"Ollama",
      state:"connected",
      model:preferred,
      models,
      detail:models.length?models.length+" local model(s) discovered.":"Ollama reachable; no local models discovered."
    };
  }catch(error){
    return {
      seatId:"local",
      provider:"Ollama",
      state:"disconnected",
      model:null,
      models:[],
      detail:"Ollama unavailable at "+OLLAMA_BASE_URL+": "+error.message
    };
  }
};

const remoteStatus=(seatId,provider,key,model)=>({
  seatId,
  provider,
  state:key&&model?"configured":"disconnected",
  model:model||null,
  models:model?[model]:[],
  detail:key&&model
    ?"Server-side credentials and model are configured; no billable probe was sent."
    :"Set both the API key and model environment variables in the local bridge."
});

const statusPayload=async()=>({
  ok:true,
  bridgeVersion:"0.2.0",
  seats:[
    await ollamaStatus(),
    remoteStatus("openai","OpenAI",process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL),
    remoteStatus("kimi","Kimi",process.env.KIMI_API_KEY,process.env.KIMI_MODEL)
  ]
});

const extractOpenAIText=(body)=>{
  if(typeof body.output_text==="string"&&body.output_text.trim())return body.output_text.trim();
  const chunks=[];
  for(const item of body.output||[]){
    for(const content of item?.content||[]){
      if(typeof content?.text==="string")chunks.push(content.text);
      else if(typeof content?.output_text==="string")chunks.push(content.output_text);
    }
  }
  return chunks.join("\n").trim();
};

const invokeOllama=async(request)=>{
  const status=await ollamaStatus();
  if(status.state!=="connected")throw new Error(status.detail);
  const model=request.model||process.env.OLLAMA_MODEL||status.model;
  if(!model)throw new Error("No Ollama model is available.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    OLLAMA_BASE_URL+"/api/chat",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({model,messages:request.messages,stream:false,options:{num_predict:MAX_OUTPUT_TOKENS}})
    },
    180_000
  );

  const text=body?.message?.content;
  if(typeof text!=="string"||!text.trim())throw new Error("Ollama returned no assistant text.");

  return {
    ok:true,seatId:"local",provider:"Ollama",model,
    text:text.trim(),latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||undefined
  };
};

const invokeOpenAI=async(request)=>{
  const key=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_MODEL;
  if(!key||!model)throw new Error("OpenAI bridge is not configured. Set OPENAI_API_KEY and OPENAI_MODEL.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    "https://api.openai.com/v1/responses",
    {
      method:"POST",
      headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
      body:JSON.stringify({model,input:request.messages,store:false,max_output_tokens:MAX_OUTPUT_TOKENS})
    },
    180_000
  );
  const text=extractOpenAIText(body);
  if(!text)throw new Error("OpenAI returned no response text.");

  return {
    ok:true,seatId:"openai",provider:"OpenAI",model,
    text,latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||body?.id||undefined
  };
};

const invokeKimi=async(request)=>{
  const key=process.env.KIMI_API_KEY;
  const model=process.env.KIMI_MODEL;
  if(!key||!model)throw new Error("Kimi bridge is not configured. Set KIMI_API_KEY and KIMI_MODEL.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    KIMI_BASE_URL+"/chat/completions",
    {
      method:"POST",
      headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
      body:JSON.stringify({model,messages:request.messages,stream:false,max_tokens:MAX_OUTPUT_TOKENS})
    },
    180_000
  );

  const text=body?.choices?.[0]?.message?.content;
  if(typeof text!=="string"||!text.trim())throw new Error("Kimi returned no assistant text.");

  return {
    ok:true,seatId:"kimi",provider:"Kimi",model,
    text:text.trim(),latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||body?.id||undefined
  };
};

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(!isAllowedOrigin(origin)){
    send(res,403,{ok:false,error:{code:"ORIGIN_DENIED",message:"Origin is not allowed by the local provider bridge."}},origin);
    return;
  }

  if(req.method==="OPTIONS"){
    res.writeHead(204,corsHeaders(origin));
    res.end();
    return;
  }

  try{
    if(req.method==="GET"&&req.url==="/health"){
      send(res,200,{ok:true,service:"phi-think-tank-provider-bridge",version:"0.2.0"},origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/providers/status"){
      send(res,200,await statusPayload(),origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/evidence/fetch"){
      const raw=await readJson(req);
      if(typeof raw.uri!=="string"||!raw.uri.trim())throw new Error("Evidence fetch requires a URI.");
      const receipt=await fetchEvidenceReceipt(raw.uri.trim());
      send(res,200,receipt,origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/providers/invoke"){
      const raw=await readJson(req);
      if(!["local","openai","kimi"].includes(raw.seatId))throw new Error("Unknown provider seat.");
      if(!["dreamer","builder","challenger","archivist","vessie"].includes(raw.roleId))throw new Error("Unknown cognitive role.");

      const request={
        seatId:raw.seatId,
        roleId:raw.roleId,
        model:typeof raw.model==="string"?raw.model:undefined,
        messages:normalizeMessages(raw.messages)
      };

      const result=request.seatId==="local"
        ?await invokeOllama(request)
        :request.seatId==="openai"
          ?await invokeOpenAI(request)
          :await invokeKimi(request);

      send(res,200,result,origin);
      return;
    }

    send(res,404,{ok:false,error:{code:"NOT_FOUND",message:"Provider bridge route not found."}},origin);
  }catch(error){
    const status=Number(error.status)||500;
    send(res,status>=400&&status<600?status:500,{
      ok:false,
      error:{
        code:status===401?"AUTH_FAILED":status===429?"RATE_LIMITED":"PROVIDER_ERROR",
        message:error instanceof Error?error.message:String(error)
      }
    },origin);
  }
});

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  server.listen(PORT,HOST,()=>{
    console.log("Φ Think Tank provider bridge listening on http://"+HOST+":"+PORT);
    console.log("Secrets remain server-side in this local process.");
  });
}
