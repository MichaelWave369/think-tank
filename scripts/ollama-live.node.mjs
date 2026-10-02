import test from "node:test";
import assert from "node:assert/strict";
import {
  ollamaAssistantSummary,
  ollamaChatPayload,
  runOllamaChatWithFallback
} from "./provider-bridge.mjs";

const response=()=>({headers:new Headers()});

test("ollama summary never promotes thinking into final assistant content",()=>{
  const summary=ollamaAssistantSummary({
    message:{
      thinking:"private reasoning that must never become the governed utterance",
      content:""
    },
    done:true,
    done_reason:"stop"
  });

  assert.equal(summary.content,"");
  assert.ok(summary.thinkingChars>0);
  assert.equal(summary.doneReason,"stop");
});

test("normal Ollama role request disables thinking and accepts final content",async()=>{
  const payloads=[];
  const result=await runOllamaChatWithFallback({
    model:"qwen3.6:latest",
    messages:[{role:"user",content:"build something"}],
    maxOutputTokens:256,
    transport:async payload=>{
      payloads.push(payload);
      return {
        body:{
          message:{thinking:"",content:"Final governed answer."},
          done:true,
          done_reason:"stop"
        },
        response:response()
      };
    }
  });

  assert.equal(result.text,"Final governed answer.");
  assert.equal(payloads.length,1);
  assert.equal(payloads[0].think,false);
  assert.equal(result.attempts[0].mode,"think:false");
});

test("falls back once to legacy payload when think control is rejected",async()=>{
  const payloads=[];
  const result=await runOllamaChatWithFallback({
    model:"legacy-model",
    messages:[{role:"user",content:"hello"}],
    transport:async payload=>{
      payloads.push(payload);
      if(payloads.length===1){
        const error=new Error("unknown field think");
        error.status=400;
        throw error;
      }
      return {
        body:{message:{content:"Legacy final answer."},done:true,done_reason:"stop"},
        response:response()
      };
    }
  });

  assert.equal(result.text,"Legacy final answer.");
  assert.equal(payloads.length,2);
  assert.equal(payloads[0].think,false);
  assert.equal("think" in payloads[1],false);
  assert.deepEqual(result.attempts.map(item=>item.mode),[
    "think:false-rejected",
    "legacy"
  ]);
});

test("thinking-only fallback fails closed with useful diagnostics",async()=>{
  let count=0;
  await assert.rejects(
    ()=>runOllamaChatWithFallback({
      model:"qwen3.6:latest",
      messages:[{role:"user",content:"hello"}],
      transport:async payload=>{
        count+=1;
        if(count===1){
          const error=new Error("think control unsupported");
          error.status=400;
          throw error;
        }
        return {
          body:{
            message:{
              thinking:"reasoning ".repeat(10),
              content:""
            },
            done:true,
            done_reason:"length"
          },
          response:response()
        };
      }
    }),
    error=>{
      assert.match(error.message,/no final assistant text/i);
      assert.match(error.message,/thinkingChars=/);
      assert.match(error.message,/doneReason=length/);
      assert.match(error.message,/Reasoning text was not promoted/i);
      return true;
    }
  );
});

test("ollama payload omits think for compatibility fallback",()=>{
  const payload=ollamaChatPayload({
    model:"legacy",
    messages:[{role:"user",content:"hello"}],
    disableThinking:false
  });
  assert.equal("think" in payload,false);
});
