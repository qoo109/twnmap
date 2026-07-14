台灣選舉報報 V6.1.7.1｜lib.mjs 缺檔修正

錯誤原因：
GitHub Actions 顯示 ERR_MODULE_NOT_FOUND，找不到 scripts/lib.mjs。

安裝：
1. 解壓縮本檔。
2. GitHub Desktop 選擇 twnmap，按 Show in Finder。
3. 將本修正檔內的 scripts 資料夾拖進 twnmap。
4. 選擇「合併」，lib.mjs 放在 twnmap/scripts/lib.mjs。
5. GitHub Desktop 輸入：
   Fix missing parser shared module
6. Commit to main → Push origin。
7. 回 GitHub Actions 重新執行 Daily official data sync。
   officeholder_scope：full
   history_scope：none
   history_years：all

正確路徑：
twnmap/scripts/lib.mjs
