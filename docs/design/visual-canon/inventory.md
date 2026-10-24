| objects | 15 | 7 || creatures | 16 | 1 || places | 41 | 15 || gear | 7 | 5 || factions | 20 | 8 || races | 15 | 11 || people | 38 | 15 |# 視覺設定集條目清單

從 85 則事件（第 1 期 20 則、第 2 期 42 則、第 3 期第 1 批 9 則、第 2 批 8 則與第 3 批 6 則）整理出要建的條目。事件與條目的對應見 `subjects.json`，各條目的參考圖見 `refs.md`。

- 「事件數」是用到這個條目的事件數，括號內分第 1 期／第 2 期／第 3 期。
- 「核心」：第 1 期用到，或第 2 期、第 3 期各自有 3 則以上用到。最後的龍裔雖然只有 1 則事件，依使用者決定列為核心。
- 事件數與核心依目前的 `subjects.json` 重算（2026-10-24；`tests/unit/visual-canon-inventory.test.ts` 會檢查這份清單與 `subjects.json`、條目、`refs.md` 是否一致）。第 1 期 20 則的 `entries` 已縮成「畫面裡畫得到的條目」（規格 4.4），所以很多條目的第 1 期次數變少，目前有 22 個條目沒有任何事件使用：akatosh、alessia、apocrypha、ashlanders、auriels-bow、ayleids、azura、dragon-cult、draugr、dwemer-ruins、kagrenac、mages-guild、molag-bal、mythic-dawn、paarthurnax、sheogorath、shrine-of-talos、steel-armor、umbriel、uriel-septim-vii、velothi-architecture、windhelm。條目都保留，供日後重畫使用。第 3 期第 1 批（2026-10-23）新增 17 個條目（kurog、gortwog、lysandus、cyrus、abnur-tharn、khamira、sai-sahan、ascendant-order、restless-league、orsinium、old-orsinium、high-isle、stros-mkai、elsweyr、kaalgrontiid、nahfahlaar、aeonstone），dragons 加了 eso 版本；第 3 期的 `entries` 一開始就只列畫面裡畫得到的條目。第 3 期第 2 批（2026-10-23）新增 6 個條目（naemon、dro-mathra、crystal-tower、maormer、maormer-ships、black-marsh），hist-tree 加 1 張參考圖。UESP 回 403，這批的參考圖由使用者另外上傳補齊；水晶塔起初沒有可用的圖，第 2 批審閱後使用者另外上傳 3 張（decisions/p3-refs-crystal，2026-10-24），條目依圖改寫。第 3 期第 3 批（2026-10-24）新增 6 個條目（umaril、gray-fox、clockwork-city、solstheim、werewolves、eye-of-magnus），nerevarine 加 lore 版（《審判庭》戴遮臉頭盔、持真焰，不寫性別）與 2 張參考圖，moons 加 tes3 版（血月）；烏瑪瑞爾的 2 張與尼瑞瓦因骨模鎧甲的 1 張參考圖沿用本地已有的圖，其餘 12 張由使用者另外上傳補齊（網址依 UESP 檔名推算，未連線確認）。第 2 期 39 則仍列著正文提到的所有條目，寫場景時會照同樣規則縮減，次數與核心屆時再重算。
- Task 5 建條目時的核心是依舊的對應表（正文提到即算），所有核心條目當時都已建好。
- 中文名照 `src/content/glossary.json`；詞彙表沒有的詞是暫譯。

