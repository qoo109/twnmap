# 歷屆資料模型 V5.9

## 資料流程

```text
中選會 votedata.zip
  ├─ elbase.csv  行政區名稱
  ├─ elcand.csv  候選人基本資料
  ├─ elpaty.csv  政黨代號與名稱
  └─ elctks.csv  得票數、得票率、當選註記
        ↓
cec_history_import.py
        ↓
history.results（逐次參選紀錄）
        ↓
身分比對與同名核對
        ↓
personHistory / partyHistory / districtHistory
```

## `history.results`

每一筆代表「一個人在某次選舉的參選紀錄」。主要欄位：

```json
{
  "id": "cec-...",
  "personKey": "person-...",
  "identityConfidence": "exact",
  "name": "姓名",
  "gender": "男",
  "birthDate": "1971-01-01",
  "year": 2022,
  "electionType": "直轄市議員",
  "roleId": "municipal-councilor",
  "countyId": "taipei",
  "district": "臺北市 第01選區",
  "partyId": "dpp",
  "partyNameRaw": "民主進步黨",
  "votes": 12345,
  "voteRate": 12.34,
  "rank": 3,
  "elected": true,
  "incumbent": false,
  "sourceType": "cec-official-history"
}
```

## 身分信心

- `exact`：至少有姓名、性別與可解析出生日期
- `probable`：有出生年或性別，但資料不完整
- `review`：官方識別欄位不足，資料保持分離，不公開合併為同一人物

同名但人物指紋不同時，不會自動合併。疑似衝突寫入 `data/history/identity-review.json`。

## 現任人物連結

只有在以下條件同時成立時，歷屆人物才會自動連到現任人物：

1. 標準化姓名相同
2. 歷屆資料中該姓名只有一組人物指紋
3. 依縣市／職位縮小後只剩一位現任或候選人

不符合時保留為待核對，不強制建立關聯。

## 政黨語意

`partyId` 在歷屆資料中代表「該次參選的推薦政黨」。這不等同完整黨籍紀錄，也不能據此推論入黨或退黨日期。

## 大型資料考量

村里長歷史筆數很大。`all` 適合研究或後端資料庫；公開靜態網站建議先使用 `core` 或 `local`，之後再把完整資料移到 Supabase／PostgreSQL 與分頁 API。
