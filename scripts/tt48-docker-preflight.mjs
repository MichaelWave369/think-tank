/* TT-48: exercise actual Docker --network none before trusted producer run. */
import {execFileSync} from "node:child_process";
import {networkInterfaces} from "node:os";
import {assertLoopbackOnly,checkNoExternalIPRoute,assertEgressProbeFailure} from "./tt48-isolation-policy.mjs";

assertLoopbackOnly(networkInterfaces());
const blocked=assertEgressProbeFailure(await checkNoExternalIPRoute());
const version=execFileSync("gh",["--version"],{
 encoding:"utf8",timeout:10000,
 env:{...process.env,GH_TOKEN:"",GITHUB_TOKEN:"",GH_PROMPT_DISABLED:"1"}
}).split("\n")[0];
if(!version.startsWith("gh version "))throw Error("TT48_MOUNTED_GH_NOT_RUNNABLE");
console.log("TT48_DOCKER_NETWORK_NONE_PREFLIGHT_PASS",JSON.stringify({
 onlyLoopback:true,externalIPBlockedBy:blocked,
 mountedCliVersion:version,signaturesVerified:false,
 releaseAuthorized:false,antiMDone:false
}));
