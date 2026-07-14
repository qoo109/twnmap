# 台灣選舉報報 V6.1.17

互動式台灣行政區地圖，整合現任民選公職、地方政黨勢力、正式候選人、中選會歷屆結果、官方頭貼、人物軌跡與資料來源健康狀態。

本版啟用 **官方資料唯讀模式**：公開人物資料只能由政府官方來源同步，不提供 CSV／JSON 人工匯入、人物欄位覆寫、政見改寫或姓名式司法裁判比對。

## V6.1.17 變更

1. 首頁改用輕量摘要，選取縣市與年度後才下載資料分片。
2. 歷屆結果改為選舉區分組、候選人排行、得票長條與前兩名票差。
3. 整合中選會第 11 屆 73 個立法委員選舉區範圍。
4. 完整鄉鎮市區可準確填色；含里界拆分時只標示可驗證範圍，不假畫里界。
5. 保持官方資料唯讀，未公告年度不顯示候選人。

完整紀錄見 [CHANGELOG_V6.1.17.md](CHANGELOG_V6.1.17.md)。

## 排程

| 排程 | 台灣時間 | 內容 |
|---|---:|---|
| Daily official data sync | 每天 03:00 | 現任公職、正式候選人、官方頭貼、異動報告及資料分片 |
| Weekly CEC history sync | 每週日 03:20 | 中選會核心歷屆、人物索引、異動報告及歷屆分片 |

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
npm run build:districts
npm run build:shards
npm run validate
```

## 資料安全

- 未正式公告的候選年度不顯示。
- 官方同步失敗時保留上一版。
- 大量刪除會被安全門檻攔截。
- 同名人物不只靠姓名自動合併。
- 不接受人工人物資料或司法裁判補充。
- GitHub Token 不寫入 repository。
- 照片只採政府官方來源。
