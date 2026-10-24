# 自繪地圖（示意圖）的參數依據

`src/content/schematic-map.json` 的每一項都有 `basis`，對應下表的一列。依據只取 UESP Lore 頁面的文字（含其中引用的遊戲內書籍），引文 25 字以內；原文存在 `.superpowers/sources/`（`p3map-*.md` 為研究代理整理的摘錄，`p3map-user-*.md` 為使用者 2026-10-22 從 UESP 複製的整頁）。**不參考任何地圖圖片**；唯一例外是天際九領地與部分地點，依使用者決定（`decisions/p3-map-help`）參考《無界天際》遊戲地圖，另列在 `docs/research/schematic-locations.md`。

設計：`docs/superpowers/specs/2026-10-22-schematic-map-design.md`。

## 整體

| basis | 用在 | 依據 |
|---|---|---|
| T-size | 畫框 1000 × 714（寬高比約 1.4） | Lore:Tamriel 引《Arena Player's Guide》："3,000 to 4,000 kilometers from east to west, and 2,000 to 3,000 kilometers from north to south" |
| T-nine | 九省 | Lore:Tamriel："The continent is divided into nine provinces" |
| T-ne-corner | 東北角是陸地的轉角 | Lore:Solstheim："sailed around the northeast corner of Tamriel into the Sea of Ghosts" |

## 各省位置（省中心 `seeds`）

| basis | 省 | 依據 |
|---|---|---|
| P-skyrim | 天際在最北 | Lore:Skyrim："Skyrim, the northernmost province of Tamriel" |
| P-high-rock | 高岩在西北 | Lore:High Rock："High Rock is a province in northwestern Tamriel." |
| P-hammerfell | 落錘在西；北接高岩、東北接天際、東南接賽洛迪爾 | Lore:Hammerfell："It borders High Rock to the north, Skyrim to the northeast, and Cyrodiil to the southeast." |
| P-cyrodiil | 賽洛迪爾在中南，最大 | Lore:Cyrodiil："a province in south-central Tamriel"；Pocket Guide："It is the largest region of the continent" |
| P-morrowind | 晨風在東北 | Lore:Morrowind："Morrowind is the northeasternmost nation of Tamriel" |
| P-black-marsh | 黑沼在東南；北接晨風、西接賽洛迪爾 | Lore:Black Marsh："bordering Morrowind to the north and Cyrodiil to the west." |
| P-elsweyr | 艾斯維爾在南岸；西接威木、北與東接賽洛迪爾 | Lore:Elsweyr："bordered by Valenwood to the west and by Cyrodiil to the north and east" |
| P-valenwood | 威木在西南沿海平原 | Lore:Valenwood："encompasses the southwestern coastal plain of Tamriel" |
| P-summerset | 夏暮群島在西南，十四座島 | Lore:Summerset Isles："a province in southwest Tamriel consisting of fourteen islands" |
| P-niben-valley | 賽洛迪爾的第二個中心（尼本河谷南段，往托帕灣） | Lore:Black Marsh："along the coast, from the mouth of the Niben River to the Topal Bay." |

## 海岸與海（`land`、`seas`、`islands`）

| basis | 用在 | 依據 |
|---|---|---|
| S-ghosts | 天際長北岸（鬼魂之海） | Lore:Skyrim："the Sea of Ghosts runs along the province's long northern coastline" |
| S-broken-cape | 天際東北的海岬 | Lore:Winterhold (city)："Winterhold is built on Hsaarik Head, the very tip of the Broken Cape" |
| S-glenumbra | 高岩西端的大半島 | Lore:High Rock："the large peninsula separating the Iliac Bay from the Eltheric Ocean." |
| S-iliac | 伊利亞克灣：高岩南岸與落錘北岸之間，往東北伸到畢約爾賽河口 | Lore:Iliac Bay："the large bay separating the southern coast of High Rock from the northern coast of Hammerfell."；"stretches northeast into the continent" |
| S-abecean | 阿貝森海：落錘南方、賽洛迪爾西岸、威木北邊 | Lore:Hammerfell："the Abecean Sea to the south"；Lore:Malabal Tor："the Strid River, which empties into the Abecean Sea." |
| S-gold-coast | 賽洛迪爾有西岸 | Pocket Guide："Between its western coast and its central valley" |
| S-inner-sea | 晨風內海向北開口，瓦登費爾在灣內 | Lore:Vvardenfell："inside the bay-like Inner Sea, and is surrounded by mainland with the exception of its northern coast" |
| S-morrowind-east | 晨風東岸（帕多梅克洋） | Lore:House Indoril："the province's eastern coast along the Padomaic Ocean." |
| S-topal | 托帕灣：艾斯維爾與黑沼之間，尼本河出海 | Lore:Knahaten Flu："across the Topal Bay to Elsweyr"；Lore:Second Era："from Topal Bay to the River Niben" |
| S-quinrawl | 艾斯維爾東南的半島 | Lore:Elsweyr："between the Southern Sea and the Topal Sea" |
| S-black-marsh-south | 黑沼南端（奧利斯灣） | Lore:Black Marsh："on the southern tip of Murkmire, on Oliis Bay" |
| S-valenwood-coast | 威木西岸面向奧瑞頓、南岸臨海 | Lore:Valenwood："the isle of Auridon is just across the sea to the west." |
| S-summerset-isles | 夏暮主島、奧瑞頓（最靠本土）、阿泰姆（主島西南） | Lore:Auridon："between the main island and the continent"；Lore:Summerset Isles："off the southwest coast of Summerset Isle" |
| S-solstheim | 索瑟海姆：瓦登費爾西北、鬼魂之海中 | Lore:Morrowind："the island of Solstheim to the northwest" |

