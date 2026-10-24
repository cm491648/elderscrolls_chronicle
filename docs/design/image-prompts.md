# 生圖提示詞（插圖與自繪地圖）

> 插圖提示詞改由 `scripts/build-image-prompt.mjs` 從 `docs/design/visual-canon/` 組裝；本檔保留歷史紀錄。

- 版本：2026-10-18（任務 R9、R10）
- 負責：Claude 撰寫提示詞與驗收；Codex（`scripts/codex-image.sh`，Codex CLI 0.163.0，模型 `gpt-6.1-sol` 的內建生圖工具）產圖。
- 視覺依據：`docs/design/directions.md` 方向 A（1.6、2.8）與 `docs/design/style-guide.md`（第 2 節色票、第 6 節插圖）。
- 樣張放在 `.superpowers/image-samples/r10/`、`.superpowers/image-samples/r9/`（不進 git）；每張的評語與重產紀錄見 `.superpowers/sdd/2026-10-18-phase1-revision/task-R9-R10-report.md`。畫風與地圖還沒定案，定案後才把選中的圖放進 `public/` 並記入 `assets-log.md`。
- 提示詞用英文寫（生圖模型對英文的遵循度較好），說明用中文。

---

## 0. 組裝方式

每份提示詞由五段組成，依序串接後存成一個檔案，再執行：

```bash
scripts/codex-image.sh <prompt-file> <output-dir>
```

| 段落 | 插圖 | 地圖 |
|---|---|---|
| 1. 給 Codex 的指令（第 1 節） | 共用 | 共用 |
| 2. 基底（畫面用途、色票、構圖、光線） | 第 2.1 節 | 第 4.1 節 |
| 3. 畫風變體 | 第 2.2 節選一個（A／B／C） | 無（地圖只有一種畫風） |
| 4. 題材（場景、人物、構圖細節） | 第 3 節 | 第 4.2～4.4 節 |
| 5. 禁用元素 | 第 2.3 節 | 第 4.5 節 |

`{FILE}`、`{SIZE}`、`{SPOT}` 是要替換的欄位。尺寸用生圖工具支援的三種：橫幅 `1536x1024`（場景、地圖）、直幅 `1024x1536`（肖像）、方形 `1024x1024`（裝飾）。

---

## 1. 給 Codex 的指令

不寫這段時 Codex 可能改用程式畫圖或擅自後製，所以每份都要放。

```text
TASK: Generate exactly ONE image with your built-in image generation tool, then save it in the current directory as {FILE} (PNG). Do not draw it with code (no PIL, SVG, canvas or procedural drawing), do not add a border, do not post-process except saving. If the image tool refuses or fails, do not substitute anything: reply with the exact error text. Otherwise reply with the file name and its pixel size only.

IMAGE SIZE: {SIZE}

IMAGE PROMPT:
```

---

## 2. 插圖範本

### 2.1 基底

插圖是夾在書裡的「圖版」：網站用 CSS 加 1px 墨框與外圈金線（`style-guide.md` 第 6 節），所以圖本身**不畫框**。色票對應方向 A：骨白紙 `--surface`／`--surface-2`、鐵膽墨 `--ink`、淡墨 `--ink-soft`、青金石 `--accent`、朱紅 `--accent-2`、金線 `--gilt`。

```text
PURPOSE: one illustration plate for a printed history book about an invented world (the website frames it with a thin ink rule and a gold rule, so the picture itself has NO border). The mood is restrained and documentary, like a plate reproduced in a scholarly edition of a medieval chronicle. It must NOT look like a fantasy video-game poster or concept art.

PALETTE (strict, few colours): ground of clean bone-white paper (#f5f3ee, #ece8dd), even in tone; line work in iron-gall ink with a cool blue-black cast (#1e1c2c) and a softer grey-violet ink (#575468); main colour lapis-lazuli blue (#24508f); vermilion red (#a1281e) used sparingly as the single warm accent; gold (#ad8730) only as thin lines or small touches. No other saturated hues, no brown sepia cast, no orange glow. Where the STYLE block below restricts colours further, the STYLE block wins.

COMPOSITION: one clear focal point, figures read clearly at 600 px wide, calm areas of plain paper around the subject, nothing important cut by the edge. Low-key storytelling: show the moment, not an action pose.

LIGHT: flat and even, as in book illustration; no rim light, no bloom, no lens flare, no glowing magic effects.
```

**夜景或暗場景要另加這段**（第一輪的淚之夜三張都畫成整片深色，B、C 幾乎沒有留白；加了之後第二輪全部改善）：

```text
NIGHT AS IN A BOOK PLATE: keep the whole picture light in value, like a printed book illustration, not a dark painting. Suggest night only with a band of lapis-blue sky (or sparse horizontal lines) and a few stars; leave the sea mostly as light paper with simple wave lines; at least a third of the image is untouched or very lightly toned paper. No large solid dark masses, no heavy black smoke. The flames are small and painted in vermilion red, not orange or yellow. The figures are simplified and readable, not hyper-detailed.
```

### 2.2 畫風變體（三選一）

| 變體 | 中文名 | 特色 | 適合 |
|---|---|---|---|
| A | 泥金抄本細密畫風 | 細墨線＋平塗不透明色，天空與海是整片青金石藍，少量金點；圖的邊緣不規則地收進紙裡 | 和網站的抄本版面最一致；色彩最飽滿 |
| B | 鋼筆淡彩版畫風 | 鐵膽墨鋼筆線與排線，透明水彩淡染，大量留白，邊緣淡出 | 最像考古報告或旅行速寫圖版；人物描寫最細 |
| C | 銅版畫單色加一色 | 藍黑單色雕線（排線、交叉線、點刻），只加一個平塗特別色 | 最節制、最有「史料」感；暗場景容易太黑 |

