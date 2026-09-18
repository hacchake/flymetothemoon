// 描画（表現レイヤ）
// 人間の目に見せる層。ここで初めて、光のひとつが「月」として描かれる。
(function () {
  const FM = (window.FM = window.FM || {});
  const TAU = Math.PI * 2;

  const GROUP_COLOR = {
    vision: [120, 190, 255],
    loom: [190, 140, 255],
    olf: [130, 230, 160],
    motor: [255, 205, 120],
    game: [255, 130, 170],
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ---------------- 世界 ----------------
  class WorldView {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.stars = [];
      this.fx = []; // 一時的な演出
    }

    resize(w, h, dpr) {
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      const rng = FM.mulberry32(7);
      this.stars = Array.from({ length: Math.round((w * h) / 2600) }, () => ({
        x: rng() * w, y: rng() * h, r: rng() * 1.2 + 0.2, p: rng() * TAU, s: 0.4 + rng() * 1.5,
      }));
    }

    burst(x, y, color, n = 18) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = 30 + Math.random() * 90;
        this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.6 + Math.random() * 0.5, color });
      }
    }

    draw(world, senses, brain, t, opts) {
      const { ctx, w, h } = this;
      // 背景
      const bg = ctx.createRadialGradient(w * 0.7, h * 0.15, 10, w * 0.5, h * 0.5, Math.max(w, h));
      bg.addColorStop(0, "#0d1330"); bg.addColorStop(0.5, "#070a1c"); bg.addColorStop(1, "#02030a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (const s of this.stars) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * s.s + s.p);
        ctx.fillStyle = "#cfd8ff";
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;

      // 匂いのかすみ
      for (const fd of world.foods) {
        const g = ctx.createRadialGradient(fd.x, fd.y, 0, fd.x, fd.y, 150);
        g.addColorStop(0, "rgba(120,230,150,0.10)"); g.addColorStop(1, "rgba(120,230,150,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fd.x, fd.y, 150, 0, TAU); ctx.fill();
      }

      // 月
      const m = world.moon;
      const halo = ctx.createRadialGradient(m.x, m.y, m.r * 0.6, m.x, m.y, m.r * 5);
      halo.addColorStop(0, "rgba(255,244,214,0.35)"); halo.addColorStop(1, "rgba(255,244,214,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 5, 0, TAU); ctx.fill();
      const disc = ctx.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, 2, m.x, m.y, m.r);
      disc.addColorStop(0, "#fffaf0"); disc.addColorStop(1, "#e8dcb8");
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(170,160,130,0.35)";
      for (const [dx, dy, rr] of [[-0.3, 0.1, 0.22], [0.25, -0.25, 0.15], [0.2, 0.35, 0.12]]) {
        ctx.beginPath(); ctx.arc(m.x + dx * m.r, m.y + dy * m.r, rr * m.r, 0, TAU); ctx.fill();
      }

      // ランプ
      if (world.lamp.on) {
        const L = world.lamp;
        const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 90);
        g.addColorStop(0, "rgba(255,200,120,0.55)"); g.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.x, L.y, 90, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffe2b0"; ctx.beginPath(); ctx.arc(L.x, L.y, 5, 0, TAU); ctx.fill();
      }

      // 餌
      for (const fd of world.foods) {
        ctx.fillStyle = "#9df5b4"; ctx.beginPath(); ctx.arc(fd.x, fd.y, 4.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(157,245,180,0.4)"; ctx.beginPath(); ctx.arc(fd.x, fd.y, 8 + Math.sin(t * 3) * 1.5, 0, TAU); ctx.stroke();
      }

      // 岩
      for (const r of world.rocks) {
        const g = ctx.createRadialGradient(r.x - r.r * 0.4, r.y - r.r * 0.4, 2, r.x, r.y, r.r);
        g.addColorStop(0, "#3a3f55"); g.addColorStop(1, "#14172a");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = r.hitCool > 0 ? "rgba(255,120,120,0.8)" : "rgba(140,150,200,0.25)";
        ctx.lineWidth = 1.2; ctx.stroke();
      }

      // ハエの「視線」：見えている光へ、網膜の反応の強さだけ細い線を引く
      const f = world.fly;
      if (opts.sight) {
        for (const L of world.lights()) {
          if (world.occluded(L.x, L.y)) continue;
          const { az } = world.view(L.x, L.y);
          const c = Math.min(senses.cols - 1, Math.floor(Math.abs(az) / (senses.colDeg * Math.PI / 180)));
          const rates = brain.colRates(az >= 0 ? "R7R8_L" : "R7R8_R");
          const a = Math.min(0.5, rates[c] / 300);
          ctx.strokeStyle = `rgba(160,200,255,${a})`; ctx.lineWidth = 1;
          ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(L.x, L.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 軌跡
      const tr = f.trail;
      for (let i = 1; i < tr.length; i++) {
        const a = i / tr.length;
        ctx.strokeStyle = `rgba(150,190,255,${a * 0.5})`;
        ctx.lineWidth = 1 + a;
        ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
      }

      this.drawFly(f, t);

      // 演出の粒子
      for (const p of this.fx) {
        p.t += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.vx *= 0.96; p.vy *= 0.96;
        ctx.fillStyle = rgba(p.color, Math.max(0, 1 - p.t / p.life));
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      this.fx = this.fx.filter((p) => p.t < p.life);
    }

    drawFly(f, t) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.h);
      // 脚：歩いた距離で位相が進む
      const ph = f.walked * 0.35;
      ctx.strokeStyle = "rgba(210,210,230,0.7)"; ctx.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) {
        for (const side of [-1, 1]) {
          const tri = (k % 2 === 0) === (side === 1) ? 1 : -1; // 三脚歩行
          const sw = Math.sin(ph) * 2.2 * tri;
          const bx = 3 - k * 3;
          ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 2 + sw - k * 2, side * 7); ctx.stroke();
        }
      }
      // 翅
      const flap = f.jump > 0 ? Math.sin(t * 90) * 0.5 : 0;
      ctx.fillStyle = "rgba(200,220,255,0.28)";
      for (const side of [-1, 1]) {
        ctx.save(); ctx.rotate(side * (0.35 + flap));
        ctx.beginPath(); ctx.ellipse(-6, side * 3, 7, 2.8, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 胴・胸・頭
      ctx.fillStyle = "#2b2330"; ctx.beginPath(); ctx.ellipse(-3, 0, 5.5, 3.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#3d3140"; ctx.beginPath(); ctx.ellipse(2, 0, 3.2, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#4a3a42"; ctx.beginPath(); ctx.arc(5.6, 0, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c2413a";
      ctx.beginPath(); ctx.arc(6.2, -1.9, 1.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(6.2, 1.9, 1.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ---------------- 脳 ----------------
  class BrainView {
    constructor(canvas, brain) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.setBrain(brain);
    }

    setBrain(brain) {
      this.brain = brain;
      this.layout = null;
    }

    resize(w, h, dpr) {
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      this.layout = null;
    }

    // ニューロンごとの画面位置を決める
    buildLayout() {
      const B = this.brain, W = this.w, H = this.h - 120; // 下 120px は網膜の帯と読み出し
      const pos = new Float32Array(B.N * 2);
      const center = {};
      const rng = FM.mulberry32(3);
      for (const p of B.pops) {
        const cx = p.xy[0] * W, cy = 14 + p.xy[1] * (H - 28);
        center[p.id] = [cx, cy];
        for (let i = 0; i < p.n; i++) {
          let x, y;
          if (p.cols) {
            // 列は正面（内側）から外側へ並べる
            const c = Math.floor(i / p.perCol), k = i % p.perCol;
            const dir = p.side === "L" ? -1 : 1;
            x = cx + dir * ((c - (p.cols - 1) / 2) * 9) ;
            y = cy + (k - (p.perCol - 1) / 2) * 6 + Math.abs(c - (p.cols - 1) / 2) * 1.2;
          } else {
            const a = rng() * TAU, rr = Math.sqrt(rng()) * (4 + Math.sqrt(p.n) * 4);
            x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr * 0.7;
          }
          pos[(p.offset + i) * 2] = x; pos[(p.offset + i) * 2 + 1] = y;
        }
      }
      this.layout = { pos, center, H };
    }

    draw(senses, motor, t) {
      if (!this.layout) this.buildLayout();
      const { ctx, w, h, brain: B } = this;
      const { pos, center, H } = this.layout;
      ctx.clearRect(0, 0, w, h);

      // 結合：集団の中心どうしを結ぶ。前の集団が活発なほど明るい
      for (const pr of B.activeProj) {
        const a = center[pr.from], b = center[pr.to];
        const act = Math.min(1, B.popRate(pr.from) / 80);
        const inh = pr.nt === "GABA" || pr.nt === "Glu";
        ctx.strokeStyle = inh ? `rgba(120,160,255,${0.06 + act * 0.45})` : `rgba(255,220,170,${0.05 + act * 0.4})`;
        ctx.lineWidth = 0.6 + act * 1.6;
        if (pr.prov === "game") ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        const mxp = (a[0] + b[0]) / 2 + (a[1] - b[1]) * 0.08, myp = (a[1] + b[1]) / 2;
        ctx.quadraticCurveTo(mxp, myp, b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        // 流れる光点
        if (act > 0.05) {
          const u = (t * (0.6 + act) + (pr.syn % 7) / 7) % 1;
          const x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mxp + u * u * b[0];
          const y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * myp + u * u * b[1];
          ctx.fillStyle = inh ? "rgba(150,190,255,0.9)" : "rgba(255,235,200,0.9)";
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      // ニューロン
      ctx.globalCompositeOperation = "lighter";
      for (const p of B.pops) {
        const col = GROUP_COLOR[p.group];
        const big = p.role === "dn" ? 2.2 : 1;
        for (let i = 0; i < p.n; i++) {
          const k = p.offset + i;
          const x = pos[k * 2], y = pos[k * 2 + 1];
          const f = B.flash[k], r = Math.min(1, B.trace[k] / 120);
          ctx.fillStyle = rgba(col, 0.18 + r * 0.5);
          ctx.beginPath(); ctx.arc(x, y, (1.4 + r * 1.6) * big, 0, TAU); ctx.fill();
          if (f > 0.05) {
            ctx.fillStyle = rgba(col, f * 0.35);
            ctx.beginPath(); ctx.arc(x, y, (3 + f * 7) * big, 0, TAU); ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";

      // 集団の名前
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const p of B.pops) {
        const [cx, cy] = center[p.id];
        const dy = p.cols ? 12 : 4 + Math.sqrt(p.n) * 3.5 + 8;
        ctx.fillStyle = p.source === "game" ? "rgba(255,150,190,0.6)" : "rgba(200,210,240,0.55)";
        ctx.fillText(p.label, cx, cy + dy);
      }

      // 網膜の帯：ハエに見えている世界（左目の外側 … 正面 … 右目の外側）
      const y0 = H + 8, bw = (w - 32) / (senses.cols * 2);
      ctx.textAlign = "left"; ctx.fillStyle = "rgba(200,210,240,0.6)";
      ctx.fillText("ハエに見えているもの（左目 ← 正面 → 右目）", 16, y0);
      const L = B.colRates("R7R8_L"), R = B.colRates("R7R8_R");
      const cells = [...Array.from(L).reverse(), ...R];
      cells.forEach((v, i) => {
        const a = Math.min(1, v / 140);
        ctx.fillStyle = `rgba(${200 + 55 * a},${210 + 40 * a},${255},${0.06 + a * 0.9})`;
        ctx.fillRect(16 + i * bw, y0 + 6, bw - 2, 18);
      });
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(16 + senses.cols * bw - 1, y0 + 4, 1, 22);

      // 運動の読み出し
      const d = motor.dn || { turnL: 0, turnR: 0, fwd: 0, back: 0, gf: 0 };
      const bars = [
        ["DNa02+01 左", d.turnL, GROUP_COLOR.motor],
        ["DNa02+01 右", d.turnR, GROUP_COLOR.motor],
        ["DNp09 前進", d.fwd, GROUP_COLOR.motor],
        ["MDN 後退", d.back, GROUP_COLOR.loom],
        ["GF 逃避", d.gf, GROUP_COLOR.loom],
      ];
      const y1 = y0 + 40;
      bars.forEach(([name, v, c], i) => {
        const x = 16 + (i % 3) * ((w - 32) / 3), y = y1 + Math.floor(i / 3) * 22;
        ctx.fillStyle = "rgba(200,210,240,0.6)"; ctx.fillText(name, x, y);
        ctx.fillStyle = rgba(c, 0.15); ctx.fillRect(x, y + 4, (w - 32) / 3 - 10, 5);
        ctx.fillStyle = rgba(c, 0.85); ctx.fillRect(x, y + 4, Math.min(1, v / 200) * ((w - 32) / 3 - 10), 5);
      });
      const o = motor.out;
      ctx.fillStyle = "rgba(200,210,240,0.6)";
      ctx.fillText(`→ 前進 ${o.forward.toFixed(0)} px/s   旋回 ${(o.turn * 57.3).toFixed(0)}°/s ${o.turn > 0.05 ? "（左）" : o.turn < -0.05 ? "（右）" : ""}`,
        16 + ((w - 32) / 3) * 2, y1 + 22);
    }
  }

  FM.WorldView = WorldView;
  FM.BrainView = BrainView;
})();
