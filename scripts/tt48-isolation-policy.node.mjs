import {test} from "node:test";
import assert from "node:assert/strict";
import {
 sha256,assertIndependentTrustPin,assertLoopbackOnly,
 assertEgressProbeFailure,verifyIsolatedProof
} from "./tt48-isolation-policy.mjs";

const expectedRoot=Buffer.from('{"signed-root":"test-fixture"}\n');
const goodInterface={lo:[{address:"127.0.0.1",internal:true}]};
test("TT48 requires a 64-char out-of-band root pin matching exact bytes",()=>{
 const pin=sha256(expectedRoot);
 assert.equal(assertIndependentTrustPin(expectedRoot,pin),pin);
 assert.throws(()=>assertIndependentTrustPin(expectedRoot,"not-a-pin"),
  /INVALID_INDEPENDENT_TRUST_PIN/);
 assert.throws(()=>assertIndependentTrustPin(Buffer.from("substituted"),pin),
  /INDEPENDENT_TRUST_ROOT_MISMATCH/);
 assert.throws(()=>assertIndependentTrustPin(expectedRoot,"b".repeat(64)),
  /INDEPENDENT_TRUST_ROOT_MISMATCH/);
});
test("TT48 refuses external interfaces, not merely a transient HTTP timeout",()=>{
 assert.equal(assertLoopbackOnly(goodInterface),true);
 for(const interfaces of [
  {lo:[{address:"127.0.0.1",internal:true}],eth0:[{address:"10.0.0.5",internal:false}]},
  {eth0:[{address:"10.0.0.5",internal:false}]},
  {},
  {lo:[]}
 ]){
  assert.throws(()=>assertLoopbackOnly(interfaces),/TT48_/);
 }
 for(const code of ["ENETUNREACH","EHOSTUNREACH","EADDRNOTAVAIL"]){
  assert.equal(assertEgressProbeFailure(code),code);
 }
 for(const invalid of ["ECONNREFUSED","ETIMEDOUT","TIMEOUT",undefined,"EAI_AGAIN"]){
  assert.throws(()=>assertEgressProbeFailure(invalid),/EGRESS_NOT_DEMONSTRABLY_BLOCKED/);
 }
});
test("TT48 refuses a reachable network before examining untrusted proof",async()=>{
 let checked=false;
 await assert.rejects(()=>verifyIsolatedProof("/absent","a".repeat(40),"b".repeat(64),{
  interfaces:goodInterface,
  egressProbe:async()=>{checked=true;return "ECONNREFUSED";}
 }),/EGRESS_NOT_DEMONSTRABLY_BLOCKED/);
 assert.equal(checked,true);
});
test("TT48 refuses network interface even with mocked passing egress probe",async()=>{
 await assert.rejects(()=>verifyIsolatedProof("/absent","a".repeat(40),"b".repeat(64),{
  interfaces:{lo:[{address:"127.0.0.1",internal:true}],
   eth0:[{address:"172.17.0.2",internal:false}]},
  egressProbe:async()=>"ENETUNREACH"
 }),/NETWORK_EGRESS_INTERFACE_PRESENT/);
});
