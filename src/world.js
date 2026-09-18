// 2D の世界と、ハエの身体（ゲームレイヤ：大胆に単純化してよい部分）
//
// 夜の街を横から見た世界。幅 1000、高さはステージごと。y は下向き。
// ハエの向き h は (cos h, sin h) の方向。「左に曲がる」＝ 画面上で反時計回り ＝ h が減る。
// （本物のハエは 3 次元を飛ぶ。ここでは体の左右を、この平面での回転に置き換えている）
(function () {
  const FM = (window.FM = window.FM || {});
  const FLY_R = 7;
  const TAU = Math.PI * 2;

  class World {
    constructor(stage, rng) {
      this.rng = rng;
      this.W = 1000;
      this.H = stage.H;
      this.ground = stage.H - 60;
      this.stage = stage;
      this.moon = { x: stage.moon[0], y: stage.moon[1], r: 42, I: 1.0 };
      this.lamp = { x: 0, y: 0, on: false };
      this.foods = [];
      this.clouds = (stage.clouds || []).map(([x, y, r]) => ({ x, y, r }));
      this.streetlights = (stage.streetlights || []).map(([x, y]) => ({ x, y }));
      this.zappers = (stage.zappers || []).map(([x, y]) => ({ x, y, r: 20, zap: 0 }));
      this.papers = (stage.papers || []).map(([x, y, h]) => ({ x, y, w: 26, h }));
      this.swatters = (stage.swatters || []).map(([x, y]) => this.makeSwatter(x, y));
      this.road = stage.road ? { y: this.H - 38 } : null;
      this.cars = [];
      this.carTimer = 1.5;
      this.events = [];
      this.time = 0;
      this.resetFly();
    }

    makeSwatter(x, y) {
      return { x, y, state: "hover", t: 2 + this.rng() * 2, tx: x, ty: y, shadow: 0, slam: 0 };
    }

    resetFly() {
      const [x, y] = this.stage.start;
      this.fly = {
        x, y, h: -Math.PI / 2 + (this.rng() - 0.5) * 0.8,
        v: 60, state: "fly", t: 0, stuckTo: null, rescue: 0,
        dash: 0, dashDir: 0, trail: [], wing: 0,
      };
    }

    // ---------------- ハエから見た世界（感覚の計算に使う） ----------------

    view(x, y) {
      const f = this.fly;
      const dx = x - f.x, dy = y - f.y;
      let rel = Math.atan2(dy, dx) - f.h;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      return { az: -rel, d: Math.hypot(dx, dy) };
    }

    // ハエ → 点 の線分が雲に遮られるか
    occluded(x, y) {
      const f = this.fly;
      const dx = x - f.x, dy = y - f.y, L2 = dx * dx + dy * dy || 1;
      for (const c of this.clouds) {
        const t = Math.max(0, Math.min(1, ((c.x - f.x) * dx + (c.y - f.y) * dy) / L2));
        const px = f.x + t * dx - c.x, py = f.y + t * dy - c.y;
        if (px * px + py * py < c.r * c.r) return true;
      }
      return false;
    }

    // 光源。I は「ハエにとっての」明るさ。月もランプも殺虫灯も、ここではただの光
    lights() {
      const f = this.fly, out = [];
      const near = (x, y, k, off, max) => Math.min(max, k / (Math.hypot(x - f.x, y - f.y) + off));
      out.push({ x: this.moon.x, y: this.moon.y, r: this.moon.r, I: this.moon.I, kind: "moon" });
      if (this.lamp.on) out.push({ x: this.lamp.x, y: this.lamp.y, r: 10, I: near(this.lamp.x, this.lamp.y, 300, 50, 2.4), kind: "lamp" });
      for (const s of this.streetlights) out.push({ x: s.x, y: s.y, r: 14, I: near(s.x, s.y, 380, 120, 2.0), kind: "street" });
      // 紫外線はハエの R7 に強く効く（人間の目には暗い青紫に見える）
      for (const z of this.zappers) out.push({ x: z.x, y: z.y, r: 16, I: near(z.x, z.y, 560, 120, 3.0), kind: "zapper" });
      for (const c of this.cars) {
        const hx = c.x + c.dir * 60, hy = c.y - 8;
        const dx = f.x - hx, dy = f.y - hy, d = Math.hypot(dx, dy) || 1;
        const cone = Math.max(0, (dx * c.dir) / d); // 前を照らす
        if (cone > 0.2) out.push({ x: hx, y: hy, r: 8, I: cone * near(hx, hy, 420, 100, 2.2), kind: "car" });
      }
      return out;
    }

    // 迫ってくる暗いもの（見かけの大きさで LPLC2 を駆動する）
    loomers() {
      const out = this.clouds.map((c) => ({ x: c.x, y: c.y, r: c.r }));
      for (const s of this.swatters) if (s.shadow > 0) out.push({ x: s.tx, y: s.ty, r: 12 + s.shadow * 90, dark: true });
      for (const c of this.cars) out.push({ x: c.x, y: c.y, r: 40 });
      return out;
    }

    odorAt(x, y) {
      let c = 0;
      for (const f of this.foods) c += Math.exp(-Math.hypot(x - f.x, y - f.y) / 160);
      // ハエトリ紙も甘い匂いを出す
      for (const p of this.papers) c += 0.8 * Math.exp(-Math.hypot(x - p.x, y - (p.y + p.h / 2)) / 150);
      return c;
    }

    // ---------------- 1 フレーム進める ----------------
    // motor: { speed px/s, turn rad/s（左が正）, dash: bool }
    step(dt, motor) {
      const f = this.fly;
      this.events.length = 0;
      this.time += dt;
      this.updateHazards(dt);
      f.wing += dt * 40;

      if (f.state === "fly") {
        if (motor.dash && f.dash <= 0) {
          f.dash = 0.22;
          f.dashDir = f.h + Math.PI * (0.6 + this.rng() * 0.8) * (this.rng() < 0.5 ? 1 : -1);
          this.events.push({ type: "dash", x: f.x, y: f.y });
        }
        if (f.dash > 0) {
          f.dash -= dt;
          f.x += Math.cos(f.dashDir) * 520 * dt;
          f.y += Math.sin(f.dashDir) * 520 * dt;
          f.h += (Math.atan2(Math.sin(f.dashDir - f.h), Math.cos(f.dashDir - f.h))) * 8 * dt;
        } else {
          f.v += (motor.speed - f.v) * Math.min(1, dt / 0.25);
          f.h -= motor.turn * dt;
          f.x += Math.cos(f.h) * f.v * dt;
          f.y += Math.sin(f.h) * f.v * dt;
        }
        this.collide(dt);
      } else if (f.state === "eat") {
        f.t -= dt;
        if (f.t <= 0) { f.state = "fly"; f.v = 80; f.h = -Math.PI / 2; }
      } else if (f.state === "stuck") {
        f.t -= dt;
        f.x += (Math.random() - 0.5) * 1.2; // もがく
        if (f.rescue >= 6) {
          f.state = "fly"; f.rescue = 0; f.dash = 0.25; f.dashDir = f.h + Math.PI;
          this.events.push({ type: "freed", x: f.x, y: f.y });
        } else if (f.t <= 0) this.kill("paper");
      }

      f.trail.push({ x: f.x, y: f.y });
      if (f.trail.length > 240) f.trail.shift();
      return this.events;
    }

    collide(dt) {
      const f = this.fly;
      // 端と地面
      if (f.x < FLY_R) { f.x = FLY_R; f.h = Math.PI - f.h; }
      if (f.x > this.W - FLY_R) { f.x = this.W - FLY_R; f.h = Math.PI - f.h; }
      if (f.y < FLY_R) { f.y = FLY_R; f.h = -f.h; }
      if (f.y > this.ground - FLY_R) { f.y = this.ground - FLY_R; f.h = -Math.abs(f.h) || -Math.PI / 2; }

      for (const c of this.clouds) {
        const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy), lim = c.r + FLY_R;
        if (d < lim && d > 0) {
          f.x = c.x + (dx / d) * (lim + 1); f.y = c.y + (dy / d) * (lim + 1);
          f.h = Math.atan2(dy, dx) + (this.rng() - 0.5);
          if (!c.cool || c.cool <= 0) { this.events.push({ type: "bump", x: f.x, y: f.y }); c.cool = 0.8; }
        }
        if (c.cool > 0) c.cool -= dt;
      }
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const fd = this.foods[i];
        if (Math.hypot(f.x - fd.x, f.y - fd.y) < FLY_R + 22) {
          this.foods.splice(i, 1);
          f.state = "eat"; f.t = 1.0; f.x = fd.x; f.y = fd.y - 4;
          this.events.push({ type: "eat", x: fd.x, y: fd.y });
          return;
        }
      }
      for (const p of this.papers) {
        if (f.x > p.x - p.w / 2 - 3 && f.x < p.x + p.w / 2 + 3 && f.y > p.y && f.y < p.y + p.h) {
          f.state = "stuck"; f.t = 4; f.rescue = 0; f.stuckTo = p;
          this.events.push({ type: "stuck", x: f.x, y: f.y });
          return;
        }
      }
      for (const z of this.zappers) {
        if (Math.hypot(f.x - z.x, f.y - z.y) < z.r + FLY_R + 4) { z.zap = 0.5; this.kill("zapper"); return; }
      }
      for (const s of this.streetlights) {
        if (Math.hypot(f.x - s.x, f.y - s.y) < 70) this.events.push({ type: "heat" });
      }
      for (const c of this.cars) {
        if (Math.abs(f.x - c.x) < 64 && f.y > c.y - 30 && f.y < c.y + 18) { this.kill("car"); return; }
      }
      if (Math.hypot(f.x - this.moon.x, f.y - this.moon.y) < this.moon.r + FLY_R + 6) {
        this.events.push({ type: "moon" });
      }
    }

    kill(cause) {
      const f = this.fly;
      if (f.state === "dead") return;
      f.state = "dead"; f.t = 0;
      this.events.push({ type: "dead", cause, x: f.x, y: f.y });
    }

    updateHazards(dt) {
      const f = this.fly;
      for (const z of this.zappers) if (z.zap > 0) z.zap -= dt;
      // ハエ叩き：ついて回る → 狙う（影が大きくなる） → 叩く → 休む
      for (const s of this.swatters) {
        s.t -= dt;
        if (s.state === "hover") {
          s.x += (f.x - s.x) * Math.min(1, dt * 0.8);
          s.y += (f.y - 120 - s.y) * Math.min(1, dt * 0.8);
          if (s.t <= 0 && f.state === "fly" && Math.hypot(f.x - s.x, f.y - s.y) < 320) {
            s.state = "aim"; s.t = 0.85; s.tx = f.x + Math.cos(f.h) * f.v * 0.6; s.ty = f.y + Math.sin(f.h) * f.v * 0.6;
          } else if (s.t <= 0) s.t = 0.5;
        } else if (s.state === "aim") {
          s.shadow = 1 - s.t / 0.85;
          s.x += (s.tx - s.x) * Math.min(1, dt * 6); s.y += (s.ty - s.y) * Math.min(1, dt * 6);
          if (s.t <= 0) {
            s.state = "slam"; s.t = 0.12; s.slam = 1;
            this.events.push({ type: "slam", x: s.tx, y: s.ty });
            if (f.state !== "dead" && Math.hypot(f.x - s.tx, f.y - s.ty) < 56) this.kill("swatter");
          }
        } else if (s.state === "slam") {
          s.slam = s.t / 0.12;
          if (s.t <= 0) { s.state = "rest"; s.t = 1.4; s.shadow = 0; s.slam = 0; }
        } else if (s.state === "rest") {
          if (s.t <= 0) { s.state = "hover"; s.t = 2 + this.rng() * 2.5; }
        }
      }
      // 車
      if (this.road) {
        this.carTimer -= dt;
        if (this.carTimer <= 0) {
          const dir = this.rng() < 0.5 ? 1 : -1;
          this.cars.push({ x: dir > 0 ? -140 : this.W + 140, y: this.road.y, dir, vx: 230 + this.rng() * 120, hue: this.rng() });
          this.carTimer = 2.5 + this.rng() * 3.5;
        }
        for (const c of this.cars) c.x += c.dir * c.vx * dt;
        this.cars = this.cars.filter((c) => c.x > -200 && c.x < this.W + 200);
      }
    }

    distToMoon() {
      return Math.max(0, Math.hypot(this.fly.x - this.moon.x, this.fly.y - this.moon.y) - this.moon.r);
    }
  }

  FM.World = World;
  FM.FLY_R = FLY_R;
  FM.TAU = TAU;
})();
