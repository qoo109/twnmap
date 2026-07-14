import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ROOT,
  decodeBuffer,
  extractDistributions,
  fetchWithTimeout,
  hash,
  listFiles,
  nowIso,
  parseCsv,
  readJson,
  safeFileName,
  taipeiDate,
  unzip,
  writeJson,
} from "./lib.mjs";

const config = readJson("config/sources.json");
const overrides = readJson("config/manual-overrides.json");
const data = readJson("data/election-data.json");
const previousSnapshot = fs.existsSync(path.join(ROOT, "data/source-snapshot.json"))
  ? readJson("data/source-snapshot.json")
  : { resources: [] };
const attemptAt = nowIso();
const errors = [];
const sourceReports = [];
let metadataSucceeded = 0;
let matchingResources = [];

function resourceText(resource) {
  return `${resource.description} ${resource.url} ${resource.format}`.toLocaleLowerCase("zh-Hant");
}

function isTargetResource(resource) {
  const text = resourceText(resource);
  return config.targetElection.includeKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("zh-Hant")));
}

for (const source of config.datasets) {
  try {
    const response = await fetchWithTimeout(source.metadataUrl, {}, 60_000);
    const payload = await response.json();
    const distributions = extractDistributions(payload);
    const matches = distributions.filter(isTargetResource).map((item) => ({ ...item, source }));
    matchingResources.push(...matches);
    metadataSucceeded += 1;
    sourceReports.push({
      id: source.id,
      name: source.name,
      homepageUrl: source.homepageUrl,
      metadataUrl: source.metadataUrl,
      status: "ok",
      checkedAt: attemptAt,
      resourceCount: distributions.length,
      matchingResourceCount: matches.length,
    });
  } catch (error) {
    errors.push(`${source.name}: ${error.message}`);
    sourceReports.push({
      id: source.id,
      name: source.name,
      homepageUrl: source.homepageUrl,
      metadataUrl: source.metadataUrl,
      status: "error",
      checkedAt: attemptAt,
      message: error.message,
    });
  }
}

matchingResources = [...new Map(matchingResources.map((item) => [item.url, item])).values()];
const snapshot = {
  checkedAt: attemptAt,
  election: config.targetElection.name,
  resources: matchingResources.map((item) => ({
    sourceId: item.source.id,
    description: item.description,
    format: item.format,
    encoding: item.encoding,
    modifiedAt: item.modifiedAt,
    url: item.url,
    fingerprint: hash(`${item.description}|${item.format}|${item.modifiedAt}|${item.url}`, 24),
  })),
};
const previousFingerprint = hash(JSON.stringify(previousSnapshot.resources || []), 32);
const currentFingerprint = hash(JSON.stringify(snapshot.resources), 32);
const resourceSetChanged = previousFingerprint !== currentFingerprint;
writeJson("data/source-snapshot.json", snapshot);

const knownCountyNames = data.counties.map((county) => county.name).sort((a, b) => b.length - a.length);
const countyIdByName = new Map(data.counties.map((county) => [county.name, county.id]));
const existingCandidateById = new Map(data.candidates.map((candidate) => [candidate.id, candidate]));
const existingPartyByName = new Map(data.parties.map((party) => [party.name, party]));
const palette = ["#51458B", "#DC143C", "#1F8B76", "#6EC5DC", "#633F99", "#FFAE2B", "#8B00FF"];
const parsedCandidates = [];
const parsedParties = new Map(data.parties.map((party) => [party.id, party]));

function keyFromCodes(parts) {
  return parts.slice(0, 5).join("|");
}

function inferElectionType(text) {
  const types = [
    "直轄市長", "縣市長", "縣（市）長", "直轄市議員", "縣市議員", "縣（市）議員",
    "鄉鎮市長", "鄉（鎮、市）長", "原住民區長", "鄉鎮市民代表", "鄉（鎮、市）民代表",
    "原住民區民代表", "村里長", "村（里）長",
  ];
  return types.find((type) => text.includes(type)) || "地方公職人員";
}

function countyFromArea(areaName) {
  const normalized = String(areaName || "").replace(/台/g, "臺");
  const name = knownCountyNames.find((candidate) => normalized.includes(candidate));
  return name ? countyIdByName.get(name) : null;
}

function slugParty(name, code) {
  if (overrides.partyAliases[name]) return overrides.partyAliases[name];
  const existing = existingPartyByName.get(name);
  if (existing) return existing.id;
  return `party-${String(code || hash(name, 6)).replace(/\D+/g, "") || hash(name, 6)}`;
}

