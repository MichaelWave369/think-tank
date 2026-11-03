#!/usr/bin/env node
import { constants, lstatSync, openSync, fstatSync, readFileSync, closeSync } from "node:fs";
import { reviewPocketMeshE1 } from "./pocketmesh-e1-consumer.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Explicit operator-supplied file only; no stdin, network or state writes.
export function inspectPocketMeshFile(file) {
  if (typeof file !== "string" || file.length < 1 || file.length > 4096) {
    throw new Error("E1_FILE_REFUSED");
  }
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > 65536) {
    throw new Error("E1_FILE_REFUSED");
  }
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size !== info.size || opened.size > 65536) {
      throw new Error("E1_FILE_REFUSED");
    }
    const raw = readFileSync(fd, { encoding: "utf8" });
    if (Buffer.byteLength(raw, "utf8") > 65536) throw new Error("E1_FILE_REFUSED");
    return reviewPocketMeshE1(JSON.parse(raw));
  } finally {
    closeSync(fd);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--file") {
      throw new Error("E1_ARGS_REFUSED");
    }
    process.stdout.write(JSON.stringify(inspectPocketMeshFile(process.argv[3])) + "\n");
  } catch {
    process.stderr.write(JSON.stringify({
      disposition: "REFUSED",
      reason: "INVALID_OR_UNSUPPORTED_E1_RECEIPT",
      authority: "NONE"
    }) + "\n");
    process.exitCode = 1;
  }
}
