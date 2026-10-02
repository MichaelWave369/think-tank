import http from "node:http";
import https from "node:https";
import {createHash,createPrivateKey,createPublicKey,sign as cryptoSign,verify as cryptoVerify} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {appendFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";

try{process.loadEnvFile(".env");}catch{}

const HOST=process.env.THINK_TANK_BRIDGE_HOST||"127.0.0.1";
const PORT=Number(process.env.THINK_TANK_BRIDGE_PORT||3691);
const OLLAMA_BASE_URL=(process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434").replace(/\/$/,"");
const KIMI_BASE_URL=(process.env.KIMI_BASE_URL||"https://api.moonshot.ai/v1").replace(/\/$/,"");
const MAX_BODY_BYTES=512_000;
const MAX_OUTPUT_TOKENS=Math.max(64,Number(process.env.PROVIDER_MAX_OUTPUT_TOKENS||1200));
const EVIDENCE_MAX_BYTES=Math.max(1024,Number(process.env.EVIDENCE_MAX_BYTES||2_000_000));
const EVIDENCE_MAX_REDIRECTS=Math.max(0,Math.min(5,Number(process.env.EVIDENCE_MAX_REDIRECTS||3)));
const EVIDENCE_PROJECTION_MAX_CHARS=Math.max(2000,Math.min(200000,Number(process.env.EVIDENCE_PROJECTION_MAX_CHARS||100000)));
const EVIDENCE_EXCERPT_MAX_CHARS=Math.max(200,Math.min(4000,Number(process.env.EVIDENCE_EXCERPT_MAX_CHARS||1600)));
const SEARXNG_URL=(process.env.SEARXNG_URL||"").replace(/\/$/,"");
const RESEARCH_MAX_RESULTS=Math.max(1,Math.min(10,Number(process.env.RESEARCH_MAX_RESULTS||5)));
const DOSSIER_SIGNING_PRIVATE_KEY_FILE=(process.env.DOSSIER_SIGNING_PRIVATE_KEY_FILE||"").trim();
const DOSSIER_SIGNING_KEY_LABEL=(process.env.DOSSIER_SIGNING_KEY_LABEL||"local-bridge").trim()||"local-bridge";
const DOSSIER_TRANSPARENCY_LOG_FILE=(process.env.DOSSIER_TRANSPARENCY_LOG_FILE||"").trim();
const RFC3161_TSA_URL=(process.env.RFC3161_TSA_URL||"").trim();
const RFC3161_TSA_CA_FILE=(process.env.RFC3161_TSA_CA_FILE||"").trim();
const RFC3161_OPENSSL_BIN=(process.env.RFC3161_OPENSSL_BIN||"openssl").trim()||"openssl";

const explicitOrigins=(process.env.THINK_TANK_ORIGIN||"")
  .split(",").map(value=>value.trim()).filter(Boolean);

const isAllowedOrigin=(origin)=>{
  if(!origin)return true;
  if(explicitOrigins.includes(origin))return true;
  try{
    const url=new URL(origin);
    return (url.hostname==="localhost"||url.hostname==="127.0.0.1")&&(url.protocol==="http:"||url.protocol==="https:");
  }catch{
    return false;
  }
};

const corsHeaders=(origin)=>({
  "access-control-allow-origin":origin&&isAllowedOrigin(origin)?origin:"null",
  "access-control-allow-methods":"GET,POST,OPTIONS",
  "access-control-allow-headers":"content-type",
  "cache-control":"no-store",
  "content-type":"application/json; charset=utf-8",
  "vary":"origin"
});

const send=(res,status,body,origin)=>{
  res.writeHead(status,corsHeaders(origin));
  res.end(JSON.stringify(body));
};

const readJson=(req)=>new Promise((resolve,reject)=>{
  let size=0;
  let data="";
  req.setEncoding("utf8");
  req.on("data",chunk=>{
    size+=Buffer.byteLength(chunk);
    if(size>MAX_BODY_BYTES){
      reject(new Error("Request body exceeds provider bridge limit."));
      req.destroy();
      return;
    }
    data+=chunk;
  });
  req.on("end",()=>{
    try{resolve(data?JSON.parse(data):{});}
    catch{reject(new Error("Invalid JSON request body."));}
  });
  req.on("error",reject);
});

const bridgeError=(message,status=500)=>{
  const error=new Error(message);
  error.status=status;
  return error;
};

export const stableCanonicalJson=(value)=>{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stableCanonicalJson).join(",")+"]";
  return "{"+Object.keys(value).sort()
    .map(key=>JSON.stringify(key)+":"+stableCanonicalJson(value[key]))
    .join(",")+"}";
};

export const dossierDigestSha256=(dossier)=>
  createHash("sha256").update(stableCanonicalJson(dossier),"utf8").digest("hex");

const publicKeyFingerprint=(publicKey)=>{
  const der=publicKey.export({type:"spki",format:"der"});
  return createHash("sha256").update(der).digest("hex");
};

export const sealEnvelopeFor=(seal)=>({
  schemaVersion:1,
  dossierId:seal.dossierId,
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  digestSha256:seal.digestSha256,
  publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
  signedAt:seal.signedAt,
  signerLabel:seal.signerLabel,
  trust:"self-attested-local-key"
});

export const sealDossierWithPrivateKey=(dossier,privateKeyPem,signerLabel="local-bridge",signedAt=new Date().toISOString())=>{
  if(!dossier||typeof dossier!=="object"||typeof dossier.id!=="string"||!dossier.id.trim()){
    throw bridgeError("Dossier seal requires a canonical dossier with an id.",400);
  }
  if(Number.isNaN(Date.parse(signedAt))){
    throw bridgeError("Dossier seal timestamp is invalid.",400);
  }

  let privateKey;
  try{privateKey=createPrivateKey(privateKeyPem);}
  catch{throw bridgeError("Dossier signing private key could not be parsed.",500);}
  if(privateKey.asymmetricKeyType!=="ed25519"){
    throw bridgeError("Dossier signing key must be Ed25519.",500);
  }

  const publicKey=createPublicKey(privateKey);
  const publicKeyPem=publicKey.export({type:"spki",format:"pem"}).toString();
  const keyFingerprint=publicKeyFingerprint(publicKey);
  const digestSha256=dossierDigestSha256(dossier);

  const unsigned={
    id:"SEAL-"+dossier.id+"-"+keyFingerprint.slice(0,12),
    dossierId:dossier.id,
    tool:"ed25519-dossier-sealer",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    digestSha256,
    publicKeyPem,
    publicKeyFingerprintSha256:keyFingerprint,
    signedAt,
    signerLabel,
    trust:"self-attested-local-key"
  };
  const envelope=sealEnvelopeFor(unsigned);
  const signatureBase64=cryptoSign(
    null,
    Buffer.from(stableCanonicalJson(envelope),"utf8"),
    privateKey
  ).toString("base64");

  return {...unsigned,signatureBase64};
};

export const verifyDossierSealReceipt=(dossier,seal)=>{
  if(!dossier||typeof dossier!=="object"||!seal||typeof seal!=="object"){
    throw bridgeError("Dossier verification requires dossier and seal objects.",400);
  }
  if(
    seal.tool!=="ed25519-dossier-sealer"||
    seal.algorithm!=="Ed25519"||
    seal.canonicalization!=="json-stable-v1"||
    seal.trust!=="self-attested-local-key"
  ){
    throw bridgeError("Dossier seal metadata is not supported.",400);
  }
  if(dossier.id!==seal.dossierId){
    throw bridgeError("Dossier id does not match seal receipt.",400);
  }
  if(dossierDigestSha256(dossier)!==seal.digestSha256){
    return {verified:false,reason:"Dossier SHA-256 does not match the seal receipt."};
  }

  let publicKey;
  try{publicKey=createPublicKey(seal.publicKeyPem);}
  catch{throw bridgeError("Dossier seal public key could not be parsed.",400);}
  if(publicKey.asymmetricKeyType!=="ed25519"){
    throw bridgeError("Dossier seal public key must be Ed25519.",400);
  }
  if(publicKeyFingerprint(publicKey)!==seal.publicKeyFingerprintSha256){
    return {verified:false,reason:"Public key fingerprint does not match the seal receipt."};
  }

  let signature;
  try{signature=Buffer.from(seal.signatureBase64,"base64");}
  catch{throw bridgeError("Dossier signature encoding is invalid.",400);}
  const verified=cryptoVerify(
    null,
    Buffer.from(stableCanonicalJson(sealEnvelopeFor(seal)),"utf8"),
    publicKey,
    signature
  );
  return {
    verified,
    reason:verified?"Ed25519 signature verified.":"Ed25519 signature verification failed."
  };
};

const loadConfiguredDossierSigner=()=>{
  if(!DOSSIER_SIGNING_PRIVATE_KEY_FILE)return null;
  let privateKeyPem;
  try{privateKeyPem=readFileSync(resolve(DOSSIER_SIGNING_PRIVATE_KEY_FILE),"utf8");}
  catch{throw bridgeError("Configured dossier signing key file could not be read.",500);}
  let privateKey;
  try{privateKey=createPrivateKey(privateKeyPem);}
  catch{throw bridgeError("Configured dossier signing key could not be parsed.",500);}
  if(privateKey.asymmetricKeyType!=="ed25519"){
    throw bridgeError("Configured dossier signing key must be Ed25519.",500);
  }
  const publicKey=createPublicKey(privateKey);
  return {
    privateKeyPem,
    signerLabel:DOSSIER_SIGNING_KEY_LABEL,
    publicKeyFingerprintSha256:publicKeyFingerprint(publicKey)
  };
};

const dossierSignerStatus=()=>{
  if(!DOSSIER_SIGNING_PRIVATE_KEY_FILE){
    return {
      ok:true,
      state:"disabled",
      algorithm:"Ed25519",
      canonicalization:"json-stable-v1",
      keyFingerprint:null,
      signerLabel:null,
      trust:"self-attested-local-key",
      detail:"Set DOSSIER_SIGNING_PRIVATE_KEY_FILE to enable dossier sealing."
    };
  }
  const signer=loadConfiguredDossierSigner();
  return {
    ok:true,
    state:"configured",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    keyFingerprint:signer.publicKeyFingerprintSha256,
    signerLabel:signer.signerLabel,
    trust:"self-attested-local-key",
    detail:"Persistent local Ed25519 dossier signer is configured."
  };
};



const ZERO_SHA256="0".repeat(64);

const transparencySealFields=(seal)=>{
  if(
    !seal||
    typeof seal!=="object"||
    typeof seal.id!=="string"||
    !seal.id.trim()||
    typeof seal.dossierId!=="string"||
    !seal.dossierId.trim()||
    !/^[a-f0-9]{64}$/.test(seal.digestSha256||"")||
    !/^[a-f0-9]{64}$/.test(seal.publicKeyFingerprintSha256||"")
  ){
    throw bridgeError("Transparency journal requires a complete dossier seal receipt.",400);
  }
  return {
    sealId:seal.id,
    dossierId:seal.dossierId,
    dossierSha256:seal.digestSha256,
    publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256
  };
};

export const buildDossierTransparencyReceipt=(
  seal,
  sequence,
  previousEntrySha256,
  loggedAt=new Date().toISOString()
)=>{
  const linked=transparencySealFields(seal);
  if(!Number.isInteger(sequence)||sequence<1){
    throw bridgeError("Transparency journal sequence must be a positive integer.",400);
  }
  if(!/^[a-f0-9]{64}$/.test(previousEntrySha256||"")){
    throw bridgeError("Transparency journal previous-entry digest is invalid.",400);
  }
  if(Number.isNaN(Date.parse(loggedAt))){
    throw bridgeError("Transparency journal timestamp is invalid.",400);
  }

  const basis={
    schemaVersion:1,
    ...linked,
    tool:"sha256-dossier-transparency-journal",
    canonicalization:"json-stable-v1",
    sequence,
    previousEntrySha256,
    loggedAt,
    clock:"untrusted-local-clock",
    trust:"tamper-evident-local-journal",
    journalVerifiedAtAppend:true
  };
  const entrySha256=createHash("sha256")
    .update(stableCanonicalJson(basis),"utf8")
    .digest("hex");

  return {
    id:"TLOG-"+String(sequence).padStart(6,"0")+"-"+entrySha256.slice(0,12),
    dossierId:linked.dossierId,
    sealId:linked.sealId,
    tool:"sha256-dossier-transparency-journal",
    canonicalization:"json-stable-v1",
    sequence,
    previousEntrySha256,
    entrySha256,
    dossierSha256:linked.dossierSha256,
    publicKeyFingerprintSha256:linked.publicKeyFingerprintSha256,
    loggedAt,
    clock:"untrusted-local-clock",
    trust:"tamper-evident-local-journal",
    journalVerifiedAtAppend:true
  };
};

export const verifyDossierTransparencyEntries=(entries)=>{
  if(!Array.isArray(entries)){
    return {verified:false,entryCount:0,headSha256:null,headEntryId:null,reason:"Journal is not an array."};
  }

  let previous=ZERO_SHA256;
  const seals=new Set();

  for(let index=0;index<entries.length;index++){
    const entry=entries[index];
    if(!entry||typeof entry!=="object"){
      return {verified:false,entryCount:entries.length,headSha256:null,headEntryId:null,reason:"Journal entry is not an object."};
    }
    if(entry.sequence!==index+1){
      return {verified:false,entryCount:entries.length,headSha256:null,headEntryId:null,reason:"Journal sequence is discontinuous."};
    }
    if(entry.previousEntrySha256!==previous){
      return {verified:false,entryCount:entries.length,headSha256:null,headEntryId:null,reason:"Journal hash chain is broken."};
    }
    if(seals.has(entry.sealId)){
      return {verified:false,entryCount:entries.length,headSha256:null,headEntryId:null,reason:"Journal contains a duplicate dossier seal."};
    }

    let expected;
    try{
      expected=buildDossierTransparencyReceipt(
        {
          id:entry.sealId,
          dossierId:entry.dossierId,
          digestSha256:entry.dossierSha256,
          publicKeyFingerprintSha256:entry.publicKeyFingerprintSha256
        },
        entry.sequence,
        entry.previousEntrySha256,
        entry.loggedAt
      );
    }catch(error){
      return {
        verified:false,
        entryCount:entries.length,
        headSha256:null,
        headEntryId:null,
        reason:error instanceof Error?error.message:String(error)
      };
    }

    if(stableCanonicalJson(entry)!==stableCanonicalJson(expected)){
      return {verified:false,entryCount:entries.length,headSha256:null,headEntryId:null,reason:"Journal entry digest or metadata is invalid."};
    }

    seals.add(entry.sealId);
    previous=entry.entrySha256;
  }

  const head=entries[entries.length-1]||null;
  return {
    verified:true,
    entryCount:entries.length,
    headSha256:head?.entrySha256??ZERO_SHA256,
    headEntryId:head?.id??null,
    reason:entries.length
      ?"SHA-256 transparency journal chain verified."
      :"Transparency journal is empty."
  };
};

const transparencyJournalPath=()=>DOSSIER_TRANSPARENCY_LOG_FILE
  ?resolve(DOSSIER_TRANSPARENCY_LOG_FILE)
  :null;

const readTransparencyJournal=(file)=>{
  if(!existsSync(file))return [];
  const text=readFileSync(file,"utf8");
  if(!text.trim())return [];
  return text.split(/\r?\n/)
    .filter(line=>line.trim())
    .map((line,index)=>{
      try{return JSON.parse(line);}
      catch{throw bridgeError("Transparency journal contains invalid JSON at line "+(index+1)+".",409);}
    });
};

const transparencyJournalStatus=()=>{
  const file=transparencyJournalPath();
  if(!file){
    return {
      ok:true,
      state:"disabled",
      entryCount:0,
      headSha256:null,
      headEntryId:null,
      clock:"untrusted-local-clock",
      trust:"tamper-evident-local-journal",
      detail:"Set DOSSIER_TRANSPARENCY_LOG_FILE to enable the local transparency journal."
    };
  }

  try{
    const verification=verifyDossierTransparencyEntries(readTransparencyJournal(file));
    return {
      ok:true,
      state:verification.verified?"ready":"corrupt",
      entryCount:verification.entryCount,
      headSha256:verification.headSha256,
      headEntryId:verification.headEntryId,
      clock:"untrusted-local-clock",
      trust:"tamper-evident-local-journal",
      detail:verification.reason
    };
  }catch(error){
    return {
      ok:true,
      state:"corrupt",
      entryCount:0,
      headSha256:null,
      headEntryId:null,
      clock:"untrusted-local-clock",
      trust:"tamper-evident-local-journal",
      detail:error instanceof Error?error.message:String(error)
    };
  }
};

const appendDossierTransparencyReceipt=(seal)=>{
  const file=transparencyJournalPath();
  if(!file)throw bridgeError("Transparency journal is disabled.",503);

  const entries=readTransparencyJournal(file);
  const before=verifyDossierTransparencyEntries(entries);
  if(!before.verified){
    throw bridgeError("Transparency journal failed integrity verification before append: "+before.reason,409);
  }
  if(entries.some(entry=>entry.sealId===seal?.id)){
    throw bridgeError("This dossier seal is already present in the transparency journal.",409);
  }

  const receipt=buildDossierTransparencyReceipt(
    seal,
    entries.length+1,
    entries.length?entries[entries.length-1].entrySha256:ZERO_SHA256
  );

  mkdirSync(dirname(file),{recursive:true});
  appendFileSync(file,JSON.stringify(receipt)+"\n",{encoding:"utf8",mode:0o600});

  const after=verifyDossierTransparencyEntries(readTransparencyJournal(file));
  if(!after.verified||after.headSha256!==receipt.entrySha256){
    throw bridgeError("Transparency journal failed integrity verification after append.",500);
  }
  return receipt;
};


const checkpointBasisFor=(checkpoint)=>({
  schemaVersion:1,
  tool:"sha256-transparency-checkpoint",
  canonicalization:"json-stable-v1",
  entryCount:checkpoint.entryCount,
  headEntryId:checkpoint.headEntryId,
  headSha256:checkpoint.headSha256,
  createdAt:checkpoint.createdAt,
  clock:"untrusted-local-clock",
  trust:"portable-local-checkpoint"
});

export const transparencyCheckpointDigestSha256=(checkpoint)=>
  createHash("sha256")
    .update(stableCanonicalJson(checkpointBasisFor(checkpoint)),"utf8")
    .digest("hex");

const assertTransparencyCheckpoint=(checkpoint)=>{
  if(
    !checkpoint||
    typeof checkpoint!=="object"||
    checkpoint.tool!=="sha256-transparency-checkpoint"||
    checkpoint.canonicalization!=="json-stable-v1"||
    checkpoint.clock!=="untrusted-local-clock"||
    checkpoint.trust!=="portable-local-checkpoint"||
    !Number.isInteger(checkpoint.entryCount)||
    checkpoint.entryCount<1||
    typeof checkpoint.headEntryId!=="string"||
    !checkpoint.headEntryId.trim()||
    !/^[a-f0-9]{64}$/.test(checkpoint.headSha256||"")||
    !/^[a-f0-9]{64}$/.test(checkpoint.checkpointSha256||"")||
    Number.isNaN(Date.parse(checkpoint.createdAt||""))
  ){
    throw bridgeError("Transparency checkpoint is incomplete or malformed.",400);
  }
  const digest=transparencyCheckpointDigestSha256(checkpoint);
  const expectedId=
    "CHK-"+String(checkpoint.entryCount).padStart(6,"0")+"-"+digest.slice(0,12);
  if(checkpoint.checkpointSha256!==digest||checkpoint.id!==expectedId){
    throw bridgeError("Transparency checkpoint digest or id is invalid.",400);
  }
  return checkpoint;
};

export const buildTransparencyCheckpoint=(entries,createdAt=new Date().toISOString())=>{
  if(Number.isNaN(Date.parse(createdAt))){
    throw bridgeError("Transparency checkpoint timestamp is invalid.",400);
  }
  const verification=verifyDossierTransparencyEntries(entries);
  if(!verification.verified){
    throw bridgeError("Cannot checkpoint an invalid transparency journal: "+verification.reason,409);
  }
  if(verification.entryCount<1||!verification.headEntryId){
    throw bridgeError("Cannot checkpoint an empty transparency journal.",409);
  }

  const basis={
    schemaVersion:1,
    tool:"sha256-transparency-checkpoint",
    canonicalization:"json-stable-v1",
    entryCount:verification.entryCount,
    headEntryId:verification.headEntryId,
    headSha256:verification.headSha256,
    createdAt,
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };
  const checkpointSha256=createHash("sha256")
    .update(stableCanonicalJson(basis),"utf8")
    .digest("hex");

  return {
    id:"CHK-"+String(verification.entryCount).padStart(6,"0")+"-"+checkpointSha256.slice(0,12),
    tool:"sha256-transparency-checkpoint",
    canonicalization:"json-stable-v1",
    entryCount:verification.entryCount,
    headEntryId:verification.headEntryId,
    headSha256:verification.headSha256,
    checkpointSha256,
    createdAt,
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };
};

export const witnessEnvelopeFor=(witness)=>({
  schemaVersion:1,
  checkpointId:witness.checkpointId,
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  checkpointSha256:witness.checkpointSha256,
  publicKeyFingerprintSha256:witness.publicKeyFingerprintSha256,
  witnessedAt:witness.witnessedAt,
  witnessLabel:witness.witnessLabel,
  trust:"self-attested-external-witness-key"
});

export const signTransparencyCheckpointWithPrivateKey=(
  checkpoint,
  privateKeyPem,
  witnessLabel="external-witness",
  witnessedAt=new Date().toISOString()
)=>{
  assertTransparencyCheckpoint(checkpoint);
  if(Number.isNaN(Date.parse(witnessedAt))){
    throw bridgeError("Witness timestamp is invalid.",400);
  }
  if(typeof witnessLabel!=="string"||!witnessLabel.trim()){
    throw bridgeError("Witness label is required.",400);
  }

  let privateKey;
  try{privateKey=createPrivateKey(privateKeyPem);}
  catch{throw bridgeError("Witness private key could not be parsed.",400);}
  if(privateKey.asymmetricKeyType!=="ed25519"){
    throw bridgeError("Witness private key must be Ed25519.",400);
  }

  const publicKey=createPublicKey(privateKey);
  const publicKeyPem=publicKey.export({type:"spki",format:"pem"}).toString();
  const keyFingerprint=publicKeyFingerprint(publicKey);
  const unsigned={
    id:"WIT-"+checkpoint.id+"-"+keyFingerprint.slice(0,12),
    checkpointId:checkpoint.id,
    tool:"ed25519-transparency-witness",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    checkpointSha256:checkpoint.checkpointSha256,
    publicKeyPem,
    publicKeyFingerprintSha256:keyFingerprint,
    witnessedAt,
    witnessLabel:witnessLabel.trim(),
    trust:"self-attested-external-witness-key"
  };
  const signatureBase64=cryptoSign(
    null,
    Buffer.from(stableCanonicalJson(witnessEnvelopeFor(unsigned)),"utf8"),
    privateKey
  ).toString("base64");

  return {...unsigned,signatureBase64};
};

export const verifyTransparencyWitnessReceipt=(checkpoint,witness)=>{
  assertTransparencyCheckpoint(checkpoint);
  if(!witness||typeof witness!=="object"){
    throw bridgeError("Detached witness verification requires a witness receipt.",400);
  }
  if(
    witness.tool!=="ed25519-transparency-witness"||
    witness.algorithm!=="Ed25519"||
    witness.canonicalization!=="json-stable-v1"||
    witness.trust!=="self-attested-external-witness-key"||
    witness.checkpointId!==checkpoint.id||
    witness.checkpointSha256!==checkpoint.checkpointSha256||
    !/^[a-f0-9]{64}$/.test(witness.publicKeyFingerprintSha256||"")||
    typeof witness.signatureBase64!=="string"||
    !witness.signatureBase64.trim()||
    typeof witness.witnessLabel!=="string"||
    !witness.witnessLabel.trim()||
    Number.isNaN(Date.parse(witness.witnessedAt||""))
  ){
    throw bridgeError("Detached witness receipt is incomplete or unsupported.",400);
  }

  const expectedId=
    "WIT-"+checkpoint.id+"-"+witness.publicKeyFingerprintSha256.slice(0,12);
  if(witness.id!==expectedId){
    throw bridgeError("Detached witness id does not match its checkpoint/key fingerprint.",400);
  }

  let publicKey;
  try{publicKey=createPublicKey(witness.publicKeyPem);}
  catch{throw bridgeError("Witness public key could not be parsed.",400);}
  if(publicKey.asymmetricKeyType!=="ed25519"){
    throw bridgeError("Witness public key must be Ed25519.",400);
  }
  if(publicKeyFingerprint(publicKey)!==witness.publicKeyFingerprintSha256){
    return {verified:false,reason:"Witness public-key fingerprint does not match the receipt."};
  }

  let signature;
  try{signature=Buffer.from(witness.signatureBase64,"base64");}
  catch{throw bridgeError("Witness signature encoding is invalid.",400);}

  const verified=cryptoVerify(
    null,
    Buffer.from(stableCanonicalJson(witnessEnvelopeFor(witness)),"utf8"),
    publicKey,
    signature
  );
  return {
    verified,
    reason:verified
      ?"Detached Ed25519 witness signature verified."
      :"Detached witness signature verification failed."
  };
};

const buildCurrentTransparencyCheckpoint=()=>{
  const file=transparencyJournalPath();
  if(!file)throw bridgeError("Transparency journal is disabled.",503);
  return buildTransparencyCheckpoint(readTransparencyJournal(file));
};


const rfc3161TrustAnchorSha256=()=>{
  if(!RFC3161_TSA_CA_FILE)return null;
  const file=resolve(RFC3161_TSA_CA_FILE);
  if(!existsSync(file))return null;
  return createHash("sha256").update(readFileSync(file)).digest("hex");
};

const assertRfc3161AuthorityUrl=(value)=>{
  let url;
  try{url=new URL(value);}
  catch{throw bridgeError("RFC3161 TSA URL is invalid.",500);}
  if(url.protocol!=="https:"&&url.protocol!=="http:"){
    throw bridgeError("RFC3161 TSA URL must use HTTP or HTTPS.",500);
  }
  if(url.username||url.password){
    throw bridgeError("RFC3161 TSA URL must not contain embedded credentials.",500);
  }
  return url.toString();
};

export const parseRfc3161ReplyText=(text)=>{
  if(typeof text!=="string"||!text.trim()){
    throw bridgeError("RFC3161 reply text is empty.",500);
  }
  const field=(label)=>{
    const match=text.match(new RegExp("^"+label+":\\s*(.+)$","mi"));
    return match?.[1]?.trim()||"";
  };
  const tsaPolicyOid=field("Policy OID");
  const tsaSerialNumber=field("Serial number");
  const rawTime=field("Time stamp");
  const tsaSubject=field("TSA")||"UNSPECIFIED";
  if(!tsaPolicyOid||!tsaSerialNumber||!rawTime){
    throw bridgeError("RFC3161 reply is missing policy, serial, or timestamp fields.",500);
  }
  const millis=Date.parse(rawTime);
  if(Number.isNaN(millis)){
    throw bridgeError("RFC3161 reply timestamp could not be parsed.",500);
  }
  return {
    tsaPolicyOid,
    tsaSerialNumber,
    genTime:new Date(millis).toISOString(),
    tsaSubject
  };
};

export const buildRfc3161TimestampReceipt=({
  checkpoint,
  tokenBytes,
  metadata,
  authorityUrl,
  trustAnchorSha256,
  verifiedAt=new Date().toISOString()
})=>{
  assertTransparencyCheckpoint(checkpoint);
  const token=Buffer.isBuffer(tokenBytes)?tokenBytes:Buffer.from(tokenBytes||[]);
  if(token.length<1)throw bridgeError("RFC3161 timestamp token is empty.",500);
  if(!metadata?.tsaPolicyOid||!metadata?.tsaSerialNumber||!metadata?.tsaSubject){
    throw bridgeError("RFC3161 timestamp metadata is incomplete.",500);
  }
  if(Number.isNaN(Date.parse(metadata.genTime||""))||Number.isNaN(Date.parse(verifiedAt))){
    throw bridgeError("RFC3161 timestamp dates are invalid.",500);
  }
  if(!/^[a-f0-9]{64}$/.test(trustAnchorSha256||"")){
    throw bridgeError("RFC3161 trust-anchor digest is invalid.",500);
  }
  const normalizedAuthority=assertRfc3161AuthorityUrl(authorityUrl);
  const tokenSha256=createHash("sha256").update(token).digest("hex");
  return {
    id:"TSA-"+checkpoint.id+"-"+tokenSha256.slice(0,12),
    checkpointId:checkpoint.id,
    tool:"rfc3161-timestamp-verifier",
    standard:"RFC3161",
    hashAlgorithm:"SHA-256",
    checkpointSha256:checkpoint.checkpointSha256,
    tokenSha256,
    tokenBase64:token.toString("base64"),
    tsaPolicyOid:metadata.tsaPolicyOid,
    tsaSerialNumber:metadata.tsaSerialNumber,
    genTime:metadata.genTime,
    tsaSubject:metadata.tsaSubject,
    authorityUrl:normalizedAuthority,
    trustAnchorSha256,
    verifiedAt,
    trust:"configured-rfc3161-trust-anchor"
  };
};

const rfc3161Status=()=>{
  if(!RFC3161_TSA_URL||!RFC3161_TSA_CA_FILE){
    return {
      ok:true,
      state:"disabled",
      standard:"RFC3161",
      hashAlgorithm:"SHA-256",
      authorityUrl:RFC3161_TSA_URL||null,
      trustAnchorSha256:null,
      openssl:null,
      detail:"Set RFC3161_TSA_URL and RFC3161_TSA_CA_FILE to enable trusted timestamp verification."
    };
  }

  let authorityUrl;
  try{authorityUrl=assertRfc3161AuthorityUrl(RFC3161_TSA_URL);}
  catch(error){
    return {
      ok:true,state:"error",standard:"RFC3161",hashAlgorithm:"SHA-256",
      authorityUrl:RFC3161_TSA_URL,trustAnchorSha256:null,openssl:null,
      detail:error instanceof Error?error.message:String(error)
    };
  }

  const caFile=resolve(RFC3161_TSA_CA_FILE);
  if(!existsSync(caFile)){
    return {
      ok:true,state:"error",standard:"RFC3161",hashAlgorithm:"SHA-256",
      authorityUrl,trustAnchorSha256:null,openssl:null,
      detail:"Configured RFC3161 trust-anchor file does not exist."
    };
  }

  let openssl;
  try{
    openssl=execFileSync(
      RFC3161_OPENSSL_BIN,
      ["version"],
      {encoding:"utf8",timeout:3000,stdio:["ignore","pipe","pipe"]}
    ).trim();
  }catch{
    return {
      ok:true,state:"error",standard:"RFC3161",hashAlgorithm:"SHA-256",
      authorityUrl,trustAnchorSha256:rfc3161TrustAnchorSha256(),openssl:null,
      detail:"OpenSSL executable is unavailable for RFC3161 verification."
    };
  }

  return {
    ok:true,
    state:"configured",
    standard:"RFC3161",
    hashAlgorithm:"SHA-256",
    authorityUrl,
    trustAnchorSha256:rfc3161TrustAnchorSha256(),
    openssl,
    detail:"RFC3161 TSA and configured trust anchor are ready."
  };
};

const requestRfc3161Timestamp=async(checkpoint)=>{
  assertTransparencyCheckpoint(checkpoint);
  const status=rfc3161Status();
  if(status.state!=="configured"){
    throw bridgeError("RFC3161 timestamp adapter is not configured: "+status.detail,503);
  }

  const work=mkdtempSync(join(tmpdir(),"phi-think-tank-rfc3161-"));
  const queryPath=join(work,"request.tsq");
  const replyPath=join(work,"reply.tsr");

  try{
    try{
      execFileSync(
        RFC3161_OPENSSL_BIN,
        [
          "ts","-query",
          "-digest",checkpoint.checkpointSha256,
          "-sha256",
          "-cert",
          "-out",queryPath
        ],
        {timeout:10000,stdio:["ignore","pipe","pipe"]}
      );
    }catch(error){
      throw bridgeError(
        "OpenSSL failed to build RFC3161 timestamp query: "+
        (error?.stderr?.toString?.().trim()||error?.message||String(error)),
        500
      );
    }

    const queryBytes=readFileSync(queryPath);
    let response;
    try{
      response=await fetch(status.authorityUrl,{
        method:"POST",
        headers:{
          "content-type":"application/timestamp-query",
          "accept":"application/timestamp-reply"
        },
        body:queryBytes,
        signal:AbortSignal.timeout(30000)
      });
    }catch(error){
      throw bridgeError(
        "RFC3161 TSA request failed: "+(error instanceof Error?error.message:String(error)),
        502
      );
    }

    if(!response.ok){
      throw bridgeError("RFC3161 TSA returned HTTP "+response.status+".",502);
    }
    const tokenBytes=Buffer.from(await response.arrayBuffer());
    if(tokenBytes.length<1||tokenBytes.length>1_000_000){
      throw bridgeError("RFC3161 TSA response size is invalid.",502);
    }
    writeFileSync(replyPath,tokenBytes,{mode:0o600});

    try{
      execFileSync(
        RFC3161_OPENSSL_BIN,
        [
          "ts","-verify",
          "-queryfile",queryPath,
          "-in",replyPath,
          "-CAfile",resolve(RFC3161_TSA_CA_FILE)
        ],
        {timeout:10000,stdio:["ignore","pipe","pipe"]}
      );
    }catch(error){
      throw bridgeError(
        "RFC3161 token verification failed: "+
        (error?.stderr?.toString?.().trim()||error?.message||String(error)),
        409
      );
    }

    let replyText;
    try{
      replyText=execFileSync(
        RFC3161_OPENSSL_BIN,
        ["ts","-reply","-in",replyPath,"-text"],
        {encoding:"utf8",timeout:10000,stdio:["ignore","pipe","pipe"]}
      );
    }catch(error){
      throw bridgeError(
        "OpenSSL could not inspect verified RFC3161 token: "+
        (error?.stderr?.toString?.().trim()||error?.message||String(error)),
        500
      );
    }

    const metadata=parseRfc3161ReplyText(replyText);
    return buildRfc3161TimestampReceipt({
      checkpoint,
      tokenBytes,
      metadata,
      authorityUrl:status.authorityUrl,
      trustAnchorSha256:status.trustAnchorSha256
    });
  }finally{
    rmSync(work,{recursive:true,force:true});
  }
};

export const normalizeMessages=(raw)=>{
  if(!Array.isArray(raw)||raw.length===0)throw bridgeError("Provider messages must be a non-empty array.",400);
  if(raw.length>24)throw bridgeError("Provider message count exceeds the bridge limit.",400);

  let total=0;
  return raw.map((item,index)=>{
    if(!item||!["system","user","assistant"].includes(item.role)){
      throw bridgeError("Provider message "+index+" has an invalid role.",400);
    }
    if(typeof item.content!=="string"||!item.content.trim()){
      throw bridgeError("Provider message "+index+" requires text content.",400);
    }
    const content=item.content.trim();
    total+=content.length;
    if(total>60_000)throw bridgeError("Provider message content exceeds the bridge limit.",400);
    return {role:item.role,content};
  });
};

export const fetchJson=async(url,init={},timeoutMs=5000)=>{
  let response;
  try{
    response=await fetch(url,{...init,signal:init.signal||AbortSignal.timeout(timeoutMs)});
  }catch(error){
    throw bridgeError("Upstream request failed: "+(error instanceof Error?error.message:String(error)),502);
  }

  const text=await response.text();
  let body={};
  if(text){
    try{body=JSON.parse(text);}
    catch{throw bridgeError("Upstream returned non-JSON content.",502);}
  }

  if(!response.ok){
    const message=
      body?.error?.message||
      body?.message||
      ("Upstream returned HTTP "+response.status+".");
    throw bridgeError(message,response.status);
  }

  return {body,response};
};

export const normalizeSearchResults=(raw,maxResults=RESEARCH_MAX_RESULTS)=>{
  const source=Array.isArray(raw?.results)?raw.results:[];
  const seen=new Set();
  const results=[];

  for(const item of source){
    if(results.length>=maxResults)break;
    const rawUri=typeof item?.url==="string"?item.url.trim():"";
    const title=typeof item?.title==="string"?item.title.trim():"";
    if(!rawUri||!title)continue;

    let url;
    try{url=new URL(rawUri);}catch{continue;}
    if((url.protocol!=="http:"&&url.protocol!=="https:")||url.username||url.password)continue;
    if(url.protocol==="http:"&&url.port&&url.port!=="80")continue;
    if(url.protocol==="https:"&&url.port&&url.port!=="443")continue;

    const uri=url.toString();
    if(seen.has(uri))continue;
    seen.add(uri);

    const engine=
      typeof item?.engine==="string"&&item.engine.trim()
        ?item.engine.trim()
        :Array.isArray(item?.engines)&&typeof item.engines[0]==="string"
          ?item.engines[0]
          :"searxng";

    const snippet=typeof item?.content==="string"
      ?item.content.trim().slice(0,800)
      :"";

    results.push({
      title:title.slice(0,400),
      uri,
      snippet,
      engine:String(engine).slice(0,120),
      rank:results.length+1
    });
  }

  return results;
};

export const buildSearxngSearchUrl=(base,query)=>{
  if(!base)throw bridgeError("SearXNG research backend is not configured.",503);
  const url=new URL(base.replace(/\/$/,"")+"/search");
  url.searchParams.set("q",query);
  url.searchParams.set("format","json");
  url.searchParams.set("safesearch","1");
  return url.toString();
};

const searchSearxng=async(query)=>{
  if(!SEARXNG_URL)throw bridgeError("SearXNG research backend is not configured. Set SEARXNG_URL.",503);
  const normalizedQuery=query.trim();
  if(!normalizedQuery)throw bridgeError("Research search requires a query.",400);
  if(normalizedQuery.length>300)throw bridgeError("Research query exceeds the 300 character limit.",400);

  const {body}=await fetchJson(
    buildSearxngSearchUrl(SEARXNG_URL,normalizedQuery),
    {headers:{"accept":"application/json","user-agent":"PhiThinkTank-Research/0.1"}},
    20_000
  );

  const results=normalizeSearchResults(body,RESEARCH_MAX_RESULTS);
  const searchedAt=new Date().toISOString();
  const resultDigest=createHash("sha256").update(JSON.stringify(results)).digest("hex");

  return {
    ok:true,
    tool:"searxng-search",
    provider:"searxng",
    query:normalizedQuery,
    searchedAt,
    resultDigest,
    results
  };
};


export const isBlockedIpv4=(address)=>{
  const parts=address.split(".").map(Number);
  if(parts.length!==4||parts.some(value=>!Number.isInteger(value)||value<0||value>255))return true;
  const [a,b]=parts;
  return (
    a===0||
    a===10||
    a===127||
    (a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||
    (a===172&&b>=16&&b<=31)||
    (a===192&&b===168)||
    (a===198&&(b===18||b===19))||
    a>=224
  );
};

export const isBlockedIpv6=(address)=>{
  const value=address.toLowerCase();
  if(value==="::"||value==="::1")return true;
  if(value.startsWith("fe8")||value.startsWith("fe9")||value.startsWith("fea")||value.startsWith("feb"))return true;
  if(value.startsWith("fc")||value.startsWith("fd")||value.startsWith("ff"))return true;
  if(value.startsWith("::ffff:")){
    const mapped=value.slice(7);
    return isIP(mapped)===4?isBlockedIpv4(mapped):true;
  }
  return false;
};

export const assertPublicHttpUrl=async(raw)=>{
  let url;
  try{url=new URL(raw);}catch{throw new Error("Evidence URI must be a valid absolute URL.");}
  if(url.protocol!=="https:"&&url.protocol!=="http:")throw new Error("Evidence URI must use http or https.");
  if(url.username||url.password)throw new Error("Evidence URI must not contain credentials.");
  if(url.protocol==="http:"&&url.port&&url.port!=="80")throw new Error("HTTP evidence URI may only use port 80.");
  if(url.protocol==="https:"&&url.port&&url.port!=="443")throw new Error("HTTPS evidence URI may only use port 443.");

  const rawHost=url.hostname.startsWith("[")&&url.hostname.endsWith("]")
    ?url.hostname.slice(1,-1)
    :url.hostname;
  const direct=isIP(rawHost);
  const addresses=direct
    ?[{address:rawHost,family:direct}]
    :await lookup(rawHost,{all:true,verbatim:true});

  if(!addresses.length)throw new Error("Evidence host did not resolve.");

  for(const entry of addresses){
    const blocked=entry.family===4?isBlockedIpv4(entry.address):isBlockedIpv6(entry.address);
    if(blocked)throw new Error("Evidence host resolves to a private, local, multicast, or reserved address.");
  }

  return {url,address:addresses[0].address,family:addresses[0].family};
};

const allowedEvidenceType=(contentType)=>{
  const type=(contentType||"").split(";")[0].trim().toLowerCase();
  return (
    type.startsWith("text/")||
    type==="application/json"||
    type==="application/xml"||
    type==="application/xhtml+xml"||
    type==="application/pdf"
  );
};

const requestPinned=({url,address,family},maxBytes)=>new Promise((resolve,reject)=>{
  const transport=url.protocol==="https:"?https:http;
  let settled=false;

  const finishError=(error)=>{
    if(settled)return;
    settled=true;
    reject(error);
  };

  const request=transport.request(url,{
    method:"GET",
    headers:{
      "accept":"text/html,text/plain,application/json,application/xml,application/pdf;q=0.8,*/*;q=0.2",
      "user-agent":"PhiThinkTank-EvidenceVerifier/0.2"
    },
    timeout:20_000,
    servername:url.hostname,
    lookup:(_hostname,_options,callback)=>callback(null,address,family)
  },response=>{
    const chunks=[];
    let total=0;

    response.on("data",chunk=>{
      total+=chunk.length;
      if(total>maxBytes){
        response.destroy(new Error("Evidence response exceeds the configured byte limit."));
        return;
      }
      chunks.push(chunk);
    });

    response.on("end",()=>{
      if(settled)return;
      settled=true;
      resolve({
        status:response.statusCode||0,
        headers:response.headers,
        body:Buffer.concat(chunks,total)
      });
    });

    response.on("error",finishError);
  });

  request.on("timeout",()=>request.destroy(new Error("Evidence retrieval timed out.")));
  request.on("error",finishError);
  request.end();
});

const fetchEvidenceResource=async(requestedUri)=>{
  let target=await assertPublicHttpUrl(requestedUri);
  let redirects=0;

  while(true){
    const response=await requestPinned(target,EVIDENCE_MAX_BYTES);
    const status=response.status;

    if([301,302,303,307,308].includes(status)){
      if(redirects>=EVIDENCE_MAX_REDIRECTS)throw bridgeError("Evidence redirect limit exceeded.",422);
      const location=Array.isArray(response.headers.location)
        ?response.headers.location[0]
        :response.headers.location;
      if(!location)throw bridgeError("Evidence redirect did not include a Location header.",422);
      target=await assertPublicHttpUrl(new URL(location,target.url).toString());
      redirects+=1;
      continue;
    }

    if(status<200||status>=300)throw bridgeError("Evidence fetch returned HTTP "+status+".",502);

    const contentType=String(response.headers["content-type"]||"application/octet-stream");
    if(!allowedEvidenceType(contentType)){
      throw bridgeError("Evidence content type is not allowed: "+contentType+".",415);
    }

    const sha256=createHash("sha256").update(response.body).digest("hex");
    return {
      body:response.body,
      receipt:{
        ok:true,
        tool:"url-fetch",
        requestedUri,
        finalUri:target.url.toString(),
        httpStatus:status,
        contentType,
        bytes:response.body.length,
        sha256,
        redirects,
        retrievedAt:new Date().toISOString()
      }
    };
  }
};

const fetchEvidenceReceipt=async(requestedUri)=>{
  const {receipt}=await fetchEvidenceResource(requestedUri);
  return receipt;
};

const decodeEntities=(value)=>value
  .replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))))
  .replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Math.min(0x10ffff,parseInt(n,16))))
  .replace(/&nbsp;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&lt;/gi,"<")
  .replace(/&gt;/gi,">")
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'");

