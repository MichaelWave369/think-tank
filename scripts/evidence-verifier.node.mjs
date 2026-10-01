import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {
  assertEvidenceSourceDigest,
  assertPublicHttpUrl,
  buildSearxngSearchUrl,
  isBlockedIpv4,
  isBlockedIpv6,
  normalizeMessages,
  normalizeSearchResults,
  projectEvidenceText,
  dossierDigestSha256,
  sealDossierWithPrivateKey,
  stableCanonicalJson,
  verifyDossierSealReceipt
} from "./provider-bridge.mjs";

test("blocks private and local IPv4 ranges",()=>{
  for(const address of [
    "0.0.0.0",
    "10.1.2.3",
    "127.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1"
  ]){
    assert.equal(isBlockedIpv4(address),true,address);
  }

  assert.equal(isBlockedIpv4("8.8.8.8"),false);
  assert.equal(isBlockedIpv4("1.1.1.1"),false);
});

test("blocks local and private IPv6 ranges",()=>{
  for(const address of ["::","::1","fe80::1","fc00::1","fd00::1","ff02::1"]){
    assert.equal(isBlockedIpv6(address),true,address);
  }

  assert.equal(isBlockedIpv6("2606:4700:4700::1111"),false);
});

test("rejects localhost evidence URLs before network access",async()=>{
  await assert.rejects(
    assertPublicHttpUrl("http://127.0.0.1/secret"),
    /private, local, multicast, or reserved/i
  );
  await assert.rejects(
    assertPublicHttpUrl("http://169.254.169.254/latest/meta-data"),
    /private, local, multicast, or reserved/i
  );
});

test("rejects credentials and nonstandard ports",async()=>{
  await assert.rejects(
    assertPublicHttpUrl("https://user:pass@8.8.8.8/"),
    /must not contain credentials/i
  );
  await assert.rejects(
    assertPublicHttpUrl("https://8.8.8.8:8443/"),
    /port 443/i
  );
});

test("accepts a syntactically valid public direct-IP URL without fetching it",async()=>{
  const target=await assertPublicHttpUrl("https://8.8.8.8/");
  assert.equal(target.address,"8.8.8.8");
  assert.equal(target.family,4);
  assert.equal(target.url.protocol,"https:");
});


test("normalizes provider messages and rejects malformed roles",()=>{
  assert.deepEqual(
    normalizeMessages([
      {role:"system",content:"  system  "},
      {role:"user",content:" hello "}
    ]),
    [
      {role:"system",content:"system"},
      {role:"user",content:"hello"}
    ]
  );

  assert.throws(
    ()=>normalizeMessages([{role:"tool",content:"nope"}]),
    /invalid role/i
  );
});

test("builds the documented SearXNG JSON search URL",()=>{
  const url=new URL(buildSearxngSearchUrl("http://127.0.0.1:8888","claim source test"));
  assert.equal(url.pathname,"/search");
  assert.equal(url.searchParams.get("q"),"claim source test");
  assert.equal(url.searchParams.get("format"),"json");
  assert.equal(url.searchParams.get("safesearch"),"1");
});

test("normalizes, filters, deduplicates, ranks, and caps search candidates",()=>{
  const results=normalizeSearchResults({
    results:[
      {title:" First ",url:"https://example.com/a",content:"alpha",engine:"engine-a"},
      {title:"Duplicate",url:"https://example.com/a",content:"dup",engine:"engine-b"},
      {title:"Bad scheme",url:"file:///etc/passwd",content:"bad",engine:"bad"},
      {title:"Credentials",url:"https://u:p@example.com/private",content:"bad",engine:"bad"},
      {title:"Second",url:"https://example.com/b",content:"beta",engines:["engine-b"]},
      {title:"Third",url:"https://example.com/c",content:"gamma",engine:"engine-c"}
    ]
  },2);

  assert.equal(results.length,2);
  assert.deepEqual(results.map(item=>item.rank),[1,2]);
  assert.deepEqual(results.map(item=>item.uri),[
    "https://example.com/a",
    "https://example.com/b"
  ]);
  assert.equal(results[0].title,"First");
  assert.equal(results[1].engine,"engine-b");
});


test("rejects source bytes that no longer match the verified digest",()=>{
  const expected="a".repeat(64);
  assert.doesNotThrow(()=>assertEvidenceSourceDigest(expected,expected));
  assert.throws(
    ()=>assertEvidenceSourceDigest("b".repeat(64),expected),
    /source bytes changed since machine verification/i
  );
});

