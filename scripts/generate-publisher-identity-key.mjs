import {generateKeyPairSync} from "node:crypto";
import {existsSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const privatePath=resolve(process.argv[2]||"publisher-identity-private.pem");
const publicPath=resolve(process.argv[3]||"publisher-identity-public.pem");

for(const path of [privatePath,publicPath]){
  if(existsSync(path)){
    throw new Error("Refusing to overwrite existing file: "+path);
  }
}

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
writeFileSync(
  privatePath,
  privateKey.export({type:"pkcs8",format:"pem"}).toString(),
  {mode:0o600}
);
writeFileSync(
  publicPath,
  publicKey.export({type:"spki",format:"pem"}).toString(),
  {mode:0o644}
);

console.log("Publisher identity key READY");
console.log("private="+privatePath);
console.log("public="+publicPath);
console.log("Keep the private key on the publisher/deployment side. Do not configure it in Think Tank.");
