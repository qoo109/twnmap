# 台灣政治人物與選舉地圖 V6.1.1

互動式台灣行政區地圖，整合現任民選公職、地方政黨勢力、正式候選人、中選會歷屆結果、官方頭貼、人物軌跡與資料來源健康狀態。

網站是純靜態專案，可部署在 GitHub Pages。行政區圖資與地圖程式已內建；官方資料由 GitHub Actions 取得並寫回 repository。

## V6.1.1 新增

1. **立即完整更新**：管理後台一鍵執行現任公職、正式候選人、中選會核心歷屆全部年份、官方頭貼、異動報告與資料分片。
2. **執行進度監看**：按鈕會持續顯示排隊、執行、成功或失敗狀態。
3. **資料授權文件**：新增 [DATA_LICENSE.md](DATA_LICENSE.md)，整理官方開放資料顯名與抓取邊界。

## V6.1 原有功能

1. **第一次正式同步精靈**：在 `admin.html` 依序檢查權限、同步現任、同步核心歷屆及驗證發布結果。
2. **資料異動紀錄**：每次同步統計新增、移除、欄位變更、照片更新及歷屆增減。
3. **大量刪除守門**：現任名單突然大量減少時停止自動提交，避免官方頁面格式異常造成誤刪。
4. **混合式資料分片**：依縣市、人物與歷屆年份產生小型 JSON；離線版仍保留完整資料備援。
5. **官方頭貼本地化**：遠端官方照片轉成 WebP 保存於專案，降低防盜連及網址失效問題。
6. **資料錯誤回報**：人物頁可建立預填 GitHub Issue，回報不會直接修改公開資料。

完整紀錄見 [CHANGELOG_V6.1.md](CHANGELOG_V6.1.md) 與 [CHANGELOG_V6.1.1.md](CHANGELOG_V6.1.1.md)。

## 排程

| 排程 | 台灣時間 | 內容 |
|---|---:|---|
| Daily official data sync | 每天 03:00 | 現任公職、正式候選人、官方頭貼、異動報告及資料分片 |
| Weekly CEC history sync | 每週日 03:20 | 核心歷屆、人物索引、異動報告及歷屆分片 |

GitHub Actions 可能因平台負載延遲數分鐘。

## 第一次部署

1. 上傳全部檔案到 GitHub repository 根目錄。
2. 開啟 Actions 的 **Read and write permissions**。
3. 啟用 GitHub Pages。
4. 開啟 `admin.html`，使用「第一次正式同步精靈」。
5. 完成第四步後，再公開分享網站。

詳細步驟見 [SETUP_GITHUB.md](SETUP_GITHUB.md)。

## 本機開啟

完整解壓縮後可直接開啟 `index.html`。Safari 若限制 `file://`，在專案資料夾執行：

```bash
python3 -m http.server 8080
```

再開啟 `http://localhost:8080`。

## 常用指令

```bash
npm ci
npm test
npm run serve
npm run sync
npm run sync:history:official
npm run cache:portraits
npm run report:changes
npm run build:shards
npm run validate
```

## 資料結構

```text
data/election-data.json              主要 canonical 資料
data/candidates.js                   離線及完整資料備援
data/manifest.json                   分片清單與筆數
data/current/<county>.json           縣市現任與候選人分片
data/people/<person-id>.json         人物詳細分片
data/history-shards/<year>/<county>.json
                                      歷屆年度與縣市分片
data/change-log/latest.json          最近一次異動報告
data/change-log/<timestamp>.json     歷次異動報告
data/reports/portrait-cache.json     頭貼本地化結果
```

## 歷屆資料範圍

- `core`：總統／副總統、立委、直轄市長、縣市長、直轄市議員、縣市議員。
- `local`：再加入鄉鎮市長、原住民區長、鄉鎮市民代表與原住民區代表。
- `all`：再加入村里長；資料量最大。

## 資料安全

- 未正式公告的候選年度不顯示。
- 官方同步失敗時保留上一版。
- 大量刪除會被安全門檻攔截。
- 同名人物不只靠姓名自動合併。
- 司法資料仍需人工核身。
- GitHub Token 不寫入 repository。
- 照片只採官方或人工確認授權來源。
