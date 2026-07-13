# GitHub Pages、第一次同步與自動更新

## 1. 上傳專案

將解壓縮後所有檔案放在 GitHub repository 根目錄並推送。

## 2. 開啟 Actions 寫入權限

Repository → Settings → Actions → General → Workflow permissions：

- 選擇 **Read and write permissions**
- 儲存

## 3. 啟用 GitHub Pages

Repository → Settings → Pages：

- Source：**Deploy from a branch**
- Branch：`main`
- Folder：`/ (root)`

## 4. 建立管理用 Token

建立 Fine-grained personal access token，只授權此 repository：

- Actions: Read and write
- Contents: Read and write
- Metadata: Read

不要把 Token 放入程式碼、commit 或公開截圖。

## 5. 使用第一次正式同步精靈

開啟線上版 `admin.html`，在「立即更新官方資料」填入 repository、分支與 Token，再依序執行：

1. **檢查 GitHub 與工作流程**
2. **同步現任公職與正式候選人**
3. **匯入核心歷屆資料**
4. **驗證公開資料**

第三步可以稍後執行，但至少完成第一、第二與第四步，才能確認網站不是只顯示種子資料。

## 6. 自動排程

- 每天 03:00：`.github/workflows/daily-sync.yml`
- 每週日 03:20：`.github/workflows/weekly-history-sync.yml`

GitHub cron 使用 UTC，因此分別設定為：

```text
0 19 * * *
20 19 * * 6
```

## 7. 異動守門

每次同步會先保存舊版至 runner 暫存區，再建立差異報告。若現任名單一次移除至少 25 人，或超過原有資料 25%，workflow 會失敗且不提交。

檢查：

- `data/change-log/latest.json`
- Actions 的 `Generate change report and guard mass deletion`
- 管理後台「最近一次資料異動」

確認官方來源只是正常大改版後，可先修正解析器，再重新執行；不建議直接關閉門檻。

## 8. Actions 成功但頁面尚未改變

1. 確認 repository 已出現新的資料 commit。
2. 等待 GitHub Pages 1–3 分鐘。
3. 在同步精靈第四步按「驗證發布」。
4. 強制重新整理瀏覽器。

## 9. Repository 容量

不要提交 `.cache/cec/votedata.zip`。官方頭貼會存為縮小 WebP；資料則依縣市與人物分片，不會把中選會原始大型壓縮檔加入 Git。
