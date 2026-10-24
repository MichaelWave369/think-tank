/**
 * TT-35 R9: opt-in detached Ed25519 signature of an already generated
 * local kernel replay PASS report.
 *
 * NO key is created, exported, transmitted or committed. The private key
 * stays on the operator computer and is read only at the explicit command.
 * The signature proves key possession; NOT a verified signer identity,
 * factual accuracy, real model execution or external action permission.
 */
import {createHash,createPrivateKey,createPublicKey,sign,verify} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

export const LOCAL_REPLAY_SIGNATURE_SCHEMA="phi-thinktank-local-replay-signature.v0.1";
export const LOCAL_REPLAY_DOMAIN="PHI_THINKTANK_LOCAL_REPLAY_SIGNATURE_V1\n";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const hex64=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);

export function buildReplaySignatureEnvelope(reportBytes,privatePem){
  if(!Buffer.isBuffer(reportBytes)||reportBytes.byteLength<1||reportBytes.byteLength>64*1024)
    throw Error("SIGN_REPORT_BYTES");
  let report;
  try{report=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(reportBytes))}
  catch{throw Error("SIGN_REPORT_JSON")}
  if(!plain(report)||report.schema!=="phi-thinktank-local-council-verification.v0.1"||
     report.result!=="KERNEL_REPLAY_PASS"||report.execution!=="LOCAL_KERNEL_REPLAY_ONLY"||
     report.authGranted!==false||report.externalDone!==false||
     report.truthAuthority!==false||report.signerAuthenticated!==false||
     report.independentlyAuthenticated!==false||
     !hex64(report.ledgerSha256)||!hex64(report.contractSha256)||
     !(report.dossierSha256===null||hex64(report.dossierSha256))){
    throw Error("SIGN_REPORT_UNSAFE_OR_INCOMPLETE");
  }
  const privateKey=createPrivateKey(privatePem);
  if(privateKey.asymmetricKeyType!=="ed25519")throw Error("SIGN_KEY_NOT_ED25519");
  const publicKey=createPublicKey(privateKey);
  const spki=publicKey.export({format:"der",type:"spki"});
  const reportSha256=sha(reportBytes);
  const signedMessage=Buffer.from(LOCAL_REPLAY_DOMAIN+reportSha256,"utf8");
  const signatureBase64=sign(null,signedMessage,privateKey).toString("base64");
  const publicKeySpkiBase64=spki.toString("base64");
  const fingerprint=sha(spki);
  if(!verify(null,signedMessage,publicKey,Buffer.from(signatureBase64,"base64")))
    throw Error("SIGN_SELF_VERIFY_FAILED");
  return Object.freeze({
    schema:LOCAL_REPLAY_SIGNATURE_SCHEMA,
    domain:LOCAL_REPLAY_DOMAIN.trimEnd(),
    algorithm:"Ed25519",
    messageEncoding:"utf8-domain-plus-sha256-hex",
    reportSha256,
    publicKeySpkiBase64,
    publicKeyFingerprintSha256:fingerprint,
    signatureBase64,
    signerLabel:"operator-selected-local-key",
    authGranted:false,
    externalDone:false,
    truthAuthority:false,
    signerAuthenticated:false
  });
}

function main(argv){
  const [inputPath,keyPath,outputPath,flag,...extra]=argv;
  if(!inputPath||!keyPath||!outputPath||flag!=="--confirm-sign-only"||extra.length)
    throw Error("USAGE node scripts/sign-local-replay-receipt.mjs REPORT_JSON PRIVATE_KEY_PEM OUTPUT_SIGNATURE_JSON --confirm-sign-only");
  const source=readFileSync(resolve(inputPath));
  const privateKey=readFileSync(resolve(keyPath),"utf8");
  const result=buildReplaySignatureEnvelope(source,privateKey);
  writeFileSync(resolve(outputPath),JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o644});
  console.log("LOCAL_REPLAY_SIGNATURE="+resolve(outputPath));
  console.log("PUBLIC_KEY_FINGERPRINT_SHA256="+result.publicKeyFingerprintSha256);
  console.log("SIGNATURE_VALID_SELF_TEST=true");
  console.log("NO_IDENTITY_TRUST_NO_FACTUAL_TRUTH_NO_EXTERNAL_DONE");
}

if(process.argv[1]&&/[/\\]sign-local-replay-receipt\.mjs$/.test(process.argv[1])){
  try{main(process.argv.slice(2))}
  catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
