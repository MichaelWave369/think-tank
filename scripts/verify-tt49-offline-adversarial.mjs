/* TT-49: challenge original signed proof from inside --network none. */
import {runOfflineAdversarialMatrix} from "./tt49-offline-adversarial.mjs";
if(process.argv.length!==5){
 console.error("USAGE: node scripts/verify-tt49-offline-adversarial.mjs <proof-folder> <independently-trusted-source-sha> <independently-pinned-root-sha256>");
 process.exitCode=2;
}else{
 const result=await runOfflineAdversarialMatrix(process.argv[2],process.argv[3],process.argv[4]);
 console.log("TT49_NETWORK_ISOLATED_ADVERSARIAL_PASS",JSON.stringify(result));
}
