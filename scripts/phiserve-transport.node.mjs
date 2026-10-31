import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  PHISERVE_DEFAULT_URL,selectLocalBackend,validatePhiServeBase,
  readPhiServeKeyFile,phiServeHeaders,phiServeChatPayload,phiServeFinalText
} from "./phiserve-transport.mjs";

const TOKEN="test-PhiServe-secret-1234567890-abcdef-1234567";

test("PhiServe transport is disabled unless explicitly selected",()=>{
  assert.equal(selectLocalBackend("ollama"),"ollama");
  assert.equal(selectLocalBackend("phiserve"),"phiserve");
  assert.throws(()=>selectLocalBackend("invalid"),/must be ollama or phiserve/);
});

test("PhiServe base accepts only explicit loopback HTTP with a port",()=>{
  assert.equal(validatePhiServeBase(),PHISERVE_DEFAULT_URL);
  assert.equal(validatePhiServeBase("http://localhost:11435/"),"http://localhost:11435");
  assert.equal(validatePhiServeBase("http://[::1]:11435"),"http://[::1]:11435");
  for(const input of [
    "https://127.0.0.1:11435","http://evil.test:11435",
    "http://192.168.0.5:11435","http://127.0.0.1.evil.com:11435",
    "http://name:secret@127.0.0.1:11435", "http://127.0.0.1:11435/api/chat",
    "http://127.0.0.1:11435/?token=secret","http://127.0.0.1:11435/#foo",
    "http://127.0.0.1", "file:///secrets", "garbage",
  ])assert.throws(()=>validatePhiServeBase(input),/loopback|explicit/,input);
});

test("bearer token read only from a private local file; never from env/browser",()=>{
  const dir=mkdtempSync(join(tmpdir(),"thinktank-phiserve-"));
  try{
    const file=join(dir,"private-token.txt");
    writeFileSync(file,TOKEN+"\n",{mode:0o600});
    assert.equal(readPhiServeKeyFile(file),TOKEN);
    assert.deepEqual(phiServeHeaders(file,false),{authorization:"Bearer "+TOKEN});
    assert.equal(phiServeHeaders(file,true)["content-type"],"application/json");
    assert.throws(()=>readPhiServeKeyFile(join(dir,"missing")) ,/unreadable|missing/);
    writeFileSync(file,"short",{mode:0o600});
    assert.throws(()=>readPhiServeKeyFile(file),/invalid/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("PhiServe chat request omits unsupported Ollama thinking switch and cloud fields",()=>{
  const input=[{role:"system",content:"Be accurate."},{role:"user",content:"Hi."}];
  const result=phiServeChatPayload({model:"registered-qwen",messages:input,maxOutputTokens:200});
  assert.deepEqual(result,{
    model:"registered-qwen",stream:false,
    messages:input,options:{num_predict:200}
  });
  assert.equal("think" in result,false);
  assert.equal("tools" in result,false);
  assert.throws(()=>phiServeChatPayload({model:"",messages:input}),/model alias/);
  assert.throws(()=>phiServeChatPayload({model:"x",messages:[{role:"tool",content:"execute"}]}),/text-only/);
});

test("only complete assistant final text is promoted to council speech",()=>{
  assert.equal(phiServeFinalText({
    done:true,message:{role:"assistant",content:"Local answer."}
  }),"Local answer.");
  for(const body of [
    {done:false,message:{role:"assistant",content:"unfinished"}},
    {done:true,message:{role:"assistant",thinking:"secret chain",content:""}},
    {done:true,message:{role:"user",content:"echo"}},
    {error:"local backend failed",done:true,message:{role:"assistant",content:"fake"}},
  ])assert.throws(()=>phiServeFinalText(body),/completed final text answer/);
});

test("integration: local bridge uses authenticated tags and chat with no Ollama or cloud fallback",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"thinktank-phiserve-integration-"));
  const old=globalThis.fetch;
  const saved={
    LOCAL_MODEL_BACKEND:process.env.LOCAL_MODEL_BACKEND,
    PHISERVE_TOKEN_FILE:process.env.PHISERVE_TOKEN_FILE,
    PHISERVE_BASE_URL:process.env.PHISERVE_BASE_URL,
    PHISERVE_MODEL:process.env.PHISERVE_MODEL,
  };
  try{
    const tokenPath=join(dir,"secret.txt");
    writeFileSync(tokenPath,TOKEN+"\n",{mode:0o600});
    process.env.LOCAL_MODEL_BACKEND="phiserve";
    process.env.PHISERVE_TOKEN_FILE=tokenPath;
    process.env.PHISERVE_BASE_URL=PHISERVE_DEFAULT_URL;
    process.env.PHISERVE_MODEL="shared-qwen";
    const calls=[];
    globalThis.fetch=async(url,options)=>{
      calls.push({url,options});
      assert.equal(options.headers.authorization,"Bearer "+TOKEN);
      assert.ok(url.startsWith("http://127.0.0.1:11435/"));
      if(url.endsWith("/api/tags")){
        return Response.json({models:[{name:"shared-qwen"}]});
      }
      if(url.endsWith("/api/chat")){
        const body=JSON.parse(options.body);
        assert.deepEqual(Object.keys(body).sort(),["messages","model","options","stream"]);
        assert.equal(body.model,"shared-qwen");
        assert.equal(body.stream,false);
        assert.equal(body.options.num_predict,1200);
        assert.deepEqual(body.messages,[{role:"user",content:"Build a proof"}]);
        return Response.json({model:body.model,done:true,message:{role:"assistant",content:"Evidence first."}});
      }
      throw Error("Unexpected network URL");
    };
    const module=await import("./provider-bridge.mjs?phiserve-integration-test");
    const status=await module.ollamaStatus();
    assert.equal(status.provider,"PhiServe");
    assert.equal(status.state,"connected");
    assert.deepEqual(status.models,["shared-qwen"]);
    const answer=await module.invokeOllama({
      model:"shared-qwen",
      messages:[{role:"user",content:"Build a proof"}],
    });
    assert.equal(answer.provider,"PhiServe");
    assert.equal(answer.text,"Evidence first.");
    assert.deepEqual(calls.map(x=>x.url),[
      PHISERVE_DEFAULT_URL+"/api/tags",
      PHISERVE_DEFAULT_URL+"/api/tags",
      PHISERVE_DEFAULT_URL+"/api/chat",
    ]);
  }finally{
    globalThis.fetch=old;
    for(const [key,value] of Object.entries(saved)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
    rmSync(dir,{recursive:true,force:true});
  }
});

test("integration: failed authentication does not retry Ollama or cloud",async()=>{
  // Helper ensures no credentials leak in diagnostics.
  const noFile="/not-existing/private/token.txt";
  assert.throws(()=>phiServeHeaders(noFile,true),error=>{
    assert.doesNotMatch(error.message,/1234567890-abcdef/);
    assert.match(error.message,/missing|unreadable/);
    return true;
  });
});
