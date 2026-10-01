import http from "node:http";

const HOST=process.env.THINK_TANK_BRIDGE_HOST||"127.0.0.1";
const PORT=Number(process.env.THINK_TANK_BRIDGE_PORT||3691);
const OLLAMA_BASE_URL=(process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434").replace(/\/$/,"");
const KIMI_BASE_URL=(process.env.KIMI_BASE_URL||"https://api.moonshot.ai/v1").replace(/\/$/,"");
const MAX_BODY_BYTES=512_000;

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

const normalizeMessages=(messages)=>{
  if(!Array.isArray(messages)||messages.length===0)throw new Error("messages must be a non-empty array.");
  return messages.map((message,index)=>{
    const role=message?.role;
    const content=message?.content;
    if(!["system","user","assistant"].includes(role))throw new Error("Invalid message role at index "+index+".");
    if(typeof content!=="string"||!content.trim())throw new Error("Invalid message content at index "+index+".");
    if(content.length>120_000)throw new Error("Message content exceeds provider bridge limit.");
    return {role,content};
  });
};

const fetchJson=async(url,init,timeoutMs)=>{
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(timeoutMs)});
  const text=await response.text();
  let body={};
  try{body=text?JSON.parse(text):{};}catch{body={raw:text};}
  if(!response.ok){
    const message=body?.error?.message||body?.message||body?.raw||("HTTP "+response.status);
    const error=new Error(String(message));
    error.status=response.status;
    throw error;
  }
  return {body,response};
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
  bridgeVersion:"0.1.0",
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
      body:JSON.stringify({model,messages:request.messages,stream:false})
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
      body:JSON.stringify({model,input:request.messages,store:false})
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
      body:JSON.stringify({model,messages:request.messages,stream:false})
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
      send(res,200,{ok:true,service:"phi-think-tank-provider-bridge",version:"0.1.0"},origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/providers/status"){
      send(res,200,await statusPayload(),origin);
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

server.listen(PORT,HOST,()=>{
  console.log("Φ Think Tank provider bridge listening on http://"+HOST+":"+PORT);
  console.log("Secrets remain server-side in this local process.");
});
