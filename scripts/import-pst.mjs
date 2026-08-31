#!/usr/bin/env node

import { lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { saveMessage } from "../functions-ingest/store.js";

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const parserPath = join(scriptDir, "pst-to-jsonl.py");

function usage() {
  console.error("Usage: node scripts/import-pst.mjs <file.pst> --mailbox <support@example.com> [--side unknown|brand|factory] [--apply]");
}

function parseArgs(argv) {
  const positional = [];
  const options = { apply: false, side: "unknown" };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--apply") {
      options.apply = true;
    } else if (value === "--mailbox" || value === "--side") {
      const next = argv[++i];
      if (!next) throw new Error(`${value} requires a value`);
      options[value.slice(2)] = next;
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    } else {
      positional.push(value);
    }
  }
  if (positional.length !== 1 || !options.mailbox) {
    usage();
    throw new Error("PST file and --mailbox are required");
  }
  if (!options.mailbox.includes("@")) throw new Error("--mailbox must be an email address");
  if (!["brand", "factory", "unknown"].includes(options.side)) {
    throw new Error("--side must be brand, factory, or unknown");
  }
  return { pstPath: resolve(positional[0]), ...options };
}

function readpstArgs(pstPath, exportDir) {
  return ["-e", "-8", "-q", "-t", "e", "-o", exportDir, pstPath];
}

async function readJsonl(parsedPath) {
  return (await readFile(parsedPath, "utf8"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

async function getDb() {
  if (getApps().length === 0) {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is required with --apply");
    const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || "medidakos",
    });
  }
  return getFirestore();
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const pstStat = await lstat(options.pstPath);
  if (!pstStat.isFile() || !options.pstPath.toLowerCase().endsWith(".pst")) {
    throw new Error("PST path must be a regular .pst file");
  }

  const workDir = await mkdtemp(join(tmpdir(), "medidakos-pst-"));
  const exportDir = join(workDir, "eml");
  const parsedPath = join(workDir, "messages.jsonl");
  try {
    const readpst = process.env.READPST_BIN || "readpst";
    await mkdir(exportDir);
    await execFileAsync(readpst, readpstArgs(options.pstPath, exportDir), { maxBuffer: 1024 * 1024 });
    await execFileAsync("python3", [
      parserPath,
      exportDir,
      "--mailbox",
      options.mailbox,
      "--side",
      options.side,
      "--output",
      parsedPath,
    ], { maxBuffer: 1024 * 1024 });

    const db = options.apply ? await getDb() : null;
    let count = 0;
    for (const message of await readJsonl(parsedPath)) {
      if (db) await saveMessage(db, message);
      count += 1;
      if (db && count % 25 === 0) console.error(`saved ${count} messages`);
    }

    console.log(`${options.apply ? "migrated" : "dry-run parsed"} ${count} messages from ${basename(options.pstPath)}`);
    if (!options.apply) console.log("No Firestore writes performed. Re-run with --apply after reviewing the count.");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export { parseArgs, readJsonl, readpstArgs };

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "PST import failed");
    process.exitCode = 1;
  });
}
