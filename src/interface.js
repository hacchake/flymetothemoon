// 身体と脳のあいだ（インターフェースレイヤ：手で決めた変換）
//
// Senses：世界 → 感覚ニューロンの入力率（Hz）
// Motor ：下行ニューロンの発火率 → 飛ぶ速さ・旋回・逃避の突進
//
// どちらも connectome から出てきたものではない。対応づけは作品側が決めたもので、
// そのことを隠さない（Eon Systems の身体化モデルも同じ立場を取っている）。
// 飛行中の DN の役割（DNp09 = 推力、DNa02 = 旋回）は、歩行で分かっていることからの仮定。
(function () {
  const FM = (window.FM = window.FM || {});
  const DEG = Math.PI / 180;
  const BIAS = new WeakMap(); // 回路ごとの零点（一度だけ測る）

  class Senses {
    constructor(circuit) {
      this.cols = circuit.cols;
      this.colDeg = circuit.colDeg;
      this.sigma = 14 * DEG; // 1 列の受容野（ガウス）
      this.lumL = new Float32Array(this.cols); this.lumR = new Float32Array(this.cols);
      this.loomL = 0; this.loomR = 0;
      this.odorL = 0; this.odorR = 0;
      this.P = { ornA: 180, ornBase: 35, ornTau: 1.2, photoBase: 0.5, photoMax: 150, ambient: 0.003, steerGain: 1, fwdGain: 1, antenna: 20,
        joBase: 3, windA: 55, soundA: 150, co2Base: 2, co2A: 90,
        trendK: 12, castA: 55, castW: 2.4, upQuiet: 0.85, walkUp: 0.45, walkDown: 0 };
      this.windL = this.windR = this.soundL = this.soundR = this.co2L = this.co2R = 0;
      this.odorTrend = 0; this.odorNear = 0;
      this.odorAdapt = 0.01; // 嗅覚受容体の順応レベル（ゆっくり追いかける平均濃度）
      // 左目の列 c の中心方位（左が正）。右目は符号を反転
      this.center = Array.from({ length: this.cols }, (_, c) => (c + 0.5) * this.colDeg * DEG);
      this.prevSize = new Map();
    }

    sample(world) {
      const { cols, center } = this;
      this.lumL.fill(this.P.ambient); this.lumR.fill(this.P.ambient); // わずかな背景光

      // 光：方位と見かけの大きさと明るさだけ。どの光が「月」かは、ここでは区別しない
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

      // 接近：見かけの大きさ（角度）が大きく、しかも大きくなっているほど強い
      this.loomL = 0; this.loomR = 0;
      const seen = new Map();
      world.loomers().forEach((o, i) => {
        const { az, d } = world.view(o.x, o.y);
        const size = 2 * Math.atan2(o.r, Math.max(1, d - 0.5 * o.r));
        const key = o.dark ? `s${i}` : `${Math.round(o.x)},${Math.round(o.y)}`;
        const grow = Math.max(0, size - (this.prevSize.get(key) ?? size));
        seen.set(key, size);
        let s = Math.max(0, Math.min(1, (size - 0.55) / 1.1)) + Math.min(1, grow * 25);
        s = Math.min(1, s) * (0.5 + 0.5 * Math.max(0, Math.cos(az)));
        if (s <= 0) return;
        if (az > -10 * DEG) this.loomL = Math.max(this.loomL, s);
        if (az < 10 * DEG) this.loomR = Math.max(this.loomR, s);
      });
      this.prevSize = seen;

      // 匂い：左右の触角の位置で濃度を測る（触角の間隔は見やすさのため誇張）
      const f = world.fly, fw = 9, lat = this.P.antenna;
      const cx = f.x + Math.cos(f.h) * fw, cy = f.y + Math.sin(f.h) * fw;
      const lx = Math.sin(f.h) * lat, ly = -Math.cos(f.h) * lat; // 左方向
      this.odorL = world.odorAt(cx + lx, cy + ly);
      this.odorR = world.odorAt(cx - lx, cy - ly);
      const mean = Math.max(0.005, (this.odorL + this.odorR) / 2);
      this.odorAdapt += (mean - this.odorAdapt) * Math.min(1, (1 / 60) / this.P.ornTau);
      // 匂いが「濃くなりつつある」か「薄れつつある」か。
      // ハエは左右の触角の差で匂い源へ向かうのではなく（触角の間隔は 0.5 mm しかない）、
      // 進みながら濃さの変化を読む。濃くなる間はまっすぐ、薄れたら向きを変える
      const lm = Math.log(mean);
      if (this.odorFast === undefined) { this.odorFast = this.odorSlow = lm; }
      this.odorFast += (lm - this.odorFast) * Math.min(1, (1 / 60) / 0.18);
      this.odorSlow += (lm - this.odorSlow) * Math.min(1, (1 / 60) / 0.9);
      this.clock = (this.clock || 0) + 1 / 60;
      const strong = Math.min(1, mean / 0.05); // かすかな匂いでは判断しない
      this.odorTrend = Math.max(-1, Math.min(1, (this.odorFast - this.odorSlow) * this.P.trendK)) * strong;
      this.odorNear = Math.min(1, mean / 0.7); // 源のすぐそば。近づいたら速度を落として、行き過ぎないようにする

      // 空気：触角（Johnston 器官）が受ける風の向きと、空気のふるえ
      if (world.airAt) {
        const aL = world.airAt(cx + lx, cy + ly), aR = world.airAt(cx - lx, cy - ly);
        // 風は「左の触角をどれだけ押すか」で左右差になる。左方向の単位ベクトルは (sin h, -cos h)
        const sx = Math.sin(f.h), sy = -Math.cos(f.h);
        const push = (a, sign) => Math.max(0, (a.wx * sx + a.wy * sy) * sign) + 0.45 * Math.hypot(a.wx, a.wy);
        this.windL = push(aL, 1); this.windR = push(aR, -1);
        this.soundL = aL.snd; this.soundR = aR.snd;
        this.co2L = aL.co2; this.co2R = aR.co2;
      } else {
        this.windL = this.windR = this.soundL = this.soundR = this.co2L = this.co2R = 0;
      }
    }

    // 片目の光をまとめる。w(c) は列 c の重み（0 = 正面寄り）
    pooled(lum, w) {
      let s = 0, n = 0;
      for (let c = 0; c < this.cols; c++) { const k = w(c); s += lum[c] * k; n += k; }
      return s / n;
    }

    // 感覚ニューロンの集団ごとに入力率を決める。集団は modality と side で選ぶので、
    // 模式の回路でも FlyWire の回路でも同じ接点で動く
    apply(brain, { hunger = 0.5, urge = 1 } = {}) {
      const P = this.P;
      // 暗闇では視覚投射ニューロンはほとんど発火しない（自発発火 photoBase Hz）
      const photo = (x) => P.photoBase + P.photoMax * (x / (x + 0.6));
      const az = (c) => (c + 0.5) * this.colDeg;
      const lateral = (c) => Math.min(1, Math.max(0.15, az(c) / 70));
      const front = (c) => Math.max(0, 1 - az(c) / 60);
      const gain = 0.5 + hunger; // 空腹で Or42b の感度が上がる（Root et al. 2011）
      // 順応する対数型：慣れた濃さからの「比」だけが発火になる。左右の差と、濃くなっていく変化が残る
      const orn = (c) => c < 0.004 ? 2 : Math.max(0, Math.min(220, gain * (P.ornBase + P.ornA * Math.log(c / this.odorAdapt))));

      for (const p of brain.pops) {
        if (p.role !== "sensor" && p.role !== "drive") continue;
        const L = p.side === "L";
        const lum = L ? this.lumL : this.lumR;
        switch (p.modality) {
          case "retina": brain.setRate(p.id, Array.from(lum, photo)); break;
          case "light_steer": brain.setRate(p.id, photo(this.pooled(lum, lateral) * P.steerGain)); break;
          case "light_fwd": brain.setRate(p.id, photo(this.pooled(lum, front) * P.fwdGain)); break;
          case "loom": brain.setRate(p.id, 220 * (L ? this.loomL : this.loomR)); break;
          case "odor": brain.setRate(p.id, orn(L ? this.odorL : this.odorR)); break;
          // FlyWire の実データの感覚ニューロン
          case "odor_food": brain.setRate(p.id, orn(L ? this.odorL : this.odorR)); break;
          case "odor_bad": brain.setRate(p.id, P.co2Base + P.co2A * Math.min(1.6, L ? this.co2L : this.co2R)); break;
          case "wind": brain.setRate(p.id, P.joBase + P.windA * Math.min(2.2, L ? this.windL : this.windR)); break;
          case "sound": brain.setRate(p.id, P.joBase + P.soundA * Math.min(2.2, L ? this.soundL : this.soundR)); break;
          case "drive": {
            // 作品側の駆動（FlyWire の外）。匂いの濃さの「変化」で探索のしかたを変える。
            // ハエは左右の触角の差で匂い源に向かうのではなく、濃くなる間はまっすぐ進み、
            // 薄れると左右へ大きく振って探す（casting）。ゆらぎの左右を交互に強めて、それを作る
            const tr = this.odorTrend || 0, up = Math.max(0, tr), down = Math.max(0, -tr);
            if (p.id === "WALK") {
              const slowDown = 1 - 0.7 * (this.odorNear || 0); // 匂いの源の近くでは減速する
              brain.setRate(p.id, Math.max(4, 34 * urge * (1 + P.walkUp * up - P.walkDown * down) * slowDown));
              break;
            }
            const cast = Math.sin((this.clock || 0) * P.castW) > 0 ? "L" : "R";
            brain.setRate(p.id, 7 * (1 - P.upQuiet * up) + (p.side === cast ? P.castA * down : 0));
            break;
          }
        }
      }
    }
  }

  class Motor {
    constructor() {
      this.V_MIN = 45; // px/s（ハエは止まらずに漂う）
      this.V_MAX = 200;
      this.V_BRAKE = 40;
      this.OMEGA_MAX = 4.2; // rad/s
      this.GF_THRESHOLD = 100; // Hz（迫る影では 200〜400 Hz。明るい光の近くでも 90 Hz 近くまで上がるので、その上に置く）
      this.gfCool = 0;
      this.out = { speed: 0, turn: 0, dash: false };
      this.dn = { turnL: 0, turnR: 0, fwd: 0, back: 0, gf: 0 };
      this.bias = 0;
      this.slow = 0; // 旋回信号のゆっくりした平均（順応）
    }

    // 零点合わせ：刺激のない暗闇で DNa02 の左右差を測り、以後それを差し引く。
    // 抜き出した FlyWire の回路は左右が完全には対称でなく、何も見えなくても右の DNa02 がやや強く発火する。
    // 光のような強い刺激では問題にならないが、匂いのような弱い左右差はこの偏りに埋もれてしまう
    calibrate(circuit) {
      if (BIAS.has(circuit)) return (this.bias = BIAS.get(circuit));
      const b = new FM.Brain(circuit, { dt: 0.5, seed: 12345 });
      const s = new FM.Senses(circuit);
      s.lumL.fill(s.P.ambient); s.lumR.fill(s.P.ambient);
      s.apply(b, { hunger: 0.5 });
      b.run(300);
      let d = 0;
      for (let i = 0; i < 20; i++) { b.run(100); d += (b.popRate("DNa02_L") - b.popRate("DNa02_R")) / 20; }
      BIAS.set(circuit, d);
      this.bias = d;
      return d;
    }

    read(brain, dt, { surge = 0 } = {}) {
      const r = (id) => (brain.popById[id] ? brain.popRate(id) : 0);
      // 旋回は DNa02 だけで読む。FlyWire から抜き出した回路では DNa02 は光と同じ側で発火したが、
      // DNa01 は左右の関係がはっきりしなかった（tests.html の開ループ試験）
      const turnL = r("DNa02_L"), turnR = r("DNa02_R");
      const fwd = r("DNp09_L") + r("DNp09_R");
      const back = r("MDN_L") + r("MDN_R");
      const gf = r("GF_L") + r("GF_R");
      // 旋回への順応：いつまでも同じ向きの信号が続くときは、それを「まっすぐ」と見なしていく。
      // コネクトームは 1 匹の脳なので左右が完全には対称でなく、匂いのような弱い刺激では、
      // その偏り（たとえば AOTU019 の抑制は左右で 10 倍違う）が旋回を片側に張りつかせてしまう。
      // 同じ向きに回り続ける状態も、これで数秒のうちにほどける（運動順応は実際の動物にもある）
      const d = turnL - turnR;
      this.slow += (d - this.slow) * Math.min(1, dt / 2.5);
      // 匂いが濃くなっている間は、曲がらずに進む（odor-induced surge）。
      // 実際のハエも、匂いの筋に入ると旋回をやめて風上へ直進する。
      // 触角の左右の間隔は 0.5 mm しかなく、左右差では匂い源へ向かえないため、この切り替えが要になる
      const straight = 1 - 0.9 * Math.max(0, Math.min(1, surge));
      this.out.turn = this.OMEGA_MAX * Math.tanh((d - this.bias - this.slow * 0.75) / 60) * straight;
      this.out.speed = Math.max(20, this.V_MIN + (this.V_MAX - this.V_MIN) * Math.tanh(fwd / 160) - this.V_BRAKE * Math.tanh(back / 40));
      this.gfCool -= dt;
      this.out.dash = false;
      // 逃避の閾値。迫る影では GF は 200〜400 Hz になる。一方、抜き出した回路には
      // 右目の前進用視覚（LC9/LC31a）から GF への経路があり、明るい光の近くでは 40〜90 Hz ほど発火する。
      // 25 Hz にしていた頃は、何もない空で急に突進していた（「ピシッ」という音と方向転換）
      if (gf > this.GF_THRESHOLD && this.gfCool <= 0) { this.out.dash = true; this.gfCool = 1.0; }
      Object.assign(this.dn, { turnL, turnR, fwd, back, gf });
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
