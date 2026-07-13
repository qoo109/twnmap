import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  decodeBuffer,
  fetchWithTimeout,
  hash,
  nowIso,
  parseCsv,
  readJson,
  taipeiDate,
  writeJson,
} from "./lib.mjs";

const config = readJson("config/portal-sources.json");
const data = readJson("data/election-data.json");
const attemptAt = nowIso();
const officeConfig = config.officeholderSources;
const errors = [];
const reports = [];
const moiDiagnostics = [];
const existing = Array.isArray(data.officeholders) ? data.officeholders : [];
const roleById = new Map((data.roles || []).map((role) => [role.id, role]));
const countyById = new Map((data.counties || []).map((county) => [county.id, county]));
const countyNames = [...countyById.values()].map((county) => county.name).sort((a, b) => b.length - a.length);
const countyIdByName = new Map([...countyById.values()].map((county) => [normalizeTaiwan(county.name), county.id]));
const partyById = new Map((data.parties || []).map((party) => [party.id, party]));
const partyByName = new Map((data.parties || []).flatMap((party) => [
  [normalizeSpace(party.name), party.id],
  [normalizeSpace(party.shortName), party.id],
]));
const palette = ["#51458B", "#DC143C", "#1F8B76", "#6EC5DC", "#633F99", "#FFAE2B", "#8B00FF"];
const officeholderScope = String(process.env.OFFICEHOLDER_SCOPE || "full").toLowerCase();
const moiRequestDelayMs = Math.max(0, Number(process.env.MOI_REQUEST_DELAY_MS || 180));
const moiFetchRetries = Math.max(1, Number(process.env.MOI_FETCH_RETRIES || 3));
const moiPageConcurrency = Math.max(1, Math.min(5, Number(process.env.MOI_PAGE_CONCURRENCY || 3)));
const moiHardPageCap = Math.max(1, Number(process.env.MOI_HARD_PAGE_CAP || 600));
const standardLocalRoles = new Set(["municipal-councilor", "county-councilor", "municipal-mayor", "county-mayor", "township-mayor"]);

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchMoiHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= moiFetchRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, { headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        referer: "https://www.moi.gov.tw/LocalOfficial.aspx",
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 TaiwanElectionReportBot/6.1.7",
      } }, 120_000);
      const text = await response.text();
      if (!text || text.length < 500) throw new Error(`官方頁面內容過短（${text.length} bytes）`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < moiFetchRetries) await sleep(Math.min(5000, 700 * attempt));
    }
  }
  throw lastError || new Error("內政部頁面抓取失敗");
}

function normalizeTaiwan(value) {
  return String(value || "").replaceAll("台", "臺");
}

function normalizeSpace(value) {
  return normalizeTaiwan(String(value || ""))
    .replace(/\u00a0/g, " ")
    .replace(/[\s　]+/g, " ")
    .trim();
}

function decodeEntities(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToLines(html) {
  const cleaned = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const attrs = imageAttributes(tag);
      return `\n${attrs.alt || attrs.title || ""}\n`;
    })
    .replace(/<br\s*\/?\s*>/gi, "\n")
    // The MOI cards are mostly inline elements. Splitting on both opening and
    // closing tags keeps each visible field on its own line even when the
    // source HTML has no whitespace or line breaks.
    .replace(/<\/?(?:a|span|strong|b|em|small|label|option|p|li|div|section|article|h[1-6]|tr|td|th|figure|figcaption|dt|dd)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(cleaned)
    .split(/\r?\n/)
    .map(normalizeSpace)
    .filter(Boolean);
}

function countyIdFromText(text) {
  const normalized = normalizeTaiwan(text);
  for (const name of countyNames) {
    if (normalized.includes(normalizeTaiwan(name))) return countyIdByName.get(normalizeTaiwan(name));
  }
  const aliases = {
    臺北: "taipei", 新北: "new-taipei", 桃園: "taoyuan", 臺中: "taichung", 臺南: "tainan", 高雄: "kaohsiung",
    基隆: "keelung", 新竹市: "hsinchu-city", 新竹縣: "hsinchu-county", 苗栗: "miaoli", 彰化: "changhua", 南投: "nantou",
    雲林: "yunlin", 嘉義市: "chiayi-city", 嘉義縣: "chiayi-county", 屏東: "pingtung", 宜蘭: "yilan", 花蓮: "hualien",
    臺東: "taitung", 澎湖: "penghu", 金門: "kinmen", 連江: "lienchiang",
  };
  for (const [alias, id] of Object.entries(aliases)) if (normalized.includes(alias)) return id;
  return null;
}

