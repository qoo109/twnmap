# V6.1｜首次同步、異動守門與效能強化版

## 1. 第一次正式同步精靈

管理後台新增四步精靈：

1. 檢查 GitHub repository、分支、Token 與 workflow。
2. 執行現任公職及正式候選人同步。
3. 匯入中選會核心歷屆資料。
4. 直接讀取 repository 最新 `data/election-data.json`，驗證版本、筆數與最後同步時間。

每一步都有等待、執行中、成功及錯誤狀態，可重試，不必猜同步是否真的生效。

## 2. 每次更新的異動摘要與安全門檻

新增 `scripts/generate-change-report.mjs`：

- 新增人物數
- 移除人物數
- 黨籍、職務、地區、任職狀態等欄位變更
- 頭貼更新數
- 歷屆資料增減

報告保存於：

- `data/change-log/latest.json`
- `data/change-log/<timestamp>-<hash>.json`
- `data/election-data.json` 的 `changeLog`

若現任公職原有至少 50 筆，且一次移除 25 筆以上或超過 25%，GitHub Actions 會停止提交，要求人工檢查，避免來源格式異常導致大量誤刪。

## 3. 混合式資料分片

新增：

- `data/manifest.json` / `data/manifest.js`
- `data/current/<county>.json`
- `data/current/national.json`
- `data/people/<person-id>.json`
- `data/history-shards/<year>/<county>.json`

公開首頁仍保留 `data/candidates.js`，因此可直接以 `file://` 離線開啟；在線上模式點人物時會優先讀取人物分片，為未來大量資料與更快首屏載入做好準備。

## 4. 官方頭貼本地化

新增 `scripts/cache_portraits.py`：

- 只處理標示為官方的遠端照片。
- 下載後轉為 WebP，最大 640×800。
- 保存到 `assets/portraits/cache/`。
- 來源失敗時保留既有照片或姓名縮寫，不阻擋人物資料同步。
- 產生 `data/reports/portrait-cache.json`。

## 5. 資料錯誤回報

人物詳細頁新增「回報資料錯誤」：

- GitHub Pages 上自動開啟預填的 GitHub Issue。
- 本機離線版會複製回報內容。
- 新增 `.github/ISSUE_TEMPLATE/data-correction.yml`。
- 回報只進入待審核，不會直接修改公開資料。

## 6. 排程

- 每天台灣時間 03:00：現任公職、正式候選人、照片、異動報告及分片。
- 每週日台灣時間 03:20：中選會核心歷屆資料、異動報告及分片。
