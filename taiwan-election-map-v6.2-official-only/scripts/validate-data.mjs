import { readJson } from "./lib.mjs";

const data = readJson("data/election-data.json");
const errors = [];
const warnings = [];
const candidateRequired = ["id", "name", "countyId", "district", "electionType", "partyId", "sources"];
const officeholderRequired = ["id", "name", "roleId", "role", "partyId", "district", "status", "sources"];
const allIds = new Set();
const counties = new Set((data.counties || []).map((item) => item.id));
const parties = new Set((data.parties || []).map((item) => item.id));
const roles = new Map((data.roles || []).map((item) => [item.id, item]));

if (!data.meta?.electionDate) errors.push("meta.electionDate 缺少");
if (!data.meta?.portalName) errors.push("meta.portalName 缺少");
if (!Array.isArray(data.candidates)) errors.push("candidates 必須是陣列");
if (!Array.isArray(data.officeholders)) errors.push("officeholders 必須是陣列");
if (!Array.isArray(data.roles) || data.roles.length === 0) errors.push("roles 必須是非空陣列");
if (!Array.isArray(data.counties) || data.counties.length !== 22) warnings.push(`縣市索引目前為 ${data.counties?.length || 0} 筆，不是 22 筆`);

for (const candidate of data.candidates || []) {
  for (const key of candidateRequired) {
    if (candidate[key] === undefined || candidate[key] === null || candidate[key] === "") errors.push(`${candidate.id || "未知候選人"}: 缺少 ${key}`);
  }
  if (allIds.has(candidate.id)) errors.push(`重複人物 ID: ${candidate.id}`);
  allIds.add(candidate.id);
  if (!counties.has(candidate.countyId)) errors.push(`${candidate.id}: countyId 不存在 (${candidate.countyId})`);
  if (!parties.has(candidate.partyId)) errors.push(`${candidate.id}: partyId 不存在 (${candidate.partyId})`);
  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) errors.push(`${candidate.id}: 至少需要一個來源`);
  if (candidate.official && !candidate.demo && !candidate.sources.some((source) => /^https?:\/\//.test(source.url || ""))) {
    errors.push(`${candidate.id}: 官方候選人缺少有效來源網址`);
  }
  if (candidate.photo) {
    const photoUrl = candidate.photo.localUrl || candidate.photo.url;
    if (!photoUrl) errors.push(`${candidate.id}: photo 缺少 localUrl 或 url`);
    if (candidate.photo.official && !/^https?:\/\//.test(candidate.photo.sourceUrl || "")) errors.push(`${candidate.id}: 官方照片缺少 sourceUrl`);
  }
}

for (const person of data.officeholders || []) {
  for (const key of officeholderRequired) {
    if (person[key] === undefined || person[key] === null || person[key] === "") errors.push(`${person.id || "未知現任公職"}: 缺少 ${key}`);
  }
  if (allIds.has(person.id)) errors.push(`重複人物 ID: ${person.id}`);
  allIds.add(person.id);
  const role = roles.get(person.roleId);
  if (!role) errors.push(`${person.id}: roleId 不存在 (${person.roleId})`);
  if (!parties.has(person.partyId)) errors.push(`${person.id}: partyId 不存在 (${person.partyId})`);
  if (role?.level !== "national" && person.roleId !== "legislator" && !person.countyId) errors.push(`${person.id}: 地方職務必須有 countyId`);
  if (person.countyId && !counties.has(person.countyId)) errors.push(`${person.id}: countyId 不存在 (${person.countyId})`);
  if (!Array.isArray(person.sources) || person.sources.length === 0) errors.push(`${person.id}: 至少需要一個來源`);
  if (!person.sources?.some((source) => /^https?:\/\//.test(source.url || ""))) errors.push(`${person.id}: 缺少有效官方來源網址`);
  if (person.status !== "incumbent") warnings.push(`${person.id}: status 不是 incumbent`);
  if (person.photo) {
    const photoUrl = person.photo.localUrl || person.photo.url;
    if (!photoUrl) errors.push(`${person.id}: photo 缺少 localUrl 或 url`);
    if (person.photo.official && !/^https?:\/\//.test(person.photo.sourceUrl || "")) errors.push(`${person.id}: 官方照片缺少 sourceUrl`);
    if (person.photo.official && !person.photo.credit) warnings.push(`${person.id}: 官方照片缺少 credit`);
  }
}

const officeholderIds = new Set((data.officeholders || []).map((item) => item.id));
if (officeholderIds.size !== (data.officeholders || []).length) errors.push("officeholders 有重複 ID");
if (!(data.officeholders || []).some((item) => item.roleId === "president")) warnings.push("現任資料沒有總統");
if (!(data.officeholders || []).some((item) => item.roleId === "vice-president")) warnings.push("現任資料沒有副總統");
if ((data.officeholders || []).filter((item) => item.roleId === "legislator").length > 0 && (data.officeholders || []).filter((item) => item.roleId === "legislator").length < 80) {
  warnings.push("立委資料少於 80 人，可能是部分同步結果");
}

if (!Array.isArray(data.history?.years)) warnings.push("history.years 尚未建立");
if (!Array.isArray(data.history?.results)) warnings.push("history.results 尚未建立");
for (const record of data.history?.results || []) {
  if (!record.id || !record.name || !record.year) errors.push(`歷屆資料缺少 id/name/year: ${record.id || record.name || "未知"}`);
  if (record.countyId && !counties.has(record.countyId)) errors.push(`${record.id}: 歷屆 countyId 不存在 (${record.countyId})`);
  if (record.partyId && !parties.has(record.partyId)) errors.push(`${record.id}: 歷屆 partyId 不存在 (${record.partyId})`);
  if (record.roleId && !roles.has(record.roleId)) warnings.push(`${record.id}: 歷屆 roleId 未在角色清單中 (${record.roleId})`);
  if (record.votes != null && Number.isNaN(Number(record.votes))) errors.push(`${record.id}: votes 必須為數字`);
  if (record.voteRate != null && Number.isNaN(Number(record.voteRate))) errors.push(`${record.id}: voteRate 必須為數字`);
  if (record.sourceType === "cec-official-history") {
    if (!record.personKey) errors.push(`${record.id}: 官方歷屆資料缺少 personKey`);
    if (!new Set(["exact", "probable", "review"]).has(record.identityConfidence)) errors.push(`${record.id}: identityConfidence 不合法`);
    if (!Array.isArray(record.sources) || !record.sources.some((source) => /^https?:\/\//.test(source.url || ""))) errors.push(`${record.id}: 官方歷屆資料缺少來源網址`);
  }
}
if (!Array.isArray(data.personHistory)) warnings.push("personHistory 尚未建立，建議執行 npm run sync:history");
if (!Array.isArray(data.partyHistory)) warnings.push("partyHistory 尚未建立，建議執行 npm run sync:history");
if (!Array.isArray(data.districtHistory)) warnings.push("districtHistory 尚未建立，建議執行 npm run sync:history");
if (data.history?.coverage?.officialRecordCount > 0) {
  const actualOfficial = (data.history?.results || []).filter((record) => record.sourceType === "cec-official-history").length;
  if (Number(data.history.coverage.officialRecordCount) !== actualOfficial) errors.push(`history.coverage.officialRecordCount 與實際筆數不一致（${data.history.coverage.officialRecordCount} / ${actualOfficial}）`);
}

if (errors.length) {
  console.error(`資料驗證失敗：\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`資料驗證成功：現任 ${data.officeholders.length} 人、候選人 ${data.candidates.length} 人、歷屆 ${data.history?.results?.length || 0} 筆、${data.counties.length} 個縣市、${data.parties.length} 個政黨、${data.roles.length} 種職務。`);
if (warnings.length) console.warn(`提醒：\n- ${warnings.join("\n- ")}`);
