# 上古卷軸編年史 · Elder Scrolls Chronicle

上古卷軸世界從黎明紀元到第四紀元的編年史：沿時間軸瀏覽重大事件，在地圖上看它們發生在哪裡，讀每一則的故事、異說與出處。中文與英文雙語，共 85 則事件。

*A bilingual (Traditional Chinese / English) chronicle of the Elder Scrolls world, from the Dawn Era to the Fourth Era: browse 85 major events along a timeline, see where they happened on the map, and read each story with its variant accounts and sources. English below.*

> 非官方粉絲網站，與 Bethesda Softworks、ZeniMax Media 無關，也未獲其背書。The Elder Scrolls 為 ZeniMax Media Inc. 的商標；相關名稱、地圖與圖像 © Bethesda Softworks LLC／ZeniMax Media Inc. 所有。

## 內容

- **來源**：故事只依據遊戲內的資料（書籍、對話、任務文字）與《帝國袖珍指南》（*Pocket Guide to the Empire*），不用官網文章、攻略書、漫畫或開發者訪談。各種說法互相矛盾時，正文只說一個完整的故事，其他說法放在文末的「註」。整理資料時大量參考 [UESP](https://en.uesp.net/)。
- **文字**：由 Claude（Anthropic）撰寫，Codex（OpenAI）校對，中英文各一版；中文專有名詞依 `src/content/glossary.json` 的對照表。
- **插圖**：**插圖由 AI 生成**——Codex 依本 repo 的視覺設定集（`docs/design/visual-canon/`）繪製，每張都經人工審閱。
- **地圖**：泰姆瑞爾與各省用 *The Elder Scrolls Anthology* 附贈地圖與遊戲地圖（經 UESP 取得，© Bethesda Softworks／ZeniMax Media，圖說逐張標示出處）；奈恩與宇宙是本站自繪。

## 開發

需要 Node.js 24。

```bash
npm ci
npm run dev        # 本機預覽 http://localhost:4321
npm test           # 單元測試（vitest）
npm run check      # 型別檢查
npm run build      # 建置到 dist/
npm run test:e2e   # 瀏覽器測試（Playwright）
```

`CHRONICLE_STRICT=1 npm run build` 會要求每則事件都已校對完成。部署方式見 [`docs/deploy.md`](docs/deploy.md)；視覺規格見 [`docs/design/style-guide.md`](docs/design/style-guide.md)。

技術：[Astro](https://astro.build/) 7、[Preact](https://preactjs.com/)、d3-zoom；字型為 Noto Serif TC／Noto Sans TC 與 Alegreya（SIL OFL 1.1；建置時依全站用字裁切，授權文字隨網站放在 `fonts/` 底下）。

## 授權

- **程式**（`src/` 中 `src/content/` 以外、`scripts/`、`tests/` 與設定檔）：[MIT](LICENSE)。
- **文字與插圖**（`src/content/` 的事件、名詞與說明，`public/illustrations/`，`docs/`）：[CC BY-NC-SA 4.0](LICENSE-CONTENT.md)——可以轉載與改作，但要標示出處、不可商用、改作也要用相同授權。
- **不在授權範圍內**：上古卷軸的名稱、世界觀與設定，以及 `public/maps/official/` 的官方地圖，都屬於 Bethesda Softworks／ZeniMax Media。

---

## English

An unofficial fan site: a chronicle of the Elder Scrolls world, from the Dawn Era to the Fourth Era, in Traditional Chinese and English.

> Unofficial fan site, not affiliated with or endorsed by Bethesda Softworks or ZeniMax Media. The Elder Scrolls is a trademark of ZeniMax Media Inc.; related names, maps and images © Bethesda Softworks LLC / ZeniMax Media Inc.

- **Sources**: in-game material (books, dialogue, quest text) and the *Pocket Guide to the Empire* only — no website articles, strategy guides, comics or developer statements. Where accounts disagree, the story tells one of them in full and the others go to its notes. Research leaned heavily on [UESP](https://en.uesp.net/).
- **Text**: written by Claude (Anthropic) and proofread by Codex (OpenAI), in both languages.
- **Illustrations are AI-generated**: drawn by Codex from this repository's visual canon (`docs/design/visual-canon/`), each one reviewed by a person.
- **Maps**: Tamriel and its provinces use the map bundled with *The Elder Scrolls Anthology* and in-game maps (via UESP, © Bethesda Softworks / ZeniMax Media, credited under each map); Nirn and the cosmos are the site's own drawings.

**Development**: Node.js 24, then `npm ci`, `npm run dev`, `npm test`, `npm run check`, `npm run build`, `npm run test:e2e`. Deployment: [`docs/deploy.md`](docs/deploy.md).

**Licence**: code under [MIT](LICENSE); text and illustrations under [CC BY-NC-SA 4.0](LICENSE-CONTENT.md). Elder Scrolls names, lore and the official maps in `public/maps/official/` belong to Bethesda Softworks / ZeniMax Media and are not covered.