## 具名人物（`people`，38 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| tiber-septim | 泰伯·賽普汀 | Tiber Septim | 3（1／2／0） | 是 | 3 |
| ancient-nord-heroes | 古代諾德三英雄 | Ancient Tongues (Gormlaith, Hakon, Felldir) | 3（1／2／0） | 是 | 3 |
| mannimarco | 曼尼馬克 | Mannimarco | 2（0／1／1） | 否 | 3 |
| titus-mede-ii | 提圖斯·邁德二世 | Titus Mede II | 2（2／0／0） | 是 | 2 |
| ulfric-stormcloak | 烏弗瑞克·風暴斗篷 | Ulfric Stormcloak | 2（0／2／0） | 否 | 2 |
| ysgramor | 伊斯格拉謨 | Ysgramor | 2（2／0／0） | 是 | 3 |
| almalexia | 阿瑪萊西亞 | Almalexia | 2（0／1／1） | 否 | 3 |
| auriel | 奧瑞爾 | Auri-El | 1（1／0／0） | 是 | 3 |
| dagoth-ur | 達格斯·烏爾 | Dagoth Ur | 1（1／0／0） | 是 | 2 |
| dumac | 杜馬克 | Dumac Dwarfking | 1（1／0／0） | 是 | 1 |
| harald | 哈拉爾德 | Harald | 1（1／0／0） | 是 | 2 |
| jagar-tharn | 賈格·薩恩 | Jagar Tharn | 1（0／1／0） | 否 | 1 |
| last-dragonborn | 最後的龍裔 | Last Dragonborn | 3（0／3／0） | 是（使用者指定） | 2 |
| magnus | 瑪格努斯 | Magnus | 2（1／1／0） | 是 | 1 |
| martin-septim | 馬丁·賽普汀 | Martin Septim | 1（1／0／0） | 是 | 3 |
| nerevar | 尼瑞瓦 | Indoril Nerevar | 1（1／0／0） | 是 | 3 |
| nerevarine | 尼瑞瓦因 | Nerevarine | 2（1／0／1） | 是 | 5 |
| pelinal-whitestrake | 裴倫納爾·威斯奇 | Pelinal Whitestrake | 2（1／0／1） | 是 | 3 |
| reman | 雷曼 | Reman Cyrodiil | 1（1／0／0） | 是 | 1 |
| sotha-sil | 索薩·希爾 | Sotha Sil | 1（0／1／0） | 否 | 2 |
| torygg | 托里格 | Torygg | 1（0／1／0） | 否 | 1 |
| uriel-septim-vii | 尤利爾·賽普汀七世 | Uriel Septim VII | 0（0／0／0） | 否 | 3 |
| vanus-galerion | 凡努斯·蓋勒里昂 | Vanus Galerion | 1（0／1／0） | 否 | 3 |
| vivec | 維威克 | Vivec | 1（0／1／0） | 否 | 3 |
| alessia | 艾萊西亞 | Alessia | 0（0／0／0） | 否 | 2 |
| kagrenac | 卡格納克 | Kagrenac | 0（0／0／0） | 否 | 1 |
| serana | 瑟拉娜 | Serana | 1（0／1／0） | 否 | 1 |
| miraak | 密拉克 | Miraak | 1（0／1／0） | 否 | 2 |
| abnur-tharn | 阿布努爾·薩恩 | Abnur Tharn | 2（0／0／2） | 否 | 1 |
| cyrus | 賽勒斯 | Cyrus | 1（0／0／1） | 否 | 3 |
| gortwog | 戈特沃格 | Gortwog gro-Nagorm | 1（0／0／1） | 否 | 2 |
| khamira | 卡米拉 | Khamira | 2（0／0／2） | 否 | 2 |
| kurog | 庫洛格 | Kurog gro-Orsinium | 1（0／0／1） | 否 | 2 |
| lysandus | 萊桑德斯 | Lysandus | 1（0／0／1） | 否 | 2 |
| sai-sahan | 賽·薩罕 | Sai Sahan | 1（0／0／1） | 否 | 2 |
| naemon | 納埃蒙之影 | Shade of Naemon | 1（0／0／1） | 否 | 1 |
| umaril | 烏瑪瑞爾 | Umaril the Unfeathered | 1（0／0／1） | 否 | 4 |
| gray-fox | 灰狐 | Gray Fox | 1（0／0／1） | 否 | 2 |

## 種族（`races`，15 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| imperials | 帝國人 | Imperials | 8（6／2／0） | 是 | 2 |
| altmer | 高精靈 | Altmer | 8（4／3／1） | 是 | 3 |
| nords | 諾德人 | Nords | 8（5／3／0） | 是 | 3 |
| argonians | 阿爾貢蜥人 | Argonians | 5（0／2／3） | 是 | 3 |
| chimer | 奇莫 | Chimer | 3（2／1／0） | 是 | 2 |
| dunmer | 丹莫 | Dunmer | 5（0／4／1） | 是 | 3 |
| redguards | 紅衛人 | Redguards | 6（0／4／2） | 是 | 3 |
| bosmer | 木精靈 | Bosmer | 2（0／1／1） | 否 | 4 |
| bretons | 布萊頓人 | Bretons | 4（0／1／3） | 是 | 3 |
| dwemer | 鍛莫 | Dwemer | 2（2／0／0） | 是 | 2 |
| ayleids | 亞歷德 | Ayleids | 0（0／0／0） | 否 | 2 |
| falmer | 法莫（雪精靈） | Falmer (Snow Elves) | 1（1／0／0） | 是 | 2 |
| khajiit | 虎人 | Khajiit | 2（0／1／1） | 否 | 3 |
| orcs | 獸人 | Orcs | 3（0／0／3） | 是 | 6 |
| maormer | 海精靈（茂默） | Maormer (Sea Elves) | 1（0／0／1） | 否 | 2 |

