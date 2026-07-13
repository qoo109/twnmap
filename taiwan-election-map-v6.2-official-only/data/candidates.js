/* Auto-generated from data/election-data.json. Do not edit directly. */
window.ELECTION_DATA = {
  "meta": {
    "version": "2026.07.13-v6.1",
    "electionName": "115年地方公職人員選舉",
    "electionDate": "2026-11-28",
    "mode": "official-only-awaiting-sync",
    "disclaimer": "現任公職、正式候選人與歷屆結果均以政府機關公開資料為準；網站不接受人工改寫或姓名式司法裁判比對。",
    "lastGeneratedAt": "2026-07-13T02:41:13.866Z",
    "portalName": "台灣政治人物與選舉地圖",
    "defaultView": "officeholders",
    "partyColorMethod": "各地依現任公職人數最多政黨著色；顏色深淺綜合占比與人數。並列第一時，以並列政黨代表色製作等寬斜線紋理。",
    "featureFocus": "官方資料唯讀、禁止人工覆寫、同步健康、異動守門與分區載入",
    "historyModel": "official CEC records → identity matching → personHistory / partyHistory / districtHistory",
    "publicDataPolicy": "只顯示政府機關直接發布並可追溯的資料；不接受人工新增、改寫或補充政治人物內容。",
    "photoPolicy": "僅顯示政府機關官方頁面提供且可保存來源資訊的照片；無照片時以姓名縮寫替代。",
    "dataStrategy": "hybrid-sharded",
    "release": "V6.2",
    "changeGuard": "passed",
    "dataManifestGeneratedAt": "2026-07-13T02:41:14.731Z"
  },
  "parties": [
    {
      "id": "dpp",
      "name": "民主進步黨",
      "shortName": "民進黨",
      "color": "#1B9431",
      "colorName": "綠色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "kmt",
      "name": "中國國民黨",
      "shortName": "國民黨",
      "color": "#000099",
      "colorName": "藍色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "tpp",
      "name": "台灣民眾黨",
      "shortName": "民眾黨",
      "color": "#28C8C8",
      "colorName": "青綠色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "npp",
      "name": "時代力量",
      "shortName": "時代力量",
      "color": "#FBBE01",
      "colorName": "黃黑色系",
      "colorSource": "標準化代表色"
    },
    {
      "id": "tsp",
      "name": "台灣基進",
      "shortName": "台灣基進",
      "color": "#A73F24",
      "colorName": "磚紅色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "pfp",
      "name": "親民黨",
      "shortName": "親民黨",
      "color": "#FF6310",
      "colorName": "橘色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "npsu",
      "name": "無黨團結聯盟",
      "shortName": "無黨團結",
      "color": "#C20F51",
      "colorName": "桃紅色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "tsu",
      "name": "台灣團結聯盟",
      "shortName": "台聯黨",
      "color": "#C69E6A",
      "colorName": "棕金色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "new-party",
      "name": "新黨",
      "shortName": "新黨",
      "color": "#FFDA00",
      "colorName": "黃色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "green",
      "name": "台灣綠黨",
      "shortName": "綠黨",
      "color": "#73BE00",
      "colorName": "亮綠色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "sdp",
      "name": "社會民主黨",
      "shortName": "社民黨",
      "color": "#FF0088",
      "colorName": "玫紅色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "ind",
      "name": "無黨籍及未經政黨推薦",
      "shortName": "無黨籍",
      "color": "#000000",
      "colorName": "黑色",
      "colorSource": "標準化代表色"
    },
    {
      "id": "other",
      "name": "其他政黨",
      "shortName": "其他",
      "color": "#D4D4D4",
      "colorName": "中性灰",
      "colorSource": "未分類預設色"
    }
  ],
  "counties": [
    {
      "id": "taipei",
      "name": "臺北市",
      "x": 335,
      "y": 86,
      "labelX": 380,
      "labelY": 72,
      "description": "北部都會核心；正式版可細分市長及市議員選區。"
    },
    {
      "id": "new-taipei",
      "name": "新北市",
      "x": 318,
      "y": 110,
      "labelX": 397,
      "labelY": 112,
      "description": "環繞臺北市的直轄市，選舉類型與選區數量較多。"
    },
    {
      "id": "keelung",
      "name": "基隆市",
      "x": 359,
      "y": 79,
      "labelX": 420,
      "labelY": 46,
      "description": "臺灣北端港都。"
    },
    {
      "id": "taoyuan",
      "name": "桃園市",
      "x": 292,
      "y": 133,
      "labelX": 214,
      "labelY": 116,
      "description": "北部直轄市。"
    },
    {
      "id": "hsinchu-city",
      "name": "新竹市",
      "x": 278,
      "y": 171,
      "labelX": 190,
      "labelY": 163,
      "description": "新竹都會核心。"
    },
    {
      "id": "hsinchu-county",
      "name": "新竹縣",
      "x": 301,
      "y": 183,
      "labelX": 391,
      "labelY": 178,
      "description": "正式版應依最新選區公告更新。"
    },
    {
      "id": "miaoli",
      "name": "苗栗縣",
      "x": 278,
      "y": 224,
      "labelX": 191,
      "labelY": 226,
      "description": "中北部縣市。"
    },
    {
      "id": "taichung",
      "name": "臺中市",
      "x": 270,
      "y": 280,
      "labelX": 176,
      "labelY": 277,
      "description": "中部直轄市。"
    },
    {
      "id": "changhua",
      "name": "彰化縣",
      "x": 235,
      "y": 337,
      "labelX": 146,
      "labelY": 331,
      "description": "西部農工商縣市。"
    },
    {
      "id": "nantou",
      "name": "南投縣",
      "x": 279,
      "y": 351,
      "labelX": 383,
      "labelY": 349,
      "description": "臺灣唯一不臨海縣。"
    },
    {
      "id": "yunlin",
      "name": "雲林縣",
      "x": 222,
      "y": 395,
      "labelX": 138,
      "labelY": 394,
      "description": "中南部縣市。"
    },
    {
      "id": "chiayi-city",
      "name": "嘉義市",
      "x": 235,
      "y": 432,
      "labelX": 144,
      "labelY": 442,
      "description": "嘉義都會核心。"
    },
    {
      "id": "chiayi-county",
      "name": "嘉義縣",
      "x": 260,
      "y": 445,
      "labelX": 365,
      "labelY": 431,
      "description": "正式版應依最新議員選區公告更新。"
    },
    {
      "id": "tainan",
      "name": "臺南市",
      "x": 218,
      "y": 503,
      "labelX": 129,
      "labelY": 500,
      "description": "南部直轄市。"
    },
    {
      "id": "kaohsiung",
      "name": "高雄市",
      "x": 224,
      "y": 566,
      "labelX": 126,
      "labelY": 567,
      "description": "南部直轄市。"
    },
    {
      "id": "pingtung",
      "name": "屏東縣",
      "x": 205,
      "y": 641,
      "labelX": 110,
      "labelY": 647,
      "description": "臺灣最南端縣市。"
    },
    {
      "id": "yilan",
      "name": "宜蘭縣",
      "x": 348,
      "y": 169,
      "labelX": 433,
      "labelY": 159,
      "description": "東北部縣市。"
    },
    {
      "id": "hualien",
      "name": "花蓮縣",
      "x": 324,
      "y": 337,
      "labelX": 421,
      "labelY": 327,
      "description": "東部縣市。"
    },
    {
      "id": "taitung",
      "name": "臺東縣",
      "x": 279,
      "y": 533,
      "labelX": 383,
      "labelY": 535,
      "description": "東南部縣市。"
    },
    {
      "id": "penghu",
      "name": "澎湖縣",
      "x": 101,
      "y": 459,
      "labelX": 34,
      "labelY": 446,
      "description": "離島縣市。"
    },
    {
      "id": "kinmen",
      "name": "金門縣",
      "x": 69,
      "y": 257,
      "labelX": 28,
      "labelY": 227,
      "description": "離島縣市。"
    },
    {
      "id": "lienchiang",
      "name": "連江縣",
      "x": 93,
      "y": 125,
      "labelX": 25,
      "labelY": 95,
      "description": "離島縣市。"
    }
  ],
  "candidates": [],
  "sources": [
    {
      "name": "中央選舉委員會",
      "type": "核心",
      "url": "https://www.cec.gov.tw/",
      "usage": "選舉日程、候選人登記、選舉公告、選舉公報與選舉結果。",
      "note": "候選人是否正式登記，應以中選會與地方選委會公告為準。"
    },
    {
      "name": "中選會選情資料庫",
      "type": "核心",
      "url": "https://db.cec.gov.tw/",
      "usage": "歷屆候選人、得票數、得票率與當選結果。",
      "note": "適合建立歷史選舉與候選人參選紀錄。"
    },
    {
      "name": "政府資料開放平臺：選舉資料庫（含選舉區資料）",
      "type": "核心歷屆",
      "url": "https://data.gov.tw/dataset/13119",
      "usage": "下載中選會 votedata.zip，匯入候選人、推薦政黨、得票數、得票率與當選結果。",
      "note": "核心歷屆每週同步一次；完整村里長歷史僅在管理者手動選擇時匯入。"
    },
    {
      "name": "中選會選舉及公民投票公報",
      "type": "核心",
      "url": "https://bulletin.cec.gov.tw/",
      "usage": "候選人正式簡歷、政見與選舉公報。",
      "note": "正式政見內容應保留原始公報頁面或檔案連結。"
    },
    {
      "name": "監察院政治獻金公開查閱平臺",
      "type": "財務",
      "url": "https://ardata.cy.gov.tw/",
      "usage": "依法公開的政治獻金會計報告書。",
      "note": "不同選舉與年度應分開呈現。"
    },
    {
      "name": "監察院陽光法令主題網",
      "type": "財務",
      "url": "https://sunshine.cy.gov.tw/",
      "usage": "財產申報、政治獻金與利益衝突迴避相關公開資訊。",
      "note": "資料公開範圍與下載方式依當期規定。"
    },
    {
      "name": "政府資料開放平臺／國土測繪中心",
      "type": "地圖",
      "url": "https://data.gov.tw/dataset/7442",
      "usage": "直轄市、縣市行政區界線。",
      "note": "正式地圖應註明圖資來源、版本、座標系統與更新日期。"
    },
    {
      "name": "Taiwan Atlas TopoJSON",
      "type": "地圖",
      "url": "https://github.com/dkaoster/taiwan-atlas",
      "usage": "提供縣市與鄉鎮市區 TopoJSON，供互動地圖縮放與行政區下鑽。",
      "note": "圖資源自內政部國土測繪中心開放資料；Taiwan Atlas 採 MIT 授權。"
    },
    {
      "name": "中華民國總統府",
      "type": "現任中央",
      "url": "https://www.president.gov.tw/",
      "usage": "總統、副總統現任身分與就任日期。",
      "note": "中央職務以總統府官方頁面為準。"
    },
    {
      "name": "立法院本屆立委",
      "type": "現任中央",
      "url": "https://www.ly.gov.tw/Pages/List.aspx?nodeid=109",
      "usage": "現任立法委員、黨籍、選區與離職名單。",
      "note": "每日同步時會排除官方頁面列出的離職委員。"
    },
    {
      "name": "內政部地方公職人員資訊專區",
      "type": "現任地方",
      "url": "https://www.moi.gov.tw/cl.aspx?n=12",
      "usage": "直轄市長、縣市長、議員、鄉鎮市長、代表及村里長等現任地方公職。",
      "note": "網站每天同步一次；來源失敗時保留上一版。"
    },
    {
      "name": "政府資料開放平臺：縣市議員",
      "type": "現任地方",
      "url": "https://data.gov.tw/dataset/7054",
      "usage": "現任縣市議員欄位與下載資源。",
      "note": "資料集更新頻率為不定期，網站仍每天檢查是否有異動。"
    },
    {
      "name": "政府資料開放平臺：直轄市議員",
      "type": "現任地方",
      "url": "https://data.gov.tw/dataset/7055",
      "usage": "現任直轄市議員資料資源。",
      "note": "若下載格式改變，系統會保留舊資料並記錄錯誤。"
    },
    {
      "name": "政府資料開放平臺：村里長",
      "type": "現任地方",
      "url": "https://data.gov.tw/dataset/7061",
      "usage": "現任村里長資料資源。",
      "note": "村里長資料量大，首次同步可能需要數分鐘。"
    },
    {
      "name": "政黨代表色參考",
      "type": "視覺識別",
      "url": "https://zh.wikipedia.org/zh-tw/Template:%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E6%94%BF%E9%BB%A8%E8%89%B2%E5%BD%A9",
      "usage": "統一主要政黨在地圖、圖例、人物卡片與統計列的代表色。",
      "note": "以各黨官方網站、黨徽與公開識別為方向，缺乏公開色碼時採標準化政黨色模板的十六進位色值。"
    }
  ],
  "sync": {
    "schedule": "daily",
    "timezone": "Asia/Taipei",
    "plannedTime": "03:00",
    "status": "not-run",
    "lastAttemptAt": null,
    "lastSuccessAt": null,
    "lastOfficialChangeAt": null,
    "officialCandidateCount": 0,
    "demoCandidateCount": 0,
    "message": "尚未執行官方資料同步。",
    "sources": []
  },
  "roles": [
    {
      "id": "president",
      "name": "總統",
      "group": "中央民選",
      "level": "national",
      "elected": true,
      "mapWeight": 0
    },
    {
      "id": "vice-president",
      "name": "副總統",
      "group": "中央民選",
      "level": "national",
      "elected": true,
      "mapWeight": 0
    },
    {
      "id": "legislator",
      "name": "立法委員",
      "group": "中央民選",
      "level": "district",
      "elected": true,
      "mapWeight": 1
    },
    {
      "id": "municipal-mayor",
      "name": "直轄市長",
      "group": "地方首長",
      "level": "county",
      "elected": true,
      "mapWeight": 4
    },
    {
      "id": "county-mayor",
      "name": "縣市長",
      "group": "地方首長",
      "level": "county",
      "elected": true,
      "mapWeight": 4
    },
    {
      "id": "municipal-councilor",
      "name": "直轄市議員",
      "group": "地方民代",
      "level": "district",
      "elected": true,
      "mapWeight": 1
    },
    {
      "id": "county-councilor",
      "name": "縣市議員",
      "group": "地方民代",
      "level": "district",
      "elected": true,
      "mapWeight": 1
    },
    {
      "id": "township-mayor",
      "name": "鄉鎮市長",
      "group": "基層首長",
      "level": "town",
      "elected": true,
      "mapWeight": 2
    },
    {
      "id": "indigenous-district-mayor",
      "name": "原住民區長",
      "group": "基層首長",
      "level": "town",
      "elected": true,
      "mapWeight": 2
    },
    {
      "id": "township-representative",
      "name": "鄉鎮市民代表",
      "group": "基層民代",
      "level": "town",
      "elected": true,
      "mapWeight": 1
    },
    {
      "id": "indigenous-district-representative",
      "name": "原住民區代表",
      "group": "基層民代",
      "level": "town",
      "elected": true,
      "mapWeight": 1
    },
    {
      "id": "village-chief",
      "name": "村里長",
      "group": "村里",
      "level": "village",
      "elected": true,
      "mapWeight": 1
    }
  ],
  "officeholders": [
    {
      "id": "president-lai-ching-te",
      "official": true,
      "name": "賴清德",
      "roleId": "president",
      "role": "總統",
      "partyId": "dpp",
      "countyId": null,
      "district": "全國",
      "organization": "中華民國總統府",
      "termStart": "2024-05-20",
      "status": "incumbent",
      "sourceUpdatedAt": "2024-05-20",
      "sources": [
        {
          "label": "中華民國總統府：賴清德總統",
          "url": "https://www.president.gov.tw/Page/694",
          "date": "2024-05-20"
        }
      ],
      "photo": {
        "localUrl": "assets/portraits/lai-ching-te.jpg",
        "url": "https://www.president.gov.tw/img/Page/c9cdb96a-f8a4-411d-b7b7-c1ca40468c80.jpg",
        "sourceUrl": "https://www.president.gov.tw/Page/694",
        "sourceLabel": "中華民國總統府：總統玉照",
        "credit": "中華民國總統府",
        "license": "政府資料開放授權條款第1版",
        "official": true,
        "verifiedAt": "2026-07-12"
      },
      "personKey": "president-lai-ching-te",
      "identityStatus": "verified-official"
    },
    {
      "id": "vice-president-hsiao-bi-khim",
      "official": true,
      "name": "蕭美琴",
      "roleId": "vice-president",
      "role": "副總統",
      "partyId": "dpp",
      "countyId": null,
      "district": "全國",
      "organization": "中華民國總統府",
      "termStart": "2024-05-20",
      "status": "incumbent",
      "sourceUpdatedAt": "2024-05-20",
      "sources": [
        {
          "label": "中華民國總統府：蕭美琴副總統",
          "url": "https://www.president.gov.tw/Page/695",
          "date": "2024-05-20"
        }
      ],
      "photo": {
        "localUrl": "assets/portraits/hsiao-bi-khim.jpg",
        "url": "https://www.president.gov.tw/img/Page/510223ed-c538-45fa-9442-a48f78646995.jpg",
        "sourceUrl": "https://www.president.gov.tw/Page/695",
        "sourceLabel": "中華民國總統府：副總統玉照",
        "credit": "中華民國總統府",
        "license": "政府資料開放授權條款第1版",
        "official": true,
        "verifiedAt": "2026-07-12"
      },
      "personKey": "vice-president-hsiao-bi-khim",
      "identityStatus": "verified-official"
    }
  ],
  "officeholderSync": {
    "status": "seed-only",
    "lastAttemptAt": null,
    "lastSuccessAt": null,
    "officeholderCount": 2,
    "localOfficeholderCount": 0,
    "legislatorCount": 0,
    "message": "目前內建總統與副總統官方種子資料；部署到 GitHub 後執行每日同步，將匯入立法院與內政部現任名單。",
    "coverage": {
      "presidency": "seeded",
      "legislature": "waiting-first-sync",
      "local": "waiting-first-sync"
    },
    "errors": []
  },
  "history": {
    "years": [],
    "results": [],
    "importPlan": {
      "dailyScope": "現任公職與正式候選人每天檢查官方來源",
      "historyScope": "歷屆資料由中選會官方資料每週同步，亦可由 GitHub Actions 手動觸發",
      "sourcePriority": [
        "中選會選舉資料庫",
        "中選會開放資料"
      ],
      "caution": "推薦政黨與實際黨籍可能不同，歷屆資料預設顯示「參選推薦政黨」。"
    },
    "message": "尚未匯入歷屆結果；索引為空。",
    "lastIndexedAt": "2026-07-13T02:41:13.866Z",
    "indexStatus": "empty",
    "plannedRefresh": "歷屆結果可手動匯入或由官方來源同步後重建索引。",
    "coverage": {
      "source": "中央選舉委員會選舉資料庫",
      "sourceUrl": "https://data.gov.tw/dataset/13119",
      "archiveUrl": "https://data.cec.gov.tw/選舉資料庫/votedata.zip",
      "lastOfficialSyncAt": null,
      "scope": "core",
      "yearsRequested": [
        2014,
        2018,
        2020,
        2022,
        2024
      ],
      "yearsImported": [],
      "rolesImported": [],
      "officialRecordCount": 0,
      "officialPersonCount": 0,
      "linkedCurrentCount": 0,
      "identityReviewCount": 0,
      "datasetGroups": 0,
      "archiveBytes": 0,
      "importDurationSeconds": 0
    }
  },
  "personHistory": [],
  "partyHistory": [],
  "districtHistory": [],
  "photoSync": {
    "status": "seeded-official",
    "lastAttemptAt": null,
    "lastSuccessAt": "2026-07-12T00:00:00+08:00",
    "photoCount": 2,
    "officialPhotoCount": 2,
    "message": "已內建總統府官方玉照；每日同步會嘗試補入立法院與內政部官方照片。"
  },
  "changeLog": {
    "schemaVersion": 1,
    "generatedAt": "2026-07-13T02:41:14.302Z",
    "date": "2026-07-13",
    "beforeVersion": "2026.07.13-v6.1",
    "afterVersion": "2026.07.13-v6.1",
    "summary": {
      "added": 0,
      "removed": 0,
      "changed": 0,
      "photoUpdated": 0,
      "historyDelta": 0
    },
    "officeholders": {
      "label": "officeholders",
      "beforeCount": 2,
      "afterCount": 2,
      "added": [],
      "removed": [],
      "changed": [],
      "photoUpdated": []
    },
    "candidates": {
      "label": "candidates",
      "beforeCount": 0,
      "afterCount": 0,
      "added": [],
      "removed": [],
      "changed": [],
      "photoUpdated": []
    },
    "history": {
      "label": "history",
      "beforeCount": 0,
      "afterCount": 0,
      "addedCount": 0,
      "removedCount": 0
    },
    "guard": {
      "suspicious": false,
      "reason": "未偵測到大量異常刪除。",
      "requiresReview": false
    }
  },
  "dataManifest": {
    "schemaVersion": 1,
    "generatedAt": "2026-07-13T02:41:14.731Z",
    "strategy": "hybrid-sharded",
    "fallback": "data/candidates.js remains available for file:// offline use",
    "counts": {
      "officeholders": 2,
      "candidates": 0,
      "history": 0,
      "personFiles": 2,
      "currentFiles": 23,
      "historyFiles": 0
    },
    "current": [
      {
        "countyId": "taipei",
        "file": "current/taipei.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "new-taipei",
        "file": "current/new-taipei.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "keelung",
        "file": "current/keelung.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "taoyuan",
        "file": "current/taoyuan.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "hsinchu-city",
        "file": "current/hsinchu-city.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "hsinchu-county",
        "file": "current/hsinchu-county.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "miaoli",
        "file": "current/miaoli.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "taichung",
        "file": "current/taichung.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "changhua",
        "file": "current/changhua.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "nantou",
        "file": "current/nantou.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "yunlin",
        "file": "current/yunlin.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "chiayi-city",
        "file": "current/chiayi-city.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "chiayi-county",
        "file": "current/chiayi-county.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "tainan",
        "file": "current/tainan.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "kaohsiung",
        "file": "current/kaohsiung.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "pingtung",
        "file": "current/pingtung.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "yilan",
        "file": "current/yilan.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "hualien",
        "file": "current/hualien.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "taitung",
        "file": "current/taitung.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "penghu",
        "file": "current/penghu.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "kinmen",
        "file": "current/kinmen.json",
        "officeholderCount": 0,
        "candidateCount": 0
      },
      {
        "countyId": "lienchiang",
        "file": "current/lienchiang.json",
        "officeholderCount": 0,
        "candidateCount": 0
      }
    ],
    "national": "current/national.json",
    "peopleBase": "people/",
    "history": []
  },
  "officialOnlyPolicy": {
    "enabled": true,
    "allowedSources": [
      "中華民國總統府",
      "立法院",
      "內政部",
      "中央選舉委員會",
      "政府資料開放平臺及其政府資料提供機關"
    ],
    "manualImport": "disabled",
    "manualOverrides": "disabled",
    "judicialMatching": "disabled-unless-official-source-explicitly-links-person-and-record",
    "candidatePolicies": "only-from-cec-bulletin-or-official-government-page",
    "candidateExperience": "only-from-cec-bulletin-or-official-government-page"
  }
};
