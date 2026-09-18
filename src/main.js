// 起動・画面・入力・ループ
(function () {
  const FM = (window.FM = window.FM || {});
  const BRAIN_DT = 0.5; // ms
  const STEP = 1 / 60;
  const $ = (id) => document.getElementById(id);

  const TOOLS = {
    lamp: { label: "ランタン", key: "1", hint: "押している間、光が灯る。電池に限りあり" },
    food: { label: "餌", key: "2", hint: "クリックで置く。匂いでハエを呼び、食べると元気になる" },
    cloud: { label: "雲", key: "3", hint: "クリックで置く。光を遮り、ハエの行く手をふさぐ" },
    moon: { label: "月", key: "4", hint: "ドラッグで月を動かす" },
    street: { label: "街灯", key: "5", hint: "クリックで置く" },
    zapper: { label: "殺虫灯", key: "6", hint: "クリックで置く（紫外線はハエにだけまぶしい）" },
    paper: { label: "ハエトリ紙", key: "7", hint: "クリックで置く" },
    swatter: { label: "ハエ叩き", key: "8", hint: "クリックで置く" },
  };

  // ---- 進み具合（ブラウザにだけ保存。消えても遊べる） ----
  const SAVE_KEY = "fmttm-progress-v1";
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { stars: {}, best: {} }; } catch { return { stars: {}, best: {} }; }
  }
  function saveProgress(p) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* 保存できなくても続ける */ } }

  class App {
    constructor() {
      this.rng = FM.mulberry32((Math.random() * 1e9) | 0);
      this.progress = loadProgress();
      this.circuitName = FM.CIRCUITS.flywire ? "flywire" : "schematic";
      this.worldView = new FM.WorldView($("world"));
      this.brainView = new FM.BrainView($("brain-fx"), $("brain-ui"));
      this.jazz = new FM.Jazz();
      this.cam = { s: 1, x: 0, y: 0 };
      this.screen = "title";
      this.tool = "lamp";
      this.pointer = { down: false, x: 0, y: 0, in: false };
      this.t = 0; this.acc = 0;
      this.buildBrain();
      this.resize();
      this.load(FM.STAGES[0], { demo: true });
      window.addEventListener("resize", () => this.resize());
      this.bindInput();
      this.showScreen("title");
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    buildBrain() {
      const circuit = FM.CIRCUITS[this.circuitName];
      this.brain = new FM.Brain(circuit, { dt: BRAIN_DT, seed: (this.rng() * 1e9) | 0 });
      this.senses = new FM.Senses(circuit);
      this.motor = new FM.Motor();
      this.motor.calibrate(circuit);
      this.brainView.setBrain(this.brain);
      $("btn-circuit").textContent = this.circuitName === "flywire" ? "回路：FlyWire" : "回路：模式";
    }

    // ステージを読み込む。demo はタイトル画面の背景で、負けない
    load(stage, { demo = false } = {}) {
      this.stage = stage;
      this.demo = demo;
      this.paused = false; // 一時停止のままやり直すと、止まった世界が始まってしまう
      clearTimeout(this.resultTimer); // 前のステージの結果画面が後から出ないように
      this.world = new FM.World(stage, this.rng);
      this.game = new FM.Game(stage);
      if (demo) { this.game.lives = Infinity; this.game.demo = true; }
      this.newFly(false);
      this.worldView.setWorld(this.world);
      this.tool = "lamp";
      this.cam.y = this.camTarget().y;
      this.cam.x = this.camTarget().x;
      this.buildToolbar();
      $("stage-no").textContent = stage.sandbox ? "∞" : stage.id;
      $("stage-title").textContent = stage.name;
      $("hint").textContent = demo ? "" : stage.hint;
      this.hintTimer = 6;
      if (!demo) this.game.say(stage.name, "moon", 2.6);
    }

    buildToolbar() {
      const bar = $("toolbar");
      bar.innerHTML = "";
      for (const [id, T] of Object.entries(TOOLS)) {
        if (!(id in this.game.tools)) continue;
        const b = document.createElement("button");
        b.dataset.tool = id;
        b.innerHTML = `<kbd>${T.key}</kbd>${T.label}<span class="n"></span>`;
        b.addEventListener("click", () => this.setTool(id));
        bar.appendChild(b);
      }
      for (const [id, label, fn] of [["pause", "一時停止", () => this.togglePause()], ["retry", "やり直す", () => this.load(this.stage)], ["menu", "メニュー", () => this.showScreen("select")]]) {
        const b = document.createElement("button");
        b.id = "tb-" + id; // 結果画面のボタン（btn-retry など）と ID が重ならないように
        b.textContent = label; b.addEventListener("click", fn);
        bar.appendChild(b);
      }
      this.setTool(this.tool);
    }

    setTool(id) {
      if (!(id in this.game.tools)) return;
      this.tool = id;
      document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === id));
      if (!this.demo) $("hint").textContent = TOOLS[id].hint;
    }

    showScreen(name) {
      // メニューやタイトルに戻ったら、裏で動き続けるステージをデモに替える
      // （替えないと、裏でハエが月に届いて結果画面が勝手に出る）
      if ((name === "select" || name === "title") && !this.demo) this.load(FM.STAGES[0], { demo: true });
      this.screen = name;
      for (const s of ["title", "select", "result"]) $("scr-" + s).classList.toggle("hidden", s !== name);
      const playing = name === "play";
      $("hud-top").classList.toggle("hidden", !playing);
      $("toolbar").classList.toggle("hidden", !playing);
      $("hint").classList.toggle("hidden", !playing);
      if (name === "select") this.renderSelect();
    }

    renderSelect() {
      const grid = $("stage-grid");
      grid.innerHTML = "";
      FM.STAGES.forEach((st, i) => {
        const prev = i === 0 || (this.progress.stars[FM.STAGES[i - 1].id] || 0) > 0;
        const stars = this.progress.stars[st.id] || 0;
        const b = document.createElement("button");
        b.className = "card";
        b.disabled = !prev;
        b.innerHTML = `<small>STAGE ${st.id}</small>${st.name}<div class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>`;
        b.addEventListener("click", () => this.play(st));
        grid.appendChild(b);
      });
    }

    play(stage) {
      this.load(stage);
      this.showScreen("play");
      this.startSound();
    }

    // 音が鳴らせない環境でも、ゲームは止めない
    startSound() {
      try { this.jazz.start(); } catch (e) { console.warn("音を開始できませんでした", e); }
    }

    // ---------------- 入力 ----------------
    toWorld(e) {
      const r = $("world").getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.cam.s + this.cam.x, y: (e.clientY - r.top) / this.cam.s + this.cam.y };
    }

    bindInput() {
      const cv = $("world");
      cv.addEventListener("pointerdown", (e) => {
        if (this.screen !== "play") return;
        cv.setPointerCapture(e.pointerId);
        const p = this.toWorld(e);
        Object.assign(this.pointer, p, { down: true, in: true });
        this.act(p, e.button === 2);
      });
      cv.addEventListener("pointermove", (e) => { Object.assign(this.pointer, this.toWorld(e), { in: true }); });
      cv.addEventListener("pointerup", () => { this.pointer.down = false; });
      cv.addEventListener("pointerleave", () => { this.pointer.in = false; this.pointer.down = false; });
      cv.addEventListener("contextmenu", (e) => e.preventDefault());

      $("btn-start").addEventListener("click", () => { this.showScreen("select"); this.startSound(); });
      $("btn-sandbox").addEventListener("click", () => this.play(FM.SANDBOX));
      $("btn-back").addEventListener("click", () => this.showScreen("title"));
      $("btn-menu").addEventListener("click", () => this.showScreen("select"));
      $("btn-retry").addEventListener("click", () => this.play(this.stage));
      $("btn-next").addEventListener("click", () => {
        const i = FM.STAGES.indexOf(this.stage);
        if (i >= 0 && i + 1 < FM.STAGES.length) this.play(FM.STAGES[i + 1]); else this.showScreen("select");
      });
      $("btn-sound").addEventListener("click", () => this.toggleSound());
      $("btn-circuit").addEventListener("click", () => { this.circuitName = this.circuitName === "flywire" ? "schematic" : "flywire"; if (!FM.CIRCUITS[this.circuitName]) this.circuitName = "schematic"; this.buildBrain(); this.resize(); });
      $("btn-brain").addEventListener("click", () => this.toggleBrain());
      window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        for (const [id, T] of Object.entries(TOOLS)) if (k === T.key) this.setTool(id);
        if (k === " ") { e.preventDefault(); this.togglePause(); }
        if (k === "r" && this.screen === "play") this.load(this.stage);
        if (k === "b") this.toggleBrain();
        if (k === "m") this.toggleSound();
        if (k === "v") this.noSight = !this.noSight;
      });
    }

    toggleSound() {
      if (!this.jazz.ctx) { this.startSound(); $("btn-sound").classList.add("on"); return; }
      const muted = this.jazz.toggleMute();
      $("btn-sound").classList.toggle("on", !muted);
    }
    toggleBrain() { document.body.classList.toggle("no-brain"); this.resize(); }
    togglePause() {
      this.paused = !this.paused;
      const b = $("tb-pause"); if (b) b.textContent = this.paused ? "再開" : "一時停止";
    }

    // クリック 1 回ぶんの操作
    act(p, erase) {
      const w = this.world, g = this.game, f = w.fly;
      // 捕まったハエを助ける：紙の近くを連打
      if (f.state === "stuck" && Math.hypot(p.x - f.x, p.y - f.y) < 90) {
        f.rescue++; this.worldView.burst(f.x, f.y, [255, 220, 140], 6, 60); return;
      }
      if (erase || (this.stage.sandbox && this.tool === "erase")) {
        const near = (o) => Math.hypot(o.x - p.x, o.y - p.y) < (o.r || 20) + 26;
        for (const k of ["foods", "clouds", "streetlights", "zappers", "papers", "swatters"]) w[k] = w[k].filter((o) => !near(o));
        return;
      }
      const T = this.tool;
      if (T === "lamp" || T === "moon") return; // 押している間の操作（frame で処理）
      if (!g.use(T)) { g.say("もう使えない", "bad", 1.2); return; }
      if (T === "food") { w.foods.push({ x: p.x, y: p.y }); this.worldView.burst(p.x, p.y, [157, 245, 180], 10, 60); }
      if (T === "cloud") w.clouds.push({ x: p.x, y: p.y, r: 55 });
      if (T === "street") w.streetlights.push({ x: p.x, y: Math.min(p.y, w.ground - 80) });
      if (T === "zapper") w.zappers.push({ x: p.x, y: p.y, r: 20, zap: 0 });
      if (T === "paper") w.papers.push({ x: p.x, y: p.y, w: 26, h: 160 });
      if (T === "swatter") w.swatters.push(w.makeSwatter(p.x, p.y));
      this.updateToolbar();
    }

    updateToolbar() {
      document.querySelectorAll("[data-tool]").forEach((b) => {
        const id = b.dataset.tool, n = this.game.tools[id];
        const txt = id === "lamp" ? (Number.isFinite(n) ? `${Math.ceil(this.game.battery)}s` : "") : (Number.isFinite(n) ? `×${n}` : "");
        b.querySelector(".n").textContent = txt;
        b.disabled = id === "lamp" ? this.game.battery <= 0 : !(n > 0);
      });
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wr = $("world").parentElement.getBoundingClientRect();
      this.vw = wr.width; this.vh = wr.height;
      this.worldView.resize(wr.width, wr.height, dpr);
      const br = $("brain-wrap").getBoundingClientRect();
      if (br.width > 0 && br.height > 0) this.brainView.resize(br.width, br.height, dpr);
      // 横幅いっぱいを基本に、縦長の画面では少し寄る（はみ出た分は横にスクロール）
      this.cam.s = Math.max(wr.width / 1000, Math.min(wr.height / 900, wr.width / 520));
    }

    // ハエを置き直す。脳の状態（膜電位・発火の余韻）も静止に戻す。
    // 戻さないと、前のハエの興奮が残って、生まれた瞬間に逃避の突進をしてしまう
    newFly(resetWorld = true) {
      if (resetWorld) this.world.resetFly();
      this.brain.reset();
      // 目を開けた瞬間に光の入力が一斉に入ると、同期した発火が GF まで届いて突進してしまう。
      // 身体は動かさずに 0.3 秒ぶん脳だけ先に回して慣らし、最初の 1 秒は逃避の突進を抑える
      this.senses.sample(this.world);
      this.senses.apply(this.brain, { hunger: this.game ? this.game.hunger : 0.5 });
      this.brain.run(300);
      this.motor.gfCool = 1.0;
    }

    camTarget() {
      const f = this.world.fly, viewH = (this.vh || 1) / this.cam.s, viewW = (this.vw || 1) / this.cam.s;
      const y = Math.max(Math.min(f.y - viewH * 0.55, this.world.H - viewH), Math.min(0, this.world.H - viewH));
      const x = viewW >= 1000 ? (1000 - viewW) / 2 : Math.max(0, Math.min(1000 - viewW, f.x - viewW / 2));
      return { x, y };
    }

    // ---------------- 1 刻み：感覚 → 脳 → 運動 → 身体 → 世界 → ゲーム ----------------
    tick(dt) {
      const w = this.world, g = this.game, P = this.pointer;
      // ランタン：押している間だけ灯る
      const lampOn = !this.demo && this.screen === "play" && this.tool === "lamp" && P.down && P.in && g.battery > 0;
      w.lamp.on = lampOn;
      if (lampOn) { w.lamp.x = P.x; w.lamp.y = P.y; g.battery = Math.max(0, g.battery - dt); }
      if (this.tool === "moon" && P.down && this.stage.sandbox) { w.moon.x = P.x; w.moon.y = P.y; }

      this.senses.sample(w);
      this.senses.apply(this.brain, { hunger: g.hunger });
      this.brain.run(dt * 1000);
      const cmd = this.motor.read(this.brain, dt);
      const events = w.step(dt, cmd);
      this.effects(events);
      const r = g.update(dt, w, events);
      if (r === "respawn") this.newFly();
      if (r === "clear") this.onClear();
      if (r === "over") this.onOver();
      if (this.demo && w.fly.state === "dead") { this.newFly(); g.state = "play"; }
      if (this.demo && events.some((e) => e.type === "moon")) this.newFly();
    }

    effects(events) {
      const V = this.worldView, J = this.jazz;
      for (const e of events) {
        if (e.type === "eat") { V.burst(e.x, e.y, [157, 245, 180], 24); J.sfx("eat"); }
        if (e.type === "dash") V.burst(e.x, e.y, [200, 150, 255], 14, 140);
        if (e.type === "slam") { V.shake = 1; J.sfx("slam"); }
        if (e.type === "stuck") J.sfx("stuck");
        if (e.type === "freed") V.burst(e.x, e.y, [255, 230, 160], 20);
        if (e.type === "bump") V.burst(e.x, e.y, [255, 140, 140], 8, 60);
        if (e.type === "dead") {
          V.burst(e.x, e.y, e.cause === "zapper" ? [180, 160, 255] : [255, 120, 120], 40, 160);
          V.shake = 0.8; if (e.cause === "zapper") { V.flashA = 0.35; J.sfx("zap"); }
          J.sfx("dead");
        }
        if (e.type === "moon") V.burst(this.world.moon.x, this.world.moon.y, [255, 241, 207], 80, 200);
      }
    }

    onClear() {
      const g = this.game, st = this.stage;
      this.jazz.sfx("clear");
      this.worldView.flashA = 0.5;
      const prev = this.progress.stars[st.id] || 0;
      this.progress.stars[st.id] = Math.max(prev, g.stars);
      this.progress.best[st.id] = Math.max(this.progress.best[st.id] || 0, g.score);
      saveProgress(this.progress);
      this.resultTimer = setTimeout(() => {
        $("res-title").textContent = `STAGE ${st.id}　${st.name}　クリア`;
        $("res-stars").innerHTML = [1, 2, 3].map((k) => `<span class="${k <= g.stars ? "" : "off"}">★</span>`).join("");
        $("res-detail").innerHTML =
          `スコア ${g.score.toLocaleString()}　／　${g.time.toFixed(1)} 秒（目標 ${st.par} 秒）　／　失ったハエ ${g.lost} 匹<br>` +
          `★ 月に届く　★ 1 匹も失わない　★ 目標時間以内<br><span style="color:var(--faint)">ハエにとって、それはただ、いちばん明るい光だった。</span>`;
        $("btn-next").classList.toggle("hidden", FM.STAGES.indexOf(st) < 0 || FM.STAGES.indexOf(st) === FM.STAGES.length - 1);
        this.showScreen("result");
      }, 1200);
    }

    onOver() {
      const st = this.stage;
      this.resultTimer = setTimeout(() => {
        $("res-title").textContent = `STAGE ${st.id}　${st.name}`;
        $("res-stars").innerHTML = `<span class="off">★★★</span>`;
        $("res-detail").innerHTML = `3 匹とも、月には届かなかった。<br><span style="color:var(--faint)">光を追うのは、ハエの配線がそうなっているから。</span>`;
        $("btn-next").classList.add("hidden");
        this.showScreen("result");
      }, 900);
    }

    frame(now) {
      const elapsed = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      this.acc += elapsed;
      this.brain.clearSpikes();
      let simDt = 0;
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (!this.paused && this.game.state !== "over") { this.t += STEP; this.tick(STEP); simDt += STEP; }
      }

      // カメラ：ハエを追う（縦にスクロール）
      const ct = this.camTarget();
      this.cam.y += (ct.y - this.cam.y) * Math.min(1, elapsed * 3);
      this.cam.x += (ct.x - this.cam.x) * Math.min(1, elapsed * 3);

      const d = this.motor.dn;
      this.jazz.update({
        spikesPerSec: this.brainView.spikesPerSec,
        turn: this.motor.out.turn, thrust: Math.min(1, d.fwd / 200),
        moon: Math.max(0, 1 - this.world.distToMoon() / 900),
        gf: d.gf > 25 && this.motor.gfCool > 0.95,
      });

      this.worldView.draw(this.world, this.senses, this.game, this.cam, this.t, { sight: !this.noSight, dt: elapsed });
      if (!document.body.classList.contains("no-brain")) this.brainView.draw(this.senses, this.motor, this.t, simDt, elapsed);
      this.hud(elapsed);
      requestAnimationFrame((t) => this.frame(t));
    }

    hud(dt) {
      const g = this.game;
      if (this.screen === "play") {
        $("score").textContent = Math.round(g.score).toLocaleString();
        $("dist").textContent = Math.round(this.world.distToMoon() / 10);
        $("time").textContent = g.time.toFixed(1);
        $("lives").textContent = Number.isFinite(g.lives) ? "🪰".repeat(Math.max(0, g.lives - g.lost)) + "·".repeat(Math.min(g.lost, g.lives)) : "";
        $("energy").style.width = Math.max(0, g.energy) + "%";
        $("energy-bar").classList.toggle("low", g.energy < 25);
        this.updateToolbar();
      }
      $("msgs").innerHTML = g.messages.map((m) =>
        `<div class="msg ${m.kind}" style="opacity:${Math.min(1, (m.life - m.t) * 1.5)}">${m.text}</div>`).join("");
    }
  }

  // ---- 検証用：画面を使わず、同じ閉ループを速く回す（tests.html が使う） ----
  // FM.experiment({ seconds, seed, lesion, setup, circuit }) → { startDist, minDist, finalDist, reached, eaten, hits }
  FM.experiment = function ({ seconds = 20, seed = 1, lesion = null, setup = null, circuit = FM.CIRCUIT, sensesP = null, calibrate = true } = {}) {
    const rng = FM.mulberry32(seed);
    const stage = { id: -1, H: 620, start: [150, 450], moon: [700, 150], tools: {} };
    const world = new FM.World(stage, rng);
    world.fly.h = 0;
    world.moon.r = 26;
    if (setup) setup(world);
    const brain = new FM.Brain(circuit, { dt: BRAIN_DT, seed, lesion });
    const senses = new FM.Senses(circuit), motor = new FM.Motor();
    if (sensesP) Object.assign(senses.P, sensesP);
    if (calibrate) motor.calibrate(circuit);
    const startDist = world.distToMoon();
    let minDist = startDist, reached = false, eaten = 0, hits = 0;
    for (let i = 0; i < seconds / STEP; i++) {
      senses.sample(world);
      senses.apply(brain, { hunger: 0.5 });
      brain.run(STEP * 1000);
      const ev = world.step(STEP, motor.read(brain, STEP));
      for (const e of ev) { if (e.type === "moon") reached = true; if (e.type === "eat") eaten++; if (e.type === "bump") hits++; }
      minDist = Math.min(minDist, world.distToMoon());
      if (reached || world.fly.state === "dead") break;
    }
    return { startDist: Math.round(startDist), minDist: Math.round(minDist), finalDist: Math.round(world.distToMoon()), reached, eaten, hits, dead: world.fly.state === "dead" };
  };

  // 動かなくなったとき、理由が画面に出るようにする（黙って止まらない）
  function showError(msg) {
    let box = document.getElementById("fatal");
    if (!box) {
      box = document.createElement("div");
      box.id = "fatal";
      box.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:100;padding:12px 14px;border-radius:10px;" +
        "background:rgba(60,10,20,0.92);color:#ffd9d9;font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;max-height:40vh;overflow:auto";
      document.body.appendChild(box);
    }
    box.textContent += (box.textContent ? "\n" : "エラーが起きました。この文字を送ってもらえれば直せます：\n") + msg;
  }
  window.addEventListener("error", (e) => showError(`${e.message}\n  at ${(e.filename || "").split("/").pop()}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => showError(String(e.reason)));

  window.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("world")) return;
    if (!FM.CIRCUITS || !FM.Brain || !FM.World) { showError("スクリプトの読み込みに失敗しました（src フォルダが index.html と同じ場所にあるか確認してください）"); return; }
    try { FM.app = new App(); } catch (e) { showError(e.stack || String(e)); }
  });
})();
