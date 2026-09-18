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
      for (const p of world.planes) this.drawPlane(p, t);
      if (world.witch) this.drawWitch(world.witch, t);
      for (const u of world.ufos) this.drawUfo(u, world, t);
      this.drawCity(world, t, vis);
      for (const c of world.clouds) this.drawCloud(c, world.moon, t);
      for (const st of world.streetlights) this.drawStreetlight(st, world, t);
      for (const p of world.papers) this.drawPaper(p, t);
      for (const z of world.zappers) this.drawZapper(z, t);
      for (const fd of world.foods) this.drawFood(fd, t);
      if (world.road) this.drawRoad(world);
      for (const c of world.cars) this.drawCar(c);
      for (const wb of world.webs) this.drawWeb(wb, world, t);
      for (const v of world.vinegars) this.drawVinegar(v, t);
      for (const g of world.frogs) this.drawFrog(g, t);
      for (const fan of world.fans) this.drawFan(fan, t);
      for (const m of world.mirrors) this.drawMirror(m, world, t);
      for (const b of world.fireflies) this.drawFirefly(b, world.time);
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
      if (opts.edit) { // エディタ：スタート位置の目印
        ctx.strokeStyle = "rgba(157,245,180,0.8)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, 22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(157,245,180,0.9)"; ctx.font = "11px system-ui"; ctx.textAlign = "center"; ctx.fillText("START", f.x, f.y + 38);
      }
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

    drawPlane(p, t) {
      const { ctx } = this;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
      ctx.fillStyle = "rgba(20,24,44,0.9)";
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(20, -2); ctx.lineTo(24, 0); ctx.lineTo(20, 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, -12); ctx.lineTo(6, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-24, -7); ctx.lineTo(-20, -7); ctx.lineTo(-14, 0); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "lighter";
      const blink = Math.sin(t * 6 + p.ph * 10) > 0;
      ctx.drawImage(glowSprite([255, 60, 60]), p.x - p.dir * 10 - 6, p.y - 12, 12, 12);
      if (blink) ctx.drawImage(glowSprite([80, 255, 120]), p.x + p.dir * 18 - 5, p.y - 5, 10, 10);
      if (p.strobe) ctx.drawImage(glowSprite([255, 255, 255]), p.x - 30, p.y - 30, 60, 60);
      ctx.globalCompositeOperation = "source-over";
    }

    drawUfo(u, world, t) {
      const { ctx } = this;
      if (u.beam > 0.02) {
        const g = ctx.createLinearGradient(u.x, u.y, u.x, u.y + 420);
        g.addColorStop(0, `rgba(170,255,210,${0.45 * u.beam})`); g.addColorStop(1, "rgba(170,255,210,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(u.x - 16, u.y + 8); ctx.lineTo(u.x + 16, u.y + 8);
        ctx.lineTo(u.x + 18 + 420 * 0.35, u.y + 420); ctx.lineTo(u.x - 18 - 420 * 0.35, u.y + 420); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#1b2238";
      ctx.beginPath(); ctx.ellipse(u.x, u.y, 46, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(160,220,255,0.35)";
      ctx.beginPath(); ctx.ellipse(u.x, u.y - 8, 18, 12, 0, Math.PI, TAU); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      const cols = [[255, 90, 200], [90, 220, 255], [255, 230, 90]];
      for (let i = 0; i < 7; i++) {
        const a = t * 2 + (i / 7) * TAU, x = u.x + Math.cos(a) * 38;
        if (Math.sin(a) > -0.3) ctx.drawImage(glowSprite(cols[i % 3]), x - 6, u.y - 2, 12, 12);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    drawWitch(w, t) {
      const { ctx } = this;
      ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1);
      ctx.fillStyle = "#07060c";
      ctx.fillRect(-30, 6, 52, 2.5); // ほうき
      ctx.beginPath(); ctx.moveTo(-30, 7); ctx.lineTo(-44, 0); ctx.lineTo(-44, 14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(4, 6); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill(); // からだ
      ctx.beginPath(); ctx.arc(1, -12, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(8, -14); ctx.lineTo(2, -30); ctx.closePath(); ctx.fill(); // とんがり帽子
      ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-18, -4 + Math.sin(t * 8) * 3, -24, 2); ctx.lineTo(-4, 2); ctx.fill(); // マント
      ctx.restore();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowSprite([255, 200, 120]), w.x + w.dir * 20 - 7, w.y - 1, 14, 14);
      for (let i = 0; i < 3; i++) ctx.drawImage(glowSprite([255, 230, 170]), w.x - w.dir * (48 + i * 14) + Math.sin(t * 9 + i) * 4, w.y + 4 + Math.cos(t * 7 + i) * 4, 5, 5);
      ctx.globalCompositeOperation = "source-over";
    }

    drawFirefly(b, time) {
      const { ctx } = this;
      const on = Math.max(0, Math.sin(time * 2.2 + b.blink) - 0.55) / 0.45;
      ctx.fillStyle = "rgba(40,50,30,0.8)"; ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      if (on <= 0) return;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = on;
      ctx.drawImage(glowSprite([200, 255, 90]), b.x - 10, b.y - 10, 20, 20);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawWeb(wb, world, t) {
      const { ctx } = this;
      ctx.strokeStyle = "rgba(200,210,235,0.16)"; ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(wb.x, wb.y); ctx.lineTo(wb.x + Math.cos(a) * wb.r, wb.y + Math.sin(a) * wb.r); ctx.stroke();
      }
      for (let r = 10; r < wb.r; r += 11) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU, x = wb.x + Math.cos(a) * r, y = wb.y + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      // 捕まっている間はクモが近づいてくる
      const f = world.fly;
      const stuck = f.state === "stuck" && f.stuck === "web" && Math.hypot(f.x - wb.x, f.y - wb.y) < wb.r + 10;
      const k = stuck ? 1 - f.t / FM.STUCK.web.time : 0;
      const sx = wb.x + (stuck ? (f.x - wb.x) * k : 0), sy = wb.y - wb.r * (1 - k) + (stuck ? (f.y - wb.y) * k : 0);
      ctx.fillStyle = "#0a080c"; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#0a080c"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + d * (8 + i * 1.5), sy - 6 + i * 4 + Math.sin(t * 10 + i) * 1.5); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,60,60,0.8)"; ctx.fillRect(sx - 2, sy - 2, 1.5, 1.5); ctx.fillRect(sx + 0.5, sy - 2, 1.5, 1.5);
    }

    drawVinegar(v, t) {
      const { ctx } = this;
      const g = ctx.createRadialGradient(v.x, v.y - 40, 0, v.x, v.y - 40, 190);
      g.addColorStop(0, "rgba(255,190,120,0.12)"); g.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(v.x, v.y - 40, 190, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(170,200,230,0.18)"; roundRect(ctx, v.x - 20, v.y - 44, 40, 44, 6); ctx.fill();
      ctx.strokeStyle = "rgba(200,220,255,0.45)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(200,120,60,0.7)"; ctx.fillRect(v.x - 18, v.y - 20, 36, 18);
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(v.x - 16, v.y - 20, 30, 2);
      ctx.fillStyle = "rgba(220,230,255,0.4)"; ctx.fillRect(v.x - 22, v.y - 47, 44, 4); // 口
      ctx.fillStyle = "rgba(255,210,150,0.55)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText("酢", v.x, v.y - 26);
      for (let i = 0; i < 3; i++) {
        const k = ((t * 20 + i * 15) % 45) / 45;
        ctx.fillStyle = `rgba(255,200,140,${0.25 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(v.x + Math.sin(t * 2 + i) * 6, v.y - 50 - k * 45, 2, 0, TAU); ctx.fill();
      }
    }

    drawFrog(g, t) {
      const { ctx } = this;
      const lift = g.aim * 8, x = g.x, y = g.y;
      if (g.state === "strike" && g.tongue > 0) {
        const ex = x + 6 + (g.tx - x - 6) * g.tongue, ey = y - 20 - lift + (g.ty - y + 20 + lift) * g.tongue;
        ctx.strokeStyle = "#e0607a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 6, y - 20 - lift); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = "#e0607a"; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#1f3a2a";
      ctx.beginPath(); ctx.ellipse(x, y - 10, 24, 12, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 8, y - 18 - lift, 14, 9, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = g.aim > 0 ? "#ffd84a" : "#c9b63a";
      ctx.beginPath(); ctx.arc(x + 2, y - 26 - lift, 4, 0, TAU); ctx.arc(x + 14, y - 26 - lift, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = "#000"; ctx.fillRect(x + 1, y - 27 - lift, 2, 2); ctx.fillRect(x + 13, y - 27 - lift, 2, 2);
    }

    drawFan(fan, t) {
      const { ctx } = this;
      ctx.strokeStyle = "rgba(180,220,255,0.18)"; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const x = fan.x - 36 + i * 14, ph = (t * 1.6 + i * 0.37) % 1;
        ctx.beginPath(); ctx.moveTo(x, fan.y - 10 - ph * 420); ctx.lineTo(x + Math.sin(ph * 6) * 4, fan.y - 50 - ph * 420); ctx.stroke();
      }
      ctx.fillStyle = "#1c2236"; ctx.fillRect(fan.x - 3, fan.y, 6, 26); ctx.fillRect(fan.x - 16, fan.y + 24, 32, 5);
      ctx.save(); ctx.translate(fan.x, fan.y); ctx.scale(1, 0.35);
      ctx.fillStyle = "rgba(170,200,240,0.55)";
      for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.ellipse(12 * Math.cos(fan.spin), 0, 14, 6, fan.spin, 0, TAU); ctx.fill(); }
      ctx.restore();
    }

    drawMirror(m, world, t) {
      const { ctx } = this;
      const lit = !world.occluded(world.moon.x, world.moon.y, m.x, m.y);
      if (lit) {
        ctx.strokeStyle = "rgba(255,245,220,0.12)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(world.moon.x, world.moon.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glowSprite([255, 245, 215]), m.x - 22, m.y - 22, 44, 44);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = "#2a2f45"; ctx.fillRect(m.x - 2, m.y, 4, 24);
      ctx.fillStyle = lit ? "rgba(230,240,255,0.95)" : "rgba(150,160,190,0.6)";
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 12, 16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#8a7a5a"; ctx.lineWidth = 2; ctx.stroke();
    }

    drawMoon(m, t) {
      const { ctx } = this;
      // 暈：暖かい光の広がりと、外側のうっすら青い輪
      for (const [k, a] of [[10, 0.05], [5.5, 0.1], [2.8, 0.22], [1.6, 0.35]]) {
        const g = ctx.createRadialGradient(m.x, m.y, m.r * 0.95, m.x, m.y, m.r * k);
        g.addColorStop(0, `rgba(255,244,222,${a})`); g.addColorStop(1, "rgba(255,244,222,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * k, 0, TAU); ctx.fill();
      }
      const ring = ctx.createRadialGradient(m.x, m.y, m.r * 6.2, m.x, m.y, m.r * 7.4);
      ring.addColorStop(0, "rgba(170,200,255,0)"); ring.addColorStop(0.5, "rgba(170,200,255,0.035)"); ring.addColorStop(1, "rgba(170,200,255,0)");
      ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 7.4, 0, TAU); ctx.fill();
      // 月面（一度だけ作った画像）
      const tex = moonTexture();
      ctx.save();
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.clip();
      ctx.drawImage(tex, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      ctx.restore();
      // 縁のかすかな光
      ctx.strokeStyle = "rgba(255,248,230,0.35)"; ctx.lineWidth = Math.max(0.6, m.r * 0.03);
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
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

  // ---- 月面：起動時に一度だけ作る（海・クレーター・光条・ざらつき・周縁減光） ----
  let MOON_TEX = null;
  function moonTexture() {
    if (MOON_TEX) return MOON_TEX;
    const N = 320, cv = document.createElement("canvas");
    cv.width = cv.height = N;
    const g = cv.getContext("2d"), img = g.createImageData(N, N), d = img.data;
    const rng = FM.mulberry32(1969);
    // 値ノイズ（なめらかな乱数の場）
    const G = 64, grid = Array.from({ length: G * G }, () => rng());
    const vn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const at = (i, j) => grid[((j & (G - 1)) * G) + (i & (G - 1))];
      const s = (v) => v * v * (3 - 2 * v), u = s(xf), w = s(yf);
      return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - w) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * w;
    };
    const fbm = (x, y) => { let a = 0, f = 1, amp = 0.5; for (let o = 0; o < 5; o++) { a += amp * vn(x * f, y * f); f *= 2.03; amp *= 0.5; } return a; };
    // 海（表側の大きな暗い平原。配置は実際の月をおおまかになぞる。-1..1 の座標）
    const maria = [[-0.28, -0.38, 0.3], [0.1, -0.3, 0.17], [0.25, -0.02, 0.2], [0.47, 0.12, 0.13], [-0.18, 0.36, 0.2],
      [-0.55, -0.05, 0.34], [0.62, -0.28, 0.1], [0.05, 0.12, 0.12], [-0.42, 0.28, 0.16], [0.3, 0.35, 0.1]];
    // クレーター（大きいものは少なく、小さいものは多く）
    const craters = [];
    for (let i = 0; i < 90; i++) {
      const r = 0.012 + Math.pow(rng(), 4) * 0.075;
      craters.push([rng() * 2 - 1, rng() * 2 - 1, r]);
    }
    const tycho = [-0.12, 0.66, 0.045], copern = [-0.3, -0.05, 0.05];
    craters.push(tycho, copern);
    const L = [-0.55, -0.6]; // 光の来る向き（左上）
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const x = (px + 0.5) / N * 2 - 1, y = (py + 0.5) / N * 2 - 1, rr = x * x + y * y;
      const o = (py * N + px) * 4;
      if (rr > 1) { d[o + 3] = 0; continue; }
      let a = 0.84 + (fbm(x * 3 + 7, y * 3 + 3) - 0.5) * 0.22 + (fbm(x * 14, y * 14) - 0.5) * 0.08; // 高地のざらつき
      let mare = 0;
      for (const [mx, my, mr] of maria) {
        const q = Math.hypot(x - mx, y - my) / mr + (fbm(x * 4 + mx * 9, y * 4 + my * 9) - 0.5) * 1.3;
        mare = Math.max(mare, Math.max(0, Math.min(1, (1.1 - q) * 1.4)));
      }
      a = a * (1 - mare * 0.36) + (fbm(x * 9, y * 9) - 0.5) * 0.05;
      for (const [cx, cy, cr] of craters) {
        const dx = x - cx, dy = y - cy, q = Math.hypot(dx, dy) / cr;
        if (q > 1.35) continue;
        const shade = (dx * L[0] + dy * L[1]) / (cr * q + 1e-6); // 光の側 = +、影の側 = -
        if (q < 1) a += -0.025 * (1 - q) - 0.035 * shade * q * (1 - q) * 3; // 窪み：光の反対側の内壁が明るい（満月なので控えめ）
        else a += 0.03 * shade * (1.35 - q) * 3 + 0.02 * (1.35 - q); // 縁：光の側が明るい
      }
      // ティコの光条
      const tx = x - tycho[0], ty = y - tycho[1], tr = Math.hypot(tx, ty);
      if (tr > 0.05 && tr < 0.9) {
        const ang = Math.atan2(ty, tx);
        const ray = Math.pow(Math.max(0, Math.cos(ang * 9 + 0.6)), 60) + Math.pow(Math.max(0, Math.cos(ang * 13 + 2)), 80) * 0.8 + Math.pow(Math.max(0, Math.cos(ang * 5 + 1.3)), 90) * 0.6;
        a += ray * 0.07 * (1 - tr / 0.9) * (0.6 + fbm(tr * 12, ang * 3));
      }
      // 周縁減光と、少し暖かい色
      const limb = 0.62 + 0.38 * Math.pow(1 - rr, 0.35);
      a = Math.max(0.12, Math.min(1.08, a)) * limb;
      d[o] = Math.min(255, 255 * a * 1.0); d[o + 1] = Math.min(255, 255 * a * 0.975); d[o + 2] = Math.min(255, 255 * a * 0.9);
      d[o + 3] = rr > 0.985 ? Math.round(255 * (1 - (rr - 0.985) / 0.015)) : 255;
    }
    g.putImageData(img, 0, 0);
    MOON_TEX = cv;
    return cv;
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
    constructor(fxCanvas, uiCanvas, glCanvas) {
      this.fx = fxCanvas; this.ui = uiCanvas;
      this.fctx = fxCanvas.getContext("2d");
      this.uctx = uiCanvas.getContext("2d");
      // 立体表示（WebGL）が使えればそれを使う。だめなら従来の 2D 表示
      this.gl3 = null;
      if (glCanvas && FM.BrainGL) {
        try { const g = new FM.BrainGL(glCanvas); if (g.ok) this.gl3 = g; } catch (e) { console.warn("3D 表示を使えません", e); }
      }
      if (this.gl3) { fxCanvas.style.display = "none"; this.gl3.attach(uiCanvas.parentElement); }
      else if (glCanvas) glCanvas.style.display = "none";
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
      if (this.gl3) this.gl3.resize(w, h, dpr);
      this.layout = null;
    }

    // FlyWire 座標（正面から見た 0..1）→ パネル上の位置
    frame() {
      const wide = this.w >= 900;
      const sideW = wide ? Math.max(210, Math.min(270, this.w * 0.2)) : 0;
      const top = 30, bottom = wide ? 42 : 96;
      const eyeW = this.w < 600 ? 0 : Math.min(60, this.w * 0.05);
      const x0 = sideW + eyeW + 4, x1 = this.w - sideW - eyeW - 4;
      const aw = Math.max(50, x1 - x0), ah = Math.max(40, this.h - top - bottom);
      const aspect = 2.08; // FlyWire の脳の横:縦
      // 余白を減らすため、横は 1.8 倍、縦は 1.3 倍まで引き伸ばしてよい（形より大きさを優先）
      const bw = Math.min(aw, ah * aspect * 1.8), bh = Math.min(ah, (bw / aspect) * 1.3);
      return { x: x0 + (aw - bw) / 2, y: top + (ah - bh) / 2, w: bw, h: bh, eyeW, sideW, top, bottom, wide };
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
      // 立体の位置（FlyWire の実座標。無い集団は平面の位置から作る）
      const p3 = new Float32Array(B.N * 3);
      const rng3 = FM.mulberry32(9);
      for (const p of B.pops) for (let i = 0; i < p.n; i++) {
        const k = p.offset + i;
        if (p.pos3) { p3[k * 3] = p.pos3[i][0]; p3[k * 3 + 1] = p.pos3[i][1]; p3[k * 3 + 2] = p.pos3[i][2]; }
        else {
          const x = (pos[k * 2] - F.x) / F.w, y = (pos[k * 2 + 1] - F.y) / F.h;
          p3[k * 3] = (x - 0.5) * 2; p3[k * 3 + 1] = -(y - 0.5) * 2 * 0.48; p3[k * 3 + 2] = (rng3() - 0.5) * 0.12;
        }
      }
      if (this.gl3) this.upload3D(p3, col, size);
      // 背景：全脳（6000 点）と、この回路の静かなニューロンを一度だけ描いておく（2D 表示のとき）
      const atlas = document.createElement("canvas");
      if (this.gl3) { atlas.width = atlas.height = 1; } else {
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
      }
      // 光の玉の画像と、DN かどうかは、ニューロンごとに先に決めておく
      const isDN = new Uint8Array(B.N), isGF = new Uint8Array(B.N);
      for (const p of B.pops) if (p.role === "dn") for (let i = 0; i < p.n; i++) { isDN[p.offset + i] = 1; if (p.id.startsWith("GF")) isGF[p.offset + i] = 1; }
      // DN の位置（ラベル用）
      const dn = B.pops.filter((p) => p.role === "dn").map((p) => ({ p, k: p.offset, x: pos[p.offset * 2], y: pos[p.offset * 2 + 1] }));
      // 光のにじみは 1/3 の解像度のキャンバスに点を打ち、拡大して重ねる（1 個ずつ画像を描くより数倍速い）
      const lo = document.createElement("canvas");
      lo.width = Math.ceil(this.w / 3); lo.height = Math.ceil(this.h / 3);
      const colStr = col.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
      // ぼかし用の 2 枚目（小さいキャンバスでぼかすので軽い。filter が無いブラウザではぼかさずに描く）
      const blur = document.createElement("canvas");
      blur.width = lo.width; blur.height = lo.height;
      const bctx = blur.getContext("2d");
      const canBlur = "filter" in bctx;
      // ラベル：集団ごとに重心へ置く。FlyWire の中間層は 3 個以上のものを常に、それ以外は強く反応したときだけ出す
      const isFW = B.circuit.meta.name === "flywire";
      this.lfont = "9px ui-monospace, Menlo, Consolas, monospace";
      const u = this.uctx; u.font = this.lfont;
      const labels = B.pops.map((p) => {
        let sx = 0, sy = 0, X = 0, Y = 0, Z = 0;
        for (let i = 0; i < p.n; i++) {
          const k = p.offset + i;
          sx += pos[k * 2]; sy += pos[k * 2 + 1]; X += p3[k * 3]; Y += p3[k * 3 + 1]; Z += p3[k * 3 + 2];
        }
        const text = labelText(p);
        return {
          p, x: sx / p.n, y: sy / p.n, X: X / p.n, Y: Y / p.n, Z: Z / p.n, text, tw: u.measureText(text).width, color: col[p.offset],
          fixed: !isFW || p.role !== "inter" || p.source !== "flywire" || p.n >= 3,
          prio: p.role === "dn" ? 0 : p.role === "sensor" ? 1 : p.source !== "flywire" ? 2 : 3,
          avg: -1, glow: 0, show: 0,
        };
      }).sort((a, b) => a.prio - b.prio || b.p.n - a.p.n);
      // 計器用：感覚の種類 × 左右 → 集団
      const mods = {};
      for (const p of B.pops) if (p.modality) (mods[p.modality + p.side] ||= []).push(p);
      this.layout = { pos, p3, col, size, atlas, F, dn, isDN, isGF, lo, lctx: lo.getContext("2d"), colStr, blur, bctx, canBlur, labels, mods };
    }

    // GPU に、全脳の背景とニューロンの位置・色を置く
    upload3D(p3, col, size) {
      const A = FM.ATLAS || [], n = A.length;
      const ap = new Float32Array(n * 3), ac = new Float32Array(n * 3), asa = new Float32Array(n * 2);
      A.forEach((e, i) => {
        if (e.length >= 6) { ap[i * 3] = e[3]; ap[i * 3 + 1] = e[4]; ap[i * 3 + 2] = e[5]; }
        else { ap[i * 3] = (e[0] - 0.5) * 2; ap[i * 3 + 1] = -(e[1] - 0.5) * 2 * 0.48; ap[i * 3 + 2] = 0; }
        const c = ATLAS_COLOR[e[2]] || ATLAS_COLOR[5];
        ac[i * 3] = c[0] / 255; ac[i * 3 + 1] = c[1] / 255; ac[i * 3 + 2] = c[2] / 255;
        asa[i * 2] = 0.045; asa[i * 2 + 1] = 0.085; // 全脳の雲：大きく、淡く
      });
      const nc = new Float32Array(col.length * 3);
      col.forEach((c, i) => { nc[i * 3] = c[0] / 255; nc[i * 3 + 1] = c[1] / 255; nc[i * 3 + 2] = c[2] / 255; });
      this.gl3.setData({ atlasPos: ap, atlasCol: ac, atlasSA: asa, neuronPos: p3, neuronCol: nc });
      this.sa3 = new Float32Array(col.length * 2);
      this.comet3 = new Float32Array(8 * 3200);
    }

    // ニューロン k の画面上の位置（立体表示では毎フレーム変わる）
    screenOf(k) {
      const L = this.layout;
      if (!this.gl3) return { x: L.pos[k * 2], y: L.pos[k * 2 + 1], fade: 1 };
      const q = this.gl3.project(L.p3[k * 3], L.p3[k * 3 + 1], L.p3[k * 3 + 2]);
      return q && { x: q.x, y: q.y, fade: this.fade(q.w) };
    }
    // 奥のものほど薄く
    fade(w) { return Math.max(0.3, Math.min(1, 1 - (w - this.gl3.refW) * 0.5)); }

    // 立体表示の 1 フレーム：ニューロンの粒の大きさ・明るさと、シナプスを流れる光の粒
    draw3D(dtFrame) {
      const B = this.brain, L = this.layout, { p3, size, isDN, isGF } = L;
      let budget = 700 - this.comets.length;
      for (let i = 0; i < B.N; i++) {
        const n = B.spikeCount[i];
        if (!n) continue;
        if (isDN[i] && this.rings.length < 60) this.rings.push({ k: i, r: 4, t: 0, gf: isGF[i] === 1 && B.trace[i] > 100 });
        if (budget <= 0) continue;
        const s0 = B.synStart[i], s1 = B.synStart[i + 1];
        if (s1 > s0 && Math.random() < 0.25 * n) {
          const q = s0 + Math.floor(Math.random() * (s1 - s0));
          this.comets.push({ i, j: B.synPost[q], t: 0, dur: 0.3 + Math.random() * 0.4, inh: B.synW[q] < 0 });
          budget--;
        }
      }
      const sa = this.sa3;
      for (let i = 0; i < B.N; i++) {
        const tr = B.trace[i], fl = B.flash[i];
        // 中心部は何百個も重なるので、1 個ずつは控えめに（重なって初めて明るくなる）
        sa[i * 2] = 0.026 * size[i] * (1 + Math.min(1.8, tr / 70) + fl * 1.0);
        sa[i * 2 + 1] = 0.07 + Math.min(0.38, tr / 280) + fl * 0.2;
      }
      // 光の粒：頭と、3 つの尾
      const cd = this.comet3;
      let m = 0;
      for (const c of this.comets) {
        const i3 = c.i * 3, j3 = c.j * 3;
        const dx = p3[j3] - p3[i3], dy = p3[j3 + 1] - p3[i3 + 1], dz = p3[j3 + 2] - p3[i3 + 2];
        const len = Math.hypot(dx, dy, dz);
        for (let k = 0; k < 4 && m < 3200; k++) {
          const u = Math.max(0, Math.min(1, c.t - k * 0.06));
          const arc = Math.sin(u * Math.PI) * 0.12 * len;
          const o = m * 8;
          cd[o] = p3[i3] + dx * u; cd[o + 1] = p3[i3 + 1] + dy * u + arc; cd[o + 2] = p3[i3 + 2] + dz * u;
          if (c.inh) { cd[o + 3] = 0.35; cd[o + 4] = 0.65; cd[o + 5] = 1.0; } else { cd[o + 3] = 1.0; cd[o + 4] = 0.75; cd[o + 5] = 0.5; }
          cd[o + 6] = k ? 0.026 : 0.04; cd[o + 7] = (k ? 0.5 - k * 0.12 : 0.95) * Math.sin(Math.max(0.05, c.t) * Math.PI);
          m++;
        }
      }
      this.gl3.render(L.F, dtFrame, sa, cd, m);
      for (const c of this.comets) c.t += dtFrame / c.dur;
      this.comets = this.comets.filter((c) => c.t < 1.18);
    }

    // 立体表示の DN の波紋と GF の衝撃波（UI キャンバスに、今の画面位置で描く）
    drawRings3D(u, dt) {
      for (const g of this.rings) {
        g.t += dt; g.r += dt * (g.gf ? 900 : 90);
        const q = this.screenOf(g.k);
        if (!q) continue;
        const a = Math.max(0, (g.gf ? 0.9 : 0.6) - g.t * (g.gf ? 0.9 : 1.6)) * q.fade;
        u.strokeStyle = g.gf ? `rgba(220,170,255,${a})` : `rgba(255,220,150,${a})`;
        u.lineWidth = g.gf ? 3 : 1.5;
        u.beginPath(); u.arc(q.x, q.y, g.r, 0, TAU); u.stroke();
      }
      this.rings = this.rings.filter((g) => g.t < (g.gf ? 1 : 0.4));
    }

    // simDt：このフレームで脳が進んだ時間（0 のこともある）。dtFrame：画面の経過時間（動きの速さに使う）
    draw(senses, motor, t, simDt, dtFrame = 1 / 60, hud = {}) {
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
      if (this.gl3) { this.draw3D(dtFrame); this.drawUI(senses, motor, t, hud, dtFrame); return; }

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
        if (isDN[i] && this.rings.length < 60) this.rings.push({ x: pos[i * 2], y: pos[i * 2 + 1], r: 4, t: 0, gf: isGF[i] === 1 && B.trace[i] > 100 }); // 衝撃波は本当に逃げるほどの発火のときだけ
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
        if (g.gf && !g.flashed) { g.flashed = true; this.flashA = Math.max(this.flashA, 0.1); }
      }
      this.rings = this.rings.filter((g) => g.t < (g.gf ? 1 : 0.4));
      if (this.flashA > 0) {
        c.fillStyle = `rgba(200,160,255,${this.flashA})`; c.fillRect(0, 0, w, h); this.flashA *= 0.8;
        if (this.flashA < 0.01) this.flashA = 0;
      }
      c.globalCompositeOperation = "source-over";

      this.drawUI(senses, motor, t, hud, dtFrame);
    }

    // ---------------- 計器盤（毎フレーム描き直す UI キャンバス） ----------------
    drawUI(senses, motor, t, hud, dtFrame) {
      const { uctx: u, w, h, brain: B } = this;
      const L = this.layout, F = L.F;
      u.clearRect(0, 0, w, h);
      u.textBaseline = "alphabetic";

      // 発火の履歴（10 Hz で 12 秒ぶん）と、光っているニューロンの数
      this.hist ||= new Float32Array(120);
      this.histT = (this.histT || 0) + dtFrame;
      if (this.histT >= 0.1) { this.histT = 0; this.hist.copyWithin(0, 1); this.hist[119] = this.spikesPerSec; }
      let active = 0;
      for (let i = 0; i < B.N; i++) if (B.trace[i] > 1.5) active++;

      // 見出し
      u.textAlign = "left"; u.font = `10px ${MONO}`;
      u.fillStyle = INK(0.85);
      const src = B.circuit.meta.name === "flywire" ? "FLYWIRE v783 実データ（視覚・逃避）＋ 模式（嗅覚）" : "模式の回路（比較用）";
      u.fillText(`BRAIN  ${src}`, F.sideW + 12, 16);
      u.fillStyle = INK(0.5);
      u.fillText(`${B.N.toLocaleString()} neurons · ${B.nSyn.toLocaleString()} connections`, F.sideW + 12, 30);

      if (this.gl3) this.drawRings3D(u, dtFrame);
      this.drawDNRings(u);
      this.drawLabels(u, dtFrame);
      if (this.gl3) {
        u.font = `9px ${MONO}`; u.textAlign = "right"; u.fillStyle = INK(0.3);
        u.fillText("ドラッグで回転 ／ ホイールで拡大 ／ ダブルクリックで正面", F.x + F.w - 4, F.y + F.h - 4);
      }
      this.drawEyes(u, senses);
      if (F.wide) {
        this.drawSensesPanel(u, senses, hud, 8, 8, F.sideW - 12, h - F.bottom - 12);
        this.drawMotorPanel(u, motor, hud, w - F.sideW + 4, 8, F.sideW - 12, h - F.bottom - 12);
      }
      this.drawBottom(u, senses, motor, hud, active, t);
    }

    // 集団ごとの発火率（感覚の種類 × 左右でまとめる）
    modRate(mod, side) {
      const ps = this.layout.mods[mod + side];
      if (!ps) return 0;
      let s = 0, n = 0;
      for (const p of ps) { s += this.brain.popRate(p.id) * p.n; n += p.n; }
      return s / n;
    }
    rate(id) { return this.brain.popById[id] ? this.brain.popRate(id) : 0; }

    drawDNRings(u) {
      for (const d of this.layout.dn) {
        const r = this.brain.popRate(d.p.id), q = this.screenOf(d.k);
        if (!q) continue;
        u.strokeStyle = `rgba(255,225,150,${(0.3 + Math.min(0.6, r / 150)) * q.fade})`; u.lineWidth = 1;
        u.beginPath(); u.arc(q.x, q.y, 6 + Math.min(10, r / 20), 0, TAU); u.stroke();
      }
    }

    // 特別な瞬間（逃避・食事・月・死・魔女…）に、ラベル全体を一度だけ光らせる
    special(strength = 1) { this.specialA = Math.max(this.specialA || 0, strength); }

    // 集団のラベル。ふだんは発火に応じて明るさが変わるだけ。
    // 枠つきで光るのは、特別な瞬間と、その集団だけが極端に跳ね上がったとき
    drawLabels(u, dt) {
      const B = this.brain, placed = [];
      this.specialA = Math.max(0, (this.specialA || 0) - dt * 1.4);
      const sp = this.specialA;
      u.font = this.lfont; u.textAlign = "left"; u.textBaseline = "middle";
      for (const lb of this.layout.labels) {
        const r = B.popRate(lb.p.id);
        if (lb.avg < 0) lb.avg = r; // 最初のフレームは今の値から始める
        lb.avg += (r - lb.avg) * Math.min(1, dt / 3); // 3 秒の平均
        const level = Math.min(1, r / 160); // ふだんの明るさ
        const burst = r > 90 && r > lb.avg * 3 + 40 ? 1 : 0; // その集団だけの極端な跳ね上がり
        lb.glow = Math.max(burst, lb.glow - dt * 1.5);
        if (!lb.fixed) { if (burst) lb.show = 1.5; lb.show -= dt; if (lb.show <= 0 && sp < 0.3) continue; }
        let ax = lb.x, ay = lb.y, fade = 1;
        if (this.gl3) {
          const q = this.gl3.project(lb.X, lb.Y, lb.Z);
          if (!q) continue;
          ax = q.x; ay = q.y; fade = this.fade(q.w);
          if (fade < 0.45 && lb.prio > 1 && sp < 0.3) continue; // 奥の中間層のラベルは省く
        }
        u.globalAlpha = fade;
        const x = ax + 5, y = ay, bx = x - 2, by = y - 6, bw = lb.tw + 4, bh = 12;
        let hit = false;
        for (const q of placed) if (bx < q[0] + q[2] && bx + bw > q[0] && by < q[1] + q[3] && by + bh > q[1]) { hit = true; break; }
        if (hit) continue;
        placed.push([bx, by, bw, bh]);
        const g = Math.max(lb.glow * 0.8, sp * (0.4 + 0.6 * level));
        u.fillStyle = rgba(lb.color, 0.35 + 0.65 * level); u.fillRect(ax - 1.5, ay - 1.5, 3, 3);
        if (g > 0.25) {
          u.strokeStyle = `rgba(255,215,140,${g * 0.7})`; u.lineWidth = 1; u.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
          u.shadowColor = "rgba(255,220,160,0.8)"; u.shadowBlur = 6 * g;
          u.fillStyle = `rgba(255,${240 - 25 * g},${205 - 50 * g},${0.5 + 0.5 * g})`;
        } else {
          u.fillStyle = lb.p.source === "game" ? `rgba(255,150,190,${0.35 + 0.5 * level})` : INK(0.28 + 0.6 * level);
        }
        u.fillText(lb.text, x, y);
        u.shadowBlur = 0;
      }
      u.globalAlpha = 1;
      u.textBaseline = "alphabetic";
    }

    // 左右の複眼：ハエに見えている世界そのもの
    drawEyes(u, senses) {
      const F = this.layout.F;
      if (!F.eyeW) return;
      const eyeR = Math.min(F.h * 0.42, F.eyeW * 0.95, 70);
      u.font = `10px ${MONO}`;
      for (const side of ["L", "R"]) {
        const lum = side === "L" ? senses.lumL : senses.lumR;
        const cx = side === "L" ? F.x - eyeR * 0.55 : F.x + F.w + eyeR * 0.55; // 脳のすぐ脇に
        const cy = F.y + F.h * 0.45;
        for (let c = 0; c < senses.cols; c++) {
          for (let row = 0; row < 3; row++) {
            const a = (-0.8 + (c / (senses.cols - 1)) * 1.6) * (Math.PI / 2); // 列 c：正面（上）→ 後ろ（下）
            const rr = eyeR * (0.55 + row * 0.2);
            const x = cx + (side === "L" ? -1 : 1) * Math.cos(a) * rr * 0.6, y = cy + Math.sin(a) * rr;
            const v = Math.min(1, lum[c] / 1.2);
            hex(u, x, y, Math.max(3, eyeR * 0.08), `rgba(${180 + 75 * v},${190 + 60 * v},255,${0.08 + v * 0.9})`);
          }
        }
        u.fillStyle = INK(0.5); u.textAlign = "center";
        u.fillText(side === "L" ? "左目" : "右目", cx, cy + eyeR + 14);
      }
    }

    // ---- 左：感覚 ----
    drawSensesPanel(u, senses, hud, x, y, w, h) {
      panel(u, x, y, w, h, "SENSES  感覚");
      const g = hud.game, cx = x + 10, cw = w - 20;
      let yy = y + 32;
      yy = retinaStrip(u, senses, cx, yy, cw, 14) + 10;
      const rows = [
        ["LC10 追跡 左", this.modRate("light_steer", "L") || this.modRate("retina", "L"), 150, C_VIS],
        ["LC10 追跡 右", this.modRate("light_steer", "R") || this.modRate("retina", "R"), 150, C_VIS],
        ["LC9/31 前進 左", this.modRate("light_fwd", "L"), 150, C_VIS],
        ["LC9/31 前進 右", this.modRate("light_fwd", "R"), 150, C_VIS],
        ["接近 LPLC2/LC4 左", this.modRate("loom", "L"), 220, C_LOOM],
        ["接近 LPLC2/LC4 右", this.modRate("loom", "R"), 220, C_LOOM],
        ["匂い Or42b 左", this.modRate("odor", "L"), 150, C_OLF],
        ["匂い Or42b 右", this.modRate("odor", "R"), 150, C_OLF],
        ["空腹", g ? g.hunger * 100 : 0, 100, C_WARN, g ? `${Math.round(g.hunger * 100)}%` : "—"],
      ];
      const rowH = Math.max(15, Math.min(22, (y + h - yy - 4) / rows.length));
      for (const [label, v, max, c, txt] of rows) {
        if (yy + rowH > y + h) break;
        meter(u, cx, yy + 8, cw, label, v, max, c, txt ?? `${Math.round(v)} Hz`);
        yy += rowH;
      }
    }

    // ---- 右：運動 ----
    drawMotorPanel(u, motor, hud, x, y, w, h) {
      panel(u, x, y, w, h, "MOTOR  運動（下行ニューロン）");
      const cx = x + 10, cw = w - 20, half = (cw - 56) / 2;
      let yy = y + 30;
      u.font = `9px ${MONO}`; u.textAlign = "center"; u.fillStyle = INK(0.45);
      u.fillText("左", cx + 56 + half / 2, yy); u.fillText("右", cx + 56 + half * 1.5 + 4, yy);
      yy += 8;
      const rows = [["DNa02 旋回", "DNa02", 200], ["DNa01", "DNa01", 200], ["DNp09 推力", "DNp09", 250], ["MDN 後退", "MDN", 100], ["GF 逃避", "GF", 200]];
      const rowH = Math.max(14, Math.min(19, (h - 150) / rows.length));
      for (const [label, id, max] of rows) {
        u.textAlign = "left"; u.font = `9px ${MONO}`; u.fillStyle = INK(0.62);
        u.fillText(label, cx, yy + 7);
        const c = id === "GF" || id === "MDN" ? C_LOOM : C_MOTOR;
        segBar(u, cx + 56, yy, half, 7, this.rate(`${id}_L`) / max, c);
        segBar(u, cx + 60 + half, yy, half, 7, this.rate(`${id}_R`) / max, c);
        yy += rowH;
      }
      // 計器：旋回・推力・方位
      const o = motor.out, r = Math.max(18, Math.min(34, (y + h - yy - 26) / 2, cw / 6.6));
      const gy = Math.min(y + h - r - 18, yy + r + 12);
      const gx = [cx + cw / 6, cx + cw / 2, cx + (cw * 5) / 6];
      turnGauge(u, gx[0], gy, r, o.turn / 4.2);
      arcGauge(u, gx[1], gy, r, o.speed / 200, `${Math.round(o.speed)}`, "推力 px/s");
      const f = hud.world && hud.world.fly;
      let moonAz = null;
      if (hud.world) moonAz = hud.world.view(hud.world.moon.x, hud.world.moon.y).az;
      compass(u, gx[2], gy, r, f ? f.h : 0, moonAz);
      if (motor.dn.gf > motor.GF_THRESHOLD) {
        u.fillStyle = `rgba(255,110,130,${0.6 + 0.4 * Math.sin(performance.now() / 60)})`;
        u.font = `bold 10px ${MONO}`; u.textAlign = "right"; u.fillText("GF 逃避!", x + w - 10, y + 15);
      }
    }

    // ---- 下：発火の推移と数値 ----
    drawBottom(u, senses, motor, hud, active, t) {
      const { w, h } = this, F = this.layout.F, B = this.brain;
      const y0 = h - F.bottom + 4;
      u.strokeStyle = "rgba(150,170,230,0.18)"; u.beginPath(); u.moveTo(0, y0 - 2.5); u.lineTo(w, y0 - 2.5); u.stroke();
      let x = 12, yLine = y0 + 12;
      if (!F.wide) {
        // 狭い画面：ハエの視界と、DN の小さなバー
        retinaStrip(u, senses, 12, y0 + 12, Math.min(260, w * 0.5), 10);
        const bx = Math.min(290, w * 0.5 + 24), bw = w - bx - 12;
        const dn = [["DNa02 左", this.rate("DNa02_L"), 200], ["DNa02 右", this.rate("DNa02_R"), 200], ["DNp09", (this.rate("DNp09_L") + this.rate("DNp09_R")) / 2, 250], ["GF", Math.max(this.rate("GF_L"), this.rate("GF_R")), 200]];
        dn.forEach(([l, v, m], i) => meter(u, bx + (i % 2) * (bw / 2 + 4), y0 + 14 + Math.floor(i / 2) * 20, bw / 2 - 4, l, v, m, i === 3 ? C_LOOM : C_MOTOR, `${Math.round(v)}`));
        yLine = y0 + 58;
      }
      // 発火の推移
      const sw = Math.min(300, w * 0.32), sh = 22, sy = yLine;
      u.font = `9px ${MONO}`; u.textAlign = "left"; u.fillStyle = INK(0.5);
      u.fillText("SPIKES/S", x, sy - 2);
      let max = 20000;
      for (const v of this.hist) max = Math.max(max, v);
      u.strokeStyle = "rgba(255,205,120,0.85)"; u.lineWidth = 1.2; u.beginPath();
      for (let i = 0; i < 120; i++) { const px = x + 56 + (i / 119) * (sw - 56), py = sy + sh - 4 - (this.hist[i] / max) * (sh - 6); i ? u.lineTo(px, py) : u.moveTo(px, py); }
      u.stroke();
      // 数値
      const o = motor.out, g = hud.game;
      const cells = [
        ["SPIKES/S", Math.round(this.spikesPerSec).toLocaleString()],
        ["ACTIVE", `${active.toLocaleString()} / ${B.N.toLocaleString()}`],
        ["THRUST", `${Math.round(o.speed)} px/s`],
        ["YAW", `${o.turn > 0.1 ? "◀ " : o.turn < -0.1 ? "▶ " : ""}${Math.round(Math.abs(o.turn) * 57.3)}°/s`],
        ["ENERGY", g ? `${Math.max(0, Math.round(g.energy))}%` : "—"],
        ["T", `${t.toFixed(1)} s`],
      ];
      let cxp = x + sw + 16;
      for (const [k, v] of cells) {
        if (cxp + 70 > w) break;
        u.fillStyle = INK(0.4); u.font = `8px ${MONO}`; u.fillText(k, cxp, sy + 4);
        u.fillStyle = "rgba(255,225,170,0.92)"; u.font = `11px ${MONO}`; u.fillText(v, cxp, sy + 17);
        cxp += Math.max(78, u.measureText(v).width + 18);
      }
      if (F.wide) {
        u.textAlign = "right"; u.fillStyle = INK(0.3); u.font = `9px ${MONO}`;
        u.fillText("金 = 興奮性　青 = 抑制性　桃 = 作品側の駆動　光るラベル = 反応が強い集団", w - 12, h - 6);
      }
    }
  }

  // ======================================================================
  //  計器の部品
  // ======================================================================
  const MONO = "ui-monospace, Menlo, Consolas, monospace";
  const INK = (a) => `rgba(210,220,255,${a})`;
  const C_VIS = [110, 200, 255], C_LOOM = [200, 130, 255], C_OLF = [120, 235, 160], C_MOTOR = [255, 205, 120], C_WARN = [255, 140, 120];

  // 集団のラベル。FlyWire の入力には役割を添える
  function labelText(p) {
    const side = p.side === "L" ? " L" : p.side === "R" ? " R" : "";
    if (p.role === "dn" || p.source !== "flywire") return p.label + (p.role === "dn" ? "" : side);
    const t = p.label;
    if (/^LC10/.test(t)) return `${t} 追跡${side}`;
    if (/^(LC9|LC31a)$/.test(t)) return `${t} 前進${side}`;
    if (/^(LPLC2|LC4)$/.test(t)) return `${t} 接近${side}`;
    return t + side;
  }

  function panel(u, x, y, w, h, title) {
    roundRect(u, x + 0.5, y + 0.5, w - 1, h - 1, 8);
    u.fillStyle = "rgba(8,12,30,0.55)"; u.fill();
    u.strokeStyle = "rgba(150,170,230,0.22)"; u.lineWidth = 1; u.stroke();
    u.fillStyle = "rgba(255,205,120,0.9)"; u.font = `bold 10px ${MONO}`; u.textAlign = "left";
    u.fillText(title, x + 10, y + 16);
    u.fillStyle = "rgba(255,205,120,0.25)"; u.fillRect(x + 10, y + 21, w - 20, 1);
  }

  // 目盛りつきのバー（上に名前と値）
  function meter(u, x, y, w, label, v, max, color, text) {
    u.font = `9px ${MONO}`; u.textAlign = "left"; u.fillStyle = INK(0.62);
    u.fillText(label, x, y);
    u.textAlign = "right"; u.fillStyle = "rgba(255,230,180,0.9)";
    u.fillText(text, x + w, y);
    u.textAlign = "left";
    segBar(u, x, y + 3, w, 5, v / max, color);
  }

  function segBar(u, x, y, w, h, f, color) {
    f = Math.max(0, Math.min(1, f || 0));
    const segs = Math.max(8, Math.floor(w / 6)), sw = w / segs;
    for (let i = 0; i < segs; i++) {
      const on = i < f * segs;
      u.fillStyle = on ? (i / segs > 0.85 ? "rgba(255,120,120,0.95)" : rgba(color, 0.4 + 0.6 * (i / segs))) : "rgba(255,255,255,0.06)";
      u.fillRect(x + i * sw, y, sw - 1.2, h);
    }
  }

  // ハエに見えているもの：左目の外側 … 正面 … 右目の外側
  function retinaStrip(u, senses, x, y, w, h) {
    u.font = `9px ${MONO}`; u.textAlign = "left"; u.fillStyle = INK(0.62);
    u.fillText("ハエに見えているもの", x, y);
    u.textAlign = "right"; u.fillStyle = INK(0.35); u.fillText("左 ← 正面 → 右", x + w, y);
    const cells = [...Array.from(senses.lumL).reverse(), ...senses.lumR];
    const cw = w / cells.length;
    cells.forEach((v, i) => {
      const a = Math.min(1, v / 1.2);
      u.fillStyle = `rgba(${190 + 65 * a},${200 + 50 * a},255,${0.06 + a * 0.94})`;
      u.fillRect(x + i * cw, y + 4, cw - 1.5, h);
    });
    u.fillStyle = "rgba(255,205,120,0.8)"; u.fillRect(x + w / 2 - 0.5, y + 2, 1, h + 4);
    u.textAlign = "left";
    return y + 4 + h;
  }

  function dialFace(u, x, y, r, label) {
    u.beginPath(); u.arc(x, y, r, 0, TAU);
    u.fillStyle = "rgba(4,6,18,0.8)"; u.fill();
    u.strokeStyle = "rgba(150,170,230,0.35)"; u.lineWidth = 1; u.stroke();
    u.font = `8px ${MONO}`; u.fillStyle = INK(0.5); u.textAlign = "center";
    u.fillText(label, x, y + r + 11);
  }

  // 旋回計：針が左右に振れる（左が負ではなく、画面どおり左に倒れる）
  function turnGauge(u, x, y, r, v) {
    dialFace(u, x, y, r, "旋回");
    u.strokeStyle = INK(0.3);
    for (let k = -2; k <= 2; k++) {
      const a = -Math.PI / 2 + k * 0.45;
      u.beginPath(); u.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); u.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); u.stroke();
    }
    const a = -Math.PI / 2 - Math.max(-1, Math.min(1, v)) * 0.9;
    u.strokeStyle = "rgba(255,210,130,0.95)"; u.lineWidth = 2;
    u.beginPath(); u.moveTo(x, y); u.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); u.stroke();
    // 小さなハエの影（翼の傾き）
    u.save(); u.translate(x, y + r * 0.35); u.rotate(-v * 0.6);
    u.fillStyle = "rgba(255,210,130,0.7)"; u.fillRect(-r * 0.45, -1, r * 0.9, 2); u.fillRect(-1.5, -3, 3, 5);
    u.restore();
    u.lineWidth = 1;
  }

  // 推力計：下から時計回りに振れる弧
  function arcGauge(u, x, y, r, f, text, label) {
    dialFace(u, x, y, r, label);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    u.lineWidth = 3; u.strokeStyle = "rgba(255,255,255,0.08)";
    u.beginPath(); u.arc(x, y, r * 0.8, a0, a1); u.stroke();
    f = Math.max(0, Math.min(1, f));
    u.strokeStyle = f > 0.85 ? "rgba(255,130,120,0.95)" : "rgba(255,205,120,0.95)";
    u.beginPath(); u.arc(x, y, r * 0.8, a0, a0 + (a1 - a0) * f); u.stroke();
    u.lineWidth = 1;
    u.fillStyle = "rgba(255,230,180,0.95)"; u.font = `${Math.round(r * 0.42)}px ${MONO}`; u.textAlign = "center";
    u.fillText(text, x, y + r * 0.15);
  }

  // 方位計：ハエの向き。月の方角は人間のための目印（ハエの脳には「月」は無い）
  function compass(u, x, y, r, heading, moonAz) {
    dialFace(u, x, y, r, "方位 ◯=月");
    u.strokeStyle = INK(0.25);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      u.beginPath(); u.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); u.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); u.stroke();
    }
    // ハエの向き（画面の上 = 空）
    u.strokeStyle = "rgba(140,210,255,0.95)"; u.lineWidth = 2;
    u.beginPath(); u.moveTo(x, y); u.lineTo(x + Math.cos(heading) * r * 0.8, y + Math.sin(heading) * r * 0.8); u.stroke();
    u.lineWidth = 1;
    if (moonAz != null) {
      const a = heading - moonAz; // 世界での月の方角
      u.strokeStyle = "rgba(255,240,205,0.9)";
      u.beginPath(); u.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, 3.2, 0, TAU); u.stroke();
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
  FM.moonTexture = moonTexture;
})();
