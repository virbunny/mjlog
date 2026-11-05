# 猛健錄｜ChatGPT 飲食紀錄輸出格式規格 V1

> 修訂：猛健錄 V0.3.4 起，`sodium`（鈉，mg）為每項食物必填欄位；V0.4.2 起，同一格式支援 `days[].supplements`。

用途：ChatGPT 整理使用者每日實際飲食與已服用補充劑後，輸出可直接貼入「猛健錄 → 每日菜單 → 貼上 ChatGPT 紀錄」的固定 JSON。

## 1. 輸出原則

- **只輸出一個 JSON 物件**。最佳做法是只給一個 `json` 程式碼區塊，不要在區塊外加說明。
- `format` 固定為 `mengjianlu_meals_patch_v1`。
- 可一次輸出多天；同一日期只能出現一次。
- 日期固定 `YYYY-MM-DD`。
- 餐次 key 只允許：`breakfast`（早餐）、`lunch`（午餐）、`snack`（加餐）、`dinner`（晚餐）。
- 不得輸出注射、體重、藥物庫存或每日症狀；補充劑使用本規格的 `supplements` 欄位。
- 食物營養數字必須是 JSON number，不可寫成字串，不可使用 `null`、`約 20`、`20g`。補充劑 `nutrition` 未知的營養素可省略或填 `null`。
- `sodium` 單位固定為 mg；若資料只能估算，請填合理估算值並在餐次 `note` 註明「估算」。
- 某營養素確定為零時填 `0`；若只能估算，請填合理估算值，並可在餐次 `note` 註明「估算」。
- **每個食物的營養欄位是「1 個 serving」的數值，猛健錄會再乘上 `qty`。** 不要先乘過一次又填 `qty > 1`，否則會重複計算。

## 2. 固定結構

```json
{
  "format": "mengjianlu_meals_patch_v1",
  "days": [
    {
      "date": "2026-11-03",
      "meals": {
        "breakfast": {
          "mode": "changed",
          "text": "高纖豆漿 300 ml＋茶葉蛋 1 顆",
          "note": "依包裝標示與一般食品資料估算",
          "foods": [
            {
              "name": "高纖豆漿",
              "serving": "300 ml",
              "qty": 1,
              "kcal": 123,
              "protein": 9.6,
              "carbs": 10.5,
              "fat": 5.2,
              "fiber": 5.5,
              "calcium": 75,
              "iron": 1.8,
              "zinc": 0.9,
              "sodium": 100
            },
            {
              "name": "茶葉蛋",
              "serving": "1 顆",
              "qty": 1,
              "kcal": 78,
              "protein": 6.3,
              "carbs": 1.1,
              "fat": 5.3,
              "fiber": 0,
              "calcium": 28,
              "iron": 0.9,
              "zinc": 0.6,
              "sodium": 200
            }
          ]
        }
      }
    }
  ]
}
```

## 3. 餐次欄位

| 欄位 | 必填 | 規則 |
|---|---|---|
| `mode` | 是 | `changed`、`same`、`half`、`none` 四選一。一般由 ChatGPT 整理實際食物時使用 `changed`；完全沒吃使用 `none`。 |
| `text` | 是 | 這餐的人類可讀摘要，不可空白。 |
| `note` | 否 | 可寫來源、估算方式、只吃部分等補充。 |
| `foods` | 是 | 陣列。`mode: "none"` 時必須是 `[]`；其他 mode 至少一項食物。 |

## 4. 食物欄位

每一項 food 下列欄位全部必填：

| 欄位 | 單位／意義 |
|---|---|
| `name` | 食物名稱 |
| `serving` | 一份的描述，例如 `300 ml`、`1 顆`、`100 g` |
| `qty` | 吃了幾份，可為小數，例如半份填 `0.5` |
| `kcal` | 每 1 serving 熱量 kcal |
| `protein` | 每 1 serving 蛋白質 g |
| `carbs` | 每 1 serving 碳水化合物 g |
| `fat` | 每 1 serving 脂肪 g |
| `fiber` | 每 1 serving 膳食纖維 g |
| `calcium` | 每 1 serving 鈣 mg |
| `iron` | 每 1 serving 鐵 mg |
| `zinc` | 每 1 serving 鋅 mg |
| `sodium` | 每 1 serving 鈉 mg |
| `source` | 選填；`label`＝包裝／營養標示、`estimated`＝估算、`unknown`＝來源未標示 |
| `sourceNote` | 選填；來源或估算依據 |

