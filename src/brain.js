// 神経シミュレータ（科学レイヤ）
//
// Shiu et al. 2024 の全脳モデルと同じ LIF（漏れ積分発火）とパラメータを、
// FM.CIRCUIT の小さな回路に当てはめて逐次実行する。GPU も外部ライブラリも使わない。
//
//   dv/dt = (v0 - v + g) / tau_m     （不応期中は止める）
//   dg/dt = -g / tau_syn
//   v > v_th で発火 → v = v_reset, g = 0, 伝達遅延 1.8 ms の後に結合先の g へ重みを足す
(function () {
  const FM = (window.FM = window.FM || {});

  FM.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const NT_SIGN = { ACh: 1, GABA: -1, Glu: -1 };

  const PARAMS = {
    v0: -52, vReset: -52, vTh: -45, // mV
    tauM: 20, tauSyn: 5, tRef: 2.2, delay: 1.8, // ms
    wIn: 70, // 感覚入力 1 発あたりの重み mV（Shiu の Poisson 入力 0.275 × 250 に相当）
    tauTrace: 80, // 発火率推定の時定数 ms（読み出し用。モデルの一部ではない）
    tauFlash: 30, // 可視化用
  };

  class Brain {
    // opts.dt: ms, opts.seed, opts.lesion: (projection) => true なら取り除く
    constructor(circuit, opts = {}) {
      this.circuit = circuit;
      this.P = Object.assign({}, PARAMS, opts.params);
      this.dt = opts.dt || 0.5;
      this.rng = FM.mulberry32(opts.seed ?? 1);

      // ---- ニューロンを並べる ----
      this.pops = [];
      this.popById = {};
      let N = 0;
      for (const p of circuit.populations) {
        const perCol = p.cols ? p.n / p.cols : p.n;
        const rec = Object.assign({}, p, { offset: N, perCol });
        this.pops.push(rec);
        this.popById[p.id] = rec;
        N += p.n;
      }
      this.N = N;
      this.v = new Float32Array(N).fill(this.P.v0);
      this.g = new Float32Array(N);
      this.refr = new Float32Array(N);
      this.rate = new Float32Array(N); // 外からの Poisson 入力 Hz
      this.trace = new Float32Array(N); // 推定発火率 Hz
      this.flash = new Float32Array(N); // 可視化用 0..1
      this.popOf = new Int32Array(N);
      this.pops.forEach((p, k) => this.popOf.fill(k, p.offset, p.offset + p.n));

      // ---- 結合を展開して CSR にする ----
      const pre = [], post = [], w = [];
      const W = circuit.meta.w_syn_mV;
      this.activeProj = [];
      for (const pr of circuit.projections) {
        if (opts.lesion && opts.lesion(pr)) continue;
        const A = this.popById[pr.from], B = this.popById[pr.to];
        if (!A || !B) throw new Error(`unknown population in projection ${pr.from}→${pr.to}`);
        const sign = NT_SIGN[pr.nt] ?? 1;
        const base = W * pr.syn * sign;
        const add = (a, b, f) => {
          if (f <= 0) return;
          if (pr.p < 1 && this.rng() >= pr.p) return;
          pre.push(A.offset + a); post.push(B.offset + b); w.push(base * f);
        };
        const col = (P, i) => Math.floor(i / P.perCol);
        if (pr.pattern === "explicit") {
          for (const [a, b, syn] of pr.edges) {
            pre.push(A.offset + a); post.push(B.offset + b); w.push(W * syn * sign);
          }
        } else {
          for (let a = 0; a < A.n; a++) for (let b = 0; b < B.n; b++) {
            if (pr.pattern === "all") add(a, b, 1);
            else if (pr.pattern === "col") { if (col(A, a) === col(B, b)) add(a, b, 1); }
            else if (pr.pattern === "col_neighbor") { if (Math.abs(col(A, a) - col(B, b)) === 1) add(a, b, 1); }
            else if (pr.pattern === "azimuth") add(a, b, azimuthWeight(pr.wfun, col(A, a), circuit));
            else throw new Error(`unknown pattern ${pr.pattern}`);
          }
        }
        this.activeProj.push(pr);
      }
      const order = pre.map((_, i) => i).sort((i, j) => pre[i] - pre[j]);
      this.synStart = new Int32Array(N + 1);
      this.synPost = new Int32Array(order.length);
      this.synW = new Float32Array(order.length);
      order.forEach((k, i) => { this.synPost[i] = post[k]; this.synW[i] = w[k]; this.synStart[pre[k] + 1]++; });
      for (let i = 0; i < N; i++) this.synStart[i + 1] += this.synStart[i];
      this.nSyn = order.length;

      // 伝達遅延はリングバッファで表す
      this.D = Math.max(1, Math.round(this.P.delay / this.dt));
      this.ring = Array.from({ length: this.D + 1 }, () => new Float32Array(N));
      this.t = 0; // step
      this.spikesLastStep = 0;

      this.decSyn = Math.exp(-this.dt / this.P.tauSyn);
      this.decTrace = Math.exp(-this.dt / this.P.tauTrace);
      this.decFlash = Math.exp(-this.dt / this.P.tauFlash);
      this.traceInc = 1000 / this.P.tauTrace;
    }

    // 集団への入力率を設定する。values が配列なら列ごと（cols を持つ集団）
    setRate(popId, values) {
      const p = this.popById[popId];
      if (!p) return;
      for (let i = 0; i < p.n; i++) {
        this.rate[p.offset + i] = Array.isArray(values) || ArrayBuffer.isView(values)
          ? values[Math.floor(i / p.perCol)] : values;
      }
    }

    popRate(popId) {
      const p = this.popById[popId];
      let s = 0;
      for (let i = 0; i < p.n; i++) s += this.trace[p.offset + i];
      return s / p.n;
    }

    // 列ごとの平均発火率
    colRates(popId) {
      const p = this.popById[popId];
      const out = new Float32Array(p.cols);
      for (let i = 0; i < p.n; i++) out[Math.floor(i / p.perCol)] += this.trace[p.offset + i] / p.perCol;
      return out;
    }

    step() {
      const { N, v, g, refr, rate, trace, flash, P, dt } = this;
      const inbox = this.ring[this.t % this.ring.length];
      const outbox = this.ring[(this.t + this.D) % this.ring.length];
      const pIn = dt / 1000;
      let nSp = 0;
      for (let i = 0; i < N; i++) {
        g[i] += inbox[i]; inbox[i] = 0;
        if (rate[i] > 0 && this.rng() < rate[i] * pIn) g[i] += P.wIn;
        trace[i] *= this.decTrace;
        flash[i] *= this.decFlash;
        if (refr[i] > 0) { refr[i] -= dt; continue; }
        v[i] += (dt * (P.v0 - v[i] + g[i])) / P.tauM;
        g[i] *= this.decSyn;
        if (v[i] > P.vTh) {
          v[i] = P.vReset; g[i] = 0; refr[i] = P.tRef;
          trace[i] += this.traceInc; flash[i] = 1; nSp++;
          for (let k = this.synStart[i], e = this.synStart[i + 1]; k < e; k++) outbox[this.synPost[k]] += this.synW[k];
        }
      }
      this.t++;
      this.spikesLastStep = nSp;
    }

    run(ms) {
      const n = Math.round(ms / this.dt);
      let sp = 0;
      for (let k = 0; k < n; k++) { this.step(); sp += this.spikesLastStep; }
      return sp;
    }
  }

  // 列 c（0 = 正面寄り、cols-1 = 真後ろ寄り）から視覚投射への入り方
  function azimuthWeight(wfun, c, circuit) {
    const az = (c + 0.5) * circuit.colDeg; // deg
    if (wfun === "lateral") return Math.min(1, Math.max(0.1, az / 70));
    if (wfun === "front") return Math.max(0, 1 - az / 60);
    throw new Error(`unknown wfun ${wfun}`);
  }

  FM.Brain = Brain;
  FM.BRAIN_PARAMS = PARAMS;
})();