const normalizeProjectedText=(value)=>value
  .replace(/\r\n?/g,"\n")
  .replace(/[\t\f\v ]+/g," ")
  .replace(/ *\n */g,"\n")
  .replace(/\n{3,}/g,"\n\n")
  .trim();

export const projectEvidenceText=(body,contentType)=>{
  const type=String(contentType||"").split(";")[0].trim().toLowerCase();
  if(type==="application/pdf"){
    throw bridgeError("PDF text projection is not supported in this rung.",415);
  }

  let text=new TextDecoder("utf-8",{fatal:false}).decode(body);

  if(type==="text/html"||type==="application/xhtml+xml"){
    text=text
      .replace(/<!--[\s\S]*?-->/g," ")
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
      .replace(/<\s*br\s*\/?>/gi,"\n")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|table|blockquote)>/gi,"\n")
      .replace(/<[^>]+>/g," ");
    text=decodeEntities(text);
  }else if(type==="application/xml"){
    text=decodeEntities(text.replace(/<[^>]+>/g," "));
  }else if(type==="application/json"){
    try{text=JSON.stringify(JSON.parse(text),null,2);}catch{}
  }else if(!type.startsWith("text/")){
    throw bridgeError("Evidence type cannot be projected as text: "+type+".",415);
  }

  const normalized=normalizeProjectedText(text);
  const totalCharCount=normalized.length;
  const projected=normalized.slice(0,EVIDENCE_PROJECTION_MAX_CHARS);
  return {
    extractor:"text-projection-v1",
    text:projected,
    charCount:projected.length,
    totalCharCount,
    truncated:totalCharCount>projected.length,
    projectionSha256:createHash("sha256").update(projected,"utf8").digest("hex")
  };
};

