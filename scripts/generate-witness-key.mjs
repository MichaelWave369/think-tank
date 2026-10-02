import {generateKeyPairSync} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";

const privatePath=resolve(process.argv[2]||"witness-ed25519-private.pem");
const publicPath=resolve(process.argv[3]||"witness-ed25519-public.pem");

if(existsSync(privatePath)||existsSync(publicPath)){
  console.error("Refusing to overwrite an existing witness key.");
  process.exit(1);
}

mkdirSync(dirname(privatePath),{recursive:true});
mkdirSync(dirname(publicPath),{recursive:true});

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
writeFileSync(privatePath,privateKey.export({type:"pkcs8",format:"pem"}),{mode:0o600});
writeFileSync(publicPath,publicKey.export({type:"spki",format:"pem"}),{mode:0o644});

console.log("Created independent Ed25519 witness keypair.");
console.log("Private: "+privatePath);
console.log("Public:  "+publicPath);
console.log("");
console.log("Keep the private key on the independent witness machine.");
console.log("Do not configure this private key in the Think Tank bridge.");
