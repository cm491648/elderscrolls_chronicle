import { PROVINCES, type Lang, type MapLayer, type Province } from '../../lib/types';

export type Geometry =
  | { kind: 'polygon'; points: [number, number][] }
  | { kind: 'polygons'; parts: [number, number][][] }
  | { kind: 'circle'; cx: number; cy: number; r: number };

export interface Region {
  id: string;
  name: Record<Lang, string>;
  geometry: Geometry;
  label: [number, number];
}

/** Where a layer sits on its parent layer: a point p of the layer is at p * k + (x, y) on the parent. */
export interface ParentLink {
  layer: MapLayer;
  k: number;
  x: number;
  y: number;
  /**
   * Control points [this layer, parent layer] where the two maps are drawn differently (the game maps): places are
   * carried up through the scale-and-shift plus a thin-plate spline through these, so each lands on the parent's own
   * glyph. Views (zooming, cross-fading) keep the plain scale-and-shift.
   */
  warp?: [[number, number], [number, number]][];
}

export interface MapShape {
  layer: MapLayer;
  viewBox: [number, number];
  /**
   * How far in a single selected place is shown: the view frames 1/focusScale of the layer's width and height around
   * it (never less than the plate filled). 1 shows the whole layer.
   */
  focusScale: number;
  /** The layer above this one and where this one sits on it (uniform scale, no rotation). The cosmos has none. */
  parent?: ParentLink;
  /** Also mark the places of the layers directly below (Tamriel shows every province's places). */
  childMarkers?: boolean;
  /** Regions drawn as loose hit areas (grown over the sea): hover and selection tint them but draw no outline. */
  looseRegions?: boolean;
  /**
   * Regions carried up from finer layers are only a soft wash clipped to their holding region (for a drawn map whose
   * coast differs from the province outlines; unused since Nirn v3c).
   */
  softCarried?: boolean;
  /**
   * The deepest zoom, in screen px per layer unit, past the cover zoom (raster provinces: units are the image's own
   * pixels, so 2 keeps a pixel of the map within 2 CSS px).
   */
  maxZoom?: number;
  regions: Region[];
}

const points = (s: string) => s.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
const poly = (s: string): Geometry => ({ kind: 'polygon', points: points(s) });
/** A region drawn as several outlines (a mainland and its islands). */
const polys = (...parts: string[]): Geometry => ({ kind: 'polygons', parts: parts.map(points) });

/** Anthology pixels per Tamriel unit: the Tamriel layer is the 2880 x 2057 map at 1000/2880. */
export const TAMRIEL_PX = 2.88;

/**
 * Seven province layers are UESP's crops of the same Anthology map, at the same scale (R8's edge matching, confirmed
 * in R12 by pixel differences: mean |diff| 0.0-0.1 at these offsets, 9-23 one pixel off). [x, y, width, height] in
 * Anthology pixels; a province layer's units are the crop's own pixels.
 */
export const PROVINCE_CROPS: Partial<Record<Province, [number, number, number, number]>> = {
  'high-rock': [324, 146, 796, 654],
  morrowind: [1734, 113, 864, 1058],
  hammerfell: [242, 408, 1096, 684],
  'black-marsh': [1829, 1068, 588, 697],
  elsweyr: [1301, 1121, 468, 599],
  valenwood: [891, 1081, 544, 574],
  summerset: [285, 1163, 566, 603],
};

/**
 * Skyrim and Cyrodiil are drawn from the games' own maps instead (user decision, round 3): UESP's SR-map-Skyrim
 * (2048 x 1536) and OB-map-Cyrodiil (2048 x 1673). A layer's units are the map's pixels. The maps are drawn
 * differently from the Anthology map, so each sits on Tamriel through a least-squares uniform scale + shift on the
 * cities both mark (r12-calibration/gamefit.py): Skyrim RMS 5.6 Tamriel units over the nine hold capitals, Cyrodiil
 * RMS 11.5 over eight cities. Outlines traced on the game maps (trace3.py for Skyrim; by hand, then snapped to the drawn border, snap.py, for Cyrodiil).
 */
