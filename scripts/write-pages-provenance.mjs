/* Self-reported build provenance, NOT cryptographically attested live-browser QA. */
import {writeFileSync} from "node:fs";
const [sha,runId]=process.argv.slice(2);
if(!/^[0-9a-f]{40}$/.test(sha||""))throw Error("PAGES_PROVENANCE_SHA");
if(!/^[1-9][0-9]{0,18}$/.test(runId||""))throw Error("PAGES_PROVENANCE_RUN");
const report={
 schema:"phi-thinktank.pages-deploy-provenance.v0.1",
 repository:"MichaelWave369/think-tank",
 sourceSha:sha,
 deploymentWorkflowRunId:runId,
 assetBase:"/think-tank/",
 buildProfile:"STATIC_PUBLIC_REACT",
 browserVerified:false,
 independentProviderVerified:false,
 modelExecutionAuthorized:false,
 independentExternalDone:false,
 cryptographicallySigned:false
};
writeFileSync("dist/deploy-provenance.json",JSON.stringify(report,null,2)+"\n",{flag:"wx"});
console.log("PAGES_BUILD_PROVENANCE",report.sourceSha,report.deploymentWorkflowRunId);