## 陣營與服裝（`factions`，20 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| imperial-legion | 帝國軍團 | Imperial Legion | 5（4／1／0） | 是 | 3 |
| thalmor | 梭默 | Thalmor | 4（2／1／1） | 是 | 3 |
| akaviri | 阿卡維爾人 | Akaviri | 2（0／2／0） | 否 | 3 |
| alessian-order | 艾萊西亞教會 | Alessian Order | 3（1／2／0） | 是 | 6 |
| stormcloaks | 風暴斗篷 | Stormcloaks | 1（1／0／0） | 是 | 2 |
| sword-singers | 劍歌者 | Sword-singers (Ra Gada) | 2（0／2／0） | 否 | 3 |
| ebonheart-pact | 黑檀心協定 | Ebonheart Pact | 1（1／0／0） | 是 | 2 |
| morag-tong | 莫拉格·通 | Morag Tong | 1（0／1／0） | 否 | 3 |
| aldmeri-dominion | 先祖神洲 | Aldmeri Dominion | 2（1／0／1） | 是 | 2 |
| blades | 刀鋒衛士 | Blades | 1（1／0／0） | 是 | 3 |
| daggerfall-covenant | 匕落公約 | Daggerfall Covenant | 1（1／0／0） | 是 | 2 |
| direnni | 迪仁尼 | Direnni | 1（0／1／0） | 否 | 3 |
| dragon-cult | 拜龍教 | Dragon Cult | 0（0／0／0） | 否 | 2 |
| fighters-guild | 戰士公會 | Fighters Guild | 1（0／1／0） | 否 | 2 |
| forsworn | 背誓者 | Forsworn | 2（0／2／0） | 否 | 2 |
| mages-guild | 法師公會 | Mages Guild | 0（0／0／0） | 否 | 2 |
| ashlanders | 灰燼人 | Ashlanders | 0（0／0／0） | 否 | 3 |
| mythic-dawn | 破曉神教 | Mythic Dawn | 0（0／0／0） | 否 | 2 |
| ascendant-order | 飛昇教團 | Ascendant Order | 1（0／0／1） | 否 | 2 |
| restless-league | 不安聯盟 | Restless League | 1（0／0／1） | 否 | 2 |

## 裝備與武器（`gear`，7 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| chitin-armor | 甲殼鎧甲 | Chitin Armor | 3（2／0／1） | 是 | 2 |
| dwarven-armor | 矮人鎧甲 | Dwarven Armor | 2（2／0／0） | 是 | 2 |
| akaviri-katana | 阿卡維爾刀 | Akaviri Katana | 1（1／0／0） | 是 | 2 |
| iron-armor | 鐵製鎧甲 | Iron Armor | 1（1／0／0） | 是 | 2 |
| wuuthrad | 精靈屠戮者 | Wuuthrad | 1（1／0／0） | 是 | 2 |
| elven-armor | 精靈鎧甲 | Elven Armor | 1（0／1／0） | 否 | 1 |
| steel-armor | 鋼製鎧甲 | Steel Armor | 0（0／0／0） | 否 | 2 |

