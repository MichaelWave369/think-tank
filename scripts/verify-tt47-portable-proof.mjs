/* TT-47 standalone verifier for a downloaded portable proof archive directory.
 * Source SHA MUST be independently obtained (e.g. reviewed merge commit).
 * Does not trust the mutable manifest to choose the expected SHA.
 */
import {verifyPortableProof} from "./tt47-portable-proof.mjs";
if(process.argv.length!==4){
 console.error("USAGE: node scripts/verify-tt47-portable-proof.mjs <unpacked-proof-folder> <independently-trusted-40-character-main-sha>");
 process.exitCode=2;
}else{
 const result=await verifyPortableProof(process.argv[2],process.argv[3]);
 console.log("TT47_LOCAL_PROVENANCE_VERIFIED",JSON.stringify(result));
}
