// ゲームの約束事（ゲームレイヤ）
// スコア・エネルギー・残り 3 匹・道具・星。ハエの脳はこれを知らない。脳に届くのは空腹（嗅覚の感度）だけ。
(function () {
  const FM = (window.FM = window.FM || {});

  const CAUSE = {
    zapper: "殺虫灯に焼かれた",
    swatter: "叩かれた",
    paper: "ハエトリ紙から逃げられなかった",
    car: "車にはねられた",
    exhaust: "力尽きた",
  };

  class Game {
    constructor(stage) {
      this.stage = stage;
      this.lives = stage.sandbox ? Infinity : 3;
      this.lost = 0;
      this.score = 0;
      this.time = 0;
      this.energy = 100;
      this.eaten = 0;
      this.tools = Object.assign({}, stage.tools);
      this.battery = stage.tools.lamp; // 秒
      this.state = "play"; // play | dying | clear | over
      this.wait = 0;
      this.messages = [];
      this.bestDist = Infinity;
    }

    get hunger() { return 1 - this.energy / 100; }

    say(text, kind = "info", life = 2.4) { this.messages.push({ text, kind, t: 0, life }); }

    use(tool) {
      if (!(this.tools[tool] > 0)) return false;
      if (tool !== "lamp") this.tools[tool]--;
      return true;
    }

    // 戻り値：null | "respawn" | "clear" | "over"
    update(dt, world, events) {
      for (const m of this.messages) m.t += dt;
      this.messages = this.messages.filter((m) => m.t < m.life);

      if (this.state === "dying") {
        this.wait -= dt;
        if (this.wait <= 0) {
          if (this.lost >= this.lives) { this.state = "over"; return "over"; }
          this.state = "play"; this.energy = 100;
          return "respawn";
        }
        return null;
      }
      if (this.state !== "play") return null;

      this.time += dt;
      const flying = world.fly.state === "fly";
      this.energy -= (flying ? 2.2 : 0.6) * dt;

      const d = world.distToMoon();
      if (this.bestDist === Infinity) this.bestDist = d;
      if (d < this.bestDist) { this.score += (this.bestDist - d) * 0.3; this.bestDist = d; }

      let heat = false;
      for (const e of events) {
        if (e.type === "eat") { this.eaten++; this.score += 50; this.energy = Math.min(100, this.energy + 40); this.say("+50 ごちそう", "good"); }
        if (e.type === "bump") { this.score -= 15; this.energy -= 4; }
        if (e.type === "heat") heat = true;
        if (e.type === "stuck") this.say("捕まった！ 紙を連打して助けて", "bad", 3);
        if (e.type === "freed") { this.say("逃げ出した", "good"); }
        if (e.type === "dash") this.score += 5;
        if (e.type === "dead") this.die(e.cause);
        if (e.type === "moon" && !this.stage.sandbox) return this.clear();
        if (e.type === "moon" && this.stage.sandbox) { this.score += 500; this.say("月に届いた", "moon"); world.moon.x = 100 + Math.random() * 800; world.moon.y = 150 + Math.random() * 300; }
      }
      if (heat) this.energy -= 6 * dt;
      if (this.energy <= 0 && this.state === "play") {
        world.kill("exhaust");
        world.events.length = 0; // この場で死を処理する（次の step で events は消えるため）
        this.die("exhaust");
      }
      return null;
    }

    die(cause) {
      if (this.state !== "play") return;
      this.lost++;
      this.score -= 100;
      this.state = "dying";
      this.wait = 1.6;
      const left = this.lives - this.lost;
      this.say(CAUSE[cause] || "落ちた", "bad", 2.2);
      if (Number.isFinite(left)) this.say(left > 0 ? `のこり ${left} 匹` : "もう飛べるハエがいない", "info", 2.2);
    }

    clear() {
      this.state = "clear";
      const par = this.stage.par;
      this.stars = 1 + (this.lost === 0 ? 1 : 0) + (this.time <= par ? 1 : 0);
      this.timeBonus = Math.max(0, Math.round((par * 1.5 - this.time) * 20));
      this.score += 1000 + this.timeBonus + Math.round(this.energy * 3) + Math.round(this.battery * 10);
      this.score = Math.max(0, Math.round(this.score));
      return "clear";
    }
  }

  FM.Game = Game;
  FM.CAUSE = CAUSE;
})();