export const PROVINCE_GAME_MAPS: Partial<
  Record<
    Province,
    {
      size: [number, number];
      link: { k: number; x: number; y: number };
      outline: string;
      label: [number, number];
      /** Cities both maps mark: [game map px, Tamriel units of the Anthology glyph] (see ParentLink.warp). */
      warp: [[number, number], [number, number]][];
    }
  >
> = {
  skyrim: {
    size: [2048, 1536],
    link: { k: 0.153912, x: 331.470, y: 18.857 },
    outline: '237,337 241,374 284,384 313,403 324,457 297,521 225,533 210,620 183,634 152,671 137,769 146,828 181,886 212,888 238,907 351,952 450,955 533,983 624,1059 708,1172 782,1222 821,1290 953,1336 999,1327 1017,1293 1042,1292 1067,1309 1190,1265 1219,1262 1257,1240 1317,1285 1357,1295 1378,1286 1404,1249 1433,1248 1477,1222 1503,1241 1498,1273 1524,1304 1591,1327 1637,1370 1682,1375 1710,1395 1752,1408 1878,1359 1894,1306 1914,1285 1917,1229 1902,1146 1865,1132 1865,1091 1824,1059 1827,1036 1859,1020 1861,996 1884,957 1823,937 1819,919 1834,892 1812,873 1805,847 1778,835 1771,808 1775,789 1792,776 1791,748 1749,700 1758,627 1786,575 1728,562 1720,552 1744,495 1748,452 1739,434 1650,404 1632,369 1594,338 1596,308 1567,271 1544,266 1517,282 1482,275 1424,320 1360,285 1325,327 1256,324 1235,295 1188,281 1169,265 1145,267 1123,293 1017,305 1003,291 1003,268 981,252 904,273 878,291 876,354 885,379 873,433 790,458 755,440 737,457 706,462 650,413 647,400 684,366 695,340 729,329 742,310 756,242 791,206 772,192 760,160 676,144 657,153 632,198 591,213 559,198 506,198 473,214 444,215 416,240 354,247 323,231 305,245 305,267 280,290 276,309',
    label: [960, 600],
    warp: [
      [[694.5, 307], [434.90, 71.18]], // Solitude
      [[1150.5, 319], [509.72, 69.10]], // Dawnstar
      [[1497, 336], [565.97, 64.93]], // Winterhold
      [[835.5, 505.5], [454.17, 93.06]], // Morthal
      [[1601, 618], [581.60, 113.54]], // Windhelm
      [[1114, 798], [495.49, 144.44]], // Whiterun
      [[218, 759], [370.49, 140.28]], // Markarth
      [[865.5, 1183], [467.01, 199.65]], // Falkreath
      [[1814.5, 1212], [610.76, 202.78]], // Riften
      [[1247, 897], [531.94, 150.00]], // Throat of the World
    ],
  },
  cyrodiil: {
    size: [2048, 1673],
    link: { k: 0.205668, x: 305.806, y: 193.536 },
    outline: '101,845 117,775 128,755 214,648 249,623 260,604 275,590 280,505 292,486 355,460 391,439 397,415 407,397 526,339 554,311 637,188 698,126 743,89 758,84 814,94 881,88 944,74 1026,49 1065,54 1140,76 1209,77 1254,83 1276,90 1382,145 1405,151 1451,154 1528,139 1569,140 1609,149 1644,169 1698,226 1727,280 1738,344 1725,422 1735,442 1736,468 1745,492 1776,532 1778,558 1793,576 1814,588 1826,605 1880,637 1889,657 1905,670 1964,740 1982,787 1947,879 1926,917 1886,961 1873,997 1862,1055 1847,1094 1743,1242 1683,1308 1660,1344 1623,1421 1604,1484 1603,1506 1617,1549 1644,1601 1637,1624 1620,1621 1596,1625 1567,1610 1524,1605 1502,1618 1439,1629 1400,1622 1358,1604 1335,1603 1311,1617 1282,1614 1313,1521 1321,1482 1318,1401 1299,1299 1321,1198 1325,1157 1317,1116 1290,1082 1270,1037 1240,1016 1194,1016 1123,979 1038,955 996,952 853,962 814,944 756,894 735,886 685,882 614,902 551,928 476,973 422,1028 379,1051 326,1058 274,1045 254,1021 232,1007 198,972 155,960 127,930 117,911',
    label: [1000, 330],
    warp: [
      [[1126, 209], [521.18, 234.38]], // Bruma
      [[747, 421], [452.43, 282.64]], // Chorrol
      [[1522, 434], [621.53, 263.54]], // Cheydinhal
      [[1138, 559], [546.88, 317.01]], // Imperial City
      [[734.5, 809], [450.35, 361.46]], // Skingrad
      [[408, 870], [396.18, 378.12]], // Kvatch
      [[214, 959], [359.38, 392.01]], // Anvil
      [[1299, 986], [577.08, 398.26]], // Bravil
      [[951, 219], [491, 238]], // Sancre Tor (no glyph: R8's estimate on Tamriel)
    ],
  },
};

