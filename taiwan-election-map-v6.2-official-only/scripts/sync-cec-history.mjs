import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, nowIso, readJson, writeJson } from "./lib.mjs";

const statusPath = "data/history-sync-status.json";
const importPath = "data/history/cec-import.json";
const logPath = "data/history/import-log.json";
const reviewPath = "data/history/identity-review.json";
const scope = process.env.CEC_HISTORY_SCOPE || "core";
const years = process.env.CEC_HISTORY_YEARS || "2014,2018,2020,2022,2024";
const archive = process.env.CEC_HISTORY_ARCHIVE || "";
const startedAt = nowIso();

const scopeRoles = {
  core: new Set(["president", "vice-president", "legislator", "municipal-mayor", "county-mayor", "municipal-councilor", "county-councilor"]),
  local: new Set(["president", "vice-president", "legislator", "municipal-mayor", "county-mayor", "municipal-councilor", "county-councilor", "township-mayor", "indigenous-district-mayor", "township-representative", "indigenous-district-representative"]),
  all: null,
};

function normalizeName(value) {
  return String(value || "").replace(/[\s　·・．.\-—_/\\()（）]+/g, "").trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with code ${result.status}`);
}

function addLog(entry) {
  let log = [];
  try { log = readJson(logPath); } catch { log = []; }
  if (!Array.isArray(log)) log = [];
  log.unshift(entry);
  writeJson(logPath, log.slice(0, 50));
}

try {
  const args = ["scripts/cec_history_import.py", "--output", importPath, "--scope", scope, "--years", years];
  if (archive) args.push("--archive", archive);
  if (process.env.CEC_HISTORY_REFRESH === "1") args.push("--refresh");
  run("python3", args);

  const imported = readJson(importPath);
  const records = Array.isArray(imported.records) ? imported.records : [];
  if (!records.length) throw new Error("CEC importer returned zero records");

  const data = readJson("data/election-data.json");
  data.history ||= { years: [], results: [] };
  const selectedYears = new Set(imported.metadata?.yearsFilter || records.map((record) => Number(record.year)));
  const allowedRoles = scopeRoles[scope] || new Set(records.map((record) => record.roleId));
  const existing = Array.isArray(data.history.results) ? data.history.results : [];
  const preserved = existing.filter((record) => {
    if (record.demo) return false;
    if (record.sourceType !== "cec-official-history") return true;
    const yearMatches = selectedYears.size === 0 || selectedYears.has(Number(record.year));
    const roleMatches = allowedRoles.has(record.roleId);
    return !(yearMatches && roleMatches);
  });

  const byId = new Map(preserved.map((record) => [record.id, record]));
  for (const record of records) byId.set(record.id, record);
  data.history.results = [...byId.values()];

  const previousYearMeta = new Map((data.history.years || []).map((item) => [Number(item.year), item]));
  data.history.years = [...new Set(data.history.results.map((record) => Number(record.year)).filter(Boolean))]
    .sort((a, b) => b - a)
    .map((year) => {
      const officialCount = data.history.results.filter((record) => Number(record.year) === year && record.sourceType === "cec-official-history").length;
      return {
        ...(previousYearMeta.get(year) || {}),
        year,
        label: previousYearMeta.get(year)?.label || `${year} 選舉`,
        status: officialCount ? "official-imported" : "manual-import",
        officialCount,
      };
    });

  const currentPeople = [...(data.officeholders || []), ...(data.candidates || [])];
  const currentByName = new Map();
  for (const person of currentPeople) {
    const key = normalizeName(person.name);
    if (!currentByName.has(key)) currentByName.set(key, []);
    currentByName.get(key).push(person);
  }

  const identityGroups = new Map();
  for (const record of data.history.results.filter((item) => item.sourceType === "cec-official-history")) {
    if (!identityGroups.has(record.personKey)) identityGroups.set(record.personKey, []);
    identityGroups.get(record.personKey).push(record);
  }
  const namesToKeys = new Map();
  for (const [personKey, personRecords] of identityGroups) {
    const name = normalizeName(personRecords[0]?.name);
    if (!namesToKeys.has(name)) namesToKeys.set(name, new Set());
    namesToKeys.get(name).add(personKey);
  }

  const review = [];
  let linkedCount = 0;
  for (const [personKey, personRecords] of identityGroups) {
    const sample = personRecords[0];
    const candidates = currentByName.get(normalizeName(sample.name)) || [];
    const narrowed = candidates.filter((person) => {
      const countyOk = !sample.countyId || !person.countyId || sample.countyId === person.countyId;
      const roleOk = !sample.roleId || !person.roleId || sample.roleId === person.roleId || ["president", "vice-president"].includes(sample.roleId);
      return countyOk && roleOk;
    });
    const sameNameIdentityCount = namesToKeys.get(normalizeName(sample.name))?.size || 1;
    const linked = narrowed.length === 1 && sameNameIdentityCount === 1 ? [narrowed[0].id] : [];
    if (linked.length) linkedCount += 1;
    for (const record of personRecords) record.linkedCurrentIds = linked;
    if (sample.identityConfidence === "review" || sameNameIdentityCount > 1 || narrowed.length > 1) {
      review.push({
        personKey,
        name: sample.name,
        identityConfidence: sample.identityConfidence,
        historyRecordCount: personRecords.length,
        sameNameIdentityCount,
        currentMatches: narrowed.map((person) => ({ id: person.id, name: person.name, role: person.role || person.electionType, countyId: person.countyId || null })),
        reason: sameNameIdentityCount > 1 ? "同名歷屆身分超過一組" : narrowed.length > 1 ? "同名現任／候選人超過一位" : "缺少足夠出生或性別欄位",
      });
    }
  }

  const officialRecords = data.history.results.filter((record) => record.sourceType === "cec-official-history");
  data.history.coverage = {
    source: "中央選舉委員會選舉資料庫",
    sourceUrl: imported.metadata.sourcePage,
    archiveUrl: imported.metadata.sourceUrl,
    lastOfficialSyncAt: nowIso(),
    scope,
    yearsRequested: imported.metadata.yearsFilter,
    yearsImported: [...new Set(officialRecords.map((record) => Number(record.year)))].sort((a, b) => b - a),
    rolesImported: [...new Set(officialRecords.map((record) => record.roleId))].sort(),
    officialRecordCount: officialRecords.length,
    officialPersonCount: identityGroups.size,
    linkedCurrentCount: linkedCount,
    identityReviewCount: review.length,
    datasetGroups: imported.metadata.importedGroups,
    archiveBytes: imported.metadata.archiveBytes,
    importDurationSeconds: imported.metadata.durationSeconds,
  };
  data.history.lastOfficialImport = imported.metadata;
  data.meta.version = `${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}-v6.1`;
  data.meta.lastGeneratedAt = nowIso();
  writeJson("data/election-data.json", data);
  writeJson(reviewPath, review);

  run(process.execPath, ["scripts/sync-history.mjs"]);
  run(process.execPath, ["scripts/build-client-data.mjs"]);

  const finalData = readJson("data/election-data.json");
  const status = {
    status: "ok",
    startedAt,
    finishedAt: nowIso(),
    scope,
    years,
    officialRecordCount: finalData.history?.coverage?.officialRecordCount || 0,
    officialPersonCount: finalData.history?.coverage?.officialPersonCount || 0,
    identityReviewCount: review.length,
    message: `已匯入中選會歷屆資料 ${records.length} 筆，網站累計官方歷屆資料 ${finalData.history?.coverage?.officialRecordCount || 0} 筆。`,
    sourceUrl: imported.metadata.sourcePage,
  };
  writeJson(statusPath, status);
  addLog({ ...status, metadata: imported.metadata });
  console.log(status.message);
} catch (error) {
  const status = {
    status: "failed",
    startedAt,
    finishedAt: nowIso(),
    scope,
    years,
    message: `中選會歷屆資料匯入失敗：${error.message}`,
  };
  writeJson(statusPath, status);
  addLog(status);
  console.error(status.message);
  process.exit(1);
}