```text
STYLE A — ILLUMINATED MANUSCRIPT MINIATURE: a miniature painting in the manner of a 14th–15th century illuminated manuscript. Fine, even ink outlines; flat opaque gouache-like colour areas with gentle tonal modelling; slightly stylised medieval perspective; small stylised figures with expressive gestures; sky and water as flat lapis-blue fields with small dotted or wavy line patterns; touches of gold leaf only on small details (a rim, a highlight). Background of plain bone-white paper around the miniature's irregular edge — no diapered patterns, no ornamental borders.
```

```text
STYLE B — PEN AND WASH PLATE: an iron-gall pen drawing with transparent watercolour washes, like a careful 19th-century archaeological or travel-sketch plate. Confident pen contours and light parallel hatching for shade; washes mostly in lapis blue and cool grey, with vermilion only for a few small accents; much of the white paper left untouched; soft, unfinished edges where the washes fade into the paper.
```

```text
STYLE C — COPPERPLATE ENGRAVING, ONE INK PLUS ONE SPOT COLOUR: a fine copperplate engraving printed in blue-black ink — crisp parallel lines, cross-hatching and stipple for every tone, no washes, no gradients — plus exactly ONE flat spot colour printed in a few areas, as in a two-colour print. The spot colour is {SPOT}. Everything else is ink on clean white paper.
```

C 的 `{SPOT}`：預設 `lapis blue`；有火的場景用 `vermilion, used only for the fire and its reflection on the water`。

### 2.3 禁用元素

```text
STRICTLY AVOID: any text, letters, numbers, runes, glyphs, calligraphy, captions, labels, signatures, monograms or watermarks; borders, frames, ornamental margins; modern objects; game UI, icons, logos, heraldry from existing games, Daedric or Dwemer script; photorealism, 3D render, glossy digital painting; gore, blood splatter, wounds, corpses in close-up; aged, torn, burnt or stained paper, foxing, coffee rings, vignetting, parchment texture; neon, glow, gradients imitating metal.
```

### 2.4 寫題材段的原則

1. **只畫正文寫到的東西**，數量寫死（例如 `EXACTLY THREE men and nobody else`），並寫出每個人的位置與動作。
2. 選「故事轉折處」的一刻（`directions.md` 1.6），偏向靜態、有情緒的畫面，不選刀劍交擊的瞬間。
3. 專有名詞要翻成外觀描述：Codex 打不開 UESP，模型也可能把名字畫成遊戲造型。例如「Chimer 的甲」寫成 `segmented insect-shell armour (lacquered chitin plates)`；「Dwemer」寫成 `elves in heavy bronze-coloured plate armour with full beards`。
4. 主動排除刻板印象：諾德人 `no horned helmets`；魔法物件 `no glowing objects`。
5. 不放任何官方紋章、Daedric／Dwemer 字母或遊戲裡的武器造型；旗幟寫 `plain pennants with no emblems`。

---

## 3. 插圖題材（樣張用）

### 3.1 淚之夜：伊斯格拉謨的船駛離燃燒的薩瑟爾城

依據 `src/content/events/zh-tw/night-of-tears.md`：全城只有父子三人生還，搭僅存的一艘船出海；伊斯格拉謨望著燃燒的城市落淚；楊戈爾是鐵匠。圖說可寫「**圖一**　伊斯格拉謨的船駛離燃燒的薩瑟爾城」。尺寸 `1536x1024`；三個變體都畫這一題，並加上 2.1 的夜景段。

```text
SUBJECT — "The ship of Ysgramor sailing away from burning Saarthal" (a legendary northern migration story, late prehistoric era):
Night. In the foreground-middle, ONE small open wooden boat of a northern seafaring people (a short clinker-built boat with a single mast and a furled or half-set square sail, oars) on a dark, calm-to-choppy sea. In the boat are EXACTLY THREE men and nobody else: an older chieftain with a long beard standing at the stern, looking back toward the shore, one hand raised to his face as if wiping tears; and his two grown sons, one at the oars, one seated near the bow — the son at the bow is a smith, broad-shouldered. They wear simple wool tunics and fur cloaks, no horned helmets, no visible weapons except perhaps one sheathed sword. In the background, across the water, a snowy rocky coast with low cliffs, and on it a small walled settlement of timber longhouses and a few stone buildings on fire: flames and a column of smoke rising into the night sky, reflected faintly on the water. The fire is far away and small in the frame; no people are visible in the burning town. A few stars. The mood is grief and exile, not battle.
```

### 3.2 紅山之戰：兩軍在紅山下的灰原上交鋒

依據 `battle-of-red-mountain.md`：「將領們把 Dwemer 的大部分守軍從山腹中的要塞引到野外牽制住」。選野戰而不選密室，是為了避開「發光的心臟」這種奇幻特效畫面。尺寸 `1536x1024`；樣張用 A。

```text
SUBJECT — "The armies meet on the ash plain below Red Mountain" (an ancient war between two elven peoples on a volcanic island):
A wide view. Dominating the upper half: a great solitary volcano with a broad cone and a plume of dark smoke and ash drifting sideways; the land around it is barren grey-brown ash plain with a few twisted shrubs and jagged rocks. In the lower middle ground, two orderly armies of small figures face each other in a measured, chronicle-like arrangement (like a battle shown in a medieval history manuscript), just beginning to clash in the centre: on the left, elves in segmented insect-shell armour (lacquered chitin plates, rounded helmets) carrying spears and tall plain pennants with no emblems; on the right, elves in heavy bronze-coloured plate armour with full beards, carrying halberds and axes, with one or two angular bronze siege machines behind them. Near the foot of the mountain, a dark doorway cut into the rock face hints at a fortress inside the mountain. Restrained: no blood, no corpses, no explosions, no glowing objects.
The bearded elves are of normal elven height and build, not dwarves: tall, lean, with smooth rounded bronze helmets, no pointed or conical hats. Vermilion appears only on a few small pennants on the right; the volcano shows no glowing lava, only dark smoke and grey ash. Figures stand in ranks with spears lowered, not lunging.
```

