// 身体と脳のあいだ（インターフェースレイヤ：手で決めた変換）
//
// Senses：世界 → 感覚ニューロンの入力率（Hz）
// Motor ：下行ニューロンの発火率 → 前進速度・旋回速度
//
// どちらも connectome から出てきたものではない。対応づけは作品側が決めたもので、
// そのことを隠さない（Eon Systems の身体化モデルも同じ立場を取っている）。
(function () {
  const FM = (window.FM = window.FM || {});
  const DEG = Math.PI / 180;

  class Senses {
    constructor(circuit) {
      this.cols = circuit.cols;
      this.colDeg = circuit.colDeg;
      this.sigma = 14 * DEG; // 1 列の受容野（ガウス）
      this.lumL = new Float32Array(this.cols); this.lumR = new Float32Array(this.cols);
      this.loomL = 0; this.loomR = 0;
      this.odorL = 0; this.odorR = 0;
      this.P = { ornA: 30, ornC0: 0.01 };
      // 左目の列 c の中心方位（左が正）。右目は符号を反転
      this.center = Array.from({ length: this.cols }, (_, c) => (c + 0.5) * this.colDeg * DEG);
    }

    sample(world) {
      const { cols, center } = this;
      this.lumL.fill(0.02); this.lumR.fill(0.02); // わずかな背景光

      // 光：方位と見かけの大きさだけ。どの光が「月」かは、ここでは区別しない
      for (const L of world.lights()) {
        const { az, d } = world.view(L.x, L.y);
        if (world.occluded(L.x, L.y)) continue;
        const ang = Math.atan2(L.r, Math.max(1, d));
        const s2 = 2 * (this.sigma ** 2 + ang ** 2);
        for (let c = 0; c < cols; c++) {
          this.lumL[c] += L.I * Math.exp(-(angDiff(az, center[c]) ** 2) / s2);
          this.lumR[c] += L.I * Math.exp(-(angDiff(az, -center[c]) ** 2) / s2);
        }
      }

      // 接近：岩の見かけの大きさ（角度）が大きいほど強い。前方ほど効く
      this.loomL = 0; this.loomR = 0;
      for (const r of world.rocks) {
        const { az, d } = world.view(r.x, r.y);
        const size = 2 * Math.atan2(r.r, Math.max(1, d));
        const s = Math.max(0, Math.min(1, (size - 0.55) / 1.1)) * (0.5 + 0.5 * Math.max(0, Math.cos(az)));
        if (s <= 0) continue;
        if (az > -10 * DEG) this.loomL = Math.max(this.loomL, s);
        if (az < 10 * DEG) this.loomR = Math.max(this.loomR, s);
      }

      // 匂い：左右の触角の位置で濃度を測る（触角の間隔は見やすさのため誇張）
      const f = world.fly, fw = 9, lat = 16;
      const cx = f.x + Math.cos(f.h) * fw, cy = f.y + Math.sin(f.h) * fw;
      const lx = Math.sin(f.h) * lat, ly = -Math.cos(f.h) * lat; // 左方向
      this.odorL = world.odorAt(cx + lx, cy + ly);
      this.odorR = world.odorAt(cx - lx, cy - ly);
    }

    // hunger 0..1：空腹で Or42b の感度が上がる（Root et al. 2011, sNPF）
    apply(brain, { hunger = 0.5, urge = 1 } = {}) {
      const photo = (x) => 3 + 150 * (x / (x + 0.6));
      brain.setRate("R7R8_L", Array.from(this.lumL, photo));
      brain.setRate("R7R8_R", Array.from(this.lumR, photo));
      brain.setRate("LPLC2_L", 220 * this.loomL);
      brain.setRate("LPLC2_R", 220 * this.loomR);
      // 対数型：左右の濃度の「比」が発火率の差になる
      const gain = 0.5 + hunger, P = this.P;
      const orn = (c) => 2 + P.ornA * gain * Math.log1p(c / P.ornC0);
      brain.setRate("ORN_L", orn(this.odorL));
      brain.setRate("ORN_R", orn(this.odorR));
      brain.setRate("WALK", 34 * urge);
      brain.setRate("EXPLORE_L", 7);
      brain.setRate("EXPLORE_R", 7);
    }
  }

  class Motor {
    constructor() {
      this.V_MAX = 80; // px/s
      this.V_BACK = 50;
      this.OMEGA_MAX = 3.2; // rad/s
      this.gfCool = 0;
      this.out = { forward: 0, turn: 0, jump: false };
    }

    read(brain, dt) {
      const r = (id) => brain.popRate(id);
      const turnL = r("DNa02_L") + 0.6 * r("DNa01_L");
      const turnR = r("DNa02_R") + 0.6 * r("DNa01_R");
      const fwd = r("DNp09_L") + r("DNp09_R");
      const back = r("MDN_L") + r("MDN_R");
      const gf = r("GF_L") + r("GF_R");
      this.out.turn = this.OMEGA_MAX * Math.tanh((turnL - turnR) / 45);
      this.out.forward = this.V_MAX * Math.tanh(fwd / 70) - this.V_BACK * Math.tanh(back / 40);
      this.gfCool -= dt;
      this.out.jump = false;
      if (gf > 25 && this.gfCool <= 0) { this.out.jump = true; this.gfCool = 1.2; }
      this.dn = { turnL, turnR, fwd, back, gf };
      return this.out;
    }
  }

  function angDiff(a, b) {
    const d = a - b;
    return Math.atan2(Math.sin(d), Math.cos(d));
  }

  FM.Senses = Senses;
  FM.Motor = Motor;
})();