function slug(value) {
  const clean = normalizeSpace(value)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return clean.slice(0, 70) || hash(value, 12);
}

function ensureParty(rawName) {
  let name = normalizeSpace(rawName || "無黨籍");
  if (!name || ["無", "無黨", "無黨籍", "未經政黨推薦", "無黨籍及未經政黨推薦"].includes(name)) return "ind";
  if (name.includes("民主進步黨") || name === "民進黨") return "dpp";
  if (name.includes("中國國民黨") || name === "國民黨") return "kmt";
  if (name.includes("臺灣民眾黨") || name.includes("台灣民眾黨") || name === "民眾黨") return "tpp";
  if (name.includes("時代力量")) return "npp";
  if (name.includes("臺灣基進") || name.includes("台灣基進") || name === "基進黨") return "tsp";
  if (name.includes("親民黨")) return "pfp";
  if (name.includes("無黨團結聯盟")) return "npsu";
  if (name.includes("臺灣團結聯盟") || name.includes("台灣團結聯盟") || name === "台聯黨") return "tsu";
  if (name === "新黨" || name.includes("新黨")) return "new-party";
  if (name.includes("臺灣綠黨") || name.includes("台灣綠黨") || name === "綠黨") return "green";
  if (name.includes("社會民主黨") || name === "社民黨") return "sdp";
  if (partyByName.has(name)) return partyByName.get(name);
  const id = `party-${slug(name)}-${hash(name, 5)}`;
  if (!partyById.has(id)) {
    const party = {
      id,
      name,
      shortName: name.slice(0, 8),
      color: palette[Number.parseInt(hash(name, 2), 16) % palette.length],
    };
    partyById.set(id, party);
    partyByName.set(name, id);
  }
  return id;
}

function roleName(roleId) {
  return roleById.get(roleId)?.name || roleId;
}

