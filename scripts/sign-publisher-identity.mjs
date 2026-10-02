import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign
} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  publisherOriginIdentityEnvelopeFor,
  stableCanonicalJson
} from "./provider-bridge.mjs";

const [
  originRaw,
  publisherIdRaw,
  publisherLabelRaw,
  administrativeDomainClaimRaw,
  privateKeyFileRaw,
  outputFileRaw
]=process.argv.slice(2);

if(
  !originRaw||
  !publisherIdRaw||
  !publisherLabelRaw||
  !administrativeDomainClaimRaw||
  !privateKeyFileRaw||
  !outputFileRaw
){
  throw new Error(
    "Usage: node scripts/sign-publisher-identity.mjs <https-origin> <publisher-id> <publisher-label> <administrative-domain-claim> <private-key.pem> <output.json>"
  );
}

const origin=new URL(originRaw);
if(
  origin.protocol!=="https:"||
  origin.username||
  origin.password||
  origin.hash||
  origin.pathname!=="/"||
  origin.search
){
  throw new Error("Publisher identity origin must be a credential-free HTTPS origin with no path/query/fragment.");
}

const publisherId=publisherIdRaw.trim();
const publisherLabel=publisherLabelRaw.trim();
const administrativeDomainClaim=administrativeDomainClaimRaw.trim();
if(!publisherId||publisherId.length>200)throw new Error("Publisher id is empty or too long.");
if(!publisherLabel||publisherLabel.length>300)throw new Error("Publisher label is empty or too long.");
if(!administrativeDomainClaim||administrativeDomainClaim.length>300){
  throw new Error("Administrative-domain claim is empty or too long.");
}

const privateKey=createPrivateKey(readFileSync(resolve(privateKeyFileRaw),"utf8"));
if(privateKey.asymmetricKeyType!=="ed25519"){
  throw new Error("Publisher identity private key must be Ed25519.");
}
const publicKey=createPublicKey(privateKey);
const publicKeyPem=publicKey.export({type:"spki",format:"pem"}).toString();
const publicKeyFingerprintSha256=createHash("sha256")
  .update(publicKey.export({type:"spki",format:"der"}))
  .digest("hex");

const descriptorBase={
  schemaVersion:1,
  protocol:"phi-publisher-identity-v1",
  origin:origin.origin,
  publisherId,
  publisherLabel,
  administrativeDomainClaim,
  publicKeyPem,
  publicKeyFingerprintSha256,
  claimedAt:new Date().toISOString()
};

const envelope=publisherOriginIdentityEnvelopeFor(descriptorBase);
const signatureBase64=cryptoSign(
  null,
  Buffer.from(stableCanonicalJson(envelope),"utf8"),
  privateKey
).toString("base64");

const descriptor={...descriptorBase,signatureBase64};
const outputPath=resolve(outputFileRaw);
writeFileSync(outputPath,JSON.stringify(descriptor,null,2)+"\n",{mode:0o644});

console.log("Publisher identity descriptor READY");
console.log("origin="+descriptor.origin);
console.log("keyFingerprintSha256="+descriptor.publicKeyFingerprintSha256);
console.log("output="+outputPath);
console.log("Serve this file at "+descriptor.origin+"/.well-known/phi-publisher-identity.json");
console.log("claimedAt is a self-attested publisher clock value, not trusted time.");