## 建築與地景（`places`，41 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| imperial-city | 帝都 | Imperial City | 6（4／2／0） | 是 | 4 |
| white-gold-tower | 白金塔 | White-Gold Tower | 5（3／2／0） | 是 | 2 |
| red-mountain | 紅山 | Red Mountain | 5（2／3／0） | 是 | 3 |
| summerset-architecture | 夏暮島建築 | Summerset architecture | 6（1／3／2） | 是 | 2 |
| coldharbour | 冷港 | Coldharbour | 1（1／0／0） | 是 | 3 |
| nordic-ruins | 古諾德遺跡 | Nordic ruins | 2（2／0／0） | 是 | 2 |
| skyrim-landscape | 天際地景 | Skyrim landscape | 2（2／0／0） | 是 | 2 |
| throat-of-the-world | 世界之喉 | Throat of the World | 1（0／1／0） | 否 | 2 |
| valenwood-forest | 威木森林 | Valenwood forest | 2（0／1／1） | 否 | 2 |
| adamantine-tower | 精金塔 | Adamantine Tower | 1（0／1／0） | 否 | 3 |
| auridon | 奧瑞頓 | Auridon | 1（1／0／0） | 是 | 1 |
| ayleid-ruins | 亞歷德遺跡 | Ayleid ruins | 2（1／0／1） | 是 | 2 |
| college-of-winterhold | 冬堡學院 | College of Winterhold | 1（0／1／0） | 否 | 2 |
| high-rock-architecture | 高岩建築 | High Rock architecture | 3（1／1／1） | 是 | 3 |
| hist-tree | 希思特樹 | Hist tree | 1（0／0／1） | 否 | 2 |
| kvatch | 科瓦奇 | Kvatch | 1（1／0／0） | 是 | 3 |
| markarth | 馬卡斯城 | Markarth | 2（0／2／0） | 否 | 2 |
| moons | 雙月（瑪瑟與賽昆達） | Masser and Secunda | 2（0／1／1） | 否 | 2 |
| nordic-hall | 諾德大廳 | Nordic great hall | 1（1／0／0） | 是 | 2 |
| oblivion-gate | 湮滅之門 | Oblivion Gate | 2（1／0／1） | 是 | 1 |
| sancre-tor | 桑卡托 | Sancre Tor | 1（0／1／0） | 否 | 2 |
| shivering-isles | 戰慄群島 | Shivering Isles | 1（0／1／0） | 否 | 3 |
| skyrim-town | 天際城鎮 | Skyrim town | 1（1／0／0） | 是 | 2 |
| solitude | 獨孤城 | Solitude | 1（0／1／0） | 否 | 2 |
| sovngarde | 沉睡淨土 | Sovngarde | 1（0／1／0） | 否 | 3 |
| umbriel | 安布里爾 | Umbriel | 0（0／0／0） | 否 | 2 |
| velothi-architecture | 維洛斯建築 | Velothi architecture | 0（0／0／0） | 否 | 2 |
| vivec-city | 維威克城 | Vivec City | 1（0／1／0） | 否 | 3 |
| windhelm | 風舵城 | Windhelm | 0（0／0／0） | 否 | 2 |
| dwemer-ruins | 鍛莫遺跡 | Dwemer ruins | 0（0／0／0） | 否 | 3 |
| raven-rock | 烏鴉岩 | Raven Rock | 1（0／1／0） | 否 | 1 |
| apocrypha | 啟示之境 | Apocrypha | 0（0／0／0） | 否 | 1 |
| elsweyr | 艾斯維爾 | Elsweyr | 1（0／0／1） | 否 | 2 |
| high-isle | 高島 | High Isle | 1（0／0／1） | 否 | 2 |
| orsinium | 奧辛紐姆 | Orsinium | 2（0／0／2） | 否 | 3 |
| stros-mkai | 斯圖爾斯·邁凱 | Stros M'Kai | 1（0／0／1） | 否 | 3 |
| old-orsinium | 舊奧辛紐姆 | Old Orsinium | 1（0／0／1） | 否 | 2 |
| black-marsh | 黑沼 | Black Marsh | 3（0／0／3） | 是 | 1 |
| crystal-tower | 水晶塔 | Crystal Tower | 1（0／0／1） | 否 | 3 |
| clockwork-city | 發條城 | Clockwork City | 1（0／0／1） | 否 | 2 |
| solstheim | 索瑟海姆 | Solstheim | 1（0／0／1） | 否 | 2 |

## 生物與魔族（`creatures`，16 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| alduin | 奧杜因 | Alduin | 3（1／2／0） | 是 | 3 |
| dragons | 龍 | Dragons | 1（0／0／1） | 否 | 5 |
| dremora | 魔人 | Dremora | 3（0／1／2） | 否 | 3 |
| jyggalag | 吉格拉格 | Jyggalag | 1（0／1／0） | 否 | 2 |
| molag-bal | 莫拉格·巴爾 | Molag Bal | 0（0／0／0） | 否 | 3 |
| paarthurnax | 帕圖納克斯 | Paarthurnax | 0（0／0／0） | 否 | 2 |
| sheogorath | 謝歐葛拉斯 | Sheogorath | 0（0／0／0） | 否 | 3 |
| sload | 斯洛德 | Sload | 1（0／1／0） | 否 | 3 |
| akatosh | 阿卡托什 | Akatosh | 0（0／0／0） | 否 | 3 |
| azura | 阿祖拉 | Azura | 0（0／0／0） | 否 | 3 |
| draugr | 屍鬼 | Draugr | 0（0／0／0） | 否 | 3 |
| mehrunes-dagon | 梅魯涅斯·大袞 | Mehrunes Dagon | 1（0／0／1） | 否 | 3 |
| kaalgrontiid | 卡爾格隆提德 | Kaalgrontiid | 2（0／0／2） | 否 | 4 |
| nahfahlaar | 納法拉爾（納法利拉格斯） | Nahfahlaar (Nafaalilargus) | 2（0／0／2） | 否 | 3 |
| dro-mathra | 卓瑪薩 | Dro-m'Athra | 1（0／0／1） | 否 | 2 |
| werewolves | 狼人 | Werewolves | 1（0／0／1） | 否 | 1 |