最後一段（The bearded elves...）是第二版加的：第一版的 Dwemer 戴尖盔、像矮人，火山畫了發光的熔岩，右軍紅旗紅披風也偏多。第二版改善了頭盔與熔岩，但 Dwemer 的身形仍偏矮壯，量產時可能還要再調。

### 3.3 人物肖像：伊斯格拉謨

尺寸 `1024x1536`；樣張用 B。肖像不一定每則事件都要，可留給人物頁或術語提示框。

```text
SUBJECT — "Portrait of Ysgramor, chieftain of the northern settlers" (a legendary founder figure):
A half-length portrait of one man, three-quarter view, facing left, against plain bone-white paper. Late middle age, weathered face, deep-set eyes, a long full beard partly braided, hair tied back; a heavy fur mantle over a plain wool tunic, a simple iron arm ring. He rests both hands on the haft of a large two-handed battle-axe with a dark, almost black blade of an obsidian-like glassy metal, its head standing beside his shoulder. Expression: grave, tired, resolute — a portrait for a history book, not a hero pose. No helmet, no horns. Composition: figure fills the lower two-thirds, head in the upper third, generous paper above.
```

### 3.4 地圖裝飾：羅盤玫瑰

尺寸 `1024x1024`；樣張用 C，`{SPOT}` 填 `lapis blue, used only for the shaded halves of the four main points`。可放在自繪地圖的角落（由網站疊加，不畫進底圖）。

```text
SUBJECT — "Map ornament: compass rose" (to sit in the corner of a map of an invented continent):
A single compass rose, centred, on plain white paper with wide empty margins. Sixteen points: four long main points, four medium diagonal points, eight short points; each point split into a light half and a shaded half; an outer double ring with small evenly spaced tick marks; the north point distinguished only by a small fleur-like finial (no letter). Thin delicate lines; elegant, restrained cartographic ornament like those on 17th-century engraved sea charts. ABSOLUTELY NO letters such as N, S, E, W, no numbers, no degree labels.
```

---

## 4. 自繪地圖（R9）

地名、標記、省界都由網站的 SVG 疊上去，所以底圖**完全不放文字**（生圖模型寫的字幾乎一定是亂碼）。網站圖層的比例：泰姆瑞爾 1000 × 714、奈恩 1000 × 600、宇宙 1000 × 700（`src/components/MapView/shapes.ts`）；生圖一律用 `1536x1024`，定案時再裁切或補邊。

### 4.1 地圖基底

色票對應 `style-guide.md`：陸地 `--map-land`、海 `--map-sea`、墨線 `--ink`、河湖 `--accent`。陸地內部要低對比，才不會蓋過 SVG 名牌與標記。

```text
PURPOSE: a base map for a website about the history of an invented world. Place names, markers and borders are overlaid later by the website as vector graphics, so the image itself must contain NO text of any kind. The website frames the map with a thin ink rule and a gold rule, so the image has NO border, no cartouche, no title, no compass rose, no scale bar.

STYLE: a clean, precise hand-drawn map in the manner of an engraved atlas plate from a scholarly edition: fine iron-gall ink coastlines, gentle water-lining (two or three thin parallel lines following the coast out to sea), small hatched hill and mountain symbols drawn in profile, tiny stippled marsh tufts, small clustered tree symbols for forests, thin rivers. Not aged, not torn, no stains, no parchment texture, no vignette: the paper is clean and even.

PALETTE (strict): land in clean bone-white paper (#eeebe1 / #f5f3ee); sea a flat pale grey-green (#d5d8d3), slightly darker near the coasts; ink lines blue-black (#1e1c2c) and soft grey-violet (#575468); rivers and lakes as muted lapis blue (#24508f) lines with a pale blue tint; mountains shaded with ink hatching only; no other colours: no red, no brown, no green forests. Keep contrast inside the land low so that vector labels and markers stay readable on top.

LIGHT: none, flat map.
```

### 4.2 泰姆瑞爾（備用版）

Codex 看不到正式圖，地理全靠文字描述；描述依 `public/maps/official/` 的 Anthology 地圖逐區寫成。第二版加了「密度」段（第一版整片陸地都畫滿山），第三版把 Vvardenfell 的大小改用像素寫死（前兩版都畫成角落裡一座繞著圓形水道的小島）。

```text
SUBJECT: map of the continent of Tamriel (a fictional continent; draw this specific geography, filling the frame with the continent and a narrow sea margin all round).
Overall shape: one large, compact continent, wider than tall (about 1.4 : 1), with a long ragged northern coast running roughly east-west, a western coast deeply cut by one great bay, a southern coast with two large peninsulas and a deep narrow gulf between them, and an eastern coast facing an open ocean. Two large islands lie off the south-west.
Region by region (north is up):
1. North-west corner (High Rock): a broad peninsula pointing west and south-west, with many small bays.
2. Directly south of it, the GREAT BAY (Iliac Bay): a long bay entering from the west between the north-west peninsula and the west-central land, reaching about one sixth of the continent's width inland; a few islets in it.
3. West-central, south of the bay (Hammerfell): a wide land with a fairly smooth west coast; at its south a large rounded bay opening to the south-west, with one medium island offshore to the south-west.
4. North-centre (Skyrim): a high, rugged mountainous land whose northern coast is fringed by small rocky islands and inlets; mountain ranges run along its southern edge.
5. North-east (Morrowind): a large region. Its northern half is taken up by a BIG island (Vvardenfell): in a 1536 px wide image it is about 280 px across and 300 px tall, i.e. clearly bigger than the north-west peninsula's width and much bigger than any offshore island. It is NOT a small island in a round moat: it is joined to the continent's outline and separated from the mainland only by an INNER SEA, a narrow channel (20 to 60 px wide) shaped like a horseshoe that wraps around the island's west, south and east sides and opens to the northern ocean at both ends; the eastern arm of the channel is wider and dotted with islets. One volcanic cone stands in the middle of the island. South and east of the channel is a broad mainland that continues down to the south-east lands. A smaller separate island lies to the north, off the coast between the north-centre and north-east lands.
6. Centre (Cyrodiil): the largest region, a broad interior of forest and rolling land; in its middle a large lake with an island in it, and from that lake a long river flows south-south-east, widening into a long, narrow, fjord-like gulf that reaches the southern coast.
7. That long gulf separates the southern lands: west of it, the south-centre land (Elsweyr: dry upland in the north, jungle in the south) and, further west, the south-west peninsula (Valenwood: dense forest) ending in a rounded southern cape; east of it, the south-east (Black Marsh): a big swampy lobe whose southern coast is broken by irregular lagoons and inland lakes.
8. South-west, across a strait from the south-west peninsula: two large islands: a big irregular island (Summerset) with a deep bay on its east side, and close east of it a long, thin, north-south island (Auridon).
9. East coast: fairly straight, facing open ocean, with a few small islands off the north-east.
Mountains: ranges along the borders between regions, notably along the south edge of the north-centre land and between the centre and the north-east. Forests mostly in the south-west peninsula and the centre; marsh in the south-east.

DENSITY: keep the land quiet and mostly plain paper so labels can sit on it. Draw mountain symbols only in a few ranges (north-centre, the volcanic island, the borders between centre and north-east, the west of the south-centre land and the north-west peninsula), with large plain areas elsewhere; forest symbols light and sparse; no mountains in the south-east marsh or in the centre around the lake. Coastline detail fine but not fractal.
```

