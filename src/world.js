// 2D の世界と、ハエの身体（ゲームレイヤ：大胆に単純化してよい部分）
//
// 座標は画面ピクセル。y は下向き。ハエの向き h は (cos h, sin h) の方向。
// 「左に曲がる」＝ 画面上で反時計回り ＝ h が減る。
(function () {
  const FM = (window.FM = window.FM || {});

  const FLY_R = 7;

  class World {
    constructor(w, h, rng) {
      this.w = w; this.h = h; this.rng = rng;
      this.moon = { x: w * 0.78, y: h * 0.2, r: 26, I: 1.0 };
      this.lamp = { x: 0, y: 0, on: false };
      this.foods = [];
      this.rocks = [];
      this.fly = null;
      this.events = [];
      this.resetFly();
    }

    resize(w, h) {
      if (!(this.w > 0 && this.h > 0)) { // 最初の配置がまだ大きさ 0 だったとき
        this.w = w; this.h = h;
        Object.assign(this.moon, { x: w * 0.78, y: h * 0.2 });
        this.resetFly();
        return;
      }
      const sx = w / this.w, sy = h / this.h;
      const s = (o) => { o.x *= sx; o.y *= sy; };
      [this.moon, this.lamp, ...this.foods, ...this.rocks].forEach(s);
      if (this.fly) { s(this.fly); this.fly.trail.forEach(s); }
      this.w = w; this.h = h;
    }

    resetFly() {
      this.fly = {
        x: this.w * 0.14, y: this.h * 0.82,
        h: -Math.PI / 2 + (this.rng() - 0.5) * 1.2,
        v: 0, omega: 0, walked: 0,
        jump: 0, jumpDir: 0, // GF による跳躍の残り時間と方向
        trail: [],
      };
    }

    // ハエの位置・向きから見た方位（左が正、rad）と距離
    view(x, y) {
      const f = this.fly;
      const dx = x - f.x, dy = y - f.y;
      let rel = Math.atan2(dy, dx) - f.h;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      return { az: -rel, d: Math.hypot(dx, dy) };
    }

    // ハエ → 点 の線分が岩に遮られるか
    occluded(x, y) {
      const f = this.fly;
      const dx = x - f.x, dy = y - f.y, L2 = dx * dx + dy * dy;
      for (const r of this.rocks) {
        const t = Math.max(0, Math.min(1, ((r.x - f.x) * dx + (r.y - f.y) * dy) / L2));
        const px = f.x + t * dx - r.x, py = f.y + t * dy - r.y;
        if (px * px + py * py < r.r * r.r) return true;
      }
      return false;
    }

    // 光源の一覧。ハエの感覚はここから計算する（月もランプも、ただの光）
    lights() {
      const out = [{ x: this.moon.x, y: this.moon.y, r: this.moon.r, I: this.moon.I, kind: "moon" }];
      if (this.lamp.on) {
        const d = Math.hypot(this.lamp.x - this.fly.x, this.lamp.y - this.fly.y);
        out.push({ x: this.lamp.x, y: this.lamp.y, r: 8, I: Math.min(2.2, 260 / (d + 40)), kind: "lamp" });
      }
      return out;
    }

    odorAt(x, y) {
      let c = 0;
      for (const f of this.foods) {
        // 指数型：どの距離でも左右の濃度の比が同じくらい残る
        c += Math.exp(-Math.hypot(x - f.x, y - f.y) / 160);
      }
      return c;
    }

    // motor: { forward px/s, turn rad/s（左が正）, jump: bool }
    step(dt, motor) {
      const f = this.fly;
      this.events.length = 0;
      if (motor.jump && f.jump <= 0) {
        f.jump = 0.18;
        f.jumpDir = f.h + Math.PI + (this.rng() - 0.5) * 1.6;
        this.events.push({ type: "jump" });
      }
      if (f.jump > 0) {
        f.jump -= dt;
        f.x += Math.cos(f.jumpDir) * 380 * dt;
        f.y += Math.sin(f.jumpDir) * 380 * dt;
        f.h += 9 * dt;
      } else {
        f.v = motor.forward;
        f.omega = motor.turn;
        f.h -= f.omega * dt;
        f.x += Math.cos(f.h) * f.v * dt;
        f.y += Math.sin(f.h) * f.v * dt;
        f.walked += Math.abs(f.v) * dt;
      }

      // 画面の端：押し戻して向きを反射（罰はない）
      const m = FLY_R + 2;
      if (f.x < m || f.x > this.w - m) { f.x = Math.max(m, Math.min(this.w - m, f.x)); f.h = Math.PI - f.h; }
      if (f.y < m || f.y > this.h - m) { f.y = Math.max(m, Math.min(this.h - m, f.y)); f.h = -f.h; }

      // 岩にぶつかる
      for (const r of this.rocks) {
        const dx = f.x - r.x, dy = f.y - r.y, d = Math.hypot(dx, dy), lim = r.r + FLY_R;
        if (d < lim && d > 0) {
          f.x = r.x + (dx / d) * (lim + 1);
          f.y = r.y + (dy / d) * (lim + 1);
          if (!r.hitCool || r.hitCool <= 0) { this.events.push({ type: "collide", x: f.x, y: f.y }); r.hitCool = 0.8; }
        }
        if (r.hitCool > 0) r.hitCool -= dt;
      }

      // 餌を食べる
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const fd = this.foods[i];
        if (Math.hypot(f.x - fd.x, f.y - fd.y) < FLY_R + 12) {
          this.foods.splice(i, 1);
          this.events.push({ type: "eat", x: fd.x, y: fd.y });
        }
      }

      // 月に触れる（ハエにとっては、ただ一番明るいところに来ただけ）
      if (Math.hypot(f.x - this.moon.x, f.y - this.moon.y) < this.moon.r + FLY_R) {
        this.events.push({ type: "moon" });
      }

      f.trail.push({ x: f.x, y: f.y });
      if (f.trail.length > 600) f.trail.shift();
      return this.events;
    }

    distToMoon() {
      return Math.max(0, Math.hypot(this.fly.x - this.moon.x, this.fly.y - this.moon.y) - this.moon.r);
    }

    // 月をハエから離れたところへ置き直す
    relocateMoon() {
      const f = this.fly;
      for (let k = 0; k < 40; k++) {
        const x = 60 + this.rng() * (this.w - 120), y = 60 + this.rng() * (this.h - 120);
        if (Math.hypot(x - f.x, y - f.y) > Math.min(this.w, this.h) * 0.55) { this.moon.x = x; this.moon.y = y; return; }
      }
      this.moon.x = this.w - f.x; this.moon.y = this.h - f.y;
    }
  }

  FM.World = World;
  FM.FLY_R = FLY_R;
})();
