import { spawnSync } from "node:child_process";
import { readJson } from "./lib.mjs";

function run(script) {
  const executable = script.endsWith(".py") ? (process.env.PYTHON || "python3") : process.execPath;
  const result = spawnSync(executable, [script], { stdio: "inherit", env: process.env });
  return result.status === 0;
}

// Keep this command deliberately small. Expensive indexing, portrait caching,
// sharding and validation are separate workflow steps so a successful official
// fetch can be diagnosed and backed up without repeating the same work.
const candidateProcessOk = run("scripts/sync-official-data.mjs");
const officeholderProcessOk = run("scripts/sync-officeholders.mjs");

const candidateStatus = readJson("data/sync-status.json");
const officeholderStatus = readJson("data/officeholder-sync-status.json");
const candidateUseful = candidateProcessOk || ["partial", "official-data-active", "waiting-official-release"].includes(candidateStatus.status);
const officeholderUseful = officeholderProcessOk || ["partial", "ok"].includes(officeholderStatus.status);

if (!candidateUseful && !officeholderUseful) {
  console.error("候選人與現任公職同步皆未成功。");
  process.exit(1);
}
if (!candidateProcessOk || !officeholderProcessOk) {
  console.warn("部分官方來源同步失敗；已保留上一版資料。");
}