function normalizeParty(code, name) {
  const cleanName = name || (String(code) === "999" ? "無黨籍及未經政黨推薦" : `政黨代號 ${code}`);
  const id = slugParty(cleanName, code);
  if (!parsedParties.has(id)) {
    parsedParties.set(id, {
      id,
      name: cleanName,
      shortName: cleanName === "無黨籍及未經政黨推薦" ? "無黨籍" : cleanName.replace(/^台灣|^臺灣/, "").slice(0, 6),
      color: palette[Number.parseInt(hash(id, 2), 16) % palette.length],
    });
  }
  return id;
}

function parseAreaFile(filePath, encoding) {
  const rows = parseCsv(decodeBuffer(fs.readFileSync(filePath), encoding));
  const map = new Map();
  for (const row of rows) {
    if (row.length < 6 || /省市別|縣市別/.test(row[0])) continue;
    map.set(keyFromCodes(row), row[5]);
  }
  return map;
}

function parsePartyFile(filePath, encoding) {
  const rows = parseCsv(decodeBuffer(fs.readFileSync(filePath), encoding));
  const map = new Map();
  for (const row of rows) {
    if (row.length < 2 || /政黨代號/.test(row[0])) continue;
    map.set(String(row[0]).trim(), String(row[1]).trim());
  }
  return map;
}

function parseCandidateFile(filePath, encoding, context) {
  const rows = parseCsv(decodeBuffer(fs.readFileSync(filePath), encoding));
  for (const row of rows) {
    if (row.length < 15 || /省市別|候選人/.test(row[0])) continue;
    const [prv, city, districtCode, township, village, number, name, partyCode, gender, birthDate, age, birthPlace, education, incumbent, elected, deputy] = row;
    if (!name || !number || !/^\d+$/.test(String(number).trim())) continue;
    const fullKey = [prv, city, districtCode, township, village].join("|");
    const fallbackKeys = [
      fullKey,
      [prv, city, districtCode, "000", "0000"].join("|"),
      [prv, city, "00", "000", "0000"].join("|"),
      [prv, "000", "00", "000", "0000"].join("|"),
    ];
    const areaName = fallbackKeys.map((key) => context.areaMap.get(key)).find(Boolean) || context.resource.description;
    const countyId = countyFromArea(areaName);
    if (!countyId) {
      errors.push(`無法判斷縣市：${name}（${areaName || fullKey}）`);
      continue;
    }
    const partyName = context.partyMap.get(String(partyCode).trim()) || (String(partyCode).trim() === "999" ? "無黨籍及未經政黨推薦" : "");
    const partyId = normalizeParty(String(partyCode).trim(), partyName);
    const stableKey = `${config.targetElection.name}|${prv}|${city}|${districtCode}|${township}|${village}|${number}|${name}`;
    const id = `official-${hash(stableKey, 20)}`;
    const previous = existingCandidateById.get(id);
    const manualJudicial = previous?.judicial && previous.judicial.status !== "pending" ? previous.judicial : null;
    const candidate = {
      id,
      demo: false,
      official: true,
      name: String(name).trim(),
      number: Number(number),
      countyId,
      district: areaName || "選區待補",
      electionType: inferElectionType(`${context.resource.description} ${context.parentText}`),
      partyId,
      incumbent: String(incumbent).toUpperCase() === "Y",
      elected: String(elected).includes("*") || String(elected).includes("!"),
      gender: String(gender) === "1" ? "男" : String(gender) === "2" ? "女" : "未提供",
      age: Number(age) || null,
      birthPlace: birthPlace || "",
      education: education ? [education] : [],
      experience: previous?.experience || [],
      policies: previous?.policies || [],
      judicial: manualJudicial || {
        status: "pending",
        label: "待人工查核",
        summary: "官方候選人資料已匯入；司法紀錄尚未完成身分核對與人工覆核。",
        final: null,
        cases: [],
      },
      sources: [{
        label: `中央選舉委員會：${context.resource.description || config.targetElection.name}`,
        url: context.resource.url,
        date: context.resource.modifiedAt || taipeiDate(attemptAt),
        retrievedAt: attemptAt,
      }],
      officialUpdatedAt: context.resource.modifiedAt || null,
      verifiedAt: manualJudicial ? previous.verifiedAt || null : null,
    };
    const manual = overrides.candidateOverrides[id];
    parsedCandidates.push(manual ? { ...candidate, ...manual, judicial: manual.judicial || candidate.judicial } : candidate);
  }
}

async function downloadResource(resource, tempRoot) {
  const response = await fetchWithTimeout(resource.url, {}, 120_000);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  const format = resource.format || contentType;
  const looksZip = /zip/i.test(format) || /\.zip(?:$|\?)/i.test(resource.url) || buffer.subarray(0, 2).toString("hex") === "504b";
  const resourceDir = path.join(tempRoot, `${resource.source.id}-${resource.index}-${safeFileName(resource.description).slice(0, 60)}`);
  fs.mkdirSync(resourceDir, { recursive: true });
  if (looksZip) {
    const zipPath = path.join(resourceDir, "resource.zip");
    fs.writeFileSync(zipPath, buffer);
    const extracted = path.join(resourceDir, "extracted");
    unzip(zipPath, extracted);
    return { root: extracted, files: listFiles(extracted), directFile: null };
  }
  const extension = /csv/i.test(format) || /\.csv(?:$|\?)/i.test(resource.url) ? ".csv" : ".dat";
  const directFile = path.join(resourceDir, `resource${extension}`);
  fs.writeFileSync(directFile, buffer);
  return { root: resourceDir, files: [directFile], directFile };
}