## 山脈（`ranges`，畫在兩省的省界上）

| basis | 山脈 | 依據 |
|---|---|---|
| R-jerall | 傑拉爾山脈：天際／賽洛迪爾 | Lore:Skyrim："Cyrodiil is south beyond the Jerall Mountains" |
| R-velothi | 威洛斯山脈：天際／晨風 | Lore:Skyrim："Morrowind lies to the east over the Velothi Mountains" |
| R-valus | 瓦盧斯山脈：賽洛迪爾／晨風 | Lore:Morrowind："the Valus Mountains separate it from Cyrodiil" |
| R-druadach | 德魯阿達赫山脈：天際／高岩 | Lore:Skyrim："High Rock is past the Druadach Mountains to the west" |
| R-trolhetta | 三條山脈交會 | Lore:Morrowind："all of these ranges and borders intersect at the peak of Trolhetta." |

## 湖、河、火山

| basis | 用在 | 依據 |
|---|---|---|
| L-rumare | 魯馬爾湖在賽洛迪爾中央，帝都在湖中城市島 | Lore:Imperial City："City Isle, which lies in the center of Lake Rumare" |
| V-niben | 尼本河從魯馬爾湖往南到托帕灣 | Pocket Guide："the swamps of Argonia and the placid waters of the Topal Bay."；Lore:Second Era："from Topal Bay to the River Niben" |
| V-white | 白河往北在風舵城入鬼魂之海 | Lore:Windhelm："where the White River flowed into the Sea of Ghosts" |
| V-bjoulsae | 畢約爾賽河流入伊利亞克灣頂端 | Lore:Iliac Bay："to the mouth of the Bjoulsae River." |
| X-red-mountain | 紅山在瓦登費爾島上 | Lore:Morrowind（Vvardenfell）："dominated by Red Mountain" |

## 奈恩層（`nirn`）

| basis | 用在 | 依據 |
|---|---|---|
| N-tamriel | 泰姆瑞爾放在奈恩中央偏西，周圍留海 | Lore:Tamriel："the original singular landmass of Nirn was broken apart into at least four major landmasses—Tamriel, Akavir, Atmora, and Yokuda" |
| N-atmora | 阿特摩拉在北，隔鬼魂之海 | Lore:Atmora："a continent north of Tamriel"；Lore:Winterhold (region)："facing Atmora across the Sea of Ghosts." |
| N-akavir | 阿卡維爾在東，中間有島嶼 | Lore:Akavir："a continental landmass east of Tamriel"；Lore:Imperial Simulacrum："several islands between Tamriel and Akavir" |
| N-yokuda | 尤庫達在西，隔艾瑟瑞克洋，大半沉沒，畫成群島 | Lore:Yokuda："a continent west of Tamriel which partially sank into the sea"；Lore:Redguard："sailing across the Eltheric Ocean" |
| N-pyandonea | 潘多尼亞在夏暮群島遠南方的群島 | Lore:Maormer："the island kingdom of Pyandonea, far south of the Summerset Isles." |

## 天際九領地（`holds`）

| basis | 用在 | 依據 |
|---|---|---|
| H-map | 九領地的相對中心（天際範圍的 0～1 比例） | 依使用者決定（`decisions/p3-map-help`）讀自《無界天際》遊戲地圖 `public/maps/official/provinces/skyrim.webp`（UESP `SR-map-Skyrim.jpg`）上各領地紅色虛線圍出的範圍；只取中心位置，不描界線 |
| H-text | 領地相鄰關係 | Lore:Haafingar："the Reach to the south and Hjaalmarch to the southeast"；Lore:The Rift："bordered by Eastmarch to the north, Falkreath Hold to the west ... and Whiterun Hold to the northwest"；Lore:Winterhold (region)："bordered by Eastmarch to the south and the Pale to the west"；Lore:The Reach："the Sundered Hills bordering Whiterun's Tundra Plateau to the east" |

## 相鄰與不相鄰（`adjacent`、`notAdjacent`，單元測試檢查）

- 相鄰：上表 P-hammerfell、P-black-marsh、P-elsweyr 各句，以及 Lore:Skyrim（四鄰）、Lore:Morrowind（"bounded ... on the northwest by Skyrim, on the southwest by Cyrodiil"）、Lore:Valenwood（"borders Elsweyr to the east and Cyrodiil to the north"）、Lore:High Rock（"borders Hammerfell ... and Skyrim"）。
- 不相鄰：夏暮群島與任何本土省（全是島）；天際與黑沼、高岩與賽洛迪爾（上列各省的鄰省清單都沒有對方）。
