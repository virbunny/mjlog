# 猛健錄｜ChatGPT 飲食紀錄輸出格式規格 V1

> 修訂：猛健錄 V0.3.4 起，`sodium`（鈉，mg）為每項食物必填欄位。

用途：ChatGPT 整理使用者每日實際飲食後，輸出可直接貼入「猛健錄 → 每日菜單 → 貼上 ChatGPT 紀錄」的固定 JSON。

## 1. 輸出原則

- **只輸出一個 JSON 物件**。最佳做法是只給一個 `json` 程式碼區塊，不要在區塊外加說明。
- `format` 固定為 `mengjianlu_meals_patch_v1`。
- 可一次輸出多天；同一日期只能出現一次。
- 日期固定 `YYYY-MM-DD`。
- 餐次 key 只允許：`breakfast`（早餐）、`lunch`（午餐）、`snack`（加餐）、`dinner`（晚餐）。
- 不得輸出注射、體重、藥物庫存、每日症狀或其他非飲食資料。
- 所有數字必須是 JSON number，不可寫成字串，不可使用 `null`、`約 20`、`20g` 這類格式。
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
