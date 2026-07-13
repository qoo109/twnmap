# 台灣政治人物與選舉地圖 V6.2

互動式台灣行政區地圖，整合現任民選公職、地方政黨勢力、正式候選人、中選會歷屆結果、官方頭貼、人物軌跡與資料來源健康狀態。

本版啟用 **官方資料唯讀模式**：公開人物資料只能由政府官方來源同步，不提供 CSV／JSON 人工匯入、人物欄位覆寫、政見改寫或姓名式司法裁判比對。

## V6.2 變更

1. 移除管理後台的候選人 CSV／JSON 匯入與發布檔產生器。
2. 移除人工補充政見、經歷、來源及司法裁判的流程。
3. 政見與經歷只有在中選會公報或政府官方人物頁直接提供時才顯示。
4. 公開頁不顯示司法篩選與司法摘要，避免同名或人工判斷造成錯誤。
5. 頭貼只採政府機關官方頁面；來源不明時顯示姓名縮寫。
6. 保留官方同步精靈、手動觸發 GitHub Actions、異動守門、資料健康與分片載入。

完整紀錄見 [CHANGELOG_V6.2.md](CHANGELOG_V6.2.md)。

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
