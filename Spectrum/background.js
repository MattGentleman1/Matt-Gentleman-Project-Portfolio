/* SPECTRUM background — an optical bench: a HeNe-red beam split
   through a beamsplitter into two arms that recombine into
   interference rings; a white beam dispersed by a prism into a
   spectral fan; a green beam on a slowly rotating mirror that
   sweeps the bay; and pulses that travel down the beams. ~30 fps,
   paused when hidden, static frame under prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1, mobile = false;
  var layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  var P = {};  // optic positions

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry(42);

  function layout() {
    mobile = W < 760;
    P.src = [-10, H * 0.66];                // red source, off the left edge
    P.bs = [W * 0.22, H * 0.66];            // beamsplitter
    P.m1 = [W * 0.22, H * 0.22];            // mirror (reflected arm)
    P.m2 = [W * 0.86, H * 0.66];            // mirror (transmitted arm)
    P.rec = [W * 0.86, H * 0.22];           // recombination / rings
    P.wsrc = [W * 0.9, -10];                // white source, off the top
    P.prism = [W * 0.9, H * 0.42];          // prism apex
    P.gsrc = [W + 10, H * 0.9];             // green source, off the right
    P.gm = [W * 0.6, H * 0.9];              // rotating mirror
  }

  // beam = three strokes: wide faint, medium, thin bright core
  function beam(c, x0, y0, x1, y1, rgb, I) {
    var widths = [7, 3, 1], alphas = [0.05, 0.12, 0.7];
    for (var i = 0; i < 3; i++) {
      c.strokeStyle = "rgba(" + rgb + "," + (alphas[i] * I).toFixed(3) + ")";
      c.lineWidth = widths[i];
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  function optic(c, x, y, w, h, ang) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = "rgba(120,130,160,0.35)"; c.strokeStyle = "rgba(200,210,235,0.6)"; c.lineWidth = 1;
    c.fillRect(-w / 2, -h / 2, w, h); c.strokeRect(-w / 2, -h / 2, w, h);
    c.restore();
  }

  function paintStatic() {
    var c = lctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#050508"; c.fillRect(0, 0, W, H);

    // breadboard hole pattern
    c.fillStyle = "rgba(255,255,255,0.045)";
    var pitch = 36;
    for (var x = pitch / 2; x < W; x += pitch) for (var y = pitch / 2; y < H; y += pitch) c.fillRect(x, y, 1.5, 1.5);

    // optics (mounts)
    optic(c, P.bs[0], P.bs[1], 22, 22, Math.PI / 4);
    optic(c, P.m1[0], P.m1[1], 4, 30, Math.PI / 4);
    optic(c, P.m2[0], P.m2[1], 4, 30, -Math.PI / 4);
    optic(c, P.rec[0], P.rec[1], 22, 22, Math.PI / 4);
    // prism
    c.save(); c.translate(P.prism[0], P.prism[1]);
    c.fillStyle = "rgba(160,170,200,0.12)"; c.strokeStyle = "rgba(200,210,235,0.55)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -26); c.lineTo(26, 20); c.lineTo(-26, 20); c.closePath(); c.fill(); c.stroke();
    c.restore();

    // interference rings at the recombination point
    var R = mobile ? 90 : 150;
    for (var r = 6; r < R; r += 6) {
      var a = 0.22 * (1 - r / R) * (0.5 + 0.5 * Math.cos(r * 0.9));
      c.strokeStyle = "rgba(255,84,112," + a.toFixed(3) + ")"; c.lineWidth = 2;
      c.beginPath(); c.arc(P.rec[0], P.rec[1], r, 0, Math.PI * 2); c.stroke();
    }
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = layer.width = Math.floor(W * dpr);
    canvas.height = layer.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout(); paintStatic();
    if (reduce) draw(0);
  }

  var SPECTRUM = ["124,58,237", "59,130,246", "34,211,238", "74,222,128", "250,204,21", "249,115,22", "239,68,68"];

  function draw(t) {
    if (W < 2 || H < 2) return;
    ctx.drawImage(layer, 0, 0, W, H);
    var flick = 0.93 + 0.07 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
    var RED = "255,84,112", GRN = "88,230,165", WHT = "235,238,250";

    // --- red interferometer ---
    beam(ctx, P.src[0], P.src[1], P.bs[0], P.bs[1], RED, flick);
    beam(ctx, P.bs[0], P.bs[1], P.m2[0], P.m2[1], RED, 0.6 * flick);   // transmitted arm
    beam(ctx, P.bs[0], P.bs[1], P.m1[0], P.m1[1], RED, 0.6 * flick);   // reflected arm
    beam(ctx, P.m1[0], P.m1[1], P.rec[0], P.rec[1], RED, 0.5 * flick);
    beam(ctx, P.m2[0], P.m2[1], P.rec[0], P.rec[1], RED, 0.5 * flick);
    // ring "breathing" (path-length drift)
    var br = 0.5 + 0.5 * Math.sin(t * 0.35);
    var gl = ctx.createRadialGradient(P.rec[0], P.rec[1], 0, P.rec[0], P.rec[1], 60);
    gl.addColorStop(0, "rgba(255,84,112," + (0.25 * br).toFixed(3) + ")"); gl.addColorStop(1, "rgba(255,84,112,0)");
    ctx.fillStyle = gl; ctx.fillRect(P.rec[0] - 60, P.rec[1] - 60, 120, 120);

    // --- white beam -> prism -> spectral fan ---
    beam(ctx, P.wsrc[0], P.wsrc[1], P.prism[0], P.prism[1] - 4, WHT, 0.8 * flick);
    var baseAng = Math.PI * 0.62, spread = 0.05;
    for (var i = 0; i < SPECTRUM.length; i++) {
      var a = baseAng + (i - 3) * spread + 0.004 * Math.sin(t * 0.7 + i);
      var len = Math.max(W, H) * 1.2;
      beam(ctx, P.prism[0], P.prism[1] + 8, P.prism[0] + Math.cos(a) * len, P.prism[1] + 8 + Math.sin(a) * len, SPECTRUM[i], 0.38);
    }

    // --- green beam on a slowly rotating mirror ---
    var ma = -0.9 + 0.55 * Math.sin(t * 2 * Math.PI / 38);      // mirror normal wobble
    beam(ctx, P.gsrc[0], P.gsrc[1], P.gm[0], P.gm[1], GRN, 0.8 * flick);
    // incoming direction is (-1,0); reflect about mirror normal n
    var nx = Math.cos(ma), ny = Math.sin(ma);
    var dx = -1, dy = 0, dot = dx * nx + dy * ny;
    var rx = dx - 2 * dot * nx, ry = dy - 2 * dot * ny;
    var L = Math.max(W, H) * 1.5;
    beam(ctx, P.gm[0], P.gm[1], P.gm[0] + rx * L, P.gm[1] + ry * L, GRN, 0.7 * flick);
    optic(ctx, P.gm[0], P.gm[1], 4, 30, ma + Math.PI / 2);

    // --- travelling pulses ---
    if (!reduce) {
      var segs = [[P.src, P.bs, RED], [P.bs, P.m2, RED], [P.m2, P.rec, RED], [P.gsrc, P.gm, GRN]];
      for (var s = 0; s < segs.length; s++) {
        var u = ((t * 0.45 + s * 0.31) % 1.6); if (u > 1) continue;
        var A = segs[s][0], B = segs[s][1];
        var px = A[0] + (B[0] - A[0]) * u, py = A[1] + (B[1] - A[1]) * u;
        var g = ctx.createRadialGradient(px, py, 0, px, py, 14);
        g.addColorStop(0, "rgba(" + segs[s][2] + ",0.9)"); g.addColorStop(1, "rgba(" + segs[s][2] + ",0)");
        ctx.fillStyle = g; ctx.fillRect(px - 14, py - 14, 28, 28);
      }
    }

    // glow at optics
    var pts = [P.bs, P.m1, P.m2, P.gm];
    for (var k = 0; k < pts.length; k++) {
      var q = pts[k];
      var gg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 26);
      gg.addColorStop(0, "rgba(255,255,255,0.18)"); gg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gg; ctx.fillRect(q[0] - 26, q[1] - 26, 52, 52);
    }
  }

  var last = 0, running = false, start = performance.now();
  function frame(now) {
    if (!running) return;
    try {
    if (now - last >= 33) { last = now; draw((now - start) / 1000); }
    } catch (e) { /* skip frame */ }
    requestAnimationFrame(frame);
  }
  function play() { if (running || reduce) return; running = true; requestAnimationFrame(frame); }
  function pause() { running = false; }

  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { pause(); return; }
    if (W !== window.innerWidth || H !== window.innerHeight) resize();
    play();
  });
  if (reduce) draw(0); else play();
})();
