# V6.1.8.2｜大量人物分片驗證修正

- 驗證器支援 `peopleOmittedRoles` 與 `personFilesOmitted`。
- 村里長、鄉鎮市民代表及原住民區代表可不建立一人一個 JSON。
- 仍會檢查需建立分片的人物檔是否完整。
- 額外檢查實際人物檔數量是否符合 manifest。
- 不包含 `data/`，不會覆蓋目前已同步資料。
