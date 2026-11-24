/* =====================================================================
   Salmon Slider — browser demo (PRJ-004)
   A small port of the MATLAB game loop (April5.m): same obstacle shapes,
   14-unit grid cells, RK4 integration with quadratic drag, log10 speed
   ramp, jump-scale invincibility, and AABB-per-cell collisions.
   Runs as a self-playing demo; "Take control" hands it to the visitor.
   ===================================================================== */
(function () {
  "use strict";

  // ---- constants lifted from the MATLAB build ----
  var M = 5, AREA = 0.098, RHO = 1000, CD = 0.2;      // salmon + water
  var CELL = 14;                                       // obstacle grid cell
  var FISH_Y = -40, WALL = 40, VMAX = 25;
  var SPRITE = 160, BASE_SCALE = 0.06;
  var JUMP = (function () {                            // 0.06 → 0.12 → 0.06
    var a = [], s;
    for (s = 0.06; s <= 0.12 + 1e-9; s += 0.00225) a.push(s);
    for (s = 0.12; s >= 0.06 - 1e-9; s -= 0.00225) a.push(s);
    return a;
  })();
  var SHAPES = [
    { name: "rock", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: "log",  cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { name: "bush", cells: [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]] }
  ];

  // ---- view: world x ∈ [-45, 45], y ∈ [-60, 60] on a 3:4 canvas ----
  var VW = 300, VH = 400, U = VW / 90;
  function sx(x) { return (x + 45) * U; }
  function sy(y) { return (60 - y) * U; }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }

  function readHi() { try { return +localStorage.getItem("ss-hi") || 0; } catch (e) { return 0; } }
  function writeHi(v) { try { localStorage.setItem("ss-hi", String(v)); } catch (e) {} }

  // ---- RK4 on [x, v] with drag, exactly as the MATLAB ode() ----
  function ode(y, Fx) {
    var v = y[1];
    var drag = 0.5 * RHO * CD * AREA * v * Math.abs(v);
    return [v, (Fx - drag) / M];
  }
  function rk4(y, h, Fx) {
    var k1 = ode(y, Fx).map(function (d) { return d * h; });
    var k2 = ode([y[0] + k1[0] / 2, y[1] + k1[1] / 2], Fx).map(function (d) { return d * h; });
    var k3 = ode([y[0] + k2[0] / 2, y[1] + k2[1] / 2], Fx).map(function (d) { return d * h; });
    var k4 = ode([y[0] + k3[0], y[1] + k3[1]], Fx).map(function (d) { return d * h; });
    return [
      y[0] + (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6,
      y[1] + (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6
    ];
  }

  function Game(root) {
    this.root = root;
    this.canvas = root.querySelector(".ss-canvas");
    this.btn = root.querySelector("[data-ss-toggle]");
    this.live = root.querySelector(".ss-live");
    this.ctx = this.canvas.getContext("2d");
    this.base = root.getAttribute("data-ss-assets") || "";
    this.keys = { left: false, right: false };
    this.mode = "demo";            // "demo" | "play"
    this.visible = true;
    this.running = false;
    this.hi = readHi();
    this.scroll = 0;
    this.setup();
  }

  Game.prototype.setup = function () {
    var self = this, b = this.base;
    this.resize();
    window.addEventListener("resize", function () { self.resize(); self.draw(); });
    Promise.all([
      loadImg(b + "river.jpg"), loadImg(b + "salmon.png"),
      loadImg(b + "rock.jpg"), loadImg(b + "log.png"), loadImg(b + "bush.png")
    ]).then(function (imgs) {
      self.img = { river: imgs[0], fish: imgs[1], rock: imgs[2], log: imgs[3], bush: imgs[4] };
      self.reset();
      self.bind();
      if (reduceMotion) {           // no autoplay: draw one still frame
        self.phase = "still";
        self.obs.y = 10;
        self.draw();
        self.btn.textContent = "Play the demo";
      } else {
        self.start();
      }
    });
  };

  Game.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = VW * dpr;
    this.canvas.height = VH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Game.prototype.reset = function () {
    this.state = [0, 0];
    this.i = 0;
    this.jumpIdx = -1;
    this.scale = BASE_SCALE;
    this.faceRight = false;
    this.over = false;
    this.overT = 0;
    this.countdown = this.mode === "play" ? 3.6 : 0;
    this.phase = this.countdown > 0 ? "count" : "run";
    this.focus = 1400 + Math.random() * 1400;   // demo pilot gets "tired" around here
    this.spawn(0);
  };

  Game.prototype.spawn = function (x) {
    var s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    var cols = s.cells.map(function (c) { return c[0]; });
    var rows = s.cells.map(function (c) { return c[1]; });
    this.obs = {
      shape: s,
      x: x === undefined ? 10 * (Math.floor(Math.random() * 5) - 3) : x,   // 10·randi([-3,1])
      y: 80,
      c0: Math.min.apply(null, cols), c1: Math.max.apply(null, cols),
      r0: Math.min.apply(null, rows), r1: Math.max.apply(null, rows),
      plan: Math.random() < 0.35 ? "jump" : "dodge"
    };
  };

  Game.prototype.bounds = function () {
    var o = this.obs;
    return {
      l: o.x + (o.c0 - 0.5) * CELL, r: o.x + (o.c1 + 0.5) * CELL,
      b: o.y + (o.r0 - 0.5) * CELL, t: o.y + (o.r1 + 0.5) * CELL
    };
  };

  Game.prototype.speed = function () { return 0.4 * Math.log10(Math.max(this.i, 1)); };

  // ---- the demo pilot: dodge sideways, or time a jump through ----
  Game.prototype.pilot = function () {
    var x = this.state[0], v = this.state[1], half = SPRITE * BASE_SCALE / 2;
    var bb = this.bounds(), spd = Math.max(this.speed(), 0.05);
    var fishTop = FISH_Y + half, gap = bb.b - fishTop;              // distance until contact
    var framesToHit = gap / spd;
    var target = 22 * Math.sin(this.i / 90);                        // idle wander
    var jump = false;
    var inLane = x + half + 3 > bb.l && x - half - 3 < bb.r;
    var overlapFrames = (bb.t - bb.b + 2 * half) / spd;
    var canJump = overlapFrames < JUMP.length - 8;
    var tired = this.i > this.focus;

    if (gap > -((bb.t - bb.b) + 2 * half) && framesToHit < 150) {
      if (this.obs.plan === "jump" && canJump && !tired) {
        target = x;                                                 // hold the line and jump
        var lead = (JUMP.length - overlapFrames) / 2;
        if (inLane && framesToHit <= lead && this.jumpIdx < 0) jump = true;
      } else if (inLane && !tired) {
        var left = bb.l - half - 4, right = bb.r + half + 4;
        var goL = left >= -WALL ? Math.abs(x - left) : Infinity;
        var goR = right <= WALL ? Math.abs(x - right) : Infinity;
        target = goL <= goR ? left : right;
        if (goL === Infinity && goR === Infinity && canJump && framesToHit < 25 && this.jumpIdx < 0) jump = true;
      } else if (!tired) {
        target = x;
      }
    }
    var joy = 150 * (target - x) - 40 * v;
    if (Math.abs(joy) < 50) joy = 0;                                 // joystick deadzone
    return { joy: Math.max(-3600, Math.min(3600, joy)), jump: jump };
  };

  Game.prototype.human = function () {
    var joy = (this.keys.right ? 3600 : 0) - (this.keys.left ? 3600 : 0);
    var j = this.jumpQueued; this.jumpQueued = false;
    return { joy: joy, jump: j };
  };

  Game.prototype.step = function (h) {
    this.scroll = (this.scroll + this.speed() * U * 0.9 + 0.6) % (VW * 1.5 * 2);
    if (this.phase === "count") {
      this.countdown -= h;
      if (this.countdown <= 0) this.phase = "run";
      return;
    }
    if (this.phase !== "run") return;

    this.i += 1;
    var input = this.mode === "demo" ? this.pilot() : this.human();
    if (input.joy > 0) this.faceRight = true; else if (input.joy < 0) this.faceRight = false;

    var s = rk4(this.state, h, input.joy);
    s[1] = Math.max(-VMAX, Math.min(VMAX, s[1]));
    s[0] = Math.max(-WALL, Math.min(WALL, s[0]));
    if ((s[0] >= WALL && s[1] > 0) || (s[0] <= -WALL && s[1] < 0)) s[1] = 0;
    this.state = s;

    if (input.jump && this.jumpIdx < 0) this.jumpIdx = 0;
    if (this.jumpIdx >= 0) {
      this.scale = JUMP[this.jumpIdx];
      this.jumpIdx += 1;
      if (this.jumpIdx >= JUMP.length) { this.jumpIdx = -1; this.scale = BASE_SCALE; }
    } else {
      this.scale = BASE_SCALE;
    }

    // collisions, one grid cell at a time (skipped while airborne)
    var x = s[0], hw = this.scale * SPRITE / 2, o = this.obs;
    if (this.jumpIdx < 0) {
      for (var k = 0; k < o.shape.cells.length; k++) {
        var bx = o.x + o.shape.cells[k][0] * CELL, by = o.y + o.shape.cells[k][1] * CELL;
        var hit = !(x + hw < bx - CELL / 2 || x - hw > bx + CELL / 2 ||
                    FISH_Y + hw < by - CELL / 2 || FISH_Y - hw > by + CELL / 2);
        if (hit) { this.gameOver(); return; }
      }
    }

    o.y -= this.speed();
    if (o.y < -80) this.spawn();
  };

  Game.prototype.gameOver = function () {
    this.phase = "over";
    this.overT = 0;
    if (this.mode === "play" && this.i > this.hi) { this.hi = this.i; writeHi(this.hi); }
  };

  // ---- drawing ----
  Game.prototype.draw = function () {
    var c = this.ctx, im = this.img;
    if (!im) return;
    c.clearRect(0, 0, VW, VH);

    // river: tile + mirrored tile so the scroll seam is invisible
    if (im.river) {
      var th = VW * 1.5, off = this.scroll % (th * 2);
      for (var n = -1; n < 3; n++) {
        var y0 = off + n * th - th;
        var flip = ((n % 2) + 2) % 2 === 1;
        c.save();
        if (flip) { c.translate(0, y0 + th); c.scale(1, -1); c.drawImage(im.river, 0, 0, VW, th); }
        else c.drawImage(im.river, 0, y0, VW, th);
        c.restore();
      }
    }

    // obstacle, drawn over its bounding box like the MATLAB image() call
    var bb = this.bounds(), key = this.obs.shape.name, oi = im[key];
    if (oi) {
      c.save();
      c.shadowColor = "rgba(0,0,0,0.45)"; c.shadowBlur = 10; c.shadowOffsetY = 6;
      if (key === "rock") { roundRect(c, sx(bb.l), sy(bb.t), (bb.r - bb.l) * U, (bb.t - bb.b) * U, 14); c.clip(); }
      c.drawImage(oi, sx(bb.l), sy(bb.t), (bb.r - bb.l) * U, (bb.t - bb.b) * U);
      c.restore();
    }

    // salmon (+ a shadow on the water while it's airborne)
    var x = this.state[0], w = this.scale * SPRITE * U;
    if (this.jumpIdx >= 0) {
      var lift = (this.scale - BASE_SCALE) / 0.06;
      c.fillStyle = "rgba(0, 20, 40, " + (0.35 - lift * 0.15) + ")";
      c.beginPath();
      c.ellipse(sx(x) + lift * 10, sy(FISH_Y) + lift * 14, w * 0.28, w * 0.12, -0.6, 0, Math.PI * 2);
      c.fill();
    }
    if (im.fish) {
      c.save();
      c.imageSmoothingEnabled = false;
      c.translate(sx(x), sy(FISH_Y));
      if (this.faceRight) c.scale(-1, 1);
      c.drawImage(im.fish, -w / 2, -w / 2, w, w);
      c.restore();
    }

    // HUD — same black box / white border look as the MATLAB text()
    var label = (this.mode === "demo" ? "DEMO  " : "") + "Score: " + this.i;
    hudBox(c, label, VW - 10, 12, "right", 12, "#fff");
    if (this.mode === "play" && this.hi) hudBox(c, "Best: " + this.hi, 10, 12, "left", 11, "#ffd84a");

    if (this.phase === "count") {
      var n = Math.ceil(this.countdown - 0.6);
      hudBox(c, n > 0 ? String(n) : "GO!", VW / 2, VH / 2 - 18, "center", 24, n > 0 ? "#ffff00" : "#00ff00");
    }
    if (this.phase === "over") {
      hudBox(c, "GAME OVER", VW / 2, VH / 2 - 38, "center", 20, "#ff3b3b");
      hudBox(c, "Score: " + this.i, VW / 2, VH / 2 + 2, "center", 14, "#fff");
      if (this.mode === "play") hudBox(c, "Press jump to play again", VW / 2, VH / 2 + 36, "center", 11, "#fff");
    }
    if (this.phase === "still") {
      hudBox(c, "Salmon Slider", VW / 2, VH / 2 - 18, "center", 18, "#fff");
    }
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function hudBox(c, text, x, y, align, size, color) {
    c.save();
    c.font = "700 " + size + "px ui-monospace, 'JetBrains Mono', Consolas, monospace";
    var w = c.measureText(text).width + size * 1.1, h = size * 2;
    var bx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    c.fillStyle = "rgba(0,0,0,0.85)"; c.fillRect(bx, y, w, h);
    c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.strokeRect(bx + 0.75, y + 0.75, w - 1.5, h - 1.5);
    c.fillStyle = color; c.textBaseline = "middle"; c.textAlign = "center";
    c.fillText(text, bx + w / 2, y + h / 2 + 1);
    c.restore();
  }

  // ---- loop: fixed 60 Hz logic steps, like one serial round-trip per step ----
  Game.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    var self = this;
    requestAnimationFrame(function tick(now) {
      if (!self.running) return;
      if (!self.visible || document.hidden) { self.last = now; requestAnimationFrame(tick); return; }
      self.acc += Math.min(now - self.last, 100); self.last = now;
      while (self.acc >= 1000 / 60) {
        self.acc -= 1000 / 60;
        if (self.phase === "over") {
          self.overT += 1 / 60;
          if (self.mode === "demo" && self.overT > 2.2) self.reset();
        } else {
          self.step(1 / 60);
        }
      }
      self.draw();
      requestAnimationFrame(tick);
    });
  };

  Game.prototype.setMode = function (mode) {
    this.mode = mode;
    this.root.classList.toggle("ss-playing", mode === "play");
    this.btn.textContent = mode === "play" ? "Back to demo" : "Take control";
    this.btn.setAttribute("aria-pressed", mode === "play" ? "true" : "false");
    if (this.live) this.live.textContent = mode === "play" ? "PLAYER 1" : "DEMO";
    this.keys.left = this.keys.right = false;
    this.reset();
    this.start();
    if (mode === "play") this.canvas.focus({ preventScroll: true });
  };

  Game.prototype.pressJump = function () {
    if (this.mode !== "play") return;
    if (this.phase === "over" && this.overT > 0.4) { this.reset(); return; }
    this.jumpQueued = true;
  };

  Game.prototype.bind = function () {
    var self = this, cv = this.canvas;
    this.btn.addEventListener("click", function () {
      self.setMode(self.mode === "play" ? "demo" : "play");
    });
    cv.addEventListener("click", function () {
      if (self.mode === "demo") self.setMode("play"); else self.pressJump();
    });
    var map = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    var jumpKeys = { " ": 1, ArrowUp: 1, ArrowDown: 1, w: 1, W: 1, s: 1, S: 1, Enter: 1 };
    cv.addEventListener("keydown", function (e) {
      if (self.mode !== "play") { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.setMode("play"); } return; }
      if (map[e.key]) { self.keys[map[e.key]] = true; e.preventDefault(); }
      else if (jumpKeys[e.key]) { if (!e.repeat) self.pressJump(); e.preventDefault(); }
      else if (e.key === "Escape") self.setMode("demo");
    });
    cv.addEventListener("keyup", function (e) { if (map[e.key]) self.keys[map[e.key]] = false; });
    cv.addEventListener("blur", function () { self.keys.left = self.keys.right = false; });

    // on-screen pad (touch + mouse)
    this.root.querySelectorAll("[data-ss-pad]").forEach(function (b) {
      var dir = b.getAttribute("data-ss-pad");
      function down(e) {
        e.preventDefault(); b.classList.add("is-down");
        if (dir === "jump") self.pressJump(); else self.keys[dir] = true;
        if (b.setPointerCapture && e.pointerId !== undefined) b.setPointerCapture(e.pointerId);
      }
      function up() { b.classList.remove("is-down"); if (dir !== "jump") self.keys[dir] = false; }
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") down(e); });
      b.addEventListener("keyup", up);
    });

    // only animate while the section is on screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
      }, { rootMargin: "100px" }).observe(cv);
    }
  };

  function init() {
    document.querySelectorAll("[data-ss-assets]").forEach(function (el) { el.ssGame = new Game(el); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
