/* FOUNDRY background — a dark fabrication bay: roof trusses,
   columns, hanging work lights with dust in the beams, and every
   so often a weld arc (blue-white flicker that lights the whole
   bay) or an angle grinder (a stream of orange sparks). ~30 fps,
   paused when hidden, static frame under prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1;
  var layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  var lamps = [], motes = [], sparks = [], stations = [];
  var event = null, nextEvent = 3;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry(5);

  function layout() {
    var r = mulberry(17);
    lamps = []; motes = [];
    var n = W < 760 ? 2 : 4;
    for (var i = 0; i < n; i++) {
      var x = W * ((i + 0.5) / n) + (r() - 0.5) * W * 0.08;
      lamps.push({ x: x, y: H * 0.08 + r() * H * 0.04, spread: W * 0.12 + r() * W * 0.05 });
    }
    var m = W < 760 ? 40 : 110;
    for (var k = 0; k < m; k++) {
      var l = lamps[Math.floor(r() * lamps.length)];
      motes.push({ lamp: l, u: r(), v: 0.15 + r() * 0.85, sp: 0.004 + r() * 0.01, ph: r() * 6, s: 0.6 + r() * 1.2 });
    }
    // work stations near the floor where events happen
    stations = [
      { x: W * 0.12, y: H * 0.86 },
      { x: W * 0.88, y: H * 0.84 },
      { x: W * 0.5, y: H * 0.92 }
    ];
  }

  function paintStatic() {
    var c = lctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0a0b"); g.addColorStop(0.7, "#0d0d0e"); g.addColorStop(1, "#111113");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // floor seam + faint floor grid in perspective
    c.strokeStyle = "rgba(255,255,255,0.05)"; c.lineWidth = 1;
    var horizon = H * 0.72;
    c.beginPath();
    for (var i = -6; i <= 6; i++) {
      c.moveTo(W * 0.5 + i * W * 0.06, horizon); c.lineTo(W * 0.5 + i * W * 0.28, H);
    }
    for (var j = 0; j < 6; j++) { var y = horizon + (H - horizon) * Math.pow(j / 6, 1.8); c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();

    // roof trusses: top chord, bottom chord and diagonals
    var top = H * 0.02, bot = H * 0.14;
    c.strokeStyle = "rgba(255,255,255,0.09)"; c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, top); c.lineTo(W, top);
    c.moveTo(0, bot); c.lineTo(W, bot);
    var step = Math.max(90, W / 14);
    for (var x = 0; x <= W + step; x += step) {
      c.moveTo(x, bot); c.lineTo(x + step / 2, top); c.lineTo(x + step, bot);
      c.moveTo(x, top); c.lineTo(x, bot);
    }
    c.stroke();

    // columns
    c.fillStyle = "rgba(255,255,255,0.045)";
    var cols = W < 760 ? [0.06, 0.94] : [0.06, 0.34, 0.66, 0.94];
    for (var k = 0; k < cols.length; k++) {
      var cx = W * cols[k];
      c.fillRect(cx - 7, bot, 14, H * 0.66);
      c.fillRect(cx - 14, H * 0.78, 28, 6);
    }

    // lamp housings + cones
    for (var l = 0; l < lamps.length; l++) {
      var lp = lamps[l];
      c.strokeStyle = "rgba(255,255,255,0.14)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(lp.x, bot); c.lineTo(lp.x, lp.y - 14); c.stroke();
      c.fillStyle = "#1c1c1f";
      c.beginPath(); c.moveTo(lp.x - 22, lp.y); c.lineTo(lp.x + 22, lp.y); c.lineTo(lp.x + 9, lp.y - 14); c.lineTo(lp.x - 9, lp.y - 14); c.closePath(); c.fill();
      var cone = c.createLinearGradient(0, lp.y, 0, H);
      cone.addColorStop(0, "rgba(255,196,120,0.10)");
      cone.addColorStop(0.55, "rgba(255,196,120,0.03)");
      cone.addColorStop(1, "rgba(255,196,120,0)");
      c.fillStyle = cone;
      c.beginPath(); c.moveTo(lp.x - 20, lp.y); c.lineTo(lp.x + 20, lp.y);
      c.lineTo(lp.x + lp.spread, H); c.lineTo(lp.x - lp.spread, H); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,220,170,0.9)";
      c.fillRect(lp.x - 14, lp.y - 2, 28, 2);
    }

    // silhouettes: welding table + press at the stations
    c.fillStyle = "#0b0b0c";
    c.fillRect(stations[0].x - 70, stations[0].y - 4, 140, 6);      // table top
    c.fillRect(stations[0].x - 60, stations[0].y, 6, 60); c.fillRect(stations[0].x + 54, stations[0].y, 6, 60);
    c.fillRect(stations[1].x - 30, stations[1].y - 90, 60, 90);     // press frame
    c.fillRect(stations[1].x - 45, stations[1].y - 100, 90, 10);
    c.fillRect(stations[2].x - 90, stations[2].y - 6, 180, 8);      // low bench
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = layer.width = Math.floor(W * dpr);
    canvas.height = layer.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout(); paintStatic();
    if (reduce) draw(0, 0);
  }

  function startEvent(t) {
    var st = stations[Math.floor(rnd() * stations.length)];
    var grinder = rnd() < 0.4;
    event = {
      type: grinder ? "grind" : "weld",
      x: st.x + (rnd() - 0.5) * 40, y: st.y - (grinder ? 30 : 8),
      t0: t, dur: grinder ? 1.6 + rnd() * 1.4 : 0.7 + rnd() * 1.1,
      dir: st.x < W / 2 ? 1 : -1
    };
  }

  function draw(t, dt) {
    if (W < 2 || H < 2) return;
    ctx.drawImage(layer, 0, 0, W, H);

    // dust motes drifting in the lamp cones
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i], lp = m.lamp;
      if (!reduce) { m.v += m.sp * dt; if (m.v > 1) m.v = 0.12; }
      var y = lp.y + (H - lp.y) * m.v;
      var half = 20 + (lp.spread - 20) * m.v;
      var x = lp.x + (m.u - 0.5) * 2 * half + Math.sin(t * 0.5 + m.ph) * 6;
      var a = 0.26 * (1 - m.v) + 0.04;
      ctx.fillStyle = "rgba(255,220,170," + a.toFixed(3) + ")";
      ctx.fillRect(x, y, m.s, m.s);
    }

    if (reduce) return;

    // schedule events
    if (!event && t > nextEvent) startEvent(t);
    if (event) {
      var age = t - event.t0, k = age / event.dur;
      if (k >= 1) { event = null; nextEvent = t + 5 + rnd() * 9; }
      else if (event.type === "weld") {
        // stochastic arc flicker
        var f = 0.55 + rnd() * 0.45; if (rnd() < 0.12) f *= 0.35;
        var env = Math.min(1, age * 8) * (1 - Math.pow(k, 4));
        var I = f * env;
        // whole-bay fill light
        ctx.fillStyle = "rgba(150,190,255," + (0.08 * I).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
        var g = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, Math.max(W, H) * 0.55);
        g.addColorStop(0, "rgba(190,215,255," + (0.85 * I).toFixed(3) + ")");
        g.addColorStop(0.08, "rgba(150,190,255," + (0.35 * I).toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(120,160,255," + (0.08 * I).toFixed(3) + ")");
        g.addColorStop(1, "rgba(120,160,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255," + I.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(event.x, event.y, 3 + 3 * f, 0, Math.PI * 2); ctx.fill();
        // spatter
        for (var s = 0; s < 6; s++) {
          var ang = -Math.PI * (0.15 + rnd() * 0.7), sp = 120 + rnd() * 260;
          sparks.push({ x: event.x, y: event.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.4 + rnd() * 0.6, age: 0, hot: true });
        }
      } else {
        var envG = Math.min(1, age * 4) * Math.min(1, (1 - k) * 4);
        var gg = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, 220);
        gg.addColorStop(0, "rgba(255,150,60," + (0.35 * envG).toFixed(3) + ")");
        gg.addColorStop(1, "rgba(255,120,30,0)");
        ctx.fillStyle = gg; ctx.fillRect(event.x - 220, event.y - 220, 440, 440);
        for (var q = 0; q < 14; q++) {
          var a2 = (event.dir > 0 ? -0.35 : Math.PI + 0.35) + (rnd() - 0.5) * 0.5;
          var sp2 = 260 + rnd() * 360;
          sparks.push({ x: event.x, y: event.y, vx: Math.cos(a2) * sp2, vy: Math.sin(a2) * sp2, life: 0.35 + rnd() * 0.5, age: 0, hot: false });
        }
      }
    }

    // sparks: gravity, bounce on the floor, streak
    for (var p = sparks.length - 1; p >= 0; p--) {
      var sk = sparks[p];
      sk.age += dt; if (sk.age > sk.life) { sparks.splice(p, 1); continue; }
      sk.vy += 900 * dt;
      var px = sk.x, py = sk.y;
      sk.x += sk.vx * dt; sk.y += sk.vy * dt;
      if (sk.y > H - 2) { sk.y = H - 2; sk.vy *= -0.35; sk.vx *= 0.7; }
      var lf = 1 - sk.age / sk.life;
      ctx.strokeStyle = sk.hot ? "rgba(255,240,200," + (0.9 * lf).toFixed(3) + ")" : "rgba(255,170,60," + (0.9 * lf).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sk.x, sk.y); ctx.stroke();
    }
    if (sparks.length > 600) sparks.splice(0, sparks.length - 600);
  }

  var last = 0, running = false, start = performance.now();
  function frame(now) {
    if (!running) return;
    try {
    if (now - last >= 33) {
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      draw((now - start) / 1000, dt);
    }
    } catch (e) { /* skip frame */ }
    requestAnimationFrame(frame);
  }
  function play() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function pause() { running = false; }

  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { pause(); return; }
    if (W !== window.innerWidth || H !== window.innerHeight) resize();
    play();
  });
  if (reduce) draw(0, 0); else play();
})();
