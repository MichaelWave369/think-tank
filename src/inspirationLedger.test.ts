import {describe,expect,it} from "vitest";
import {createInspirationEntry,parseInspirationEntries,serializeInspirationEntries,INSPIRATION_MAX_ENTRIES} from "./inspirationLedger";
const draft=()=>({
 title:"New original workflow",sourceUrl:"https://github.com/example/repo",
 inspire:"Coordinate specialist reviews",abstract:"Make handoffs reliable",
 invent:"Our provenance-aware review graph",prototype:"Build deterministic test fixtures",
 verify:"Prove no provider or release authority changed"
});
const item=()=>createInspirationEntry(draft(),"INSP-12345678","2026-10-10T22:00:00.000Z");
describe("TT-37 original ideas, no inherited trust",()=>{
 it("round trips browser-local operator notes with no implied authority",()=>{
  const e=item();
  expect(e.sourceVerified).toBe(false);
  expect(e.codeImported).toBe(false);
  expect(e.executionAuthority).toBe(false);
  expect(parseInspirationEntries(serializeInspirationEntries([e]))).toEqual([e]);
 });
 it("rejects risky URLs and blank independent designs",()=>{
  for(const url of ["http://github.com/a","javascript:alert(1)","https://user:pass@example.com/a"]){
   expect(()=>createInspirationEntry({...draft(),sourceUrl:url},"INSP-12345678","2026-10-10T22:00:00.000Z")).toThrow();
  }
  expect(()=>createInspirationEntry({...draft(),invent:" "},"INSP-12345678","2026-10-10T22:00:00.000Z")).toThrow();
 });
 it("rejects invented verification, authorization or unknown fields",()=>{
  const b=JSON.parse(serializeInspirationEntries([item()]));
  b.entries[0].sourceVerified=true;
  expect(()=>parseInspirationEntries(JSON.stringify(b))).toThrow(/AUTHORITY/);
  b.entries[0].sourceVerified=false;b.entries[0].executionAuthority=true;
  expect(()=>parseInspirationEntries(JSON.stringify(b))).toThrow(/AUTHORITY/);
  b.entries[0].executionAuthority=false;b.entries[0].copiedThirdPartyCode=true;
  expect(()=>parseInspirationEntries(JSON.stringify(b))).toThrow(/FIELDS/);
 });
 it("bounds local storage and rejects duplicated entries",()=>{
  expect(()=>serializeInspirationEntries([item(),item()])).toThrow(/DUPLICATE/);
  expect(()=>serializeInspirationEntries(Array(INSPIRATION_MAX_ENTRIES+1).fill(item()))).toThrow(/LIMIT/);
  expect(()=>parseInspirationEntries("bad json")).toThrow(/JSON/);
  expect(parseInspirationEntries(null)).toEqual([]);
 });
});
