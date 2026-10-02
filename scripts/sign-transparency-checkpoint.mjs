import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {signTransparencyCheckpointWithPrivateKey} from "./provider-bridge.mjs";

const checkpointPath=process.argv[2];
const privateKeyPath=process.argv[3];
const witnessLabel=process.argv[4]||"external-witness";

if(!checkpointPath||!privateKeyPath){
  console.error("Usage: node scripts/sign-transparency-checkpoint.mjs <checkpoint.json> <witness-private.pem> [label] [output.json]");
  process.exit(1);
}

const checkpoint=JSON.parse(readFileSync(resolve(checkpointPath),"utf8"));
const privateKeyPem=readFileSync(resolve(privateKeyPath),"utf8");
const witness=signTransparencyCheckpointWithPrivateKey(checkpoint,privateKeyPem,witnessLabel);
const outputPath=resolve(process.argv[5]||checkpoint.id.toLowerCase()+"-witness.json");

writeFileSync(outputPath,JSON.stringify(witness,null,2)+"\n",{mode:0o644});
console.log("Created detached transparency witness receipt.");
console.log("Checkpoint: "+checkpoint.id);
console.log("Witness:    "+witness.id);
console.log("Output:     "+outputPath);
console.log("");
console.log("Return only the witness JSON to the Think Tank operator. Keep the private key private.");