## 神器（`objects`，15 個）

| id | 中文名 | 英文名 | 事件數（第 1 期／第 2 期／第 3 期） | 核心 | 參考圖 |
|---|---|---|---|---|---|
| heart-of-lorkhan | 洛克汗之心 | Heart of Lorkhan | 2（1／1／0） | 是 | 1 |
| dark-anchor | 黑暗錨 | Dark Anchor | 2（1／1／0） | 是 | 2 |
| elven-ships | 精靈船 | Elven ships | 3（1／1／1） | 是 | 1 |
| kagrenacs-tools | 卡格納克的工具 | Kagrenac's Tools | 1（1／0／0） | 是 | 3 |
| nordic-longship | 諾德長船 | Nordic longship | 2（2／0／0） | 是 | 2 |
| numidium | 努米迪安 | Numidium | 2（1／1／0） | 是 | 0 |
| akulakhan | 阿庫拉坎 | Akulakhan | 1（1／0／0） | 是 | 3 |
| amulet-of-kings | 帝王護符 | Amulet of Kings | 1（0／1／0） | 否 | 2 |
| elder-scroll | 上古卷軸 | Elder Scroll | 2（0／1／1） | 否 | 3 |
| staff-of-chaos | 混沌之杖 | Staff of Chaos | 1（0／1／0） | 否 | 1 |
| shrine-of-talos | 塔洛斯神龕 | Shrine of Talos | 0（0／0／0） | 否 | 1 |
| auriels-bow | 奧瑞爾之弓 | Auriel's Bow | 0（0／0／0） | 否 | 1 |
| aeonstone | 永劫石 | Aeonstone | 1（0／0／1） | 否 | 2 |
| maormer-ships | 海精靈船 | Maormer ships | 1（0／0／1） | 否 | 1 |
| eye-of-magnus | 瑪格努斯之眼 | Eye of Magnus | 1（0／0／1） | 否 | 2 |

## 統計

| 類別 | 條目數 | 核心 |
|---|---|---|
| people | 38 | 15 |
| races | 15 | 11 |
| factions | 20 | 8 |
| gear | 7 | 5 |
| places | 41 | 15 |
| creatures | 16 | 1 |
| objects | 15 | 7 |
| 合計 | 152 | 62 |

參考圖共 374 張（refs.md 的列數）；其中 16 張說明標「不適用」、1 張（oblivion-gate-tes4-1）暫時拿掉、2 張（bosmer-eso-1 木精靈重甲、bosmer-tes5-2 未穿衣的概念圖）改為僅作對照，這 19 張不列在條目的 refs，表格的「參考圖」欄只算條目實際使用的 355 張。

## 備註

- `last-dragonborn`（最後的龍裔）依使用者決定：戴鐵製角盔、穿毛皮與鐵甲、看不到臉（參考圖裡看得到部分臉孔，「不畫臉」寫在條目內文，由 Task 5 處理）；只出現在第 2 期的 `last-dragonborn-defeats-alduin`。`return-of-alduin` 不含這個條目。
- `dragon-war` 與 `return-of-alduin` 的遠古部分重疊（奧杜因、古代諾德三英雄、世界之喉、上古卷軸）；是否另立一則，由使用者在第 2 期規畫時決定。
- 遊戲裡沒有固定長相的人物（杜馬克、卡格納克、哈拉爾德、瑪格努斯）只能用種族或裝備圖當參考，參考圖說明裡有註明。
- 法莫在淚之夜時是雪精靈，參考圖用天際《黎明守衛》的吉勒波；地底墮落後的法莫只作對照。
- `shrine-of-talos`（塔洛斯神龕）目前沒有事件使用：`talos-ascends` 畫的是成神的泰伯本人（tiber-septim 天際版），不放踩蛇的神龕雕像，以免提示詞與驗收清單互相矛盾；條目保留，供日後畫神龕本身的場景使用。
