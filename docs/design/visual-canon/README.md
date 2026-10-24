# 視覺設定集（Visual Canon）

這個資料夾放事件圖片的「設定集」：每個條目記下一個人物、種族、陣營、裝備、地點、生物或神器在遊戲裡的長相。生圖時，`scripts/visual-canon.mjs` 讀取這些條目，依事件的紀元與地點挑出對應版本的英文提示詞片段，再組成完整提示詞，並附上參考圖與「必要特徵」檢查清單。設計說明見 `docs/superpowers/specs/2026-10-19-visual-canon-design.md`。

## 類別

條目放在 `docs/design/visual-canon/<類別>/<id>.md`。

| 類別 | 內容 | 例子 |
|---|---|---|
| `people` 具名人物 | 有名有姓的角色 | 最後的龍裔、伊斯格拉謨、泰伯·賽普汀、尼瑞瓦因、達格斯·烏爾、馬丁·賽普汀、烏弗瑞克 |
| `races` 種族 | 各種族的外貌特徵 | 諾德人、帝國人、布萊頓人、紅衛人、高精靈、木精靈、黑暗精靈、獸人、虎人、阿爾貢蜥人、鍛莫、雪精靈 |
| `factions` 陣營與服裝 | 陣營的制服與裝束 | 帝國軍團（3／4／5 代）、風暴斗篷、梭默、刀鋒衛士、阿卡維爾人、灰鬍子 |
| `gear` 裝備與武器 | 鎧甲與武器 | 鐵製、鋼製、矮人、精靈、玻璃、黑檀、魔族、龍骨鎧甲；精靈屠戮者、阿卡維爾刀 |
| `places` 建築與地景 | 建築、城鎮與地形 | 白金塔、帝都、天際城鎮與古諾德遺跡、矮人遺跡、晨風建築（Telvanni 蘑菇塔、Redoran、Hlaalu）、紅山、阿伊雷德遺跡、湮滅之門 |
| `creatures` 生物與魔族 | 生物與魔族 | 龍、奧杜因、帕圖納克斯、魔人（Dremora）、魔族領主的化身 |
| `objects` 神器 | 重要物品 | 王者護符、上古卷軸、洛克汗之心、矮人工具（護手、刀刃） |

`README.md` 本身、`prompt-parts/` 與 `scenes/` 子資料夾不是條目，載入時會略過。

## 條目格式

檔案由 frontmatter 與三個小節組成：

```markdown
---
id: imperial-legion
category: factions
name: { en: Imperial Legion, zh-tw: 帝國軍團 }
variants:            # 依版本規則挑一個；沒有的版本退回 default
  default: tes5
  tes3: "Imperial Legion of Morrowind: bronze-coloured ... (英文提示詞片段，80 字以內)"
  tes4: "..."
  tes5: "Skyrim Imperial Legion: red tunic over ... leather and steel ..."
refs: [imperial-legion-tes5-1, imperial-legion-tes4-1]   # 參考圖 id（見下方「參考圖」）
sources: [https://en.uesp.net/wiki/Lore:Imperial_Legion]
---

## 必要特徵
- （生圖後逐項檢查的清單，每項一句）

## 常見錯誤
- （GPT 常畫錯的地方，用英文寫成禁止句，會直接進提示詞；例如 Do not draw a Roman scutum shield. Do not draw Viking horned helmets.）

## 版本差異
- （3／4／5 代各自的樣子，一兩句）
```

規則：

- 會進提示詞的文字一律英文：`variants` 的值（提示詞片段）與「常見錯誤」（英文禁止句，例如 `Do not draw a Roman scutum shield.`）。其餘中文：「必要特徵」（驗收清單）與「版本差異」。
- 小節裡的清單項目一律以 `- ` 開頭；其他項目符號（`*`、`•`、編號）解析器會忽略。
- 版本鍵只能是 `tes3`、`tes4`、`tes5`、`eso`、`lore`；`default` 必須指向其中一個存在的版本（不能寫 `default: default`）。
- 只適用於某些版本的「必要特徵」或「常見錯誤」，在 `- ` 後面加版本標記：`- [tes4] 城內像車輪…`、`- [tes4, eso] Do not …`。組裝腳本只放進「沒有標記」與「標記含這次實際使用版本」的項目（實際使用的版本＝`resolveVersion` 的結果，含覆寫與退回 `default`），標記本身不會進提示詞或驗收清單。標記裡的版本必須是條目有片段的版本鍵；每個版本至少要留下一項必要特徵。不要再用「遺忘之都版：」「in the Skyrim version」這類寫在文字裡的版本說明，repo 測試會擋。
- `sources` 不可為空，每個條目都要有出處（UESP 頁面或遊戲）。
- 「必要特徵」不可為空，只寫遊戲裡看得到、能檢查的外觀。

