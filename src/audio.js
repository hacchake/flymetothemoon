// 音（表現レイヤ）
//
// Web Audio だけで鳴らす、オリジナルの夜の音楽。既存曲の旋律は使っていない。
// コード進行はジャズやボサノバで広く使われる言い回しの組み合わせ（進行そのものは誰のものでもない）。
// 各曲の主題メロディーは、曲名をもとにした乱数から毎回同じものを作曲する（composeHead）。
// 曲は「主題 → アドリブ → アドリブ → 主題 …」と進む。
//
// ハエの脳とつながっている：
//   発火の総量   → ビブラフォンの即興の音数、フィルタの開き、ディレイとリバーブの深さ
//   DNa02 の左右 → 即興の旋律が上がるか下がるか、左右の定位
//   DNp09（推力）→ 旋律とドラムの強さ
//   GF の逃避    → シンバルのクラッシュと、ディレイの渦
// 世界とつながっている：
//   ハエの高度   → 旋律の音域、パッドの明るさ
//   月との距離   → パッドが満ちてくる
//   危なさ       → パッドに半音の濁りと、低い鼓動
//   カーソル     → 動かすとキラキラした音が降る（左右 = 定位、上下 = 音の高さ）
//   ランタン     → 灯している間、高い和音がふるえる
(function () {
  const FM = (window.FM = window.FM || {});

  const Q = {
    maj7: { chord: [4, 7, 11, 14], scale: [0, 2, 4, 7, 9, 11] },
    maj7s11: { chord: [4, 11, 14, 18], scale: [0, 2, 4, 6, 7, 9, 11] },
    six: { chord: [4, 9, 14, 16], scale: [0, 2, 4, 7, 9] },
    m7: { chord: [3, 7, 10, 14], scale: [0, 2, 3, 5, 7, 9, 10] },
    m9: { chord: [3, 10, 14, 17], scale: [0, 2, 3, 5, 7, 9, 10] },
    m7b5: { chord: [3, 6, 10, 15], scale: [0, 1, 3, 5, 6, 8, 10] },
    dom7: { chord: [4, 10, 14, 21], scale: [0, 2, 4, 7, 9, 10] },
    b9: { chord: [4, 10, 13, 19], scale: [0, 1, 4, 7, 8, 10] },
    sus: { chord: [5, 10, 14, 19], scale: [0, 2, 5, 7, 9, 10] },
  };

  // 1 小節 = [[根音 MIDI, 和音の種類], (2 つめの和音)]。lead は主題を吹く楽器
  const b = (...chords) => chords;
  FM.SONGS = {
    swing: {
      name: "Moonlight Swing", bpm: 104, meter: 4, feel: "swing", lead: "horn",
      bars: [b([51, "maj7"]), b([48, "m7"]), b([53, "m7"]), b([46, "dom7"]), b([55, "m7"]), b([48, "b9"]), b([53, "m7"]), b([46, "dom7"]),
        b([56, "maj7"]), b([49, "dom7"]), b([55, "m7"]), b([48, "b9"]), b([53, "m7"]), b([46, "sus"]), b([51, "maj7"]), b([46, "dom7"])],
    },
    ballad: {
      name: "Streetlight Ballad", bpm: 66, meter: 4, feel: "ballad", lead: "flugel",
      bars: [b([49, "maj7"]), b([46, "m7"]), b([51, "m7"]), b([56, "sus"]), b([53, "m7"]), b([46, "dom7"]), b([51, "m9"]), b([56, "dom7"]),
        b([54, "maj7s11"]), b([53, "m7"]), b([51, "m7"], [56, "dom7"]), b([49, "maj7"]), b([48, "m7b5"]), b([53, "b9"]), b([46, "m9"]), b([56, "sus"])],
    },
    bossa: {
      name: "Lunar Bossa", bpm: 128, meter: 4, feel: "bossa", lead: "flute",
      bars: [b([50, "m9"]), b([51, "maj7s11"]), b([50, "m9"]), b([51, "maj7s11"]), b([55, "m9"]), b([45, "b9"]), b([50, "m9"]), b([45, "b9"]),
        b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"]), b([50, "m9"]), b([48, "dom7"]), b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"])],
    },
    lounge: {
      name: "UFO Lounge", bpm: 96, meter: 4, feel: "lounge", lead: "synth",
      bars: [b([52, "m9"]), b([45, "dom7"]), b([52, "m9"]), b([45, "dom7"]), b([48, "maj7"]), b([47, "b9"]), b([52, "m9"]), b([47, "b9"])],
    },
    bop: {
      name: "Swatter Bop", bpm: 200, meter: 4, feel: "swing", busy: true, lead: "horn",
      bars: [b([53, "six"], [50, "b9"]), b([55, "m7"], [48, "dom7"]), b([53, "six"], [50, "b9"]), b([55, "m7"], [48, "dom7"]),
        b([48, "m7"], [53, "dom7"]), b([46, "maj7"], [51, "dom7"]), b([45, "m7"], [50, "b9"]), b([55, "m7"], [48, "dom7"])],
    },
    waltz: {
      name: "Satellite Waltz", bpm: 150, meter: 3, feel: "waltz", lead: "vibes",
      bars: [b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"]), b([50, "m9"]), b([55, "m7"]), b([48, "dom7"]), b([53, "maj7"]), b([48, "sus"]),
        b([46, "maj7"]), b([46, "m7"]), b([45, "m7"]), b([50, "b9"]), b([55, "m9"]), b([48, "dom7"]), b([53, "six"]), b([48, "sus"])],
    },
    witching: {
      name: "Witching Hour", bpm: 84, meter: 4, feel: "swing", soft: true, lead: "celesta",
      bars: [b([45, "m9"]), b([50, "m9"]), b([45, "m9"]), b([53, "maj7s11"]), b([47, "m7b5"]), b([52, "b9"]), b([45, "m9"]), b([52, "b9"])],
    },
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pc = (m) => ((m % 12) + 12) % 12;
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const chordAt = (song, bar, beat) => {
    const cs = song.bars[((bar % song.bars.length) + song.bars.length) % song.bars.length];
    return cs.length === 1 || beat < song.meter / 2 ? cs[0] : cs[1];
  };
  // 集合 set（音名）のうち、target に最も近い音
  const nearest = (target, set) => { for (let d = 0; d < 12; d++) { if (set.has(pc(target + d))) return target + d; if (set.has(pc(target - d))) return target - d; } return target; };
  const clampLead = (n) => { while (n > 82) n -= 12; while (n < 62) n += 12; return n; };

  // ---- 主題の作曲：2 小節の動機を繰り返し・変形し、8 小節ごとに終止する ----
  function composeHead(song) {
    const rng = FM.mulberry32(hashStr(song.name));
    const m3 = song.meter === 3;
    const R = m3
      ? [[[0, 1], [1, 1], [2, 1]], [[0, 2], [2, 1]], [[0, 1.5], [1.5, 0.5], [2, 1]], [[0.5, 0.5], [1, 1], [2, 1]]]
      : song.feel === "ballad"
        ? [[[0, 2], [2, 1], [3, 1]], [[0, 1.5], [1.5, 0.5], [2, 2]], [[1, 1], [2, 2]], [[0, 3], [3, 1]]]
        : [[[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]], [[0.5, 0.5], [1, 1], [2, 0.5], [2.5, 1.5]], [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
          [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 2]], [[1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 3], [3, 1]]];
    const motif = () => { const r = R[Math.floor(rng() * R.length)]; return { r, dirs: r.map(() => (rng() < 0.5 ? -1 : 1) * (rng() < 0.7 ? 1 : 2)) }; };
    const A1 = motif(), A2 = motif(), B1 = motif(), B2 = motif(), C1 = motif(), C2 = motif();
    const plan = [A1, A2, A1, A2, B1, B2, C1, null], plan2 = [A1, A2, A1, A2, C2, B1, B2, null];
    const head = [];
    let prev = 72;
    for (let bar = 0; bar < song.bars.length; bar++) {
      const mo = (Math.floor(bar / 8) % 2 ? plan2 : plan)[bar % 8];
      const notes = [];
      if (!mo) { // 終止：和音の根音か 3 度に長く落ち着く
        const [root, q] = chordAt(song, bar, 0);
        const n = clampLead(nearest(prev, new Set([pc(root), pc(root + Q[q].chord[0])])));
        notes.push([0, n, song.meter - 0.5]);
        prev = n;
      } else {
        mo.r.forEach(([pos, dur], k) => {
          const [root, q] = chordAt(song, bar, pos);
          const chordSet = new Set([0, ...Q[q].chord].map((x) => pc(root + x)));
          const scaleSet = new Set(Q[q].scale.map((x) => pc(root + x)));
          // 強拍と長い音は和音の音、弱拍は音階を歩く。音域の端に来たら、折り返さずに向きを変える
          const set = k === 0 || dur >= 1 || pos % 1 === 0 ? chordSet : scaleSet;
          let n = nearest(prev + mo.dirs[k] * 2, set);
          if (n > 81) n = nearest(prev - Math.abs(mo.dirs[k]) * 2, set);
          if (n < 63) n = nearest(prev + Math.abs(mo.dirs[k]) * 2, set);
          n = clampLead(n);
          notes.push([pos, n, dur * 0.92]);
          prev = n;
        });
      }
      head.push(notes);
    }
    return head;
  }

  class Jazz {
    constructor() {
      this.muted = false;
      this.song = FM.SONGS.swing;
      this.pending = null;
      this.density = 0;
      this.turn = 0; this.thrust = 0; this.moon = 0; this.alt = 0; this.tension = 0;
      this.cursorE = 0; this.cursor = { x: 0.5, y: 0.5 };
      this.lamp = false;
      this.melodyStep = 7;
      this.heads = new Map();
      this.voiceCenter = 62;
    }

    get songName() { return this.song.name; }

    // 曲を替える（次の小節の頭で切り替わる）
    setSong(id) {
      const s = FM.SONGS[id] || FM.SONGS.swing;
      if (s === this.song && !this.pending) return;
      if (!this.ctx) { this.song = s; return; }
      this.pending = s;
    }

    start() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      // 仕上げ：ローパス → 音量 → コンプ → リミッター
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
      this.tone = ctx.createBiquadFilter(); this.tone.type = "lowpass"; this.tone.frequency.value = 2500; this.tone.Q.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
      this.tone.connect(this.master); this.master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
      // ドラムはローパスを通さず、別の束で（シンバルがこもらないように）
      this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.9; this.drumBus.connect(this.master);

      // リバーブ：左右で別の減衰ノイズ（広がり）＋初期反射
      this.verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
        for (const [ms, g] of [[11, 0.5], [19, 0.35], [29, 0.3], [41, 0.2]]) { const k = Math.floor((ms + ch * 3) / 1000 * ctx.sampleRate); if (k < len) d[k] += g; }
      }
      this.verb.buffer = ir;
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.3;
      this.verbSend.connect(this.verb); this.verb.connect(this.master);

      // ディレイ（曲のテンポに合わせる。少し右へ）
      this.delay = ctx.createDelay(2);
      this.fb = ctx.createGain(); this.fb.gain.value = 0.35;
      const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2600;
      const dp = ctx.createStereoPanner(); dp.pan.value = 0.35;
      this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.15;
      this.delaySend.connect(this.delay); this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay);
      dl.connect(dp); dp.connect(this.master);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      // パッド（ずっと鳴らしておき、和音と音量だけ変える）。5 つめの声は危なさの濁り
      this.pad = ctx.createGain(); this.pad.gain.value = 0;
      this.padF = ctx.createBiquadFilter(); this.padF.type = "lowpass"; this.padF.frequency.value = 900;
      this.pad.connect(this.padF); this.padF.connect(this.tone); this.padF.connect(this.verbSend);
      this.padVoices = [0, 1, 2, 3, 4].map((k) => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = (k - 2) * 7;
        const pn = ctx.createStereoPanner(); pn.pan.value = (k - 2) * 0.3;
        const g = ctx.createGain(); g.gain.value = k === 4 ? 0 : 0.045; o.connect(g); g.connect(pn); pn.connect(this.pad); o.start();
        return { o, g };
      });
      // ランタンのきらめき（高い和音がふるえる）
      this.shimmer = ctx.createGain(); this.shimmer.gain.value = 0;
      const trem = ctx.createGain(); trem.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(trem.gain); lfo.start();
      this.shimmer.connect(trem); trem.connect(this.tone); trem.connect(this.verbSend); trem.connect(this.delaySend);
      this.shimVoices = [0, 1, 2].map(() => { const o = ctx.createOscillator(); o.type = "sine"; o.connect(this.shimmer); o.start(); return o; });

      this.kit = {};
      this.buildKit().catch((e) => console.warn("ドラムを作れませんでした", e));
      this.bar = 0; this.beatIdx = 0; this.chorus = 0;
      this.next = ctx.currentTime + 0.1;
      this.applySong();
      this.timer = setInterval(() => this.schedule(), 25);
    }

    // ---- ドラム：起動時に一度だけ合成して録音しておく ----
    async buildKit() {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return;
      const sr = this.ctx.sampleRate;
      const render = (dur, fn) => { const oc = new OAC(1, Math.ceil(sr * dur), sr); fn(oc, oc.destination); return oc.startRendering(); };
      const noise = (oc, dur) => { const bf = oc.createBuffer(1, Math.ceil(sr * dur), sr), d = bf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = oc.createBufferSource(); s.buffer = bf; return s; };
      const env = (g, peak, a, dcy) => { g.gain.setValueAtTime(0.0001, 0); g.gain.linearRampToValueAtTime(peak, a); g.gain.exponentialRampToValueAtTime(0.0001, a + dcy); };
      const filt = (oc, type, f, q = 0.7) => { const x = oc.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
      // 金属音：音程のずれた矩形波を 6 本重ねる（シンバルの定番の作り方）
      const metal = (oc, dest, base, dur) => { for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const o = oc.createOscillator(); o.type = "square"; o.frequency.value = base * r; o.connect(dest); o.start(0); o.stop(dur); } };
      const cymbal = (dur, base, hp, peak, dcy, nPeak) => render(dur, (oc, out) => {
        const g = oc.createGain(); env(g, peak, 0.001, dcy);
        const f1 = filt(oc, "highpass", hp), f2 = filt(oc, "bandpass", 9000, 0.5);
        const mix = oc.createGain(); mix.gain.value = 0.25;
        metal(oc, mix, base, dur); mix.connect(f1);
        const n = noise(oc, dur), ng = oc.createGain(); ng.gain.value = nPeak; n.connect(ng); ng.connect(f1); n.start(0);
        f1.connect(f2); f2.connect(g); g.connect(out);
      });
      const K = {};
      [K.ride, K.hat, K.pedal, K.crash] = await Promise.all([
        cymbal(1.7, 430, 5200, 0.9, 1.5, 0.35), cymbal(0.14, 470, 7500, 0.8, 0.06, 0.6),
        cymbal(0.12, 470, 6500, 0.5, 0.045, 0.5), cymbal(3.2, 360, 3200, 1.0, 2.9, 0.9),
      ]);
      K.kick = await render(0.55, (oc, out) => {
        const o = oc.createOscillator(), g = oc.createGain();
        o.frequency.setValueAtTime(118, 0); o.frequency.exponentialRampToValueAtTime(42, 0.16);
        env(g, 1, 0.002, 0.45); o.connect(g); g.connect(out); o.start(0);
        const n = noise(oc, 0.02), f = filt(oc, "lowpass", 3000), ng = oc.createGain(); ng.gain.value = 0.1; n.connect(f); f.connect(ng); ng.connect(out); n.start(0);
      });
      K.snare = await render(0.35, (oc, out) => {
        const n = noise(oc, 0.35), f = filt(oc, "bandpass", 1900, 0.8), g = oc.createGain(); env(g, 0.8, 0.001, 0.2); n.connect(f); f.connect(g); g.connect(out); n.start(0);
        const o = oc.createOscillator(), og = oc.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(190, 0); o.frequency.exponentialRampToValueAtTime(150, 0.1);
        env(og, 0.5, 0.001, 0.12); o.connect(og); og.connect(out); o.start(0);
      });
      K.brush = await render(0.4, (oc, out) => { const n = noise(oc, 0.4), f = filt(oc, "bandpass", 2800, 0.5), g = oc.createGain(); env(g, 0.5, 0.03, 0.3); n.connect(f); f.connect(g); g.connect(out); n.start(0); });
      K.rim = await render(0.1, (oc, out) => {
        const o = oc.createOscillator(), g = oc.createGain(), f = filt(oc, "bandpass", 1700, 5); o.type = "triangle"; o.frequency.value = 1650;
        env(g, 0.9, 0.0005, 0.045); o.connect(f); f.connect(g); g.connect(out); o.start(0);
        const n = noise(oc, 0.03), ng = oc.createGain(); env(ng, 0.3, 0.0005, 0.02); n.connect(ng); ng.connect(out); n.start(0);
      });
      K.shaker = await render(0.14, (oc, out) => { const n = noise(oc, 0.14), f = filt(oc, "highpass", 6500), g = oc.createGain(); env(g, 0.5, 0.02, 0.08); n.connect(f); f.connect(g); g.connect(out); n.start(0); });
      K.tom = await render(0.5, (oc, out) => {
        const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(130, 0); o.frequency.exponentialRampToValueAtTime(92, 0.3);
        env(g, 0.9, 0.002, 0.4); o.connect(g); g.connect(out); o.start(0);
      });
      K.clap = await render(0.3, (oc, out) => {
        const n = noise(oc, 0.3), f = filt(oc, "bandpass", 1300, 1.2), g = oc.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        for (const t0 of [0, 0.012, 0.024]) { g.gain.linearRampToValueAtTime(0.8, t0 + 0.001); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.011); }
        g.gain.exponentialRampToValueAtTime(0.0001, 0.25);
        n.connect(f); f.connect(g); g.connect(out); n.start(0);
      });
      // 楽器ごとの大きさにそろえる（ピーク）。シンバルは高い音なので、小さくても耳に刺さる
      const LEVEL = { kick: 0.8, tom: 0.6, snare: 0.5, clap: 0.4, rim: 0.4, brush: 0.35, crash: 0.32, ride: 0.3, hat: 0.3, pedal: 0.25, shaker: 0.25 };
      for (const [name, peak] of Object.entries(LEVEL)) {
        const d = K[name].getChannelData(0);
        let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
        if (m > 0) { const f = peak / m; for (let i = 0; i < d.length; i++) d[i] *= f; }
      }
      this.kit = K;
    }

    // ドラムを鳴らす（まだ録音できていなければ、軽い代わりの音）
    drum(name, t, v, pan = 0, rate = 1) {
      const bf = this.kit && this.kit[name];
      const tt = t + (Math.random() - 0.5) * 0.006; // ほんの少しの揺れ
      if (!bf) { this.noiseHit(tt, "highpass", 6000, 0.7, 0.03 * v, 0.1); return; }
      const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner();
      s.buffer = bf; s.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 0.02);
      g.gain.value = v * (0.9 + Math.random() * 0.2); p.pan.value = pan;
      s.connect(g); g.connect(p); p.connect(this.drumBus);
      if (name === "crash" || name === "ride") p.connect(this.verbSend);
      s.start(Math.max(tt, c.currentTime));
    }

    applySong() {
      const beat = 60 / this.song.bpm;
      this.delay.delayTime.setTargetAtTime(Math.min(1.9, beat * 0.75), this.ctx.currentTime, 0.1);
      this.bar = 0; this.beatIdx = 0; this.chorus = 0;
      if (!this.heads.has(this.song)) this.heads.set(this.song, composeHead(this.song));
      this.setChord(chordAt(this.song, 0, 0), this.next);
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
      return this.muted;
    }

    // 毎フレーム：脳と世界とプレイヤーの状態を受け取る
    update({ spikesPerSec = 0, turn = 0, thrust = 0, moon = 0, alt = 0, tension = 0, cursor = null, lamp = false, dt = 1 / 60 }) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // 数でない値が一度でも入ると、なめらかにした値がずっと NaN になって音が止まる。入口で弾く
      const fin = (x, d = 0) => (Number.isFinite(x) ? x : d);
      spikesPerSec = fin(spikesPerSec); turn = fin(turn); thrust = fin(thrust); moon = fin(moon); alt = fin(alt); tension = fin(tension);
      dt = Math.max(0, Math.min(0.25, fin(dt, 1 / 60)));
      for (const k of ["density", "moon", "alt", "tension", "cursorE"]) if (!Number.isFinite(this[k])) this[k] = 0;
      // ふつうに飛んでいるだけで 2〜3 万 spikes/s。それより上の「高ぶり」を音の量に変える
      const d = Math.max(0, Math.min(1, (spikesPerSec - 18000) / 50000));
      const k = Math.min(1, dt * 3);
      this.density += (d - this.density) * k;
      this.turn = turn; this.thrust = thrust;
      this.moon += (moon - this.moon) * k * 0.6;
      this.alt += (alt - this.alt) * k;
      this.tension += (tension - this.tension) * k;
      if (cursor) {
        this.cursor = cursor;
        this.cursorE = Math.min(1.5, this.cursorE * Math.pow(0.2, dt) + Math.min(1, fin(cursor.speed) / 1500) * dt * 6);
      } else this.cursorE *= Math.pow(0.2, dt);
      this.lamp = lamp;

      this.tone.frequency.setTargetAtTime(1200 + 9000 * this.density ** 0.8, t, 0.2);
      this.delaySend.gain.setTargetAtTime(0.08 + 0.4 * this.density, t, 0.3);
      this.verbSend.gain.setTargetAtTime(0.2 + 0.3 * this.density, t, 0.3);
      this.pad.gain.setTargetAtTime(0.02 + 0.3 * this.moon ** 2 + 0.08 * this.tension, t, 0.5);
      this.padF.frequency.setTargetAtTime(600 + 2200 * this.alt + 800 * this.tension, t, 0.4);
      this.padVoices[4].g.gain.setTargetAtTime(0.06 * this.tension, t, 0.3);
      this.shimmer.gain.setTargetAtTime(lamp ? 0.035 : 0, t, lamp ? 0.08 : 0.4);
    }

    chordAt(bar, beat) { return chordAt(this.song, bar, beat); }

    setChord([root, q], t) {
      const iv = Q[q].chord;
      const voicing = [0, iv[0], iv[1], iv[2]];
      this.padVoices.forEach((v, k) => {
        const m = k < 4 ? root + 12 + voicing[k] : root + 13 + 12; // 5 つめ：半音上の濁り
        v.o.frequency.setTargetAtTime(mtof(m), t, 0.3);
      });
      this.shimVoices.forEach((o, k) => o.frequency.setTargetAtTime(mtof(root + 36 + [iv[0], iv[1], iv[3] || iv[2]][k]), t, 0.1));
    }

    schedule() {
      while (this.next < this.ctx.currentTime + 0.15) {
        const beat = 60 / this.song.bpm;
        this.playBeat(this.next, beat);
        this.next += beat;
        if (++this.beatIdx >= this.song.meter) {
          this.beatIdx = 0;
          if (this.pending) { this.song = this.pending; this.pending = null; this.applySong(); continue; }
          this.bar = (this.bar + 1) % this.song.bars.length;
          if (this.bar === 0) this.chorus++;
        }
        const c = this.chordAt(this.bar, this.beatIdx);
        if (c !== this.lastChord) { this.setChord(c, this.next); this.lastChord = c; }
      }
    }

    // 伴奏の和音：前の和音から一番近い形（転回）を選ぶ
    voicing(root, q) {
      const notes = [0, ...Q[q].chord.slice(0, 3)].map((x) => {
        let n = root + x; while (n < this.voiceCenter - 6) n += 12; while (n > this.voiceCenter + 6) n -= 12; return n;
      }).sort((a, b) => a - b);
      const c = notes.reduce((s, x) => s + x, 0) / notes.length;
      this.voiceCenter += (Math.max(55, Math.min(68, c)) - this.voiceCenter) * 0.5;
      return notes;
    }

    playBeat(t, beat) {
      const S = this.song, bi = this.beatIdx, [root, q] = this.chordAt(this.bar, bi), C = Q[q];
      const [nRoot] = this.chordAt(this.bar + (bi === S.meter - 1 ? 1 : 0), (bi + 1) % S.meter);
      const d = this.density, drive = 0.6 + 0.7 * this.thrust;
      const soft = S.soft ? 0.6 : 1;
      const isHead = this.chorus % 3 === 0;
      const phraseEnd = this.bar % 8 === 7, phraseStart = this.bar % 8 === 0 && bi === 0;
      const swingOff = t + beat * (2 / 3);
      const hum = () => (Math.random() - 0.5) * 0.012;

      // 8 小節ごとの区切り：頭にクラッシュ、終わりにフィル
      if (phraseStart && (this.bar > 0 || this.chorus > 0)) this.drum("crash", t, 0.4 * soft, 0.3);
      if (phraseEnd && bi >= S.meter - 2 && S.feel !== "ballad") this.fill(t, beat, bi, S);

      if (S.feel === "swing") {
        let n;
        if (bi === 0) n = root - 12;
        else if (bi === S.meter - 1) n = nRoot - 12 + (Math.random() < 0.5 ? 1 : -1);
        else n = root - 12 + [0, C.chord[0], 7, C.chord[1] - 12, 9][Math.floor(Math.random() * 5)];
        this.upright(fitBass(n), t, beat * 0.95, 1);
        if (Math.random() < 0.15) this.upright(fitBass(n + (Math.random() < 0.5 ? 2 : -1)), swingOff, beat * 0.3, 0.5); // 装飾音
        this.drum("ride", t, (bi === 0 ? 0.55 : 0.4) * drive * soft, 0.25);
        if (bi % 2 === 1) { this.drum("ride", swingOff, 0.3 * drive * soft, 0.25); this.drum("pedal", t, 0.5, -0.2); this.drum("brush", t, 0.25 * soft, -0.1); }
        if (bi === 0 && Math.random() < 0.3) this.drum("kick", t, 0.25);
        if (S.busy && Math.random() < 0.35 * drive) this.drum("snare", swingOff, 0.12, -0.1);
        if (Math.random() < (S.busy ? 0.5 : 0.35) + 0.4 * d && (bi % 2 === 0 || S.busy)) this.comp(root, q, Math.random() < 0.6 ? swingOff : t, (0.07 + 0.07 * d) * soft, beat * 1.2);
        this.melody(t, swingOff, beat, root, C, 2, isHead);
      } else if (S.feel === "ballad") {
        if (bi % 2 === 0) this.upright(fitBass(bi === 0 ? root - 12 : root - 5), t, beat * 1.9, 0.9);
        this.drum("brush", t, 0.3 * drive, (bi % 2 ? 0.2 : -0.2), 0.9);
        if (bi % 2 === 1) this.drum("pedal", t, 0.3, -0.2);
        const tones = this.voicing(root, q);
        for (let k = 0; k < 2; k++) this.rhodes(tones[(bi * 2 + k) % tones.length] + 12, t + (k * beat) / 2 + hum(), 0.05 + 0.03 * d, k ? 0.3 : -0.3, beat * 1.5);
        this.melody(t, t + beat / 2, beat, root, C, 1, isHead);
      } else if (S.feel === "bossa") {
        const e = beat / 2;
        if (bi === 0) this.upright(fitBass(root - 12), t, beat * 1.4, 1);
        if (bi === 1) this.upright(fitBass(root - 5), t + e, beat * 0.9, 0.8);
        if (bi === 2) this.upright(fitBass(root - 5), t, beat * 0.9, 0.8);
        if (bi === 3) this.upright(fitBass(nRoot - 12), t + e, beat * 0.9, 0.8);
        for (let k = 0; k < 2; k++) this.drum("shaker", t + k * e, (k ? 0.55 : 0.3) * drive, 0.35);
        const slot = (this.bar % 2) * 8 + bi * 2;
        for (let k = 0; k < 2; k++) if ([0, 3, 6, 10, 12].includes(slot + k)) this.drum("rim", t + k * e, 0.35, -0.25);
        if (bi === 0 || bi === 2) this.drum("kick", t, 0.35);
        const comp = this.bar % 2 ? [1, 3, 6] : [0, 3, 5];
        for (let k = 0; k < 2; k++) if (comp.includes(bi * 2 + k)) this.pluckChord(this.voicing(root, q), t + k * e + hum(), 0.06 + 0.05 * d);
        this.melody(t, t + e, beat, root, C, 1, isHead);
      } else if (S.feel === "lounge") {
        const s16 = beat / 4;
        for (let k = 0; k < 4; k++) this.drum("hat", t + k * s16 + (k % 2 ? s16 * 0.12 : 0), (k === 2 ? 0.5 : 0.28) * drive, 0.3);
        if (bi === 0 || (bi === 2 && Math.random() < 0.6)) this.drum("kick", t, 0.7);
        if (bi === 2) this.drum("kick", t + beat * 0.5, 0.45);
        if (bi % 2 === 1) this.drum("clap", t, 0.35, -0.1);
        for (let k = 0; k < 2; k++) this.synthBass(fitBass(root - 12) + (k ? 12 : 0), t + (k * beat) / 2, beat * 0.4);
        if (bi === 0) this.comp(root, q, t, 0.06 + 0.06 * d, beat * 3);
        this.melody(t, t + beat / 2, beat, root, C, 1, isHead);
      } else if (S.feel === "waltz") {
        if (bi === 0) this.upright(fitBass(root - 12), t, beat * 1.4, 1);
        else if (bi === 2) this.upright(fitBass(root - 5), t, beat * 0.9, 0.8);
        if (bi > 0) this.comp(root, q, t + hum(), 0.05 + 0.05 * d, beat * 0.8);
        this.drum("ride", t, 0.4 * drive, 0.25);
        if (bi === 1) { this.drum("ride", t + beat * (2 / 3), 0.25 * drive, 0.25); this.drum("pedal", t, 0.4, -0.2); }
        this.melody(t, t + beat * (2 / 3), beat, root, C, 1, isHead);
      }

      // 主題：この拍に始まる音を、曲ごとの楽器で
      if (isHead) {
        const head = this.heads.get(S);
        const swingy = S.feel === "swing" || S.feel === "waltz";
        for (const [pos, n, dur] of head[this.bar] || []) {
          if (pos < bi || pos >= bi + 1) continue;
          let off = pos - bi;
          if (swingy && Math.abs(off - 0.5) < 0.01) off = 2 / 3;
          const up = this.alt > 0.6 && n < 74 ? 12 : 0; // 高く飛ぶと主題もオクターブ上がる
          this.lead(n + up, t + off * beat + hum(), dur * beat, 0.16 * soft * (0.85 + 0.3 * this.thrust), S.lead);
        }
      }

      // カーソルのきらめき：動かした速さぶん、16 分の格子に高い音が降る
      if (this.cursorE > 0.05) {
        for (let k = 0; k < 4; k++) {
          if (Math.random() < this.cursorE * 0.55) {
            const sc = C.scale, step = Math.floor((1 - this.cursor.y) * sc.length * 2);
            const m = root + 24 + Math.floor(step / sc.length) * 12 + sc[((step % sc.length) + sc.length) % sc.length];
            this.celesta(m, t + (k * beat) / 4, 0.05 + 0.05 * this.cursorE, this.cursor.x * 1.6 - 0.8);
          }
        }
      }
      // 危ないとき：低い鼓動
      if (this.tension > 0.55 && bi % 2 === 0) { this.drum("kick", t, 0.4 * this.tension); this.drum("kick", t + beat * 0.3, 0.22 * this.tension); }
    }

    // ドラムのフィル（区切りの小節の最後の 2 拍）
    fill(t, beat, bi, S) {
      const trip = beat / 3;
      if (S.feel === "lounge") { for (let k = 0; k < 4; k++) this.drum("snare", t + (k * beat) / 4, 0.18 + k * 0.04, 0); return; }
      if (S.feel === "bossa") { for (let k = 0; k < 3; k++) this.drum("tom", t + k * trip, 0.35, -0.3 + k * 0.3, 1.2 - bi * 0.1 - k * 0.08); return; }
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.8) this.drum(bi === S.meter - 1 && k > 0 ? "tom" : "snare", t + k * trip, 0.14 + k * 0.05, (k - 1) * 0.3, 1.1 - k * 0.1);
      }
    }

    // ビブラフォン：ハエの脳の即興。per = 1 拍あたりの機会の数。主題の間は控えめに
    melody(t, off, beat, root, C, per, isHead) {
      const d = this.density * (isHead ? 0.35 : 1);
      for (const tt of per === 2 ? [t, off] : [Math.random() < 0.5 ? t : off]) {
        if (Math.random() < (0.05 + 0.85 * d) * (per === 1 ? 1.4 : 1)) {
          const drift = this.turn > 0.3 ? 1 : this.turn < -0.3 ? -1 : 0;
          this.melodyStep += drift + Math.round((Math.random() - 0.5) * 3);
          this.melodyStep = Math.max(0, Math.min(16, this.melodyStep));
          const sc = C.scale, oct = Math.floor(this.melodyStep / sc.length) + Math.round(this.alt * 1.2);
          const m = root + 12 + oct * 12 + sc[this.melodyStep % sc.length];
          this.vibes(Math.min(96, m), tt, (0.08 + 0.12 * this.thrust) * (isHead ? 0.7 : 1), Math.max(-0.8, Math.min(0.8, -this.turn / 4)));
        }
      }
    }

    env(g, t, peak, a, dcy) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
    }

    // ---- 楽器 ----
    // ウッドベース：弦をはじく音（明るいアタックがすぐ丸くなる）
    upright(m, t, dur, v) {
      const c = this.ctx, f = mtof(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = f; o2.type = "sine"; o2.frequency.value = f;
      lp.type = "lowpass"; lp.Q.value = 1.5; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.14);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.tone);
      this.env(g, t, 0.36 * v, 0.006, dur * 1.1);
      const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
      n.buffer = this.noise; nf.type = "bandpass"; nf.frequency.value = 900;
      n.connect(nf); nf.connect(ng); ng.connect(this.tone); this.env(ng, t, 0.05 * v, 0.002, 0.03);
      n.start(t, Math.random()); n.stop(t + 0.05);
      o.start(t); o2.start(t); o.stop(t + dur * 1.2 + 0.1); o2.stop(t + dur * 1.2 + 0.1);
    }
    synthBass(m, t, dur) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = mtof(m);
      f.type = "lowpass"; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + dur); f.Q.value = 6;
      o.connect(f); f.connect(g); g.connect(this.tone);
      this.env(g, t, 0.16, 0.005, dur);
      o.start(t); o.stop(t + dur + 0.05);
    }
    // ローズ風エレピ：FM 合成（打った瞬間に明るく、すぐ丸くなる）＋金属的な「チン」
    rhodes(m, t, v, pan, dur = 1.6) {
      const c = this.ctx, f = mtof(m);
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), amp = c.createGain(), p = c.createStereoPanner();
      car.frequency.value = f; mod.frequency.value = f;
      mg.gain.setValueAtTime(f * (0.8 + 2.4 * Math.min(1, v * 8)), t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.6);
      mod.connect(mg); mg.connect(car.frequency);
      const tine = c.createOscillator(), tg = c.createGain(); tine.frequency.value = f * 7.1;
      tg.gain.setValueAtTime(v * 0.25, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      car.connect(amp); tine.connect(tg); tg.connect(amp);
      amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(v, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      p.pan.value = pan; amp.connect(p); p.connect(this.tone); p.connect(this.verbSend);
      for (const x of [car, mod, tine]) { x.start(t); x.stop(t + dur + 0.05); }
    }
    comp(root, q, t, v, dur) {
      const ns = this.voicing(root, q);
      ns.forEach((n, i) => this.rhodes(n, t + i * 0.006, v * (0.85 + Math.random() * 0.3), (i - 1.5) * 0.2, dur));
    }
    pluckChord(ns, t, v) {
      ns.forEach((n, i) => {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = mtof(n);
        f.type = "lowpass"; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
        o.connect(f); f.connect(g); g.connect(this.tone); g.connect(this.verbSend);
        this.env(g, t + i * 0.014, v, 0.003, 0.4);
        o.start(t); o.stop(t + 0.6);
      });
    }
    vibes(m, t, v, pan) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator(), g = c.createGain(), trem = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), p = c.createStereoPanner();
      o.type = "sine"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m) * 4; const g2 = c.createGain(); g2.gain.value = 0.07;
      o3.type = "sine"; o3.frequency.value = mtof(m) * 10; const g3 = c.createGain(); g3.gain.setValueAtTime(0.05, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      lfo.frequency.value = 5.5; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(trem.gain); trem.gain.value = 0.7;
      o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g); g.connect(trem); trem.connect(p); p.pan.value = pan;
      p.connect(this.tone); p.connect(this.delaySend); p.connect(this.verbSend);
      this.env(g, t, v, 0.002, 1.7);
      for (const x of [o, o2, o3, lfo]) { x.start(t); x.stop(t + 1.8); }
    }
    celesta(m, t, v, pan) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
      o.type = "sine"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m) * 2.76;
      const g2 = c.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(p); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.tone); p.connect(this.delaySend); p.connect(this.verbSend);
      this.env(g, t, v, 0.002, 0.8);
      o.start(t); o2.start(t); o.stop(t + 0.9); o2.stop(t + 0.9);
    }
    // 主題を吹く楽器。前の音から近ければ、なめらかにつなぐ
    lead(m, t, dur, v, kind) {
      if (kind === "vibes") return this.vibes(m, t, v * 1.3, 0.1);
      if (kind === "celesta") return this.celesta(m + 12, t, v * 1.1, 0);
      const c = this.ctx, f = mtof(m), o = c.createOscillator(), amp = c.createGain(), p = c.createStereoPanner();
      const pf = this.lastLeadF && Math.abs(Math.log2(f / this.lastLeadF)) < 0.42 && t - this.lastLeadEnd < 0.08 ? this.lastLeadF : f;
      o.frequency.setValueAtTime(pf, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      // ビブラート：音の途中から深くなる
      const vib = c.createOscillator(), vg = c.createGain();
      vib.frequency.value = kind === "flute" ? 5.2 : 5.6;
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * (kind === "synth" ? 0.004 : 0.008), t + Math.min(0.35, dur * 0.7));
      vib.connect(vg); vg.connect(o.frequency);
      let chainIn = o, attack = 0.025;
      if (kind === "horn") {
        o.type = "sawtooth";
        const lp = c.createBiquadFilter(), pk = c.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 1; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
        pk.type = "peaking"; pk.frequency.value = 1400; pk.gain.value = 6; pk.Q.value = 1.2;
        o.connect(lp); lp.connect(pk); chainIn = pk;
      } else if (kind === "flugel") {
        o.type = "triangle"; attack = 0.07;
        const s2 = c.createOscillator(), sg = c.createGain(), lp = c.createBiquadFilter();
        s2.type = "sawtooth"; s2.frequency.setValueAtTime(pf, t); s2.frequency.exponentialRampToValueAtTime(f, t + 0.045); sg.gain.value = 0.25;
        lp.type = "lowpass"; lp.frequency.value = 1300;
        s2.connect(sg); sg.connect(lp); o.connect(lp); chainIn = lp; vg.connect(s2.frequency);
        s2.start(t); s2.stop(t + dur + 0.5);
      } else if (kind === "flute") {
        o.type = "sine"; attack = 0.06;
        const mix = c.createGain(), h = c.createOscillator(), hg = c.createGain();
        h.type = "triangle"; h.frequency.value = f * 2; hg.gain.value = 0.12;
        o.connect(mix); h.connect(hg); hg.connect(mix); h.start(t); h.stop(t + dur + 0.5);
        const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
        n.buffer = this.noise; nf.type = "bandpass"; nf.frequency.value = f * 2; nf.Q.value = 2; ng.gain.value = 0.06;
        n.connect(nf); nf.connect(ng); ng.connect(mix); n.start(t, Math.random()); n.stop(t + dur + 0.5);
        chainIn = mix;
      } else if (kind === "synth") {
        o.type = "square"; attack = 0.01;
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 5; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
        o.connect(lp); chainIn = lp;
      }
      chainIn.connect(amp); p.pan.value = 0.12;
      amp.connect(p); p.connect(this.tone); p.connect(this.verbSend); p.connect(this.delaySend);
      const end = t + Math.max(0.12, dur);
      amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(v, t + attack);
      amp.gain.setTargetAtTime(v * 0.75, t + attack, 0.2); amp.gain.setTargetAtTime(0.0001, end, 0.06);
      o.start(t); vib.start(t); o.stop(end + 0.5); vib.stop(end + 0.5);
      this.lastLeadF = f; this.lastLeadEnd = end;
    }

    noiseHit(t, type, freq, q, peak, dcy, dest = this.tone) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
      s.connect(f); f.connect(g); g.connect(dest);
      this.env(g, t, peak, 0.002, dcy);
      s.start(t, Math.random()); s.stop(t + dcy + 0.05);
      return g;
    }

    crash() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.drum("crash", t, 0.6, -0.3);
      this.fb.gain.cancelScheduledValues(t);
      this.fb.gain.setValueAtTime(0.7, t);
      this.fb.gain.setTargetAtTime(0.35, t + 0.8, 0.6);
    }

    // 出来事の効果音
    sfx(type) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, [root] = this.chordAt(this.bar, this.beatIdx);
      if (type === "clear") {
        // V → I の和音と、駆け上がるビブラフォン、クラッシュ
        const key = this.song.bars[0][0][0];
        this.comp(key + 7, "dom7", t, 0.12, 0.5);
        this.comp(key, "maj7", t + 0.28, 0.14, 2.4);
        [0, 4, 7, 11, 14, 19, 23, 26].forEach((k, i) => this.vibes(key + 24 + k, t + 0.28 + i * 0.07, 0.18, (i / 4) - 1));
        this.drum("crash", t + 0.28, 0.6, 0); this.drum("kick", t + 0.28, 0.8);
      }
      if (type === "witch") [0, 7, 12, 16, 19, 24, 28, 31].forEach((k, i) => this.celesta(root + 24 + k, t + i * 0.06, 0.12, Math.sin(i)));
      if (type === "eat") [7, 12, 16].forEach((k, i) => this.vibes(root + 12 + k, t + i * 0.06, 0.15, 0));
      if (type === "dead") {
        // ホーンが力なく下がっていく
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
        o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 1400;
        o.frequency.setValueAtTime(mtof(root + 19), t); o.frequency.exponentialRampToValueAtTime(mtof(root + 5), t + 0.9);
        o.connect(lp); lp.connect(g); g.connect(this.tone); g.connect(this.verbSend);
        this.env(g, t, 0.12, 0.03, 1.0); o.start(t); o.stop(t + 1.1);
        this.drum("tom", t, 0.5, 0, 0.8);
      }
      if (type === "abduct") {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1800, t + 1.4);
        o.connect(g); g.connect(this.tone); g.connect(this.delaySend); this.env(g, t, 0.08, 0.2, 1.3); o.start(t); o.stop(t + 1.6);
      }
      if (type === "slam") { this.drum("kick", t, 0.8); this.drum("snare", t, 0.6); }
      if (type === "zap") this.noiseHit(t, "bandpass", 3000, 4, 0.2, 0.4);
      if (type === "stuck") this.drum("tom", t, 0.5, 0, 0.7);
      if (type === "tongue") this.drum("rim", t, 0.6, 0, 0.6);
    }
  }

  function fitBass(n) { while (n < 34) n += 12; while (n > 50) n -= 12; return n; }

  FM.Jazz = Jazz;
  FM.composeHead = composeHead;
})();
