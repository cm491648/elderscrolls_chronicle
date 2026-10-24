# 自繪地圖（示意圖）的地點依據

`src/content/locations.json` 每個地點的 `drawn` 座標，依下表放在示意圖上（泰姆瑞爾與各省的地點用泰姆瑞爾示意座標，奈恩的地點用奈恩示意座標）。引文取自 `.superpowers/sources/p3map-places.md`（研究代理摘錄）與 `p3map-user-*.md`（使用者 2026-10-22 從 UESP 複製的整頁）。

依據類型：
- **文字**：照文字線索放。
- **遊戲地圖**：依使用者決定（`decisions/p3-map-help`），取《無界天際》遊戲地圖（`public/maps/official/provinces/skyrim.webp`）上的相對位置，換算成示意版天際外框的比例；文字線索列在旁邊供對照。
- **文字＋調整**：遊戲地圖的比例落到示意圖以外時，依文字移回所屬領地。
- **官方地圖換算**（第 3 期新事件，自繪地圖已放棄、只留作下架備用）：先依文字線索在官方地圖上定位，再用既有地點擬合的仿射換算到示意座標，落在省外時推回省內最近處。

單元測試（`tests/unit/schematic-locations.test.ts`）檢查：表列的地點與 `locations.json` 一一對應；每個地點落在表上寫的省份內（海上的地點不在任何陸地上）；天際的地點落在表上寫的領地內。