test("projects visible HTML text without scripts or styles",()=>{
  const projection=projectEvidenceText(
    Buffer.from("<h1>Title</h1><script>evil()</script><style>.x{}</style><p>Hello &amp; world</p>"),
    "text/html; charset=utf-8"
  );

  assert.match(projection.text,/Title/);
  assert.match(projection.text,/Hello & world/);
  assert.doesNotMatch(projection.text,/evil|\.x/);
  assert.match(projection.projectionSha256,/^[a-f0-9]{64}$/);
});

test("projects JSON deterministically as readable text",()=>{
  const projection=projectEvidenceText(
    Buffer.from('{"alpha":1,"beta":"two"}'),
    "application/json"
  );

  assert.match(projection.text,/"alpha": 1/);
  assert.match(projection.text,/"beta": "two"/);
});

test("refuses to pretend PDFs are text-projectable",()=>{
  assert.throws(
    ()=>projectEvidenceText(Buffer.from("%PDF-1.7"),"application/pdf"),
    /PDF text projection is not supported/i
  );
});


test("canonicalizes dossier JSON independent of object key order",()=>{
  const a={z:1,a:{y:2,x:3},list:[{b:2,a:1}]};
  const b={list:[{a:1,b:2}],a:{x:3,y:2},z:1};

  assert.equal(stableCanonicalJson(a),stableCanonicalJson(b));
  assert.equal(dossierDigestSha256(a),dossierDigestSha256(b));
});

test("signs and verifies a dossier with Ed25519",()=>{
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
  const dossier={id:"DOS-0042",mode:"council",outcome:"withheld",basisFingerprint:"fnv1a32:12345678"};

  const seal=sealDossierWithPrivateKey(
    dossier,
    privatePem,
    "test-signer",
    "2026-10-01T22:00:00.000Z"
  );
  const verification=verifyDossierSealReceipt(dossier,seal);

  assert.equal(verification.verified,true);
  assert.match(seal.digestSha256,/^[a-f0-9]{64}$/);
  assert.match(seal.publicKeyFingerprintSha256,/^[a-f0-9]{64}$/);
  assert.match(seal.id,new RegExp("^SEAL-DOS-0042-"+seal.publicKeyFingerprintSha256.slice(0,12)+"$"));
  assert.match(seal.publicKeyPem,/BEGIN PUBLIC KEY/);
  assert.doesNotMatch(seal.publicKeyPem,/PRIVATE KEY/);
  assert.ok(seal.signatureBase64.length>40);
});

test("detects a dossier changed after signing",()=>{
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
  const dossier={id:"DOS-0007",value:"original"};
  const seal=sealDossierWithPrivateKey(
    dossier,privatePem,"test","2026-10-01T22:00:00.000Z"
  );

  const verification=verifyDossierSealReceipt({...dossier,value:"changed"},seal);
  assert.equal(verification.verified,false);
  assert.match(verification.reason,/SHA-256 does not match/i);
});

test("detects a forged public-key fingerprint",()=>{
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
  const dossier={id:"DOS-0008",value:"alpha"};
  const seal=sealDossierWithPrivateKey(
    dossier,privatePem,"test","2026-10-01T22:00:00.000Z"
  );

  const verification=verifyDossierSealReceipt(dossier,{
    ...seal,
    publicKeyFingerprintSha256:"0".repeat(64)
  });
  assert.equal(verification.verified,false);
  assert.match(verification.reason,/fingerprint does not match/i);
});

test("detects a modified Ed25519 signature",()=>{
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
  const dossier={id:"DOS-0009",value:"alpha"};
  const seal=sealDossierWithPrivateKey(
    dossier,privatePem,"test","2026-10-01T22:00:00.000Z"
  );
  const bytes=Buffer.from(seal.signatureBase64,"base64");
  bytes[0]^=0xff;

  const verification=verifyDossierSealReceipt(dossier,{
    ...seal,
    signatureBase64:bytes.toString("base64")
  });
  assert.equal(verification.verified,false);
  assert.match(verification.reason,/verification failed/i);
});

test("rejects non-Ed25519 dossier signing keys",()=>{
  const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"});

  assert.throws(
    ()=>sealDossierWithPrivateKey(
      {id:"DOS-0010"},privatePem,"wrong-key","2026-10-01T22:00:00.000Z"
    ),
    /must be Ed25519/i
  );
});