function rocDateToIso(value) {
  const text = normalizeSpace(value);
  const match = text.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) return null;
  return `${Number(match[1]) + 1911}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function normalizePhotoUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value), baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch { return null; }
}

function imageAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g)) attrs[match[1].toLowerCase()] = decodeEntities(match[2]);
  return attrs;
}

function photoMapFromHtml(html, baseUrl) {
  const map = new Map();
  for (const match of String(html || "").matchAll(/<img\b[^>]*>/gi)) {
    const attrs = imageAttributes(match[0]);
    const label = normalizeSpace(attrs.alt || attrs.title || "").replace(/^(?:image[:：]?|照片[:：]?)/i, "");
    const key = label.replace(/[\s　·・．.]/g, "");
    const url = normalizePhotoUrl(attrs["data-src"] || attrs["data-original"] || attrs.src, baseUrl);
    if (!url || key.length < 2 || key.length > 30 || !/[\u3400-\u9fff]/.test(key)) continue;
    map.set(key, { url, sourceUrl: baseUrl, sourceLabel: "官方人物照片", credit: new URL(baseUrl).hostname, official: true, retrievedAt: attemptAt });
  }
  return map;
}

function firstNamedPhoto(html, baseUrl, name) {
  const key = normalizeSpace(name).replace(/[\s　·・．.]/g, "");
  const map = photoMapFromHtml(html, baseUrl);
  if (map.has(key)) return map.get(key);
  for (const [label, photo] of map) if (label.includes(key) || key.includes(label)) return photo;
  return null;
}

function buildOfficeholder({ name, roleId, party, countyId, district, organization, title, termStart, sourceUrl, sourceLabel, sourceUpdatedAt, photo = null, extra = {} }) {
  const normalizedName = normalizeSpace(name);
  const normalizedOrg = normalizeSpace(organization || "");
  const normalizedDistrict = normalizeSpace(district || countyById.get(countyId)?.name || "全國");
  return {
    id: `${roleId}-${slug(normalizedName)}-${hash(`${normalizedName}|${countyId || "national"}|${normalizedDistrict}|${normalizedOrg}`, 8)}`,
    official: true,
    name: normalizedName,
    roleId,
    role: roleName(roleId),
    title: normalizeSpace(title || roleName(roleId)),
    partyId: ensureParty(party),
    countyId: countyId || null,
    district: normalizedDistrict || "全國",
    organization: normalizedOrg || (roleId === "legislator" ? "立法院" : ""),
    termStart: termStart || null,
    status: "incumbent",
    sourceUpdatedAt: sourceUpdatedAt || taipeiDate(attemptAt),
    photo: photo || undefined,
    sources: [{
      label: sourceLabel,
      url: sourceUrl,
      date: sourceUpdatedAt || taipeiDate(attemptAt),
      retrievedAt: attemptAt,
    }],
    ...extra,
  };
}

function objectRowsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeSpace(header).toLowerCase());
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeSpace(row[index] || "")])));
}

function pick(record, aliases) {
  for (const alias of aliases) {
    const exact = normalizeSpace(alias).toLowerCase();
    if (record[exact]) return record[exact];
    const key = Object.keys(record).find((candidate) => candidate.includes(exact));
    if (key && record[key]) return record[key];
  }
  return "";
}

function parseDirectOfficialRows(text, roleId, source) {
  const rows = objectRowsFromCsv(text);
  if (!rows.length) return { items: [], nestedUrls: [] };
  const headers = Object.keys(rows[0]);
  const looksCatalog = headers.some((header) => /連結網址|路徑|download|url/.test(header)) && !headers.some((header) => /姓名|idname|name/.test(header));
  if (looksCatalog) {
    const nestedUrls = rows
      .flatMap((row) => Object.values(row).filter((value) => /^https?:\/\//i.test(value)))
      .filter((url) => !url.includes("data.gov.tw/dataset/"));
    return { items: [], nestedUrls: [...new Set(nestedUrls)].slice(-5).reverse() };
  }
  const items = [];
  for (const record of rows) {
    const name = pick(record, ["姓名", "idname", "name", "人員姓名"]);
    if (!name || name.length > 30) continue;
    const countyText = pick(record, ["縣市別", "市縣別", "cityname", "縣市", "行政區"]);
    const organization = pick(record, ["機關別", "orgname", "機關", "議會", "代表會"]);
    const position = pick(record, ["職稱", "posiname", "職位"]);
    const party = pick(record, ["黨籍", "partymship", "政黨"]);
    const district = pick(record, ["選舉區別", "選舉區", "district", "鄉鎮市區", "村里"]);
    const countyId = countyIdFromText(`${countyText} ${organization} ${district}`);
    if (!countyId && roleById.get(roleId)?.level !== "national") continue;
    const photoUrl = pick(record, ["照片網址", "相片網址", "圖片網址", "photourl", "photo_url", "photo", "image"]);
    items.push(buildOfficeholder({
      name,
      roleId,
      party,
      countyId,
      district: district || countyText,
      organization,
      title: position || roleName(roleId),
      sourceUrl: source.url,
      sourceLabel: `內政部公開資料：${source.id}`,
      sourceUpdatedAt: pick(record, ["更新日期", "upddate", "資料日期", "上架日期"]) || taipeiDate(attemptAt),
      photo: normalizePhotoUrl(photoUrl, source.url) ? { url: normalizePhotoUrl(photoUrl, source.url), sourceUrl: source.url, sourceLabel: `官方資料照片：${source.id}`, credit: "內政部", official: true, retrievedAt: attemptAt } : null,
      extra: {
        education: pick(record, ["學歷", "education"]) || undefined,
        experience: pick(record, ["經歷", "profession", "experience"]) || undefined,
        officeAddress: pick(record, ["辦公地址", "辦公處地址", "地址"]) || undefined,
        officePhone: pick(record, ["電話", "聯絡電話"]) || undefined,
      },
    }));
  }
  return { items, nestedUrls: [] };
}

function moiRolePattern(roleId) {
  return {
    "municipal-councilor": /(議長|副議長|代理議長|代理副議長|議員)\s*$/,
    "county-councilor": /(議長|副議長|代理議長|代理副議長|議員)\s*$/,
    "township-representative": /(代表會主席|代表會副主席|主席|副主席|代表)\s*$/,
    "indigenous-district-representative": /(代表會主席|代表會副主席|主席|副主席|代表)\s*$/,
    "municipal-mayor": /(代理)?市長\s*$/,
    "county-mayor": /(代理)?縣長\s*$/,
    "township-mayor": /(代理)?(?:鄉長|鎮長|市長)\s*$/,
    "village-chief": /(代理)?(?:村長|里長)\s*$/,
    "indigenous-district-mayor": /(代理)?區長\s*$/,
  }[roleId] || /(議員|代表|市長|縣長|鄉長|鎮長|區長|村長|里長)\s*$/;
}

function isPartyText(value) {
  const text = normalizeSpace(value).replace(/[：:]$/, "");
  if (!text || text.length > 40) return false;
  if (/^(?:無|無黨|無黨籍|未經政黨推薦|無黨籍及未經政黨推薦)$/.test(text)) return true;
  return /(?:中國國民黨|民主進步黨|臺灣民眾黨|台灣民眾黨|時代力量|親民黨|新黨|臺灣基進|台灣基進|臺灣綠黨|台灣綠黨|綠黨|社會民主黨|無黨團結聯盟|臺灣團結聯盟|台灣團結聯盟|台聯黨|黨)$/.test(text);
}

function cleanMoiName(value) {
  return normalizeSpace(value)
    .replace(/^(?:Image[:：]?|照片[:：]?)/i, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

function plausibleMoiName(value) {
  const name = cleanMoiName(value);
  if (name.length < 2 || name.length > 30) return false;
  if (!/[\u3400-\u9fff]/.test(name)) return false;
  if (/資料查詢|詳細資訊|送出查詢|清除|選擇.*匯出|選舉年度|縣市別|鄉鎮市區別|村里別|每頁筆數|回上一頁|地方公職|更新日期|開啟懸浮視窗/.test(name)) return false;
  if (countyIdFromText(name) || isPartyText(name)) return false;
  if (moiRolePattern("fallback").test(name)) return false;
  return /^[\p{L}·・．.]+$/u.test(name);
}

function parseMoiCardLines(cardLines, source, pageUrl, officialPhotos) {
  const lines = cardLines.map(normalizeSpace).filter(Boolean);
  const rolePattern = moiRolePattern(source.roleId);
  let roleIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (rolePattern.test(lines[index])) { roleIndex = index; break; }
  }
  if (roleIndex < 0) return null;

  let partyIndex = -1;
  for (let index = lines.length - 1; index > roleIndex; index -= 1) {
    if (isPartyText(lines[index])) { partyIndex = index; break; }
  }
  if (partyIndex < 0) return null;

  const organization = lines[roleIndex];
  let countyIndex = -1;
  let countyId = countyIdFromText(organization);
  for (let index = roleIndex - 1; index >= Math.max(0, roleIndex - 30); index -= 1) {
    const candidate = countyIdFromText(lines[index]);
    if (candidate) {
      countyIndex = index;
      countyId = candidate;
      break;
    }
  }
  if (!countyId) return null;

  const nameSearchFrom = countyIndex >= 0 ? countyIndex - 1 : roleIndex - 1;
  let name = "";
  for (let index = nameSearchFrom; index >= Math.max(0, nameSearchFrom - 30); index -= 1) {
    if (plausibleMoiName(lines[index])) {
      name = cleanMoiName(lines[index]);
      break;
    }
  }
  if (!name) return null;

  const party = lines[partyIndex];
  const titleMatch = organization.match(rolePattern);
  const title = normalizeSpace(titleMatch?.[0] || roleName(source.roleId));
  const photoKey = name.replace(/[\s　·・．.]/g, "");
  const photo = officialPhotos.get(photoKey) || null;
  return buildOfficeholder({
    name,
    roleId: source.roleId,
    party,
    countyId,
    district: organization,
    organization,
    title,
    sourceUrl: pageUrl,
    sourceLabel: `內政部地方公職人員資訊專區：${source.name}`,
    sourceUpdatedAt: taipeiDate(attemptAt),
    photo,
  });
}

function detailCardWindows(lines) {
  const windows = [];
  let previousDetail = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/詳細資訊/.test(lines[index])) continue;
    // A card can contain duplicate alt/name text and hidden accessibility text,
    // so keep a generous window but never cross the previous card boundary.
    const start = Math.max(previousDetail + 1, index - 45);
    windows.push(lines.slice(start, index + 1));
    previousDetail = index;
  }
  return windows;
}

function pageTotalRecords(html, lines) {
  const plain = normalizeSpace(decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")));
  const matches = [...plain.matchAll(/\/\s*([\d,]{1,8})(?=\s|$)/g)]
    .map((match) => Number(match[1].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (matches.length) return Math.max(...matches);
  const lineMatches = lines.flatMap((line) => [...line.matchAll(/\/\s*([\d,]{1,8})/g)])
    .map((match) => Number(match[1].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return lineMatches.length ? Math.max(...lineMatches) : 0;
}

function parseMoiPage(html, source, pageUrl) {
  const officialPhotos = photoMapFromHtml(html, pageUrl);
  let lines = htmlToLines(html);
  const start = lines.findIndex((line) => line === "資料查詢" || line.includes("資料查詢"));
  const end = lines.findIndex((line, index) => index > Math.max(start, -1) && (line.includes("您目前未啟用 JavaScript") || line === "回上一頁"));
  if (start >= 0) lines = lines.slice(start, end > start ? end : undefined);

  const items = [];
  const windows = detailCardWindows(lines);
  for (const window of windows) {
    const item = parseMoiCardLines(window, source, pageUrl, officialPhotos);
    if (item) items.push(item);
  }

  // Some MOI templates omit the visible detail link. Fall back to role-line
  // windows so a small HTML redesign does not zero the whole dataset.
  if (!items.length) {
    const rolePattern = moiRolePattern(source.roleId);
    for (let index = 0; index < lines.length; index += 1) {
      if (!rolePattern.test(lines[index])) continue;
      const window = lines.slice(Math.max(0, index - 35), Math.min(lines.length, index + 12));
      const item = parseMoiCardLines(window, source, pageUrl, officialPhotos);
      if (item) items.push(item);
    }
  }

  const deduped = [...new Map(items.map((item) => [item.id, item])).values()];
  const totalRecords = pageTotalRecords(html, lines) || deduped.length;
  const requestedPageSize = Math.max(1, Number(new URL(pageUrl).searchParams.get("PageSize") || 16));
  const observedPageSize = deduped.length;
  const supportedPageSizes = new Set([10, 16, 20, 50, 100, 200]);
  const effectivePageSize = totalRecords > observedPageSize && supportedPageSizes.has(observedPageSize)
    ? observedPageSize
    : requestedPageSize;
  const totalPages = Math.max(1, Math.ceil(totalRecords / Math.max(1, effectivePageSize)));
  const detailMarkerCount = lines.filter((line) => /詳細資訊/.test(line)).length;
  const roleLineCount = lines.filter((line) => moiRolePattern(source.roleId).test(line)).length;
  return {
    items: deduped,
    totalPages,
    diagnostics: {
      lineCount: lines.length,
      roleLineCount,
      detailMarkerCount,
      totalRecords,
      requestedPageSize,
      observedPageSize,
      effectivePageSize,
      hasDataQuery: lines.some((line) => line.includes("資料查詢")),
      sample: lines.filter((line) => /詳細資訊|議員|市長|縣長|鄉長|鎮長|代表|村長|里長|民主進步黨|中國國民黨|無黨/.test(line)).slice(0, 24),
    },
  };
}

function withPage(url, page, pageSize = 200, includeSms = true) {
  const target = new URL(url);
  target.searchParams.set("PageSize", String(pageSize));
  target.searchParams.set("page", String(page));
  if (includeSms && !target.searchParams.has("sms")) target.searchParams.set("sms", "11395");
  if (!includeSms) target.searchParams.delete("sms");
  return target.toString();
}

async function probeMoiFirstPage(source) {
  const candidates = [];
  const seen = new Set();
  for (const pageSize of [200, 100, 50, 20, 16]) {
    for (const includeSms of [true, false]) {
      const url = withPage(source.url, 1, pageSize, includeSms);
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const html = await fetchMoiHtml(url);
        const parsed = parseMoiPage(html, source, url);
        candidates.push({ url, pageSize, includeSms, htmlLength: html.length, ...parsed });
        if (parsed.items.length >= Math.min(pageSize, 50)) break;
      } catch (error) {
        candidates.push({ url, pageSize, includeSms, items: [], totalPages: 1, diagnostics: { error: error.message } });
      }
    }
    const bestNow = candidates.reduce((best, item) => (item.items?.length || 0) > (best.items?.length || 0) ? item : best, candidates[0] || { items: [] });
    if ((bestNow.items?.length || 0) >= Math.min(pageSize, 50)) break;
  }
  candidates.sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));
  const best = candidates[0] || { url: withPage(source.url, 1), items: [], totalPages: 1, diagnostics: { error: "無可用回應" }, pageSize: 200, includeSms: true };
  return { best, probes: candidates.map((item) => ({ url: item.url, count: item.items?.length || 0, totalPages: item.totalPages || 1, diagnostics: item.diagnostics })) };
}

async function syncMoiRole(source) {
  const collected = [];
  const { best: first, probes } = await probeMoiFirstPage(source);
  collected.push(...(first.items || []));

  const totalPages = Math.max(1, Number(first.totalPages || 1));
  const pages = officeholderScope === "full" ? Math.min(totalPages, moiHardPageCap) : 1;
  const pageDiagnostics = [{ page: 1, count: first.items?.length || 0, ...first.diagnostics }];
  const pageNumbers = Array.from({ length: Math.max(0, pages - 1) }, (_, index) => index + 2);
  const results = await mapConcurrent(pageNumbers, moiPageConcurrency, async (page, index) => {
    if (moiRequestDelayMs) await sleep(moiRequestDelayMs * ((index % moiPageConcurrency) + 1));
    const url = withPage(source.url, page, first.pageSize || 200, first.includeSms !== false);
    let html = await fetchMoiHtml(url);
    let parsed = parseMoiPage(html, source, url);
    if (!parsed.items.length && first.includeSms !== false) {
      const fallbackUrl = withPage(source.url, page, first.pageSize || 200, false);
      html = await fetchMoiHtml(fallbackUrl);
      parsed = parseMoiPage(html, source, fallbackUrl);
    }
    return { page, ...parsed };
  });

  for (const result of results) {
    if (result?.__error) {
      pageDiagnostics.push({ page: null, count: 0, error: result.__error.message });
      continue;
    }
    collected.push(...(result.items || []));
    pageDiagnostics.push({ page: result.page, count: result.items?.length || 0, ...result.diagnostics });
  }

  const items = [...new Map(collected.map((item) => [item.id, item])).values()];
  const diagnostics = {
    selectedUrl: first.url,
    selectedPageSize: first.pageSize || first.diagnostics?.requestedPageSize || 200,
    pagesPlanned: pages,
    pagesFetched: 1 + results.filter((item) => item && !item.__error).length,
    totalRecords: first.diagnostics?.totalRecords || items.length,
    probes,
    emptyPages: pageDiagnostics.filter((item) => item.page && item.count === 0).map((item) => item.page),
    firstPage: first.diagnostics,
  };
  moiDiagnostics.push({ id: source.id, name: source.name, roleId: source.roleId, count: items.length, checkedAt: attemptAt, ...diagnostics });
  return { items, diagnostics };
}

async function fetchDatasetItems(source, depth = 0) {
  const response = await fetchWithTimeout(source.url, {}, 120_000);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  if (/html/i.test(contentType) || buffer.subarray(0, 1).toString() === "<") {
    return parseMoiPage(decodeBuffer(buffer, "utf-8"), source, source.url).items;
  }
  // ZIP/XLSX/ODS cannot be safely parsed without dependencies; the MOI HTML page remains the fallback.
  if (buffer.subarray(0, 2).toString("hex") === "504b") return [];
  const text = decodeBuffer(buffer, "");
  const parsed = parseDirectOfficialRows(text, source.roleId, source);
  if (parsed.items.length || depth >= 2) return parsed.items;
  const nested = [];
  for (const nestedUrl of parsed.nestedUrls) {
    try {
      nested.push(...await fetchDatasetItems({ ...source, url: nestedUrl }, depth + 1));
    } catch (error) {
      errors.push(`${source.id} nested ${nestedUrl}: ${error.message}`);
    }
  }
  return nested;
}

function detailLinksFromLegislature(html, baseUrl) {
  const cutoff = html.search(/離職\s*立法委員名單/i);
  const currentHtml = cutoff >= 0 ? html.slice(0, cutoff) : html;
  const links = [];
  const regex = /<a\b[^>]*href=["']([^"']*Pages\/List\.aspx\?nodeid=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(currentHtml))) {
    const label = normalizeSpace(htmlToLines(match[2]).join(" ")).replace(/委員$/, "");
    if (!label || label.length > 30 || !/[\u3400-\u9fff]/.test(label)) continue;
    if (/本屆立委|歷屆立委|立委查詢|回首頁|發言紀錄|提案紀錄|委員會/.test(label)) continue;
    links.push({ name: label, url: new URL(decodeEntities(match[1]), baseUrl).toString() });
  }
  return [...new Map(links.map((item) => [item.url, item])).values()];
}

function parseLegislatorDetail(html, entry, source) {
  const lines = htmlToLines(html);
  const text = lines.join("\n");
  const party = text.match(/黨籍[：:]\s*([^\n]+)/)?.[1];
  const district = text.match(/選區[：:]\s*([^\n]+)/)?.[1];
  if (!party || !district) return null;
  const name = normalizeSpace(text.match(/###?\s*([^\n]+?)委員/)?.[1] || entry.name).replace(/委員$/, "");
  const countyId = countyIdFromText(district);
  const termStart = rocDateToIso(text.match(/到職日期[：:]\s*([^\n]+)/)?.[1] || "");
  const gender = text.match(/性別[：:]\s*([^\n]+)/)?.[1] || "";
  const photo = firstNamedPhoto(html, entry.url, name);
  return buildOfficeholder({
    name,
    roleId: source.roleId,
    party,
    countyId,
    district,
    organization: "立法院",
    title: "立法委員",
    termStart,
    sourceUrl: entry.url,
    sourceLabel: `立法院本屆立委：${name}`,
    sourceUpdatedAt: taipeiDate(attemptAt),
    photo: photo ? { ...photo, sourceLabel: `立法院官方照片：${name}`, credit: "立法院" } : null,
    extra: { gender: normalizeSpace(gender) || undefined },
  });
}

async function mapConcurrent(entries, limit, mapper) {
  const results = new Array(entries.length);
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      try { results[index] = await mapper(entries[index], index); }
      catch (error) { results[index] = { __error: error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, entries.length || 1) }, worker));
  return results;
}

async function syncLegislature(source) {
  const response = await fetchWithTimeout(source.url, { headers: { accept: "text/html,*/*" } }, 90_000);
  const html = await response.text();
  const links = detailLinksFromLegislature(html, source.url);
  if (!links.length) throw new Error("無法從本屆立委頁面解析個人連結");
  const results = await mapConcurrent(links, 6, async (entry) => {
    const detail = await fetchWithTimeout(entry.url, { headers: { accept: "text/html,*/*" } }, 90_000);
    return parseLegislatorDetail(await detail.text(), entry, source);
  });
  for (const result of results) if (result?.__error) errors.push(`立委個人頁：${result.__error.message}`);
  return results.filter((item) => item && !item.__error);
}

function minimumExpected(roleId) {
  return {
    legislator: 80,
    "municipal-mayor": 5,
    "county-mayor": 10,
    "municipal-councilor": 200,
    "county-councilor": 100,
    "township-mayor": 100,
    "township-representative": 500,
    "indigenous-district-mayor": 3,
    "indigenous-district-representative": 20,
    "village-chief": 3000,
  }[roleId] || 1;
}

async function main() {
  const replacementByRole = new Map();

  // Presidency is stored as verified seed data. The daily job checks that the source pages remain reachable.
  for (const source of officeConfig.presidency || []) {
    try {
      await fetchWithTimeout(source.url, { headers: { accept: "text/html,*/*" } }, 60_000);
      reports.push({ id: source.id, name: source.name, status: "ok", count: existing.filter((item) => item.roleId === source.roleId).length, checkedAt: attemptAt, url: source.url });
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
      reports.push({ id: source.id, name: source.name, status: "error", count: existing.filter((item) => item.roleId === source.roleId).length, checkedAt: attemptAt, url: source.url, message: error.message });
    }
  }

  // Try compact government dataset downloads first. If they are catalogs or binary office files, HTML pages are used below.
  const datasetResults = new Map();
  const datasetSources = (officeConfig.officialDatasets || []).filter((source) => officeholderScope === "full" || standardLocalRoles.has(source.roleId));
  for (const source of datasetSources) {
    try {
      const items = [...new Map((await fetchDatasetItems(source)).map((item) => [item.id, item])).values()];
      if (items.length >= minimumExpected(source.roleId)) datasetResults.set(source.roleId, items);
      reports.push({ id: source.id, name: source.id, status: items.length ? "parsed" : "fallback-needed", count: items.length, checkedAt: attemptAt, url: source.url });
    } catch (error) {
      errors.push(`${source.id}: ${error.message}`);
      reports.push({ id: source.id, name: source.id, status: "error", count: 0, checkedAt: attemptAt, url: source.url, message: error.message });
    }
  }

  try {
    const source = officeConfig.legislature;
    const items = await syncLegislature(source);
    if (items.length < minimumExpected(source.roleId)) throw new Error(`僅解析到 ${items.length} 位，低於安全門檻`);
    replacementByRole.set(source.roleId, items);
    reports.push({ id: source.id, name: source.name, status: "ok", count: items.length, checkedAt: attemptAt, url: source.url });
  } catch (error) {
    errors.push(`立法院本屆立委: ${error.message}`);
    reports.push({ id: officeConfig.legislature.id, name: officeConfig.legislature.name, status: "preserved-previous", count: existing.filter((item) => item.roleId === "legislator").length, checkedAt: attemptAt, url: officeConfig.legislature.url, message: error.message });
  }

  const localSources = (officeConfig.localPages || []).filter((source) => officeholderScope === "full" || standardLocalRoles.has(source.roleId));
  for (const source of localSources) {
    if (datasetResults.has(source.roleId)) {
      const items = datasetResults.get(source.roleId);
      replacementByRole.set(source.roleId, items);
      reports.push({ id: `${source.id}-publish`, name: source.name, status: "ok-dataset", count: items.length, checkedAt: attemptAt, url: source.url });
      continue;
    }
    try {
      const result = await syncMoiRole(source);
      const items = result.items;
      if (items.length < minimumExpected(source.roleId)) {
        const detail = result.diagnostics?.firstPage || {};
        throw new Error(`僅解析到 ${items.length} 位，低於安全門檻（首頁職稱列 ${detail.roleLineCount || 0}、詳細標記 ${detail.detailMarkerCount || 0}）`);
      }
      replacementByRole.set(source.roleId, items);
      reports.push({ id: source.id, name: source.name, status: "ok-html", count: items.length, checkedAt: attemptAt, url: source.url, diagnostics: result.diagnostics });
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
      reports.push({ id: source.id, name: source.name, status: "preserved-previous", count: existing.filter((item) => item.roleId === source.roleId).length, checkedAt: attemptAt, url: source.url, message: error.message });
    }
  }

  const untouched = existing.filter((item) => !replacementByRole.has(item.roleId));
  const replacements = [...replacementByRole.values()].flat();
  const existingById = new Map(existing.map((item) => [item.id, item]));
  for (const item of replacements) { if (!item.photo && existingById.get(item.id)?.photo) item.photo = existingById.get(item.id).photo; }
  const merged = [...new Map([...untouched, ...replacements].map((item) => [item.id, item])).values()]
    .sort((a, b) => (a.roleId.localeCompare(b.roleId, "zh-Hant") || a.countyId?.localeCompare(b.countyId || "", "zh-Hant") || a.name.localeCompare(b.name, "zh-Hant")));

  const oldComparable = JSON.stringify(existing);
  const newComparable = JSON.stringify(merged);
  const changed = oldComparable !== newComparable;
  if (changed && existing.length > 2) {
    writeJson(`data/history/officeholders-${taipeiDate(attemptAt)}-${hash(oldComparable, 8)}.json`, {
      archivedAt: attemptAt,
      officeholders: existing,
      officeholderSync: data.officeholderSync || null,
    });
  }

  data.officeholders = merged;
  data.parties = [...partyById.values()];
  data.meta.version = `${taipeiDate(attemptAt).replaceAll("-", ".")}-v6.1.7`;
  data.meta.lastGeneratedAt = attemptAt;
  const localCount = merged.filter((item) => !["president", "vice-president", "legislator"].includes(item.roleId)).length;
  const legislatorCount = merged.filter((item) => item.roleId === "legislator").length;
  const replacedRoles = [...replacementByRole.keys()];
  const success = replacedRoles.length > 0 || reports.some((report) => report.status === "ok");
  const officialPhotoCount = merged.filter((item) => item.photo?.official && (item.photo.url || item.photo.localUrl)).length;
  data.photoSync = { status: officialPhotoCount ? "active-or-partial" : "waiting", lastAttemptAt: attemptAt, lastSuccessAt: officialPhotoCount ? attemptAt : data.photoSync?.lastSuccessAt || null, photoCount: merged.filter((item) => item.photo?.url || item.photo?.localUrl).length, officialPhotoCount, message: `目前有 ${officialPhotoCount} 張可追溯官方頭貼；其餘人物以姓名縮寫顯示。` };
  data.officeholderSync = {
    status: errors.length ? (success ? "partial" : "failed") : "ok",
    schedule: "daily",
    timezone: config.timezone,
    plannedTime: config.scheduleLocalTime,
    lastAttemptAt: attemptAt,
    lastSuccessAt: success ? attemptAt : data.officeholderSync?.lastSuccessAt || null,
    lastOfficialChangeAt: changed ? attemptAt : data.officeholderSync?.lastOfficialChangeAt || null,
    officeholderCount: merged.length,
    localOfficeholderCount: localCount,
    legislatorCount,
    replacedRoles,
    preservedRoles: [...new Set(existing.map((item) => item.roleId))].filter((roleId) => !replacementByRole.has(roleId)),
    message: changed
      ? `現任公職資料已更新，共 ${merged.length} 人（立委 ${legislatorCount}、地方 ${localCount}）。`
      : `本次未發布人物異動，保留 ${merged.length} 位現任公職資料。`,
    coverage: {
      presidency: merged.some((item) => item.roleId === "president") && merged.some((item) => item.roleId === "vice-president") ? "active" : "missing",
      legislature: legislatorCount >= minimumExpected("legislator") ? "active" : "waiting-or-preserved",
      local: localCount > 0 ? "active-or-partial" : "waiting-first-sync",
    },
    errors,
    scope: officeholderScope,
    sources: reports,
  };

  writeJson("data/reports/moi-parser-diagnostics.json", {
    generatedAt: attemptAt,
    scope: officeholderScope,
    diagnostics: moiDiagnostics,
  });
  writeJson("data/election-data.json", data);
  writeJson("data/officeholder-sync-status.json", data.officeholderSync);
  console.log(data.officeholderSync.message);
  if (!success) process.exitCode = 1;
}

export { htmlToLines, parseMoiPage };

if (process.env.MOI_PARSER_TEST !== "1") await main();
