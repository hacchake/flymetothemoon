// ゲームの約束事（ゲームレイヤ）
// スコア・エネルギー・試行。ハエの脳はこれを知らない。脳に届くのは空腹（嗅覚の感度）だけ。
(function () {
  const FM = (window.FM = window.FM || {});

  class Game {
    constructor() {
      this.trials = 1;
      this.score = 0;
      this.best = 0;
      this.landings = 0;
      this.messages = [];
      this.newTrial(false);
    }

    newTrial(countIt = true) {
      if (countIt) this.trials++;
      this.energy = 100;
      this.time = 0;
      this.trialScore = 0;
      this.bestDist = Infinity;
    }

    get hunger() { return 1 - this.energy / 100; }

    say(text, kind = "info") { this.messages.push({ text, kind, t: 0 }); }

    // 戻り値 "dead" のとき、呼び出し側でハエを置き直す
    update(dt, world, events) {
      this.time += dt;
      this.energy -= 1.6 * dt;

      const d = world.distToMoon();
      if (this.bestDist === Infinity) this.bestDist = d;
      if (d < this.bestDist) { this.add((this.bestDist - d) * 0.25); this.bestDist = d; }

      for (const e of events) {
        if (e.type === "eat") { this.add(50); this.energy = Math.min(100, this.energy + 35); this.say("+50 餌", "good"); }
        if (e.type === "collide") { this.add(-25); this.energy -= 8; this.say("−25 衝突", "bad"); }
        if (e.type === "jump") { this.energy -= 2; }
        if (e.type === "moon") {
          this.add(500); this.landings++;
          this.say("+500 月に届いた", "moon");
          world.relocateMoon();
          this.bestDist = world.distToMoon();
        }
      }

      for (const m of this.messages) m.t += dt;
      this.messages = this.messages.filter((m) => m.t < 2.4);

      if (this.energy <= 0) {
        this.energy = 0;
        this.say(`力尽きた — ${this.time.toFixed(1)} 秒`, "bad");
        this.best = Math.max(this.best, this.trialScore);
        return "dead";
      }
      return null;
    }

    add(x) { this.score += x; this.trialScore += x; }
  }

  FM.Game = Game;
})();