export const assertEvidenceSourceDigest=(actualSha256,expectedSha256)=>{
  if(typeof expectedSha256!=="string"||!/^[a-f0-9]{64}$/.test(expectedSha256)){
    throw bridgeError("Evidence projection requires the original lowercase SHA-256.",400);
  }
  if(actualSha256!==expectedSha256){
    throw bridgeError("Evidence source bytes changed since machine verification.",409);
  }
};

const extractEvidenceText=async({uri,expectedSha256,startChar,endChar})=>{
  if(typeof uri!=="string"||!uri.trim())throw bridgeError("Evidence projection requires a URI.",400);

  const {body,receipt}=await fetchEvidenceResource(uri.trim());
  assertEvidenceSourceDigest(receipt.sha256,expectedSha256);

  const projection=projectEvidenceText(body,receipt.contentType);
  const base={
    ok:true,
    tool:"text-projector",
    extractor:"text-projection-v1",
    sourceUri:receipt.finalUri,
    sourceSha256:receipt.sha256,
    projectionSha256:projection.projectionSha256,
    contentType:receipt.contentType,
    charCount:projection.charCount,
    totalCharCount:projection.totalCharCount,
    truncated:projection.truncated,
    extractedAt:new Date().toISOString()
  };

  if(startChar===undefined&&endChar===undefined){
    return {...base,text:projection.text};
  }

  if(!Number.isInteger(startChar)||!Number.isInteger(endChar)||
     startChar<0||endChar<=startChar||endChar>projection.text.length||
     endChar-startChar>EVIDENCE_EXCERPT_MAX_CHARS){
    throw bridgeError("Excerpt range is invalid or exceeds the configured limit.",400);
  }

  const text=projection.text.slice(startChar,endChar);
  if(!text.trim())throw bridgeError("Excerpt range contains no meaningful text.",400);

  return {
    ...base,
    startChar,
    endChar,
    text,
    excerptSha256:createHash("sha256").update(text,"utf8").digest("hex")
  };
};

