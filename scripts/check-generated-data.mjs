import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { ROOT, readJson } from "./lib.mjs";

const canonical = readJson("data/election-data.json");
const code = fs.readFileSync(path.join(ROOT, "data/candidates.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
if (JSON.stringify(canonical) !== JSON.stringify(sandbox.window.ELECTION_DATA)) {
  console.error("data/candidates.js 與 data/election-data.json 不一致，請執行 npm run build:data。");
  process.exit(1);
}

const manifestPath = path.join(ROOT, "data/manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("缺少 data/manifest.json，請執行 npm run build:shards。");
  process.exit(1);
}
const manifest = readJson("data/manifest.json");
const expectedPeople = (canonical.officeholders?.length || 0) + (canonical.candidates?.length || 0);
if (manifest.counts?.personFiles !== expectedPeople) {
  console.error(`人物分片數量不一致：manifest ${manifest.counts?.personFiles || 0} / canonical ${expectedPeople}`);
  process.exit(1);
}
for (const person of [...(canonical.officeholders || []), ...(canonical.candidates || [])]) {
  const file = path.join(ROOT, "data/people", `${person.id}.json`);
  if (!fs.existsSync(file)) {
    console.error(`缺少人物分片：data/people/${person.id}.json`);
    process.exit(1);
  }
}
for (const person of [...(canonical.officeholders || []), ...(canonical.candidates || [])]) {
  const localUrl = person.photo?.localUrl;
  if (localUrl && !fs.existsSync(path.join(ROOT, localUrl))) {
    console.error(`${person.id}: photo.localUrl 指向不存在的檔案 (${localUrl})`);
    process.exit(1);
  }
}
console.log(`前端資料與 canonical JSON 一致；人物分片 ${expectedPeople} 個、現任分區 ${manifest.counts?.currentFiles || 0} 個。`);
