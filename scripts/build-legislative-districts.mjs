import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, writeJson } from "./lib.mjs";

const sourceFile = path.join(ROOT, "data/sources/cec-legislative-districts-11.csv");
if (!fs.existsSync(sourceFile)) throw new Error(`找不到官方選區範圍 CSV：${sourceFile}`);

const counties = readJson("data/election-data.json").counties || [];
const normalize = (value) => String(value || "").replace(/^\uFEFF/, "").replaceAll("台", "臺").replace(/\s+/g, "").trim();
const countyByName = new Map(counties.map((county) => [normalize(county.name), county]));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseScope(rangeText, countyName) {
  const normalizedRange = normalize(rangeText);
  if (normalizedRange === normalize(countyName)) return { wholeCounty: true, fullTowns: [], partialTowns: [] };
  const [wholeTownText, ...partialSegments] = normalizedRange.split("－");
  const wholeTokens = wholeTownText.split("、").filter(Boolean);
  if (!partialSegments.length) return { wholeCounty: false, fullTowns: wholeTokens, partialTowns: [] };
  const partialText = partialSegments.join("－");
  const partialTown = wholeTokens.pop() || "";
  const villages = partialText.replace(/等\d+里$/u, "").split("、").map((value) => value.trim()).filter(Boolean);
  return {
    wholeCounty: false,
    fullTowns: wholeTokens,
    partialTowns: partialTown ? [{ town: partialTown, villages, statedVillageCount: Number(partialText.match(/等(\d+)里$/u)?.[1] || villages.length) }] : [],
  };
}

const rows = parseCsv(fs.readFileSync(sourceFile, "utf8"));
const districts = [];
for (const [rawName, rawRange] of rows.slice(1)) {
  const officialName = normalize(rawName);
  const countyName = [...countyByName.keys()].find((name) => officialName.startsWith(name));
  const county = countyByName.get(countyName);
  if (!county) throw new Error(`無法對應縣市：${rawName}`);
  const number = Number(officialName.match(/第(\d+)選舉區/u)?.[1] || 1);
  const scope = parseScope(rawRange, county.name);
  districts.push({
    id: `${county.id}-${String(number).padStart(2, "0")}`,
    countyId: county.id,
    countyName: county.name,
    number,
    name: officialName,
    historyDistrict: `${county.name}第${String(number).padStart(2, "0")}選區`,
    rangeText: normalize(rawRange),
    ...scope,
    geometryLevel: scope.wholeCounty ? "county" : scope.partialTowns.length ? "village-text-only" : "town",
  });
}

const output = {
  schemaVersion: 1,
  legislature: 11,
  electionYear: 2024,
  generatedAt: new Date().toISOString(),
  source: {
    name: "中央選舉委員會｜第11屆立法委員選舉區範圍",
    url: "https://data.gov.tw/dataset/170247",
    cecUrl: "https://data.cec.gov.tw/?dir=%E7%AC%AC11%E5%B1%86%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%E5%8D%80%E7%AF%84%E5%9C%8D",
    license: "政府資料開放授權條款第1版",
    retrievedAt: "2026-07-14",
  },
  count: districts.length,
  districts,
};

writeJson("data/legislative-districts-11.json", output);
fs.writeFileSync(path.join(ROOT, "data/legislative-districts-11.js"), `window.LEGISLATIVE_DISTRICTS = ${JSON.stringify(output)};\n`);
console.log(`已建立第 11 屆立法委員選舉區資料：${districts.length} 區。`);
