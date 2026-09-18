// 音（表現レイヤ）
//
// Web Audio だけで鳴らす、オリジナルの夜のスウィング。既存曲の旋律は使っていない。
// コード進行はジャズで広く使われる ii–V–I の連なり（進行そのものは誰のものでもない）。
//
// ハエの脳とつながっている：
//   発火の総量   → ビブラフォンの即興の音数、フィルタの開き、ディレイとリバーブの深さ
//   DNa02 の左右 → 旋律が上がるか下がるか、左右の定位
//   DNp09（推力）→ 音の強さ
//   GF の発火    → シンバルのクラッシュと、ディレイの渦
//   月との距離   → 弦のパッドが近づくほど満ちてくる
(function () {
  const FM = (window.FM = window.FM || {});

  const QUALITY = {
    maj7: { chord: [4, 7, 11, 14], scale: [0, 2, 4, 7, 9, 11] },
    m7: { chord: [3, 7, 10, 14], scale: [0, 2, 3, 5, 7, 9, 10] },
    dom7: { chord: [4, 10, 14, 21], scale: [0, 2, 4, 7, 9, 10] },
    b9: { chord: [4, 10, 13, 19], scale: [0, 1, 4, 7, 8, 10] },
    sus: { chord: [5, 10, 14, 19], scale: [0, 2, 5, 7, 9, 10] },
  };
  // 変ホ長調の 16 小節（1 小節 1 コード）。根音は MIDI
  const PROG = [
    [51, "maj7"], [48, "m7"], [53, "m7"], [46, "dom7"],
    [55, "m7"], [48, "b9"], [53, "m7"], [46, "dom7"],
    [56, "maj7"], [49, "dom7"], [55, "m7"], [48, "b9"],
    [53, "m7"], [46, "sus"], [51, "maj7"], [46, "dom7"],
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class Jazz {
    constructor() {
      this.on = false;
      this.muted = false;
      this.bpm = 104;
      this.density = 0;
      this.turn = 0;
      this.thrust = 0;
      this.moon = 0;
      this.melodyStep = 7;
    }

    start() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.75;
      this.tone = ctx.createBiquadFilter(); this.tone.type = "lowpass"; this.tone.frequency.value = 2500; this.tone.Q.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      this.tone.connect(this.master); this.master.connect(comp); comp.connect(ctx.destination);

      // リバーブ（減衰するノイズで作ったインパルス応答）
      this.verb = ctx.createConvolver();
      const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.verb.buffer = ir;
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.3;
      this.verbSend.connect(this.verb); this.verb.connect(this.tone);

      // 付点 8 分のディレイ
      const beat = 60 / this.bpm;
      this.delay = ctx.createDelay(2); this.delay.delayTime.value = beat * 0.75;
      this.fb = ctx.createGain(); this.fb.gain.value = 0.35;
      const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
      this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.15;
      this.delaySend.connect(this.delay); this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay);
      dl.connect(this.tone);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      // 月のパッド（ずっと鳴らしておいて、音量だけ変える）
      this.pad = ctx.createGain(); this.pad.gain.value = 0;
      const pf = ctx.createBiquadFilter(); pf.type = "lowpass"; pf.frequency.value = 900;
      this.pad.connect(pf); pf.connect(this.tone); pf.connect(this.verbSend);
      this.padOsc = [0, 7, 16, 23].map((iv, k) => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(51 + iv); o.detune.value = (k - 1.5) * 6;
        const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(this.pad); o.start();
        return o;
      });

      this.bar = 0; this.beatIdx = 0;
      this.next = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
      this.on = true;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
      return this.muted;
    }

    // 毎フレーム：脳と世界の状態を受け取る
    update({ spikesPerSec = 0, turn = 0, thrust = 0, moon = 0, gf = false }) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // ふつうに飛んでいるだけで 2〜3 万 spikes/s。それより上の「高ぶり」を音の量に変える
      const d = Math.max(0, Math.min(1, (spikesPerSec - 18000) / 50000));
      this.density += (d - this.density) * 0.05;
      this.turn = turn; this.thrust = thrust; this.moon += (moon - this.moon) * 0.03;
      this.tone.frequency.setTargetAtTime(900 + 9000 * this.density ** 0.8, t, 0.2);
      this.delaySend.gain.setTargetAtTime(0.08 + 0.4 * this.density, t, 0.3);
      this.verbSend.gain.setTargetAtTime(0.22 + 0.3 * this.density, t, 0.3);
      this.pad.gain.setTargetAtTime(0.02 + 0.35 * this.moon ** 2, t, 0.5);
      if (gf) this.crash();
    }

    schedule() {
      const beat = 60 / this.bpm;
      while (this.next < this.ctx.currentTime + 0.15) {
        this.playBeat(this.next, beat);
        this.next += beat;
        if (++this.beatIdx === 4) {
          this.beatIdx = 0; this.bar = (this.bar + 1) % PROG.length;
          const [root, q] = PROG[this.bar];
          this.padOsc.forEach((o, k) => o.frequency.setTargetAtTime(mtof(root + [0, 7, 3 + (q === "maj7" || q === "dom7" ? 1 : 0) + 12, 10 + (q === "maj7" ? 1 : 0) + 12][k]), this.next, 0.4));
        }
      }
    }

    playBeat(t, beat) {
      const b = this.beatIdx, [root, q] = PROG[this.bar], Q = QUALITY[q];
      const off = t + beat * (2 / 3); // スウィングの裏拍
      const d = this.density;

      // ウォーキングベース
      const [nRoot] = PROG[(this.bar + 1) % PROG.length];
      let n;
      if (b === 0) n = root - 12;
      else if (b === 3) n = nRoot - 12 + (Math.random() < 0.5 ? 1 : -1);
      else n = root - 12 + [0, Q.chord[0], 7, Q.chord[1] - 12][Math.floor(Math.random() * 4)];
      while (n < 34) n += 12; while (n > 50) n -= 12;
      this.bass(n, t, beat * 0.9);

      // ライド：チン、チン・チキ
      this.ride(t, b === 0 ? 0.9 : 0.6);
      if (b === 1 || b === 3) { this.ride(off, 0.45); this.chick(t); this.brush(t); }

      // コンピング（エレピ）：脳が活発なほど多く、裏拍に入る
      if (Math.random() < 0.35 + 0.4 * d && (b === 0 || b === 2)) {
        this.chord(root, Q.chord, Math.random() < 0.6 ? off : t, 0.07 + 0.08 * d);
      }

      // ビブラフォン：ハエの脳の即興
      for (const tt of [t, off]) {
        if (Math.random() < 0.05 + 0.85 * d) {
          const drift = this.turn > 0.3 ? 1 : this.turn < -0.3 ? -1 : 0;
          this.melodyStep += drift + Math.round((Math.random() - 0.5) * 3);
          this.melodyStep = Math.max(0, Math.min(16, this.melodyStep));
          const sc = Q.scale, oct = Math.floor(this.melodyStep / sc.length);
          const m = root + 12 + oct * 12 + sc[this.melodyStep % sc.length];
          this.vibes(m, tt, 0.08 + 0.12 * this.thrust, Math.max(-0.8, Math.min(0.8, -this.turn / 4)));
        }
      }
    }

    env(g, t, peak, a, dcy) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
    }

    bass(m, t, dur) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m);
      f.type = "lowpass"; f.frequency.value = 700;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.tone);
      this.env(g, t, 0.32, 0.01, dur);
      o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }

    noiseHit(t, type, freq, q, peak, dcy, dest = this.tone) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
      s.connect(f); f.connect(g); g.connect(dest);
      this.env(g, t, peak, 0.002, dcy);
      s.start(t, Math.random()); s.stop(t + dcy + 0.05);
      return g;
    }
    ride(t, v) { this.noiseHit(t, "bandpass", 7800, 1.2, 0.05 * v, 0.45); }
    chick(t) { this.noiseHit(t, "highpass", 7000, 0.7, 0.03, 0.05); }
    brush(t) { this.noiseHit(t, "bandpass", 1800, 0.6, 0.025, 0.22); }

    crash() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const g = this.noiseHit(t, "highpass", 4000, 0.5, 0.18, 2.2);
      g.connect(this.delaySend); g.connect(this.verbSend);
      this.fb.gain.cancelScheduledValues(t);
      this.fb.gain.setValueAtTime(0.72, t);
      this.fb.gain.setTargetAtTime(0.35, t + 0.8, 0.6);
    }

    chord(root, iv, t, v) {
      for (const k of iv) this.epiano(root + k, t, v, 0);
    }

    epiano(m, t, v, pan) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(), p = c.createStereoPanner();
      o.type = "sine"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m) * 3.01; g2.gain.value = 0.18;
      o2.connect(g2); g2.connect(g); o.connect(g); g.connect(p); p.pan.value = pan;
      p.connect(this.tone); p.connect(this.verbSend);
      this.env(g, t, v, 0.006, 1.4);
      o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
    }

    vibes(m, t, v, pan) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), trem = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), p = c.createStereoPanner();
      o.type = "sine"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m) * 4; const g2 = c.createGain(); g2.gain.value = 0.06;
      lfo.frequency.value = 5.5; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(trem.gain); trem.gain.value = 0.65;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(trem); trem.connect(p); p.pan.value = pan;
      p.connect(this.tone); p.connect(this.delaySend); p.connect(this.verbSend);
      this.env(g, t, v, 0.003, 1.6);
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + 1.7); }
    }

    // 出来事の効果音
    sfx(type) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, [root] = PROG[this.bar];
      if (type === "clear") [0, 4, 7, 11, 14, 19, 23].forEach((k, i) => this.vibes(root + 12 + k, t + i * 0.09, 0.2, (i / 3) - 1));
      if (type === "eat") [7, 12].forEach((k, i) => this.vibes(root + 12 + k, t + i * 0.07, 0.15, 0));
      if (type === "dead") {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = "triangle"; o.frequency.setValueAtTime(mtof(root + 24), t); o.frequency.exponentialRampToValueAtTime(mtof(root - 12), t + 0.9);
        o.connect(g); g.connect(this.tone); g.connect(this.verbSend); this.env(g, t, 0.15, 0.01, 0.9); o.start(t); o.stop(t + 1);
      }
      if (type === "slam") this.noiseHit(t, "lowpass", 600, 0.8, 0.35, 0.25);
      if (type === "zap") this.noiseHit(t, "bandpass", 3000, 4, 0.2, 0.4);
      if (type === "stuck") this.noiseHit(t, "lowpass", 300, 1, 0.2, 0.3);
    }
  }

  FM.Jazz = Jazz;
})();
