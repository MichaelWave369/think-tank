import {describe,it,expect} from "vitest";
import {inspectSpvDraft,readSpvFragment,SPV_DRAFT_HASH_PREFIX} from "./spvHandoff";

const draft=()=>({
 schema:"spv-thinktank-draft.v0.1",kind:"operator-directive-draft",
 source:"vessie-human-composed",directive:"Investigate the Vessie release evidence, then challenge possible root causes.",
 suggestedMode:"council",runRequested:false,executionAuthorityGranted:false,providerKeysTransferred:false
});
function fragment(x:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(x));
 let raw="";for(const b of bytes)raw+=String.fromCharCode(b);
 return SPV_DRAFT_HASH_PREFIX+btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
describe("review-only Vessie handoff",()=>{
 it("recognizes exact bounded operator draft and never grants action authority",()=>{
  const x=draft(),r=readSpvFragment(fragment(x));
  expect(r).toEqual(x);
  expect(r?.runRequested).toBe(false);
  expect(r?.executionAuthorityGranted).toBe(false);
 });
 it("handles UTF-8 correctly but rejects invalid encodings and unsupported fragments",()=>{
  const x=draft();x.directive="Investigate Córdoba, 東京 and Φ while rejecting unsupported conclusions.";
  expect(readSpvFragment(fragment(x))?.directive).toBe(x.directive);
  expect(readSpvFragment("#other-fragment=hello")).toBeNull();
  expect(()=>readSpvFragment(SPV_DRAFT_HASH_PREFIX+"%20")).toThrow(/BASE64/);
  expect(()=>readSpvFragment(SPV_DRAFT_HASH_PREFIX+"a".repeat(4101))).toThrow(/SIZE/);
 });
 it("refuses self-authorized requests, forged commands, missing fields and empty directives",()=>{
  expect(()=>inspectSpvDraft({...draft(),runRequested:true})).toThrow(/AUTHORITY/);
  expect(()=>inspectSpvDraft({...draft(),executionAuthorityGranted:true})).toThrow(/AUTHORITY/);
  expect(()=>inspectSpvDraft({...draft(),providerKeysTransferred:true})).toThrow(/AUTHORITY/);
  expect(()=>inspectSpvDraft({...draft(),executionCommand:"RUN LIVE"})).toThrow(/FIELDS/);
  expect(()=>inspectSpvDraft({...draft(),directive:" "})).toThrow(/DIRECTIVE/);
  expect(()=>inspectSpvDraft({...draft(),suggestedMode:"auto-run"})).toThrow(/MODE/);
 });
 it("prohibits control characters and excess text in a browser fragment",()=>{
  expect(()=>inspectSpvDraft({...draft(),directive:"a".repeat(1201)})).toThrow(/DIRECTIVE/);
  expect(()=>inspectSpvDraft({...draft(),directive:"ABC\u0000DEF"})).toThrow(/DIRECTIVE/);
 });
});