### 4.3 奈恩世界圖

官方沒有世界圖（`docs/research/maps.md` 第 3 節），位置依 UESP 的文字描述（Atmora 在北、Akavir 在東、Yokuda 在西且大半沉沒、Pyandonea 在南方海上），並配合網站奈恩層的版面（`shapes.ts`：泰姆瑞爾在中央偏下、Atmora 上方正中、Akavir 右、Yokuda 左、Pyandonea 左下）。

```text
SUBJECT: world map of the planet Nirn (a fictional world), shown as a flat sea chart with NO graticule and no grid. Five landmasses in an open ocean, drawn as plausible natural coastlines:
- CENTRE, slightly below the middle: Tamriel, a compact continent wider than tall (about 1.4 : 1), about one quarter of the image width. Its outline: a ragged north coast; a north-west peninsula with a long bay entering from the west just south of it; a big round island in the north-east wrapped by a horseshoe-shaped inner sea; a large central lake draining by a river into a long narrow gulf that cuts the south coast in two; a forested south-west peninsula; a swampy south-east lobe with lagoons; and off the south-west two large islands (one irregular, one long and thin).
- NORTH, top centre, across a cold sea: Atmora, a large frozen continent about as wide as Tamriel, its land drawn as pale ice and snow with crevasse hatching and a few bare mountain ridges.
- EAST, right side, across a wide ocean: Akavir, a large continent at least as big as Tamriel, rugged and mountainous, with a long coast facing Tamriel.
- WEST, left side: Yokuda, a once-great continent that has mostly sunk: a scattered archipelago of large and small broken islands, with dotted shoals and reefs hinting at a lost coastline between them.
- SOUTH-WEST, below and to the left of Tamriel, beyond its south-western islands: Pyandonea, a small archipelago of jungle islands half veiled in drifting sea mist (drawn as soft hatched bands of cloud).
Leave generous open sea between the landmasses. Overall proportion landscape, about 5 : 3.

DENSITY: land drawn quietly, with sparse mountain and forest symbols and large plain areas, so labels can be overlaid.
```

### 4.3.1 奈恩重畫（nirn-v3）：泰姆瑞爾改成網站的海岸

nirn-v2 的泰姆瑞爾是風格化的形狀，網站在奈恩層替省份上色時，色塊會超出畫出的海岸（九省平均約 20% 落在海上，艾斯維爾、夏暮島超過一半）。純文字提示詞做不到逐灣對齊（4.2 試了三版，IoU 只有約 0.7），所以第三版改成**先用程式把輪廓定死，再讓 Codex 只重畫內部**：

1. **海岸**：從正式 Anthology 地圖描出陸地與海（從外海開始 flood fill，遇到每條海岸都有的深褐色帶就停；內海、托帕爾灣、尼班河這類和外海相連的水域保留為海，小於 400 px 的湖填成陸地），用 `shapes.ts` 的 parent link（k 0.424、x 264.36、y 194.7）放到奈恩圖上。網站的省份輪廓本來就比海岸外擴約 3.5 單位，所以海岸只往**寬闊**海面再長 3 px，窄水道維持原寬。只留下遮罩，正式地圖的像素一個都沒有用到。
2. **底稿**：在 nirn-v2 上，把舊泰姆瑞爾周圍 26 px 內塗成海色，依遮罩填上紙色，用 nirn-v2 自己的海岸畫法（從 Akavir 西岸量得：約 22 px 的淡色淺灘、9 px 與 4 px 兩條水線、2 px 灰藍墨線）畫海岸，再從 nirn-v2 剪下山脈、森林、沼澤筆觸蓋印在山帶與林區（這就是候選 a）。
3. **Codex 只畫內部**：把底稿放進 Codex 的工作資料夾，叫它把 `reference.png` 當輸入圖做編輯（下面的提示詞）。Codex 回報生圖工具確實讀到了參考圖；輸出 1619 × 971，放大回 1700 × 1020 後海岸與底稿幾乎重合（ECC 對位的位移不到 0.1 px，IoU 0.927）。
4. **合成**：最後只取 Codex 畫的泰姆瑞爾內部，貼回底稿的遮罩裡，海岸照第 2 步重畫；其他四塊大陸與海維持 nirn-v2 的原像素（和 nirn-v2 逐像素比較，差異為 0）。