const WORLD: Record<'tamriel' | 'nirn' | 'cosmos', MapShape> = {
  // Traced from the Anthology map (public/maps/official/tamriel-anthology.webp, 2880x2057) at 1000/2880 scale:
  // each province's own crop on UESP greys out its neighbours, so the ungreyed pixels are the province. See
  // docs/design/assets-log.md. Labels sit just under the map's own province names (zh-tw tags; hidden in English).
  tamriel: {
    layer: 'tamriel',
    viewBox: [1000, 714],
    focusScale: 2.5,
    // Fitted onto the drawn Nirn map's Tamriel (v3c, whose coast Codex traced from the province outlines): the uniform
    // scale + shift maximising the overlap of the outlines with the drawn land, IoU 0.881 (the drawn lakes
    // and inner seas count as misses), land centroids 0.4 Nirn units apart.
    parent: { layer: 'nirn', k: 0.4218, x: 265.10, y: 194.86 },
    childMarkers: true,
    regions: [
      { id: 'high-rock', name: { en: 'High Rock', 'zh-tw': '高岩' }, label: [246, 172],
        geometry: polys(
          '385,80 372,73 369,66 354,65 343,58 333,62 332,55 324,53 320,60 328,65 326,85 319,86 306,104 298,103 294,114 280,114 277,130 269,104 278,71 268,62 260,60 252,70 228,81 222,89 204,81 204,95 192,102 169,133 165,150 154,155 146,177 133,191 129,186 123,189 125,194 132,193 136,212 117,244 132,262 125,266 126,276 137,277 144,270 142,264 156,257 172,232 171,226 212,175 222,188 234,188 235,201 246,203 296,179 302,169 322,165 337,152 359,146 359,121 369,112 370,101 382,96',
        ) },
      { id: 'skyrim', name: { en: 'Skyrim', 'zh-tw': '天際' }, label: [496, 104],
        geometry: polys(
          '357,62 358,68 368,68 371,75 385,83 382,96 369,100 368,112 359,121 358,142 364,154 389,165 419,169 461,217 485,224 494,217 503,219 530,210 540,217 562,213 602,235 625,227 631,208 630,186 623,178 625,164 616,146 616,136 605,126 606,112 617,93 599,77 604,74 602,68 591,68 592,62 603,65 612,62 605,50 589,54 580,41 566,45 566,39 560,36 549,43 551,58 527,47 507,61 494,62 487,53 467,58 465,66 460,62 464,59 462,47 455,38 428,34 423,37 423,43 417,43 411,34 401,49 386,47',
        ) },
      { id: 'morrowind', name: { en: 'Morrowind', 'zh-tw': '晨風' }, label: [750, 308],
        geometry: polys(
          '618,93 608,103 604,127 616,138 615,146 624,164 622,174 629,186 629,216 651,226 651,239 660,248 666,269 658,300 675,312 702,369 727,383 727,390 746,392 748,400 759,399 771,385 781,383 793,394 810,394 817,404 845,406 853,378 840,368 841,349 835,336 821,331 846,315 857,288 856,273 863,250 874,246 886,232 897,230 895,224 871,206 873,188 866,187 862,194 858,188 860,172 852,168 845,153 850,127 820,117 792,99 779,103 778,111 773,112 762,102 772,97 768,88 754,88 749,80 728,70 721,73 703,66 696,69 694,76 702,79 708,76 710,87 689,84 688,90 698,98 666,102 664,111 651,117 647,99 630,91',
          '899,71 888,65 876,67 868,76 873,89 862,89 848,102 849,87 836,85 825,100 828,110 835,112 844,104 847,123 857,124 870,114 892,124 902,109 894,88',
          '635,42 630,64 645,94 654,96 664,90 677,88 681,47 662,40 642,38',
        ) },
      { id: 'hammerfell', name: { en: 'Hammerfell', 'zh-tw': '落錘' }, label: [343, 258],
        geometry: polys(
          '462,216 420,169 389,164 365,153 358,145 337,151 320,165 302,169 296,178 275,188 264,188 249,202 238,199 230,212 212,210 202,222 188,222 164,254 161,285 153,297 158,304 172,310 188,335 212,312 221,294 228,293 239,299 247,312 266,320 270,330 280,330 270,338 272,345 268,354 283,365 288,356 314,358 322,349 322,340 313,333 319,335 325,330 318,308 309,305 306,313 291,304 280,314 272,309 270,301 284,286 296,285 299,297 318,302 326,310 326,326 340,354 366,328 396,321 430,275 434,254 448,235 462,225',
          '89,296 85,314 93,323 102,320 103,330 116,334 122,327 121,311 113,310 104,319 107,293',
          '222,350 204,354 200,361 203,374 219,372 226,362',
          '180,347 170,342 165,352 152,347 148,353 162,359 166,355 175,357',
        ) },
      { id: 'cyrodiil', name: { en: 'Cyrodiil', 'zh-tw': '賽洛迪爾' }, label: [471, 347],
        geometry: polys(
          '463,217 461,225 448,234 433,254 429,274 395,321 365,327 346,349 338,349 333,362 333,378 339,386 336,398 358,403 359,413 368,419 390,417 426,388 438,388 446,378 474,383 481,396 523,392 544,398 582,425 581,450 576,457 582,503 573,527 599,506 620,524 635,520 637,526 627,528 609,555 612,562 628,557 639,530 649,544 655,538 651,523 640,512 640,492 652,465 666,456 674,438 686,428 693,396 697,388 707,386 711,375 692,351 676,312 660,301 666,269 660,247 653,240 652,225 629,216 623,228 602,234 584,228 562,212 541,217 528,209 504,218 494,216 486,223',
          '317,386 305,394 313,408 324,400',
        ) },
      { id: 'black-marsh', name: { en: 'Black Marsh', 'zh-tw': '黑沼' }, label: [754, 468],
        geometry: polys(
          '809,392 794,394 779,380 764,394 749,400 747,391 729,389 727,381 710,373 707,386 696,387 685,427 673,437 665,455 652,464 638,492 640,512 654,532 654,538 644,546 641,570 650,580 651,596 660,612 681,613 692,602 714,597 728,606 754,612 768,599 765,585 780,589 793,578 796,556 813,545 822,498 833,499 840,492 834,478 820,487 827,460 815,449 810,411 816,400',
        ) },
      { id: 'elsweyr', name: { en: 'Elsweyr', 'zh-tw': '艾斯維爾' }, label: [518, 483],
        geometry: polys(
          '481,396 455,434 460,453 456,474 465,487 469,505 483,513 492,547 506,562 508,571 519,575 510,586 506,579 496,580 494,591 502,594 509,586 516,598 522,598 526,583 520,575 534,584 572,581 588,591 596,590 601,582 612,583 614,576 600,574 590,558 578,556 566,544 564,535 576,528 578,519 574,524 575,517 583,503 577,464 583,424 538,395 519,391',
        ) },
      { id: 'valenwood', name: { en: 'Valenwood', 'zh-tw': '威木' }, label: [406, 513],
        geometry: polys(
          '475,383 467,378 444,379 410,396 390,417 374,416 343,430 328,455 329,469 312,492 311,513 344,536 389,548 402,540 404,527 419,530 422,540 416,543 416,556 430,572 443,574 452,568 466,571 492,565 499,553 492,543 490,529 483,511 470,504 466,486 458,474 461,452 456,434 469,412 482,400',
          '343,542 340,562 356,564 361,558 357,547',
        ) },
      { id: 'summerset', name: { en: 'Summerset Isles', 'zh-tw': '夏暮島' }, label: [196, 623],
        geometry: polys(
          '267,419 247,409 222,406 213,425 216,437 205,436 201,421 186,415 169,421 165,432 158,426 150,429 149,451 112,453 100,492 113,508 121,510 118,518 123,521 116,538 130,543 118,551 117,593 133,593 156,585 162,590 173,582 190,583 196,591 212,588 218,593 225,592 226,584 249,591 266,577 277,540 291,530 293,518 286,487 291,475 282,472 282,435',
        ) },
    ],
  },
  // Traced from the drawn Nirn map (public/maps/drawn/nirn-drawn.webp, 1700x1020) at 1000/1700 scale: the pale
  // land, grown ~18px so each archipelago reads as one area (Tamriel re-traced on v3c, nirn-tamriel-region.py).
  // Labels are paper tags (the drawn map has no lettering).
  nirn: {
    layer: 'nirn',
    viewBox: [1000, 600],
    focusScale: 2.5,
    // The whole world map inscribed in the cosmos map's Nirn disc (centre 500,500, r 90): k = 180 / hypot(1000, 600).
    parent: { layer: 'cosmos', k: 0.15435, x: 422.83, y: 453.7 },
    looseRegions: true,
    regions: [
      { id: 'tamriel', name: { en: 'Tamriel', 'zh-tw': '泰姆瑞爾' }, label: [540, 282],
        geometry: poly('652,216 637,211 602,226 568,212 556,202 537,198 521,202 500,198 475,205 461,201 412,208 400,205 343,222 308,267 280,263 276,278 283,284 301,284 307,300 294,315 274,321 272,336 279,344 313,345 325,359 324,368 298,386 295,405 304,418 304,449 315,456 344,454 361,458 378,455 392,440 411,445 427,440 485,459 502,451 530,454 546,464 599,458 618,475 632,474 637,457 618,451 612,438 622,416 626,382 635,371 633,332 638,312 651,295 642,262 659,245') },
      { id: 'atmora', name: { en: 'Atmora', 'zh-tw': '阿特摩拉' }, label: [505, 66],
        geometry: poly('274,28 278,38 296,42 304,54 298,104 305,112 315,113 326,95 349,93 360,112 352,139 364,152 374,151 391,136 408,146 424,147 438,159 474,154 489,159 508,148 538,157 567,139 626,176 636,172 645,146 666,137 664,109 689,97 714,94 720,72 742,59 738,49 716,44 706,33 685,31 670,15 644,11 638,0 618,17 581,15 554,26 530,18 495,27 480,19 461,19 448,0 374,0 371,9 360,15 342,12 319,17 302,8 285,12') },
      { id: 'akavir', name: { en: 'Akavir', 'zh-tw': '阿卡維爾' }, label: [815, 300],
        geometry: poly('828,41 819,45 802,86 789,96 792,121 768,126 754,157 736,162 724,146 710,144 688,161 705,191 705,222 720,230 734,248 726,265 732,319 725,335 741,376 733,391 719,392 703,386 694,394 705,414 702,438 710,449 705,468 721,484 721,499 706,510 705,518 720,537 751,544 770,539 786,550 836,542 859,515 873,514 884,502 909,495 921,481 936,439 929,424 932,404 927,390 941,362 935,328 942,306 936,285 944,273 942,225 936,215 942,179 909,130 922,101 876,68 849,70 838,46') },
      { id: 'yokuda', name: { en: 'Yokuda', 'zh-tw': '尤庫達' }, label: [150, 236],
        geometry: poly('89,81 85,95 91,112 67,134 74,149 73,171 61,184 63,205 57,215 56,246 66,261 59,286 68,292 87,291 94,300 91,333 75,345 75,356 89,362 99,384 109,389 121,384 121,368 126,360 151,363 168,348 179,349 189,361 209,361 212,347 203,335 189,328 182,311 172,309 158,317 145,305 147,296 161,281 195,275 206,281 208,304 225,318 248,358 259,358 270,342 289,339 293,329 284,319 264,318 256,313 249,279 261,254 262,239 273,218 292,205 292,194 279,189 266,206 248,209 228,234 206,234 171,171 180,156 200,164 209,158 209,149 194,136 202,114 201,103 175,100 163,115 141,115 138,142 119,152 93,115 95,106 108,96 107,84 99,78') },
      { id: 'pyandonea', name: { en: 'Pyandonea', 'zh-tw': '潘多尼亞' }, label: [216, 540],
        geometry: poly('52,408 58,439 49,458 65,480 62,497 71,528 101,548 105,569 158,586 182,586 191,599 301,599 321,567 334,567 351,580 374,581 391,574 404,547 444,548 455,534 448,520 432,516 405,496 335,518 312,497 275,499 253,476 179,467 161,435 134,437 95,409 79,408 66,399') },
    ],
  },
  // Concentric rings of the drawn cosmos map (public/maps/drawn/cosmos-drawn.webp, 1024x1024, centre 512,512),
  // radii measured along the image's axes and diagonal, x 1000/1024. Aetherius runs past the square's edges.
  cosmos: {
    layer: 'cosmos',
    viewBox: [1000, 1000],
    // The drawn cosmos is only 1024 px wide (cropped from 980): a gentler zoom keeps it from going soft.
    focusScale: 1.6,
    regions: [
      { id: 'aetherius', name: { en: 'Aetherius', 'zh-tw': '艾瑟瑞斯' }, label: [878, 122],
        geometry: { kind: 'circle', cx: 500, cy: 500, r: 605 } },
      { id: 'oblivion', name: { en: 'Oblivion', 'zh-tw': '湮滅' }, label: [500, 104],
        geometry: { kind: 'circle', cx: 500, cy: 500, r: 480 } },
      { id: 'mundus', name: { en: 'Mundus', 'zh-tw': '凡界' }, label: [312, 690],
        geometry: { kind: 'circle', cx: 500, cy: 500, r: 311 } },
      { id: 'nirn', name: { en: 'Nirn', 'zh-tw': '奈恩' }, label: [500, 606],
        geometry: { kind: 'circle', cx: 500, cy: 500, r: 90 } },
    ],
  },
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Sutherland-Hodgman: a polygon cut to the rectangle [0, w] x [0, h]. */
function clipToRect(pts: [number, number][], w: number, h: number): [number, number][] {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= w, (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0]],
    [(p) => p[1] <= h, (a, b) => [a[0] + ((b[0] - a[0]) * (h - a[1])) / (b[1] - a[1]), h]],
  ];
  let out = pts;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out.map(([x, y]) => [round1(x), round1(y)]);
}

