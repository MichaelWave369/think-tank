import {readFileSync,statSync} from "node:fs";
import {join,resolve} from "node:path";
import assert from "node:assert/strict";

const directory=resolve("dist");
const html=readFileSync(join(directory,"index.html"),"utf8");
assert.match(html,/<title>Φ THINK TANK<\/title>/);
assert.match(html,/\/think-tank\/assets\//);
assert.doesNotMatch(html,/(?:src|href)="\/assets\//);
assert.doesNotMatch(html,/src="\/src\/main\.tsx"/);
const all=[...html.matchAll(/(?:src|href)="(\/think-tank\/assets\/[^"]+)"/g)]
 .map(match=>match[1]);
assert.ok(all.length>=2,"Expected repository-scoped JS and CSS assets");
for(const asset of all){
 assert.ok(!asset.includes("..")&&!asset.includes("?"));
 const file=join(directory,asset.slice("/think-tank/".length));
 assert.ok(statSync(file).size>100,asset+" is missing or empty");
}
const js=all.filter(url=>url.endsWith(".js"));
const css=all.filter(url=>url.endsWith(".css"));
assert.ok(js.length>0&&css.length>0,"Expected compiled React bundle plus CSS");
const app=js.map(url=>readFileSync(join(directory,url.slice("/think-tank/".length)),"utf8")).join("\n");
assert.ok(app.includes("PUBLIC REACT CONTROL ROOM"),"Public static disclosure missing from compiled app");
assert.ok(app.includes("VITE_PUBLIC_PAGES")===false,"Build-time public feature flag was not folded by Vite");
console.log("PUBLIC_PAGES_ASSETS_OK",JSON.stringify({base:"/think-tank/",js:js.length,css:css.length,assets:all.length,bytes:html.length}));