| id | 省份 | 領地 | 依據類型 | 文字線索 | 放法 |
|---|---|---|---|---|---|
| old-ehlnofey | （奈恩：泰姆瑞爾） | | 文字 | Lore:Annotated Anuad："The Old Ehlnofey realm, although ruined, became Tamriel." | 神話地；依「其廢墟成為泰姆瑞爾」放在奈恩層的泰姆瑞爾西南角、夏暮群島一帶（Lore:Firsthold：精靈從艾德梅里斯渡艾瑟瑞克洋來到奧瑞頓） |
| iliac-bay | 海 | | 文字 | Lore:Iliac Bay："the large bay separating the southern coast of High Rock from the northern coast of Hammerfell." | 伊利亞克灣海面中央 |
| daggerfall | high-rock | | 文字 | Lore:Daggerfall："at the southernmost point of Glenumbra, around where the Iliac Bay meets the Eltheric" | 高岩西部半島南端、海灣口北岸 |
| wayrest | high-rock | | 文字 | Lore:Wayrest："at the mouth of the Bjoulsae River"；Lore:Iliac Bay："stretches northeast ... to the mouth of the Bjoulsae" | 伊利亞克灣東北頂端北岸 |
| orsinium | high-rock | | 文字 | Lore:High Rock："Orsinium, located in the Wrothgarian Mountains"；Wrothgar "borders ... Haafingar and the Reach to the east" | 高岩東北部（沃斯加），靠近天際省界；不取第四紀元的遷址 |
| sentinel | hammerfell | | 文字 | Lore:Alik'r："reaches as far north as Sentinel"；Sentinel 在伊利亞克灣南岸 | 伊利亞克灣南岸、落錘西北 |
| volenfell | hammerfell | | 文字 | Lore:Volenfell（使用者補）：在阿利克爾沙漠；Lore:Gilane（使用者補）："located on the south-central coast"、"just south of the Alik'r Desert" | 落錘中南部、吉蘭（南岸）北方的沙漠中 |
| imperial-city | cyrodiil | | 文字 | Lore:Imperial City："City Isle, which lies in the center of Lake Rumare" | 魯馬爾湖中央 |
| sancre-tor | cyrodiil | | 文字 | Lore:Cyrodiil：傑拉爾山脈 "A mountain range in northern Cyrodiil on the Skyrim border"，桑卡托在其中 | 賽洛迪爾北緣、傑拉爾山脈南麓 |
| kvatch | cyrodiil | | 文字 | Lore:Hammerfell："separates Hammerfell from the Gold Coast"；Lore:Kvatch（使用者補）：黃金海岸的內陸 | 賽洛迪爾西部、黃金海岸內陸 |
| red-mountain | morrowind | | 文字 | Lore:Vvardenfell："dominated by Red Mountain" | 瓦登費爾島中央（火山） |
| vivec-city | morrowind | | 文字 | Lore:Vvardenfell："Vvardenfell's southern coast ... where the city of Vivec once stood" | 瓦登費爾島南岸 |
| mournhold | morrowind | | 文字 | Lore:Mournhold（使用者補）：德珊平原、內海南方 | 內海南方的晨風本土 |
| solstheim | morrowind | | 文字 | Lore:Morrowind："the island of Solstheim to the northwest" | 瓦登費爾西北的島 |
| firsthold | summerset | | 文字 | Lore:Auridon："Firsthold to the north" | 奧瑞頓島北端 |
| auridon | summerset | | 文字 | Lore:Auridon："between the main island and the continent" | 奧瑞頓島中央 |
| solitude | skyrim | haafingar | 遊戲地圖 | Lore:Haafingar（使用者補）："a relatively small, mountainous, coastal hold in northwestern Skyrim. Its capital is ... Solitude" | 哈芬加北岸 |
| markarth | skyrim | the-reach | 遊戲地圖 | Lore:The Reach："Near the southwestern corner, the capital Markarth" | 河灣地西緣 |
| throat-of-the-world | skyrim | whiterun | 遊戲地圖 | Lore:Throat of the World："High Hrothgar and the entire Throat of the World fall under Whiterun Hold's borders" | 白漫領地東南部 |
| helgen | skyrim | falkreath | 遊戲地圖 | Lore:Helgen："east-northeast of the city of Falkreath, south of Riverwood, and north of Pale Pass." | 法克瑞斯領地東部、蒼白小徑北方 |
| pale-pass | skyrim | falkreath | 遊戲地圖 | Lore:Pale Pass："a secluded pass through the Jerall Mountains on the Cyrodiil-Skyrim border." | 傑拉爾山脈（天際南界）、海爾根正南 |
| saarthal | skyrim | winterhold | 文字 | Lore:Winterhold (region)："landed on Hsaarik Head ... and traveled southwest, where they built Saarthal." | 冬堡西南 |
| winterhold | skyrim | winterhold | 文字＋調整 | Lore:Winterhold (city)："built on Hsaarik Head, the very tip of the Broken Cape" | 破碎海岬尖端 |
| windhelm | skyrim | eastmarch | 文字＋調整 | Lore:Windhelm："where the White River flowed into the Sea of Ghosts" | 白河出海口 |
| yngol-barrow | skyrim | eastmarch | 文字＋調整 | Lore:Yngol Barrow：白河畔、風舵城附近（另一說在冬堡的海岬下方） | 風舵城西方、東陲北部 |
| lake-honrich | skyrim | the-rift | 文字＋調整 | Lore:Lake Honrich（使用者補）："a lake in the eastern Rift. Riften is located on the shores of Lake Honrich" | 裂谷東部 |
| forelhost | skyrim | the-rift | 文字＋調整 | Lore:Forelhost（使用者補）："located in the Rift in Skyrim ... high atop the mountain of the same name" | 裂谷北部的山上 |
| wrothgar | high-rock | | 官方地圖換算 | Lore:Wrothgarian Mountains：伊利亞克灣東北角的大片山區，東接天際 | 高岩東北部山區 |
| old-orsinium | high-rock | | 官方地圖換算 | Lore:Orsinium：第一座奧辛紐姆在沃斯加西部 | 沃斯加西部、里文斯拜爾交界 |
| frostbreak-fortress | high-rock | | 官方地圖換算 | Online:Frostbreak Fortress：沃斯加西部的霜裂山脊 | 沃斯加西部 |
| bjoulsae-river | high-rock | | 官方地圖換算 | Lore:Bjoulsae River：經常青城流到途歇入海 | 常青城到途歇之間的河段 |
| bangkorai-pass | high-rock | | 官方地圖換算 | Lore:Bangkorai Pass：常青城以南、高岩與落錘交界 | 常青城南方的省界 |
| cryngaine-field | high-rock | | 官方地圖換算 | Lore:Cryngaine Field：高岩南部，靠近安提克雷爾 | 高岩南部、匕落與途歇之間 |
| betony | high-rock | | 官方地圖換算 | Lore:Betony：伊利亞克灣中、匕落城外海的小島 | 匕落城南方外海的小島 |
| stros-mkai | hammerfell | | 官方地圖換算 | Lore:Stros M'Kai：落錘南岸外海、阿比西亞海中的島 | 落錘南方外海的島 |
| rimmen | elsweyr | | 官方地圖換算 | Lore:Rimmen：阿納奎那首都，在東北邊緣地帶 | 艾斯維爾東北部 |
| senchal | elsweyr | | 官方地圖換算 | Lore:Elsweyr：佩勒庭首府，昆羅爾半島北岸的港市 | 艾斯維爾東南岸 |
| halls-of-colossus | elsweyr | | 官方地圖換算 | Lore:Halls of Colossus：佩勒庭深處、昆羅爾半島一帶 | 艾斯維爾東南的半島 |
| moon-gate-of-anequina | elsweyr | | 官方地圖換算 | Lore:Elsweyr：阿納奎那南緣的坦馬爾邊境地帶 | 艾斯維爾中部偏南 |
| dragonhold | elsweyr | | 官方地圖換算 | Lore:Dragonhold：南方外海的小島 | 艾斯維爾南方外海 |
| tideholm | elsweyr | | 官方地圖換算 | Lore:Tideholm：托帕爾灣與南海交界處的島 | 艾斯維爾東南外海 |
| high-isle | 海 | | 官方地圖換算 | Lore:High Isle：西斯忒斯群島最南的島，群島在落錘西南遠方 | 泰姆瑞爾西南外海的群島 |
| vulkhel-guard | summerset | | 官方地圖換算 | Lore:Vulkhel Guard：奧瑞頓島南端的港口 | 奧瑞頓南端 |
| crystal-tower | summerset | | 官方地圖換算 | Lore:Crystal Tower：夏暮島主島北部、雲棲城西北的峽谷 | 主島北部 |
| artaeum | summerset | | 官方地圖換算 | Lore:Artaeum：奧瑞頓與主島之間的海上小島 | 奧瑞頓與主島之間的海峽 |
| elden-root | valenwood | | 官方地圖換算 | Lore:Elden Root：格拉特伍德中部的巨樹城 | 森林谷中南部 |
| marbruk | valenwood | | 官方地圖換算 | Lore:Valenwood：綠蔭東部 | 森林谷中西部 |
| hectahame | valenwood | | 官方地圖換算 | Lore:Hectahame：綠蔭北部 Green's Marrow 的山谷 | 森林谷西北部 |
| arenthia | valenwood | | 官方地圖換算 | Lore:Arenthia：新月河與斯垂德河交會處，近賽洛迪爾與艾斯維爾 | 森林谷東北角 |
| moonmont | valenwood | | 官方地圖換算 | Lore:Moonmont：收割者之境南緣的喬德森林 | 森林谷東緣 |
| dune | elsweyr | | 官方地圖換算 | Lore:Dune：艾斯維爾西北角的達恩米德 | 艾斯維爾西北角 |
| hatching-pools | black-marsh | | 官方地圖換算 | Lore:Shadowfen：影沼中部、風暴堡南方 | 黑沼北部內陸 |
| ten-maur-wolk | black-marsh | | 官方地圖換算 | Lore:Shadowfen：影沼西北部的魔族遺跡 | 黑沼西北部 |
| loriasel | black-marsh | | 官方地圖換算 | Online:Shadowfen：影沼境內的亞歷德廢墟（方位不詳，放在孵化池附近） | 黑沼北部內陸 |
| gideon | black-marsh | | 官方地圖換算 | Lore:Blackwood：黑沼西緣、萊亞溫以東的第一座城 | 黑沼西緣 |
| arnesia | black-marsh | | 官方地圖換算 | Lore:Third Era Wars：黑沼東部沿海、晨風南界 | 黑沼東岸 |
| fort-redmane | cyrodiil | | 官方地圖換算 | Lore:Blackwood：下尼本河畔、萊亞溫以北 | 賽洛迪爾東南角 |
| anvil | cyrodiil | | 官方地圖換算 | 《遺忘之都》遊戲地圖：黃金海岸的港口城市，科瓦奇西南方 | 賽洛迪爾西南海岸 |
| bruma | cyrodiil | | 官方地圖換算 | 《遺忘之都》遊戲地圖：傑拉爾山脈中，帝都北方 | 賽洛迪爾北部 |
| echo-cave | cyrodiil | | 官方地圖換算 | 《遺忘之都》任務〈Confront the King〉：布魯瑪以西的傑拉爾山脈中 | 賽洛迪爾北部、布魯瑪以西 |
| garlas-malatar | cyrodiil | | 官方地圖換算 | 《遺忘之都》資料片《九聖騎士》：安維爾西北方海岸的亞歷德遺跡 | 賽洛迪爾西岸、安維爾西北 |
| priory-of-the-nine | cyrodiil | | 官方地圖換算 | 《遺忘之都》資料片《九聖騎士》：西域林地南部、黃金大道以南，斯金格拉德東南 | 賽洛迪爾西南部內陸 |
| mortrag-glacier | morrowind | | 官方地圖換算 | Lore:Bloodmoon Prophecy／《血月》：索瑟海姆西北部的冰川 | 索瑟海姆西北角 |
