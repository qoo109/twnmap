import { spawnSync } from "node:child_process";
import { readJson } from "./lib.mjs";

function run(script) {
  const executable = script.endsWith(".py") ? (process.env.PYTHON || "python3") : process.execPath;
  const result = spawnSync(executable, [script], { stdio: "inherit" });
  return result.status === 0;
}

const candidateProcessOk = run("scripts/sync-official-data.mjs");
const officeholderProcessOk = run("scripts/sync-officeholders.mjs");
const historyIndexOk = run("scripts/sync-history.mjs");
const portraitCacheOk = run("scripts/cache_portraits.py");
const shardBuildOk = run("scripts/build-data-shards.mjs");
const buildOk = run("scripts/build-client-data.mjs");

const candidateStatus = readJson("data/sync-status.json");
const officeholderStatus = readJson("data/officeholder-sync-status.json");
const candidateUseful = candidateProcessOk || ["partial", "official-data-active", "waiting-official-release"].includes(candidateStatus.status);
const officeholderUseful = officeholderProcessOk || ["partial", "ok"].includes(officeholderStatus.status);

if (!historyIndexOk) {
  console.warn("歷屆資料索引建立失敗；會保留原始歷屆結果。 ");
}
if (!portraitCacheOk) console.warn("部分官方頭貼無法本地化；人物資料仍會保留姓名縮寫備援。 ");
if (!shardBuildOk) console.warn("資料分片建立失敗；仍保留完整離線資料作為備援。 ");
if (!buildOk || (!candidateUseful && !officeholderUseful)) {
  console.error("候選人與現任公職同步皆未成功，或前端資料產生失敗。");
  process.exit(1);
}
if (!candidateProcessOk || !officeholderProcessOk) {
  console.warn("部分官方來源同步失敗；已保留上一版資料並完成其他可用來源的更新。");
}
