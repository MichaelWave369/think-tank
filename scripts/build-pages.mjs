/* One cross-platform public static Vite build; no credentials or local model. */
import {spawnSync} from "node:child_process";
const runner=process.platform==="win32"?"npm.cmd":"npm";
const result=spawnSync(runner,["run","build","--","--mode","pages"],{
 stdio:"inherit",
 env:{...process.env,VITE_PUBLIC_PAGES:"true"}
});
if(result.error)throw result.error;
process.exit(result.status??1);
