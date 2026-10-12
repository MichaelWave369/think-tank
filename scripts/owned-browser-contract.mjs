/* TT-42. Only the versioned, checked-in first-party fixture is eligible. */
export const OWNED_FIXTURE_PATH="tests/fixtures/observatory-owned-counter.html";
export const OWNED_FIXTURE_TARGET="ThinkTank owned counter fixture";
const fields=["schema","target","fixturePath","observations","action","expectedBefore","expectedAfter"];
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function exact(value,keys,reason){
 if(!isObject(value)||Object.keys(value).sort().join("|")!==[...keys].sort().join("|"))
  throw Error("OWNED_PROBE_INVALID_"+reason+"_FIELDS");
}
function key(value){
 if(typeof value!=="string"||value.length<1||value.length>80||
  !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value))
  throw Error("OWNED_PROBE_INVALID_KEY");
 return value;
}
function testId(value){
 if(typeof value!=="string"||!/^[a-z][a-z0-9-]{0,39}$/.test(value))
  throw Error("OWNED_PROBE_INVALID_TEST_ID");
 return value;
}
function expected(snapshot,keys){
 exact(snapshot,keys,"EXPECTED");
 for(const item of keys){
  const value=snapshot[item];
  if(typeof value!=="string"||value.length>1000||
   /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
   throw Error("OWNED_PROBE_INVALID_EXPECTED_VALUE");
 }
 return Object.fromEntries(keys.map(k=>[k,snapshot[k]]));
}
export function validateOwnedProbeContract(input){
 exact(input,fields,"CONTRACT");
 if(input.schema!=="thinktank.owned-probe-contract.v1"||
  input.target!==OWNED_FIXTURE_TARGET||
  input.fixturePath!==OWNED_FIXTURE_PATH)
  throw Error("OWNED_PROBE_SCOPE_DENIED");
 if(!Array.isArray(input.observations)||input.observations.length<1||
  input.observations.length>8)throw Error("OWNED_PROBE_OBSERVATION_LIMIT");
 const observations=input.observations.map(x=>{
  exact(x,["key","testId"],"OBSERVATION");
  return {key:key(x.key),testId:testId(x.testId)};
 });
 const keys=observations.map(x=>x.key),ids=observations.map(x=>x.testId);
 if(new Set(keys).size!==keys.length||new Set(ids).size!==ids.length)
  throw Error("OWNED_PROBE_DUPLICATE_OBSERVATION");
 exact(input.action,["kind","testId"],"ACTION");
 if(input.action.kind!=="click"||testId(input.action.testId)!=="advance")
  throw Error("OWNED_PROBE_ACTION_DENIED");
 if(ids.includes(input.action.testId))throw Error("OWNED_PROBE_ACTION_IS_OBSERVATION");
 return {
  schema:"thinktank.owned-probe-contract.v1",
  target:OWNED_FIXTURE_TARGET,fixturePath:OWNED_FIXTURE_PATH,
  observations,
  action:{kind:"click",testId:"advance"},
  expectedBefore:expected(input.expectedBefore,keys),
  expectedAfter:expected(input.expectedAfter,keys)
 };
}
export function compareObservedWithExpected(observed,expectedValues,keys){
 exact(observed,keys,"OBSERVED");
 const issues=[];
 for(const k of keys){
  if(typeof observed[k]!=="string")throw Error("OWNED_PROBE_INVALID_OBSERVED_VALUE");
  if(observed[k]!==expectedValues[k])
   issues.push({key:k,expected:expectedValues[k],observed:observed[k]});
 }
 return {matches:issues.length===0,issues};
}
