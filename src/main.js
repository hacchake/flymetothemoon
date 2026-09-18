// 起動・入力・ループ
(function () {
  const FM = (window.FM = window.FM || {});
  const BRAIN_DT = 0.5; // ms

  const MODES = {
    lamp: "光：マウスの位置に光を灯す",
    moon: "月：ドラッグで月を動かす",
    food: "餌：クリックで置く",
    rock: "岩：クリックで置く",
  };

  class App {
    constructor() {
      this.rng = FM.mulberry32((Math.random() * 1e9) | 0);
      this.worldCanvas = document.getElementById("world");
      this.brainCanvas = document.getElementById("brain");
      this.brain = new FM.Brain(FM.CIRCUIT, { dt: BRAIN_DT, seed: (this.rng() * 1e9) | 0 });
      this.senses = new FM.Senses(FM.CIRCUIT);
      this.motor = new FM.Motor();
      this.game = new FM.Game();
      this.worldView = new FM.WorldView(this.worldCanvas);
      this.brainView = new FM.BrainView(this.brainCanvas, this.brain);
      this.world = null;
      this.mode = "lamp";
      this.paused = false;
      this.showSight = true;
      this.t = 0;
      this.perf = { brainMs: 0, frameMs: 0 };

      this.resize();
      window.addEventListener("resize", () => this.resize());
      this.bindInput();
      this.setMode("lamp");
      this.game.say("光を近づけると、ハエはそちらへ向かう");
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wr = this.worldCanvas.parentElement.getBoundingClientRect();
      if (!this.world) this.world = new FM.World(wr.width, wr.height, this.rng);
      else this.world.resize(wr.width, wr.height);
      this.worldView.resize(wr.width, wr.height, dpr);
      const br = this.brainCanvas.parentElement.getBoundingClientRect();
      if (br.width > 0) this.brainView.resize(br.width, br.height, dpr);
    }

    setMode(m) {
      this.mode = m;
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
      document.getElementById("hint").textContent = MODES[m];
      if (m !== "lamp") this.world.lamp.on = false;
    }

    bindInput() {
      const cv = this.worldCanvas;
      const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      let dragMoon = false;
      cv.addEventListener("pointermove", (e) => {
        const p = at(e);
        if (this.mode === "lamp") { this.world.lamp.x = p.x; this.world.lamp.y = p.y; this.world.lamp.on = true; }
        if (this.mode === "moon" && dragMoon) { this.world.moon.x = p.x; this.world.moon.y = p.y; }
      });
      cv.addEventListener("pointerleave", () => { if (this.mode === "lamp") this.world.lamp.on = false; });
      cv.addEventListener("pointerdown", (e) => {
        const p = at(e);
        if (e.button === 2) { this.removeNear(p); return; }
        if (this.mode === "lamp") { this.world.lamp.x = p.x; this.world.lamp.y = p.y; this.world.lamp.on = true; }
        if (this.mode === "moon") { dragMoon = true; this.world.moon.x = p.x; this.world.moon.y = p.y; cv.setPointerCapture(e.pointerId); }
        if (this.mode === "food" && this.world.foods.length < 14) {
          this.world.foods.push({ x: p.x, y: p.y });
          this.worldView.burst(p.x, p.y, [157, 245, 180], 8);
        }
        if (this.mode === "rock" && this.world.rocks.length < 18) {
          this.world.rocks.push({ x: p.x, y: p.y, r: 18 + this.rng() * 18, hitCool: 0 });
        }
      });
      cv.addEventListener("pointerup", () => { dragMoon = false; });
      cv.addEventListener("contextmenu", (e) => e.preventDefault());

      document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => this.setMode(b.dataset.mode)));
      document.getElementById("btn-pause").addEventListener("click", () => this.togglePause());
      document.getElementById("btn-reset").addEventListener("click", () => this.newTrial());
      document.getElementById("btn-brain").addEventListener("click", () => this.toggleBrain());
      window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k === "1") this.setMode("lamp");
        if (k === "2") this.setMode("moon");
        if (k === "3") this.setMode("food");
        if (k === "4") this.setMode("rock");
        if (k === " ") { e.preventDefault(); this.togglePause(); }
        if (k === "r") this.newTrial();
        if (k === "b") this.toggleBrain();
        if (k === "v") this.showSight = !this.showSight;
        if (k === "d") document.getElementById("debug").classList.toggle("hidden");
      });
    }

    removeNear(p) {
      const near = (o) => Math.hypot(o.x - p.x, o.y - p.y) < (o.r || 0) + 24;
      this.world.foods = this.world.foods.filter((o) => !near(o));
      this.world.rocks = this.world.rocks.filter((o) => !near(o));
    }

    togglePause() {
      this.paused = !this.paused;
      document.getElementById("btn-pause").textContent = this.paused ? "再開" : "一時停止";
    }

    toggleBrain() {
      document.body.classList.toggle("no-brain");
      this.resize();
    }

    newTrial(countIt = true) {
      this.world.resetFly();
      this.game.newTrial(countIt);
      this.game.say(`試行 ${this.game.trials}`);
    }

    // 1 フレーム分：感覚 → 脳 → 運動 → 身体 → 世界 → ゲーム
    tick(dt) {
      this.senses.sample(this.world);
      this.senses.apply(this.brain, { hunger: this.game.hunger });
      const t0 = performance.now();
      this.brain.run(dt * 1000);
      this.perf.brainMs = this.perf.brainMs * 0.9 + (performance.now() - t0) * 0.1;
      const cmd = this.motor.read(this.brain, dt);
      const events = this.world.step(dt, cmd);
      for (const e of events) {
        if (e.type === "eat") this.worldView.burst(e.x, e.y, [157, 245, 180]);
        if (e.type === "collide") this.worldView.burst(e.x, e.y, [255, 120, 120], 10);
        if (e.type === "moon") this.worldView.burst(this.world.fly.x, this.world.fly.y, [255, 244, 214], 60);
        if (e.type === "jump") this.worldView.burst(this.world.fly.x, this.world.fly.y, [190, 140, 255], 12);
      }
      if (this.game.update(dt, this.world, events) === "dead") this.newTrial();
    }

    frame(now) {
      // 固定刻み（1/60 秒）で追いつく。描画が遅い PC でも時間の進み方は変わらない
      const STEP = 1 / 60;
      this.acc = Math.min(0.25, (this.acc || 0) + (now - this.last) / 1000);
      this.last = now;
      const f0 = performance.now();
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (!this.paused) { this.t += STEP; this.tick(STEP); }
      }
      this.worldView.draw(this.world, this.senses, this.brain, this.t, { sight: this.showSight });
      if (!document.body.classList.contains("no-brain")) this.brainView.draw(this.senses, this.motor, this.t);
      this.hud();
      this.perf.frameMs = this.perf.frameMs * 0.9 + (performance.now() - f0) * 0.1;
      requestAnimationFrame((t) => this.frame(t));
    }

    hud() {
      const g = this.game, $ = (id) => document.getElementById(id);
      $("score").textContent = Math.round(g.score).toLocaleString();
      $("dist").textContent = Math.round(this.world.distToMoon());
      $("time").textContent = g.time.toFixed(1);
      $("trials").textContent = g.trials;
      $("landings").textContent = g.landings;
      $("energy").style.width = g.energy + "%";
      $("energy").classList.toggle("low", g.energy < 25);
      $("msgs").innerHTML = g.messages.map((m) =>
        `<div class="msg ${m.kind}" style="opacity:${Math.min(1, 2.4 - m.t)}">${m.text}</div>`).join("");
      $("debug").textContent =
        `neurons ${this.brain.N}  synapses ${this.brain.nSyn}  dt ${BRAIN_DT} ms\n` +
        `brain ${this.perf.brainMs.toFixed(2)} ms/frame  frame ${this.perf.frameMs.toFixed(2)} ms`;
    }
  }

  // ---- 検証用：画面を使わず、同じ閉ループを速く回す ----
  // FM.experiment({ seconds, seed, lesion, setup }) → { startDist, minDist, finalDist, reached }
  FM.experiment = function ({ seconds = 20, seed = 1, lesion = null, setup = null, circuit = FM.CIRCUIT, sensesP = null } = {}) {
    const rng = FM.mulberry32(seed);
    const world = new FM.World(900, 600, rng);
    world.fly.x = 150; world.fly.y = 450; world.fly.h = 0;
    world.moon.x = 700; world.moon.y = 150;
    if (setup) setup(world);
    const brain = new FM.Brain(circuit, { dt: BRAIN_DT, seed, lesion });
    const senses = new FM.Senses(circuit), motor = new FM.Motor();
    if (sensesP) Object.assign(senses.P, sensesP);
    const dt = 1 / 60, startDist = world.distToMoon();
    let minDist = startDist, reached = false, eaten = 0, hits = 0;
    for (let i = 0; i < seconds / dt; i++) {
      senses.sample(world);
      senses.apply(brain, { hunger: 0.5 });
      brain.run(dt * 1000);
      const ev = world.step(dt, motor.read(brain, dt));
      for (const e of ev) { if (e.type === "moon") reached = true; if (e.type === "eat") eaten++; if (e.type === "collide") hits++; }
      minDist = Math.min(minDist, world.distToMoon());
      if (reached) break;
    }
    return { startDist: Math.round(startDist), minDist: Math.round(minDist), finalDist: Math.round(world.distToMoon()), reached, eaten, hits };
  };

  window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("world")) FM.app = new App();
  });
})();
