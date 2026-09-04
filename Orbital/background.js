/* ORBITAL background — starfield, a slowly rotating planet with a
   day/night terminator and city lights, and one satellite on a
   dashed orbit. Throttled to ~30 fps, paused when the tab is hidden,
   and frozen to a single static frame under prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById("bg");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, cx = 0, cy = 0, R = 0;
  var stars = [], blobs = [];
  var TILT = -23.4 * Math.PI / 180;
  var ROT_PERIOD = 240;      // seconds per planet revolution
  var ORBIT_PERIOD = 46;     // seconds per satellite orbit
  var L = norm([-0.55, -0.45, 0.7]); // light direction (upper-left, toward viewer)

  function norm(v) { var m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; }

  // deterministic PRNG so the layout is stable between loads
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return (r() + r() + r() - 1.5) * 1.15; }

  function makeContinents() {
    var r = mulberry(7);
    blobs = [];
    var clusters = 11;
    for (var c = 0; c < clusters; c++) {
      var lat = (r() - 0.5) * 2.3;          // radians, keep off the exact poles
      var lon = r() * Math.PI * 2;
      var n = 150 + Math.floor(r() * 90);
      var step = 0.026 + r() * 0.02;
      // random walk from the cluster centre -> irregular, connected landmass
      for (var i = 0; i < n; i++) {
        lat += gauss(r) * step; lon += gauss(r) * step * 1.4;
        if (Math.abs(lat) > 1.25) lat *= 0.9;
        blobs.push({ lat: lat, lon: lon, size: 0.007 + r() * 0.011, city: r() < 0.16 });
      }
    }
    // polar ice
    for (var k = 0; k < 60; k++) {
      blobs.push({ lat: 1.32 + r() * 0.26, lon: r() * Math.PI * 2, size: 0.02 + r() * 0.03, ice: true });
      blobs.push({ lat: -1.32 - r() * 0.26, lon: r() * Math.PI * 2, size: 0.02 + r() * 0.03, ice: true });
    }
  }

  function makeStars() {
    var r = mulberry(11 + W);
    var n = Math.min(520, Math.floor((W * H) / 5200));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: r() * W, y: r() * H,
        s: 0.4 + r() * 1.2,
        a: 0.25 + r() * 0.65,
        tw: r() < 0.2 ? 0.6 + r() * 1.2 : 0,
        ph: r() * Math.PI * 2
      });
    }
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (W < 760) {          // mobile: a planet horizon along the bottom edge
      R = W * 0.9; cx = W * 0.5; cy = H + R * 0.62;
    } else {
      R = Math.min(W * 0.34, H * 0.62); cx = W - R * 0.5; cy = H * 0.56;
    }
    makeStars();
    if (reduce) draw(0);
  }

  function draw(t) {
    if (W < 2 || H < 2) return;
    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#05070d"); sky.addColorStop(1, "#070b16");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // faint nebula haze
    var neb = ctx.createRadialGradient(W * 0.18, H * 0.28, 0, W * 0.18, H * 0.28, Math.max(W, H) * 0.45);
    neb.addColorStop(0, "rgba(60, 90, 170, 0.10)"); neb.addColorStop(1, "rgba(60, 90, 170, 0)");
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);

    // stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.tw ? s.a * (0.7 + 0.3 * Math.sin(t * s.tw + s.ph)) : s.a;
      ctx.fillStyle = "rgba(244,247,255," + a.toFixed(3) + ")";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // atmosphere glow
    var atm = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
    atm.addColorStop(0, "rgba(91,156,255,0.26)");
    atm.addColorStop(0.45, "rgba(91,156,255,0.10)");
    atm.addColorStop(1, "rgba(91,156,255,0)");
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2); ctx.fill();

    // planet disk
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

    var ocean = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.05, cx - R * 0.45, cy - R * 0.4, R * 1.65);
    ocean.addColorStop(0, "#184a88");
    ocean.addColorStop(0.45, "#0b2c5a");
    ocean.addColorStop(1, "#04122a");
    ctx.fillStyle = ocean; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    var rot = t * (Math.PI * 2 / ROT_PERIOD);
    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    var lights = [];
    for (var b = 0; b < blobs.length; b++) {
      var p = blobs[b];
      var lon = p.lon + rot;
      var cl = Math.cos(p.lat);
      var x3 = cl * Math.sin(lon), y3 = Math.sin(p.lat), z3 = cl * Math.cos(lon);
      if (z3 <= 0.03) continue;                      // back side of the sphere
      var xr = x3 * cosT - y3 * sinT, yr = x3 * sinT + y3 * cosT;
      var sx = cx + R * xr, sy = cy - R * yr;
      var lit = xr * L[0] + (-yr) * L[1] + z3 * L[2]; // dot with light
      var rad = p.size * R * (0.45 + 0.55 * z3);
      if (p.ice) {
        ctx.fillStyle = "rgba(215,230,245," + (0.55 * z3).toFixed(3) + ")";
      } else {
        ctx.fillStyle = "rgba(80,104,82," + (0.22 + 0.18 * z3).toFixed(3) + ")";
      }
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
      if (p.city && lit < -0.02) lights.push([sx, sy, Math.min(1, -lit * 2.2) * z3]);
    }

    // night side
    var night = ctx.createRadialGradient(cx - R * 0.5, cy - R * 0.42, R * 0.25, cx - R * 0.5, cy - R * 0.42, R * 1.75);
    night.addColorStop(0, "rgba(0,0,0,0)");
    night.addColorStop(0.5, "rgba(0,0,0,0.12)");
    night.addColorStop(0.72, "rgba(2,4,12,0.72)");
    night.addColorStop(1, "rgba(2,4,12,0.96)");
    ctx.fillStyle = night; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // city lights on the night side
    for (var c = 0; c < lights.length; c++) {
      var q = lights[c];
      ctx.fillStyle = "rgba(255,205,130," + (0.75 * q[2]).toFixed(3) + ")";
      ctx.fillRect(q[0], q[1], 1.4, 1.4);
    }

    // limb highlight
    var limb = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
    limb.addColorStop(0, "rgba(120,180,255,0)");
    limb.addColorStop(1, "rgba(120,180,255,0.28)");
    ctx.fillStyle = limb; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // orbit + satellite
    var ang = -0.42, rx = R * 1.42, ry = R * 0.30;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = "rgba(160,190,255,0.22)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    var ph = t * (Math.PI * 2 / ORBIT_PERIOD);
    var ox = rx * Math.cos(ph), oy = ry * Math.sin(ph);
    var front = Math.sin(ph) > 0;                       // lower half of ellipse = in front
    if (front || Math.hypot(ox, oy) > R) {
      var blink = (t % 1.6) < 0.12;
      ctx.fillStyle = blink ? "rgba(255,255,255,1)" : "rgba(200,220,255,0.9)";
      ctx.beginPath(); ctx.arc(ox, oy, blink ? 2.6 : 1.8, 0, Math.PI * 2); ctx.fill();
      if (blink) {
        ctx.fillStyle = "rgba(91,156,255,0.35)";
        ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill();
      }
      // solar panels: a short bar
      ctx.strokeStyle = "rgba(200,220,255,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox - 7, oy); ctx.lineTo(ox + 7, oy); ctx.stroke();
    }
    ctx.restore();
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

  makeContinents();
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { pause(); return; }
    if (W !== window.innerWidth || H !== window.innerHeight) resize();
    play();
  });
  if (reduce) draw(0); else play();
})();
