/* TT-51 operator-facing CLI. Does not require Docker for Windows users.
 * Offline-capable Sigstore verifier; makes NO network-isolation claim.
 */
import {verifyOperatorPinnedProof} from "./tt51-operator-proof.mjs";
if(process.argv.length!==5){
 console.error("USAGE: node scripts/verify-tt51-operator-proof.mjs <unpacked-TT47-folder> <INDEPENDENT_40_CHAR_MAIN_COMMIT> <INDEPENDENT_64_CHAR_TRUST_ROOT_SHA256>");
 process.exitCode=2;
}else{
 const [, , folder,sourceCommit,rootSha]=process.argv;
 const result=await verifyOperatorPinnedProof(folder,sourceCommit,rootSha);
 console.log("TT51_OPERATOR_PINNED_SIGSTORE_PASS",JSON.stringify(result));
}