const ollamaStatus=async()=>{
  try{
    const {body}=await fetchJson(OLLAMA_BASE_URL+"/api/tags",{},3500);
    const models=Array.isArray(body.models)
      ?body.models.map(item=>item?.name||item?.model).filter(Boolean)
      :[];
    const preferred=process.env.OLLAMA_MODEL||models[0]||null;
    return {
      seatId:"local",
      provider:"Ollama",
      state:"connected",
      model:preferred,
      models,
      detail:models.length?models.length+" local model(s) discovered.":"Ollama reachable; no local models discovered."
    };
  }catch(error){
    return {
      seatId:"local",
      provider:"Ollama",
      state:"disconnected",
      model:null,
      models:[],
      detail:"Ollama unavailable at "+OLLAMA_BASE_URL+": "+error.message
    };
  }
};

const remoteStatus=(seatId,provider,key,model)=>({
  seatId,
  provider,
  state:key&&model?"configured":"disconnected",
  model:model||null,
  models:model?[model]:[],
  detail:key&&model
    ?"Server-side credentials and model are configured; no billable probe was sent."
    :"Set both the API key and model environment variables in the local bridge."
});

const statusPayload=async()=>({
  ok:true,
  bridgeVersion:"0.8.0",
  seats:[
    await ollamaStatus(),
    remoteStatus("openai","OpenAI",process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL),
    remoteStatus("kimi","Kimi",process.env.KIMI_API_KEY,process.env.KIMI_MODEL)
  ]
});