```text
TASK: In the current directory there is reference.png (1700x1020), a text-free world map of an invented planet drawn in a clean engraved-atlas style. First look at reference.png with your image viewing tool. Then use your built-in image generation tool to make ONE new image based on it, using reference.png as the input/reference image (an edit of it, not a new composition), and save it in the current directory as nirn-v3c.png. Do not draw with code (no PIL, SVG or canvas), do not paste or composite pixels yourself. If the image tool cannot take a reference image, or refuses or fails, do not substitute anything: reply with the exact message. Otherwise reply with the file name, its pixel size, and whether the tool actually received reference.png as input.

WHAT TO CHANGE: only the central continent (Tamriel). Its interior is too plain compared with the four other landmasses. Redraw its interior relief in exactly the same hand as the eastern continent: small ink mountain ranges in profile along the existing mountain belts, a few thin lapis-blue rivers flowing to the coast and into the long lake and the long narrow gulf, light tree clusters in the south-west forest and the south-centre, stippled marsh tufts and pools in the south-east, a lone volcanic peak on the large north-eastern island.

WHAT MUST NOT CHANGE: the coastline of the central continent must stay exactly where it is, every bay, strait, inner sea, lake and island in the same place and size: the horseshoe-shaped inner sea around the north-eastern island, the long lake in the middle, the long narrow gulf to the south, the great bay on the west, the two large south-western islands and the strait between them. The other four landmasses, the sea colour and the whole layout stay as they are. Same framing, same size, no cropping.

STRICTLY AVOID: any text, letters, numbers, labels, signatures or watermarks; borders, frames, compass roses, grid lines, ships, sea monsters; political borders or coloured provinces; aged or stained paper.
```

量測方式（`.superpowers/image-samples/r9/nirn-v3-tools/measure3.py`）：從成品圖本身切出陸地（比海亮 14 以上的紙色，或比 150 暗的墨線與筆觸，閉運算 7 px），在泰姆瑞爾範圍內和九省輪廓的聯集算 IoU；「填湖」版把封閉的水面算成陸地，和外海相連的內海仍算海。

### 4.4 宇宙觀圖

依 UESP 的文字描述：奈恩在凡界（Mundus）中心，周圍有兩個月亮與八顆行星；湮滅（Oblivion）是包圍凡界的黑海，漂著無數領域；艾瑟瑞斯（Aetherius）是光之界，太陽與星星是通往它的孔。網站宇宙層是四個同心圓（半徑 50／150／240／330，高 700）。第一版最外圈超出畫面、中央畫成地球、行星像太陽系（有土星環）；第二版寫了半徑比例，但模型沒照做，角落還多了螺旋星系；第三版改用像素寫死半徑、限定八顆行星、禁止星系。不畫任何 Daedric 紋章或 ESO Aurbis 圖的徽章。

```text
SUBJECT: a diagram of the cosmos of an invented world, drawn like a plate of concentric celestial spheres in a Renaissance cosmography, but with no text, no zodiac signs, no symbols. Seen from above, centred, perfectly concentric circles, ALL of them fully inside the image.
EXACT PROPORTIONS, in pixels of the 1536 x 1024 image, measured from the centre point (768, 512):
- The central world globe: radius 70 px.
- The pale Mundus disc ends at radius 215 px (its edge is well away from the globe; the planets' orbit is at about 160 px).
- The dark Oblivion ring runs from 215 px to 350 px: a WIDE dark band, about 135 px thick.
- The bright Aetherius ring runs from 350 px to 480 px, so its outer edge stays 32 px inside the top and bottom edges of the image and is NOT cut off.
- Outside 480 px: the Void.
So the Mundus disc is less than half the height of the whole diagram, and each ring is clearly visible.
CONTENT:
- CENTRE: a small globe (the world, Nirn) showing a few vague invented landmasses (NOT Earth: no Europe, Africa or Americas), circled by the orbits of two small moons, one pale and one slightly larger.
- MUNDUS (pale disc around the globe): one thin orbit line carrying EXACTLY EIGHT small plain round planets (count them: eight planets, not counting the sun and the two moons) at evenly spaced points, all simple flat spheres with ink hatching (no rings, no stripes, no real-world planet look), plus a small sun drawn as a simple disc with straight rays. Muted ink and lapis tints only.
- OBLIVION (dark ring): deep blue-black ink hatching, in which many small, varied, strange floating islands drift like isles in a black sea: rocky islets, a spire, a tangled forest islet, an icy islet, a smouldering islet; drawn in ink and pale paper tones only (no green, no red); none carrying any symbol or emblem.
- AETHERIUS (outermost ring): a broad band of bright, nearly blank paper with fine radiating lines of light and small pierced star points.
- Beyond the outermost ring, in the four corners: plain dark ink stipple with a few tiny stars (the Void); no galaxies, no spirals, no nebulae.
Rings are separated by thin double ink lines with one thin gold line. The sun and the separating lines may use a little gold; otherwise only ink, lapis blue and paper.
```

第三版的四圈相對比例已接近網站（以最外圈為 1：奈恩 0.15、凡界 0.51、湮滅 0.79；網站是 0.15、0.45、0.73），但整體仍放大約 1.3 倍，最外圈上下被切掉。下一輪建議改用 `1024x1024` 方形產圖（圓形自然落在方框內），定案時左右補上虛空色延伸成 10 : 7。

### 4.5 地圖禁用元素

```text
STRICTLY AVOID: any text, letters, numbers, runes, place names, labels, legends, signatures or watermarks (not even illegible pseudo-writing); borders, frames, cartouches, compass roses, sea monsters, ships, decorative figures; political borders or coloured provinces; grid lines; modern objects; game UI or icons; photorealistic satellite look, 3D relief rendering, glossy digital painting; aged, torn, burnt or stained paper, foxing, vignetting, parchment texture.
```

---

## 5. 驗收清單（每張圖）

