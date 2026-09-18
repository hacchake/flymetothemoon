// 音（表現レイヤ）
//
// Web Audio だけで鳴らす、オリジナルの夜の音楽。既存曲の旋律は使っていない。
// コード進行はジャズやボサノバで広く使われる言い回しの組み合わせ（進行そのものは誰のものでもない）。
// ステージごとに曲が変わる（FM.SONGS、ステージの song）。
//
// ハエの脳とつながっている：
//   発火の総量   → ビブラフォンの即興の音数、フィルタの開き、ディレイとリバーブの深さ
//   DNa02 の左右 → 旋律が上がるか下がるか、左右の定位
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

  // 1 小節 = [[根音 MIDI, 和音の種類], (2 つめの和音)]
  const b = (...chords) => chords;
  FM.SONGS = {
    swing: {
      name: "Moonlight Swing", bpm: 104, meter: 4, feel: "swing",
      bars: [b([51, "maj7"]), b([48, "m7"]), b([53, "m7"]), b([46, "dom7"]), b([55, "m7"]), b([48, "b9"]), b([53, "m7"]), b([46, "dom7"]),
        b([56, "maj7"]), b([49, "dom7"]), b([55, "m7"]), b([48, "b9"]), b([53, "m7"]), b([46, "sus"]), b([51, "maj7"]), b([46, "dom7"])],
    },
    ballad: {
      name: "Streetlight Ballad", bpm: 66, meter: 4, feel: "ballad",
      bars: [b([49, "maj7"]), b([46, "m7"]), b([51, "m7"]), b([56, "sus"]), b([53, "m7"]), b([46, "dom7"]), b([51, "m9"]), b([56, "dom7"]),
        b([54, "maj7s11"]), b([53, "m7"]), b([51, "m7"], [56, "dom7"]), b([49, "maj7"]), b([48, "m7b5"]), b([53, "b9"]), b([46, "m9"]), b([56, "sus"])],
    },
    bossa: {
      name: "Lunar Bossa", bpm: 128, meter: 4, feel: "bossa",
      bars: [b([50, "m9"]), b([51, "maj7s11"]), b([50, "m9"]), b([51, "maj7s11"]), b([55, "m9"]), b([45, "b9"]), b([50, "m9"]), b([45, "b9"]),
        b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"]), b([50, "m9"]), b([48, "dom7"]), b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"])],
    },
    lounge: {
      name: "UFO Lounge", bpm: 96, meter: 4, feel: "lounge",
      bars: [b([52, "m9"]), b([45, "dom7"]), b([52, "m9"]), b([45, "dom7"]), b([48, "maj7"]), b([47, "b9"]), b([52, "m9"]), b([47, "b9"])],
    },
    bop: {
      name: "Swatter Bop", bpm: 200, meter: 4, feel: "swing", busy: true,
      bars: [b([53, "six"], [50, "b9"]), b([55, "m7"], [48, "dom7"]), b([53, "six"], [50, "b9"]), b([55, "m7"], [48, "dom7"]),
        b([48, "m7"], [53, "dom7"]), b([46, "maj7"], [51, "dom7"]), b([45, "m7"], [50, "b9"]), b([55, "m7"], [48, "dom7"])],
    },
    waltz: {
      name: "Satellite Waltz", bpm: 150, meter: 3, feel: "waltz",
      bars: [b([53, "maj7"]), b([52, "m7b5"]), b([45, "b9"]), b([50, "m9"]), b([55, "m7"]), b([48, "dom7"]), b([53, "maj7"]), b([48, "sus"]),
        b([46, "maj7"]), b([46, "m7"]), b([45, "m7"]), b([50, "b9"]), b([55, "m9"]), b([48, "dom7"]), b([53, "six"]), b([48, "sus"])],
    },
    witching: {
      name: "Witching Hour", bpm: 84, meter: 4, feel: "swing", soft: true,
      bars: [b([45, "m9"]), b([50, "m9"]), b([45, "m9"]), b([53, "maj7s11"]), b([47, "m7b5"]), b([52, "b9"]), b([45, "m9"]), b([52, "b9"])],
    },
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

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
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.75;
      this.tone = ctx.createBiquadFilter(); this.tone.type = "lowpass"; this.tone.frequency.value = 2500; this.tone.Q.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      this.tone.connect(this.master); this.master.connect(comp); comp.connect(ctx.destination);

      // リバーブ（減衰するノイズで作ったインパルス応答）
      this.verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.verb.buffer = ir;
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.3;
      this.verbSend.connect(this.verb); this.verb.connect(this.tone);

      // ディレイ（曲のテンポに合わせる）
      this.delay = ctx.createDelay(2);
      this.fb = ctx.createGain(); this.fb.gain.value = 0.35;
      const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
      this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.15;
      this.delaySend.connect(this.delay); this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay);
      dl.connect(this.tone);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      // パッド（ずっと鳴らしておき、和音と音量だけ変える）。5 つめの声は危なさの濁り
      this.pad = ctx.createGain(); this.pad.gain.value = 0;
      this.padF = ctx.createBiquadFilter(); this.padF.type = "lowpass"; this.padF.frequency.value = 900;
      this.pad.connect(this.padF); this.padF.connect(this.tone); this.padF.connect(this.verbSend);
      this.padVoices = [0, 1, 2, 3, 4].map((k) => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = (k - 2) * 6;
        const g = ctx.createGain(); g.gain.value = k === 4 ? 0 : 0.05; o.connect(g); g.connect(this.pad); o.start();
        return { o, g };
      });
      // ランタンのきらめき（高い和音がふるえる）
      this.shimmer = ctx.createGain(); this.shimmer.gain.value = 0;
      const trem = ctx.createGain(); trem.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(trem.gain); lfo.start();
      this.shimmer.connect(trem); trem.connect(this.tone); trem.connect(this.verbSend); trem.connect(this.delaySend);
      this.shimVoices = [0, 1, 2].map(() => { const o = ctx.createOscillator(); o.type = "sine"; o.connect(this.shimmer); o.start(); return o; });

      this.bar = 0; this.beatIdx = 0;
      this.next = ctx.currentTime + 0.1;
      this.applySong();
      this.timer = setInterval(() => this.schedule(), 25);
    }

    applySong() {
      const beat = 60 / this.song.bpm;
      this.delay.delayTime.setTargetAtTime(Math.min(1.9, beat * 0.75), this.ctx.currentTime, 0.1);
      this.bar = 0; this.beatIdx = 0;
      this.setChord(this.chordAt(0, 0), this.next);
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
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
        this.cursorE = Math.min(1.5, this.cursorE * Math.pow(0.2, dt) + Math.min(1, cursor.speed / 1500) * dt * 6);
      } else this.cursorE *= Math.pow(0.2, dt);
      this.lamp = lamp;

      this.tone.frequency.setTargetAtTime(900 + 9000 * this.density ** 0.8, t, 0.2);
      this.delaySend.gain.setTargetAtTime(0.08 + 0.4 * this.density, t, 0.3);
      this.verbSend.gain.setTargetAtTime(0.22 + 0.3 * this.density, t, 0.3);
      this.pad.gain.setTargetAtTime(0.02 + 0.3 * this.moon ** 2 + 0.08 * this.tension, t, 0.5);
      this.padF.frequency.setTargetAtTime(600 + 2200 * this.alt + 800 * this.tension, t, 0.4);
      this.padVoices[4].g.gain.setTargetAtTime(0.06 * this.tension, t, 0.3);
      this.shimmer.gain.setTargetAtTime(lamp ? 0.035 : 0, t, lamp ? 0.08 : 0.4);
    }

    chordAt(bar, beat) {
      const cs = this.song.bars[bar % this.song.bars.length];
      if (cs.length === 1) return cs[0];
      return beat < this.song.meter / 2 ? cs[0] : cs[1];
    }

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
        }
        const c = this.chordAt(this.bar, this.beatIdx);
        if (c !== this.lastChord) { this.setChord(c, this.next); this.lastChord = c; }
      }
    }

    playBeat(t, beat) {
      const S = this.song, bi = this.beatIdx, [root, q] = this.chordAt(this.bar, bi), C = Q[q];
      const [nRoot] = this.chordAt(this.bar + (bi === S.meter - 1 ? 1 : 0), (bi + 1) % S.meter);
      const d = this.density, drive = 0.6 + 0.7 * this.thrust;
      const soft = S.soft ? 0.6 : 1;

      if (S.feel === "swing") {
        // ウォーキングベース
        let n;
        if (bi === 0) n = root - 12;
        else if (bi === S.meter - 1) n = nRoot - 12 + (Math.random() < 0.5 ? 1 : -1);
        else n = root - 12 + [0, C.chord[0], 7, C.chord[1] - 12][Math.floor(Math.random() * 4)];
        this.bass(fitBass(n), t, beat * 0.9);
        const off = t + beat * (2 / 3);
        this.ride(t, (bi === 0 ? 0.9 : 0.6) * drive * soft);
        if (bi % 2 === 1) { this.ride(off, 0.45 * drive * soft); this.chick(t); this.brush(t, soft); }
        if (S.busy && Math.random() < 0.3 * drive) this.snareGhost(off);
        if (Math.random() < (S.busy ? 0.5 : 0.35) + 0.4 * d && (bi % 2 === 0 || S.busy)) this.chord(root, C.chord, Math.random() < 0.6 ? off : t, (0.07 + 0.08 * d) * soft);
        this.melody(t, off, beat, root, C, 2);
      } else if (S.feel === "ballad") {
        if (bi % 2 === 0) this.bass(fitBass(bi === 0 ? root - 12 : root - 5), t, beat * 1.9);
        this.noiseHit(t, "bandpass", 1500, 0.5, 0.02 * drive, beat * 0.9); // ブラシを回す音
        // ピアノのアルペジオ（まっすぐな 8 分）
        const tones = [0, ...C.chord];
        for (let k = 0; k < 2; k++) this.epiano(root + 12 + tones[(bi * 2 + k) % tones.length], t + (k * beat) / 2, 0.045 + 0.03 * d, (k ? 0.3 : -0.3));
        this.melody(t, t + beat / 2, beat, root, C, 1);
      } else if (S.feel === "bossa") {
        const e = beat / 2;
        // ベース：1 拍目に根音、2 拍目の裏と 3 拍目に 5 度
        if (bi === 0) this.bass(fitBass(root - 12), t, beat * 1.4);
        if (bi === 1) this.bass(fitBass(root - 5), t + e, beat * 0.9);
        if (bi === 2) this.bass(fitBass(root - 5), t, beat * 0.9);
        if (bi === 3) this.bass(fitBass(nRoot - 12), t + e, beat * 0.9);
        for (let k = 0; k < 2; k++) this.shaker(t + k * e, (k ? 0.9 : 0.5) * drive);
        // クラーベ（2 小節で 1 周）
        const slot = (this.bar % 2) * 8 + bi * 2;
        for (let k = 0; k < 2; k++) if ([0, 3, 6, 10, 12].includes(slot + k)) this.rim(t + k * e);
        if (bi === 0 || bi === 2) this.kick(t, 0.5);
        // ギター風のコード刻み
        const comp = (this.bar % 2 ? [1, 3, 6] : [0, 3, 5]);
        for (let k = 0; k < 2; k++) if (comp.includes(bi * 2 + k)) this.pluckChord(root, C.chord, t + k * e, 0.06 + 0.05 * d);
        this.melody(t, t + e, beat, root, C, 1);
      } else if (S.feel === "lounge") {
        const s16 = beat / 4;
        for (let k = 0; k < 4; k++) this.hat(t + k * s16, (k === 2 ? 0.9 : 0.5) * drive);
        if (bi === 0 || (bi === 2 && Math.random() < 0.6)) this.kick(t, 0.8);
        if (bi === 2) this.kick(t + beat * 0.5, 0.5);
        if (bi % 2 === 1) this.clap(t);
        for (let k = 0; k < 2; k++) this.synthBass(fitBass(root - 12) + (k ? 12 : 0), t + (k * beat) / 2, beat * 0.4);
        if (bi === 0) this.chord(root, C.chord, t, 0.06 + 0.06 * d);
        this.melody(t, t + beat / 2, beat, root, C, 1);
      } else if (S.feel === "waltz") {
        if (bi === 0) this.bass(fitBass(root - 12), t, beat * 1.4);
        else if (bi === 2) this.bass(fitBass(root - 5), t, beat * 0.9);
        else this.chord(root, C.chord, t, 0.06 + 0.06 * d);
        if (bi === 2) this.chord(root, C.chord, t, 0.05 + 0.05 * d);
        this.ride(t, 0.6 * drive);
        if (bi === 1) this.ride(t + beat * (2 / 3), 0.4 * drive);
        this.melody(t, t + beat * (2 / 3), beat, root, C, 1);
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
      if (this.tension > 0.55 && bi % 2 === 0) { this.kick(t, 0.5 * this.tension); this.kick(t + beat * 0.3, 0.3 * this.tension); }
    }

    // ビブラフォン：ハエの脳の即興。per = 1 拍あたりの機会の数
    melody(t, off, beat, root, C, per) {
      const d = this.density;
      for (const tt of per === 2 ? [t, off] : [Math.random() < 0.5 ? t : off]) {
        if (Math.random() < (0.05 + 0.85 * d) * (per === 1 ? 1.4 : 1)) {
          const drift = this.turn > 0.3 ? 1 : this.turn < -0.3 ? -1 : 0;
          this.melodyStep += drift + Math.round((Math.random() - 0.5) * 3);
          this.melodyStep = Math.max(0, Math.min(16, this.melodyStep));
          const sc = C.scale, oct = Math.floor(this.melodyStep / sc.length) + Math.round(this.alt * 1.2);
          const m = root + 12 + oct * 12 + sc[this.melodyStep % sc.length];
          this.vibes(Math.min(96, m), tt, 0.08 + 0.12 * this.thrust, Math.max(-0.8, Math.min(0.8, -this.turn / 4)));
        }
      }
    }

    env(g, t, peak, a, dcy) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
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

    synthBass(m, t, dur) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = mtof(m);
      f.type = "lowpass"; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + dur); f.Q.value = 6;
      o.connect(f); f.connect(g); g.connect(this.tone);
      this.env(g, t, 0.16, 0.005, dur);
      o.start(t); o.stop(t + dur + 0.05);
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
    brush(t, v = 1) { this.noiseHit(t, "bandpass", 1800, 0.6, 0.025 * v, 0.22); }
    snareGhost(t) { this.noiseHit(t, "bandpass", 2200, 0.8, 0.02, 0.08); }
    shaker(t, v) { this.noiseHit(t, "highpass", 6000, 0.8, 0.025 * v, 0.06); }
    hat(t, v) { this.noiseHit(t, "highpass", 8000, 0.8, 0.03 * v, 0.04); }
    rim(t) { this.noiseHit(t, "bandpass", 1700, 8, 0.12, 0.05); }
    clap(t) { for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.012, "bandpass", 1300, 1.2, 0.05, 0.1); }
    kick(t, v) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      o.connect(g); g.connect(this.tone);
      this.env(g, t, 0.35 * v, 0.004, 0.22);
      o.start(t); o.stop(t + 0.3);
    }

    crash() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const g = this.noiseHit(t, "highpass", 4000, 0.5, 0.14, 2.0);
      g.connect(this.delaySend); g.connect(this.verbSend);
      this.fb.gain.cancelScheduledValues(t);
      this.fb.gain.setValueAtTime(0.72, t);
      this.fb.gain.setTargetAtTime(0.35, t + 0.8, 0.6);
    }

    chord(root, iv, t, v) { for (const k of iv) this.epiano(root + k, t, v, 0); }

    pluckChord(root, iv, t, v) {
      iv.slice(0, 3).forEach((k, i) => {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = mtof(root + k);
        f.type = "lowpass"; f.frequency.value = 2200;
        o.connect(f); f.connect(g); g.connect(this.tone); g.connect(this.verbSend);
        this.env(g, t + i * 0.012, v, 0.004, 0.35);
        o.start(t); o.stop(t + 0.5);
      });
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

    celesta(m, t, v, pan) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
      o.type = "sine"; o.frequency.value = mtof(m);
      o2.type = "sine"; o2.frequency.value = mtof(m) * 2.76;
      const g2 = c.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(p); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.tone); p.connect(this.delaySend); p.connect(this.verbSend);
      this.env(g, t, v, 0.002, 0.7);
      o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
    }

    // 出来事の効果音
    sfx(type) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, [root] = this.chordAt(this.bar, this.beatIdx);
      if (type === "clear") [0, 4, 7, 11, 14, 19, 23].forEach((k, i) => this.vibes(root + 12 + k, t + i * 0.09, 0.2, (i / 3) - 1));
      if (type === "witch") [0, 7, 12, 16, 19, 24, 28, 31].forEach((k, i) => this.celesta(root + 24 + k, t + i * 0.06, 0.12, Math.sin(i)));
      if (type === "eat") [7, 12].forEach((k, i) => this.vibes(root + 12 + k, t + i * 0.07, 0.15, 0));
      if (type === "dead") {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = "triangle"; o.frequency.setValueAtTime(mtof(root + 24), t); o.frequency.exponentialRampToValueAtTime(mtof(root - 12), t + 0.9);
        o.connect(g); g.connect(this.tone); g.connect(this.verbSend); this.env(g, t, 0.15, 0.01, 0.9); o.start(t); o.stop(t + 1);
      }
      if (type === "abduct") {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1800, t + 1.4);
        o.connect(g); g.connect(this.tone); g.connect(this.delaySend); this.env(g, t, 0.08, 0.2, 1.3); o.start(t); o.stop(t + 1.6);
      }
      if (type === "slam") this.noiseHit(t, "lowpass", 600, 0.8, 0.35, 0.25);
      if (type === "zap") this.noiseHit(t, "bandpass", 3000, 4, 0.2, 0.4);
      if (type === "stuck") this.noiseHit(t, "lowpass", 300, 1, 0.2, 0.3);
      if (type === "tongue") this.noiseHit(t, "lowpass", 900, 3, 0.15, 0.12);
    }
  }

  function fitBass(n) { while (n < 34) n += 12; while (n > 50) n -= 12; return n; }

  FM.Jazz = Jazz;
})();
