import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson } from "./lib.mjs";

const data = readJson("data/election-data.json");
data.meta = { ...(data.meta || {}), portalName: "台灣選舉報報" };
fs.writeFileSync(path.join(ROOT, "data/election-data.json"), `${JSON.stringify(data, null, 2)}\n`);
const output = `/* Auto-generated from data/election-data.json. Do not edit directly. */\nwindow.ELECTION_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, "data/candidates.js"), output);
console.log(`已產生 data/candidates.js（現任 ${data.officeholders?.length || 0} 人、候選人 ${data.candidates?.length || 0} 人、歷屆結果 ${data.history?.results?.length || 0} 筆）。`);
