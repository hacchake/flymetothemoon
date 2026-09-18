// ステージ（ゲームレイヤ）
// 座標は世界単位。幅は常に 1000、高さ H はステージごと。y は下向き、地面は H - 60 あたり。
// tools: プレイヤーが使える道具の数（lamp は電池の秒数）。Infinity は無制限
(function () {
  const FM = (window.FM = window.FM || {});

  FM.STAGES = [
    {
      id: 1, name: "はじめての夜", H: 1300, par: 18,
      hint: "ハエは光を追う。何もしなくても、月へ向かうかもしれない",
      start: [140, 1150], moon: [760, 170],
      tools: { lamp: 8, food: 1, cloud: 0 },
    },
    {
      id: 2, name: "街灯", H: 1500, par: 22,
      hint: "近くの街灯は、月より明るく見える。ランタンで引き離そう",
      start: [120, 1360], moon: [820, 150],
      streetlights: [[320, 980], [700, 760]],
      tools: { lamp: 10, food: 1, cloud: 1 },
    },
    {
      id: 3, name: "ハエトリ紙", H: 1500, par: 24,
      hint: "甘い匂いに気をつけて。捕まったら紙を連打して助けよう",
      start: [500, 1360], moon: [500, 140],
      papers: [[500, 380, 170], [360, 700, 170], [630, 760, 160], [500, 1030, 150]],
      tools: { lamp: 10, food: 2, cloud: 1 },
    },
    {
      id: 4, name: "殺虫灯", H: 1700, par: 28,
      hint: "ハエには紫外線がまぶしく見える。雲で光を遮ろう",
      start: [150, 1560], moon: [830, 150],
      zappers: [[520, 820]], streetlights: [[860, 1250]],
      tools: { lamp: 12, food: 1, cloud: 2 },
    },
    {
      id: 5, name: "ハエ叩き", H: 1700, par: 28,
      hint: "迫る影を見ると、ハエは逃げ出す（LPLC2 → GF）",
      start: [500, 1560], moon: [500, 140],
      swatters: [[500, 1000]], streetlights: [[180, 700]],
      tools: { lamp: 12, food: 2, cloud: 1 },
    },
    {
      id: 6, name: "夜の大通り", H: 1900, par: 32,
      hint: "ヘッドライトに誘われると、車にはねられる",
      start: [140, 1720], moon: [860, 150], road: true,
      streetlights: [[400, 1500], [760, 1300]], clouds: [[560, 900, 70]],
      tools: { lamp: 12, food: 2, cloud: 2 },
    },
    {
      id: 7, name: "真夜中の台所", H: 2200, par: 40,
      hint: "全部ある。3 匹で月まで",
      start: [120, 2040], moon: [840, 160], road: true,
      streetlights: [[700, 1700]], zappers: [[280, 1150]],
      papers: [[560, 1200, 180], [420, 560, 160]], swatters: [[600, 900]],
      clouds: [[820, 1050, 60]],
      tools: { lamp: 14, food: 3, cloud: 2 },
    },
    {
      id: 8, name: "月は遠い", H: 3000, par: 55,
      hint: "長い夜。餌で力をつなごう",
      start: [500, 2840], moon: [500, 150], road: true,
      streetlights: [[200, 2500], [800, 2300]], zappers: [[500, 1850], [180, 900]],
      papers: [[700, 1500, 180], [300, 1250, 170], [640, 560, 160]],
      swatters: [[500, 1300], [500, 600]], clouds: [[820, 1900, 70], [300, 700, 60]],
      tools: { lamp: 18, food: 4, cloud: 3 },
    },
  ];

  // 自由実験：何でも置ける
  FM.SANDBOX = {
    id: 0, name: "自由実験", H: 1400, par: 0, sandbox: true,
    hint: "光、雲、餌、罠を自由に置いて、ハエの脳がどう反応するか見る",
    start: [200, 1200], moon: [760, 200],
    streetlights: [[480, 900]],
    tools: { lamp: Infinity, food: Infinity, cloud: Infinity, moon: Infinity,
      street: Infinity, zapper: Infinity, paper: Infinity, swatter: Infinity },
  };
})();
