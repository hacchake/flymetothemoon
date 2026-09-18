// 2D の世界と、ハエの身体（ゲームレイヤ：大胆に単純化してよい部分）
//
// 夜の街を横から見た世界。幅 1000、高さはステージごと。y は下向き。
// ハエの向き h は (cos h, sin h) の方向。「左に曲がる」＝ 画面上で反時計回り ＝ h が減る。
// （本物のハエは 3 次元を飛ぶ。ここでは体の左右を、この平面での回転に置き換えている）
//
// ステージの書式（すべて省略可）：
//   H, start:[x,y], moon:[x,y], road:bool, sky:bool（飛行機が飛ぶ）, witch:false（魔女を出さない）
//   clouds:[[x,y,r]], streetlights:[[x,y]], zappers:[[x,y]], papers:[[x,y,h]], swatters:[[x,y]],
//   ufos:[[x,y]], fireflies:[[x,y]], vinegars:[[x,y]], webs:[[x,y,r]], frogs:[[x]], fans:[[x,y]], mirrors:[[x,y]]
(function () {
  const FM = (window.FM = window.FM || {});
  const FLY_R = 7;
  const TAU = Math.PI * 2;

  // 捕まったときに必要な連打の回数と、猶予（秒）
  const STUCK = {
    paper: { need: 6, time: 4 },
    web: { need: 8, time: 3.5 },
    vinegar: { need: 10, time: 5 },
  };

  class World {
    constructor(stage, rng) {
      this.rng = rng;
      this.W = 1000;
      this.H = stage.H;
      this.ground = stage.H - 60;
      this.stage = stage;
      const L = (k) => stage[k] || [];
      this.moon = { x: stage.moon[0], y: stage.moon[1], r: 42, I: 1.0 };
      this.lamp = { x: 0, y: 0, on: false };
      this.foods = [];
      this.clouds = L("clouds").map(([x, y, r]) => ({ x, y, r: r || 55 }));
      this.streetlights = L("streetlights").map(([x, y]) => ({ x, y }));
      this.zappers = L("zappers").map(([x, y]) => ({ x, y, r: 20, zap: 0 }));
      this.papers = L("papers").map(([x, y, h]) => ({ x, y, w: 26, h: h || 160 }));
      this.swatters = L("swatters").map(([x, y]) => this.makeSwatter(x, y));
      this.ufos = L("ufos").map(([x, y]) => this.makeUfo(x, y));
      this.fireflies = [];
      for (const [x, y] of L("fireflies")) this.addFireflies(x, y);
      this.vinegars = L("vinegars").map(([x, y]) => ({ x, y: Math.min(y, this.ground) }));
      this.webs = L("webs").map(([x, y, r]) => ({ x, y, r: r || 55 }));
      this.frogs = L("frogs").map(([x]) => this.makeFrog(x));
      this.fans = L("fans").map(([x, y]) => ({ x, y, spin: 0 }));
      this.mirrors = L("mirrors").map(([x, y]) => ({ x, y }));
      this.road = stage.road ? { y: this.H - 38 } : null;
      this.cars = [];
      this.carTimer = 1.5;
      this.planes = [];
      this.planeTimer = 2 + rng() * 4;
      this.witch = null;
      this.witchDone = stage.witch === false;
      this.events = [];
      this.time = 0;
      this.resetFly();
    }

    makeSwatter(x, y) { return { x, y, state: "hover", t: 2 + this.rng() * 2, tx: x, ty: y, shadow: 0, slam: 0 }; }
    makeUfo(x, y) { return { x0: x, y0: y, x, y, t: this.rng() * 10, beam: 0, beamT: 3 + this.rng() * 3 }; }
    makeFrog(x) { return { x, y: this.ground, state: "idle", t: 0, aim: 0, tx: 0, ty: 0, tongue: 0, cool: 0 }; }
    addFireflies(x, y) {
      for (let i = 0; i < 5; i++) this.fireflies.push({ cx: x, cy: y, x, y, ph: this.rng() * TAU, sp: 0.6 + this.rng() * 0.8, blink: this.rng() * TAU });
    }

    resetFly() {
      const [x, y] = this.stage.start;
      this.fly = {
        x, y, h: -Math.PI / 2 + (this.rng() - 0.5) * 0.8,
        v: 60, state: "fly", t: 0, stuck: null, rescue: 0, immune: 0,
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

    // a → b の線分が雲に遮られるか（a を省くとハエから）
    occluded(x, y, ax = this.fly.x, ay = this.fly.y) {
      const dx = x - ax, dy = y - ay, L2 = dx * dx + dy * dy || 1;
      for (const c of this.clouds) {
        const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / L2));
        const px = ax + t * dx - c.x, py = ay + t * dy - c.y;
        if (px * px + py * py < c.r * c.r) return true;
      }
      return false;
    }

    // 光源。I は「ハエにとっての」明るさ。月もランプも殺虫灯も UFO も、ここではただの光
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
      // 飛行機：白いストロボが一瞬だけ強く光る
      for (const p of this.planes) {
        if (p.strobe) out.push({ x: p.x, y: p.y, r: 6, I: near(p.x, p.y, 700, 200, 1.8), kind: "plane" });
        out.push({ x: p.x + p.dir * 18, y: p.y, r: 4, I: near(p.x, p.y, 120, 200, 0.4), kind: "plane" });
      }
      for (const u of this.ufos) {
        out.push({ x: u.x, y: u.y, r: 26, I: near(u.x, u.y, 300, 140, 1.2), kind: "ufo" });
        if (u.beam > 0) out.push({ x: u.x, y: u.y + 60, r: 30, I: u.beam * near(u.x, u.y + 60, 480, 120, 2.0), kind: "ufo" });
      }
      for (const b of this.fireflies) {
        const on = Math.max(0, Math.sin(this.time * 2.2 + b.blink) - 0.55) / 0.45;
        if (on > 0) out.push({ x: b.x, y: b.y, r: 3, I: on * near(b.x, b.y, 260, 60, 1.3), kind: "firefly" });
      }
      // 鏡：月が見えていれば、月の光を映して光る
      for (const m of this.mirrors) {
        if (!this.occluded(this.moon.x, this.moon.y, m.x, m.y)) out.push({ x: m.x, y: m.y, r: 12, I: near(m.x, m.y, 260, 80, 1.1), kind: "mirror" });
      }
      if (this.witch) out.push({ x: this.witch.x + 20, y: this.witch.y + 6, r: 6, I: near(this.witch.x, this.witch.y, 360, 100, 1.4), kind: "witch" });
      return out;
    }

    // 迫ってくる暗いもの（見かけの大きさで LPLC2 を駆動する）
    loomers() {
      const out = this.clouds.map((c) => ({ x: c.x, y: c.y, r: c.r }));
      for (const s of this.swatters) if (s.shadow > 0) out.push({ x: s.tx, y: s.ty, r: 12 + s.shadow * 90, dark: true });
      for (const c of this.cars) out.push({ x: c.x, y: c.y, r: 40 });
      for (const g of this.frogs) if (g.aim > 0) out.push({ x: g.x, y: g.y - 25, r: 18 + g.aim * 45, dark: true });
      return out;
    }

    odorAt(x, y) {
      let c = 0;
      for (const f of this.foods) c += Math.exp(-Math.hypot(x - f.x, y - f.y) / 160);
      // ハエトリ紙は甘い匂い、酢トラップはもっと強い匂い（Or42b は酢酸エチルなどの果実の匂いに応える）
      for (const p of this.papers) c += 0.8 * Math.exp(-Math.hypot(x - p.x, y - (p.y + p.h / 2)) / 150);
      for (const v of this.vinegars) c += 1.4 * Math.exp(-Math.hypot(x - v.x, y - (v.y - 40)) / 190);
      return c;
    }

    // 危なさ 0..1（音楽の緊張に使う。ハエの脳には入らない）
    tension() {
      const f = this.fly;
      let t = 0;
      const near = (x, y, r) => Math.max(0, 1 - Math.hypot(f.x - x, f.y - y) / r);
      for (const z of this.zappers) t = Math.max(t, near(z.x, z.y, 260));
      for (const s of this.swatters) t = Math.max(t, s.state === "aim" ? 0.6 + 0.4 * s.shadow : near(s.x, s.y, 260) * 0.5);
      for (const g of this.frogs) t = Math.max(t, g.aim > 0 ? 0.9 : near(g.x, g.y, 220) * 0.6);
      for (const u of this.ufos) t = Math.max(t, u.beam > 0 ? near(u.x, u.y + 150, 320) : 0);
      for (const p of this.papers) t = Math.max(t, near(p.x, p.y + p.h / 2, 180) * 0.7);
      for (const v of this.vinegars) t = Math.max(t, near(v.x, v.y - 40, 180) * 0.7);
      if (f.state === "stuck" || f.state === "abduct") t = 1;
      return t;
    }

    // ---------------- 1 フレーム進める ----------------
    // motor: { speed px/s, turn rad/s（左が正）, dash: bool }
    step(dt, motor) {
      const f = this.fly;
      this.events.length = 0;
      this.time += dt;
      this.updateHazards(dt);
      f.wing += dt * 40;

      if (f.immune > 0) f.immune -= dt;
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
        this.wind(dt);
        this.collide(dt);
      } else if (f.state === "eat") {
        f.t -= dt;
        if (f.t <= 0) { f.state = "fly"; f.v = 80; f.h = -Math.PI / 2; }
      } else if (f.state === "stuck") {
        f.t -= dt;
        f.x += (Math.random() - 0.5) * 1.2; // もがく
        if (f.rescue >= STUCK[f.stuck].need) {
          f.state = "fly"; f.rescue = 0; f.dash = 0.25; f.dashDir = -Math.PI / 2 + (this.rng() - 0.5); f.immune = 1.5;
          this.events.push({ type: "freed", x: f.x, y: f.y });
        } else if (f.t <= 0) this.kill(f.stuck);
      } else if (f.state === "abduct") {
        // UFO に吸い上げられる
        const u = f.ufo, dx = u.x - f.x, dy = u.y + 10 - f.y, d = Math.hypot(dx, dy);
        f.x += (dx / (d || 1)) * Math.min(d, 170 * dt); f.y += (dy / (d || 1)) * Math.min(d, 170 * dt);
        f.h += dt * 6;
        if (d < 12) {
          f.x = 80 + this.rng() * (this.W - 160); f.y = this.ground - 120 - this.rng() * 200;
          f.state = "fly"; f.v = 60; f.h = -Math.PI / 2; f.ufo = null; f.immune = 2;
          this.events.push({ type: "abducted", x: f.x, y: f.y });
        }
      }

      f.trail.push({ x: f.x, y: f.y });
      if (f.trail.length > 240) f.trail.shift();
      return this.events;
    }

    // 扇風機：上向きの風の柱。ハエを押し上げる（プレイヤーの道具）
    wind(dt) {
      const f = this.fly;
      for (const fan of this.fans) {
        const dx = f.x - fan.x, dy = fan.y - f.y;
        if (Math.abs(dx) < 50 && dy > -10 && dy < 460) {
          const k = (1 - Math.abs(dx) / 50) * (1 - dy / 460);
          f.y -= 190 * k * dt;
          f.x += Math.sign(dx) * 20 * k * dt;
        }
      }
    }

    stuckOn(kind) {
      const f = this.fly;
      f.state = "stuck"; f.stuck = kind; f.t = STUCK[kind].time; f.rescue = 0;
      this.events.push({ type: "stuck", kind, x: f.x, y: f.y });
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
      if (!(f.immune > 0)) { // 罠から出たばかりのときは、捕まる罠だけ効かない
        for (const p of this.papers) {
          if (f.x > p.x - p.w / 2 - 3 && f.x < p.x + p.w / 2 + 3 && f.y > p.y && f.y < p.y + p.h) { this.stuckOn("paper"); return; }
        }
        for (const w of this.webs) if (Math.hypot(f.x - w.x, f.y - w.y) < w.r) { this.stuckOn("web"); return; }
        for (const v of this.vinegars) if (Math.hypot(f.x - v.x, f.y - (v.y - 44)) < 18) { this.stuckOn("vinegar"); f.x = v.x; f.y = v.y - 30; return; }
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
      for (const u of this.ufos) {
        const dy = f.y - u.y;
        if (!(f.immune > 0) && u.beam > 0.6 && dy > 10 && dy < 420 && Math.abs(f.x - u.x) < 18 + dy * 0.35) {
          f.state = "abduct"; f.ufo = u;
          this.events.push({ type: "abduct", x: f.x, y: f.y });
          return;
        }
      }
      if (this.witch && !this.witch.met && Math.hypot(f.x - this.witch.x, f.y - this.witch.y) < 36) {
        this.witch.met = true;
        this.events.push({ type: "witch", x: this.witch.x, y: this.witch.y });
      }
      this.moonCheck();
    }

    moonCheck() {
      const f = this.fly;
      if (Math.hypot(f.x - this.moon.x, f.y - this.moon.y) < this.moon.r + FLY_R + 6) this.events.push({ type: "moon" });
    }

    kill(cause) {
      const f = this.fly;
      if (f.state === "dead") return;
      f.state = "dead"; f.t = 0;
      this.events.push({ type: "dead", cause, x: f.x, y: f.y });
    }

    updateHazards(dt) {
      const f = this.fly, rng = this.rng;
      for (const z of this.zappers) if (z.zap > 0) z.zap -= dt;
      for (const fan of this.fans) fan.spin += dt * 14;
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
          if (s.t <= 0) { s.state = "hover"; s.t = 2 + rng() * 2.5; }
        }
      }
      // カエル：近くに来たハエを狙い（頭をもたげる＝迫る影）、舌を伸ばす
      for (const g of this.frogs) {
        g.cool -= dt;
        const hx = g.x, hy = g.y - 22;
        if (g.state === "idle") {
          if (g.cool <= 0 && f.state === "fly" && Math.hypot(f.x - hx, f.y - hy) < 190) { g.state = "aim"; g.t = 0.5; }
        } else if (g.state === "aim") {
          g.t -= dt; g.aim = 1 - g.t / 0.5;
          if (g.t <= 0) { g.state = "strike"; g.t = 0.14; g.tx = f.x; g.ty = f.y; this.events.push({ type: "tongue", x: g.x, y: g.y }); }
        } else if (g.state === "strike") {
          g.t -= dt; g.tongue = 1 - Math.abs(g.t / 0.07 - 1);
          if (g.t <= 0.07 && g.tongue > 0.9 && f.state === "fly" && Math.hypot(f.x - g.tx, f.y - g.ty) < 26) this.kill("frog");
          if (g.t <= 0) { g.state = "idle"; g.aim = 0; g.tongue = 0; g.cool = 1.6; }
        }
      }
      // UFO：ゆらゆら漂い、ときどき光のビームを下ろす
      for (const u of this.ufos) {
        u.t += dt;
        u.x = u.x0 + Math.sin(u.t * 0.35) * 140; u.y = u.y0 + Math.sin(u.t * 0.9) * 25;
        u.beamT -= dt;
        if (u.beamT <= 0) { u.beamOn = !u.beamOn; u.beamT = u.beamOn ? 2.5 : 6 + rng() * 4; }
        u.beam += ((u.beamOn ? 1 : 0) - u.beam) * Math.min(1, dt * 3);
      }
      // ホタル：ふわふわ飛びながら点滅する
      for (const b of this.fireflies) {
        b.ph += dt * b.sp;
        b.x = b.cx + Math.sin(b.ph * 1.3) * 80 + Math.sin(b.ph * 0.7 + b.blink) * 30;
        b.y = b.cy + Math.cos(b.ph) * 40;
      }
      // 車
      if (this.road) {
        this.carTimer -= dt;
        if (this.carTimer <= 0) {
          const dir = rng() < 0.5 ? 1 : -1;
          this.cars.push({ x: dir > 0 ? -140 : this.W + 140, y: this.road.y, dir, vx: 230 + rng() * 120, hue: rng() });
          this.carTimer = 2.5 + rng() * 3.5;
        }
        for (const c of this.cars) c.x += c.dir * c.vx * dt;
        this.cars = this.cars.filter((c) => c.x > -200 && c.x < this.W + 200);
      }
      // 飛行機：夜空の高いところをゆっくり横切る
      if (this.stage.sky) {
        this.planeTimer -= dt;
        if (this.planeTimer <= 0 && this.planes.length < 2) {
          const dir = rng() < 0.5 ? 1 : -1;
          const y = 90 + rng() * Math.max(100, Math.min(this.H * 0.45, 900));
          this.planes.push({ x: dir > 0 ? -80 : this.W + 80, y, dir, vx: 60 + rng() * 50, ph: rng() });
          this.planeTimer = 7 + rng() * 8;
        }
        for (const p of this.planes) { p.x += p.dir * p.vx * dt; p.strobe = ((this.time + p.ph) % 1.3) < 0.09; }
        this.planes = this.planes.filter((p) => p.x > -120 && p.x < this.W + 120);
      }
      // 魔女：ごくまれに、月の前を横切る
      if (!this.witchDone && !this.witch && this.time > 12 && rng() < dt / 90) {
        const dir = rng() < 0.5 ? 1 : -1;
        this.witch = { x: dir > 0 ? -60 : this.W + 60, y: this.moon.y + (rng() - 0.5) * 80, dir, t: 0 };
        this.witchDone = true;
        this.events.push({ type: "witch-appear" });
      }
      if (this.witch) {
        const w = this.witch;
        w.t += dt; w.x += w.dir * 150 * dt; w.y += Math.sin(w.t * 3) * 20 * dt;
        if (w.x < -100 || w.x > this.W + 100) this.witch = null;
      }
    }

    distToMoon() {
      return Math.max(0, Math.hypot(this.fly.x - this.moon.x, this.fly.y - this.moon.y) - this.moon.r);
    }
  }

  FM.World = World;
  FM.FLY_R = FLY_R;
  FM.TAU = TAU;
  FM.STUCK = STUCK;
})();
