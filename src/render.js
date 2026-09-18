// 描画（表現レイヤ）
// 人間の目に見せる層。ここで初めて、光のひとつが「月」として描かれる。
(function () {
  const FM = (window.FM = window.FM || {});
  const TAU = Math.PI * 2;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // 放射グラデーションの光の玉を 1 回だけ作って使い回す
  const spriteCache = new Map();
  function glowSprite(c) {
    const key = c.join(",");
    if (spriteCache.has(key)) return spriteCache.get(key);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.18, rgba(c, 0.95));
    gr.addColorStop(0.45, rgba(c, 0.35));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    spriteCache.set(key, cv);
    return cv;
  }

  // ======================================================================
  //  世界（夜の街を横から）
  // ======================================================================
  class WorldView {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.fx = [];
      this.shake = 0;
      this.flashA = 0;
    }

    resize(w, h, dpr) {
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
      this.dpr = dpr; this.w = w; this.h = h;
      const rng = FM.mulberry32(7);
      this.stars = Array.from({ length: Math.round((w * h) / 1800) }, () => ({
        x: rng() * w, y: rng() * h * 3, r: rng() * 1.3 + 0.2, p: rng() * TAU, s: 0.4 + rng() * 1.8,
      }));
    }

    setWorld(world) {
      // 街並み（奥・手前の 2 層）。シードで固定
      const rng = FM.mulberry32(world.stage.id * 97 + 3);
      const mk = (n, hMin, hMax) => {
        const out = []; let x = -40;
        while (x < 1040) {
          const bw = 40 + rng() * 90, bh = hMin + rng() * (hMax - hMin);
          const wins = [];
          for (let wy = 14; wy < bh - 10; wy += 16) for (let wx = 8; wx < bw - 8; wx += 13) if (rng() < 0.28) wins.push([wx, wy, rng()]);
          out.push({ x, w: bw, h: bh, wins, antenna: rng() < 0.2 });
          x += bw + rng() * 12;
        }
        return out;
      };
      this.cityFar = mk(0, 120, 380);
      this.cityNear = mk(0, 60, 200);
    }

    burst(x, y, color, n = 18, speed = 90) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.3 + Math.random());
        this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.5 + Math.random() * 0.6, color });
      }
    }

    draw(world, senses, game, cam, t, opts) {
      const { ctx, w, h, dpr } = this;
      const s = cam.s;
      let sx = 0, sy = 0;
      if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake * 14; sy = (Math.random() - 0.5) * this.shake * 14; this.shake *= 0.88; if (this.shake < 0.02) this.shake = 0; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 空
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      const up = Math.max(0, Math.min(1, cam.y / Math.max(1, world.H - h / s))); // 高いほど宇宙の色
      sky.addColorStop(0, "#03040c");
      sky.addColorStop(0.55, up < 0.5 ? "#0a0f2a" : "#070a1e");
      sky.addColorStop(1, `rgb(${22 + 20 * up},${18 + 8 * up},${48 + 10 * up})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (const st of this.stars) {
        const y = (st.y - cam.y * s * 0.15) % (h * 3);
        if (y < 0 || y > h) continue;
        ctx.globalAlpha = 0.3 + 0.45 * Math.sin(t * st.s + st.p) ** 2;
        ctx.fillStyle = "#dfe6ff"; ctx.fillRect(st.x, y, st.r, st.r);
      }
      ctx.globalAlpha = 1;

      // ここから世界座標
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (sx - cam.x * s), dpr * (sy - cam.y * s));
      const vis = (y, m = 200) => y > cam.y - m && y < cam.y + h / s + m;

      this.drawMoon(world.moon, t);
      this.drawCity(world, t, vis);
      for (const c of world.clouds) this.drawCloud(c, world.moon, t);
      for (const st of world.streetlights) this.drawStreetlight(st, world, t);
      for (const p of world.papers) this.drawPaper(p, t);
      for (const z of world.zappers) this.drawZapper(z, t);
      for (const fd of world.foods) this.drawFood(fd, t);
      if (world.road) this.drawRoad(world);
      for (const c of world.cars) this.drawCar(c);
      if (world.lamp.on) this.drawLamp(world.lamp, game, t);

      // ハエの視線：見えている光へ、明るさぶんだけ細い線
      const f = world.fly;
      if (opts.sight && f.state === "fly") {
        ctx.setLineDash([2, 7]); ctx.lineWidth = 1 / s;
        for (const L of world.lights()) {
          if (world.occluded(L.x, L.y)) continue;
          const a = Math.min(0.55, L.I * 0.25);
          ctx.strokeStyle = L.kind === "zapper" ? `rgba(170,140,255,${a})` : `rgba(170,210,255,${a})`;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(L.x, L.y); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 軌跡（光る尾）
      ctx.globalCompositeOperation = "lighter";
      const tr = f.trail;
      for (let i = 1; i < tr.length; i++) {
        const a = i / tr.length;
        ctx.strokeStyle = `rgba(120,200,255,${a * 0.45})`;
        ctx.lineWidth = (0.5 + a * 2.5) / Math.max(0.6, s);
        ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      if (f.state !== "dead") this.drawFly(f, t, s);
      for (const sw of world.swatters) this.drawSwatter(sw, t);

      // 粒子
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.fx) {
        const dt = opts.dt ?? 1 / 60, drag = Math.pow(0.95, dt * 60);
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag;
        const a = Math.max(0, 1 - p.t / p.life);
        ctx.drawImage(glowSprite(p.color), p.x - 5, p.y - 5, 10 * a + 2, 10 * a + 2);
      }
      ctx.globalCompositeOperation = "source-over";
      this.fx = this.fx.filter((p) => p.t < p.life);

      // 画面全体の閃光
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.flashA > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashA})`; ctx.fillRect(0, 0, w, h);
        this.flashA *= 0.85; if (this.flashA < 0.01) this.flashA = 0;
      }
    }

    drawMoon(m, t) {
      const { ctx } = this;
      for (const [k, a] of [[9, 0.08], [5, 0.16], [2.6, 0.3]]) {
        const g = ctx.createRadialGradient(m.x, m.y, m.r * 0.8, m.x, m.y, m.r * k);
        g.addColorStop(0, `rgba(255,240,205,${a})`); g.addColorStop(1, "rgba(255,240,205,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * k, 0, TAU); ctx.fill();
      }
      const disc = ctx.createRadialGradient(m.x - m.r * 0.35, m.y - m.r * 0.35, 2, m.x, m.y, m.r);
      disc.addColorStop(0, "#fffcf2"); disc.addColorStop(0.7, "#f1e6c6"); disc.addColorStop(1, "#d8c89c");
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(160,145,110,0.3)";
      for (const [dx, dy, rr] of [[-0.3, 0.1, 0.22], [0.25, -0.25, 0.15], [0.2, 0.35, 0.12], [-0.1, -0.45, 0.08]]) {
        ctx.beginPath(); ctx.arc(m.x + dx * m.r, m.y + dy * m.r, rr * m.r, 0, TAU); ctx.fill();
      }
    }

    drawCity(world, t, vis) {
      const { ctx } = this;
      const g = world.ground;
      if (!vis(g, 500)) return;
      for (const [layer, col, winA] of [[this.cityFar, "#0b0e22", 0.45], [this.cityNear, "#070914", 0.8]]) {
        for (const b of layer) {
          ctx.fillStyle = col; ctx.fillRect(b.x, g - b.h, b.w, b.h);
          if (b.antenna) { ctx.fillRect(b.x + b.w / 2 - 1, g - b.h - 30, 2, 30); ctx.fillStyle = `rgba(255,80,80,${0.4 + 0.4 * Math.sin(t * 3 + b.x)})`; ctx.fillRect(b.x + b.w / 2 - 2, g - b.h - 32, 4, 4); }
          for (const [wx, wy, r] of b.wins) {
            const on = Math.sin(t * 0.3 + r * 50) > -0.7;
            if (!on) continue;
            ctx.fillStyle = `rgba(255,${190 + r * 40},${110 + r * 60},${winA * (0.5 + r * 0.5)})`;
            ctx.fillRect(b.x + wx, g - b.h + wy, 5, 7);
          }
        }
      }
      ctx.fillStyle = "#05060e"; ctx.fillRect(-50, g, 1100, 200);
    }

    drawRoad(world) {
      const { ctx } = this;
      const y = world.road.y;
      ctx.fillStyle = "#0c0d18"; ctx.fillRect(-50, y - 22, 1100, 44);
      ctx.fillStyle = "rgba(255,220,140,0.35)";
      for (let x = 0; x < 1000; x += 60) ctx.fillRect(x, y - 1, 30, 2);
    }

    drawCar(c) {
      const { ctx } = this;
      const d = c.dir;
      // ヘッドライトの光錐
      const hx = c.x + d * 60, hy = c.y - 8;
      const g = ctx.createRadialGradient(hx, hy, 2, hx + d * 160, hy, 220);
      g.addColorStop(0, "rgba(255,245,210,0.55)"); g.addColorStop(1, "rgba(255,245,210,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + d * 380, hy - 110); ctx.lineTo(hx + d * 380, hy + 60); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `hsl(${c.hue * 360},35%,22%)`;
      roundRect(ctx, c.x - 62, c.y - 26, 124, 34, 8); ctx.fill();
      roundRect(ctx, c.x - 34, c.y - 46, 64, 24, 8); ctx.fill();
      ctx.fillStyle = "rgba(160,200,255,0.25)"; roundRect(ctx, c.x - 28, c.y - 42, 52, 16, 5); ctx.fill();
      ctx.fillStyle = "#111"; for (const k of [-38, 38]) { ctx.beginPath(); ctx.arc(c.x + k, c.y + 8, 10, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#fff6d8"; ctx.fillRect(hx - 4, hy - 4, 8, 7);
      ctx.fillStyle = "#ff3b3b"; ctx.fillRect(c.x - d * 62 - 3, c.y - 12, 6, 6);
    }

    drawStreetlight(st, world, t) {
      const { ctx } = this;
      ctx.strokeStyle = "#1a1d30"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(st.x, world.ground); ctx.lineTo(st.x, st.y + 10); ctx.quadraticCurveTo(st.x, st.y - 6, st.x - 18, st.y - 6); ctx.stroke();
      const g = ctx.createRadialGradient(st.x - 18, st.y, 2, st.x - 18, st.y, 150);
      g.addColorStop(0, "rgba(255,210,140,0.65)"); g.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(st.x - 18, st.y, 150, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,200,120,0.08)";
      ctx.beginPath(); ctx.moveTo(st.x - 30, st.y); ctx.lineTo(st.x - 110, world.ground); ctx.lineTo(st.x + 74, world.ground); ctx.lineTo(st.x - 6, st.y); ctx.fill();
      ctx.fillStyle = "#ffe9c2"; ctx.beginPath(); ctx.ellipse(st.x - 18, st.y + 2, 11, 5, 0, 0, TAU); ctx.fill();
      // 光に群がる小さな虫（ほかのハエたち）
      for (let i = 0; i < 6; i++) {
        const a = t * (1.5 + i * 0.3) + i * 2, r = 22 + (i % 3) * 10;
        ctx.fillStyle = "rgba(40,30,40,0.8)"; ctx.fillRect(st.x - 18 + Math.cos(a) * r, st.y + Math.sin(a * 1.3) * r * 0.6, 2, 2);
      }
    }

    drawZapper(z, t) {
      const { ctx } = this;
      // 人間の目には暗い青紫。ハエの目には、いちばん明るい光
      const pulse = 0.8 + 0.2 * Math.sin(t * 12);
      const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, 120);
      g.addColorStop(0, `rgba(150,110,255,${0.5 * pulse})`); g.addColorStop(1, "rgba(120,90,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, 120, 0, TAU); ctx.fill();
      ctx.fillStyle = "#16142a"; roundRect(ctx, z.x - 22, z.y - 30, 44, 60, 6); ctx.fill();
      ctx.fillStyle = `rgba(170,150,255,${0.9 * pulse})`;
      for (const k of [-10, 0, 10]) ctx.fillRect(z.x + k - 2, z.y - 22, 4, 44);
      ctx.strokeStyle = "rgba(200,200,230,0.5)"; ctx.lineWidth = 1;
      for (let k = -18; k <= 18; k += 6) { ctx.beginPath(); ctx.moveTo(z.x + k, z.y - 28); ctx.lineTo(z.x + k, z.y + 28); ctx.stroke(); }
      if (z.zap > 0) {
        ctx.strokeStyle = `rgba(210,230,255,${z.zap * 2})`; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath(); let x = z.x, y = z.y; ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(190,170,255,0.6)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText("UV", z.x, z.y + 44);
    }

    drawPaper(p, t) {
      const { ctx } = this;
      const sway = Math.sin(t * 0.8 + p.x) * 3;
      ctx.strokeStyle = "rgba(200,200,220,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 260); ctx.lineTo(p.x + sway, p.y); ctx.stroke();
      const g = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
      g.addColorStop(0, "#b8872a"); g.addColorStop(0.5, "#f0c25a"); g.addColorStop(1, "#a9791f");
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(sway, 0);
      ctx.beginPath(); ctx.moveTo(p.x - p.w / 2, p.y); ctx.lineTo(p.x + p.w / 2, p.y);
      for (let y = p.y; y < p.y + p.h; y += 20) ctx.lineTo(p.x + p.w / 2 + Math.sin((y + p.x) * 0.2) * 3, y);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h); ctx.lineTo(p.x - p.w / 2, p.y + p.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(p.x - 4, p.y + 4, 3, p.h - 8);
      ctx.fillStyle = "#1a1418";
      for (let k = 0; k < 4; k++) ctx.fillRect(p.x - 8 + ((k * 37 + p.x) % 16), p.y + 20 + k * (p.h / 5), 3, 2);
      ctx.restore();
    }

    drawFood(fd, t) {
      const { ctx } = this;
      const g = ctx.createRadialGradient(fd.x, fd.y, 0, fd.x, fd.y, 160);
      g.addColorStop(0, "rgba(140,255,170,0.14)"); g.addColorStop(1, "rgba(140,255,170,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fd.x, fd.y, 160, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c8ffd8"; ctx.beginPath(); ctx.arc(fd.x, fd.y, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(157,245,180,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fd.x, fd.y, 11 + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke();
    }

    drawCloud(c, moon, t) {
      const { ctx } = this;
      const parts = [[0, 0, 1], [-0.6, 0.15, 0.7], [0.6, 0.1, 0.75], [-0.25, -0.35, 0.65], [0.3, -0.3, 0.6]];
      const lx = moon.x - c.x, ly = moon.y - c.y, ld = Math.hypot(lx, ly) || 1;
      for (const [dx, dy, k] of parts) {
        const x = c.x + dx * c.r + Math.sin(t * 0.3 + dx) * 2, y = c.y + dy * c.r, r = c.r * k * 0.75;
        const g = ctx.createRadialGradient(x + (lx / ld) * r * 0.5, y + (ly / ld) * r * 0.5, 1, x, y, r);
        g.addColorStop(0, "#2a2e4a"); g.addColorStop(1, "#10121f");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }

    drawLamp(L, game, t) {
      const { ctx } = this;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 130);
      g.addColorStop(0, "rgba(255,210,130,0.7)"); g.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.x, L.y, 130, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,220,160,0.5)"; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + t;
        ctx.beginPath(); ctx.moveTo(L.x + Math.cos(a) * 14, L.y + Math.sin(a) * 14); ctx.lineTo(L.x + Math.cos(a) * 24, L.y + Math.sin(a) * 24); ctx.stroke();
      }
      ctx.fillStyle = "#fff0d0"; ctx.beginPath(); ctx.arc(L.x, L.y, 6, 0, TAU); ctx.fill();
      if (Number.isFinite(game.stage.tools.lamp)) {
        const frac = game.battery / game.stage.tools.lamp;
        ctx.strokeStyle = frac < 0.25 ? "rgba(255,120,120,0.9)" : "rgba(255,230,180,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(L.x, L.y, 32, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.stroke();
      }
    }

    drawSwatter(sw, t) {
      const { ctx } = this;
      if (sw.state === "aim" || sw.state === "slam") {
        // 床に落ちる影（ハエの LPLC2 が見ているもの）
        const r = 12 + sw.shadow * 90;
        ctx.fillStyle = `rgba(0,0,0,${0.25 + sw.shadow * 0.45})`;
        ctx.beginPath(); ctx.arc(sw.tx, sw.ty, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,90,90,${sw.shadow * 0.8})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sw.tx, sw.ty, r, 0, TAU); ctx.stroke();
      }
      const k = sw.state === "aim" ? 1 + sw.shadow * 0.6 : sw.state === "slam" ? 1.7 : 1;
      const a = sw.state === "hover" ? 0.55 : 0.95;
      ctx.save();
      ctx.translate(sw.state === "hover" ? sw.x : sw.tx, (sw.state === "hover" ? sw.y : sw.ty) - (sw.state === "aim" ? 40 * (1 - sw.shadow) : 0));
      ctx.rotate(-0.5 + Math.sin(t * 2) * 0.05);
      ctx.scale(k, k);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#b8403a"; ctx.fillRect(-3, 30, 6, 90);
      ctx.fillStyle = "rgba(220,70,60,0.85)"; roundRect(ctx, -32, -36, 64, 70, 12); ctx.fill();
      ctx.strokeStyle = "rgba(255,180,170,0.4)"; ctx.lineWidth = 1;
      for (let x = -28; x <= 28; x += 7) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, 32); ctx.stroke(); }
      for (let y = -32; y <= 32; y += 7) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    drawFly(f, t, s) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.h);
      const k = 1.25;
      ctx.scale(k, k);
      // 光輪（小さくても見失わないように）
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowSprite([120, 190, 255]), -16, -16, 32, 32);
      ctx.globalCompositeOperation = "source-over";
      const flying = f.state === "fly";
      // 翅：飛んでいる間は速く羽ばたいて残像になる
      for (const side of [-1, 1]) {
        const beat = flying ? Math.sin(f.wing) : 0.2;
        const spread = flying ? 0.9 + beat * 0.6 : 0.25;
        ctx.save(); ctx.rotate(side * spread);
        ctx.fillStyle = flying ? "rgba(210,230,255,0.22)" : "rgba(210,230,255,0.35)";
        ctx.beginPath(); ctx.ellipse(-5, side * 5, 9, 3.4, 0, 0, TAU); ctx.fill();
        if (flying) { ctx.rotate(-side * 0.5); ctx.fillStyle = "rgba(210,230,255,0.12)"; ctx.beginPath(); ctx.ellipse(-5, side * 5, 9, 3.4, 0, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = "#2b2330"; ctx.beginPath(); ctx.ellipse(-3, 0, 5.5, 3.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.6;
      for (let i = -5; i <= -1; i += 2) { ctx.beginPath(); ctx.moveTo(i, -2.8); ctx.lineTo(i, 2.8); ctx.stroke(); }
      ctx.fillStyle = "#3d3140"; ctx.beginPath(); ctx.ellipse(2, 0, 3.2, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#4a3a42"; ctx.beginPath(); ctx.arc(5.6, 0, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = "#d8453c";
      ctx.beginPath(); ctx.arc(6.2, -2, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(6.2, 2, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ======================================================================
  //  脳（FlyWire の実座標に置いたニューロン。2 枚のキャンバス：残像つきの fx と、毎回消す ui）
  // ======================================================================
  const TYPE_COLOR = {
    light_steer: [90, 200, 255], light_fwd: [140, 170, 255], loom: [200, 120, 255],
    retina: [120, 190, 255], odor: [120, 240, 160], drive: [255, 120, 180],
  };
  const ATLAS_COLOR = [[110, 120, 255], [90, 200, 200], [120, 200, 255], [120, 230, 160], [255, 210, 120], [150, 150, 190]];

  function hueColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    // 温かい色（金〜桃〜紫）に寄せる
    const hue = 280 + (h % 120);
    const c = hsl2rgb((hue % 360) / 360, 0.75, 0.62);
    return c;
  }
  function hsl2rgb(h, s, l) {
    const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  }

  class BrainView {
    constructor(fxCanvas, uiCanvas) {
      this.fx = fxCanvas; this.ui = uiCanvas;
      this.fctx = fxCanvas.getContext("2d");
      this.uctx = uiCanvas.getContext("2d");
      this.comets = [];
      this.rings = [];
      this.flashA = 0;
      this.activity = 0;
      this.spikesPerSec = 0;
    }

    setBrain(brain) { this.brain = brain; this.layout = null; }

    resize(w, h, dpr) {
      this.fxDpr = Math.min(dpr, 1.25); // 残像のキャンバスは解像度を抑える（塗る画素数が一番多い）
      for (const [cv, r] of [[this.fx, this.fxDpr], [this.ui, dpr]]) {
        cv.width = Math.round(w * r); cv.height = Math.round(h * r);
        cv.style.width = w + "px"; cv.style.height = h + "px";
      }
      this.fctx.setTransform(this.fxDpr, 0, 0, this.fxDpr, 0, 0);
      this.uctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h; this.dpr = dpr;
      this.layout = null;
    }

    // FlyWire 座標（正面から見た 0..1）→ パネル上の位置
    frame() {
      const pad = 16, eyeW = this.w < 600 ? 0 : Math.min(120, this.w * 0.14);
      const aw = this.w - 2 * (pad + eyeW), ah = this.h - 2 * pad - 20;
      const aspect = 2.08; // FlyWire の脳の横:縦
      const bw = Math.min(aw, ah * aspect), bh = bw / aspect;
      return { x: (this.w - bw) / 2, y: pad + (ah - bh) / 2 + 6, w: bw, h: bh, eyeW };
    }

    buildLayout() {
      const B = this.brain, F = this.frame();
      const pos = new Float32Array(B.N * 2), col = new Array(B.N), size = new Float32Array(B.N);
      const rng = FM.mulberry32(5);
      for (const p of B.pops) {
        const c = p.role === "dn" ? [255, 225, 140]
          : TYPE_COLOR[p.modality] || (p.group === "olf" ? [120, 240, 160] : hueColor(p.label || p.id));
        for (let i = 0; i < p.n; i++) {
          let x, y;
          if (p.pos) { [x, y] = p.pos[i]; }
          else if (p.cols) {
            const cIdx = Math.floor(i / p.perCol);
            x = p.xy[0] + (p.side === "L" ? -1 : 1) * (cIdx - p.cols / 2) * 0.012; y = p.xy[1] + (i % p.perCol) * 0.02;
          } else {
            const a = rng() * TAU, r = Math.sqrt(rng()) * (0.01 + Math.sqrt(p.n) * 0.006);
            x = p.xy[0] + Math.cos(a) * r; y = p.xy[1] + Math.sin(a) * r * 0.8;
          }
          const k = p.offset + i;
          pos[k * 2] = F.x + x * F.w; pos[k * 2 + 1] = F.y + y * F.h;
          col[k] = c;
          size[k] = p.role === "dn" ? 2.6 : p.role === "sensor" ? 0.8 : 1;
        }
      }
      // 背景：全脳（6000 点）と、この回路の静かなニューロンを一度だけ描いておく
      const atlas = document.createElement("canvas");
      atlas.width = Math.round(this.w * this.fxDpr); atlas.height = Math.round(this.h * this.fxDpr);
      const a = atlas.getContext("2d");
      a.setTransform(this.fxDpr, 0, 0, this.fxDpr, 0, 0);
      for (const [x, y, c] of FM.ATLAS || []) {
        a.fillStyle = rgba(ATLAS_COLOR[c], 0.28);
        a.fillRect(F.x + x * F.w, F.y + y * F.h, 1.1, 1.1);
      }
      for (let i = 0; i < B.N; i++) {
        a.fillStyle = rgba(col[i], 0.3);
        a.fillRect(pos[i * 2], pos[i * 2 + 1], 1.2 * size[i], 1.2 * size[i]);
      }
      // 光の玉の画像と、DN かどうかは、ニューロンごとに先に決めておく
      const isDN = new Uint8Array(B.N), isGF = new Uint8Array(B.N);
      for (const p of B.pops) if (p.role === "dn") for (let i = 0; i < p.n; i++) { isDN[p.offset + i] = 1; if (p.id.startsWith("GF")) isGF[p.offset + i] = 1; }
      // DN の位置（ラベル用）
      const dn = B.pops.filter((p) => p.role === "dn").map((p) => ({ p, x: pos[p.offset * 2], y: pos[p.offset * 2 + 1] }));
      // 光のにじみは 1/3 の解像度のキャンバスに点を打ち、拡大して重ねる（1 個ずつ画像を描くより数倍速い）
      const lo = document.createElement("canvas");
      lo.width = Math.ceil(this.w / 3); lo.height = Math.ceil(this.h / 3);
      const colStr = col.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
      // ぼかし用の 2 枚目（小さいキャンバスでぼかすので軽い。filter が無いブラウザではぼかさずに描く）
      const blur = document.createElement("canvas");
      blur.width = lo.width; blur.height = lo.height;
      const bctx = blur.getContext("2d");
      const canBlur = "filter" in bctx;
      this.layout = { pos, col, size, atlas, F, dn, isDN, isGF, lo, lctx: lo.getContext("2d"), colStr, blur, bctx, canBlur };
    }

    // simDt：このフレームで脳が進んだ時間（0 のこともある）。dtFrame：画面の経過時間（動きの速さに使う）
    draw(senses, motor, t, simDt, dtFrame = 1 / 60) {
      if (!this.brain) return;
      if (!this.layout) this.buildLayout();
      const { fctx: c, w, h, brain: B } = this;
      const { pos, size, atlas, F, isDN, isGF } = this.layout;
      dtFrame = Math.min(0.1, Math.max(0, dtFrame));

      // 発火の集計（脳が進んだフレームだけで数える。120 Hz 以上の画面では進まないフレームが混ざる）
      if (simDt > 0) {
        let total = 0;
        for (let i = 0; i < B.N; i++) total += B.spikeCount[i];
        this.spikesPerSec = this.spikesPerSec * 0.9 + (total / simDt) * 0.1;
      }
      const act = Math.min(1, this.spikesPerSec / 60000);
      this.activity += (act - this.activity) * 0.1;

      // 残像：少しずつ暗くする
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "rgba(3,3,12,0.34)";
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 0.45 + this.activity * 0.4;
      c.drawImage(atlas, 0, 0, w, h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "screen";
      const k = Math.max(0.35, Math.min(1, F.w / 640)); // 狭い画面では光の玉を小さく

      // 発火したニューロンから、実際のシナプスに沿って光の粒を飛ばす
      let budget = 500 - this.comets.length;
      for (let i = 0; i < B.N; i++) {
        const n = B.spikeCount[i];
        if (!n) continue;
        if (isDN[i] && this.rings.length < 60) this.rings.push({ x: pos[i * 2], y: pos[i * 2 + 1], r: 4, t: 0, gf: isGF[i] === 1 });
        if (budget <= 0) continue;
        const s0 = B.synStart[i], s1 = B.synStart[i + 1];
        if (s1 > s0 && Math.random() < 0.2 * n) {
          const q = s0 + Math.floor(Math.random() * (s1 - s0));
          this.comets.push({ i, j: B.synPost[q], t: 0, dur: 0.25 + Math.random() * 0.35, inh: B.synW[q] < 0 });
          budget--;
        }
      }
      // 尾はまとめて 2 本のパスで描く（興奮 / 抑制）
      const heads = [];
      for (const inh of [false, true]) {
        c.strokeStyle = inh ? "rgba(90,170,255,0.3)" : "rgba(255,190,120,0.3)";
        c.lineWidth = 1.1;
        c.beginPath();
        for (const m of this.comets) {
          if (m.inh !== inh) continue;
          const u = Math.min(1, m.t + dtFrame / m.dur), u0 = Math.max(0, u - 0.25);
          const x0 = pos[m.i * 2], y0 = pos[m.i * 2 + 1], x1 = pos[m.j * 2], y1 = pos[m.j * 2 + 1];
          const bx = (y1 - y0) * 0.15, by = (x1 - x0) * 0.12;
          const s0 = Math.sin(u0 * Math.PI), s1 = Math.sin(u * Math.PI);
          const hx = x0 + (x1 - x0) * u - bx * s1, hy = y0 + (y1 - y0) * u + by * s1;
          c.moveTo(x0 + (x1 - x0) * u0 - bx * s0, y0 + (y1 - y0) * u0 + by * s0);
          c.lineTo(hx, hy);
          heads.push(hx, hy, inh ? 1 : 0);
        }
        c.stroke();
      }
      const { lo, lctx: g, colStr } = this.layout;
      g.clearRect(0, 0, lo.width, lo.height);
      g.globalAlpha = 0.9;
      for (let q = 0; q < heads.length; q += 3) {
        g.fillStyle = heads[q + 2] ? "rgb(90,170,255)" : "rgb(255,200,140)";
        g.fillRect(heads[q] / 3 - 0.6, heads[q + 1] / 3 - 0.6, 1.2, 1.2);
      }
      for (const m of this.comets) m.t += dtFrame / m.dur;
      this.comets = this.comets.filter((m) => m.t < 1);

      // 光っているニューロン：にじみ（低解像度）＋ 芯（等倍）。静かなものは背景に焼き込み済み
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < B.N; i++) {
        const tr = B.trace[i], fl = B.flash[i];
        if (tr < 1.5 && fl < 0.05) continue;
        const r = (0.7 + Math.min(1.6, tr / 60) + fl * 0.6) * size[i] * k;
        g.globalAlpha = Math.min(1, 0.25 + tr / 150 + fl * 0.3);
        g.fillStyle = colStr[i];
        g.fillRect(pos[i * 2] / 3 - r / 2, pos[i * 2 + 1] / 3 - r / 2, r, r);
        if (tr > 25 || fl > 0.4) {
          c.globalAlpha = Math.min(0.8, 0.3 + fl * 0.5);
          c.fillStyle = colStr[i];
          const cr = 1.6 * size[i];
          c.fillRect(pos[i * 2] - cr / 2, pos[i * 2 + 1] - cr / 2, cr, cr);
        }
      }
      g.globalAlpha = 1;
      const { blur, bctx, canBlur } = this.layout;
      let glow = lo;
      if (canBlur) {
        bctx.clearRect(0, 0, blur.width, blur.height);
        bctx.filter = "blur(1.2px)";
        bctx.drawImage(lo, 0, 0);
        bctx.filter = "none";
        glow = blur;
      }
      c.imageSmoothingEnabled = true;
      c.globalAlpha = 1;
      c.drawImage(glow, 0, 0, w, h);
      c.globalAlpha = 0.6;
      c.drawImage(lo, 0, 0, w, h); // ぼかす前のものも薄く重ねて、光の芯を残す
      c.globalAlpha = 1;
      c.globalCompositeOperation = "screen";

      // DN の波紋と、GF の衝撃波
      for (const g of this.rings) {
        g.t += dtFrame;
        g.r += dtFrame * (g.gf ? 900 : 90);
        const a = Math.max(0, (g.gf ? 0.9 : 0.6) - g.t * (g.gf ? 0.9 : 1.6));
        c.strokeStyle = g.gf ? `rgba(220,170,255,${a})` : `rgba(255,220,150,${a})`;
        c.lineWidth = g.gf ? 3 : 1.5;
        c.beginPath(); c.arc(g.x, g.y, g.r, 0, TAU); c.stroke();
        if (g.gf && !g.flashed) { g.flashed = true; this.flashA = Math.max(this.flashA, 0.3); }
      }
      this.rings = this.rings.filter((g) => g.t < (g.gf ? 1 : 0.4));
      if (this.flashA > 0) {
        c.fillStyle = `rgba(200,160,255,${this.flashA})`; c.fillRect(0, 0, w, h); this.flashA *= 0.8;
        if (this.flashA < 0.01) this.flashA = 0;
      }
      c.globalCompositeOperation = "source-over";

      this.drawUI(senses, motor, t);
    }

    drawUI(senses, motor, t) {
      const { uctx: u, w, h, brain: B } = this;
      const { F, dn } = this.layout;
      u.clearRect(0, 0, w, h);
      u.font = "10px ui-monospace, Menlo, monospace";
      u.textAlign = "left";
      u.fillStyle = "rgba(210,220,255,0.75)";
      const meta = B.circuit.meta;
      const src = meta.name === "flywire" ? "FLYWIRE v783 実データ（視覚・逃避）＋ 模式（嗅覚）" : "模式の回路（比較用）";
      u.fillText(`BRAIN  ${src}`, 14, 16);
      u.fillStyle = "rgba(210,220,255,0.5)";
      u.fillText(`${B.N.toLocaleString()} neurons · ${B.nSyn.toLocaleString()} connections · ${Math.round(this.spikesPerSec).toLocaleString()} spikes/s`, 14, 30);

      // DN のラベル
      u.font = "10px system-ui, sans-serif";
      for (const d of dn) {
        const rate = B.popRate(d.p.id);
        const a = 0.35 + Math.min(0.65, rate / 120);
        u.strokeStyle = `rgba(255,225,150,${a})`; u.lineWidth = 1;
        u.beginPath(); u.arc(d.x, d.y, 7 + Math.min(10, rate / 20), 0, TAU); u.stroke();
        u.fillStyle = `rgba(255,235,190,${a})`;
        u.textAlign = d.p.side === "L" ? "right" : "left";
        u.fillText(d.p.label, d.x + (d.p.side === "L" ? -12 : 12), d.y + 3);
      }

      // 左右の複眼：ハエに見えている世界そのもの
      const narrow = w < 600;
      const eyeR = narrow ? 34 : Math.min(F.h * 0.42, 70);
      for (const side of ["L", "R"]) {
        const lum = side === "L" ? senses.lumL : senses.lumR;
        const cx = narrow ? (side === "L" ? 30 : w - 30) : side === "L" ? F.x - eyeR * 0.55 : F.x + F.w + eyeR * 0.55;
        const cy = narrow ? h - 70 : F.y + F.h * 0.45;
        for (let c = 0; c < senses.cols; c++) {
          for (let row = 0; row < 3; row++) {
            // 列 c：正面（上）→ 後ろ（下）に並べる
            const a = (-0.8 + (c / (senses.cols - 1)) * 1.6) * (Math.PI / 2);
            const rr = eyeR * (0.55 + row * 0.2);
            const x = cx + (side === "L" ? -1 : 1) * Math.cos(a) * rr * 0.6, y = cy + Math.sin(a) * rr;
            const v = Math.min(1, lum[c] / 1.2);
            hex(u, x, y, narrow ? 3.2 : 5.5, `rgba(${180 + 75 * v},${190 + 60 * v},255,${0.08 + v * 0.9})`);
          }
        }
        u.fillStyle = "rgba(200,210,240,0.5)"; u.textAlign = "center";
        u.fillText(side === "L" ? "左目" : "右目", cx, cy + eyeR + 14);
      }

      // 運動の読み出し
      const o = motor.out, cx = w / 2, by = h - 16;
      u.fillStyle = "rgba(200,210,240,0.55)"; u.textAlign = "center";
      u.fillText(`推力 ${Math.round(o.speed)}   旋回 ${o.turn > 0.1 ? "◀ 左" : o.turn < -0.1 ? "右 ▶" : "—"}   ${motor.dn.gf > 25 ? "GF 逃避!" : ""}`, cx, by);
      const tw = 90;
      u.fillStyle = "rgba(255,255,255,0.08)"; u.fillRect(cx - tw, by - 18, tw * 2, 3);
      u.fillStyle = "rgba(255,220,150,0.9)";
      const tv = Math.max(-1, Math.min(1, o.turn / 4.2));
      u.fillRect(tv > 0 ? cx - tv * tw : cx, by - 18, Math.abs(tv) * tw, 3);
      u.textAlign = "left";
      u.fillStyle = "rgba(200,210,240,0.35)";
      u.fillText("金 = 興奮性シナプス　青 = 抑制性シナプス　点線の集団 = 作品側の駆動", 14, h - 6);
    }
  }

  function hex(c, x, y, r, fill) {
    c.fillStyle = fill; c.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath(); c.fill();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  FM.WorldView = WorldView;
  FM.BrainView = BrainView;
  FM.glowSprite = glowSprite;
})();