/**
 * A province layer: its Anthology crop, with one region (the province, its Tamriel outline moved into the crop) and
 * its parent link back onto Tamriel: crop pixel p is at (p + crop origin) / TAMRIEL_PX there. Skyrim and Cyrodiil:
 * their game map, outline and fitted link instead.
 */
function provinceMap(id: Province): MapShape {
  const src = WORLD.tamriel.regions.find((r) => r.id === id)!;
  const game = PROVINCE_GAME_MAPS[id];
  if (game) {
    return {
      layer: id,
      viewBox: game.size,
      focusScale: 1,
      maxZoom: 2,
      parent: { layer: 'tamriel', ...game.link, warp: game.warp },
      regions: [{ id, name: src.name, geometry: poly(game.outline), label: game.label }],
    };
  }
  const [ox, oy, w, h] = PROVINCE_CROPS[id]!;
  const local = ([x, y]: [number, number]): [number, number] => [x * TAMRIEL_PX - ox, y * TAMRIEL_PX - oy];
  const g = src.geometry;
  const parts = g.kind === 'polygons' ? g.parts : g.kind === 'polygon' ? [g.points] : [];
  const [lx, ly] = local(src.label);
  return {
    layer: id,
    viewBox: [w, h],
    focusScale: 1,
    // The Anthology crops are small (the largest 1096 px wide): no deeper than 2 CSS px per map pixel.
    maxZoom: 2,
    parent: { layer: 'tamriel', k: 1 / TAMRIEL_PX, x: ox / TAMRIEL_PX, y: oy / TAMRIEL_PX },
    regions: [
      {
        id,
        name: src.name,
        geometry: { kind: 'polygons', parts: parts.map((p) => clipToRect(p.map(local), w, h)).filter((p) => p.length >= 3) },
        // Under the map's own lettering, kept on the plate (Summerset's lettering runs along the crop's bottom edge).
        label: [round1(Math.min(Math.max(lx, 40), w - 40)), round1(Math.min(Math.max(ly, 20), h - 20))],
      },
    ],
  };
}