const extractOpenAIText=(body)=>{
  if(typeof body.output_text==="string"&&body.output_text.trim())return body.output_text.trim();
  const chunks=[];
  for(const item of body.output||[]){
    for(const content of item?.content||[]){
      if(typeof content?.text==="string")chunks.push(content.text);
      else if(typeof content?.output_text==="string")chunks.push(content.output_text);
    }
  }
  return chunks.join("\n").trim();
};

const invokeOllama=async(request)=>{
  const status=await ollamaStatus();
  if(status.state!=="connected")throw new Error(status.detail);
  const model=request.model||process.env.OLLAMA_MODEL||status.model;
  if(!model)throw new Error("No Ollama model is available.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    OLLAMA_BASE_URL+"/api/chat",
    {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({model,messages:request.messages,stream:false,options:{num_predict:MAX_OUTPUT_TOKENS}})
    },
    180_000
  );

  const text=body?.message?.content;
  if(typeof text!=="string"||!text.trim())throw new Error("Ollama returned no assistant text.");

  return {
    ok:true,seatId:"local",provider:"Ollama",model,
    text:text.trim(),latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||undefined
  };
};

const invokeOpenAI=async(request)=>{
  const key=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_MODEL;
  if(!key||!model)throw new Error("OpenAI bridge is not configured. Set OPENAI_API_KEY and OPENAI_MODEL.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    "https://api.openai.com/v1/responses",
    {
      method:"POST",
      headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
      body:JSON.stringify({model,input:request.messages,store:false,max_output_tokens:MAX_OUTPUT_TOKENS})
    },
    180_000
  );
  const text=extractOpenAIText(body);
  if(!text)throw new Error("OpenAI returned no response text.");

  return {
    ok:true,seatId:"openai",provider:"OpenAI",model,
    text,latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||body?.id||undefined
  };
};

