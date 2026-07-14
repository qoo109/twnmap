import fs from "node:fs";
import { readJson, writeJson, nowIso, taipeiDate, hash } from "./lib.mjs";

const beforePath = process.env.BEFORE_DATA_PATH || "";
const before = beforePath && fs.existsSync(beforePath)
  ? JSON.parse(fs.readFileSync(beforePath, "utf8"))
  : readJson("data/election-data.json");
const after = readJson("data/election-data.json");

const comparableFields = ["name", "partyId", "roleId", "role", "countyId", "district", "organization", "status", "termStart", "termEnd"];

function normalizeIdentityText(value) {
  return String(value || "")
    .replaceAll("台", "臺")
    .replace(/[\s　·・．.]/g, "")
    .trim();
}

function semanticIdentityKey(item) {
  const roleId = String(item?.roleId || "").trim();
  const name = normalizeIdentityText(item?.name);
  if (!roleId || !name) return "";
  if (["president", "vice-president", "legislator"].includes(roleId)) {
    return `${roleId}|${name}`;
  }
  return `${roleId}|${name}|${String(item?.countyId || "").trim()}`;
}

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

function changedFields(oldItem, newItem) {
  return comparableFields.filter((field) => String(oldItem?.[field] ?? "") !== String(newItem?.[field] ?? ""));
}

function changeRecord(oldItem, newItem) {
  const fields = changedFields(oldItem, newItem);
  if (!fields.length) return null;
  return {
    id: newItem.id,
    name: newItem.name,
    fields,
    before: Object.fromEntries(fields.map((field) => [field, oldItem[field] ?? null])),
    after: Object.fromEntries(fields.map((field) => [field, newItem[field] ?? null])),
  };
}

function photoChange(oldItem, newItem) {
  const oldPhoto = oldItem?.photo?.localUrl || oldItem?.photo?.url || "";
  const newPhoto = newItem?.photo?.localUrl || newItem?.photo?.url || "";
  return oldPhoto !== newPhoto
    ? { id: newItem.id, name: newItem.name, from: oldPhoto, to: newPhoto }
    : null;
}

function groupBySemantic(items) {
  const groups = new Map();
  for (const item of items) {
    const key = semanticIdentityKey(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function roleCounts(items = []) {
  const counts = {};
  for (const item of items) {
    const roleId = item?.roleId || "unknown";
    counts[roleId] = (counts[roleId] || 0) + 1;
  }
  return counts;
}

function diffCollection(previousItems = [], currentItems = [], label = "records") {
  const previous = listById(previousItems);
  const current = listById(currentItems);
  const rawAdded = [];
  const rawRemoved = [];
  const changed = [];
  const photoUpdated = [];

  for (const [id, item] of current) {
    const old = previous.get(id);
    if (!old) {
      rawAdded.push(item);
      continue;
    }
    const fieldChange = changeRecord(old, item);
    const photo = photoChange(old, item);
    if (fieldChange) changed.push(fieldChange);
    if (photo) photoUpdated.push(photo);
  }
  for (const [id, item] of previous) if (!current.has(id)) rawRemoved.push(item);

  const addedGroups = groupBySemantic(rawAdded);
  const removedGroups = groupBySemantic(rawRemoved);
  const migratedAddedIds = new Set();
  const migratedRemovedIds = new Set();
  const idMigrated = [];

  for (const [key, newGroup] of addedGroups) {
    const oldGroup = removedGroups.get(key) || [];
    if (newGroup.length !== 1 || oldGroup.length !== 1) continue;
    const oldItem = oldGroup[0];
    const newItem = newGroup[0];
    migratedAddedIds.add(newItem.id);
    migratedRemovedIds.add(oldItem.id);
    idMigrated.push({
      name: newItem.name,
      roleId: newItem.roleId,
      fromId: oldItem.id,
      toId: newItem.id,
    });
    const fieldChange = changeRecord(oldItem, newItem);
    const photo = photoChange(oldItem, newItem);
    if (fieldChange) changed.push(fieldChange);
    if (photo) photoUpdated.push(photo);
  }

  return {
    label,
    beforeCount: previous.size,
    afterCount: current.size,
    added: rawAdded.filter((item) => !migratedAddedIds.has(item.id)).map(compactPerson),
    removed: rawRemoved.filter((item) => !migratedRemovedIds.has(item.id)).map(compactPerson),
    changed,
    photoUpdated,
    idMigrated,
    roleCountsBefore: roleCounts(previousItems),
    roleCountsAfter: roleCounts(currentItems),
  };
}

function findSuspiciousRoleDrops(diff) {
  const roles = new Set([
    ...Object.keys(diff.roleCountsBefore || {}),
    ...Object.keys(diff.roleCountsAfter || {}),
  ]);
  const drops = [];
  for (const roleId of roles) {
    const beforeCount = diff.roleCountsBefore?.[roleId] || 0;
    const afterCount = diff.roleCountsAfter?.[roleId] || 0;
    if (beforeCount < 25) continue;
    const drop = beforeCount - afterCount;
    const ratio = beforeCount ? drop / beforeCount : 0;
    if (drop >= 10 && ratio > 0.5) {
      drops.push({ roleId, beforeCount, afterCount, drop, ratio });
    }
  }
  return drops;
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

const netOfficeholderDrop = Math.max(0, officeholders.beforeCount - officeholders.afterCount);
const netOfficeholderDropRatio = officeholders.beforeCount
  ? netOfficeholderDrop / officeholders.beforeCount
  : 0;
const suspiciousRoleDrops = findSuspiciousRoleDrops(officeholders);
const suspiciousOverall = officeholders.beforeCount >= 50
  && netOfficeholderDrop >= 25
  && netOfficeholderDropRatio > 0.25;
const suspicious = suspiciousOverall || suspiciousRoleDrops.length > 0;

const generatedAt = nowIso();
const report = {
  schemaVersion: 2,
  generatedAt,
  date: taipeiDate(generatedAt),
  beforeVersion: before.meta?.version || null,
  afterVersion: after.meta?.version || null,
  summary: {
    added: officeholders.added.length + candidates.added.length,
    removed: officeholders.removed.length + candidates.removed.length,
    changed: officeholders.changed.length + candidates.changed.length,
    photoUpdated: officeholders.photoUpdated.length + candidates.photoUpdated.length,
    idMigrated: officeholders.idMigrated.length + candidates.idMigrated.length,
    historyDelta: history.afterCount - history.beforeCount,
  },
  officeholders,
  candidates,
  history,
  guard: {
    suspicious,
    suspiciousOverall,
    suspiciousRoleDrops,
    netOfficeholderDrop,
    reason: suspicious
      ? `現任公職資料實際淨減少 ${netOfficeholderDrop}/${officeholders.beforeCount} 筆，或個別職位人數異常下降。`
      : `未偵測到實際大量刪除；已辨識 ${officeholders.idMigrated.length} 筆人物 ID 遷移。`,
    requiresReview: suspicious,
  },
};

const stamp = generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
writeJson("data/change-log/latest.json", report);
writeJson(`data/change-log/${stamp}-${hash(JSON.stringify(report.summary), 8)}.json`, report);
after.changeLog = report;
after.meta = {
  ...after.meta,
  changeGuard: suspicious ? "review-required" : "passed",
};
writeJson("data/election-data.json", after);

console.log(
  `異動報告：新增 ${report.summary.added}、移除 ${report.summary.removed}、`
  + `變更 ${report.summary.changed}、ID 遷移 ${report.summary.idMigrated}。`
);
if (suspicious && process.env.CHANGE_GUARD === "1") {
  console.error(report.guard.reason);
  process.exit(2);
}