/** The official map's layers: the Anthology map and its crops, the game maps of Skyrim and Cyrodiil. */
export const OFFICIAL_MAPS: Record<MapLayer, MapShape> = {
  ...WORLD,
  ...(Object.fromEntries(PROVINCES.map((id) => [id, provinceMap(id)])) as Record<Province, MapShape>),
};

/**
 * The layers in use: the official map's, or the drawn map's (shapes-drawn.ts) once `useMapShapes` swaps them in
 * (src/lib/map-set.ts does, with everything else that changes with the map). A live binding: importers always see the
 * current set.
 */
export let MAPS: Record<MapLayer, MapShape> = OFFICIAL_MAPS;
export function useMapShapes(maps: Record<MapLayer, MapShape>): void {
  MAPS = maps;
}

function inPolygon(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionContains(region: Region, x: number, y: number): boolean {
  const g = region.geometry;
  if (g.kind === 'circle') return (x - g.cx) ** 2 + (y - g.cy) ** 2 <= g.r ** 2;
  if (g.kind === 'polygons') return g.parts.some((pts) => inPolygon(pts, x, y));
  return inPolygon(g.points, x, y);
}

/** SVG path data for a polygon geometry (one closed subpath per outline). */
export function pathData(parts: [number, number][][]): string {
  return parts.map((pts) => `M${pts.map((p) => p.join(',')).join('L')}Z`).join('');
}

/** Zoom transform centering (x, y) at scale k, clamped to the [0,w]x[0,h] translate extent. */
export function focusTransform(x: number, y: number, w: number, h: number, k: number) {
  return {
    x: Math.min(0, Math.max(w - k * w, w / 2 - k * x)),
    y: Math.min(0, Math.max(h - k * h, h / 2 - k * y)),
    k,
  };
}
