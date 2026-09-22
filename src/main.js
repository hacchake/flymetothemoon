// 起動・画面・入力・ループ・ステージエディタ
(function () {
  const FM = (window.FM = window.FM || {});
  FM.Q = { low: false }; // 重いときに絵を減らす合図（描画側が見る）
  const BRAIN_DT = 0.5; // ms
  const STEP = 1 / 60;
  const $ = (id) => document.getElementById(id);

  // プレイヤーの道具（ステージの tools にあるものだけが出る）
  const TOOLS = {
    lamp: { label: "ランタン", key: "1", hint: "押している間、光が灯る。電池に限りあり" },
    food: { label: "餌", key: "2", hint: "クリックで置く。匂いでハエを呼び、食べると元気になる" },
    fruit: { label: "熟した果実", hint: "クリックで置く。発酵した匂いが遠くまで届き、ハエを強く呼ぶ" },
    dryice: { label: "ドライアイス", hint: "クリックで置く。二酸化炭素がたまり、ハエは近づけず失速する" },
    cloud: { label: "雲", key: "3", hint: "クリックで置く。光を遮り、ハエの行く手をふさぐ" },
    fan: { label: "扇風機", key: "4", hint: "クリックで置く。上向きの風がハエを押し上げる" },
    mirror: { label: "鏡", key: "5", hint: "クリックで置く。月の光を映して光る（月が見える場所に）" },
    moon: { label: "月", key: "6", hint: "ドラッグで月を動かす" },
    street: { label: "街灯", key: "7", hint: "クリックで置く" },
    zapper: { label: "殺虫灯", key: "8", hint: "クリックで置く（紫外線はハエにだけまぶしい）" },
    paper: { label: "ハエトリ紙", key: "9", hint: "クリックで置く（甘い匂い）" },
    swatter: { label: "ハエ叩き", key: "0", hint: "クリックで置く" },
    vinegar: { label: "酢トラップ", hint: "クリックで置く（強い匂いで誘う）" },
    web: { label: "クモの巣", hint: "クリックで置く（見えにくい）" },
    frog: { label: "カエル", hint: "クリックで置く（地面に座る）" },
    firefly: { label: "ホタル", hint: "クリックで置く（点滅する光の群れ）" },
    ufo: { label: "UFO", hint: "クリックで置く（ビームで吸い上げる）" },
  };

  // エディタで置けるもの（ステージの配列名と、座標の形）
  const EDIT = {
    start: { label: "スタート", one: true },
    moon: { label: "月", one: true },
    clouds: { label: "雲", make: (x, y) => [x, y, 55] },
    streetlights: { label: "街灯", make: (x, y, H) => [x, Math.min(y, H - 140)] },
    zappers: { label: "殺虫灯", make: (x, y) => [x, y] },
    papers: { label: "ハエトリ紙", make: (x, y) => [x, y, 160] },
    swatters: { label: "ハエ叩き", make: (x, y) => [x, y] },
    vinegars: { label: "酢トラップ", make: (x, y, H) => [x, H - 60] },
    webs: { label: "クモの巣", make: (x, y) => [x, y, 55] },
    frogs: { label: "カエル", make: (x) => [x] },
    fireflies: { label: "ホタル", make: (x, y) => [x, y] },
    fruits: { label: "熟した果実", make: (x, y) => [x, y] },
    ices: { label: "ドライアイス", make: (x, y) => [x, y] },
    ufos: { label: "UFO", make: (x, y) => [x, y] },
    erase: { label: "消す" },
  };
  const EDIT_TOOLS = ["lamp", "food", "fruit", "dryice", "cloud", "fan", "mirror"];
  const songIds = () => Object.keys(FM.SONGS || {}); // audio.js を読まないページ（tests.html）でも動くように、使うときに読む

  // ---- 保存（ブラウザにだけ。消えても遊べる） ----
  const SAVE_KEY = "fmttm-progress-v1", CUSTOM_KEY = "fmttm-custom-v1";
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続ける */ } };

  // ステージを URL に入れる（ファイルでも Web でも使える）
  const encodeStage = (s) => btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const decodeStage = (t) => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, "+").replace(/_/g, "/")))));

  function newCustomStage() {
    return {
      id: "c" + Date.now().toString(36), name: "わたしのステージ", custom: true, H: 1600, par: 40, song: "swing",
      sky: true, road: false, start: [150, 1450], moon: [800, 170],
      clouds: [], streetlights: [], zappers: [], papers: [], swatters: [], vinegars: [], webs: [], frogs: [], fireflies: [], ufos: [], fruits: [], ices: [],
      tools: { lamp: 12, food: 2, fruit: 1, dryice: 1, cloud: 2, fan: 1, mirror: 1 },
      hint: "つくったステージ",
    };
  }

  class App {
    constructor() {
      this.rng = FM.mulberry32((Math.random() * 1e9) | 0);
      this.progress = load(SAVE_KEY, { stars: {}, best: {}, secrets: {} });
      this.progress.secrets ||= {};
      this.customs = load(CUSTOM_KEY, []);
      this.circuitName = FM.CIRCUITS.flywire ? "flywire" : "schematic";
      this.worldView = new FM.WorldView($("world"));
      this.brainView = new FM.BrainView($("brain-fx"), $("brain-ui"), $("brain-gl"));
      this.jazz = new FM.Jazz();
      this.cam = { s: 1, x: 0, y: 0 };
      this.screen = "title";
      this.tool = "lamp";
      this.pointer = { down: false, x: 0, y: 0, in: false, sx: 0, sy: 0, speed: 0, lt: 0 };
      this.t = 0; this.acc = 0;
      this.fpsAvg = 60; this.qHold = 0;
      this.buildBrain();
      this.resize();
      this.load(FM.STAGES[0], { demo: true });
      window.addEventListener("resize", () => this.resize());
      this.bindInput();
      this.readSharedStage();
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
      $("stage-no").textContent = stage.sandbox ? "∞" : stage.custom ? "✎" : stage.id;
      $("stage-title").textContent = stage.name;
      $("hint").textContent = demo ? "" : stage.hint || "";
      if (!demo) this.game.say(stage.name, "moon", 2.6);
      this.jazz.setSong(demo ? "swing" : stage.song || "swing");
      this.witchMusic = null;
    }

    buildToolbar() {
      const bar = $("toolbar");
      bar.innerHTML = "";
      for (const [id, T] of Object.entries(TOOLS)) {
        if (!(id in this.game.tools)) continue;
        const b = document.createElement("button");
        b.dataset.tool = id;
        b.innerHTML = `${T.key ? `<kbd>${T.key}</kbd>` : ""}${T.label}<span class="n"></span>`;
        b.addEventListener("click", () => this.setTool(id));
        bar.appendChild(b);
      }
      const menuLabel = this.testing ? "エディタへ" : "メニュー";
      for (const [id, label, fn] of [["pause", "一時停止", () => this.togglePause()], ["retry", "やり直す", () => this.load(this.stage)], ["menu", menuLabel, () => this.showScreen("select")]]) {
        const b = document.createElement("button");
        b.id = "tb-" + id; // 結果画面のボタン（btn-retry など）と ID が重ならないように
        b.textContent = label; b.addEventListener("click", fn);
        bar.appendChild(b);
      }
      this.setTool(this.tool);
    }

    setTool(id) {
      if (this.screen === "editor") return;
      if (!(id in this.game.tools)) return;
      this.tool = id;
      document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === id));
      if (!this.demo) $("hint").textContent = TOOLS[id].hint;
    }

    showScreen(name) {
      // テストプレイ中にメニューへ行こうとしたら、エディタへ戻る
      if (name === "select" && this.testing) { this.openEditor(this.testing); return; }
      // メニューやタイトルに戻ったら、裏で動き続けるステージをデモに替える
      // （替えないと、裏でハエが月に届いて結果画面が勝手に出る）
      if ((name === "select" || name === "title") && !this.demo) this.load(FM.STAGES[0], { demo: true });
      this.screen = name;
      for (const s of ["title", "select", "result"]) $("scr-" + s).classList.toggle("hidden", s !== name);
      const playing = name === "play", editing = name === "editor";
      $("hud-top").classList.toggle("hidden", !playing && !editing);
      $("toolbar").classList.toggle("hidden", !playing);
      $("editbar").classList.toggle("hidden", !editing);
      $("hint").classList.toggle("hidden", !playing); // エディタでは説明をバーの中に出す
      $("stats").classList.toggle("hidden", editing);
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
      // つくったステージ
      const cg = $("custom-grid");
      cg.innerHTML = "";
      for (const st of this.customs) {
        const card = document.createElement("div");
        card.className = "card custom";
        card.innerHTML = `<small>つくったステージ</small>${escapeHtml(st.name)}<div class="row-mini"></div>`;
        const row = card.querySelector(".row-mini");
        for (const [label, fn] of [["遊ぶ", () => this.play(st)], ["編集", () => this.openEditor(st)], ["消す", () => this.deleteCustom(st)]]) {
          const b = document.createElement("button"); b.textContent = label; b.addEventListener("click", fn); row.appendChild(b);
        }
        cg.appendChild(card);
      }
      $("secret-line").textContent = this.progress.secrets.witch ? "✦ 魔女に会ったことがある" : "";
    }

    // testing：エディタから試しているステージ（結果画面やメニューからエディタへ戻れるように）
    play(stage, testing = null) {
      this.testing = testing;
      this.load(stage);
      this.showScreen("play");
      this.startSound();
    }

    // 音が鳴らせない環境でも、ゲームは止めない
    startSound() {
      try { this.jazz.start(); $("btn-sound").classList.add("on"); } catch (e) { console.warn("音を開始できませんでした", e); }
    }

    // ---------------- ステージエディタ ----------------
    openEditor(stage) {
      this.testing = null;
      this.edit = JSON.parse(JSON.stringify(stage || newCustomStage()));
      this.edit.custom = true;
      this.edit.tools ||= {};
      this.editTool = "clouds";
      this.load(this.edit);
      this.showScreen("editor");
      this.renderEditbar();
      $("hint").textContent = "クリックで置く ／ 右クリックで消す ／ ホイールかドラッグで上下に動かす";
      this.jazz.setSong(this.edit.song || "swing"); // エディタでは、選んでいる曲を流す
      this.startSound();
    }

    rebuildEditWorld() {
      const cy = this.cam.y;
      this.world = new FM.World(this.edit, this.rng);
      this.game = new FM.Game(this.edit);
      this.worldView.setWorld(this.world);
      this.cam.y = cy;
      $("stage-title").textContent = this.edit.name;
    }

    renderEditbar() {
      const E = this.edit, bar = $("editbar");
      bar.innerHTML = "";
      const row = (cls) => { const r = document.createElement("div"); r.className = "erow " + (cls || ""); bar.appendChild(r); return r; };
      const btn = (r, label, fn, on) => { const b = document.createElement("button"); b.innerHTML = label; if (on) b.classList.add("on"); b.addEventListener("click", fn); r.appendChild(b); return b; };

      const tip = document.createElement("div");
      tip.className = "etip"; tip.textContent = "クリックで置く ／ 右クリックで消す ／ ホイールかドラッグで上下に動かす";
      bar.appendChild(tip);
      const r1 = row();
      for (const [id, T] of Object.entries(EDIT)) btn(r1, T.label, () => { this.editTool = id; this.renderEditbar(); }, this.editTool === id);

      const r2 = row();
      btn(r2, `高さ ${E.H}`, () => {}).disabled = true;
      btn(r2, "−", () => this.editHeight(-200));
      btn(r2, "+", () => this.editHeight(200));
      btn(r2, "道路", () => { E.road = !E.road; this.rebuildEditWorld(); this.renderEditbar(); }, E.road);
      btn(r2, "飛行機", () => { E.sky = !E.sky; this.rebuildEditWorld(); this.renderEditbar(); }, E.sky);
      btn(r2, "魔女", () => { E.witch = E.witch === false ? undefined : false; this.renderEditbar(); }, E.witch !== false);
      btn(r2, `♪ ${FM.SONGS[E.song || "swing"].name}`, () => {
        const ids = songIds(); E.song = ids[(ids.indexOf(E.song || "swing") + 1) % ids.length];
        this.jazz.setSong(E.song); this.renderEditbar();
      });

      const r3 = row();
      for (const id of EDIT_TOOLS) {
        const n = E.tools[id] || 0, step = id === "lamp" ? 2 : 1;
        const b = btn(r3, `${TOOLS[id].label} ${id === "lamp" ? n + "s" : "×" + n}`, () => {});
        b.title = "左クリックで増やす、右クリックで減らす";
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); E.tools[id] = Math.max(0, n - step); this.renderEditbar(); });
        b.onclick = () => { E.tools[id] = Math.min(id === "lamp" ? 40 : 9, n + step); this.renderEditbar(); };
      }
      const name = document.createElement("input");
      name.value = E.name; name.maxLength = 24; name.className = "ename";
      name.addEventListener("input", () => { E.name = name.value || "わたしのステージ"; $("stage-title").textContent = E.name; });
      r3.appendChild(name);

      const r4 = row("main");
      btn(r4, "▶ 試す", () => { this.saveCustom(false); this.play(JSON.parse(JSON.stringify(E)), E); });
      btn(r4, "保存", () => this.saveCustom(true));
      btn(r4, "共有 URL", () => this.shareCustom());
      btn(r4, "新しく", () => this.openEditor(null));
      btn(r4, "もどる", () => { this.testing = null; this.showScreen("select"); });
    }

    editHeight(d) {
      const E = this.edit, H0 = E.H;
      E.H = Math.max(1000, Math.min(4000, E.H + d));
      const dy = E.H - H0; // 地面からの位置を保つ（下に足す）
      const shift = (a) => { a[1] = Math.max(60, a[1] + dy); };
      shift(E.start);
      for (const k of Object.keys(EDIT)) if (Array.isArray(E[k])) for (const a of E[k]) if (a.length > 1) shift(a);
      this.rebuildEditWorld(); this.renderEditbar();
    }

    editAct(p, erase) {
      const E = this.edit, T = erase ? "erase" : this.editTool;
      const x = Math.max(20, Math.min(980, p.x)), y = Math.max(40, Math.min(E.H - 70, p.y));
      if (T === "start") E.start = [x, y];
      else if (T === "moon") E.moon = [x, y];
      else if (T === "erase") {
        let best = null, bd = 60;
        for (const k of Object.keys(EDIT)) {
          if (!Array.isArray(E[k]) || EDIT[k].one) continue;
          E[k].forEach((a, i) => {
            const ay = a.length > 1 ? a[1] : E.H - 70;
            const d = Math.hypot(a[0] - p.x, ay - p.y);
            if (d < bd) { bd = d; best = [k, i]; }
          });
        }
        if (best) E[best[0]].splice(best[1], 1);
      } else {
        E[T] ||= [];
        if (E[T].length >= 20) return;
        E[T].push(EDIT[T].make(Math.round(x), Math.round(y), E.H));
      }
      this.rebuildEditWorld();
    }

    saveCustom(say) {
      const E = this.edit;
      const i = this.customs.findIndex((s) => s.id === E.id);
      const copy = JSON.parse(JSON.stringify(E));
      if (i >= 0) this.customs[i] = copy; else this.customs.push(copy);
      save(CUSTOM_KEY, this.customs);
      if (say) this.game.say("保存した", "good", 1.5);
    }

    deleteCustom(st) {
      if (!confirm(`「${st.name}」を消しますか？`)) return;
      this.customs = this.customs.filter((s) => s.id !== st.id);
      save(CUSTOM_KEY, this.customs);
      this.renderSelect();
    }

    shareCustom() {
      this.saveCustom(false);
      const url = location.href.split("#")[0] + "#s=" + encodeStage(this.edit);
      const done = () => this.game.say("共有 URL をコピーした", "good", 2);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => prompt("この URL をコピーしてください", url));
      else prompt("この URL をコピーしてください", url);
    }

    readSharedStage() {
      const m = location.hash.match(/#s=([A-Za-z0-9_-]+)/);
      if (!m) return;
      try {
        const st = decodeStage(m[1]);
        st.custom = true; st.id = st.id || "shared";
        this.shared = st;
        const b = $("btn-shared");
        b.textContent = `共有されたステージ「${st.name}」を遊ぶ`;
        b.classList.remove("hidden");
        b.addEventListener("click", () => this.play(this.shared));
      } catch (e) { console.warn("共有ステージを読めませんでした", e); }
    }

    // ---------------- 入力 ----------------
    toWorld(e) {
      const r = $("world").getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.cam.s + this.cam.x, y: (e.clientY - r.top) / this.cam.s + this.cam.y };
    }

    bindInput() {
      const cv = $("world"), P = this.pointer;
      cv.addEventListener("pointerdown", (e) => {
        if (this.screen !== "play" && this.screen !== "editor") return;
        cv.setPointerCapture(e.pointerId);
        const p = this.toWorld(e);
        Object.assign(P, p, { down: true, in: true, dragY: e.clientY, dragged: false });
        if (this.screen === "editor") { this.editDown = { y: e.clientY, camY: this.cam.y, button: e.button }; return; }
        this.act(p, e.button === 2);
      });
      cv.addEventListener("pointermove", (e) => {
        const now = performance.now(), dt = Math.max(1, now - P.lt) / 1000;
        const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        P.speed = P.speed * 0.6 + (Math.hypot(sx - P.sx, sy - P.sy) / dt) * 0.4;
        Object.assign(P, this.toWorld(e), { in: true, sx, sy, lt: now });
        if (this.screen === "editor" && this.editDown && Math.abs(e.clientY - this.editDown.y) > 6) {
          P.dragged = true;
          this.cam.y = this.editDown.camY - (e.clientY - this.editDown.y) / this.cam.s;
        }
      });
      cv.addEventListener("pointerup", (e) => {
        if (this.screen === "editor" && this.editDown) {
          if (!P.dragged) this.editAct(this.toWorld(e), this.editDown.button === 2);
          this.editDown = null;
        }
        P.down = false;
      });
      cv.addEventListener("pointerleave", () => { P.in = false; P.down = false; });
      cv.addEventListener("contextmenu", (e) => e.preventDefault());
      cv.addEventListener("wheel", (e) => {
        if (this.screen !== "editor") return;
        e.preventDefault();
        this.cam.y += e.deltaY / this.cam.s;
      }, { passive: false });

      $("btn-start").addEventListener("click", () => { this.showScreen("select"); this.startSound(); });
      $("btn-sandbox").addEventListener("click", () => this.play(FM.SANDBOX));
      $("btn-editor").addEventListener("click", () => this.openEditor(null));
      $("btn-new-custom").addEventListener("click", () => this.openEditor(null));
      $("btn-back").addEventListener("click", () => this.showScreen("title"));
      $("btn-menu").addEventListener("click", () => this.showScreen("select"));
      $("btn-retry").addEventListener("click", () => this.play(this.testing ? JSON.parse(JSON.stringify(this.testing)) : this.stage, this.testing));
      $("btn-next").addEventListener("click", () => {
        const i = FM.STAGES.indexOf(this.stage);
        if (i >= 0 && i + 1 < FM.STAGES.length) this.play(FM.STAGES[i + 1]); else this.showScreen("select");
      });
      $("btn-sound").addEventListener("click", () => this.toggleSound());
      $("btn-circuit").addEventListener("click", () => { this.circuitName = this.circuitName === "flywire" ? "schematic" : "flywire"; if (!FM.CIRCUITS[this.circuitName]) this.circuitName = "schematic"; this.buildBrain(); this.resize(); });
      $("btn-brain").addEventListener("click", () => this.toggleBrain());
      window.addEventListener("keydown", (e) => {
        if (e.target && e.target.tagName === "INPUT") return;
        const k = e.key.toLowerCase();
        for (const [id, T] of Object.entries(TOOLS)) if (T.key && k === T.key) this.setTool(id);
        if (k === " ") { e.preventDefault(); this.togglePause(); }
        if (k === "r" && this.screen === "play") this.load(this.stage);
        if (k === "b") this.toggleBrain();
        if (k === "m") this.toggleSound();
        if (k === "v") this.noSight = !this.noSight;
        if (this.screen === "editor" && (k === "arrowup" || k === "arrowdown")) { e.preventDefault(); this.cam.y += (k === "arrowup" ? -120 : 120); }
      });
    }

    toggleSound() {
      if (!this.jazz.ctx) { this.startSound(); return; }
      const muted = this.jazz.toggleMute();
      $("btn-sound").classList.toggle("on", !muted);
    }
    toggleBrain() { document.body.classList.toggle("no-brain"); this.resize(); }
    togglePause() {
      this.paused = !this.paused;
      const b = $("tb-pause"); if (b) b.textContent = this.paused ? "再開" : "一時停止";
    }

    // クリック 1 回ぶんの操作（プレイ中）
    act(p, erase) {
      const w = this.world, g = this.game, f = w.fly;
      // 捕まったハエを助ける：ハエの近くを連打
      if (f.state === "stuck" && Math.hypot(p.x - f.x, p.y - f.y) < 90) {
        f.rescue++; this.worldView.burst(f.x, f.y, [255, 220, 140], 6, 60); return;
      }
      if (erase) {
        const near = (x, y, r = 20) => Math.hypot(x - p.x, y - p.y) < r + 26;
        for (const k of ["foods", "clouds", "streetlights", "zappers", "swatters", "fans", "mirrors", "webs"]) w[k] = w[k].filter((o) => !near(o.x, o.y, o.r));
        w.papers = w.papers.filter((o) => !near(o.x, o.y + o.h / 2, o.h / 2));
        w.vinegars = w.vinegars.filter((o) => !near(o.x, o.y - 30));
        w.frogs = w.frogs.filter((o) => !near(o.x, o.y - 15));
        w.fireflies = w.fireflies.filter((o) => !near(o.cx, o.cy, 60));
        w.ufos = w.ufos.filter((o) => !near(o.x, o.y, 40));
        return;
      }
      const T = this.tool;
      if (T === "lamp" || T === "moon") return; // 押している間の操作（frame で処理）
      if (!g.use(T)) { g.say("もう使えない", "bad", 1.2); return; }
      if (T === "food") { w.foods.push({ x: p.x, y: p.y }); this.worldView.burst(p.x, p.y, [157, 245, 180], 10, 60); }
      if (T === "fruit") { w.fruits.push({ x: p.x, y: p.y, t: 0 }); this.worldView.burst(p.x, p.y, [255, 200, 110], 14, 70); }
      if (T === "dryice") { w.ices.push({ x: p.x, y: p.y, t: 0, life: 26 }); this.worldView.burst(p.x, p.y, [200, 230, 255], 16, 40); }
      if (T === "cloud") w.clouds.push({ x: p.x, y: p.y, r: 55 });
      if (T === "fan") w.fans.push({ x: p.x, y: p.y, spin: 0 });
      if (T === "mirror") w.mirrors.push({ x: p.x, y: p.y });
      if (T === "street") w.streetlights.push({ x: p.x, y: Math.min(p.y, w.ground - 80) });
      if (T === "zapper") w.zappers.push({ x: p.x, y: p.y, r: 20, zap: 0 });
      if (T === "paper") w.papers.push({ x: p.x, y: p.y, w: 26, h: 160 });
      if (T === "swatter") w.swatters.push(w.makeSwatter(p.x, p.y));
      if (T === "vinegar") w.vinegars.push({ x: p.x, y: w.ground });
      if (T === "web") w.webs.push({ x: p.x, y: p.y, r: 55 });
      if (T === "frog") w.frogs.push(w.makeFrog(p.x));
      if (T === "firefly") w.addFireflies(p.x, p.y);
      if (T === "ufo") w.ufos.push(w.makeUfo(p.x, p.y));
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
      this.cam.s = Math.max(0.05, wr.width / 1000, Math.min(wr.height / 900, wr.width / 520)); // 幅 0（非表示など）でも壊れないように
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
      const cmd = this.motor.read(this.brain, dt, { surge: this.senses.odorTrend });
      const events = w.step(dt, cmd);
      this.effects(events);
      const r = g.update(dt, w, events);
      if (r === "respawn") this.newFly();
      if (r === "clear") this.onClear();
      if (r === "over") this.onOver();
      if (this.demo && w.fly.state === "dead") { this.newFly(); g.state = "play"; }
      if (this.demo && events.some((e) => e.type === "moon")) this.newFly();
      // 魔女が飛んでいる間だけ、曲が変わる
      if (w.witch && !this.witchMusic) { this.witchMusic = this.stage.song || "swing"; this.jazz.setSong("witching"); }
      if (!w.witch && this.witchMusic) { this.jazz.setSong(this.witchMusic); this.witchMusic = null; }
    }

    effects(events) {
      const V = this.worldView, J = this.jazz, B = this.brainView;
      for (const e of events) {
        if (e.type === "eat") { V.burst(e.x, e.y, [157, 245, 180], 24); J.sfx("eat"); B.special(0.5); }
        if (e.type === "dash") { V.burst(e.x, e.y, [200, 150, 255], 14, 140); J.crash(); B.special(0.8); }
        if (e.type === "slam") { V.shake = 1; J.sfx("slam"); }
        if (e.type === "tongue") J.sfx("tongue");
        if (e.type === "stuck") J.sfx("stuck");
        if (e.type === "freed") { V.burst(e.x, e.y, [255, 230, 160], 20); B.special(0.5); }
        if (e.type === "bump") V.burst(e.x, e.y, [255, 140, 140], 8, 60);
        if (e.type === "abduct") { J.sfx("abduct"); B.special(0.8); }
        if (e.type === "abducted") V.burst(e.x, e.y, [170, 255, 210], 30, 120);
        if (e.type === "witch") {
          V.burst(e.x, e.y, [255, 230, 170], 60, 180); J.sfx("witch"); B.special(1);
          if (!this.demo) { this.progress.secrets.witch = true; save(SAVE_KEY, this.progress); }
        }
        if (e.type === "dead") {
          V.burst(e.x, e.y, e.cause === "zapper" ? [180, 160, 255] : [255, 120, 120], 40, 160);
          V.shake = 0.8; if (e.cause === "zapper") { V.flashA = 0.35; J.sfx("zap"); }
          J.sfx("dead"); B.special(1);
        }
        if (e.type === "moon") { V.burst(this.world.moon.x, this.world.moon.y, [255, 241, 207], 80, 200); B.special(1); }
      }
    }

    onClear() {
      const g = this.game, st = this.stage;
      this.jazz.sfx("clear");
      this.worldView.flashA = 0.5;
      if (!st.custom) {
        const prev = this.progress.stars[st.id] || 0;
        this.progress.stars[st.id] = Math.max(prev, g.stars);
        this.progress.best[st.id] = Math.max(this.progress.best[st.id] || 0, g.score);
        save(SAVE_KEY, this.progress);
      }
      this.resultTimer = setTimeout(() => {
        $("res-title").textContent = `${st.custom ? "" : `STAGE ${st.id}　`}${st.name}　クリア`;
        $("res-stars").innerHTML = [1, 2, 3].map((k) => `<span class="${k <= g.stars ? "" : "off"}">★</span>`).join("");
        $("res-detail").innerHTML =
          `スコア ${g.score.toLocaleString()}　／　${g.time.toFixed(1)} 秒（目標 ${st.par || 40} 秒）　／　失ったハエ ${g.lost} 匹<br>` +
          `★ 月に届く　★ 1 匹も失わない　★ 目標時間以内${g.witch ? "<br>✦ 魔女に会った" : ""}<br><span style="color:var(--faint)">ハエにとって、それはただ、いちばん明るい光だった。</span>`;
        const i = FM.STAGES.indexOf(st);
        $("btn-next").classList.toggle("hidden", i < 0 || i === FM.STAGES.length - 1);
        $("btn-menu").textContent = this.testing ? "エディタへ" : "ステージ選択";
        this.showScreen("result");
      }, 1200);
    }

    onOver() {
      const st = this.stage;
      this.resultTimer = setTimeout(() => {
        $("res-title").textContent = `${st.custom ? "" : `STAGE ${st.id}　`}${st.name}`;
        $("res-stars").innerHTML = `<span class="off">★★★</span>`;
        $("res-detail").innerHTML = `3 匹とも、月には届かなかった。<br><span style="color:var(--faint)">光を追うのは、ハエの配線がそうなっているから。</span>`;
        $("btn-next").classList.add("hidden");
        $("btn-menu").textContent = this.testing ? "エディタへ" : "ステージ選択";
        this.showScreen("result");
      }, 900);
    }

    frame(now) {
      // rAF の時刻は、起動時に測った時刻より少し前のことがある。マイナスにしない
      const elapsed = Math.max(0, Math.min(0.25, (now - this.last) / 1000));
      this.last = now;
      // 画面が重くなったら絵を軽くする（スマホや、熱で遅くなった端末で音が途切れないように）。
      // 行き来しないよう、下げる線と戻す線を離してある
      this.fpsAvg += (Math.min(90, 1 / Math.max(0.004, elapsed)) - this.fpsAvg) * 0.06;
      this.qHold += elapsed;
      if (this.qHold > 2.5) {
        this.qHold = 0;
        if (!FM.Q.low && this.fpsAvg < 42) FM.Q.low = true;
        else if (FM.Q.low && this.fpsAvg > 54) FM.Q.low = false;
      }
      this.acc += elapsed;
      this.brain.clearSpikes();
      let simDt = 0;
      const editing = this.screen === "editor";
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (!editing && !this.paused && this.game.state !== "over") { this.t += STEP; this.tick(STEP); simDt += STEP; }
      }
      if (editing) { // 絵は動かす（シミュレーションは止める）。メッセージも消えていくように
        this.t += elapsed;
        for (const m of this.game.messages) m.t += elapsed;
        this.game.messages = this.game.messages.filter((m) => m.t < m.life);
      }

      // カメラ：ハエを追う（縦にスクロール）。エディタでは手で動かす
      const viewH = this.vh / this.cam.s;
      if (editing) {
        this.cam.y = Math.max(Math.min(0, this.world.H - viewH), Math.min(this.world.H - viewH, this.cam.y));
        this.cam.x += ((this.vw / this.cam.s >= 1000 ? (1000 - this.vw / this.cam.s) / 2 : 0) - this.cam.x) * 0.2;
      } else {
        const ct = this.camTarget();
        this.cam.y += (ct.y - this.cam.y) * Math.min(1, elapsed * 3);
        this.cam.x += (ct.x - this.cam.x) * Math.min(1, elapsed * 3);
      }

      const d = this.motor.dn, P = this.pointer, w = this.world;
      P.speed *= Math.pow(0.05, elapsed); // 止まっているカーソルはすぐ静かになる
      this.jazz.update({
        spikesPerSec: this.brainView.spikesPerSec,
        turn: this.motor.out.turn, thrust: Math.min(1, d.fwd / 200),
        moon: Math.max(0, 1 - w.distToMoon() / 900),
        alt: Math.max(0, Math.min(1, 1 - w.fly.y / w.H)),
        tension: this.demo ? 0 : w.tension(),
        cursor: P.in ? { x: P.sx / (this.vw || 1), y: P.sy / (this.vh || 1), speed: P.speed } : null,
        lamp: w.lamp.on, dt: elapsed,
      });

      // ハエの見た目に、いま浴びている光と、触角を押す風を伝える（描画だけのための値）
      const S = this.senses;
      let lit = 0;
      for (let c = 0; c < S.cols; c++) lit = Math.max(lit, S.lumL[c], S.lumR[c]);
      this.worldView.flyLit = Math.min(1, lit * 0.8);
      this.worldView.windBend = Math.max(-0.7, Math.min(0.7, (S.windL - S.windR) * 0.5 + (S.soundL + S.soundR) * 0.1));
      this.worldView.draw(w, this.senses, this.game, this.cam, this.t, { sight: !this.noSight && !editing, dt: elapsed, edit: editing ? this.edit : null });
      if (!document.body.classList.contains("no-brain")) this.brainView.draw(this.senses, this.motor, this.t, simDt, elapsed, { world: w, game: this.game });
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
      if (this.screen === "editor") $("lives").textContent = "";
      $("song-name").textContent = this.jazz.ctx ? `♪ ${(this.jazz.pending || this.jazz.song).name}` : "";
      $("msgs").innerHTML = g.messages.map((m) =>
        `<div class="msg ${m.kind}" style="opacity:${Math.min(1, (m.life - m.t) * 1.5)}">${m.text}</div>`).join("");
    }
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // ---- 検証用：画面を使わず、同じ閉ループを速く回す（tests.html が使う） ----
  // FM.experiment({ seconds, seed, lesion, setup, circuit }) → { startDist, minDist, finalDist, reached, eaten, hits }
  FM.experiment = function ({ seconds = 20, seed = 1, lesion = null, setup = null, circuit = FM.CIRCUIT, sensesP = null, calibrate = true } = {}) {
    const rng = FM.mulberry32(seed);
    const stage = { id: -1, H: 620, start: [150, 450], moon: [700, 150], tools: {}, witch: false };
    const world = new FM.World(stage, rng);
    world.fly.h = 0;
    world.moon.r = 26;
    if (setup) setup(world);
    const brain = new FM.Brain(circuit, { dt: BRAIN_DT, seed, lesion });
    const senses = new FM.Senses(circuit), motor = new FM.Motor();
    if (sensesP) Object.assign(senses.P, sensesP);
    if (calibrate) motor.calibrate(circuit);
    const startDist = world.distToMoon();
    let minDist = startDist, reached = false, eaten = 0, hits = 0, dashes = 0;
    for (let i = 0; i < seconds / STEP; i++) {
      senses.sample(world);
      senses.apply(brain, { hunger: 0.5 });
      brain.run(STEP * 1000);
      const ev = world.step(STEP, motor.read(brain, STEP, { surge: senses.odorTrend }));
      for (const e of ev) { if (e.type === "moon") reached = true; if (e.type === "eat") eaten++; if (e.type === "bump") hits++; if (e.type === "dash") dashes++; }
      minDist = Math.min(minDist, world.distToMoon());
      if (reached || world.fly.state === "dead") break;
    }
    return { startDist: Math.round(startDist), minDist: Math.round(minDist), finalDist: Math.round(world.distToMoon()), reached, eaten, hits, dashes, dead: world.fly.state === "dead" };
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
