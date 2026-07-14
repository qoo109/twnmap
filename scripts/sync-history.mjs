import { readJson, writeJson, nowIso, taipeiDate } from "./lib.mjs";

const data = readJson("data/election-data.json");
const at = nowIso();
const results = Array.isArray(data.history?.results) ? data.history.results : [];
const partyById = new Map((data.parties || []).map((party) => [party.id, party]));
const countyById = new Map((data.counties || []).map((county) => [county.id, county]));

function normalizeName(value) {
  return String(value || "").replace(/[\s　·・．.]/g, "").trim();
}
function personKey(record) {
  return record.personKey || `${normalizeName(record.name)}-${record.countyId || "national"}`;
}
function cleanRecord(record) {
  return {
    ...record,
    year: Number(record.year) || null,
    votes: record.votes == null || record.votes === "" ? null : Number(record.votes),
    voteRate: record.voteRate == null || record.voteRate === "" ? null : Number(record.voteRate),
    elected: Boolean(record.elected),
  };
}

const cleanedResults = results.map(cleanRecord).filter((record) => record.id && record.name && record.year && record.partyId);
data.history = data.history || {};
data.history.results = cleanedResults;

const people = new Map();
for (const record of cleanedResults) {
  const key = personKey(record);
  if (!people.has(key)) people.set(key, []);
  people.get(key).push(record);
}
data.personHistory = [...people.entries()].map(([key, records]) => {
  records.sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || String(a.electionType || "").localeCompare(String(b.electionType || ""), "zh-Hant"));
  const transitions = [];
  for (const record of [...records].sort((a, b) => Number(a.year || 0) - Number(b.year || 0))) {
    const partyId = record.partyId || "other";
    if (!transitions.length || transitions.at(-1).partyId !== partyId) {
      const party = partyById.get(partyId);
      transitions.push({
        year: record.year,
        partyId,
        partyName: party?.shortName || party?.name || partyId,
        basis: "參選推薦政黨",
      });
    }
  }
  return {
    personKey: key,
    name: records[0]?.name || key,
    latestYear: records[0]?.year || null,
    recordCount: records.length,
    records,
    partyTransitions: transitions,
    identityConfidence: records.some((record) => record.identityConfidence === "review") ? "review" : records.some((record) => record.identityConfidence === "probable") ? "probable" : "exact",
    linkedCurrentIds: [...new Set(records.flatMap((record) => Array.isArray(record.linkedCurrentIds) ? record.linkedCurrentIds : []))],
  };
});

const years = [...new Set(cleanedResults.map((record) => Number(record.year)))].sort((a, b) => b - a);
const existingYearMeta = new Map((data.history.years || []).map((item) => [Number(item.year), item]));
data.history.years = years.map((year) => ({
  ...(existingYearMeta.get(year) || {}),
  year,
  label: existingYearMeta.get(year)?.label || `${year} 選舉`,
  status: cleanedResults.some((record) => Number(record.year) === year && record.sourceType === "cec-official-history") ? "official-imported" : "manual-import",
}));

const partyIds = [...new Set(cleanedResults.map((record) => record.partyId || "other"))].sort();
data.partyHistory = partyIds.map((partyId) => {
  const party = partyById.get(partyId);
  return {
    partyId,
    partyName: party?.shortName || party?.name || partyId,
    years: years.map((year) => {
      const subset = cleanedResults.filter((record) => record.partyId === partyId && Number(record.year) === year);
      const elected = subset.filter((record) => record.elected);
      const counties = {};
      for (const record of elected) counties[record.countyId || "unknown"] = (counties[record.countyId || "unknown"] || 0) + 1;
      return {
        year,
        candidates: subset.length,
        elected: elected.length,
        voteTotal: subset.reduce((sum, record) => sum + (Number(record.votes) || 0), 0),
        counties,
      };
    }).filter((row) => row.candidates > 0),
  };
}).filter((row) => row.years.length > 0);

const districts = new Map();
for (const record of cleanedResults) {
  const key = `${record.countyId || "unknown"}|${record.district || "未提供選區"}`;
  if (!districts.has(key)) districts.set(key, []);
  districts.get(key).push(record);
}
data.districtHistory = [...districts.entries()].map(([key, records]) => {
  const [countyId, district] = key.split("|");
  records.sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(a.rank || 999) - Number(b.rank || 999));
  return {
    countyId,
    countyName: countyById.get(countyId)?.name || countyId,
    district,
    records,
  };
});

data.history.lastIndexedAt = at;
data.history.indexStatus = cleanedResults.length ? "ok" : "empty";
data.history.message = cleanedResults.length
  ? `已建立 ${data.personHistory.length} 位人物、${data.partyHistory.length} 個政黨與 ${data.districtHistory.length} 個選區的歷屆索引。`
  : "尚未匯入歷屆結果；索引為空。";
data.history.plannedRefresh = "歷屆結果可手動匯入或由官方來源同步後重建索引。";
data.meta.version = `${taipeiDate(at).replaceAll("-", ".")}-v6.1.13`;
data.meta.lastGeneratedAt = at;

writeJson("data/election-data.json", data);
console.log(data.history.message);
