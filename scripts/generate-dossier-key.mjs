import {generateKeyPairSync} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";

const privatePath=resolve(process.argv[2]||".secrets/dossier-ed25519-private.pem");
const publicPath=resolve(process.argv[3]||".secrets/dossier-ed25519-public.pem");

if(existsSync(privatePath)||existsSync(publicPath)){
  console.error("Refusing to overwrite an existing dossier signing key.");
  process.exit(1);
}

mkdirSync(dirname(privatePath),{recursive:true});
mkdirSync(dirname(publicPath),{recursive:true});

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
const publicPem=publicKey.export({type:"spki",format:"pem"});

writeFileSync(privatePath,privatePem,{mode:0o600});
writeFileSync(publicPath,publicPem,{mode:0o644});

console.log("Created persistent Ed25519 dossier signing keypair.");
console.log("Private: "+privatePath);
console.log("Public:  "+publicPath);
console.log("");
console.log("Add this to .env:");
console.log("DOSSIER_SIGNING_PRIVATE_KEY_FILE="+privatePath);
console.log("DOSSIER_SIGNING_KEY_LABEL=local-bridge");
