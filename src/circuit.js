// 回路データ（科学レイヤ）
//
// ここにあるのは「どの細胞型が、どの細胞型へ、どれだけの強さでつながるか」だけ。
// ゲームのルールも「月」という概念も、このファイルには出てこない。
//
// Phase 2 の配線は schematic（文献にもとづく模式）。細胞型名は FlyWire の cell_type に合わせてある。
// Phase 3 で tools/extract_circuit.py が FlyWire v783 から同じ形式の circuit を書き出し、
// prov: "flywire_v783" の実データ（ニューロン単位・シナプス数）に置き換える。
//
// populations:
//   id       一意な名前（_L / _R は左右）
//   n        ニューロン数（DN は FlyWire の実数に合わせた。視覚・嗅覚は縮約）
//   cols     視覚の列数（個眼の方位ごとのまとまり）。n = cols × 列あたりの数
//   role     sensor | inter | dn | drive
//   source   "flywire-type"（FlyWire の細胞型に対応） | "game"（作品側が外から与える駆動）
//   flywire  対応する FlyWire cell_type の候補
// projections:
//   pattern  all | col | col_neighbor | azimuth | explicit
//   syn      1 結合あたりのシナプス数（Shiu et al. 2024 と同じく 0.275 mV を掛けて重みにする）
//   nt       ACh（興奮） | GABA / Glu（抑制）
//   prov     schematic | flywire_v783 | game
(function () {
  const FM = (window.FM = window.FM || {});

  const COLS = 10; // 片目の列数。1 列 18°、片目で 0°〜180°
  const populations = [];
  const projections = [];
  const other = (s) => (s === "L" ? "R" : "L");
  const mx = (s, x) => (s === "L" ? x : 1 - x); // 可視化用の左右反転

  const pop = (p) => populations.push(Object.assign({ source: "flywire-type" }, p));
  const link = (p) => projections.push(Object.assign({ p: 1, prov: "schematic" }, p));

  for (const s of ["L", "R"]) {
    const o = other(s);

    // ---- 視覚：光の方向 ----
    pop({ id: `R7R8_${s}`, side: s, n: COLS * 2, cols: COLS, role: "sensor", group: "vision",
      flywire: ["R7", "R8"], label: "R7/R8 光受容", xy: [mx(s, 0.27), 0.07] });
    pop({ id: `Tm_${s}`, side: s, n: COLS * 2, cols: COLS, role: "inter", group: "vision",
      flywire: ["Tm1", "Tm2", "Tm9", "Mi1"], label: "Tm/Mi 髄質", xy: [mx(s, 0.27), 0.19] });
    pop({ id: `Dm_${s}`, side: s, n: COLS, cols: COLS, role: "inter", group: "vision",
      flywire: ["Dm8", "Dm9"], label: "Dm 側方抑制", xy: [mx(s, 0.27), 0.27] });
    pop({ id: `VPNl_${s}`, side: s, n: 12, role: "inter", group: "vision",
      flywire: ["MeTu", "LC"], label: "視覚投射（側方）", xy: [mx(s, 0.18), 0.4] });
    pop({ id: `VPNf_${s}`, side: s, n: 6, role: "inter", group: "vision",
      flywire: ["MeTu", "LC"], label: "視覚投射（前方）", xy: [mx(s, 0.4), 0.4] });

    // ---- 視覚：迫ってくる暗い物体 ----
    pop({ id: `LPLC2_${s}`, side: s, n: 12, role: "sensor", group: "loom",
      flywire: ["LPLC2", "LC4"], label: "LPLC2 接近検出", xy: [mx(s, 0.07), 0.55] });

    // ---- 嗅覚：餌の匂い ----
    pop({ id: `ORN_${s}`, side: s, n: 16, role: "sensor", group: "olf",
      flywire: ["ORN_DM1"], label: "Or42b 嗅受容", xy: [mx(s, 0.12), 0.68] });
    pop({ id: `PN_${s}`, side: s, n: 4, role: "inter", group: "olf",
      flywire: ["DM1_lPN"], label: "DM1 投射", xy: [mx(s, 0.2), 0.76] });
    pop({ id: `LHN_${s}`, side: s, n: 6, role: "inter", group: "olf",
      flywire: ["LHAV", "LHPV"], label: "側角", xy: [mx(s, 0.3), 0.7] });

    // ---- 下行ニューロン（数は FlyWire の片側あたりの実数） ----
    pop({ id: `DNa02_${s}`, side: s, n: 1, role: "dn", group: "motor",
      flywire: ["DNa02"], label: "DNa02 旋回", xy: [mx(s, 0.34), 0.9] });
    pop({ id: `DNa01_${s}`, side: s, n: 1, role: "dn", group: "motor",
      flywire: ["DNa01"], label: "DNa01", xy: [mx(s, 0.42), 0.84] });
    pop({ id: `DNp09_${s}`, side: s, n: 1, role: "dn", group: "motor",
      flywire: ["DNp09"], label: "DNp09 前進", xy: [mx(s, 0.46), 0.93] });
    pop({ id: `MDN_${s}`, side: s, n: 2, role: "dn", group: "motor",
      flywire: ["MDN"], label: "MDN 後退", xy: [mx(s, 0.22), 0.9] });
    pop({ id: `GF_${s}`, side: s, n: 1, role: "dn", group: "motor",
      flywire: ["DNp01"], label: "GF 逃避", xy: [mx(s, 0.1), 0.84] });

    // ---- 作品側の駆動（FlyWire の外） ----
    pop({ id: `EXPLORE_${s}`, side: s, n: 3, role: "drive", group: "game", source: "game",
      flywire: [], label: "ゆらぎ", xy: [mx(s, 0.36), 0.55] });

    // ---- 配線 ----
    // 網膜 → 髄質（同じ列）、髄質 ↔ Dm（隣の列を抑える）
    link({ from: `R7R8_${s}`, to: `Tm_${s}`, pattern: "col", syn: 40, nt: "ACh" });
    link({ from: `Tm_${s}`, to: `Dm_${s}`, pattern: "col", syn: 30, nt: "ACh" });
    link({ from: `Dm_${s}`, to: `Tm_${s}`, pattern: "col_neighbor", syn: 12, nt: "GABA" });
    // 髄質 → 視覚投射。横の列ほど「側方」へ、前の列ほど「前方」へ強く入る
    link({ from: `Tm_${s}`, to: `VPNl_${s}`, pattern: "azimuth", wfun: "lateral", syn: 80, nt: "ACh" });
    link({ from: `Tm_${s}`, to: `VPNf_${s}`, pattern: "azimuth", wfun: "front", syn: 80, nt: "ACh" });
    // 側方の光 → 同じ側の DNa02/DNa01（同じ側へ曲がる：Rayshubskiy et al.）
    link({ from: `VPNl_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 15, nt: "ACh" });
    link({ from: `VPNl_${s}`, to: `DNa01_${s}`, pattern: "all", syn: 8, nt: "ACh" });
    // 前方の光 → 前進
    for (const t of ["L", "R"]) link({ from: `VPNf_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 20, nt: "ACh" });

    // 接近 → GF（逃避：von Reyn et al., Ache et al.）、反対側の DNa02（避ける）、MDN（後ずさり）
    link({ from: `LPLC2_${s}`, to: `GF_${s}`, pattern: "all", syn: 6, nt: "ACh" });
    link({ from: `LPLC2_${s}`, to: `DNa02_${o}`, pattern: "all", syn: 20, nt: "ACh" });
    for (const t of ["L", "R"]) link({ from: `LPLC2_${s}`, to: `MDN_${t}`, pattern: "all", syn: 10, nt: "ACh" });

    // 嗅覚：ORN は両側の PN に入るが同じ側が強い（Gaudry et al. 2013）
    link({ from: `ORN_${s}`, to: `PN_${s}`, pattern: "all", syn: 20, nt: "ACh" });
    link({ from: `ORN_${s}`, to: `PN_${o}`, pattern: "all", syn: 4, nt: "ACh" });
    link({ from: `PN_${s}`, to: `LHN_${s}`, pattern: "all", syn: 30, nt: "ACh" });
    // 反対側を引き算して左右差だけを残す（模式。Phase 3 で実際の経路に置き換える）
    link({ from: `PN_${s}`, to: `LHN_${o}`, pattern: "all", syn: 15, nt: "GABA" });
    link({ from: `LHN_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 40, nt: "ACh" });
    link({ from: `LHN_${s}`, to: `DNa02_${o}`, pattern: "all", syn: 10, nt: "GABA" });
    for (const t of ["L", "R"]) link({ from: `LHN_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 8, nt: "ACh" });

    // 後退は前進を抑える（Bidaye et al. 2014 の MDN。経路は模式）
    for (const t of ["L", "R"]) link({ from: `MDN_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 40, nt: "GABA" });

    // 作品側：ときどき片側だけ揺らして、刺激がなくても探索する
    link({ from: `EXPLORE_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 60, nt: "ACh", prov: "game" });
  }

  // 触角葉の局所ニューロン：左右の ORN をまとめて受け、PN を一様に抑える（Olsen & Wilson 2008）。
  // 匂いの絶対量を差し引き、左右差を残す
  pop({ id: "ALLN", side: "C", n: 4, role: "inter", group: "olf",
    flywire: ["ALLN"], label: "触角葉 LN", xy: [0.5, 0.67] });
  for (const s of ["L", "R"]) {
    link({ from: `ORN_${s}`, to: "ALLN", pattern: "all", syn: 12, nt: "ACh" });
    link({ from: "ALLN", to: `PN_${s}`, pattern: "all", syn: 20, nt: "GABA" });
  }

  // 匂いが強いと歩みを緩める（餌のそばで止まる。経路は模式）
  pop({ id: "LHNstop", side: "C", n: 4, role: "inter", group: "olf",
    flywire: ["LHPV", "LHAV"], label: "側角（減速）", xy: [0.5, 0.78] });
  for (const s of ["L", "R"]) {
    link({ from: `PN_${s}`, to: "LHNstop", pattern: "all", syn: 9, nt: "ACh" });
    link({ from: "LHNstop", to: `DNp09_${s}`, pattern: "all", syn: 30, nt: "GABA" });
  }

  // 作品側：歩こうとする衝動（プレイヤーからは「ハエの元気」に見える）
  pop({ id: "WALK", side: "C", n: 6, role: "drive", group: "game", source: "game",
    flywire: [], label: "歩行衝動", xy: [0.5, 0.55] });
  for (const t of ["L", "R"]) link({ from: "WALK", to: `DNp09_${t}`, pattern: "all", syn: 30, nt: "ACh", prov: "game" });

  FM.CIRCUIT = {
    meta: {
      name: "fmttm-phase2-schematic",
      note: "細胞型は FlyWire に対応。配線と数は模式（Phase 3 で FlyWire v783 の実データに置換）",
      w_syn_mV: 0.275, // Shiu et al. 2024
    },
    cols: COLS,
    colDeg: 18,
    populations,
    projections,
  };
})();