1. 無文字、無亂碼字、無浮水印、無簽名（放大檢查角落與旗幟、盾牌、地圖海面）。
2. 人物數量、動作、場景與正文一致；沒有正文沒寫的角色或物件。
3. 色調在方向 A 色票內：骨白紙底、藍黑墨、青金石為主色，朱紅只當點綴；沒有棕褐泛黃、橘色火光或綠色。
4. 不仿舊：沒有破紙、污漬、暗角。
5. 不像遊戲：沒有官方紋章、Daedric／Dwemer 字母、遊戲 UI、發光特效、英雄姿勢。
6. 600px 寬時主體仍看得清楚；畫面大部分不是大片深色。
7. 地圖另加：地理與正式圖或文字描述相符（見報告的比對表）；陸地夠安靜，疊上名牌後仍好讀；比例能裁成網站圖層的比例而不切掉陸地。
8. 定案前處理：純白底（`#ffffff`）的圖要換成 `--surface-2` 或在 CSS 用 `mix-blend-mode: multiply`，深色模式另訂濾鏡（同 `--map-raster-filter` 的做法）。

---

## 6. 量產（20 則，畫風 A）

> **注意（2026-10-19）**：這 20 張插圖已依視覺設定集改用畫風 B 重畫（commit `8f23a18`）。提示詞現在由 `scripts/build-image-prompt.mjs` 從 `docs/design/visual-canon/` 組裝，該資料夾才是提示詞的依據；以下是畫風 A 時期的舊內容，保留作紀錄，不再更新。

使用者在確認頁選定畫風 A、每則事件一張（2026-10-18）。每份提示詞＝第 1 節指令＋2.1 基底＋下面的「量產規則」＋2.2 的 STYLE A＋各則題材＋2.3 禁用元素；尺寸一律 `1536x1024`。成品在 `.superpowers/image-samples/final/<event-id>.png`（不進 git），圖說在同資料夾的 `captions.json`。

淚之夜、紅山之戰沿用第 3.1、3.2 節的樣張（`tears-A-v2`、`redmtn-A-v2`），對照 R5 校對後的正文仍相符（父子三人乘船離去、望著燃城；將領把守軍引到山外野戰），沒有重產。

### 6.1 量產規則

把 R10 樣張的發現（夜景要亮、火是朱紅不是橘、木頭偏灰紫、數量要寫死）整理成固定的一段，每份都放：

```text
PRODUCTION RULES (series of 20 plates, keep them consistent):
- The miniature sits in the middle of the image with an irregular, softly cut edge and a margin of plain bone-white paper on every side (about 4-6% of the width).
- Keep the picture light overall: at least a third of the image is untouched or lightly toned paper; no large solid dark masses. Night, storms and interiors are suggested with a band of lapis blue or sparse lines, not painted dark.
- Fire is small and painted in vermilion red, never orange or yellow; smoke is light grey, not black.
- Wood, rope and leather are drawn in grey-violet ink tones, not brown.
- Figures are simplified and readable at 600 px wide, not hyper-detailed; faces calm, gestures clear.
- Only the people and things described below appear. Count matters: when a number is given, draw exactly that number.
```

### 6.2 各則題材

「CORRECTIONS」是重產時加上的段落，寫的是前一版的錯誤；保留在這裡，日後重產可以直接沿用。

#### `aldmer-arrive-summerset`

```text
SUBJECT — "Lord Torinaan steps ashore on Auridon" (an ancient elven people arrive by sea at an uninhabited island, legendary era):
Daylight. A wide pale sand beach on the north shore of a green, gently hilly island. Offshore, EXACTLY NINE tall elegant sailing ships with high curved prows and single white sails ride at anchor in a calm lapis-blue sea. One small rowing boat has been pulled onto the sand. In front of it stands one tall, slender elven lord in long pale robes and a simple circlet, the first to set foot on the beach, one arm raised toward the land as he claims it; a few (four or five) robed elven followers wait behind him at the water's edge. Long-eared, fair, dignified people. No buildings, no animals, no weapons drawn.

CORRECTIONS (previous attempt got these wrong):
- Count the ships: EXACTLY NINE ships. Arrange them as THREE separate groups of THREE ships each (3 + 3 + 3 = 9), at different distances on the sea; not two rows of five, not ten. Before saving, count the ships in the image; if there are not nine, generate again.
- The lord stands facing inland (toward the green hills on the right), his raised arm pointing at the land he claims, his back half turned to the ships.
- The ships are tall, slender ELVEN ships with high swan-neck curved prows and sterns, pale hulls and tall narrow white sails, like elegant galleys: NOT Viking longships, no dragon heads, no shields on the sides.
- The rowing boat on the sand is pale grey wood.
```

#### `alessian-slave-rebellion`

```text
SUBJECT — "Pelinal goes alone against the White-Gold Tower" (a rebellion of enslaved humans against elven overlords, early history):
A tall, slender, pale white tower rises from the centre of a walled elven city on an island in a lake, its gates shut. On the near shore, a large besieging army of humans waits in orderly ranks behind wooden palisades and tents, with plain pennants without emblems; they hesitate and do not advance. From the army, ONE lone warrior in plain steel plate armour and a white surcoat walks forward alone across a causeway toward the tower gate, sword in hand. Seen from a slightly raised viewpoint so the tower, the lone figure and the waiting army are all visible. Daylight. No fighting yet, no bodies.
```

#### `atmoran-migration`

```text
SUBJECT — "A fleet of northern settlers lands on the coast of Skyrim" (a legendary migration from a cold northern continent):
Daylight, pale winter sky. A rocky, snowy northern coast with low dark cliffs and a pebble beach. Four or five open clinker-built wooden boats with single square sails have just reached the shore; two are pulled up on the pebbles. Men, women and children in wool tunics and fur cloaks wade ashore and unload bundles, barrels, a goat and tools. No helmets with horns, no weapons raised, no other people on the shore; the land beyond is empty and quiet. The mood is arrival and hope after a hard crossing.
```

#### `creation-of-mundus`

