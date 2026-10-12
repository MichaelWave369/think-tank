import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 validateOwnedProbeContract,compareObservedWithExpected
} from "./owned-browser-contract.mjs";

const source=JSON.parse(await readFile(
 "tests/fixtures/observatory-owned-counter.contract.json","utf8"));
const clone=()=>structuredClone(source);
test("TT-42 fixed first-party contract validates, with no external URLs",()=>{
 const c=validateOwnedProbeContract(source);
 assert.equal(c.target,"ThinkTank owned counter fixture");
 assert.equal(c.fixturePath,"tests/fixtures/observatory-owned-counter.html");
 assert.deepEqual(c.expectedBefore,{"ui.mode":"day","ui.count":"0"});
 assert.deepEqual(c.expectedAfter,{"ui.mode":"night","ui.count":"1"});
});
test("TT-42 denies arbitrary target paths, action choices, URLs, fields and duplicates",()=>{
 for(const [field,value] of [
  ["target","External premium software"],
  ["fixturePath","https://example.com/secret"],
  ["fixturePath","../../private.html"],
  ["schema","thinktank.external-probe.v1"]
 ]){
  const c=clone();c[field]=value;
  assert.throws(()=>validateOwnedProbeContract(c),/SCOPE_DENIED/);
 }
 const extra=clone();extra.networkUrl="https://example.com";
 assert.throws(()=>validateOwnedProbeContract(extra),/FIELDS/);
 const action=clone();action.action={kind:"type",testId:"advance"};
 assert.throws(()=>validateOwnedProbeContract(action),/ACTION_DENIED/);
 const selector=clone();selector.observations[0].testId="body script";
 assert.throws(()=>validateOwnedProbeContract(selector),/TEST_ID/);
 const duplicate=clone();duplicate.observations[1].key="ui.mode";
 assert.throws(()=>validateOwnedProbeContract(duplicate),/DUPLICATE/);
});
test("TT-42 compares actual strings without treating mismatch as success",()=>{
 const keys=["ui.mode","ui.count"];
 const match=compareObservedWithExpected({"ui.mode":"day","ui.count":"0"},source.expectedBefore,keys);
 assert.deepEqual(match,{matches:true,issues:[]});
 const mismatch=compareObservedWithExpected({"ui.mode":"night","ui.count":"0"},source.expectedBefore,keys);
 assert.equal(mismatch.matches,false);
 assert.deepEqual(mismatch.issues,[{key:"ui.mode",observed:"night",expected:"day"}]);
 const missing={"ui.mode":"day"};
 assert.throws(()=>compareObservedWithExpected(missing,source.expectedBefore,keys),/FIELDS/);
 const malformed={"ui.mode":3,"ui.count":"0"};
 assert.throws(()=>compareObservedWithExpected(malformed,source.expectedBefore,keys),/OBSERVED_VALUE/);
});
