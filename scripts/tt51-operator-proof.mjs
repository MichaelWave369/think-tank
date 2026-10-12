/* TT-51: operator-run proof checker for Windows, Linux and macOS.
 * This does NOT assert that the host is network-isolated. It performs
 * exact local bundle verification using independently supplied SHA pins.
 */
import {readFile,lstat} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {TT47_FILES,verifyPortableProof} from "./tt47-portable-proof.mjs";

const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
export const TT51_SCHEMA="thinktank.tt51-operator-pinned-proof-review.v1";

export function validateOperatorTrustInputs(sourceCommit,rootSha256){
 if(typeof sourceCommit!=="string"||!/^[a-f0-9]{40}$/.test(sourceCommit))
  throw Error("TT51_INDEPENDENT_MAIN_COMMIT_REQUIRED");
 if(typeof rootSha256!=="string"||!/^[a-f0-9]{64}$/.test(rootSha256))
  throw Error("TT51_INDEPENDENT_ROOT_SHA256_REQUIRED");
 return {sourceCommit,rootSha256};
}
export async function verifyOperatorPinnedProof(folder,sourceCommit,rootSha256,verify=verifyPortableProof){
 validateOperatorTrustInputs(sourceCommit,rootSha256);
 const rootPath=join(folder,TT47_FILES.trustedRoot);
 const stat=await lstat(rootPath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>4194304)
  throw Error("TT51_TRUST_ROOT_FILE_REFUSED");
 const root=await readFile(rootPath);
 const digest=sha256(root);
 if(digest!==rootSha256)throw Error("TT51_INDEPENDENT_ROOT_PIN_MISMATCH");
 const checked=await verify(folder,sourceCommit);
 if(checked?.status!=="BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT"||
  checked.verifiedSubjects!==2)
  throw Error("TT51_BOTH_SIGNED_SUBJECTS_REQUIRED");
 if(checked.expectedCommit!==sourceCommit)throw Error("TT51_SOURCE_COMMIT_RESPONSE_MISMATCH");
 return {
  schema:TT51_SCHEMA,
  status:"TWO_ORIGINAL_SUBJECTS_VERIFIED_WITH_INDEPENDENT_PINS",
  expectedCommit:sourceCommit,rootSha256:digest,
  receiptSha256:checked.receiptSha256,
  screenshotSha256:checked.screenshotSha256,
  verifiedSubjects:2,
  cryptoVerifier:"GitHub CLI with Sigstore attestation bundles and custom trusted root",
  operatorContext:"LOCAL_CLI_RUN_HOST_NETWORK_NOT_EVALUATED",
  summarySigned:false,canonicalEvidence:false,
  releaseAuthorized:false,antiMDone:false,
  caveat:"This JSON is an unsigned summary. Trust requires independent source SHA and root, and successful cryptographic verification of exact original files."
 };
}
