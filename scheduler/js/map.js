/* ==========================================================================
   map.js — the Most Wanted map.
   1. Animatic: one continuous camera move from orbit to the front step of
      1257 Wright Ave. The globe and the street radar share a single zoom
      value, so the hand-off is a crossfade, not a cut. No canvas shadowBlur
      anywhere (that was the jank); glows are layered strokes and sprites.
   2. Afterwards it's a live, draggable radar: drag / wheel / pinch / arrow
      keys / buttons. Things are hidden on it. One of them runs away.
   The street layout is stylised, not survey-accurate.
   ========================================================================== */
(function () {
  'use strict';

  const cv = document.getElementById('map');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const radar = document.getElementById('radar');
  const rctx = radar ? radar.getContext('2d') : null;
  const card = document.getElementById('map-card');
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CFG = window.BOOKING_CONFIG;
  const E = window.Eggs;
  const TARGET = [CFG.coords.lng, CFG.coords.lat];
  const R_EARTH = 6371000;
  const ROT = -0.38;
  const $ = (id) => document.getElementById(id);
  const hud = { status: $('hud-status'), lat: $('hud-lat'), lon: $('hud-lon'), alt: $('hud-alt') };

  const C = {
    space: '#07021a', ocean: '#1a0b45', oceanEdge: '#0a0422', land: '#52207a', coast: '#ff5fa8',
    pink: '#ff2e88', hot: '#ff6eb4', cyan: '#2de2e6', yellow: '#ffd65c', orange: '#ff9e3d', purple: '#8a4dff',
    green: '#39ff88', red: '#ff3355', blue: '#4d7cff',
    ground: '#140829', water: '#0c1a46', park: '#10283a', campus: '#1d1150', minor: '#3b1f66', major: '#6b2f97',
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- state ---------- */
  let W = 0, H = 0, DPR = 1, mobile = false;
  let fx = 0, fy = 0, fxT = 0, fyT = 0;           // focus point (where the camera looks), animated
  let T = 0, last = 0, raf = 0, frame = 0;
  let introStarted = false, introDone = false;
  let world110 = null, near50 = null, graticule = null;
  let starfield = null, glowSprite = null, hatch = null;
  let zHome = 0.42;
  const cam = { x: 40, y: -10, z: 0.42, rot: ROT };
  const vel = { x: 0, y: 0 };
  let lastInput = 0, exploring = false;
  let alertUntil = 0, copsGoneUntil = 0, bigbangAt = -99, binOpen = false;
  const particles = [];
  const screenHits = [];
  let perf = { sum: 0, n: 0 };

  /* ---------- the neighbourhood (local metres, the house at 40,-10) ---------- */
  // A peninsula, roughly like the real one: the harbour to the east with
  // Dartmouth across it, the Northwest Arm to the west, open water to the south.
  const EXT = { x0: -2300, x1: 3300, y0: -1700, y1: 2300 };
  const S = (function build() {
    let seed = 1257;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const coastE = (y) => 1180 + Math.sin(y * 0.004) * 90 + Math.sin(y * 0.013) * 30;
    const dartmouth = (y) => coastE(y) + 1500 + Math.sin(y * 0.003 + 1) * 160;
    const coastW = (y) => -1420 + Math.sin(y * 0.005 + 2) * 70;
    const armW = (y) => coastW(y) - 430 - Math.sin(y * 0.004) * 60;
    const south = (x) => 1680 + Math.sin(x * 0.003) * 90 + Math.sin(x * 0.011 + 1) * 30;
    const onLand = (x, y) => x < coastE(y) - 20 && x > coastW(y) + 20 && y < south(x) - 20;
    const minor = new Path2D(), major = new Path2D(), centre = new Path2D(), water = new Path2D(), parks = new Path2D(), campus = new Path2D();
    // the harbour, running north out of the open water
    water.moveTo(coastE(-9000), -9000);
    for (let y = -9000; y <= 2400; y += 40) water.lineTo(coastE(y), y);
    for (let y = 2400; y >= -9000; y -= 40) water.lineTo(dartmouth(y), y);
    water.closePath();
    // the Northwest Arm, a dead end to the north
    water.moveTo(coastW(-2300), -2300);
    for (let y = -2300; y <= 2400; y += 40) water.lineTo(coastW(y), y);
    for (let y = 2400; y >= -2300; y -= 40) water.lineTo(armW(y), y);
    water.closePath();
    // open water to the south
    water.moveTo(-40000, 40000);
    for (let x = -40000; x <= 40000; x += x > -5000 && x < 5000 ? 40 : 2000) water.lineTo(x, south(x));
    water.lineTo(40000, 40000); water.closePath();
    parks.rect(-1150, -1180, 520, 420);
    parks.rect(500, 380, 260, 180);
    parks.rect(-1000, 1300, 1150, 380);                                         // the park at the tip
    campus.rect(-1180, -580, 360, 300);
    // Dartmouth and the mainland get a sparse grid, so they read as "elsewhere"
    for (let x = 2900; x < 6000; x += 250) { minor.moveTo(x, -3000); minor.lineTo(x, 1300); }
    for (let y = -3000; y <= 1300; y += 300) { minor.moveTo(2850, y); minor.lineTo(6000, y); }
    for (let x = -5000; x < -2200; x += 250) { minor.moveTo(x, -3000); minor.lineTo(x, 1300); }
    for (let y = -3000; y <= 1300; y += 300) { minor.moveTo(-5000, y); minor.lineTo(-2150, y); }
    const majorsX = [-1200, -800, -400, 400, 800], majorsY = [-1000, -600, -200, 200, 600, 1000];
    const seg = (p, x1, y1, x2, y2) => { if (onLand((x1 + x2) / 2, (y1 + y2) / 2)) { p.moveTo(x1, y1); p.lineTo(x2, y2); } };
    for (let x = -1400; x <= 1300; x += 100) {
      if (majorsX.includes(x)) continue;
      for (let y = -1400; y < 1400; y += 200) if (rnd() > 0.18) seg(minor, x, y, x, y + 200);
    }
    for (let y = -1400; y <= 1400; y += 200) {
      if (majorsY.includes(y)) continue;
      for (let x = -1500; x < 1300; x += 100) if (rnd() > 0.12) seg(minor, x, y, x + 100, y);
    }
    majorsX.forEach((x) => { for (let y = -1600; y < 1600; y += 50) { seg(major, x, y, x, y + 50); seg(centre, x, y, x, y + 50); } });
    majorsY.forEach((y) => { for (let x = -1600; x < 1400; x += 50) { seg(major, x, y, x + 50, y); seg(centre, x, y, x + 50, y); } });
    minor.moveTo(-400, 0); minor.lineTo(400, 0);                               // Wright Ave, guaranteed
    const route = [[-1200, 1000], [-1200, 200], [-400, 200], [-400, 0], [40, 0]];
    const lanes = [...majorsX.map((x) => ({ x0: x, y0: -1400, x1: x, y1: 1300 })), ...majorsY.map((y) => ({ x0: coastW(y) + 30, y0: y, x1: coastE(y) - 30, y1: y }))];
    const cars = Array.from({ length: 18 }, (_, i) => ({ lane: lanes[i % lanes.length], t: rnd(), v: (0.012 + rnd() * 0.02) * (rnd() > 0.5 ? 1 : -1), cop: i < 3 }));
    return { minor, major, centre, water, parks, campus, route, lanes, cars, onLand, coastE, coastW, south };
  })();

  /* ---------- points of interest ---------- */
  const POIS = [
    { id: 'house', x: 40, y: -10, kind: 'house', title: '1257 Wright Ave', body: "Hayden's PS5. Three roommates. One raccoon (unconfirmed). Excellent water pressure, questionable everything else.", action: ['Open recon scan', () => E.emit('recon:open')] },
    { id: 'bin', x: 12, y: -34, kind: 'bin', r: 9, title: 'The green bin', body: 'Visible from orbit. Do not open.' },
    { id: 'van', x: 230, y: 14, kind: 'van', title: 'Flowers by Steve', body: 'Parked outside 1257 for nine days. Has not delivered a single flower. Engine running.' },
    { id: 'pizza', x: -400, y: -600, kind: 'poi', letter: 'P', col: C.yellow, title: 'Pizza Corner', body: 'Open till 4 AM. Knows us by name. Wishes it didn\'t.' },
    { id: 'sobeys', x: 400, y: 600, kind: 'poi', letter: 'S', col: C.green, title: 'Sobeys', body: '11 shopping carts reported missing. Last seen heading towards the park. Not by us. Probably.' },
    { id: 'dal', x: -1000, y: -430, kind: 'poi', letter: 'D', col: C.blue, title: 'Dalhousie', body: 'Matt goes here. Allegedly. Attendance: ██████.' },
    { id: 'police', x: -800, y: 600, kind: 'poi', letter: 'H', col: C.red, title: 'Police HQ', body: 'They know about the barbecue. Drive normally. Do not make eye contact.' },
    { id: 'landlord', x: 820, y: -980, kind: 'landlord', letter: 'L', col: C.red, title: 'The landlord', body: 'You caught him. He would like to book an inspection. He would like to talk about "the smell".' },
    { id: 'carts', x: -880, y: -985, kind: 'hidden', title: 'Cart graveyard', body: "11 Sobeys carts. We don't know how they got here. (We do.)" },
    { id: 'controller', x: -1290, y: 1170, kind: 'hidden', title: 'X marks the spot', body: "Hayden's spare controller, buried here in 2025 so nobody could use it. He tells everyone he doesn't own one." },
    { id: 'fishing', x: 1430, y: 270, kind: 'hidden', title: "Robert's fishing spot", body: "Robert doesn't own a fishing rod. Robert comes back from 'fishing' with cash." },
  ];
  const poi = (id) => POIS.find((p) => p.id === id);
  const landlord = poi('landlord');
  landlord.home = { x: landlord.x, y: landlord.y };
  landlord.flees = 0;
  const van = poi('van');
  let tank = null;

  /* ---------- layout ---------- */
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.25);
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    mobile = W < 980;
    zHome = mobile ? 0.3 : 0.42;
    focusTargets(true);
    if (radar) { radar.width = Math.round(radar.clientWidth * DPR); radar.height = Math.round(radar.clientHeight * DPR); }
    // starfield, drawn once
    starfield = document.createElement('canvas');
    starfield.width = W; starfield.height = H;
    const sg = starfield.getContext('2d');
    const bg = sg.createRadialGradient(W * 0.5, H * 1.1, 0, W * 0.5, H * 1.1, Math.max(W, H));
    bg.addColorStop(0, '#2a0c4a'); bg.addColorStop(0.6, '#0e0428'); bg.addColorStop(1, C.space);
    sg.fillStyle = bg; sg.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 2600; i++) {
      sg.globalAlpha = 0.2 + Math.random() * 0.7;
      sg.fillStyle = Math.random() > 0.85 ? C.hot : '#fff';
      const r = Math.random() * 1.3 + 0.2;
      sg.fillRect(Math.random() * W, Math.random() * H, r, r);
    }
    sg.globalAlpha = 1;
    // atmosphere ring sprite
    glowSprite = document.createElement('canvas');
    glowSprite.width = glowSprite.height = 512;
    const gg = glowSprite.getContext('2d');
    const rg = gg.createRadialGradient(256, 256, 180, 256, 256, 256);
    rg.addColorStop(0, 'rgba(255,46,136,0)'); rg.addColorStop(0.12, 'rgba(255,94,168,.55)'); rg.addColorStop(0.35, 'rgba(138,77,255,.25)'); rg.addColorStop(1, 'rgba(45,226,230,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 512, 512);
    // water hatch pattern
    const hc = document.createElement('canvas');
    hc.width = hc.height = 16;
    const hg = hc.getContext('2d');
    hg.strokeStyle = 'rgba(45,226,230,.12)'; hg.lineWidth = 1;
    hg.beginPath(); hg.moveTo(0, 16); hg.lineTo(16, 0); hg.stroke();
    hatch = ctx.createPattern(hc, 'repeat');
  }
  function focusTargets(snap) {
    const panelW = Math.min(580, W * 0.46);
    if (exploring) { fxT = W / 2; fyT = H / 2; }
    else { fxT = mobile ? W / 2 : (W - panelW - 40) / 2; fyT = mobile ? H * 0.3 : H * 0.52; }
    if (snap) { fx = fxT; fy = fyT; }
  }

  /* ---------- geo data ----------
     A tiny custom orthographic renderer: every coastline point is stored once as
     a unit vector, and each frame is one rotate + project per point. Much cheaper
     than general-purpose clipping, and no d3 download needed. */
  const RAD = Math.PI / 180;
  function prepRings(rings) {
    let n = 0;
    rings.forEach((r) => { n += r.length; });
    const xyz = new Float32Array(n * 3), starts = [];
    let k = 0;
    rings.forEach((r) => {
      starts.push(k);
      r.forEach(([lon, lat]) => {
        const l = lon * RAD, p = lat * RAD, cp = Math.cos(p);
        xyz[k * 3] = cp * Math.cos(l); xyz[k * 3 + 1] = cp * Math.sin(l); xyz[k * 3 + 2] = Math.sin(p);
        k++;
      });
    });
    starts.push(k);
    return { xyz, starts };
  }
  function makeGraticule() {
    const rings = [];
    for (let lon = -180; lon < 180; lon += 20) { const r = []; for (let lat = -80; lat <= 80; lat += 8) r.push([lon, lat]); rings.push(r); }
    for (let lat = -60; lat <= 60; lat += 20) { const r = []; for (let lon = -180; lon <= 180; lon += 8) r.push([lon, lat]); rings.push(r); }
    return rings;
  }
  // Douglas–Peucker in lon/lat; fine at globe scale, keeps the outline cheap to draw
  function simplify(ring, tol) {
    if (ring.length < 8) return ring;
    const keep = new Uint8Array(ring.length);
    const mid = ring.length >> 1;   // closed rings start and end on the same point, so split them
    keep[0] = keep[mid] = keep[ring.length - 1] = 1;
    const stack = [[0, mid], [mid, ring.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = ring[a], [bx, by] = ring[b];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
      let best = -1, bd = tol;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / L;
        if (d > bd) { bd = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return ring.filter((_, i) => keep[i]);
  }
  function loadGeo() {
    return new Promise((resolve) => {
      if (!window.topojson) { resolve(false); return; }
      graticule = prepRings(makeGraticule());
      const get = (u) => fetch(u).then((r) => r.json());
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      setTimeout(() => done(!!world110), 3500);
      Promise.all([get('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json'), get('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')])
        .then(([a, b]) => {
          const rings = [];
          topojson.feature(a, a.objects.land).features.forEach((f) => {
            const g = f.geometry;
            (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach((poly) => poly.forEach((r) => { const s = simplify(r, 0.18); if (s.length >= 4) rings.push(s); }));
          });
          world110 = prepRings(rings);
          const reg = cropRegion(topojson.feature(b, b.objects.land));
          near50 = { fill: prepRings(reg.fill), coast: prepRings(reg.coast), outline: prepRings([reg.outline]) };
          done(true);
        })
        .catch(() => done(!!world110));
    });
  }

  /* Only the detailed coastline near Nova Scotia is kept: polygons are clipped to
     a lon/lat box for the fill, and the coast is kept as open lines so the cut
     edges never get a pink outline. Outside the box the light 110m world shows. */
  const REG = { x0: -73, x1: -54, y0: 40, y1: 50 };
  function cropRegion(fc) {
    const inside = [(p) => p[0] >= REG.x0, (p) => p[0] <= REG.x1, (p) => p[1] >= REG.y0, (p) => p[1] <= REG.y1];
    const cut = [
      (a, b) => [REG.x0, a[1] + (b[1] - a[1]) * (REG.x0 - a[0]) / (b[0] - a[0])],
      (a, b) => [REG.x1, a[1] + (b[1] - a[1]) * (REG.x1 - a[0]) / (b[0] - a[0])],
      (a, b) => [a[0] + (b[0] - a[0]) * (REG.y0 - a[1]) / (b[1] - a[1]), REG.y0],
      (a, b) => [a[0] + (b[0] - a[0]) * (REG.y1 - a[1]) / (b[1] - a[1]), REG.y1],
    ];
    const clipRing = (ring) => {
      let out = ring.slice(0, -1);
      for (let e = 0; e < 4 && out.length; e++) {
        const src = out; out = [];
        for (let i = 0; i < src.length; i++) {
          const cur = src[i], prev = src[(i + src.length - 1) % src.length];
          const ci = inside[e](cur), pi = inside[e](prev);
          if (ci) { if (!pi) out.push(cut[e](prev, cur)); out.push(cur); } else if (pi) out.push(cut[e](prev, cur));
        }
      }
      if (out.length < 3) return null;
      out.push(out[0]);
      return out;
    };
    const inBox = (p) => p[0] >= REG.x0 - 0.3 && p[0] <= REG.x1 + 0.3 && p[1] >= REG.y0 - 0.3 && p[1] <= REG.y1 + 0.3;
    const fill = [], coast = [];
    fc.features.forEach((f) => {
      const g = f.geometry;
      (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach((poly) => {
        const outer = clipRing(poly[0]);
        if (!outer) return;
        fill.push(outer);
        poly.slice(1).map(clipRing).filter(Boolean).forEach((h) => fill.push(h));
        poly.forEach((ring) => {
          let run = [];
          ring.forEach((p) => { if (inBox(p)) run.push(p); else { if (run.length > 1) coast.push(run); run = []; } });
          if (run.length > 1) coast.push(run);
        });
      });
    });
    const d = [];
    for (let i = 0; i <= 40; i++) d.push([REG.x0 + (REG.x1 - REG.x0) * i / 40, REG.y0]);
    for (let i = 0; i <= 40; i++) d.push([REG.x1, REG.y0 + (REG.y1 - REG.y0) * i / 40]);
    for (let i = 0; i <= 40; i++) d.push([REG.x1 - (REG.x1 - REG.x0) * i / 40, REG.y1]);
    for (let i = 0; i <= 40; i++) d.push([REG.x0, REG.y1 - (REG.y1 - REG.y0) * i / 40]);
    return { fill, coast, outline: d };
  }

  /* ---------- the camera path ---------- */
  const TL = { rotEnd: 3.6, zoomStart: 0.3, zoomEnd: 7.4, twistA: 5.6, twistB: 7.6, done: 7.6 };
  const baseScale = () => Math.min(W * (mobile ? 0.42 : 0.3), H * (mobile ? 0.26 : 0.36));
  function introScale() {
    const s0 = baseScale(), s1 = zHome * R_EARTH;
    const k = smoother(prog(T, TL.zoomStart, TL.zoomEnd));
    return Math.exp(lerp(Math.log(s0), Math.log(s1), k));
  }

  /* ---------- drawing: globe ---------- */
  const view = { cl: 1, sl: 0, cp: 1, sp: 0, s: 1 };
  // add rings to the current path. 'line' breaks at the horizon;
  // 'fill' pushes hidden points out to the limb so polygons still close sensibly.
  function tracePath(P, mode) {
    const { xyz, starts } = P;
    const { cl, sl, cp, sp, s } = view;
    for (let r = 0; r < starts.length - 1; r++) {
      let pen = false;
      for (let i = starts[r]; i < starts[r + 1]; i++) {
        const X = xyz[i * 3], Y = xyz[i * 3 + 1], Z = xyz[i * 3 + 2];
        const A = X * cl + Y * sl;
        const depth = sp * Z + cp * A;
        let x = Y * cl - X * sl, y = cp * Z - sp * A;
        if (depth <= 0) {
          if (mode === 'line') { pen = false; continue; }
          const len = Math.hypot(x, y) || 1;
          x /= len; y /= len;
        }
        const px = fx + s * x, py = fy - s * y;
        if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      }
      if (mode === 'fill') ctx.closePath();
    }
  }
  function project(lon, lat) {
    const l = lon * RAD, p = lat * RAD, c = Math.cos(p);
    const X = c * Math.cos(l), Y = c * Math.sin(l), Z = Math.sin(p);
    const A = X * view.cl + Y * view.sl;
    if (view.sp * Z + view.cp * A <= 0) return null;
    return [fx + view.s * (Y * view.cl - X * view.sl), fy - view.s * (view.cp * Z - view.sp * A)];
  }

  function drawGeo(scale, rot, alpha) {
    if (!world110 || alpha <= 0) return;
    const rr = easeIO(prog(T, 0, TL.rotEnd));
    const lon0 = TARGET[0] + 100 * (1 - rr), lat0 = TARGET[1] - 28 * (1 - rr);
    view.cl = Math.cos(lon0 * RAD); view.sl = Math.sin(lon0 * RAD); view.cp = Math.cos(lat0 * RAD); view.sp = Math.sin(lat0 * RAD); view.s = scale;
    const D = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)) + 20;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fx, fy); ctx.rotate(rot); ctx.translate(-fx, -fy);
    if (scale < Math.min(W, H) * 2) ctx.drawImage(glowSprite, fx - scale * 1.45, fy - scale * 1.45, scale * 2.9, scale * 2.9);
    const og = ctx.createRadialGradient(fx - scale * 0.35, fy + scale * 0.35, scale * 0.05, fx, fy, scale);
    og.addColorStop(0, '#24104f'); og.addColorStop(1, C.oceanEdge);
    ctx.fillStyle = og;
    if (scale < D * 1.2) {
      ctx.beginPath(); ctx.arc(fx, fy, scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(45,226,230,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else ctx.fillRect(fx - D, fy - D, D * 2, D * 2);
    const zr = prog(Math.log(scale), Math.log(baseScale()), Math.log(baseScale() * 30));
    if (zr < 1) {
      ctx.globalAlpha = alpha * (1 - zr);
      ctx.beginPath(); tracePath(graticule, 'line');
      ctx.strokeStyle = 'rgba(45,226,230,.18)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    ctx.lineJoin = 'round';
    const coastStroke = () => {
      ctx.strokeStyle = 'rgba(255,46,136,.22)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = C.coast; ctx.lineWidth = 1.3; ctx.stroke();
    };
    const fine = scale > 2600 && near50;
    if (!fine) {
      ctx.beginPath(); tracePath(world110, 'fill'); ctx.fillStyle = C.land; ctx.fill('evenodd');
      ctx.beginPath(); tracePath(world110, 'line'); coastStroke();
    } else {
      if (scale < 9000) {   // coarse world outside the detail box…
        ctx.save();
        ctx.beginPath(); ctx.rect(fx - D, fy - D, D * 2, D * 2); tracePath(near50.outline, 'fill'); ctx.clip('evenodd');
        ctx.beginPath(); tracePath(world110, 'fill'); ctx.fillStyle = C.land; ctx.fill('evenodd');
        ctx.beginPath(); tracePath(world110, 'line'); coastStroke();
        ctx.restore();
      }
      // …detailed Nova Scotia inside it
      ctx.beginPath(); tracePath(near50.fill, 'fill'); ctx.fillStyle = C.land; ctx.fill('evenodd');
      ctx.beginPath(); tracePath(near50.coast, 'line'); coastStroke();
    }
    ctx.restore();
    const p = project(TARGET[0], TARGET[1]);
    if (p) { const [px, py] = rotAround(p[0], p[1], rot); drawTarget(px, py, alpha); }
    if (frame % 3 === 0) setHud(lat0, lon0, Math.max(0.4, 35786 * Math.pow(baseScale() / scale, 0.95)));
  }
  function rotAround(x, y, rot) {
    const c = Math.cos(rot), s = Math.sin(rot), dx = x - fx, dy = y - fy;
    return [fx + dx * c - dy * s, fy + dx * s + dy * c];
  }
  function drawTarget(x, y, alpha) {
    const pulse = (T * 1.4) % 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.yellow;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * (1 - pulse);
    ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 34, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha;
    const lk = easeIO(prog(T, 3.8, 5.4));
    if (lk > 0) {
      const r = 120 - lk * 84, a = (1 - lk) * Math.PI / 3;
      ctx.strokeStyle = C.pink; ctx.lineWidth = 2.5;
      ctx.translate(x, y); ctx.rotate(a);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r, r - 14); ctx.lineTo(r, r); ctx.lineTo(r - 14, r); ctx.stroke(); }
    }
    ctx.restore();
  }

  /* ---------- drawing: streets ---------- */
  function toScreen(x, y, v) {
    const c = Math.cos(v.rot), s = Math.sin(v.rot), dx = (x - v.x) * v.z, dy = (y - v.y) * v.z;
    return [v.fx + dx * c - dy * s, v.fy + dx * s + dy * c];
  }
  function toWorld(sx, sy) {
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot), dx = sx - fx, dy = sy - fy;
    return { x: cam.x + (dx * c + dy * s) / cam.z, y: cam.y + (-dx * s + dy * c) / cam.z };
  }

  function drawStreets(g, v, alpha, mini) {
    if (alpha <= 0) return;
    const lw = (px) => px / v.z;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = C.ground;
    g.fillRect(0, 0, v.w || W, v.h || H);
    g.translate(v.fx, v.fy); g.rotate(v.rot); g.scale(v.z, v.z); g.translate(-v.x, -v.y);
    g.fillStyle = C.water; g.fill(S.water);
    if (!mini && hatch) { g.fillStyle = hatch; g.fill(S.water); }
    g.strokeStyle = 'rgba(45,226,230,.5)'; g.lineWidth = lw(1.4); g.stroke(S.water);
    g.fillStyle = C.park; g.fill(S.parks);
    g.fillStyle = C.campus; g.fill(S.campus);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = C.minor; g.lineWidth = lw(mini ? 1.6 : 3.4); g.stroke(S.minor);
    if (!mini) { g.strokeStyle = 'rgba(255,46,136,.16)'; g.lineWidth = lw(14); g.stroke(S.major); }
    g.strokeStyle = C.major; g.lineWidth = lw(mini ? 2.6 : 6); g.stroke(S.major);
    if (!mini) { g.strokeStyle = 'rgba(255,110,180,.55)'; g.lineWidth = lw(1); g.stroke(S.centre); }

    // the bin, if someone opened it
    if (binOpen) {
      const b = poi('bin');
      const r = 90 + Math.sin(T * 3) * 12;
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      rg.addColorStop(0, 'rgba(57,255,136,.55)'); rg.addColorStop(1, 'rgba(57,255,136,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
    }

    // GPS route
    const route = new Path2D();
    S.route.forEach(([x, y], i) => (i ? route.lineTo(x, y) : route.moveTo(x, y)));
    if (!mini) { g.strokeStyle = 'rgba(45,226,230,.22)'; g.lineWidth = lw(16); g.stroke(route); }
    g.strokeStyle = C.cyan; g.lineWidth = lw(mini ? 3 : 5.5); g.stroke(route);
    if (!mini) {
      g.save(); g.strokeStyle = 'rgba(7,2,26,.8)'; g.lineWidth = lw(2); g.setLineDash([lw(6), lw(14)]); g.lineDashOffset = -T * 40 / v.z; g.stroke(route); g.restore();
    }

    // traffic
    const now = T;
    for (const car of S.cars) {
      if (car.dead > now) continue;
      if (car.cop && now < copsGoneUntil) continue;
      const L = car.lane;
      const x = L.x0 + (L.x1 - L.x0) * car.t, y = L.y0 + (L.y1 - L.y0) * car.t;
      g.fillStyle = car.cop ? (Math.floor(now * 6) % 2 ? C.red : C.blue) : (car.v > 0 ? 'rgba(255,240,220,.85)' : 'rgba(255,94,168,.9)');
      g.beginPath(); g.arc(x, y, lw(mini ? 2 : 3.2), 0, Math.PI * 2); g.fill();
    }
    // the van
    if (!van.gone || van.leaving) {
      g.save(); g.translate(van.x, van.y);
      g.fillStyle = '#f2ecff'; g.fillRect(-lw(9), -lw(5), lw(18), lw(10));
      g.fillStyle = C.pink; g.fillRect(lw(4), -lw(5), lw(5), lw(10));
      g.restore();
    }
    if (tank) {
      g.save(); g.translate(tank.x, tank.y);
      g.fillStyle = '#5d6b2f'; g.fillRect(-lw(14), -lw(9), lw(28), lw(18));
      g.fillStyle = '#3c4620'; g.beginPath(); g.arc(0, 0, lw(7), 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3c4620'; g.lineWidth = lw(4); g.beginPath(); g.moveTo(0, 0); g.lineTo(lw(22), 0); g.stroke();
      g.restore();
    }
    // explosions
    for (const p of particles) {
      g.globalAlpha = alpha * Math.max(0, p.life);
      g.fillStyle = p.col;
      g.beginPath(); g.arc(p.x, p.y, lw(p.r), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawOverlays(v, alpha) {
    if (alpha <= 0) return;
    screenHits.length = 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'middle';
    // water + street labels
    ctx.font = '400 16px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(45,226,230,.55)';
    [[1900, -300, 'THE HARBOUR'], [-1640, 500, 'THE ARM'], [3500, -900, 'DARTMOUTH'], [-3300, -900, 'THE MAINLAND'], [-200, 2300, 'THE ATLANTIC (COLD)']].forEach(([x, y, t]) => { const [sx, sy] = toScreen(x, y, v); ctx.fillText(t, sx, sy); });
    const [ax, ay] = toScreen(-280, 0, v), [bx, by] = toScreen(-120, 0, v);
    ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(Math.atan2(by - ay, bx - ax));
    ctx.font = '400 13px "Russo One", sans-serif'; ctx.fillStyle = C.yellow; ctx.fillText('WRIGHT AVE', 0, -14);
    ctx.restore();

    // "you" arrow
    const [ux, uy] = toScreen(S.route[0][0], S.route[0][1], v);
    ctx.save(); ctx.translate(ux, uy); ctx.rotate(v.rot - Math.PI / 2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 10); ctx.lineTo(0, 4); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = '400 15px "VT323", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText('YOU (PROBABLY)', ux + 14, uy + 16);

    const centreDist = (sx, sy) => Math.hypot(sx - W / 2, sy - H / 2);
    for (const p of POIS) {
      const [sx, sy] = toScreen(p.x, p.y, v);
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      if (p.kind === 'house') { drawPin(sx, sy, alpha); screenHits.push({ p, sx, sy, r: 22 }); continue; }
      if (p.kind === 'van' && van.gone && !van.leaving) continue;
      if (p.kind === 'hidden') {
        if (!introDone) continue;
        const visible = v.z >= zHome * 1.35 || centreDist(sx, sy) < 170 || p.seen;
        if (!visible) continue;
        if (!p.seen) { p.seen = true; p.seenAt = T; }
        const fade = Math.min(1, (T - p.seenAt) * 2);
        ctx.globalAlpha = alpha * fade;
        ctx.strokeStyle = C.yellow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - 7, sy - 7); ctx.lineTo(sx + 7, sy + 7); ctx.moveTo(sx + 7, sy - 7); ctx.lineTo(sx - 7, sy + 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx, sy, 13 + Math.sin(T * 4) * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha;
        screenHits.push({ p, sx, sy, r: 20 });
        continue;
      }
      if (p.kind === 'bin') {
        ctx.fillStyle = binOpen ? C.green : '#1f6b3a'; ctx.strokeStyle = C.green; ctx.lineWidth = 1.5;
        ctx.fillRect(sx - 5, sy - 6, 10, 12); ctx.strokeRect(sx - 5, sy - 6, 10, 12);
        if (v.z > zHome * 0.9) { ctx.font = '400 14px "VT323", monospace'; ctx.fillStyle = C.green; ctx.textAlign = 'right'; ctx.fillText('DO NOT OPEN', sx - 10, sy); }
        screenHits.push({ p, sx, sy, r: 16 });
        continue;
      }
      if (p.kind === 'van') { screenHits.push({ p, sx, sy, r: 18 }); continue; }
      const col = p.col || C.pink;
      ctx.fillStyle = 'rgba(7,2,26,.88)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.font = '400 12px "Russo One", sans-serif'; ctx.fillText(p.letter, sx, sy + 0.5);
      ctx.font = '400 15px "VT323", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(251,234,255,.85)';
      ctx.fillText(p.kind === 'landlord' ? (landlord.flees >= 6 ? 'LANDLORD (WINDED)' : 'LANDLORD') : p.title.toUpperCase(), sx + 16, sy);
      screenHits.push({ p, sx, sy, r: 18 });
    }
    if (tank) { const [tx, ty] = toScreen(tank.x, tank.y, v); ctx.font = '400 15px "VT323", monospace'; ctx.fillStyle = '#d6ff7a'; ctx.textAlign = 'center'; ctx.fillText('TANK (CHEAT)', tx, ty - 20); }
    ctx.restore();
  }

  function drawPin(x, y, alpha) {
    const pulse = (T * 0.9) % 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ctx.createConicGradient && !rm.matches) {
      const R = 170;
      const g = ctx.createConicGradient(T * 1.2, x, y);
      g.addColorStop(0, 'rgba(45,226,230,.28)'); g.addColorStop(0.12, 'rgba(45,226,230,0)'); g.addColorStop(1, 'rgba(45,226,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(45,226,230,.16)'; ctx.lineWidth = 1;
      [R, R * 0.6].forEach((r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); });
    }
    ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * (1 - pulse);
    ctx.beginPath(); ctx.arc(x, y, 10 + pulse * 40, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,46,136,.35)';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.pink;
    ctx.beginPath();
    ctx.moveTo(x, y - 13); ctx.lineTo(x + 11, y - 3); ctx.lineTo(x + 8, y - 3); ctx.lineTo(x + 8, y + 9);
    ctx.lineTo(x - 8, y + 9); ctx.lineTo(x - 8, y - 3); ctx.lineTo(x - 11, y - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a0010'; ctx.fillRect(x - 2.5, y + 2, 5, 7);
    ctx.font = '400 15px "Russo One", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('1257', x + 20, y - 5);
    ctx.font = '400 15px "VT323", monospace'; ctx.fillStyle = C.hot; ctx.fillText('SAFEHOUSE', x + 20, y + 10);
    ctx.restore();
  }

  function drawRadar() {
    if (!rctx || !radar.width) return;
    const w = radar.width / DPR, h = radar.height / DPR;
    rctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rctx.clearRect(0, 0, w, h);
    rctx.save();
    rctx.beginPath(); rctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); rctx.clip();
    const v = { x: cam.x, y: cam.y, z: Math.max(0.035, cam.z * 0.16), rot: cam.rot, fx: w / 2, fy: h / 2, w, h };
    drawStreets(rctx, v, 1, true);
    const [hx, hy] = toScreen(40, -10, v);
    rctx.fillStyle = C.pink; rctx.beginPath(); rctx.arc(hx, hy, 4, 0, Math.PI * 2); rctx.fill();
    // what the big map is showing
    const vw = W / cam.z * v.z, vh = H / cam.z * v.z;
    rctx.strokeStyle = 'rgba(255,214,92,.8)'; rctx.lineWidth = 1;
    rctx.strokeRect(w / 2 - vw / 2 + (W / 2 - fx) / cam.z * v.z, h / 2 - vh / 2 + (H / 2 - fy) / cam.z * v.z, vw, vh);
    rctx.restore();
  }

  /* ---------- HUD ---------- */
  function setHud(lat, lon, altKm) {
    if (!hud.lat) return;
    hud.lat.textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
    hud.lon.textContent = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
    hud.alt.textContent = altKm >= 10 ? `${Math.round(altKm).toLocaleString()} km` : `${altKm.toFixed(1)} km`;
  }
  const STATUS = [[0, 'Establishing uplink'], [1.2, "Triangulating Hayden's PS5"], [2.8, 'Nova Scotia detected'], [4.0, 'Halifax. Obviously.'], [5.2, 'Target acquired'], [6.1, 'Enhance.'], [7.2, 'Wright Ave · live']];
  let statusIdx = -1;
  function updateStatus() {
    let idx = 0;
    STATUS.forEach((s, i) => { if (T >= s[0]) idx = i; });
    if (idx !== statusIdx && hud.status) { statusIdx = idx; hud.status.textContent = STATUS[idx][1]; }
  }

  /* ---------- simulation ---------- */
  let frozen = false;
  function step(dt) {
    if (!frozen) T += dt;
    fx += (fxT - fx) * Math.min(1, dt * 4);
    fy += (fyT - fy) * Math.min(1, dt * 4);
    for (const car of S.cars) {
      car.t += car.v * dt;
      if (car.t > 1 || car.t < 0) { car.v *= -1; car.t = clamp(car.t, 0, 1); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt * 0.8;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (van.leaving) {
      van.x += 260 * dt;
      if (van.x > 1150) { van.leaving = false; van.gone = true; }
    }
    if (tank) {
      tank.x += 70 * dt;
      if (tank.x > 1150) tank = null;
    }
    // landlord: eases towards wherever he's fleeing to
    if (landlord.to) {
      landlord.x += (landlord.to.x - landlord.x) * Math.min(1, dt * 5);
      landlord.y += (landlord.to.y - landlord.y) * Math.min(1, dt * 5);
    }
    if (introDone) {
      if (!dragging) {
        cam.x += vel.x * dt; cam.y += vel.y * dt;
        const f = Math.pow(0.04, dt);
        vel.x *= f; vel.y *= f;
      }
      if (zoomAnim) {
        const k = Math.min(1, dt * 6);
        zoomAt(zoomAnim.sx, zoomAnim.sy, Math.pow(zoomAnim.target / cam.z, k));
        if (Math.abs(Math.log(zoomAnim.target / cam.z)) < 0.005) zoomAnim = null;
      }
      if (homeAnim) {
        const k = Math.min(1, dt * 3);
        cam.x = lerp(cam.x, 40, k); cam.y = lerp(cam.y, -10, k); cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(zHome), k));
        if (Math.abs(cam.x - 40) < 1 && Math.abs(cam.y + 10) < 1 && Math.abs(cam.z / zHome - 1) < 0.01) homeAnim = false;
      }
      if (!exploring && performance.now() - lastInput > 30000 && !homeAnim && (Math.abs(cam.x - 40) > 5 || Math.abs(cam.y + 10) > 5)) homeAnim = true;
      clampCam();
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!introDone) {
      const s = introScale();
      const z = s / R_EARTH;
      const rot = lerp(0, ROT, easeIO(prog(T, TL.twistA, TL.twistB)));
      const ls = Math.log(s);
      const geoA = 1 - smoother(prog(ls, Math.log(9e4), Math.log(4.2e5)));
      const strA = smoother(prog(ls, Math.log(3.5e4), Math.log(2.2e5)));
      ctx.drawImage(starfield, 0, 0, W, H);
      const v = { x: 40, y: -10, z, rot, fx, fy };
      if (strA > 0) drawStreets(ctx, v, strA, false);
      drawGeo(s, rot, geoA);
      const labelA = strA * smoother(prog(z, zHome * 0.3, zHome * 0.85));
      if (labelA > 0.02) drawOverlays(v, labelA);
      cam.z = z; cam.rot = rot;
      updateStatus();
      if (T >= TL.done) finishIntro();
    } else {
      const v = { x: cam.x, y: cam.y, z: cam.z, rot: cam.rot, fx, fy };
      drawStreets(ctx, v, 1, false);
      drawOverlays(v, 1);
      if (T < alertUntil) {
        ctx.fillStyle = Math.floor(T * 8) % 2 ? 'rgba(255,51,85,.08)' : 'rgba(77,124,255,.08)';
        ctx.fillRect(0, 0, W, H);
      }
      if (frame % 3 === 0) drawRadar();
    }
  }

  function loop(now) {
    const t0 = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame++;
    if (W !== window.innerWidth || H !== window.innerHeight) { if (window.innerWidth && window.innerHeight) layout(); }
    step(dt);
    try { render(); } catch (err) { console.error(err); }
    const cost = performance.now() - t0;
    perf.sum += cost; perf.n++;
    raf = requestAnimationFrame(loop);
  }

  function finishIntro() {
    if (introDone) return;
    introDone = true;
    cam.x = 40; cam.y = -10; cam.z = zHome; cam.rot = ROT;
    setHud(CFG.coords.lat, CFG.coords.lng, 0.4);
    if (hud.status) hud.status.textContent = 'Wright Ave · live';
    document.documentElement.classList.add('intro-done');
    document.dispatchEvent(new CustomEvent('wanted:introdone'));
  }

  function start() {
    cancelAnimationFrame(raf);
    if (rm.matches && !introDone) { T = TL.done; finishIntro(); }
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- interaction ---------- */
  let dragging = false, moved = 0, zoomAnim = null, homeAnim = false;
  const pointers = new Map();
  let pinchStart = null;
  const Z_MIN = () => zHome * 0.45, Z_MAX = () => zHome * 3.2;

  function clampCam() {
    cam.x = clamp(cam.x, EXT.x0, EXT.x1);
    cam.y = clamp(cam.y, EXT.y0, EXT.y1);
    cam.z = clamp(cam.z, Z_MIN(), Z_MAX());
  }
  function zoomAt(sx, sy, k) {
    const before = toWorld(sx, sy);
    cam.z = clamp(cam.z * k, Z_MIN(), Z_MAX());
    const after = toWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
  }
  function panScreen(dx, dy) {
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    cam.x -= (dx * c + dy * s) / cam.z;
    cam.y -= (-dx * s + dy * c) / cam.z;
  }
  const canInteract = () => introDone;
  function touchInput() { lastInput = performance.now(); homeAnim = false; }

  cv.addEventListener('pointerdown', (e) => {
    if (!canInteract()) return;
    touchInput();
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    vel.x = vel.y = 0;
    moved = 0;
    dragging = true;
    zoomAnim = null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
    }
    cv.classList.add('is-grabbing');
  });
  cv.addEventListener('pointermove', (e) => {
    if (!canInteract()) return;
    const p = pointers.get(e.pointerId);
    if (!p) { hover(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const now = performance.now();
    if (pointers.size === 2 && pinchStart) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinchStart.z * d / pinchStart.d) / cam.z);
      moved += 10;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    panScreen(dx, dy);
    const dtm = Math.max(1, now - p.t) / 1000;
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    const wvx = -(dx * c + dy * s) / cam.z / dtm, wvy = -(-dx * s + dy * c) / cam.z / dtm;
    vel.x = lerp(vel.x, wvx, 0.5); vel.y = lerp(vel.y, wvy, 0.5);
    p.x = e.clientX; p.y = e.clientY; p.t = now;
    touchInput();
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      dragging = false;
      cv.classList.remove('is-grabbing');
      if (moved < 6) { vel.x = vel.y = 0; click(e.clientX, e.clientY); }
      if (rm.matches) { vel.x = vel.y = 0; }
    }
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('wheel', (e) => {
    if (!canInteract()) return;
    e.preventDefault();
    touchInput();
    const target = clamp((zoomAnim ? zoomAnim.target : cam.z) * Math.exp(-e.deltaY * 0.0016), Z_MIN(), Z_MAX());
    zoomAnim = { sx: e.clientX, sy: e.clientY, target };
  }, { passive: false });
  cv.addEventListener('keydown', (e) => {
    if (!canInteract()) return;
    const step = 80;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); touchInput(); const [dx, dy] = moves[e.key]; vel.x = vel.y = 0; panScreen(dx, dy); }
    else if (e.key === '+' || e.key === '=') { touchInput(); zoomAnim = { sx: fx, sy: fy, target: clamp(cam.z * 1.4, Z_MIN(), Z_MAX()) }; }
    else if (e.key === '-' || e.key === '_') { touchInput(); zoomAnim = { sx: fx, sy: fy, target: clamp(cam.z / 1.4, Z_MIN(), Z_MAX()) }; }
    else if (e.key === '0') { homeAnim = true; }
    else if (e.key === 'Enter') { click(fx, fy, true); }
  });

  function hit(sx, sy) {
    let best = null, bd = Infinity;
    for (const h of screenHits) {
      const d = Math.hypot(sx - h.sx, sy - h.sy);
      if (d < h.r + 6 && d < bd) { best = h; bd = d; }
    }
    if (tank) {
      const [tx, ty] = toScreen(tank.x, tank.y, { ...cam, fx, fy });
      if (Math.hypot(sx - tx, sy - ty) < 26) return { p: { id: 'tank', title: 'A tank', body: "It's a tank. On Wright Ave. Somebody call the landlord." }, sx: tx, sy: ty };
    }
    return best;
  }
  function hover(sx, sy) {
    const h = hit(sx, sy);
    cv.classList.toggle('is-pointing', !!h);
    // the landlord does not want to be caught
    if (landlord.flees < 6) {
      const [lx, ly] = toScreen(landlord.x, landlord.y, { ...cam, fx, fy });
      const d = Math.hypot(sx - lx, sy - ly);
      if (d < 90 && (!landlord.fleeAt || T - landlord.fleeAt > 0.35)) fleeFrom(sx, sy);
    }
  }
  function fleeFrom(sx, sy) {
    const pw = toWorld(sx, sy);
    let ax = landlord.x - pw.x, ay = landlord.y - pw.y;
    const n = Math.hypot(ax, ay) || 1;
    ax /= n; ay /= n;
    const dist = 220 + Math.random() * 120;
    let tx = landlord.x + ax * dist + (Math.random() - 0.5) * 120, ty = landlord.y + ay * dist + (Math.random() - 0.5) * 120;
    tx = clamp(tx, -1150, 1050); ty = clamp(ty, -1300, 1200);
    if (!S.onLand(tx, ty)) { tx = landlord.home.x; ty = landlord.home.y; }
    landlord.to = { x: tx, y: ty };
    landlord.fleeAt = T;
    landlord.flees++;
    if (landlord.flees === 6) E.banner('The landlord is winded', 'He has stopped running. Go get him.', 'info');
  }

  /* ---------- cards ---------- */
  let binClicks = 0;
  function click(sx, sy, keyboard) {
    const h = hit(sx, sy);
    if (!h) { closeCard(); return; }
    const p = h.p;
    if (p.id === 'landlord' && landlord.flees < 6 && !keyboard) { fleeFrom(sx, sy); return; }
    openCard(p, h.sx, h.sy);
  }

  function openCard(p, sx, sy) {
    if (!card) return;
    let body = p.body, actions = p.action ? [p.action] : [];
    if (p.id === 'bin') {
      if (binOpen) body = "It's open. We can't show you what's in there. Some things are better left in the bin. Close the card and pretend you didn't see the glow.";
      else actions = [[['Open it', 'Are you sure?', 'Really sure?'][Math.min(binClicks, 2)], () => {
        binClicks++;
        if (binClicks >= 3) { binOpen = true; E.emit('bin:open'); E.find('bin'); }
        openCard(p, sx, sy);
      }]];
    }
    if (p.id === 'van' && !van.leaving && !van.gone) actions = [['Knock on the window', () => {
      van.leaving = true; E.find('van');
      openCard({ id: 'van2', title: 'Flowers by Steve', body: 'Steve has left in a hurry. For now.' }, sx, sy);
    }]];
    if (p.id === 'landlord') E.find('landlord');
    if (p.kind === 'hidden') E.find(p.id);
    card.innerHTML = `<button type="button" class="map-card__x" aria-label="Close">×</button><p class="map-card__title"></p><p class="map-card__body"></p><div class="map-card__actions"></div>`;
    card.querySelector('.map-card__title').textContent = p.title;
    card.querySelector('.map-card__body').textContent = body;
    const act = card.querySelector('.map-card__actions');
    actions.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn--sm'; b.textContent = label;
      b.addEventListener('click', fn);
      act.appendChild(b);
    });
    card.querySelector('.map-card__x').addEventListener('click', closeCard);
    card.hidden = false;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    card.style.left = clamp(sx - cw / 2, 12, W - cw - 12) + 'px';
    card.style.top = clamp(sy - ch - 26, 70, H - ch - 12) + 'px';
    const first = card.querySelector('.map-card__actions button') || card.querySelector('.map-card__x');
    if (first) first.focus({ preventScroll: true });
  }
  function closeCard() { if (card) card.hidden = true; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });

  /* ---------- cheats + events ---------- */
  E.on('cheat:bigbang', () => {
    for (const car of S.cars) {
      const L = car.lane;
      const x = L.x0 + (L.x1 - L.x0) * car.t, y = L.y0 + (L.y1 - L.y0) * car.t;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 4, life: 1, col: [C.pink, C.orange, C.yellow, C.cyan][i % 4] });
      }
      car.dead = T + 8;
    }
  });
  E.on('cheat:tank', () => { tank = { x: -1300, y: 0 }; });
  E.on('cheat:clear', () => { copsGoneUntil = T + 15; });
  E.on('alert', () => { alertUntil = T + 3.5; });
  E.on('bin:open', () => { binOpen = true; });

  /* ---------- public API ---------- */
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (introStarted) start(); });

  window.WantedMap = {
    skip() { if (!introDone) { T = Math.max(T, TL.done); } },
    get introDone() { return introDone; },
    explore(on) {
      exploring = !!on;
      document.documentElement.classList.toggle('exploring', exploring);
      focusTargets(false);
      if (exploring) cv.focus({ preventScroll: true });
      closeCard();
    },
    zoom(k) { touchInput(); zoomAnim = { sx: fx, sy: fy, target: clamp(cam.z * k, Z_MIN(), Z_MAX()) }; },
    home() { homeAnim = true; },
    pan(dx, dy) { touchInput(); vel.x = vel.y = 0; panScreen(dx, dy); },
    get perf() { return perf.n ? +(perf.sum / perf.n).toFixed(2) : 0; },
    resetPerf() { perf = { sum: 0, n: 0 }; },
    // dev helpers for checking the animatic frame by frame
    freeze(t) { frozen = true; if (t != null) T = t; render(); },
    unfreeze() { frozen = false; },
    // dev helper: average render cost (ms) of the intro at the given times, GPU flush included
    bench(times) {
      if (introDone) return null;
      const keep = T;
      const out = times.map((t) => {
        T = t;
        const t0 = performance.now();
        for (let i = 0; i < 6; i++) { render(); ctx.getImageData(0, 0, 1, 1); }
        return +((performance.now() - t0) / 6).toFixed(2);
      });
      T = keep;
      return out;
    },
  };

  layout();
  setHud(15, TARGET[0] + 100, 35786);
  loadGeo().then(() => {
    introStarted = true;
    T = 0;
    document.documentElement.classList.add('intro-running');
    start();
  });
})();
