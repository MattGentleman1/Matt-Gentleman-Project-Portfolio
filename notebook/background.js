/* LAB NOTEBOOK background — an oscilloscope in the upper right
   drawing a slowly evolving Lissajous figure with phosphor
   persistence, and a chart-recorder trace crawling along the
   bottom edge. ~30 fps, paused when hidden, static frame under
   prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1;
  var scope = document.createElement("canvas"), sctx = scope.getContext("2d");
  var sx = 0, sy = 0, sr = 0;          // scope centre + radius
  var phase = 0, lastT = 0;
  var strip = [];                       // chart recorder samples

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W < 760) { sr = W * 0.42; sx = W * 0.5; sy = H * 0.3; }
    else { sr = Math.min(W * 0.17, H * 0.28); sx = W - sr * 1.25; sy = sr * 1.35; }
    scope.width = Math.floor(sr * 2 * dpr); scope.height = Math.floor(sr * 2 * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = "#0b0e14"; sctx.fillRect(0, 0, sr * 2, sr * 2);
    strip = [];
    if (reduce) { for (var i = 0; i < 400; i++) step(i * 0.004, 0.004); draw(0); }
  }

  // Lissajous with slowly drifting frequency ratio and phase
  function liss(u) {
    var a = 3, b = 2;
    var d = phase;
    return [Math.sin(a * u + d) * sr * 0.78, Math.sin(b * u) * sr * 0.78];
  }

  function step(t, dt) {
    if (sr < 2) return;
    phase += dt * 0.18;
    // persistence: fade the phosphor
    sctx.fillStyle = "rgba(11,14,20," + (reduce ? 0.0 : 0.035).toFixed(3) + ")";
    sctx.fillRect(0, 0, sr * 2, sr * 2);
    // draw the next arc of the beam
    var SPEED = 7, u0 = t * SPEED, n = 24;
    sctx.strokeStyle = "rgba(214,165,69,0.85)"; sctx.lineWidth = 1.4;
    sctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var p = liss(u0 + (i / n) * dt * SPEED);
      if (i === 0) sctx.moveTo(sr + p[0], sr + p[1]); else sctx.lineTo(sr + p[0], sr + p[1]);
    }
    sctx.stroke();
    // chart recorder sample
    var v = 0.45 * Math.sin(t * 1.1) + 0.25 * Math.sin(t * 2.9 + 1) + 0.12 * Math.sin(t * 7.3);
    strip.push(v);
    if (strip.length > W / 2 + 10) strip.shift();
  }

  function draw(t) {
    if (W < 2 || H < 2) return;
    ctx.clearRect(0, 0, W, H);

    // scope: graticule, then persistence layer, then bezel
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "rgba(11,14,20,0.6)"; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.strokeStyle = "rgba(134,169,255,0.12)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var g = -4; g <= 4; g++) {
      ctx.moveTo(sx + g * sr / 4, sy - sr); ctx.lineTo(sx + g * sr / 4, sy + sr);
      ctx.moveTo(sx - sr, sy + g * sr / 4); ctx.lineTo(sx + sr, sy + g * sr / 4);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(134,169,255,0.28)";
    ctx.beginPath(); ctx.moveTo(sx, sy - sr); ctx.lineTo(sx, sy + sr); ctx.moveTo(sx - sr, sy); ctx.lineTo(sx + sr, sy); ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(scope, sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    ctx.strokeStyle = "rgba(235,231,221,0.22)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(235,231,221,0.08)"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(sx, sy, sr + 6, 0, Math.PI * 2); ctx.stroke();

    // chart recorder along the bottom
    var base = H - 70, amp = 34;
    ctx.strokeStyle = "rgba(235,231,221,0.10)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = -2; k <= 2; k++) { ctx.moveTo(0, base + k * amp / 2); ctx.lineTo(W, base + k * amp / 2); }
    ctx.stroke();
    if (strip.length > 1) {
      ctx.strokeStyle = "rgba(134,169,255,0.55)"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      var x0 = W - strip.length * 2;
      for (var i = 0; i < strip.length; i++) {
        var x = x0 + i * 2, y = base - strip[i] * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // pen
      ctx.fillStyle = "rgba(214,165,69,0.9)";
      ctx.beginPath(); ctx.arc(W - 2, base - strip[strip.length - 1] * amp, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  var last = 0, running = false, start = performance.now();
  function frame(now) {
    if (!running) return;
    try {
    if (now - last >= 33) {
      var t = (now - start) / 1000, dt = Math.min(0.1, t - lastT); lastT = t; last = now;
      step(t, dt); draw(t);
    }
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
  if (!reduce) play();
})();
