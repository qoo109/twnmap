import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, writeJson, nowIso } from "./lib.mjs";

const data = readJson("data/election-data.json");
const generatedAt = nowIso();
const countyIds = new Set((data.counties || []).map((county) => county.id));

function resetDir(relative) {
  const dir = path.join(ROOT, relative);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
resetDir("data/current");
resetDir("data/people");
fs.mkdirSync(path.join(ROOT, "data/history-shards"), { recursive: true });

const currentFiles = [];
for (const countyId of countyIds) {
  const officeholders = (data.officeholders || []).filter((item) => item.countyId === countyId);
  const candidates = (data.candidates || []).filter((item) => item.countyId === countyId);
  const relative = `data/current/${countyId}.json`;
  writeJson(relative, { generatedAt, countyId, officeholders, candidates });
  currentFiles.push({ countyId, file: relative.replace(/^data\//, ""), officeholderCount: officeholders.length, candidateCount: candidates.length });
}
writeJson("data/current/national.json", {
  generatedAt,
  countyId: null,
  officeholders: (data.officeholders || []).filter((item) => !item.countyId),
  candidates: (data.candidates || []).filter((item) => !item.countyId),
});

const people = [...(data.officeholders || []), ...(data.candidates || [])];
for (const person of people) writeJson(`data/people/${person.id}.json`, { generatedAt, person });

const historyFiles = [];
const byYearCounty = new Map();
for (const record of data.history?.results || []) {
  const year = String(record.year || "unknown");
  const countyId = record.countyId || "national";
  const key = `${year}/${countyId}`;
  if (!byYearCounty.has(key)) byYearCounty.set(key, []);
  byYearCounty.get(key).push(record);
}
for (const [key, records] of byYearCounty) {
  const [year, countyId] = key.split("/");
  const relative = `data/history-shards/${year}/${countyId}.json`;
  writeJson(relative, { generatedAt, year: Number(year) || year, countyId: countyId === "national" ? null : countyId, records });
  historyFiles.push({ year, countyId, file: relative.replace(/^data\//, ""), count: records.length });
}

const manifest = {
  schemaVersion: 1,
  generatedAt,
  strategy: "hybrid-sharded",
  fallback: "data/candidates.js remains available for file:// offline use",
  counts: {
    officeholders: data.officeholders?.length || 0,
    candidates: data.candidates?.length || 0,
    history: data.history?.results?.length || 0,
    personFiles: people.length,
    currentFiles: currentFiles.length + 1,
    historyFiles: historyFiles.length,
  },
  current: currentFiles,
  national: "current/national.json",
  peopleBase: "people/",
  history: historyFiles,
};
writeJson("data/manifest.json", manifest);
fs.writeFileSync(path.join(ROOT, "data/manifest.js"), `window.DATA_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
data.meta = { ...data.meta, dataStrategy: "hybrid-sharded", dataManifestGeneratedAt: generatedAt };
data.dataManifest = manifest;
writeJson("data/election-data.json", data);
console.log(`資料分片完成：${manifest.counts.currentFiles} 個現任分區、${manifest.counts.personFiles} 個人物檔、${manifest.counts.historyFiles} 個歷屆分片。`);
