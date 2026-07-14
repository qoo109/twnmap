# 官方頭貼與照片使用規範

## 顯示原則

1. 只使用總統府、立法院、內政部、中選會或其他政府機關官方頁面提供的照片。
2. 必須保存 `sourceUrl`、`sourceLabel`、`credit`、`license` 與查核日期。
3. 來源、授權或人物身分不清楚時不顯示，改用姓名縮寫。
4. 不從候選人自行經營網站、新聞媒體、社群貼文或搜尋引擎縮圖自動抓取。
5. 官方照片來源失效時保留可確認的舊快取；無法確認時移除照片。

## 本地化流程

GitHub Actions 執行 `npm run cache:portraits`，只處理 `photo.official: true` 的政府官方照片：

- 轉為 WebP。
- 最大尺寸 640×800。
- 保存於 `assets/portraits/cache/`。
- 產生 `data/reports/portrait-cache.json`。

下載失敗不影響人物文字資料同步。
