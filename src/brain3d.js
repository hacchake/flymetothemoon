// 脳の立体表示（表現レイヤ）
//
// FlyWire の実座標に置いたニューロンを、ガウス分布の光の粒（スプラット）として WebGL で描く。
// 粒は加算合成なので、奥行きの並べ替えは要らない。重なるほど明るくなり、脳が光の雲のように見える。
// ドラッグで回転、ホイールで拡大、ダブルクリックで正面に戻る。触っていないときはゆっくり揺れる。
// WebGL が使えないブラウザでは作らない（render.js が従来の 2D 表示に戻す）。
(function () {
  const FM = (window.FM = window.FM || {});

  const VS = `
    attribute vec3 aPos; attribute vec3 aCol; attribute vec2 aSA;
    uniform mat4 uMVP; uniform float uPx;
    varying vec3 vCol; varying float vA;
    void main() {
      gl_Position = uMVP * vec4(aPos, 1.0);
      gl_PointSize = clamp(aSA.x * uPx / gl_Position.w, 1.0, 96.0);
      vCol = aCol; vA = aSA.y;
    }`;
  const FS = `
    precision mediump float;
    varying vec3 vCol; varying float vA;
    void main() {
      vec2 d = gl_PointCoord * 2.0 - 1.0;
      float r2 = dot(d, d);
      if (r2 > 1.0) discard;
      float g = exp(-4.5 * r2) * vA; // ガウスの粒
      gl_FragColor = vec4(vCol * g, g);
    }`;

  // ---- 行列（列優先、WebGL の並び） ----
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function rotY(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function rotX(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function trans(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }

  class BrainGL {
    constructor(canvas) {
      this.cv = canvas;
      const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true }) // 画面の保存・スクリーンショットにも写るように;
      this.ok = !!gl;
      if (!gl) return;
      this.gl = gl;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.ok = false; return; }
      this.prog = prog;
      this.loc = {
        pos: gl.getAttribLocation(prog, "aPos"), col: gl.getAttribLocation(prog, "aCol"), sa: gl.getAttribLocation(prog, "aSA"),
        mvp: gl.getUniformLocation(prog, "uMVP"), px: gl.getUniformLocation(prog, "uPx"),
      };
      // カメラ：yaw（左右）・pitch（上下）・距離。正面からやや見下ろす
      // dist は「枠いっぱいに収まる距離」に対する倍率（1 = ちょうど収まる。小さいほど近い）
      this.cam = { yaw: 0, pitch: 0.12, dist: 1, auto: 0 };
      this.home = { yaw: 0, pitch: 0.12, dist: 1 };
      this.idle = 99;
      this.fov = 0.62;
      this.comets = { buf: gl.createBuffer(), data: new Float32Array(8 * 3200), n: 0 };
    }

    resize(w, h, dpr) {
      if (!this.ok) return;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
      this.w = w; this.h = h; this.dpr = dpr;
    }

    // 静的な点（全脳の背景）と、ニューロンの位置・色を GPU に置く
    setData({ atlasPos, atlasCol, atlasSA, neuronPos, neuronCol }) {
      const gl = this.gl;
      const buf = (arr, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, usage); return b; };
      this.atlas = { pos: buf(atlasPos), col: buf(atlasCol), sa: buf(atlasSA), n: atlasPos.length / 3 };
      this.neurons = { pos: buf(neuronPos), col: buf(neuronCol), sa: buf(new Float32Array(neuronPos.length / 3 * 2), gl.DYNAMIC_DRAW), n: neuronPos.length / 3 };
    }

    // 操作：ドラッグで回転、ホイールで拡大、ダブルクリックで正面
    attach(el) {
      if (!this.ok) return;
      let drag = null;
      el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.cam.yaw, pitch: this.cam.pitch }; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
      el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        this.cam.yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
        this.cam.pitch = Math.max(-1.45, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.008));
        this.idle = 0; this.cam.auto = 0;
      });
      const up = () => { drag = null; el.style.cursor = "grab"; };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", (e) => { e.preventDefault(); this.cam.dist = Math.max(0.35, Math.min(3, this.cam.dist * Math.exp(e.deltaY * 0.001))); this.idle = 0; }, { passive: false });
      el.addEventListener("dblclick", () => { Object.assign(this.cam, this.home, { auto: 0 }); this.idle = 99; });
      el.style.cursor = "grab";
    }

    // 画面の枠 F（CSS px）に合わせた変換行列
    matrices(F) {
      const c = this.cam;
      const P = perspective(this.fov, F.w / F.h, 0.05, 20);
      // 脳（左右 ±1、上下 ±0.5、奥行き ±0.35）が枠いっぱいに収まる距離
      const t = Math.tan(this.fov / 2), aspect = F.w / F.h;
      const fit = Math.max(1.02 / (t * aspect), 0.56 / t) + 0.35;
      const V = trans(0, 0, -c.dist * fit);
      this.refW = c.dist * fit; // 脳の中心までの距離
      const M = mul(rotX(c.pitch), rotY(c.yaw + c.auto));
      this.mvp = mul(P, mul(V, M));
      this.F = F;
      this.uPx = (F.h * this.dpr / 2) / Math.tan(this.fov / 2);
    }

    // 立体の点 → 画面（CSS px）。depth は手前ほど大きい 0..1
    project(x, y, z) {
      const m = this.mvp, F = this.F;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 0.01) return null;
      return { x: F.x + (cx / cw * 0.5 + 0.5) * F.w, y: F.y + (1 - (cy / cw * 0.5 + 0.5)) * F.h, w: cw };
    }

    // 1 フレーム描く。neuronSA：ニューロンごとの [直径, 明るさ]。comets：[x,y,z, r,g,b, 直径, 明るさ] の並び
    render(F, dt, neuronSA, comets, cometCount) {
      if (!this.ok || !this.atlas) return;
      const gl = this.gl, L = this.loc;
      // 触っていない間は、ゆっくり左右に揺れる
      this.idle += dt;
      if (this.idle > 4) this.cam.auto += ((Math.sin(performance.now() / 1000 * 0.18) * 0.55) - this.cam.auto) * Math.min(1, dt * 0.5);
      this.matrices(F);

      gl.viewport(0, 0, this.cv.width, this.cv.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const d = this.dpr;
      gl.viewport(Math.round(F.x * d), Math.round((this.h - F.y - F.h) * d), Math.round(F.w * d), Math.round(F.h * d));
      gl.useProgram(this.prog);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniformMatrix4fv(L.mvp, false, new Float32Array(this.mvp));
      gl.uniform1f(L.px, this.uPx);

      const draw = (set, n) => {
        const bind = (b, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
        bind(set.pos, L.pos, 3); bind(set.col, L.col, 3); bind(set.sa, L.sa, 2);
        gl.drawArrays(gl.POINTS, 0, n);
      };
      draw(this.atlas, this.atlas.n);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.neurons.sa); gl.bufferSubData(gl.ARRAY_BUFFER, 0, neuronSA);
      draw(this.neurons, this.neurons.n);
      if (cometCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.comets.buf);
        gl.bufferData(gl.ARRAY_BUFFER, comets.subarray(0, cometCount * 8), gl.DYNAMIC_DRAW);
        const S = 32;
        gl.enableVertexAttribArray(L.pos); gl.vertexAttribPointer(L.pos, 3, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(L.col); gl.vertexAttribPointer(L.col, 3, gl.FLOAT, false, S, 12);
        gl.enableVertexAttribArray(L.sa); gl.vertexAttribPointer(L.sa, 2, gl.FLOAT, false, S, 24);
        gl.drawArrays(gl.POINTS, 0, cometCount);
      }
    }
  }

  FM.BrainGL = BrainGL;
})();
