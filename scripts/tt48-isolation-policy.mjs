/* TT-48: trust root is pinned OUTSIDE the portable proof archive.
 * Checking the unsigned manifest alone is not an origin-authentication rule.
 */
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {networkInterfaces} from "node:os";
import {connect} from "node:net";
import {join} from "node:path";
import {TT47_FILES,verifyPortableProof} from "./tt47-portable-proof.mjs";

export const TT48_PROBE_IP="1.1.1.1";
export const TT48_PROBE_PORT=443;
export const TT48_RESULT_SCHEMA="thinktank.tt48-network-isolated-portable-review.v1";
export const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");

export function assertIndependentTrustPin(actualBytes,expected){
 if(typeof expected!=="string"||!/^[a-f0-9]{64}$/.test(expected))
  throw Error("TT48_INVALID_INDEPENDENT_TRUST_PIN");
 const found=sha256(actualBytes);
 if(found!==expected)throw Error("TT48_INDEPENDENT_TRUST_ROOT_MISMATCH");
 return found;
}
export function assertLoopbackOnly(interfaces){
 if(!interfaces||typeof interfaces!=="object"||Array.isArray(interfaces))
  throw Error("TT48_NETWORK_INTERFACES_UNAVAILABLE");
 const entries=Object.entries(interfaces);
 if(entries.length===0)throw Error("TT48_NO_LOOPBACK_INTERFACE");
 let loopback=false;
 for(const [name,addresses] of entries){
  if(!Array.isArray(addresses)||addresses.length===0)
   throw Error("TT48_NETWORK_INTERFACE_INVALID");
  for(const address of addresses){
   if(!address||address.internal!==true)
    throw Error("TT48_NETWORK_EGRESS_INTERFACE_PRESENT");
   if(name==="lo"||address.address==="127.0.0.1"||address.address==="::1")
    loopback=true;
  }
 }
 if(!loopback)throw Error("TT48_NO_LOOPBACK_INTERFACE");
 return true;
}
export function assertEgressProbeFailure(code){
 // A timeout or DNS failure is NOT proof of an isolated network namespace.
 // This is checked along with the Docker --network none constraint.
 if(code!=="ENETUNREACH"&&code!=="EHOSTUNREACH"&&code!=="EADDRNOTAVAIL")
  throw Error("TT48_EGRESS_NOT_DEMONSTRABLY_BLOCKED");
 return code;
}
export async function checkNoExternalIPRoute(){
 return new Promise((resolve,reject)=>{
  const sock=connect({host:TT48_PROBE_IP,port:TT48_PROBE_PORT});
  let done=false;
  const finish=(err)=>{
   if(done)return;done=true;sock.destroy();
   if(!err){reject(Error("TT48_EXTERNAL_CONNECTION_SUCCEEDED"));return}
   try{resolve(assertEgressProbeFailure(err.code))}
   catch(error){reject(error)}
  };
  sock.once("connect",()=>finish(null));
  sock.once("error",finish);
  sock.setTimeout(1500,()=>finish({code:"TIMEOUT"}));
 });
}
export async function verifyIsolatedProof(folder,sourceCommit,trustRootPin,options={}){
 // Caller must launch this process in Docker --network none and read-only mounts.
 assertLoopbackOnly(options.interfaces??networkInterfaces());
 const blockedBy=await (options.egressProbe??checkNoExternalIPRoute)();
 assertEgressProbeFailure(blockedBy);
 const root=await readFile(join(folder,TT47_FILES.trustedRoot));
 const rootSha256=assertIndependentTrustPin(root,trustRootPin);
 const verified=await (options.verifier??verifyPortableProof)(folder,sourceCommit);
 if(verified.verifiedSubjects!==2||
  verified.status!=="BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT")
  throw Error("TT48_ORIGINAL_SUBJECTS_NOT_VERIFIED");
 return {
  schema:TT48_RESULT_SCHEMA,
  status:"NETWORK_NAMESPACE_ISOLATED_AND_PINNED_ROOT_SUBJECTS_VERIFIED",
  rootSha256,sourceCommit,verifiedSubjects:2,
  networkScope:"DOCKER_NETWORK_NONE_LOOPBACK_ONLY",
  egressProbeBlockedBy:blockedBy,
  independentlyPinnedTrustRoot:true,
  originalSubjectsOnly:true,
  reportSigned:false,canonicalEvidence:false,
  releaseAuthorized:false,antiMDone:false,
  caveat:"Docker network isolation was exercised on a CI runner; it is not proof of an independent physically air-gapped computer."
 };
}
