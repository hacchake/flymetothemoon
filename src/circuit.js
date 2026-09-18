// 回路データ（科学レイヤ）
//
// ここにあるのは「どの細胞型が、どの細胞型へ、どれだけの強さでつながるか」だけ。
// ゲームのルールも「月」という概念も、このファイルには出てこない。
//
// 2 種類の回路を用意する：
//   FM.CIRCUITS.flywire   … 視覚と逃避は FlyWire v783 の実ニューロン・実シナプス数（src/circuit_flywire.js）。
//                           嗅覚と作品側の駆動だけ模式で足す。既定。
//   FM.CIRCUITS.schematic … すべて模式（Phase 2）。比較用。
//
// populations:
//   id       一意な名前（_L / _R は左右）
//   n        ニューロン数
//   cols     視覚の列数（模式の網膜だけ）。n = cols × 列あたりの数
//   role     sensor | inter | dn | drive
//   modality 感覚ニューロンが何を受けるか（light_steer | light_fwd | loom | retina | odor | drive）
//   source   "flywire"（実データ） | "flywire-type"（FlyWire の細胞型に対応する模式） | "game"（作品側の駆動）
//   pos      可視化用の位置（FlyWire の実座標を正面から見たもの、0..1）。無ければ xy に集団ごとに置く
// projections:
//   pattern  all | col | col_neighbor | azimuth | explicit（[前, 後, 符号付きシナプス数] の並び）
//   syn      1 結合あたりのシナプス数（Shiu et al. 2024 と同じく 0.275 mV を掛けて重みにする）
//   nt       ACh（興奮） | GABA / Glu（抑制） | signed（edges の符号をそのまま使う）
//   prov     flywire_v783 | schematic | game
(function () {
  const FM = (window.FM = window.FM || {});

  const COLS = 10; // 模式の網膜の列数。1 列 18°、片目で 0°〜180°
  const other = (s) => (s === "L" ? "R" : "L");
  const mx = (s, x) => (s === "L" ? x : 1 - x);

  function builder() {
    const populations = [], projections = [];
    return {
      populations, projections,
      pop: (p) => populations.push(Object.assign({ source: "flywire-type" }, p)),
      link: (p) => projections.push(Object.assign({ p: 1, prov: "schematic" }, p)),
    };
  }

  // ---- 模式の視覚・逃避・下行ニューロン（Phase 2） ----
  function schematicVision(B) {
    const { pop, link } = B;
    for (const s of ["L", "R"]) {
      const o = other(s);
      pop({ id: `R7R8_${s}`, side: s, n: COLS * 2, cols: COLS, role: "sensor", modality: "retina", group: "vision",
        flywire: ["R7", "R8"], label: "R7/R8 光受容", xy: [mx(s, 0.27), 0.07] });
      pop({ id: `Tm_${s}`, side: s, n: COLS * 2, cols: COLS, role: "inter", group: "vision",
        flywire: ["Tm1", "Tm2", "Tm9", "Mi1"], label: "Tm/Mi 髄質", xy: [mx(s, 0.27), 0.19] });
      pop({ id: `Dm_${s}`, side: s, n: COLS, cols: COLS, role: "inter", group: "vision",
        flywire: ["Dm8", "Dm9"], label: "Dm 側方抑制", xy: [mx(s, 0.27), 0.27] });
      pop({ id: `VPNl_${s}`, side: s, n: 12, role: "inter", group: "vision",
        flywire: ["MeTu", "LC"], label: "視覚投射（側方）", xy: [mx(s, 0.18), 0.4] });
      pop({ id: `VPNf_${s}`, side: s, n: 6, role: "inter", group: "vision",
        flywire: ["MeTu", "LC"], label: "視覚投射（前方）", xy: [mx(s, 0.4), 0.4] });
      pop({ id: `LPLC2_${s}`, side: s, n: 12, role: "sensor", modality: "loom", group: "loom",
        flywire: ["LPLC2", "LC4"], label: "LPLC2 接近検出", xy: [mx(s, 0.07), 0.55] });
      dnPops(B, s);

      link({ from: `R7R8_${s}`, to: `Tm_${s}`, pattern: "col", syn: 40, nt: "ACh" });
      link({ from: `Tm_${s}`, to: `Dm_${s}`, pattern: "col", syn: 30, nt: "ACh" });
      link({ from: `Dm_${s}`, to: `Tm_${s}`, pattern: "col_neighbor", syn: 12, nt: "GABA" });
      link({ from: `Tm_${s}`, to: `VPNl_${s}`, pattern: "azimuth", wfun: "lateral", syn: 80, nt: "ACh" });
      link({ from: `Tm_${s}`, to: `VPNf_${s}`, pattern: "azimuth", wfun: "front", syn: 80, nt: "ACh" });
      link({ from: `VPNl_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 15, nt: "ACh" });
      link({ from: `VPNl_${s}`, to: `DNa01_${s}`, pattern: "all", syn: 8, nt: "ACh" });
      for (const t of ["L", "R"]) link({ from: `VPNf_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 20, nt: "ACh" });
      link({ from: `LPLC2_${s}`, to: `GF_${s}`, pattern: "all", syn: 6, nt: "ACh" });
      link({ from: `LPLC2_${s}`, to: `DNa02_${o}`, pattern: "all", syn: 20, nt: "ACh" });
      for (const t of ["L", "R"]) link({ from: `LPLC2_${s}`, to: `MDN_${t}`, pattern: "all", syn: 10, nt: "ACh" });
      for (const t of ["L", "R"]) link({ from: `MDN_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 40, nt: "GABA" });
    }
  }

  function dnPops(B, s) {
    const { pop } = B;
    pop({ id: `DNa02_${s}`, side: s, n: 1, role: "dn", group: "motor", flywire: ["DNa02"], label: "DNa02 旋回", xy: [mx(s, 0.34), 0.9] });
    pop({ id: `DNa01_${s}`, side: s, n: 1, role: "dn", group: "motor", flywire: ["DNa01"], label: "DNa01", xy: [mx(s, 0.42), 0.84] });
    pop({ id: `DNp09_${s}`, side: s, n: 1, role: "dn", group: "motor", flywire: ["DNp09"], label: "DNp09 前進", xy: [mx(s, 0.46), 0.93] });
    pop({ id: `MDN_${s}`, side: s, n: 2, role: "dn", group: "motor", flywire: ["MDN"], label: "MDN 後退", xy: [mx(s, 0.22), 0.9] });
    pop({ id: `GF_${s}`, side: s, n: 1, role: "dn", group: "motor", flywire: ["DNp01"], label: "GF 逃避", xy: [mx(s, 0.1), 0.84] });
  }

  // ---- 模式の嗅覚（FlyWire では受容体から DN まで 3 段では届かなかったので、模式で補う） ----
  // xy は FlyWire 座標で触角葉〜側角のあたりに置く
  function schematicOlfaction(B) {
    const { pop, link } = B;
    for (const s of ["L", "R"]) {
      const o = other(s);
      pop({ id: `ORN_${s}`, side: s, n: 16, role: "sensor", modality: "odor", group: "olf",
        flywire: ["ORN_DM1"], label: "Or42b 嗅受容", xy: [mx(s, 0.43), 0.66] });
      pop({ id: `PN_${s}`, side: s, n: 4, role: "inter", group: "olf",
        flywire: ["DM1_lPN"], label: "DM1 投射", xy: [mx(s, 0.4), 0.56] });
      pop({ id: `LHN_${s}`, side: s, n: 6, role: "inter", group: "olf",
        flywire: ["LHAV", "LHPV"], label: "側角", xy: [mx(s, 0.33), 0.42] });
      link({ from: `ORN_${s}`, to: `PN_${s}`, pattern: "all", syn: 20, nt: "ACh" });
      link({ from: `ORN_${s}`, to: `PN_${o}`, pattern: "all", syn: 4, nt: "ACh" });
      link({ from: `PN_${s}`, to: `LHN_${s}`, pattern: "all", syn: 30, nt: "ACh" });
      link({ from: `PN_${s}`, to: `LHN_${o}`, pattern: "all", syn: 15, nt: "GABA" });
      link({ from: `LHN_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 40, nt: "ACh" });
      link({ from: `LHN_${s}`, to: `DNa02_${o}`, pattern: "all", syn: 10, nt: "GABA" });
      for (const t of ["L", "R"]) link({ from: `LHN_${s}`, to: `DNp09_${t}`, pattern: "all", syn: 8, nt: "ACh" });
    }
    pop({ id: "ALLN", side: "C", n: 4, role: "inter", group: "olf", flywire: ["ALLN"], label: "触角葉 LN", xy: [0.5, 0.64] });
    pop({ id: "LHNstop", side: "C", n: 4, role: "inter", group: "olf", flywire: ["LHPV", "LHAV"], label: "側角（減速）", xy: [0.5, 0.5] });
    for (const s of ["L", "R"]) {
      link({ from: `ORN_${s}`, to: "ALLN", pattern: "all", syn: 12, nt: "ACh" });
      link({ from: "ALLN", to: `PN_${s}`, pattern: "all", syn: 20, nt: "GABA" });
      link({ from: `PN_${s}`, to: "LHNstop", pattern: "all", syn: 9, nt: "ACh" });
      link({ from: "LHNstop", to: `DNp09_${s}`, pattern: "all", syn: 30, nt: "GABA" });
    }
  }

  // ---- 作品側の駆動（FlyWire の外） ----
  function gameDrives(B) {
    const { pop, link } = B;
    for (const s of ["L", "R"]) {
      pop({ id: `EXPLORE_${s}`, side: s, n: 3, role: "drive", modality: "drive", group: "game", source: "game",
        flywire: [], label: "ゆらぎ", xy: [mx(s, 0.44), 0.86] });
      link({ from: `EXPLORE_${s}`, to: `DNa02_${s}`, pattern: "all", syn: 60, nt: "ACh", prov: "game" });
    }
    pop({ id: "WALK", side: "C", n: 6, role: "drive", modality: "drive", group: "game", source: "game",
      flywire: [], label: "飛ぼうとする衝動", xy: [0.5, 0.95] });
    for (const t of ["L", "R"]) link({ from: "WALK", to: `DNp09_${t}`, pattern: "all", syn: 30, nt: "ACh", prov: "game" });
  }

  function schematic() {
    const B = builder();
    schematicVision(B);
    schematicOlfaction(B);
    gameDrives(B);
    return {
      meta: { name: "schematic", note: "細胞型は FlyWire に対応。配線と数は模式", w_syn_mV: 0.275 },
      cols: COLS, colDeg: 18, populations: B.populations, projections: B.projections,
    };
  }

  // FlyWire の実データ + 模式の嗅覚 + 作品側の駆動
  function flywire(F) {
    const B = builder();
    const rename = { DNp01_L: "GF_L", DNp01_R: "GF_R" }; // GF は DNp01
    const labels = { DNa02: "DNa02 旋回", DNa01: "DNa01", DNp09: "DNp09 前進", MDN: "MDN 後退", DNp01: "GF 逃避" };
    for (const p of F.populations) {
      const q = Object.assign({}, p, { id: rename[p.id] || p.id });
      if (p.role === "dn") q.label = labels[p.label] || p.label;
      B.populations.push(q);
    }
    for (const pr of F.projections) {
      B.projections.push(Object.assign({}, pr, { from: rename[pr.from] || pr.from, to: rename[pr.to] || pr.to }));
    }
    schematicOlfaction(B);
    gameDrives(B);
    return {
      meta: Object.assign({}, F.meta, { name: "flywire", w_syn_mV: 0.275 }),
      cols: COLS, colDeg: 18, populations: B.populations, projections: B.projections,
    };
  }

  FM.CIRCUITS = { schematic: schematic() };
  if (FM.FLYWIRE) FM.CIRCUITS.flywire = flywire(FM.FLYWIRE);
  FM.CIRCUIT = FM.CIRCUITS.flywire || FM.CIRCUITS.schematic;
})();