```text
SUBJECT — "Auriel shoots the Heart of Lorkhan across the sea" (a creation myth: a god binds a heart to an arrow and shoots it far over the ocean; where it falls a volcano rises):
Mythic, like a creation scene in a medieval world-chronicle. On the left, on a band of stylised clouds, a tall crowned god in long robes draws a great bow, a stylised heart shape bound to the arrow (a simple dark-red heart emblem, not anatomical, no blood). The arrow's path is a thin gold line arcing over a wide lapis-blue sea with small wave patterns. On the far right, small in the distance, a lone volcanic island cone rises from the sea where the arrow comes down, with a thin plume of grey smoke. No other figures. Sky as a flat lapis field with a few small gold stars.

CORRECTIONS (previous attempt got these wrong):
- The god is clearly MALE: a tall man with short hair or a short beard, broad-shouldered, in robes; not a woman.
- The heart is NOT the arrowhead: the arrow has a normal pointed head, and a small dark-red heart is tied with a cord to the shaft just behind the head. It must not look like a Cupid or Valentine arrow.
- Show the arrow in flight halfway along its gold path over the sea, the bow just released; the volcano at the far end is rising from the sea.
- The miniature fills the frame evenly with only the thin paper margin on all sides, centred vertically: NO large empty area at the bottom or top. The sea fills the lower part of the miniature; the sky band is the upper part.
- The bow has just been released: the bowstring is straight and relaxed, the god's drawing hand open beside his cheek.
```

#### `first-council-expels-nords`

```text
SUBJECT — "Nerevar and Dumac seal their alliance" (two rival elven peoples join against a northern invader):
Outdoors on a barren grey upland, a great volcanic mountain smoking faintly in the distance. In the centre, two leaders clasp forearms as sworn blood-brothers: on the left, a dark-haired golden-skinned elven general in segmented insect-shell (lacquered chitin) armour with a plain cloak; on the right, a bearded elven king of normal elven height and lean build in bronze-coloured plate armour and a simple circlet, NOT a dwarf. Behind the general, a small group of his people in chitin armour with plain lapis pennants; behind the king, a small group of bearded elves in bronze armour. The two groups stand apart, watchful, while the leaders meet in the middle. No fighting, no weapons raised.
```

#### `great-war`

```text
SUBJECT — "The Thalmor envoy brings his demands to the Emperor" (an elven ambassador confronts a human emperor in his throne hall, shortly before a great war):
Inside a high stone throne hall with tall arched windows (drawn as pale arches, interior kept light). On a raised throne at one side sits a middle-aged human emperor in a dark robe with a simple gold circlet, one hand raised in refusal. Two or three armoured generals stand near him. Before the throne stands a tall, slender, golden-skinned elven envoy in long dark robes, calm and cold. Beside the envoy stands a small wooden cart covered completely with a plain grey cloth (its contents unseen). Court officials stand at the edges. Tension, no violence; nothing under the cloth is visible.
```

#### `harald-crowned-high-king`

```text
SUBJECT — "Harald is crowned High King of Skyrim" (a northern king unites his land, early history):
Inside a long timber-and-stone great hall with a central hearth (small vermilion fire) and carved roof beams. At the far end, a strong man of about thirty with a reddish beard sits on a plain high-backed wooden throne, newly crowned with a simple iron circlet crown, a fur mantle on his shoulders. Along both sides of the hall, warriors stand in lines wearing new matching iron helmets with short horns, mail and round shields, raising their spears in salute; several chieftains in fur cloaks stand nearest the throne. No other figure holds the crown; no banners with emblems. Dignified, ceremonial.
```

#### `middle-dawn`

```text
SUBJECT — "Eight stars fall during the Dragon Break" (a time when time itself broke; every account agrees that eight stars fell one after another):
A quiet walled medieval city on a river plain, seen from a low hill at dusk. The sky is a flat lapis-blue field. Across it, EXACTLY EIGHT falling stars drawn as small gold points with long thin straight gold trails, spaced one after another from left to right as if falling in sequence. On the hill in the foreground, a small group of five or six townspeople in long robes and hoods stand looking up; one points at the sky, another holds a long staff. The city below is calm and unharmed. Strange stillness, no fire, no destruction.
```

#### `nerevarine-defeats-dagoth-ur`

```text
SUBJECT — "The hero reaches the Heart inside Red Mountain" (deep in a volcano, an unfinished giant bronze construct holds a mystical heart):
A vast cavern inside a mountain, its rock walls suggested with sparse grey-violet lines, a narrow lava channel at the bottom drawn as a thin vermilion line. In the middle, a huge unfinished humanoid figure of bronze plates and girders, partly surrounded by scaffolding, stands on a stone platform; in its open chest sits a large dark-red heart-shaped stone (flat colour, not glowing). On a narrow stone bridge leading to it stands ONE lone hooded hero in plain travel armour, seen from behind, gender not shown, holding a hammer in one gauntleted hand and a short blade in the other, facing the heart. No other figures, no masks, no glow.
```

#### `oblivion-crisis`

```text
SUBJECT — "Martin is led out of the ruins of Kvatch" (after a city on a hill is burned during an invasion from another realm, a priest is found among the survivors):
Daylight. A hilltop city in ruins: broken stone walls, roofless houses and a fallen gate, thin grey smoke rising, a few small vermilion embers. Down the road from the broken city gate walk two figures: a hooded traveller in a plain cloak, face hidden, leading the way; and a man of about thirty in a simple brown-grey priest's robe (drawn in grey-violet tones) following, looking back at the ruins. A few survivors in plain clothes sit by the roadside. No monsters, no portals, no bodies.

CORRECTIONS (previous attempt got these wrong):
- The priest's robe is plain: NO crosses, no stole with crosses, no real-world religious symbols anywhere; at most a simple plain amulet cord. Otherwise keep the same composition: hooded traveller leading, priest following and looking back at the ruined hilltop city, survivors by the road.
```

#### `reman-repels-akaviri`

```text
SUBJECT — "The Akaviri army kneels before Reman at Pale Pass" (foreign invaders recognise a human leader as the one they were seeking):
A snowy mountain pass between steep grey peaks. On the right, a large foreign army in lacquered lamellar armour with curved swords kneels in rows, their weapons laid on the snow before them, heads bowed. On the left, at the head of a column of human soldiers in mail with plain pennants, stands ONE man in plain steel armour and a dark cloak, bareheaded, one hand raised as he speaks. Between the two armies is open snow. Calm, solemn, no fighting.
```