## 5. 完全沒吃的餐次

```json
"lunch": {
  "mode": "none",
  "text": "未吃",
  "note": "沒有食慾",
  "foods": []
}
```

## 6. 一次輸出多天

把多個日期放在同一個 `days` 陣列即可。**同一日期不可拆成兩個 day 物件**；同一天的早餐、午餐、加餐、晚餐都放在同一個 `meals` 物件。

## 7. 給 ChatGPT 的直接指令

可把下面這段附在飲食討論最後：

> 請依「猛健錄 ChatGPT 飲食紀錄輸出格式規格 V1」整理本次已確認的實際飲食。只輸出一個 JSON 程式碼區塊，format 固定為 mengjianlu_meals_patch_v1。每項食物都必須填 name、serving、qty、kcal、protein、carbs、fat、fiber、calcium、iron、zinc、sodium；營養值填每 1 serving 的數值，由 qty 表示實際份數。不要輸出任何 JSON 以外的文字，也不要加入注射、體重、庫存或症狀資料。

## 8. 猛健錄匯入行為

- 猛健錄會先完整解析及驗證，**任何一處錯誤都不會寫入任何餐次**。
- 匯入前會顯示每日、每餐與營養總計預覽。
- 同日期同餐已有實際紀錄時，預設略過，使用者可逐餐改成「覆蓋該餐」。
- 成功匯入後只更新飲食實際執行資料，並重新計算每日營養統計。
- 上一次飲食匯入可復原；注射、體重、藥物庫存、設定與每日症狀不受影響。


## 9. 常吃食物庫同步（V0.3.6 起）

- 仍使用同一份 `mengjianlu_meals_patch_v1`，不需要另一份食物庫 JSON。
- 系統只從實際食用的 `foods` 建立候選；`mode: "none"` 不會加入。
- 新食物預設勾選加入；已存在且換算後營養相同不重複新增。
- 同名不同營養預設保留原資料，只有使用者明確選擇才會取代既有自訂食物。
- 不同份量會先嘗試 g／kg、ml／L、顆／個等安全單位換算，再比較營養密度；無法安全換算時視為衝突。
- `source`、`sourceNote` 為選填。未提供時會依餐次 `note` 判斷「包裝標示／估算」；仍無法判斷則標示「來源未標示」。


## 10. 補充劑貼上匯入（V0.4.2 起）

仍沿用同一個 `mengjianlu_meals_patch_v1`，不需要第二份 JSON。每個 day 可以只有 `meals`、只有 `supplements`，或同時有兩者；但同一天至少要有其中一種內容。

### 結構

```json
{
  "format": "mengjianlu_meals_patch_v1",
  "days": [
    {
      "date": "2026-11-06",
      "supplements": [
        {
          "name": "鋅",
          "dose": "15 mg",
          "timing": "午餐後",
          "ingredients": "鋅 15 mg",
          "note": "固定補充",
          "nutrition": {
            "zinc": 15
          }
        }
      ]
    }
  ]
}
```

### 補充劑欄位

| 欄位 | 必填 | 規則 |
|---|---|---|
| `name` | 是 | 補充劑名稱，最多 120 字。名稱會標準化比對，但保留原始顯示名稱。 |
| `dose` | 是 | 本次實際服用量，例如 `1 顆`、`15 mg`。最多 120 字。 |
| `timing` | 否 | 例如 `早餐後`、`午餐後`、`睡前`；未填視為「任意時間」。 |
| `ingredients` | 否 | 主要成分／劑量。 |
| `note` | 否 | 備註。 |
| `nutrition` | 否 | 可包含 `calcium`、`iron`、`zinc`、`sodium`，單位皆為 mg；未知欄位可省略或填 `null`。 |

### 匯入行為

- 補充劑匯入只建立該日期的「已吃」紀錄快照，**不新增、不修改每日固定補充劑清單**。
- 同日期、同名補充劑已有紀錄時，預設略過，可改成覆蓋。
- 既有內容完全相同時自動略過，不重複寫入。
- 補充劑名稱會以 Unicode 標準化、大小寫與多餘空白消除後比對；同一天不得有重複名稱。
- 餐次、常吃食物庫與補充劑在「確認匯入」時一起寫入；任一寫入失敗，不留下部分資料。
- 「復原上次匯入」會一起復原該次餐次、常吃食物庫與補充劑變更；若匯入後某筆資料已被手動修改，復原會保留後續修改並提示略過。