if (matchingResources.length > 0) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "taiwan-election-sync-"));
  try {
    for (const resource of matchingResources) {
      try {
        const downloaded = await downloadResource(resource, tempRoot);
        const candidateFiles = downloaded.files.filter((file) => /(^|[/\\])elcand\.csv$/i.test(file));
        const partyFile = downloaded.files.find((file) => /(^|[/\\])elpaty\.csv$/i.test(file));
        const areaFile = downloaded.files.find((file) => /(^|[/\\])elbase\.csv$/i.test(file));
        const partyMap = partyFile ? parsePartyFile(partyFile, resource.encoding) : new Map();
        const areaMap = areaFile ? parseAreaFile(areaFile, resource.encoding) : new Map();
        if (candidateFiles.length === 0 && downloaded.directFile) candidateFiles.push(downloaded.directFile);
        for (const candidateFile of candidateFiles) {
          parseCandidateFile(candidateFile, resource.encoding, {
            resource,
            areaMap,
            partyMap,
            parentText: path.dirname(candidateFile),
          });
        }
      } catch (error) {
        errors.push(`${resource.description || resource.url}: ${error.message}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const dedupedCandidates = [...new Map(parsedCandidates.map((candidate) => [candidate.id, candidate])).values()];
const previousOfficialCount = data.candidates.filter((candidate) => candidate.official && !candidate.demo).length;
let officialChanged = false;
let publicationMessage = "";

if (dedupedCandidates.length > 0) {
  const oldComparable = JSON.stringify(data.candidates.filter((candidate) => candidate.official && !candidate.demo));
  const newComparable = JSON.stringify(dedupedCandidates);
  officialChanged = oldComparable !== newComparable;
  if (officialChanged && previousOfficialCount > 0) {
    const historyName = `data/history/election-data-${taipeiDate(attemptAt)}-${hash(oldComparable, 8)}.json`;
    writeJson(historyName, data);
  }
  data.candidates = config.publishing.replaceDemoWhenOfficialCandidatesExist
    ? dedupedCandidates
    : [...data.candidates.filter((candidate) => !candidate.demo), ...dedupedCandidates];
  data.parties = [...parsedParties.values()];
  data.meta.mode = "official";
  data.meta.disclaimer = "候選人資料由中央選舉委員會公開資料自動匯入；司法紀錄仍須人工覆核。";
  publicationMessage = `已匯入 ${dedupedCandidates.length} 位官方候選人。`;
} else if (previousOfficialCount > 0) {
  publicationMessage = `本次未解析到新候選人，已保留上一版 ${previousOfficialCount} 位官方候選人。`;
} else {
  data.meta.mode = "demo-awaiting-official";
  publicationMessage = matchingResources.length
    ? "已發現 2026 選舉資源，但尚未解析到候選人檔；保留展示資料並等待人工檢查。"
    : "尚未發現 2026 正式候選人開放資料；保留展示資料。";
}

const success = metadataSucceeded > 0;
const officialCount = data.candidates.filter((candidate) => candidate.official && !candidate.demo).length;
const demoCount = data.candidates.filter((candidate) => candidate.demo).length;
data.meta.version = `${taipeiDate(attemptAt).replaceAll("-", ".")}-v6.1.13`;
data.meta.lastGeneratedAt = attemptAt;
data.sync = {
  schedule: "daily",
  timezone: config.timezone,
  plannedTime: config.scheduleLocalTime,
  status: success ? (errors.length ? "partial" : officialCount ? "official-data-active" : "waiting-official-release") : "failed",
  lastAttemptAt: attemptAt,
  lastSuccessAt: success ? attemptAt : data.sync?.lastSuccessAt || null,
  lastOfficialChangeAt: officialChanged || resourceSetChanged ? attemptAt : data.sync?.lastOfficialChangeAt || null,
  officialCandidateCount: officialCount,
  demoCandidateCount: demoCount,
  matchingResourceCount: matchingResources.length,
  resourceSetChanged,
  message: `${publicationMessage}${errors.length ? ` ${errors.length} 項警告。` : ""}`,
  errors,
  sources: sourceReports,
};

writeJson("data/election-data.json", data);
writeJson("data/sync-status.json", data.sync);

console.log(data.sync.message);
if (!success && config.datasets.some((source) => source.required)) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
