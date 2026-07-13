import assert from "node:assert/strict";
import { parseMoiPage } from "./sync-officeholders.mjs";

const source = { roleId: "village-chief", name: "村里長" };
const baseUrl = "https://www.moi.gov.tw/LocalOfficial.aspx?PageSize=200&TYP=KND0007&n=577&page=1&sms=11395";

// Fixture 1: fields separated by ordinary card tags.
const html = `<!doctype html><html><body>
<div>資料查詢</div>
<div class="card">
  <img alt="莊 欽億" src="/images/a.jpg">
  <span>莊欽億</span><span>臺北市</span>
  <span>臺北市中山區大佳里 里長</span>
  <span>民主進步黨</span><a>詳細資訊</a>
</div>
<div class="card">
  <img alt="鄧 麗珠" src="/images/b.jpg">
  <span>鄧麗珠</span><span>臺北市</span>
  <span>臺北市中山區新庄里 里長</span>
  <span>無</span><a>詳細資訊</a>
</div>
<div class="card">
  <img alt="羅 仲瑜" src="/images/c.jpg">
  <span>羅仲瑜</span><span>臺北市</span>
  <span>臺北市中山區行政里 代理里長</span>
  <span>無</span><a>詳細資訊</a>
</div>
<div>每頁筆數 10 16 20 50 100 200</div><div>/7730</div>
<div>您目前未啟用 JavaScript</div>
</body></html>`;

const parsed = parseMoiPage(html, source, baseUrl);
assert.equal(parsed.items.length, 3);
assert.equal(parsed.items[0].name, "莊欽億");
assert.equal(parsed.items[0].countyId, "taipei");
assert.equal(parsed.items[0].partyId, "dpp");
assert.equal(parsed.items[1].partyId, "ind");
assert.equal(parsed.items[2].title, "代理里長");
assert.equal(parsed.totalPages, 39);
assert.equal(parsed.diagnostics.roleLineCount, 3);

// Fixture 2: the real site frequently renders cards without whitespace between
// inline tags. The parser must still split name/county/title/party correctly.
const compactHtml = `<!doctype html><html><body><main><div>資料查詢</div>
<ul><li><figure><img alt="蔣 築諠" data-src="/p/1.jpg"></figure><div><a>蔣築諠</a><span>臺北市</span><span>臺北市中山區松江里 里長</span><span>中國國民黨</span><a href="/detail/1">詳細資訊</a></div></li>
<li><figure><img alt="陳 育群" src="/p/2.jpg"></figure><div><a>陳育群</a><span>臺北市</span><span>臺北市中山區正守里 里長</span><span>無</span><a href="/detail/2"><strong>詳細資訊</strong></a></div></li></ul>
<div>每頁筆數 10 16 20 50 100 200 go / 7728</div><div>您目前未啟用 JavaScript</div></main></body></html>`;
const compact = parseMoiPage(compactHtml, source, baseUrl);
assert.equal(compact.items.length, 2);
assert.deepEqual(compact.items.map((item) => item.name), ["蔣築諠", "陳育群"]);
assert.deepEqual(compact.items.map((item) => item.partyId), ["kmt", "ind"]);
assert.equal(compact.totalPages, 39);

// Fixture 3: some page templates omit the visible detail link. Role-line
// fallback must still recover the card.
const noDetailHtml = `<!doctype html><html><body><div>資料查詢</div><article>
<img alt="林 姿吟" src="/p/3.jpg"><span>林姿吟</span><span>臺北市</span><span>臺北市中山區晴光里 里長</span><span>無</span>
</article><div>/16</div><div>回上一頁</div></body></html>`;
const noDetail = parseMoiPage(noDetailHtml, source, baseUrl);
assert.equal(noDetail.items.length, 1);
assert.equal(noDetail.items[0].name, "林姿吟");

console.log("MOI parser fixtures passed:", parsed.items.length + compact.items.length + noDetail.items.length, "records");
