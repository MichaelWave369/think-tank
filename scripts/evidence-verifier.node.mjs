import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicHttpUrl,
  buildSearxngSearchUrl,
  isBlockedIpv4,
  isBlockedIpv6,
  normalizeMessages,
  normalizeSearchResults
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
