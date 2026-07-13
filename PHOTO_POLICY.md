# 頭貼與照片使用規範

## 顯示原則

1. 只使用官方機關、候選人正式網站或人工確認授權的照片。
2. 必須保存 `sourceUrl`、`sourceLabel`、`credit`、`license` 與查核日期。
3. 來源或授權不清楚時不顯示，改用姓名縮寫。
4. 不從新聞媒體、社群轉貼或搜尋引擎縮圖自動抓取。
5. 官方來源失效不應阻擋人物資料同步。

## V6.1 本地化流程

GitHub Actions 會執行：

```bash
npm run cache:portraits
```

程式只處理 `photo.official: true` 的遠端照片，下載後：

- 轉為 WebP。
- 最大尺寸 640×800。
- 保存於 `assets/portraits/cache/`。
- 將 `photo.localUrl` 指向本地檔案。
- 產生 `data/reports/portrait-cache.json`。

來源下載失敗時，保留既有可用照片；完全沒有照片時顯示姓名縮寫。

## 資料格式

```json
{
  "photo": {
    "localUrl": "assets/portraits/cache/example.webp",
    "url": "https://official.gov.tw/photo.jpg",
    "sourceUrl": "https://official.gov.tw/person",
    "sourceLabel": "官方人物照片",
    "credit": "提供機關",
    "license": "授權條款",
    "official": true,
    "verifiedAt": "2026-07-13",
    "cachedFormat": "webp",
    "cachedWidth": 480,
    "cachedHeight": 600
  }
}
```
