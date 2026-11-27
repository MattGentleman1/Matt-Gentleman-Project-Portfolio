/* ==========================================================================
   house3d.js — RECON SCAN: an interactive low-poly 1257 Wright Ave.
   Modelled from the listing video: a narrow two-and-a-half-storey with a
   steep front gable, grey-green clapboard and dark-green trim, a set-back
   entry with a mustard door frame under a little pent roof, the big picture
   window, paired upstairs windows with rust shutters, a brick chimney plus a
   metal flue, sage porch stairs with lattice, two green bins, a one-storey
   rear bump-out with a yellow back door, a weathered back deck, and the
   ochre and pale-grey neighbours. Lit like Vice City at dusk.
   Drag to orbit, scroll/pinch to zoom, tap the pink markers.
   three.js loads from a CDN on first use; no WebGL → falls back to the photo.
   ========================================================================== */
(function () {
  'use strict';

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
  const E = window.Eggs;
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');

  const HOTSPOTS = [
    { id: 'bin', label: 'Green bin', p: [-1.1, 1.25, 2.05], n: [0, 0.4, 1] },
    { id: 'decoy', label: 'Other green bin', p: [-1.95, 1.2, 1.75], n: [-0.3, 0.4, 1] },
    { id: 'living', label: 'Picture window', p: [2.35, 2.95, 0.08], n: [0, 0, 1] },
    { id: 'upstairs', label: 'Upstairs windows', p: [2.3, 5.25, 0.08], n: [0, 0, 1] },
    { id: 'door', label: 'Front door', p: [-0.78, 2.7, -0.82], n: [0, 0, 1] },
    { id: 'mail', label: 'Mailbox', p: [0.55, 2.62, 0.1], n: [0, 0, 1] },
    { id: 'basement', label: 'Basement window', p: [4.66, 0.5, -4.2], n: [1, 0, 0] },
    { id: 'chimney', label: 'Chimney', p: [-0.9, 8.75, -6.2], n: [0, 1, 0] },
    { id: 'kitchen', label: 'Kitchen', p: [-1.1, 2.45, -9.58], n: [0, 0, -1] },
    { id: 'deck', label: 'Back deck', p: [1.6, 1.5, -13.6], n: [0, 1, -0.3] },
    { id: 'path', label: 'Side path', p: [-2.85, 0.35, -2.5], n: [-1, 0.6, 0] },
    { id: 'van', label: 'Parked van', p: [-4.6, 2.25, 7.3], n: [0, 0.5, 1] },
  ];
  const INTEL = {
    bin: null, // handled specially
    decoy: ['Green bin #2', 'This one is the decoy. Everything important is in the other one. Forget we said that.'],
    living: ['Living room', 'The TV is on. The TV is always on. Hayden is in there. The radiator screams at 3 AM, free of charge.'],
    upstairs: ['Upstairs bedroom', 'Sloped ceiling. Robert has hit his head on it 41 times. It explains a lot.'],
    door: ['Front door', "Sticks when it's humid. Kick, don't knock. There's a secret knock. You don't know it."],
    mail: ['Mailbox', "14 letters for someone called Kevin. Nobody here is called Kevin. We think."],
    basement: ['Basement', "We don't go in the basement. Hayden says it's 'storage'. Storage for what, Hayden?"],
    chimney: ['Chimney', 'Santa has been banned since the incident. He knows what he did.'],
    kitchen: ['Kitchen', "Yellow walls, a red stand mixer used exactly once, and a dishwasher that hasn't drained since reading week. It's a pond now. Something lives in it. Robert named it."],
    deck: ['Back deck', "Site of the 2025 'barbecue'. The fire department was very nice about it."],
    path: ['Side path', "Used for 'deliveries'. Don't ask what kind. Mind the hose."],
    van: ['Flowers by Steve', 'Day nine. Still no flowers. The engine is running. Steve is eating a sandwich and staring at the house.'],
  };
  const PKG = { decoy: 'decoy', basement: 'basement', kitchen: 'kitchen' };

  let THREE = null, built = null, loading = null;

  function mount(host) {
    if (built) { built.attach(host); return Promise.resolve(built); }
    if (loading) return loading.then((b) => { b.attach(host); return b; });
    host.classList.add('is-loading');
    loading = (hasWebGL() ? import(THREE_URL) : Promise.reject(new Error('no webgl')))
      .then((mod) => { THREE = mod; built = build(); built.attach(host); host.classList.remove('is-loading'); return built; })
      .catch((err) => { console.warn('Recon scan unavailable; showing the photo.', err); host.classList.remove('is-loading'); host.classList.add('is-fallback'); return null; });
    return loading;
  }
  function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

  function build() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.localClippingEnabled = true;
    const canvas = renderer.domElement;
    canvas.className = 'recon__canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D model of 1257 Wright Ave. Drag or use arrow keys to rotate, plus and minus to zoom.');

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a0e4f, 40, 95);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);

    /* ---------- helpers ---------- */
    const solidClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
    const wireClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -100);
    const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, flatShading: true, clippingPlanes: [solidClip] }, o || {}));
    function add(geo, mat, x, y, z, parent, noShadow) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = !noShadow;
      m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    }
    const box = (w, h, d, mat, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
    // box by its min/max corners
    const slab = (x0, x1, y0, y1, z0, z1, mat, p) => box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, p);
    function tex(w, h, draw, rep) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
      return t;
    }
    const clap = (base, line, rep) => tex(128, 128, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = line; g.fillRect(0, y + 13, w, 3); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, y, w, 2); }
    }, rep);
    const label = (text, fg, bg, w, h, font) => tex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
    function gableFill(width, rise, depth, mat, x, y, z) {
      const s = new THREE.Shape();
      s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, rise); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return add(geo, mat, x, y, z);
    }
    function gableRoof(cx, eaveY, halfW, rise, z0, z1, over, mat, trim) {
      const ang = Math.atan2(rise, halfW), len = Math.hypot(halfW, rise) + over, th = 0.16, depth = z1 - z0 + over * 1.6, cz = (z0 + z1) / 2 + over * 0.3;
      [-1, 1].forEach((side) => {
        const r = box(len, th, depth, mat, 0, 0, cz);
        r.position.x = cx + side * (halfW / 2 + (over / 2) * Math.cos(ang) + (th / 2) * Math.sin(ang));
        r.position.y = eaveY + rise / 2 - (over / 2) * Math.sin(ang) + (th / 2) * Math.cos(ang);
        r.rotation.z = -side * ang;
        if (trim) {   // dark-green rake board along the front edge
          const b = box(len, 0.22, 0.08, trim, 0, 0, z1 + over * 0.8);
          b.position.x = r.position.x + side * 0.02; b.position.y = r.position.y - 0.06; b.rotation.z = r.rotation.z;
        }
      });
    }
    function windowAt(x, y, z, w, h, frameMat, glass, axis, parent) {
      const f = 0.09;
      const g = new THREE.Group();
      slab(-w / 2 - f, w / 2 + f, -h / 2 - f, h / 2 + f, -0.04, 0.04, frameMat, g);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      pane.position.z = 0.05;
      g.add(pane);
      g.position.set(x, y, z);
      if (axis === 'x+') g.rotation.y = Math.PI / 2;
      if (axis === 'x-') g.rotation.y = -Math.PI / 2;
      if (axis === 'z-') g.rotation.y = Math.PI;
      (parent || scene).add(g);
      return pane;
    }
    const glass = (emissive, intensity, map) => new THREE.MeshStandardMaterial({ color: 0x0d1020, emissive, emissiveIntensity: intensity, emissiveMap: map || null, roughness: 0.25, metalness: 0.1, clippingPlanes: [solidClip] });

    /* ---------- palette (from the video) ---------- */
    const P = {
      siding: M(0xffffff, { map: clap('#b4baa0', '#9ba188', [3, 5]) }),
      sidingS: M(0xffffff, { map: clap('#b4baa0', '#9ba188', [2, 2]) }),
      trim: M(0x2f4c3a), roof: M(0xffffff, { map: tex(64, 64, (g) => { g.fillStyle = '#2c2e36'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#23252c'; for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 2); }, [4, 6]) }),
      found: M(0x45423f), frame: M(0x3b2d22), mustard: M(0xd2a23c), doorWood: M(0x7a4a26), shutter: M(0xad6a35),
      porch: M(0x8f9278), rail: M(0xa9ab8e), brick: M(0x9a4a34), metal: M(0xb9bcc4, { metalness: 0.6, roughness: 0.35, flatShading: false }),
      deck: M(0x8b867b), deckRail: M(0x4a3d33), fence: M(0x5a4b3e), white: M(0xf3efe6),
      grass: M(0x3b5f35), dirt: M(0x3a2a22), side: M(0x2a1f2e), walk: M(0xa7a49b), asphalt: M(0x23232b), curb: M(0xb8b6ad), path: M(0x6f6a62),
      binG: M(0x1e6b3c), binLid: M(0x17542f), black: M(0x111111),
      ochre: M(0xffffff, { map: clap('#cf9a35', '#b2802a', [3, 4]) }), greyN: M(0xffffff, { map: clap('#c9c7bb', '#adab9f', [3, 4]) }),
    };
    const leaded = tex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#222'; g.lineWidth = 3; for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } });
    const warm = glass(0xffbf73, 1.1);
    const warmDim = glass(0xffbf73, 0.45);
    const tvGlass = glass(0x5a6bff, 1.6);
    const upGlass = glass(0xffb070, 1.0, leaded);

    /* ---------- the lot ---------- */
    slab(-8, 10, -0.4, 0, -17.5, 4.2, P.grass);
    slab(-8, 10, -2.6, -0.4, -17.5, 9.6, P.side);
    slab(-8, 10, -0.4, 0.06, 4.2, 5.8, P.walk);
    slab(-8, 10, -0.4, 0.02, 5.8, 9.6, P.asphalt);
    slab(-8, 10, 0, 0.16, 5.75, 5.95, P.curb);
    for (let x = -7; x < 10; x += 3) slab(x, x + 1.4, 0.03, 0.05, 7.6, 7.75, M(0xffd65c));
    slab(-3.25, -2.3, 0, 0.04, -12, 4.2, P.path);                                  // side path
    slab(0, 1.3, 0, 0.05, 3.6, 4.2, P.walk);                                      // walk to stairs

    /* ---------- main block (front gable) ---------- */
    slab(0, 4.6, 0, 0.9, -9.5, 0, P.found);
    slab(0, 4.6, 0.9, 5.4, -9.5, 0, P.siding);
    gableFill(4.6, 2.5, 9.5, P.sidingS, 2.3, 5.4, -4.75);
    gableRoof(2.3, 5.4, 2.3, 2.5, -9.5, 0, 0.42, P.roof, P.trim);
    [[0, 0], [4.6, 0]].forEach(([x, z]) => slab(x - 0.08, x + 0.08, 0.9, 5.45, z - 0.08, z + 0.08, P.trim));
    slab(-0.05, 4.65, 5.3, 5.45, -0.1, 0.1, P.trim);
    add(new THREE.CylinderGeometry(0.06, 0.06, 5.4, 8), P.trim, 4.72, 2.7, 0.12);   // downspout
    const tvPane = windowAt(2.35, 2.9, 0.02, 2.5, 1.8, P.frame, tvGlass);
    slab(1.05, 3.65, 1.92, 2.0, 0.02, 0.2, P.white);                               // sill
    const upL = windowAt(1.75, 5.15, 0.02, 0.72, 1.1, P.frame, upGlass);
    const upR = windowAt(2.85, 5.15, 0.02, 0.72, 1.1, P.frame, upGlass);
    slab(1.0, 1.3, 4.55, 5.75, 0.02, 0.08, P.shutter);
    slab(3.3, 3.6, 4.55, 5.75, 0.02, 0.08, P.shutter);
    const vent = new THREE.Shape(); vent.moveTo(-0.35, 0); vent.lineTo(0.35, 0); vent.lineTo(0, 0.45); vent.closePath();
    add(new THREE.ShapeGeometry(vent), M(0x2f4c3a, { side: THREE.DoubleSide }), 2.3, 6.75, 0.03);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), new THREE.MeshBasicMaterial({ map: label('1257', '#f3efe6', '#2a2620', 256, 92, '700 66px Georgia, serif'), clippingPlanes: [solidClip] }));
    plate.position.set(0.55, 3.15, 0.04); scene.add(plate);
    slab(0.32, 0.78, 2.4, 2.72, 0.02, 0.18, P.black);                             // mailbox
    // side windows (right wall)
    [-2.6, -5.6, -8.2].forEach((z) => windowAt(4.61, 2.6, z, 0.8, 1.2, P.white, warmDim, 'x+'));
    [-3.2, -6.8].forEach((z) => windowAt(4.61, 4.5, z, 0.7, 1.0, P.white, warm, 'x+'));
    const basement = windowAt(4.61, 0.48, -4.2, 0.7, 0.36, P.frame, glass(0x39ff88, 0.15), 'x+');

    /* ---------- left wing (entry) ---------- */
    slab(-2.3, 0, 0, 0.9, -9.5, -0.9, P.found);
    slab(-2.3, 0, 0.9, 5.0, -9.5, -0.9, P.siding);
    const tri = new THREE.Shape(); tri.moveTo(-2.3, 0); tri.lineTo(0, 0); tri.lineTo(0, 0.7); tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 8.6, bevelEnabled: false }); triGeo.translate(0, 0, -4.3);
    add(triGeo, P.sidingS, 0, 5.0, -5.2);
    const shedAng = Math.atan2(0.7, 2.3);
    const shed = box(2.95, 0.15, 9.3, P.roof, -1.12, 5.42, -5.05);
    shed.rotation.z = shedAng;
    const shedTrim = box(2.95, 0.2, 0.08, P.trim, -1.12, 5.36, -0.42); shedTrim.rotation.z = shedAng;
    slab(-2.38, -2.22, 0.9, 5.0, -0.98, -0.82, P.trim);
    // door + mustard frame + pent roof + lantern + hanging basket
    slab(-1.35, -0.2, 1.55, 3.85, -0.94, -0.86, P.mustard);
    slab(-1.2, -0.35, 1.55, 3.7, -0.9, -0.82, P.doorWood);
    windowAt(-0.775, 3.05, -0.8, 0.5, 0.75, P.doorWood, warm);
    const pent = box(2.5, 0.12, 1.1, P.roof, -1.05, 4.05, -0.42); pent.rotation.x = 0.32;
    windowAt(-1.15, 4.55, -0.86, 0.75, 0.6, P.frame, warmDim);
    add(new THREE.BoxGeometry(0.16, 0.26, 0.16), new THREE.MeshBasicMaterial({ color: 0xffd9a0, clippingPlanes: [solidClip] }), -0.05, 3.55, -0.75, null, true);
    add(new THREE.IcosahedronGeometry(0.32, 1), M(0x3f7a3a), -1.95, 3.15, -0.55);
    for (let i = 0; i < 7; i++) add(new THREE.IcosahedronGeometry(0.07, 0), M(0xff4fa8), -1.95 + Math.cos(i) * 0.26, 3.2 + Math.sin(i * 2) * 0.12, -0.38 + Math.sin(i) * 0.12, null, true);
    // left wall windows
    [-3.0, -6.5].forEach((z) => windowAt(-2.31, 2.6, z, 0.8, 1.2, P.white, warmDim, 'x-'));
    windowAt(-2.31, 4.2, -4.5, 0.7, 0.9, P.white, warm, 'x-');
    windowAt(-2.31, 0.48, -3.0, 0.6, 0.32, P.frame, glass(0x39ff88, 0.12), 'x-');
    // kitchen slider at the back of the wing
    const kitchen = windowAt(-1.1, 2.4, -9.52, 1.9, 2.0, P.white, glass(0xffd27a, 1.3), 'z-');
    // chimney + flue
    slab(-1.35, -0.45, 4.6, 8.5, -6.65, -5.75, P.brick);
    slab(-1.45, -0.35, 8.5, 8.68, -6.75, -5.65, M(0x6b6b6b));
    add(new THREE.CylinderGeometry(0.11, 0.11, 2.6, 10), P.metal, -0.35, 6.6, -2.4);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 10), P.metal, -0.35, 7.95, -2.4);

    /* ---------- rear bump-out + deck + fence ---------- */
    slab(0.9, 4.0, 0, 0.9, -12, -9.5, P.found);
    slab(0.9, 4.0, 0.9, 3.8, -12, -9.5, P.siding);
    const rr = box(3.5, 0.14, 3.0, P.roof, 2.45, 4.0, -10.7); rr.rotation.x = -0.18;
    slab(0.86, 0.9, 1.25, 3.25, -11.4, -10.5, P.mustard);
    windowAt(0.84, 2.7, -10.95, 0.4, 0.7, P.mustard, warm, 'x-');
    windowAt(2.45, 2.6, -12.02, 1.0, 0.9, P.white, warmDim, 'z-');
    const deckY = 1.15;
    slab(-2.3, 4.6, deckY - 0.14, deckY, -15.2, -12, P.deck);
    slab(-2.3, 0.9, deckY - 0.14, deckY, -12, -9.5, P.deck);
    for (let x = -2.2; x <= 4.5; x += 1.15) slab(x - 0.07, x + 0.07, 0, deckY, -15.15, -15.0, P.deckRail);
    slab(-2.3, 4.6, deckY + 0.9, deckY + 1.0, -15.2, -15.05, P.deckRail);
    for (let x = -2.25; x <= 4.55; x += 0.28) slab(x - 0.04, x + 0.04, deckY, deckY + 0.9, -15.16, -15.09, P.deckRail);
    for (let z = -15.1; z <= -12.1; z += 0.28) slab(4.5, 4.58, deckY, deckY + 0.9, z - 0.04, z + 0.04, P.deckRail);
    slab(4.48, 4.6, deckY + 0.9, deckY + 1.0, -15.2, -12, P.deckRail);
    for (let i = 0; i < 4; i++) slab(-3.4 + i * 0.27, -3.13 + i * 0.27, 0, deckY - i * 0.28, -14.6, -13.4, P.deck);
    slab(-8, 10, 0, 1.9, -17.2, -17.0, P.fence);
    for (let x = -7.9; x < 10; x += 0.5) slab(x, x + 0.06, 0, 1.95, -17.05, -16.95, M(0x4a3d33));
    [[-1.8, -14.2], [3.6, -13.8]].forEach(([x, z]) => { add(new THREE.CylinderGeometry(0.22, 0.17, 0.32, 10), M(0xa9a9a2), x, deckY + 0.16, z); add(new THREE.IcosahedronGeometry(0.24, 0), M(0x4f8a3f), x, deckY + 0.42, z); });

    /* ---------- front porch, stairs, lattice ---------- */
    const landY = 1.55;
    slab(-2.3, 2.9, landY - 0.15, landY, -0.9, 1.1, P.porch);
    [[-2.25, 1.05], [2.85, 1.05], [-2.25, -0.85], [2.85, 0.1]].forEach(([x, z]) => slab(x - 0.07, x + 0.07, 0, landY, z - 0.07, z + 0.07, P.rail));
    const lattice = M(0xffffff, { map: tex(64, 64, (g) => { g.fillStyle = '#2b2a24'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#a9ab8e'; g.lineWidth = 6; for (let i = -64; i < 128; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } }, [5, 2]) });
    slab(-2.3, 0, 0, landY - 0.15, 1.08, 1.12, lattice);
    slab(1.3, 2.9, 0, landY - 0.15, 1.08, 1.12, lattice);
    slab(2.88, 2.92, 0, landY - 0.15, 0, 1.1, lattice);
    const railTop = landY + 0.92;
    function railRun(x0, z0, x1, z1) {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const r = box(0.08, 0.09, len, P.rail, (x0 + x1) / 2, railTop, (z0 + z1) / 2); r.rotation.y = ang;
      const n = Math.round(len / 0.13);
      for (let i = 0; i <= n; i++) { const t = i / n; box(0.045, 0.9, 0.045, P.rail, x0 + (x1 - x0) * t, landY + 0.45, z0 + (z1 - z0) * t); }
    }
    railRun(1.35, 1.05, 2.9, 1.05);
    railRun(2.88, 0.05, 2.88, 1.05);
    railRun(-2.27, -0.88, -2.27, 1.05);
    railRun(-2.27, 1.05, -0.02, 1.05);
    const steps = 8, rise = landY / steps, run = 0.31;
    for (let i = 0; i < steps - 1; i++) {
      const top = landY - (i + 1) * rise;
      slab(0, 1.3, 0, top, 1.1 + i * run, 1.1 + (i + 1) * run + 0.02, P.porch);
    }
    const runLen = (steps - 1) * run;
    [-0.03, 1.33].forEach((x) => {
      const ang = Math.atan2(landY - rise, runLen);
      const hyp = Math.hypot(landY - rise, runLen);
      const tr = box(0.08, 0.09, hyp + 0.2, P.rail, x, railTop - (landY - rise) / 2 - 0.05, 1.1 + runLen / 2); tr.rotation.x = ang;
      const st = box(0.06, 0.28, hyp + 0.2, P.porch, x, (landY - rise) / 2 + 0.05, 1.1 + runLen / 2); st.rotation.x = ang;
      for (let k = 0; k <= 9; k++) {
        const z = 1.15 + k * (runLen / 9.5), yb = landY - ((z - 1.1) / runLen) * (landY - rise);
        box(0.045, 0.88, 0.045, P.rail, x, yb + 0.44 - 0.05, z);
      }
      slab(x - 0.07, x + 0.07, 0, 1.15, 1.1 + runLen - 0.07, 1.1 + runLen + 0.07, P.rail);
    });

    /* ---------- THE BIN(S) ---------- */
    function bin(x, z, rotY, sticker) {
      const g = new THREE.Group();
      slab(-0.31, 0.31, 0.12, 1.02, -0.36, 0.36, P.binG, g);
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 1.03, -0.37);
      g.add(lidPivot);
      slab(-0.34, 0.34, 0, 0.07, 0, 0.78, P.binLid, lidPivot);
      slab(-0.28, 0.28, 1.0, 1.05, -0.44, -0.38, P.binLid, g);
      [-0.22, 0.22].forEach((wx) => { const w = add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), P.black, wx, 0.12, -0.34, g); w.rotation.z = Math.PI / 2; });
      if (sticker) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: label('DO NOT OPEN', '#ff2e88', '#f3efe6', 256, 100, '700 40px Arial, sans-serif'), clippingPlanes: [solidClip] }));
        s.position.set(0, 0.78, 0.365); g.add(s);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      scene.add(g);
      return { g, lidPivot };
    }
    const theBin = bin(-1.1, 1.62, 0.08, true);
    bin(-1.95, 1.48, -0.18, false);
    const binLight = new THREE.PointLight(0x39ff88, 0, 5, 1.5);
    binLight.position.set(-1.1, 1.3, 1.62);
    scene.add(binLight);

    /* ---------- greenery ---------- */
    const leaf = [M(0x2f5a2f), M(0x3b6e33), M(0x274d29), M(0x4a7f3a)];
    const autumn = [M(0xc4542c), M(0xd9822b), M(0xa8402a), M(0xe0a03a)];
    function blob(x, y, z, r, mats, i) { return add(new THREE.IcosahedronGeometry(r, 1), mats[i % mats.length], x, y, z); }
    [[2.2, 0.9, 2.2, 1.1], [3.3, 1.1, 1.8, 1.25], [3.9, 0.8, 3.0, 0.9], [2.0, 0.55, 3.3, 0.6], [4.3, 1.6, 0.9, 1.0], [1.7, 0.3, 4.0, 0.35]].forEach(([x, y, z, r], i) => blob(x, y, z, r, leaf, i));
    function tree(x, z, h, blobs, mats) {
      add(new THREE.CylinderGeometry(0.18, 0.3, h, 7), M(0x5a4232), x, h / 2, z);
      blobs.forEach(([dx, dy, dz, r], i) => blob(x + dx, h + dy, z + dz, r, mats, i));
    }
    tree(8.6, 3.0, 5.4, [[0, 0.8, 0, 1.9], [-0.9, 0.2, 0.6, 1.3], [0.7, 1.7, -0.4, 1.3]], autumn);
    tree(-6.0, -13.0, 6.2, [[0, 0.8, 0, 2.3], [1.4, 0.2, 0.6, 1.7], [-1.2, 1.4, -0.3, 1.5]], leaf);
    tree(8.0, -14.0, 5.4, [[0, 0.6, 0, 2.0], [-1.1, 1.3, 0.4, 1.4]], autumn);
    add(new THREE.TorusGeometry(0.28, 0.05, 6, 18), M(0x2f7a3a), -2.75, 0.06, -3.6).rotation.x = Math.PI / 2;

    /* ---------- the neighbours ---------- */
    slab(-7.6, -3.4, 0, 0.8, -10.5, -1.6, P.found);
    slab(-7.6, -3.4, 0.8, 5.6, -10.5, -1.6, P.greyN);
    gableFill(4.2, 2.3, 8.9, P.greyN, -5.5, 5.6, -6.05);
    gableRoof(-5.5, 5.6, 2.1, 2.3, -10.5, -1.6, 0.35, P.roof, M(0xd6b04a));
    windowAt(-5.5, 3.0, -1.58, 1.2, 1.4, M(0xd6b04a), warm);
    windowAt(-5.5, 5.3, -1.58, 0.9, 1.0, M(0xf3efe6), warmDim);
    slab(-7.6, -4.6, 1.2, 1.35, -1.6, 0.4, P.white);
    for (let i = 0; i < 6; i++) slab(-4.6, -3.6, 0, 1.2 - i * 0.2, 0.4 + i * 0.3, 0.72 + i * 0.3, P.white);
    slab(5.4, 9.8, 0, 0.8, -10.8, -0.8, P.found);
    slab(5.4, 9.8, 0.8, 5.8, -10.8, -0.8, P.ochre);
    gableFill(4.4, 2.4, 10, P.ochre, 7.6, 5.8, -5.8);
    gableRoof(7.6, 5.8, 2.2, 2.4, -10.8, -0.8, 0.35, P.roof, P.black);
    windowAt(6.8, 4.6, -0.78, 0.8, 1.1, P.white, warm);
    windowAt(8.4, 4.6, -0.78, 0.8, 1.1, P.white, warmDim);
    windowAt(7.6, 2.6, -0.78, 1.4, 1.2, P.white, warm);

    /* ---------- street furniture: lamp, car, Steve's van ---------- */
    add(new THREE.CylinderGeometry(0.07, 0.09, 4.3, 8), M(0x2b2f3a), -3.6, 2.15, 5.0);
    slab(-3.6, -2.7, 4.25, 4.35, 4.95, 5.05, M(0x2b2f3a));
    add(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0, clippingPlanes: [solidClip] }), -2.85, 4.15, 5.0, null, true);
    const car = new THREE.Group();
    slab(-1.9, 1.9, 0.25, 0.85, -0.82, 0.82, M(0x1d2738, { metalness: 0.5, roughness: 0.35, flatShading: false }), car);
    slab(-1.0, 0.9, 0.85, 1.35, -0.74, 0.74, glass(0x2de2e6, 0.08), car);
    [[-1.2, 0.82], [1.2, 0.82], [-1.2, -0.82], [1.2, -0.82]].forEach(([x, z]) => { const w = add(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14), P.black, x, 0.33, z, car); w.rotation.x = Math.PI / 2; });
    car.position.set(6.6, 0, 7.0);
    scene.add(car);
    const vanG = new THREE.Group();
    slab(-2.2, 1.2, 0.35, 2.4, -0.95, 0.95, P.white, vanG);
    slab(1.2, 2.3, 0.35, 1.75, -0.95, 0.95, P.white, vanG);
    slab(1.25, 2.31, 1.0, 1.6, -0.9, 0.9, glass(0x2de2e6, 0.06), vanG);
    const vanSign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), new THREE.MeshBasicMaterial({ map: label('FLOWERS BY STEVE', '#ff2e88', '#f3efe6', 512, 160, 'italic 700 58px Georgia, serif'), clippingPlanes: [solidClip] }));
    vanSign.position.set(-0.5, 1.45, 0.96); vanG.add(vanSign);
    [[-1.4, 0.95], [1.5, 0.95], [-1.4, -0.95], [1.5, -0.95]].forEach(([x, z]) => { const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14), P.black, x, 0.36, z, vanG); w.rotation.x = Math.PI / 2; });
    vanG.position.set(-4.6, 0, 7.4);
    scene.add(vanG);

    /* ---------- lights: Vice City dusk ---------- */
    scene.add(new THREE.HemisphereLight(0xb7c2ff, 0x2a1840, 1.2));
    const key = new THREE.DirectionalLight(0xffd2b0, 2.0);
    key.position.set(-14, 10, 13);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x2de2e6, 1.5);
    rim.position.set(10, 8, -16);
    scene.add(rim);
    const tv = new THREE.PointLight(0x5a6bff, 6, 8, 1.6);
    tv.position.set(2.35, 2.9, 1.0);
    scene.add(tv);
    const porchL = new THREE.PointLight(0xffc070, 3, 6, 1.6);
    porchL.position.set(-0.4, 3.4, 0.2);
    scene.add(porchL);
    const lampL = new THREE.PointLight(0xffc98a, 7, 11, 1.4);
    lampL.position.set(-2.85, 3.9, 5.0);
    scene.add(lampL);
    const kitchenL = new THREE.PointLight(0xffd27a, 3, 6, 1.6);
    kitchenL.position.set(-1.1, 2.4, -10.6);
    scene.add(kitchenL);

    /* ---------- snow ---------- */
    const N = 700, pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 22 + 1; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 3; vel[i] = 0.5 + Math.random() * 0.8; }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flake = tex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.15, map: flake, transparent: true, depthWrite: false, opacity: 0.85 }));
    scene.add(snow);

    /* ---------- recon wireframe + scan line ---------- */
    const wireMat = new THREE.LineBasicMaterial({ color: 0x2de2e6, transparent: true, opacity: 0.85, clippingPlanes: [wireClip] });
    const wires = [];
    scene.traverse((o) => {
      if (o.isMesh && o.geometry && !(o.geometry instanceof THREE.PlaneGeometry)) {
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), wireMat);
        o.add(l); wires.push(l);
      }
    });
    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(22, 30), new THREE.MeshBasicMaterial({ color: 0x2de2e6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    scanPlane.rotation.x = -Math.PI / 2;
    scanPlane.position.set(1, 0, -4);
    scene.add(scanPlane);
    let scanT = rm.matches ? 1 : 0, scanning = false;
    function setScan(y) { solidClip.constant = y; wireClip.constant = -y; scanPlane.position.y = y; }
    setScan(rm.matches ? 100 : -0.5);
    if (rm.matches) { wires.forEach((w) => { w.visible = false; }); scanPlane.visible = false; }

    /* ---------- camera rig ---------- */
    const target = new THREE.Vector3(1.0, 3.2, -2.6);
    const rig = { az: 0.32, el: 0.26, r: 27 };
    const want = { az: 0.32, el: 0.26, r: 27 };
    let host = null, active = false, raf = 0, last = 0, time = 0, idleAt = performance.now();
    function place() {
      camera.position.set(target.x + Math.sin(rig.az) * Math.cos(rig.el) * rig.r, target.y + Math.sin(rig.el) * rig.r, target.z + Math.cos(rig.az) * Math.cos(rig.el) * rig.r);
      camera.lookAt(target);
    }

    /* ---------- hotspot overlay ---------- */
    const overlay = document.createElement('div');
    overlay.className = 'recon__spots';
    const spots = HOTSPOTS.map((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'recon__spot';
      b.innerHTML = `<i aria-hidden="true"></i><span>${h.label}</span>`;
      b.setAttribute('aria-label', h.label);
      b.addEventListener('click', (e) => { e.stopPropagation(); open(h.id); });
      overlay.appendChild(b);
      return { h, b, v: new THREE.Vector3(...h.p), n: new THREE.Vector3(...h.n).normalize() };
    });
    const cardEl = document.createElement('div');
    cardEl.className = 'recon__card';
    cardEl.hidden = true;
    cardEl.setAttribute('role', 'status');
    let binClicks = 0, lidTarget = 0, lid = 0;
    function card(title, body, actions) {
      cardEl.innerHTML = '<button type="button" class="recon__card-x" aria-label="Close">×</button><p class="recon__card-title"></p><p class="recon__card-body"></p><div class="recon__card-actions"></div>';
      cardEl.querySelector('.recon__card-title').textContent = title;
      cardEl.querySelector('.recon__card-body').textContent = body;
      (actions || []).forEach(([t, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--sm'; b.textContent = t; b.addEventListener('click', fn); cardEl.querySelector('.recon__card-actions').appendChild(b); });
      cardEl.querySelector('.recon__card-x').addEventListener('click', () => { cardEl.hidden = true; });
      cardEl.hidden = false;
    }
    function open(id) {
      if (id === 'bin') {
        if (binClicks >= 3) { card('Green bin #1', 'We already told you. Some things, once seen, cannot be booked around.'); return; }
        const lines = [['Green bin #1', 'DO NOT OPEN. This is the official position of the household.', 'Open it'], ['Green bin #1', "Are you sure? We're not joking. Robert opened it once. Robert doesn't talk about it.", 'Open it anyway'], ['Green bin #1', 'Last chance. Hayden is watching you through the picture window.', 'OPEN THE BIN']];
        const [t, b, a] = lines[binClicks];
        card(t, b, [[a, () => {
          binClicks++;
          if (binClicks < 3) { open('bin'); return; }
          lidTarget = 1; binLight.intensity = 9;
          card('Green bin #1', "You opened it. We can't describe what's in there. It hissed. It's closed again now. Forget this happened.");
          E.find('bin'); E.emit('bin:open');
          setTimeout(() => { lidTarget = 0; }, 2600);
        }]]);
        return;
      }
      const [t, b] = INTEL[id];
      card(t, b);
      if (PKG[id]) E.find(PKG[id]);
    }

    /* ---------- input ---------- */
    let drag = null;
    const pointers = new Map();
    let pinch = null;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      idleAt = performance.now();
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: want.r }; }
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      idleAt = performance.now();
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        want.r = THREE.MathUtils.clamp(pinch.r * pinch.d / Math.hypot(a.x - b.x, a.y - b.y), 13, 46);
        return;
      }
      if (!drag) return;
      want.az -= (e.clientX - drag.x) * 0.0065;
      want.el = THREE.MathUtils.clamp(want.el + (e.clientY - drag.y) * 0.004, 0.06, 1.2);
      drag = { x: e.clientX, y: e.clientY };
    });
    const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); idleAt = performance.now(); want.r = THREE.MathUtils.clamp(want.r * Math.exp(e.deltaY * 0.0012), 13, 46); }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') want.az += 0.18; else if (k === 'ArrowRight') want.az -= 0.18;
      else if (k === 'ArrowUp') want.el = Math.min(1.2, want.el + 0.08); else if (k === 'ArrowDown') want.el = Math.max(0.06, want.el - 0.08);
      else if (k === '+' || k === '=') want.r = Math.max(13, want.r * 0.85); else if (k === '-') want.r = Math.min(46, want.r * 1.15);
      else return;
      e.preventDefault(); idleAt = performance.now();
    });

    /* ---------- loop ---------- */
    const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();
    let flick = 1, flickTo = 1, flickT = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; time += dt;
      if (scanning && scanT < 1) {
        scanT = Math.min(1, scanT + dt / 2.8);
        const k = scanT < 0.5 ? 4 * scanT ** 3 : 1 - Math.pow(-2 * scanT + 2, 3) / 2;
        setScan(-0.5 + k * 10.5);
        if (scanT >= 1) { setScan(100); scanPlane.visible = false; }
      } else if (scanT >= 1 && wireMat.opacity > 0) {
        wireMat.opacity = Math.max(0, wireMat.opacity - dt * 0.7);
        if (wireMat.opacity === 0) wires.forEach((w) => { w.visible = false; });
      }
      if (!rm.matches && performance.now() - idleAt > 4000 && !drag) want.az += dt * 0.12;
      const k = Math.min(1, dt * 6);
      rig.az += (want.az - rig.az) * k; rig.el += (want.el - rig.el) * k; rig.r += (want.r - rig.r) * k;
      place();
      flickT -= dt;
      if (flickT <= 0) { flickTo = 0.35 + Math.random() * 1.2; flickT = 0.08 + Math.random() * 0.45; }
      flick += (flickTo - flick) * Math.min(1, dt * 14);
      tvGlass.emissiveIntensity = 0.7 + flick;
      tvGlass.emissive.setHex(Math.sin(time * 0.7) > 0.3 ? 0xff4fa8 : 0x5a6bff);
      tv.color.copy(tvGlass.emissive);
      tv.intensity = 2 + flick * 5;
      lid += (lidTarget - lid) * Math.min(1, dt * 7);
      theBin.lidPivot.rotation.x = -lid * 1.2 + (lidTarget ? Math.sin(time * 30) * 0.02 : 0);
      if (!lidTarget && binLight.intensity > 0) binLight.intensity = Math.max(0, binLight.intensity - dt * 4);
      if (!rm.matches) {
        const a = snowGeo.attributes.position.array;
        for (let i = 0; i < N; i++) { a[i * 3 + 1] -= vel[i] * dt; if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 15 + Math.random(); }
        snowGeo.attributes.position.needsUpdate = true;
      }
      renderer.render(scene, camera);
      // hotspots follow the model; hide the ones facing away
      const w = canvas.clientWidth, h = canvas.clientHeight;
      for (const s of spots) {
        tmp.copy(s.v).project(camera);
        toCam.copy(camera.position).sub(s.v).normalize();
        const facing = toCam.dot(s.n) > 0.08;
        const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        const show = facing && onScreen && scanT >= 1;
        s.b.classList.toggle('is-hidden', !show);
        s.b.tabIndex = show ? 0 : -1;
        if (show) s.b.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      }
      if (active) raf = requestAnimationFrame(frame);
    }

    function resize() {
      if (!host) return;
      const w = host.clientWidth || 600, h = host.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 46 : 34;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    let inView = false;
    const io = new IntersectionObserver((en) => { en.forEach((x) => { inView = x.isIntersecting; update(); }); });
    function update() {
      const on = inView && !document.hidden;
      if (on === active) return;
      active = on;
      if (active) {
        if (!scanning && scanT < 1) scanning = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    }
    document.addEventListener('visibilitychange', update);

    return {
      attach(el) {
        if (host === el) return;
        if (host) { ro.unobserve(host); io.unobserve(host); }
        host = el;
        const stage = el.querySelector('.recon__stage') || el;
        stage.appendChild(canvas);
        stage.appendChild(overlay);
        stage.appendChild(cardEl);
        ro.observe(el);
        io.observe(el);
        resize();
        place();
      },
      reset() { want.az = 0.32; want.el = 0.26; want.r = 27; idleAt = performance.now(); },
      // dev helpers
      skipScan() { scanT = 1; setScan(100); scanPlane.visible = false; wireMat.opacity = 0; wires.forEach((w) => { w.visible = false; }); },
      view(az, el, r) { want.az = rig.az = az; want.el = rig.el = el; want.r = rig.r = r; idleAt = performance.now() + 1e9; place(); renderer.render(scene, camera); },
      resize,
      open,
      binOpen() { lidTarget = 1; binLight.intensity = 9; setTimeout(() => { lidTarget = 0; }, 2400); },
    };
  }

  window.HouseRecon = { mount, get ready() { return !!built; }, get api() { return built; } };
  E.on('bin:open', () => { if (built) built.binOpen(); });
})();
