/* SENTINEL background — faint topographic contours, a fine grid,
   and a radar scope in the lower-left with a rotating sweep and
   fading contacts. ~30 fps, paused when hidden, static frame under
   prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1;
  var layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  var rx = 0, ry = 0, rr = 0;                 // radar centre + radius
  var SWEEP_PERIOD = 7.5;                       // seconds per rotation
  var blips = [], nextBlip = 0;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // static layer: grid + contours + scope rings
  function paintStatic() {
    var c = lctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#090b09"); g.addColorStop(1, "#0b0e0b");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // fine grid
    c.strokeStyle = "rgba(190,205,180,0.045)"; c.lineWidth = 1;
    c.beginPath();
    for (var x = 0.5; x < W; x += 48) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (var y = 0.5; y < H; y += 48) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();

    // topographic contours: nested wobbly loops around two centres
    var r = mulberry(21);
    var centres = [[W * 0.4, H * 0.3], [W * 0.75, H * 0.12]];
    c.strokeStyle = "rgba(127,217,138,0.075)";
    for (var k = 0; k < centres.length; k++) {
      var cx = centres[k][0], cy = centres[k][1];
      var ph = [r() * 6, r() * 6, r() * 6];
      for (var ring = 1; ring <= 11; ring++) {
        var base = ring * Math.min(W, H) * 0.045;
        c.beginPath();
        for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
          var rad = base * (1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.09 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(8 * a + ph[2]));
          var px = cx + Math.cos(a) * rad * 1.35, py = cy + Math.sin(a) * rad;
          if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      }
    }

    // radar scope rings + reticle
    c.strokeStyle = "rgba(127,217,138,0.16)";
    for (var i = 1; i <= 4; i++) {
      c.beginPath(); c.arc(rx, ry, rr * i / 4, 0, Math.PI * 2); c.stroke();
    }
    c.beginPath();
    c.moveTo(rx - rr, ry); c.lineTo(rx + rr, ry);
    c.moveTo(rx, ry - rr); c.lineTo(rx, ry + rr);
    c.stroke();
    c.strokeStyle = "rgba(127,217,138,0.09)";
    c.beginPath();
    for (var d = 0; d < Math.PI * 2; d += Math.PI / 6) {
      c.moveTo(rx + Math.cos(d) * rr * 0.25, ry + Math.sin(d) * rr * 0.25);
      c.lineTo(rx + Math.cos(d) * rr, ry + Math.sin(d) * rr);
    }
    c.stroke();
    // tick marks on the outer ring
    c.strokeStyle = "rgba(127,217,138,0.22)";
    c.beginPath();
    for (var t = 0; t < 72; t++) {
      var an = t * Math.PI / 36, len = t % 6 === 0 ? 10 : 5;
      c.moveTo(rx + Math.cos(an) * rr, ry + Math.sin(an) * rr);
      c.lineTo(rx + Math.cos(an) * (rr - len), ry + Math.sin(an) * (rr - len));
    }
    c.stroke();
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = layer.width = Math.floor(W * dpr);
    canvas.height = layer.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W < 760) { rr = W * 0.55; rx = W * 0.5; ry = H + rr * 0.15; }
    else { rr = Math.min(W * 0.26, H * 0.5); rx = W - rr * 0.7; ry = H - rr * 0.45; }
    paintStatic();
    if (reduce) { seedBlips(); draw(0); }
  }

  function seedBlips() {
    var r = mulberry(3);
    blips = [];
    for (var i = 0; i < 5; i++) blips.push({ a: r() * Math.PI * 2, d: 0.3 + r() * 0.65, born: -r() * 3 });
  }

  var rnd = mulberry(99);
  function draw(t) {
    if (W < 2 || H < 2) return;
    ctx.drawImage(layer, 0, 0, W, H);
    var ang = (t * Math.PI * 2 / SWEEP_PERIOD) % (Math.PI * 2);

    // sweep wedge (trailing fade)
    ctx.save();
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.clip();
    if (ctx.createConicGradient) {
      var cg = ctx.createConicGradient(ang - Math.PI * 2, rx, ry);
      cg.addColorStop(0, "rgba(127,217,138,0)");
      cg.addColorStop(0.82, "rgba(127,217,138,0.02)");
      cg.addColorStop(0.97, "rgba(127,217,138,0.16)");
      cg.addColorStop(1, "rgba(127,217,138,0.32)");
      ctx.fillStyle = cg; ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
    } else {
      for (var s = 0; s < 24; s++) {
        var a0 = ang - (s + 1) * 0.04, a1 = ang - s * 0.04;
        ctx.fillStyle = "rgba(127,217,138," + (0.28 * (1 - s / 24)).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, rr, a0, a1); ctx.closePath(); ctx.fill();
      }
    }
    // sweep line
    ctx.strokeStyle = "rgba(180,240,190,0.7)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(ang) * rr, ry + Math.sin(ang) * rr); ctx.stroke();
    ctx.restore();

    // contacts: spawn occasionally, "paint" when the sweep crosses them, fade over ~5 s
    if (!reduce && t > nextBlip) {
      nextBlip = t + 2 + rnd() * 5;
      blips.push({ a: rnd() * Math.PI * 2, d: 0.25 + rnd() * 0.7, born: -1, lit: false });
      if (blips.length > 9) blips.shift();
    }
    for (var i = 0; i < blips.length; i++) {
      var b = blips[i];
      if (!reduce) {
        var diff = ((ang - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.08 && (t - b.born) > SWEEP_PERIOD * 0.9) b.born = t;
      }
      var age = t - b.born;
      if (b.born < 0 && !reduce) continue;
      var alpha = Math.max(0, 1 - age / 5.5);
      if (alpha <= 0) continue;
      var bx = rx + Math.cos(b.a) * rr * b.d, by = ry + Math.sin(b.a) * rr * b.d;
      ctx.fillStyle = "rgba(240,180,41," + (0.9 * alpha).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(240,180,41," + (0.5 * alpha).toFixed(3) + ")"; ctx.lineWidth = 1;
      ctx.strokeRect(bx - 7, by - 7, 14, 14);
    }

    // scope glow
    var glow = ctx.createRadialGradient(rx, ry, rr * 0.9, rx, ry, rr * 1.25);
    glow.addColorStop(0, "rgba(127,217,138,0.05)"); glow.addColorStop(1, "rgba(127,217,138,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(rx, ry, rr * 1.25, 0, Math.PI * 2); ctx.fill();
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
