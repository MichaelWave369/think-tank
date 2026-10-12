/* TT-48: run only inside --network none, read-only proof mount.
 * The commit and trusted root digest are NOT obtained from the proof manifest.
 */
import {verifyIsolatedProof} from "./tt48-isolation-policy.mjs";

if(process.argv.length!==5){
 console.error("USAGE: node scripts/verify-tt48-network-isolated.mjs <proof-folder> <independently-confirmed-source-sha> <out-of-band-trusted-root-sha256>");
 process.exitCode=2;
}else{
 const [, , folder, sourceCommit, trustRootPin]=process.argv;
 const receipt=await verifyIsolatedProof(folder,sourceCommit,trustRootPin);
 console.log("TT48_NETWORK_ISOLATED_PINNED_ROOT_PASS",JSON.stringify(receipt));
}
