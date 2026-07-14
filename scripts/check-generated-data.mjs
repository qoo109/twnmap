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
const allPeople = [...(canonical.officeholders || []), ...(canonical.candidates || [])];
const omittedRoles = new Set(manifest.peopleOmittedRoles || []);
const shardedPeople = allPeople.filter((person) => !omittedRoles.has(person.roleId));
const omittedPeople = allPeople.filter((person) => omittedRoles.has(person.roleId));

const manifestPersonFiles = Number(manifest.counts?.personFiles || 0);
const manifestOmitted = Number(manifest.counts?.personFilesOmitted || 0);

if (manifestPersonFiles !== shardedPeople.length) {
  console.error(
    `人物分片數量不一致：manifest ${manifestPersonFiles} / 應建立 ${shardedPeople.length}`
  );
  process.exit(1);
}

if (manifestOmitted !== omittedPeople.length) {
  console.error(
    `省略人物分片數量不一致：manifest ${manifestOmitted} / 應省略 ${omittedPeople.length}`
  );
  process.exit(1);
}

if (manifestPersonFiles + manifestOmitted !== allPeople.length) {
  console.error(
    `人物分片總數不一致：已建立 ${manifestPersonFiles} + 省略 ${manifestOmitted} / canonical ${allPeople.length}`
  );
  process.exit(1);
}

const peopleDir = path.join(ROOT, "data/people");
const actualPersonFiles = fs.existsSync(peopleDir)
  ? fs.readdirSync(peopleDir).filter((name) => name.endsWith(".json")).length
  : 0;

if (actualPersonFiles !== manifestPersonFiles) {
  console.error(
    `人物分片實際檔案數不一致：目錄 ${actualPersonFiles} / manifest ${manifestPersonFiles}`
  );
  process.exit(1);
}

for (const person of shardedPeople) {
  const file = path.join(ROOT, "data/people", `${person.id}.json`);
  if (!fs.existsSync(file)) {
    console.error(`缺少人物分片：data/people/${person.id}.json`);
    process.exit(1);
  }
}

for (const person of allPeople) {
  const localUrl = person.photo?.localUrl;
  if (localUrl && !fs.existsSync(path.join(ROOT, localUrl))) {
    console.error(`${person.id}: photo.localUrl 指向不存在的檔案 (${localUrl})`);
    process.exit(1);
  }
}

console.log(
  `前端資料與 canonical JSON 一致；人物分片 ${manifestPersonFiles} 個、`
  + `依大量資料策略省略 ${manifestOmitted} 個、現任分區 ${manifest.counts?.currentFiles || 0} 個。`
);
