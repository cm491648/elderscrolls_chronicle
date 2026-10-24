# 上線設定

> 狀態（2026-10-24）：**準備完成，尚未公開**（維護者的決定 `decisions/launch-2`：先把準備做完、暫不公開；公開時另開一個新的公開 repo，只放目前的內容）。網站、README、授權檔、部署設定都已備好；建立公開 repo、推送與部署要等維護者決定公開時才做。

## 1. 公開 repo 的做法

開發在私人 repo 進行（現在叫 `cm491648/elderscrolls_chronicle`，公開那天改名為 `elderscrolls_chronicle-dev`，把名稱讓給公開 repo）。公開版是另一個新 repo，只放網站需要的檔案，**不帶私人 repo 的歷史**（舊 commit 的作者信箱不公開），也不放內部工作筆記（交接文件、設計與計畫、校對紀錄、提示詞、研究草稿）。匯出腳本 `scripts/export-public-repo.mjs` 只在私人 repo 裡；排除的清單寫在腳本的 `PRIVATE`，`tests/unit/export-public-repo.test.ts` 檢查。

公開那天的步驟（維護者決定：公開 repo **沿用 `elderscrolls_chronicle` 這個名稱**，網址 `https://cm491648.github.io/elderscrolls_chronicle/`；所以先把私人 repo 改名為 `elderscrolls_chronicle-dev`）。指令都用 GitHub CLI（`gh`，2026-10-24 已裝在這台電腦）：

1. **登入 `gh`**（維護者自己做，只要一次）：在終端機執行下面這行，選 GitHub.com、HTTPS、用瀏覽器登入。

   ```bash
   gh auth login
   ```

2. **私人 repo 改名**，本機的 `origin` 跟著改（GitHub 會把舊網址轉到新名稱，直到新的公開 repo 用掉這個名稱）：

   ```bash
   gh repo rename elderscrolls_chronicle-dev --repo cm491648/elderscrolls_chronicle --yes
   ```

   ```bash
   git remote set-url origin https://github.com/cm491648/elderscrolls_chronicle-dev.git
   ```

3. **匯出公開版**（一個 commit，作者用 GitHub 的匿名信箱）：

   ```bash
   node scripts/export-public-repo.mjs ../elderscrolls-public --commit 17330019+cm491648@users.noreply.github.com
   ```

4. **建立公開 repo 並推送**：

   ```bash
   gh repo create cm491648/elderscrolls_chronicle --public --source ../elderscrolls-public --push --description "上古卷軸編年史 · Elder Scrolls Chronicle — an unofficial bilingual chronicle of the Elder Scrolls world"
   ```

5. **開啟 Pages**（來源設成 GitHub Actions）：

   ```bash
   gh api -X POST repos/cm491648/elderscrolls_chronicle/pages -f build_type=workflow
   ```

6. **部署**（地圖來源預設 `official`），並等它跑完：

   ```bash
   gh workflow run deploy.yml --repo cm491648/elderscrolls_chronicle -f map_source=official
   ```

   ```bash
   gh run watch --repo cm491648/elderscrolls_chronicle
   ```

7. **上線後檢查**：開 `https://cm491648.github.io/elderscrolls_chronicle/`，點幾則事件、打開搜尋、切換語言；到 Google Search Console 提交 `https://cm491648.github.io/elderscrolls_chronicle/sitemap.xml`。

之後的更新怎麼同步到公開 repo（每次重新匯出覆蓋，或改在公開 repo 直接開發），公開時再決定。

## 2. 自動測試（`.github/workflows/ci.yml`）

- 五項驗證：`npm test`、`npm run check`、`npm run build`、`CHRONICLE_STRICT=1 npm run build`、`npm run test:e2e`（Linux、Node 24、只裝 Chromium）。
- **公開 repo**：每次 push 與 pull request 都自動跑（公開 repo 的 Actions 免費）。**私人 repo**：不自動跑，只能在 Actions 頁面手動觸發（2026-10-24 用掉每月 2,000 分鐘的 90%；每次推送前本機都已跑過同樣的驗證，decisions/actions-minutes）。判斷寫在 `ci.yml` 的 `if:`，被跳過的工作不佔分鐘。
- 瀏覽器測試失敗時，報告與截圖存成 Actions 的 artifact `playwright-report`，保留 7 天。
- 帳單設定裡 Actions 的預算設成 0 美元（維護者自行設定），超過免費額度就停，不會計費。

## 3. 部署（`.github/workflows/deploy.yml`）

- **只能手動執行**，沒有掛在 push 上。執行時選地圖來源：`official`（預設，網站現在用的官方地圖）或 `drawn`（本站自繪，被要求下架官方圖時的備用）。
- 建置時設定：
  - `CHRONICLE_SITE=https://<擁有者>.github.io`、`CHRONICLE_BASE=/<repo 名稱>/`：由執行它的 repo 自動帶入。`astro.config.mjs` 讀這兩個變數；沒設時網站在根目錄，本機建置、測試照舊。
  - `CHRONICLE_STRICT=1`：所有事件都要校對完成才建置得過。
  - `PUBLIC_MAP_SOURCE`：官方版建置會拿掉自繪地圖的上色圖層；自繪版建置會拿掉 `maps/official/`。
- 私人 repo 要用 Pages 需要付費方案；公開 repo 免費。

## 4. 地圖授權

- 官方地圖是 *The Elder Scrolls Anthology* 附贈地圖與遊戲地圖，經 UESP 取得，© Bethesda Softworks／ZeniMax Media。圖說與頁尾都標出處，但它們仍是官方圖像，不在本 repo 的任何授權裡。
- 自繪版的泰姆瑞爾九省輪廓與奈恩海岸是照官方地圖描繪的，也算衍生作品，只是風險比直接用官方圖低。
- 第三方詳細地圖（GameBanshee、game-maps.com）只作地點參考，任何版本都不會放上網站。

## 5. 搜尋引擎

- 允許收錄。建置時產生 `sitemap.xml`（兩種語言、每頁附另一語言的對照）；只有部署建置（有設 `CHRONICLE_SITE`）才有網址，其他建置是空清單。
- GitHub Pages 的專案網站放在 `/<repo 名稱>/` 底下，無法在網域根目錄放 `robots.txt`，所以改到 Search Console 提交 sitemap。
- 每頁有標準網址（canonical）與分享預覽（標題、說明、事件插圖）。

## 6. 本機試 base 路徑

```bash
CHRONICLE_SITE=https://cm491648.github.io CHRONICLE_BASE=/elderscrolls_chronicle/ npx astro build --outDir dist-base
```

把 `dist-base/` 放進一個名為 `elderscrolls_chronicle` 的資料夾，從它的上一層啟動靜態伺服器，開 `/elderscrolls_chronicle/`：首頁依瀏覽器語言轉頁，事件、搜尋、插圖、字型、材質都從 `/elderscrolls_chronicle/` 底下載入。2026-10-24 測過，桌機與手機都沒有失敗的請求。

在 Windows 的 Git Bash 裡，`/elderscrolls_chronicle/` 會被改寫成 `C:/Program Files/Git/...`，要在指令前加 `MSYS_NO_PATHCONV=1 MSYS2_ENV_CONV_EXCL=CHRONICLE_BASE`（PowerShell 與 GitHub Actions 沒有這個問題）。`dist-base/` 已列在 `.gitignore`。