#### `return-of-alduin`

```text
SUBJECT — "A black dragon descends on Helgen" (a great black dragon appears over a small mountain village and burns it):
Seen from a distance, from a hillside above: a small walled mountain village of timber houses with steep roofs and one square stone watchtower, in a pine-covered valley with snowy peaks behind. Above it, coming down out of a swirl of grey cloud, ONE huge black dragon with wide wings, drawn in ink with flat dark grey-violet tones. Small vermilion flames on two or three roofs, light grey smoke. In the village square, tiny figures scatter; none is distinguishable or singled out, no figure in the foreground. No other dragons.
```

#### `three-banners-war`

```text
SUBJECT — "Three armies converge on the Imperial City" (three alliances march on the capital from three directions):
A high bird's-eye view over a green central province, like a map-like miniature. In the middle, a round walled city on an island in a lake with one tall white tower at its centre. Three columns of marching soldiers approach the lake from three directions: from the upper left (north-west) a column with plain lapis-blue pennants, from the upper right (north-east) a column with plain vermilion pennants, and from the bottom (south) a column with plain gold pennants. Forests, rolling hills, a few small forts along the roads. No emblems on any banner, no battle yet.
```

#### `tiber-septim-crowned`

```text
SUBJECT — "Talos takes Sancre Tor by a hidden path" (in deep winter a general captures a mountain fortress by coming down behind it):
Winter mountains, snow on every slope, pale sky. A grey stone fortress sits on a crag. At its foot, small groups of soldiers skirmish near the gate in the snow (no bodies, no blood). Above and behind the fortress, a narrow hidden path winds down a steep cliff; along it a single file of about ten soldiers in cloaks descends quietly toward a small dark doorway in the back wall, led by a tall man in a dark cloak. Clear, map-like composition showing both the decoy fight and the secret descent.
```

#### `war-of-the-ehlnofey`

```text
SUBJECT — "The wanderers reach the walls of Old Ehlnofey" (a mythic age: a hidden, intact homeland walled against chaos; scattered wanderers find it):
On the right, behind a high pale wall with gates, a serene ancient city of white domes and slender towers in a green garden land, untouched. On the left, a broken, cracked wasteland of shattered rocks and dead trees. Between them, in front of the closed gate, a band of about a dozen weary wanderers in ragged cloaks with staffs and spears, tougher and leaner, look up at the wall; on top of the wall stand a few tall robed defenders looking down. Distrust, the moment before a war. Sky as a flat lapis field.
```

#### `warp-in-the-west`

```text
SUBJECT — "Three days of calamity around Iliac Bay" (earthquake, sandstorm, fire and great waves strike a bay ringed by small kingdoms while several battles rage at once):
A high view over a wide bay with walled coastal towns on its shores. On the left shore, a pale brownish-grey sandstorm rolls in; in the centre, a great curling lapis-blue wave rises from the bay toward a harbour; on the right, small vermilion fires burn in a town, and a crack splits a field. On two or three plains around the bay, small armies of tiny figures clash under plain pennants. The sky is a flat lapis field with grey storm bands. No giant figures, no monsters.

CORRECTIONS (previous attempt got these wrong):
- Every pennant and banner is PLAIN single-colour cloth (lapis, vermilion or grey): no suns, stars, crosses or any emblem.
- The town fire is small, flat vermilion red with light grey smoke: no orange or yellow flames, no black smoke.
- Fewer, smaller armies (three small groups), so the four calamities read clearly.
```

#### `white-gold-concordat`

```text
SUBJECT — "Titus Mede II puts his seal to the White-Gold Concordat" (a human emperor accepts a hard peace from an elven power):
Inside a pale stone hall. A long table covered with a plain cloth. At one end, a weary middle-aged human emperor with a short grey beard and a simple gold circlet sits and presses a seal onto a large sheet of paper; the sheet is BLANK, seen at an angle, with no writing at all. Two armoured human generals stand behind him, heads lowered. At the other end of the table stand three tall, slender, golden-skinned elves in long dark robes, watching. Sombre, quiet, no weapons drawn.
```

#### `ysgramor-return`

```text
SUBJECT — "Ysgramor finds his son's ship after the storm" (during a sea crossing a ship is lost in a storm; the father searches for it):
A rough sea under a storm sky suggested by grey-violet bands and slanting lines of rain, kept light in value. In the middle ground, ONE open longship with a striped square sail, an older bearded chieftain standing at its prow, reaching out; it comes alongside a second, damaged longship drifting with a broken mast and torn sail. On the damaged ship a few crewmen sit with bowed heads around a figure lying covered by a cloak (no face, no wound visible). No other ships near. Grief, not battle.

CORRECTIONS (previous attempt got these wrong):
- The sail is striped in lapis blue and bone white (NOT red); vermilion only on one small pennant.
- Keep the sea lighter: wave crests drawn as lapis line patterns on pale paper-toned water, not a solid saturated blue mass; the storm sky as a few grey-violet bands with slanting rain lines over light paper.
- No shields hung along the ship's side; plain prows without carved animal heads.
```

### 6.3 量產時新發現的問題

1. **數量**：「九艘船」第一次畫成十艘、第二次十艘排兩列；改成「三組各三艘（3 + 3 + 3）」並要求存檔前自己數，第三次才對。要求精確數量時，拆成小組比直接寫總數有效。
2. **愛心箭**：「綁著心臟的箭」會畫成邱比特的愛心箭頭，人物也畫成女性；要寫明「箭頭正常、心臟用繩子綁在箭桿上」「男性神祇」。
3. **真實宗教符號**：祭司長袍出現十字架，要寫「no crosses, no real-world religious symbols」。
4. **旗幟紋章**：「plain pennants」仍可能畫上太陽、星星，要寫「plain single-colour cloth, no suns, stars, crosses or any emblem」。
5. **構圖空白**：要求「多留紙白」時，模型可能把下半張整片留空；改寫成「只在四周留細邊、畫面置中」。