const invokeKimi=async(request)=>{
  const key=process.env.KIMI_API_KEY;
  const model=process.env.KIMI_MODEL;
  if(!key||!model)throw new Error("Kimi bridge is not configured. Set KIMI_API_KEY and KIMI_MODEL.");

  const started=Date.now();
  const {body,response}=await fetchJson(
    KIMI_BASE_URL+"/chat/completions",
    {
      method:"POST",
      headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
      body:JSON.stringify({model,messages:request.messages,stream:false,max_tokens:MAX_OUTPUT_TOKENS})
    },
    180_000
  );

  const text=body?.choices?.[0]?.message?.content;
  if(typeof text!=="string"||!text.trim())throw new Error("Kimi returned no assistant text.");

  return {
    ok:true,seatId:"kimi",provider:"Kimi",model,
    text:text.trim(),latencyMs:Date.now()-started,
    requestId:response.headers.get("x-request-id")||body?.id||undefined
  };
};

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(!isAllowedOrigin(origin)){
    send(res,403,{ok:false,error:{code:"ORIGIN_DENIED",message:"Origin is not allowed by the local provider bridge."}},origin);
    return;
  }

  if(req.method==="OPTIONS"){
    res.writeHead(204,corsHeaders(origin));
    res.end();
    return;
  }

  try{
    if(req.method==="GET"&&req.url==="/health"){
      send(res,200,{ok:true,service:"phi-think-tank-provider-bridge",version:"0.8.0"},origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/providers/status"){
      send(res,200,await statusPayload(),origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/dossier/seal/status"){
      send(res,200,dossierSignerStatus(),origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/dossier/seal"){
      const raw=await readJson(req);
      const signer=loadConfiguredDossierSigner();
      if(!signer)throw bridgeError("Dossier sealing is disabled.",503);
      const seal=sealDossierWithPrivateKey(
        raw.dossier,
        signer.privateKeyPem,
        signer.signerLabel
      );
      const selfCheck=verifyDossierSealReceipt(raw.dossier,seal);
      if(!selfCheck.verified)throw bridgeError("Generated dossier seal failed self-verification.",500);
      send(res,200,{ok:true,seal},origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/dossier/verify"){
      const raw=await readJson(req);
      const result=verifyDossierSealReceipt(raw.dossier,raw.seal);
      send(res,200,{
        ok:true,
        verified:result.verified,
        reason:result.reason,
        dossierId:raw.dossier?.id??"",
        sealId:raw.seal?.id??"",
        digestSha256:raw.seal?.digestSha256??"",
        publicKeyFingerprintSha256:raw.seal?.publicKeyFingerprintSha256??"",
        verifiedAt:new Date().toISOString()
      },origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/dossier/transparency/status"){
      send(res,200,transparencyJournalStatus(),origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/dossier/transparency/append"){
      const raw=await readJson(req);
      const entry=appendDossierTransparencyReceipt(raw.seal);
      send(res,200,{ok:true,entry},origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/dossier/transparency/checkpoint"){
      send(res,200,{ok:true,checkpoint:buildCurrentTransparencyCheckpoint()},origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/dossier/witness/verify"){
      const raw=await readJson(req);
      const result=verifyTransparencyWitnessReceipt(raw.checkpoint,raw.witness);
      send(res,200,{
        ok:true,
        verified:result.verified,
        reason:result.reason,
        checkpointId:raw.checkpoint?.id??"",
        witnessId:raw.witness?.id??"",
        checkpointSha256:raw.checkpoint?.checkpointSha256??"",
        publicKeyFingerprintSha256:raw.witness?.publicKeyFingerprintSha256??"",
        verifiedAt:new Date().toISOString()
      },origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/dossier/timestamp/status"){
      send(res,200,rfc3161Status(),origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/dossier/timestamp"){
      const raw=await readJson(req);
      const timestamp=await requestRfc3161Timestamp(raw.checkpoint);
      send(res,200,{ok:true,timestamp},origin);
      return;
    }

    if(req.method==="GET"&&req.url==="/research/status"){
      send(res,200,{
        ok:true,
        provider:"SearXNG",
        state:SEARXNG_URL?"configured":"disabled",
        maxResults:RESEARCH_MAX_RESULTS,
        detail:SEARXNG_URL
          ?"Local/admin-configured SearXNG search adapter is enabled."
          :"Set SEARXNG_URL to enable governed research search."
      },origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/research/search"){
      const raw=await readJson(req);
      if(typeof raw.query!=="string")throw bridgeError("Research search requires a query.",400);
      send(res,200,await searchSearxng(raw.query),origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/evidence/fetch"){
      const raw=await readJson(req);
      if(typeof raw.uri!=="string"||!raw.uri.trim())throw bridgeError("Evidence fetch requires a URI.",400);
      const receipt=await fetchEvidenceReceipt(raw.uri.trim());
      send(res,200,receipt,origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/evidence/extract"){
      const raw=await readJson(req);
      const result=await extractEvidenceText({
        uri:raw.uri,
        expectedSha256:raw.expectedSha256,
        startChar:raw.startChar,
        endChar:raw.endChar
      });
      send(res,200,result,origin);
      return;
    }

    if(req.method==="POST"&&req.url==="/providers/invoke"){
      const raw=await readJson(req);
      if(!["local","openai","kimi"].includes(raw.seatId))throw new Error("Unknown provider seat.");
      if(!["dreamer","builder","challenger","archivist","vessie"].includes(raw.roleId))throw new Error("Unknown cognitive role.");

      const request={
        seatId:raw.seatId,
        roleId:raw.roleId,
        model:typeof raw.model==="string"?raw.model:undefined,
        messages:normalizeMessages(raw.messages)
      };

      const result=request.seatId==="local"
        ?await invokeOllama(request)
        :request.seatId==="openai"
          ?await invokeOpenAI(request)
          :await invokeKimi(request);

      send(res,200,result,origin);
      return;
    }

    send(res,404,{ok:false,error:{code:"NOT_FOUND",message:"Provider bridge route not found."}},origin);
  }catch(error){
    const status=Number(error.status)||500;
    send(res,status>=400&&status<600?status:500,{
      ok:false,
      error:{
        code:status===401?"AUTH_FAILED":status===429?"RATE_LIMITED":"PROVIDER_ERROR",
        message:error instanceof Error?error.message:String(error)
      }
    },origin);
  }
});

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  server.listen(PORT,HOST,()=>{
    console.log("Φ Think Tank provider bridge listening on http://"+HOST+":"+PORT);
    console.log("Secrets remain server-side in this local process.");
  });
}
