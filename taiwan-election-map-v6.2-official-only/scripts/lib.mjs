import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

export function writeJson(relativePath, value) {
  const target = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

export function hash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

export function nowIso() {
  return new Date().toISOString();
}

export function taipeiDate(iso = nowIso()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "TaiwanElectionMap/2.0 (+public-data-sync)",
        accept: "application/json,text/csv,application/zip,application/octet-stream,*/*",
        ...(options.headers || {}),
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export function extractDistributions(payload) {
  const root = payload?.result ?? payload;
  const candidates = [root?.distribution, root?.resources, root?.resource, root?.data?.distribution];
  const array = candidates.find(Array.isArray) || [];
  return array.map((item, index) => ({
    index,
    description: String(item.resourceDescription ?? item.description ?? item.name ?? item.title ?? "").trim(),
    format: String(item.resourceFormat ?? item.format ?? "").trim().toUpperCase(),
    encoding: String(item.resourceCharacterEncoding ?? item.encoding ?? "").trim(),
    modifiedAt: String(item.resourceModifiedDate ?? item.modifiedDate ?? item.updated_at ?? "").trim(),
    url: String(item.resourceDownloadUrl ?? item.downloadURL ?? item.downloadUrl ?? item.url ?? "").trim(),
    raw: item,
  })).filter((item) => item.url);
}

export function decodeBuffer(buffer, preferred = "") {
  const labels = [];
  if (/big5|950/i.test(preferred)) labels.push("big5");
  if (/utf-?8/i.test(preferred)) labels.push("utf-8");
  labels.push("utf-8", "big5");
  for (const label of [...new Set(labels)]) {
    try {
      return new TextDecoder(label, { fatal: label === "utf-8" }).decode(buffer).replace(/^\uFEFF/, "");
    } catch {
      // Try the next encoding.
    }
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim().replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim().replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function listFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else result.push(full);
  }
  return result;
}

export function unzip(zipPath, destination) {
  fs.mkdirSync(destination, { recursive: true });
  execFileSync("unzip", ["-qq", "-o", zipPath, "-d", destination], { stdio: "pipe" });
}

export function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "resource";
}
