import {readFileSync,statSync} from "node:fs";

export const PHISERVE_DEFAULT_URL="http://127.0.0.1:11435";

export const selectLocalBackend=(value="ollama")=>{
  if(value!=="ollama"&&value!=="phiserve"){
    throw new Error("LOCAL_MODEL_BACKEND must be ollama or phiserve; no fallback.");
  }
  return value;
};

export const validatePhiServeBase=(value=PHISERVE_DEFAULT_URL)=>{
  let url;
  try{url=new URL(value);}
  catch{throw new Error("PhiServe requires an explicit local loopback URL.");}
  if(url.protocol!=="http:"||
     !["127.0.0.1","localhost","[::1]"].includes(url.hostname)||
     !url.port||url.username||url.password||url.pathname!=="/"||
     url.search||url.hash){
    throw new Error("PhiServe must be an HTTP loopback origin with a port, no path, credentials, query or fragment.");
  }
  return url.origin;
};

export const readPhiServeKeyFile=(file)=>{
  if(typeof file!=="string"||!file.trim()){
    throw new Error("PHISERVE_TOKEN_FILE must point to an existing private local bearer-token file.");
  }
  let token;
  try{
    const info=statSync(file);
    if(!info.isFile()||info.size<32||info.size>256)throw new Error("invalid");
    token=readFileSync(file,"utf8").trim();
  }catch{
    throw new Error("PhiServe token file is missing, unreadable, or invalid. It is never sent to the browser.");
  }
  if(token.length<32||token.length>255||/\s/.test(token)||token.includes("\0")){
    throw new Error("PhiServe token must be a strong single-line local bearer secret.");
  }
  return token;
};

export const phiServeHeaders=(file,json=false)=>({
  ...(json?{"content-type":"application/json"}:{}),
  authorization:"Bearer "+readPhiServeKeyFile(file)
});

export const phiServeChatPayload=({model,messages,maxOutputTokens=256})=>{
  if(typeof model!=="string"||!model.trim()||!Array.isArray(messages)||!messages.length){
    throw new Error("PhiServe requires a real model alias and nonempty messages.");
  }
  if(!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>4096){
    throw new Error("PhiServe output token cap must be 1 through 4096.");
  }
  if(!messages.every(m=>m&&["system","user","assistant"].includes(m.role)&&typeof m.content==="string")){
    throw new Error("PhiServe supports text-only system/user/assistant messages.");
  }
  return {
    model,
    stream:false,
    messages:messages.map(m=>({role:m.role,content:m.content})),
    options:{num_predict:maxOutputTokens}
  };
};

export const phiServeFinalText=(body)=>{
  if(!body||body.done!==true||body.error||
     !body.message||body.message.role!=="assistant"||
     typeof body.message.content!=="string"||!body.message.content.trim()){
    throw new Error("PhiServe did not return a completed final text answer. No reasoning or tool fields were promoted.");
  }
  return body.message.content.trim();
};