## 版本規則

依事件的紀元與地點挑條目版本，`pickVersion` 照下表執行：

| 事件條件 | 版本 |
|---|---|
| 第四紀元 | `tes5` |
| 第三紀元 431 年以後 | `tes4` |
| 第三紀元 420 年以後，且地點在晨風 | `tes3` |
| 第二紀元 | `eso`（條目沒有 `eso` 版本時，退回 `tes5`） |
| 神話、第一紀元，或其他沒有對應遊戲的時代 | 條目的 `default`（通常是 `tes5` 或 `eso`） |

挑出的版本若條目沒有對應片段，就用條目的 `default`。

### 紀元與地區的允許值

`pickVersion` 比對的是確切字串，寫錯字會悄悄失去對應版本（例如把 `morrowind` 寫成 `vvardenfell`，第三紀元 420 年以後的事件就拿不到 `tes3`）。所以 `subjects.json` 的 `era` 與 `region` 只能用下列值，一致性檢查（`checkCanon`）會擋下其他值。要新增地區時，同時改 `scripts/visual-canon.mjs` 的 `CANON_REGIONS` 與這張表。

| 欄位 | 允許值 |
|---|---|
| `era` | `dawn`（黎明紀元）、`merethic`（神話紀元）、`1E`、`2E`、`3E`、`4E`（與網站 `src/lib/types.ts` 的 `ERAS` 相同） |
| `region` | `aetherius`、`akavir`、`atmora`、`black-marsh`、`cyrodiil`、`elsweyr`、`hammerfell`、`high-rock`、`morrowind`、`mundus`、`nirn`、`oblivion`、`skyrim`、`summerset`、`tamriel`、`valenwood`、`yokuda` |

版本規則只讀 `region` 的 `morrowind`（瓦登費爾、晨風本土的事件都寫 `morrowind`）；其他地區只是記錄。`overrides` 的值也必須是版本鍵（`tes3`、`tes4`、`tes5`、`eso`、`lore`），不能是 `default`。

## 事件對應表與場景

- `subjects.json` 每則事件的 `entries` 是「畫面裡畫得到的條目」，不是正文提到的所有條目；組裝腳本會把每個條目的片段、常見錯誤、必要特徵與參考圖都放進提示詞，多列的條目會讓模型多畫東西。第 1 期 20 則已照這個規則縮減；第 2 期候選目前仍列著正文提到的條目，寫場景時再縮減。
- `scenes/<event-id>.txt` 只寫構圖、動作、確切人數、時間與地點；人物、服裝、鎧甲、武器、建築與生物的長相都寫在條目裡。同一個條目在某則事件需要不同的樣子時（例如科瓦奇的祭司馬丁、創世神話的奧瑞爾），在條目裡加一個版本，再用 `overrides` 指定。

## 覆寫

個別事件可以在 `subjects.json` 的 `overrides` 欄位覆寫某個條目的版本，例如 `"overrides": { "imperial-legion": "tes4" }`。一致性檢查會確認被覆寫的版本在該條目裡真的存在。

## 參考圖

- 圖檔只放在 `.superpowers/refs/<參考圖 id>.<副檔名>`，不 commit、不放上網站。
- `refs.md` 是清單，用表格記每張圖的 id、對應條目、來源網址與說明（欄位：`id`、`條目`、`網址`、`說明`），只有網址與說明會進 git。
- 條目 frontmatter 的 `refs` 列出的每個 id 都必須出現在 `refs.md`，一致性檢查會確認。
- 參考圖 id 一律是 `<條目 id>-<版本鍵>-<序號>`（例如 `imperial-legion-tes4-2`），組裝腳本從倒數第二段讀出版本；repo 測試會擋下不合格式的 id。
- 同一張圖（同一個網址）可以登記在不同條目下；組裝腳本依網址去重，同一張圖只占 5 張上限中的一個名額。
- `fetch-refs` 下載中斷留下的 `<id>.<副檔名>.part` 不算已下載，不會送給生圖模型。
- `build-image-prompt` 每次執行會刪掉輸出資料夾裡這次沒用到的舊參考圖副本（檔名符合 `<…>-<版本鍵>-<序號>.<副檔名>`），只留下提示詞列出的那幾張；生成的圖、`prompt.txt` 與 `checklist.md` 不受影響。
