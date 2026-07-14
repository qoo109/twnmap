import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, writeJson, nowIso } from "./lib.mjs";

const data = readJson("data/election-data.json");
const generatedAt = nowIso();
const countyIds = new Set((data.counties || []).map((county) => county.id));
data.sources = Array.isArray(data.sources) ? data.sources : [];
if (!data.sources.some((source) => source.url === "https://data.gov.tw/dataset/170247")) {
  data.sources.push({
    name: "政府資料開放平臺：立法委員選舉區範圍",
    type: "官方選區",
    url: "https://data.gov.tw/dataset/170247",
    usage: "第 11 屆區域立法委員 73 個選舉區的正式名稱與範圍文字。",
    note: "含里界拆分的選區只顯示官方範圍文字與可驗證的完整行政區，不推估里界圖形。",
  });
}

function createStat() {
  return { count: 0, parties: {}, roles: {}, mayorParty: null };
}

function addToStat(stat, item) {
  if (!stat || !item) return;
  stat.count += 1;
  const partyId = item.partyId || "other";
  const roleId = item.roleId || "other";
  stat.parties[partyId] = (stat.parties[partyId] || 0) + 1;
  if (!stat.roles[roleId]) stat.roles[roleId] = { count: 0, parties: {}, mayorParty: null };
  stat.roles[roleId].count += 1;
  stat.roles[roleId].parties[partyId] = (stat.roles[roleId].parties[partyId] || 0) + 1;
  if (["municipal-mayor", "county-mayor"].includes(roleId)) {
    stat.mayorParty = partyId;
    stat.roles[roleId].mayorParty = partyId;
  }
}

function buildSummary() {
  const officeholdersByCounty = Object.fromEntries([...countyIds].map((countyId) => [countyId, createStat()]));
  const officeholderNational = createStat();
  for (const item of data.officeholders || []) {
    if (item.countyId && officeholdersByCounty[item.countyId]) addToStat(officeholdersByCounty[item.countyId], item);
    else addToStat(officeholderNational, item);
  }

  const historyByYear = {};
  for (const item of data.history?.results || []) {
    const year = String(item.year || "unknown");
    if (!historyByYear[year]) {
      historyByYear[year] = {
        count: 0,
        elected: 0,
        roles: [],
        national: createStat(),
        byCounty: Object.fromEntries([...countyIds].map((countyId) => [countyId, createStat()])),
      };
    }
    const bucket = historyByYear[year];
    bucket.count += 1;
    if (item.roleId && !bucket.roles.includes(item.roleId)) bucket.roles.push(item.roleId);
    if (item.elected === true) {
      bucket.elected += 1;
      if (item.countyId && bucket.byCounty[item.countyId]) addToStat(bucket.byCounty[item.countyId], item);
      else addToStat(bucket.national, item);
    }
  }
  Object.values(historyByYear).forEach((year) => year.roles.sort());

  return {
    generatedAt,
    officeholders: {
      total: data.officeholders?.length || 0,
      local: (data.officeholders || []).filter((item) => item.countyId).length,
      legislators: (data.officeholders || []).filter((item) => item.roleId === "legislator").length,
      national: officeholderNational,
      byCounty: officeholdersByCounty,
    },
    candidates: { total: data.candidates?.length || 0 },
    history: {
      total: data.history?.results?.length || 0,
      years: Object.keys(historyByYear).filter((year) => /^\d{4}$/.test(year)).map(Number).sort((a, b) => b - a),
      roles: [...new Set((data.history?.results || []).map((item) => item.roleId).filter(Boolean))].sort(),
      byYear: historyByYear,
    },
  };
}

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
const omittedPersonShardRoles = new Set(["village-chief", "township-representative", "indigenous-district-representative"]);
const shardedPeople = people.filter((person) => !omittedPersonShardRoles.has(person.roleId));
for (const person of shardedPeople) writeJson(`data/people/${person.id}.json`, { generatedAt, person });

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

const summary = buildSummary();
const manifest = {
  schemaVersion: 2,
  generatedAt,
  strategy: "hybrid-sharded",
  fallback: "data/candidates.js remains available for file:// offline use",
  bootstrap: "bootstrap.json",
  counts: {
    officeholders: data.officeholders?.length || 0,
    candidates: data.candidates?.length || 0,
    history: data.history?.results?.length || 0,
    personFiles: shardedPeople.length,
    personFilesOmitted: people.length - shardedPeople.length,
    currentFiles: currentFiles.length + 1,
    historyFiles: historyFiles.length,
  },
  current: currentFiles,
  national: "current/national.json",
  peopleBase: "people/",
  peopleOmittedRoles: [...omittedPersonShardRoles],
  history: historyFiles,
};
writeJson("data/manifest.json", manifest);
fs.writeFileSync(path.join(ROOT, "data/manifest.js"), `window.DATA_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
data.meta = {
  ...data.meta,
  version: "2026.07.14-v6.1.17",
  release: "V6.1.17",
  dataStrategy: "lazy-hybrid-sharded",
  dataManifestGeneratedAt: generatedAt,
};
data.dataManifest = manifest;
data.summary = summary;
writeJson("data/election-data.json", data);

const publicMeta = {
  ...data.meta,
  electionName: data.candidates?.length ? data.meta?.electionName : "",
  electionDate: data.candidates?.length ? data.meta?.electionDate : "",
  mode: data.candidates?.length ? data.meta?.mode : "official-history-and-incumbents",
};
const bootstrap = {
  meta: publicMeta,
  parties: data.parties || [],
  counties: data.counties || [],
  sources: data.sources || [],
  sync: data.sync || {},
  roles: data.roles || [],
  officeholders: [],
  candidates: [],
  officeholderSync: data.officeholderSync || {},
  historySync: data.historySync || {},
  history: { ...(data.history || {}), results: [] },
  personHistory: [],
  partyHistory: data.partyHistory || [],
  districtHistory: [],
  photoSync: data.photoSync || {},
  changeLog: [],
  dataManifest: manifest,
  summary,
};
writeJson("data/bootstrap.json", bootstrap);
fs.writeFileSync(path.join(ROOT, "data/bootstrap.js"), `window.ELECTION_DATA = ${JSON.stringify(bootstrap)};\n`);
console.log(`資料分片完成：${manifest.counts.currentFiles} 個現任分區、${manifest.counts.personFiles} 個人物檔、${manifest.counts.historyFiles} 個歷屆分片；啟動資料已縮小為摘要模式。`);
