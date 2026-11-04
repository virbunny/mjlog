# 猛健錄

猛健樂療程、注射、體重、症狀、營養、每日菜單、實際攝取、藥物庫存與成本的 Local-first PWA。

## 正式網址

https://virbunny.github.io/mjlog/

## 資料儲存

- GitHub Pages 只提供程式檔。
- 注射、體重、飲食、庫存、設定等資料只儲存在使用者瀏覽器的 localStorage。
- 不使用帳號、不使用雲端同步、不會自動把健康紀錄上傳 GitHub。
- 跨裝置、換瀏覽器或清除網站資料前，請使用 App 內的「完整 JSON 備份」。

## 從 V0.3.0 localhost 搬到 GitHub Pages

`http://127.0.0.1:8765/` 與 `https://virbunny.github.io/mjlog/` 是不同 origin，localStorage 不會自動搬移。

1. 在舊版匯出「完整 JSON 備份」。
2. 開啟 GitHub Pages 正式網址。
3. 使用「匯入完整備份」還原。
4. 確認注射、體重、飲食、庫存都正常後，再把正式使用入口改成 GitHub Pages。

## 版本

V0.3.9 — 修正首頁「今天吃什麼 → 前往每日菜單」按鈕：改為直接切換每日菜單面板，不再依賴模擬點擊分頁按鈕，並捲動到菜單區。


## ChatGPT 飲食紀錄

固定輸出格式見 `猛健錄_ChatGPT飲食紀錄輸出格式規格_V1.md`。
