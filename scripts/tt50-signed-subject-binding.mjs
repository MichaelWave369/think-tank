/* TT-50: cryptographic attestation subject binding.
 * Parse untrusted in-toto DSSE payloads to select only the signed statement
 * naming the EXACT subject bytes. Signature trust is established later by
 * gh attestation verify on the scoped, byte-preserved bundle(s).
 *
 * A valid attestation for a different artifact or source commit is NOT proof
 * for the requested file, even if a large JSONL bundle contains both.
 */
import {createHash} from "node:crypto";
import {basename} from "node:path";
import {
 TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH
} from "./tt44-provenance-policy.mjs";

export const TT50_EXPECTED_STATEMENT="https://in-toto.io/Statement/v1";
export const TT50_EXPECTED_PREDICATE="https://slsa.dev/provenance/v1";
export const TT50_MAX_BUNDLE_LINES=30;
const fail=code=>{throw Error("TT50_"+code)};
const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
const exactlyBase64=x=>typeof x==="string"&&x.length>0&&x.length<=5242880&&
 x.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(x);
const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);

export function subjectScopedAttestationBundle(rawBundle,subject,originalBytes){
 if(![TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH].includes(subject))
  fail("UNKNOWN_SUBJECT");
 if(!(originalBytes instanceof Uint8Array)||originalBytes.length===0)
  fail("MISSING_SUBJECT_BYTES");
 if(!(rawBundle instanceof Uint8Array)||rawBundle.length===0||rawBundle.length>4194304)
  fail("INVALID_BUNDLE_SIZE");
 let lines;
 try{lines=new TextDecoder("utf-8",{fatal:true}).decode(rawBundle).trim().split(/\r?\n/)}
 catch{fail("BUNDLE_NOT_UTF8")}
 if(lines.length>TT50_MAX_BUNDLE_LINES||lines.some(x=>!x.trim()))
  fail("INVALID_BUNDLE_LINE_COUNT");
 const expectedDigest=sha256(originalBytes);
 const expectedName=basename(subject);
 const matching=[];
 let sawSubjectName=false;
 for(const line of lines){
  let bundle;
  try{bundle=JSON.parse(line)}catch{fail("BUNDLE_INVALID_JSON")}
  if(!record(bundle)||!record(bundle.dsseEnvelope)||
   !exactlyBase64(bundle.dsseEnvelope.payload))
   fail("BUNDLE_MISSING_DSSE_PAYLOAD");
  if(bundle.dsseEnvelope.payloadType!=="application/vnd.in-toto+json")
   fail("BUNDLE_WRONG_DSSE_PAYLOAD_TYPE");
  const bytes=Buffer.from(bundle.dsseEnvelope.payload,"base64");
  let statement;
  try{statement=JSON.parse(bytes.toString("utf8"))}catch{fail("BUNDLE_INVALID_DSSE_STATEMENT")}
  if(!record(statement)||statement._type!==TT50_EXPECTED_STATEMENT||
   statement.predicateType!==TT50_EXPECTED_PREDICATE||
   !Array.isArray(statement.subject))
   fail("BUNDLE_UNEXPECTED_STATEMENT_SCHEMA");
  const named=statement.subject.filter(x=>record(x)&&x.name===expectedName);
  if(named.length===0)continue;
  sawSubjectName=true;
  if(named.some(x=>record(x.digest)&&x.digest.sha256===expectedDigest)){
   matching.push(line);
  }
 }
 if(matching.length===0){
  fail(sawSubjectName?"SIGNED_SUBJECT_DIGEST_MISMATCH":"SIGNED_SUBJECT_NAME_MISSING");
 }
 // We intentionally retain original signed bytes. Rebuilding a DSSE
 // statement would invalidate its signature, and isn't authorization.
 return {
  signedSubjectSha256:expectedDigest,
  signedSubjectName:expectedName,
  totalCandidateAttestations:lines.length,
  exactSubjectAttestations:matching.length,
  scopedJsonlBytes:Buffer.from(matching.join("\n")+"\n","utf8")
 };
}
