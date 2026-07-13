import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, writeJson, nowIso, taipeiDate, hash } from "./lib.mjs";

const beforePath = process.env.BEFORE_DATA_PATH || "";
const before = beforePath && fs.existsSync(beforePath)
  ? JSON.parse(fs.readFileSync(beforePath, "utf8"))
  : readJson("data/election-data.json");
const after = readJson("data/election-data.json");

const comparableFields = ["name", "partyId", "roleId", "role", "countyId", "district", "organization", "status", "termStart", "termEnd"];

function listById(items = []) {
  return new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
}

function compactPerson(item) {
  return {
    id: item.id,
    name: item.name,
    partyId: item.partyId || "",
    roleId: item.roleId || "",
    countyId: item.countyId || "",
    district: item.district || "",
  };
}

function diffCollection(previousItems = [], currentItems = [], label = "records") {
  const previous = listById(previousItems);
  const current = listById(currentItems);
  const added = [];
  const removed = [];
  const changed = [];
  const photoUpdated = [];

  for (const [id, item] of current) {
    const old = previous.get(id);
    if (!old) {
      added.push(compactPerson(item));
      continue;
    }
    const fields = comparableFields.filter((field) => String(old[field] ?? "") !== String(item[field] ?? ""));
    const oldPhoto = old.photo?.localUrl || old.photo?.url || "";
    const newPhoto = item.photo?.localUrl || item.photo?.url || "";
    if (oldPhoto !== newPhoto) photoUpdated.push({ id, name: item.name, from: oldPhoto, to: newPhoto });
    if (fields.length) {
      changed.push({
        id,
        name: item.name,
        fields,
        before: Object.fromEntries(fields.map((field) => [field, old[field] ?? null])),
        after: Object.fromEntries(fields.map((field) => [field, item[field] ?? null])),
      });
    }
  }
  for (const [id, item] of previous) if (!current.has(id)) removed.push(compactPerson(item));

  return {
    label,
    beforeCount: previous.size,
    afterCount: current.size,
    added,
    removed,
    changed,
    photoUpdated,
  };
}

const officeholders = diffCollection(before.officeholders, after.officeholders, "officeholders");
const candidates = diffCollection(before.candidates, after.candidates, "candidates");
const oldHistory = before.history?.results || [];
const newHistory = after.history?.results || [];
const history = {
  label: "history",
  beforeCount: oldHistory.length,
  afterCount: newHistory.length,
  addedCount: Math.max(0, newHistory.length - oldHistory.length),
  removedCount: Math.max(0, oldHistory.length - newHistory.length),
};

const officeholderRemovalRatio = officeholders.beforeCount
  ? officeholders.removed.length / officeholders.beforeCount
  : 0;
const suspicious = officeholders.beforeCount >= 50 && (officeholders.removed.length >= 25 || officeholderRemovalRatio > 0.25);
const generatedAt = nowIso();
const report = {
  schemaVersion: 1,
  generatedAt,
  date: taipeiDate(generatedAt),
  beforeVersion: before.meta?.version || null,
  afterVersion: after.meta?.version || null,
  summary: {
    added: officeholders.added.length + candidates.added.length,
    removed: officeholders.removed.length + candidates.removed.length,
    changed: officeholders.changed.length + candidates.changed.length,
    photoUpdated: officeholders.photoUpdated.length + candidates.photoUpdated.length,
    historyDelta: history.afterCount - history.beforeCount,
  },
  officeholders,
  candidates,
  history,
  guard: {
    suspicious,
    reason: suspicious ? `現任公職一次移除 ${officeholders.removed.length}/${officeholders.beforeCount} 筆，超過安全門檻。` : "未偵測到大量異常刪除。",
    requiresReview: suspicious,
  },
};

const stamp = generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
writeJson("data/change-log/latest.json", report);
writeJson(`data/change-log/${stamp}-${hash(JSON.stringify(report.summary), 8)}.json`, report);
after.changeLog = report;
after.meta = {
  ...after.meta,
  version: String(after.meta?.version || "").replace(/-v6\.0$/, "-v6.1") || `${taipeiDate(generatedAt).replaceAll("-", ".")}-v6.1`,
  changeGuard: suspicious ? "review-required" : "passed",
};
writeJson("data/election-data.json", after);
console.log(`異動報告：新增 ${report.summary.added}、移除 ${report.summary.removed}、變更 ${report.summary.changed}、照片 ${report.summary.photoUpdated}。`);
if (suspicious && process.env.CHANGE_GUARD === "1") {
  console.error(report.guard.reason);
  process.exit(2);
}
