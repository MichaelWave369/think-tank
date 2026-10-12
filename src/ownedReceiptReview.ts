/* TT-43: validate format and internal consistency of an imported TT-42 receipt.
 * No file can attest to its own origin, test execution or release authority.
 */
export const OWNED_RECEIPT_MAX_BYTES=131072;
export const OWNED_IMAGE_MAX_BYTES=3145728;
const RECEIPT_KEYS=[
 "schema","status","scope","target","actualAppExercised","browserEngine",
 "browserVersion","checkedOutCommit","runAt","fixtureSourceSha256",
 "checkedInContractSha256","measuredBy","rounds","assertions","screenshot",
 "sourceValues","separateFromTT39OperatorCaptureSchema","testExecutedOnOwnedFixture",
 "thirdPartyAppTested","signed","canonicalEvidence","releaseAuthorized","antiMDone"
];
const ROUND_KEYS=["round","before","after"];
const OBS_KEYS=["ui.mode","ui.count"];
const ASSERT_KEYS=["beforeMatchesContract","afterMatchesContract","deterministicReload",
 "externalRequests","mutationRequests","pageExceptions"];
const SCREENSHOT_KEYS=["name","sha256"];
export type OwnedObservation={"ui.mode":string;"ui.count":string};
export type OwnedProbeRound={round:1|2;before:OwnedObservation;after:OwnedObservation};
export type OwnedProbeReceipt={
 schema:"thinktank.owned-app-browser-observation.v1";
 status:"OWNED_FIXTURE_ASSERTIONS_PASSED";
 scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY";
 target:"ThinkTank owned counter fixture";
 actualAppExercised:"independent-owned-html-counter-fixture";
 browserEngine:"chromium";browserVersion:string;checkedOutCommit:string;
 runAt:string;fixtureSourceSha256:string;checkedInContractSha256:string;
 measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT";
 rounds:[OwnedProbeRound,OwnedProbeRound];
 assertions:{
 beforeMatchesContract:true;afterMatchesContract:true;deterministicReload:true;
 externalRequests:0;mutationRequests:0;pageExceptions:0;
 };
 screenshot:{name:"tt42-owned-target.png";sha256:string};
 sourceValues:"MEASURED_FROM_OUR_RUNNING_FIXTURE_NOT_OPERATOR_ENTERED_JSON";
 separateFromTT39OperatorCaptureSchema:true;testExecutedOnOwnedFixture:true;
 thirdPartyAppTested:false;signed:false;canonicalEvidence:false;
 releaseAuthorized:false;antiMDone:false;
};
export type OwnedReceiptReview={
 schema:"thinktank.owned-receipt-review.v1";
 status:"STRUCTURALLY_CONSISTENT_UNAUTHENTICATED";
 scope:"TT42_FIXED_FIRST_PARTY_FIXTURE_ONLY";
 checkedOutCommit:string;receiptSha256:string;fixtureSourceSha256:string;
 checkedInContractSha256:string;reportedBrowserVersion:string;
 before:OwnedObservation;after:OwnedObservation;
 repeatedRounds:2;
 screenshotDigestComparison:"MATCHES_DECLARED_BYTES"|"NOT_PROVIDED";
 testExecutionAuthenticated:false;originAuthenticated:false;
 evidenceVerified:false;releaseAuthorized:false;antiMDone:false;
};
function obj(value:unknown):value is Record<string,unknown>{
 return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function shape(value:unknown,keys:readonly string[],label:string):asserts value is Record<string,unknown>{
 if(!obj(value)||Object.keys(value).sort().join("|")!==[...keys].sort().join("|"))
  throw Error("RECEIPT_INVALID_"+label+"_FIELDS");
}
function must(value:unknown,expected:unknown,name:string){
 if(value!==expected)throw Error("RECEIPT_INVALID_"+name);
}
function sha(value:unknown,label:string):string{
 if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value))
  throw Error("RECEIPT_INVALID_"+label);
 return value;
}
function obs(value:unknown,mode:string,count:string,label:string):OwnedObservation{
 shape(value,OBS_KEYS,label);
 must(value["ui.mode"],mode,label+"_MODE");
 must(value["ui.count"],count,label+"_COUNT");
 return {"ui.mode":mode,"ui.count":count};
}
function time(value:unknown){
 if(typeof value!=="string"||!(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))||
  !Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)
  throw Error("RECEIPT_INVALID_TIME");
 return value;
}
export function validateOwnedProbeReceipt(input:unknown):OwnedProbeReceipt{
 shape(input,RECEIPT_KEYS,"ROOT");
 const fixed:Record<string,unknown>={
  schema:"thinktank.owned-app-browser-observation.v1",
  status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
  scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
  target:"ThinkTank owned counter fixture",
  actualAppExercised:"independent-owned-html-counter-fixture",
  browserEngine:"chromium",
  measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
  sourceValues:"MEASURED_FROM_OUR_RUNNING_FIXTURE_NOT_OPERATOR_ENTERED_JSON",
  separateFromTT39OperatorCaptureSchema:true,testExecutedOnOwnedFixture:true,
  thirdPartyAppTested:false,signed:false,canonicalEvidence:false,
  releaseAuthorized:false,antiMDone:false
 };
 for(const [k,v] of Object.entries(fixed))must(input[k],v,"FIXED_"+k);
 if(typeof input.browserVersion!=="string"||input.browserVersion.length>60||
  !/^\d+(?:\.\d+){1,4}$/.test(input.browserVersion))
  throw Error("RECEIPT_INVALID_BROWSER_VERSION");
 if(typeof input.checkedOutCommit!=="string"||
  !/^[a-f0-9]{40}$/.test(input.checkedOutCommit))
  throw Error("RECEIPT_INVALID_COMMIT");
 const runAt=time(input.runAt);
 const fixtureSourceSha256=sha(input.fixtureSourceSha256,"FIXTURE_DIGEST");
 const checkedInContractSha256=sha(input.checkedInContractSha256,"CONTRACT_DIGEST");
 shape(input.assertions,ASSERT_KEYS,"ASSERTIONS");
 const asserted:Record<string,unknown>={
  beforeMatchesContract:true,afterMatchesContract:true,deterministicReload:true,
  externalRequests:0,mutationRequests:0,pageExceptions:0
 };
 for(const [k,v] of Object.entries(asserted))must(input.assertions[k],v,"ASSERTION_"+k);
 shape(input.screenshot,SCREENSHOT_KEYS,"SCREENSHOT");
 must(input.screenshot.name,"tt42-owned-target.png","SCREENSHOT_NAME");
 const screenshotSha256=sha(input.screenshot.sha256,"SCREENSHOT_DIGEST");
 if(!Array.isArray(input.rounds)||input.rounds.length!==2)
  throw Error("RECEIPT_INVALID_ROUNDS");
 const rounds=input.rounds.map((r,i)=>{
  shape(r,ROUND_KEYS,"ROUND");
  must(r.round,i+1,"ROUND_NUMBER");
  const before=obs(r.before,"day","0","BEFORE");
  const after=obs(r.after,"night","1","AFTER");
  return {round:(i+1) as 1|2,before,after};
 }) as [OwnedProbeRound,OwnedProbeRound];
 return {
  schema:"thinktank.owned-app-browser-observation.v1",
  status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
  scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
  target:"ThinkTank owned counter fixture",
  actualAppExercised:"independent-owned-html-counter-fixture",
  browserEngine:"chromium",browserVersion:input.browserVersion,
  checkedOutCommit:input.checkedOutCommit,runAt,
  fixtureSourceSha256,checkedInContractSha256,
  measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",rounds,
  assertions:{
   beforeMatchesContract:true,afterMatchesContract:true,deterministicReload:true,
   externalRequests:0,mutationRequests:0,pageExceptions:0
  },
  screenshot:{name:"tt42-owned-target.png",sha256:screenshotSha256},
  sourceValues:"MEASURED_FROM_OUR_RUNNING_FIXTURE_NOT_OPERATOR_ENTERED_JSON",
  separateFromTT39OperatorCaptureSchema:true,testExecutedOnOwnedFixture:true,
  thirdPartyAppTested:false,signed:false,canonicalEvidence:false,
  releaseAuthorized:false,antiMDone:false
 };
}
export function parseOwnedProbeReceipt(raw:string):OwnedProbeReceipt{
 if(new TextEncoder().encode(raw).byteLength>OWNED_RECEIPT_MAX_BYTES)
  throw Error("RECEIPT_FILE_TOO_LARGE");
 let value:unknown;
 try{value=JSON.parse(raw)}catch{throw Error("RECEIPT_INVALID_JSON")}
 return validateOwnedProbeReceipt(value);
}
export function buildOwnedReceiptReview(
 receipt:OwnedProbeReceipt,receiptDigest:string,screenshotMatched:boolean|null
):OwnedReceiptReview{
 const valid=validateOwnedProbeReceipt(receipt);
 const receiptSha256=sha(receiptDigest,"RECEIPT_DIGEST");
 if(screenshotMatched===false)throw Error("RECEIPT_SCREENSHOT_MISMATCH");
 return {
  schema:"thinktank.owned-receipt-review.v1",
  status:"STRUCTURALLY_CONSISTENT_UNAUTHENTICATED",
  scope:"TT42_FIXED_FIRST_PARTY_FIXTURE_ONLY",
  checkedOutCommit:valid.checkedOutCommit,receiptSha256,
  fixtureSourceSha256:valid.fixtureSourceSha256,
  checkedInContractSha256:valid.checkedInContractSha256,
  reportedBrowserVersion:valid.browserVersion,
  before:valid.rounds[0].before,after:valid.rounds[0].after,
  repeatedRounds:2,
  screenshotDigestComparison:screenshotMatched===true?"MATCHES_DECLARED_BYTES":"NOT_PROVIDED",
  testExecutionAuthenticated:false,originAuthenticated:false,
  evidenceVerified:false,releaseAuthorized:false,antiMDone:false
 };
}
