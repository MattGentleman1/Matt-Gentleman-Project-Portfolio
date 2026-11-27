/* ==========================================================================
   eggs.js — the secrets layer.
   - A tiny event bus the other scripts talk through (window.Eggs.on/emit).
   - "Hidden packages", Vice City style: every easter egg found bumps the
     counter in the HUD and pops a banner. Progress is remembered per browser.
   - Cheat codes: type them anywhere on a keyboard, or dial them on the
     burner phone (1-999 + the first four letters on the keypad).
   ========================================================================== */
(function () {
  'use strict';

  const handlers = {};
  const on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); };
  const emit = (evt, data) => (handlers[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  /* ---------- hidden packages ---------- */
  const PACKAGES = [
    ['decline', 'There is no decline button'],
    ['hangup', 'Tried to hang up on Hayden'],
    ['redacted', 'Read the redacted file'],
    ['bin', 'Opened the green bin'],
    ['decoy', 'Found the decoy bin'],
    ['basement', 'Asked about the basement'],
    ['kitchen', 'Investigated the kitchen'],
    ['robert', 'Chased the "No" button'],
    ['sticky', "Peeled off Hayden's sticky note"],
    ['fineprint', 'Read all of the fine print'],
    ['cheat', 'Entered a cheat code'],
    ['landlord', 'Caught the landlord'],
    ['van', "Spooked Steve's van"],
    ['carts', 'Found the cart graveyard'],
    ['controller', 'Dug up the spare controller'],
    ['fishing', "Found Robert's fishing spot"],
    ['bincall', 'Called the green bin'],
    ['konami', 'Wrong franchise'],
  ];
  const NAMES = Object.fromEntries(PACKAGES);
  const KEY = 'mw-packages';
  const found = new Set((store.get(KEY) || []).filter((id) => NAMES[id]));

  function paint() {
    const el = document.getElementById('pkg-count');
    if (el) el.textContent = `${found.size}/${PACKAGES.length}`;
    const list = document.getElementById('pkg-list');
    if (list) {
      list.innerHTML = PACKAGES.map(([id, name]) => `<li class="${found.has(id) ? 'is-found' : ''}">${found.has(id) ? escapeHTML(name) : '? ? ? ? ? ?'}</li>`).join('');
    }
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function find(id) {
    if (!NAMES[id] || found.has(id)) return false;
    found.add(id);
    store.set(KEY, [...found]);
    paint();
    banner(`Hidden package ${found.size} of ${PACKAGES.length}`, NAMES[id], 'pkg');
    emit('package', { id, count: found.size, total: PACKAGES.length });
    if (found.size === PACKAGES.length) setTimeout(() => banner('All hidden packages found', 'Hayden would like to know how you have this much free time.', 'gold'), 2600);
    return true;
  }

  /* ---------- banners (top-centre, GTA style) ---------- */
  let queue = Promise.resolve();
  function banner(title, sub, kind) {
    queue = queue.then(() => new Promise((resolve) => {
      const host = document.getElementById('banners');
      if (!host) { resolve(); return; }
      const el = document.createElement('div');
      el.className = 'banner banner--' + (kind || 'info');
      el.innerHTML = '<p class="banner__title"></p><p class="banner__sub"></p>';
      el.firstChild.textContent = title;
      el.lastChild.textContent = sub || '';
      host.appendChild(el);
      setTimeout(() => { el.classList.add('is-out'); }, 2600);
      setTimeout(() => { el.remove(); resolve(); }, 3000);
    }));
    return queue;
  }

  /* ---------- cheats ---------- */
  const CHEATS = {
    LEAVEMEALONE: { dial: '19995328', event: 'cheat:clear', sub: 'Wanted level cleared. Hayden is still watching, though.' },
    HESOYAM:      { dial: '19994376', event: 'cheat:money', sub: '$250,000 pledged to the second-PS5 fund. Not legally binding.' },
    BIGBANG:      { dial: '19992442', event: 'cheat:bigbang', sub: 'Every car on the map just exploded. Insurance has been notified.' },
    PANZER:       { dial: '19997269', event: 'cheat:tank', sub: 'A tank is now driving down Wright Ave. Parking was already bad.' },
  };
  function runCheat(word) {
    const c = CHEATS[word];
    if (!c) return false;
    banner('Cheat activated', c.sub, 'cheat');
    emit(c.event);
    emit('cheat', word);
    find('cheat');
    return true;
  }

  const typing = (t) => t && (t.closest('input, textarea, select, [contenteditable="true"]'));
  let buf = '';
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kon = 0;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kon = k === KONAMI[kon] ? kon + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kon === KONAMI.length) {
      kon = 0;
      banner('Wrong franchise', "This isn't that kind of game. Nice try, though.", 'cheat');
      find('konami');
    }
    if (typing(e.target) || e.key.length !== 1) return;
    buf = (buf + e.key.toUpperCase()).slice(-14);
    Object.keys(CHEATS).forEach((w) => { if (buf.endsWith(w)) { buf = ''; runCheat(w); } });
  });

  /* ---------- phone numbers ---------- */
  const NUMBERS = {
    '1257': { title: 'Calling 1257…', lines: ['Hayden picks up.', '"How did you get this number."', '"You\'re on the list now."'] },
    '911': { title: 'Calling 911…', lines: ['You hang up before it connects.', 'Smart. They already know about the barbecue.'] },
    '0': { title: 'Operator', lines: ['"Is this about the green bin again?"', '*click*'] },
    '4357': { title: 'Calling HELP…', lines: ['Nobody is coming.', 'Book a slot instead.'] },
  };
  function dial(number) {
    const n = String(number).replace(/\D/g, '');
    const cheat = Object.entries(CHEATS).find(([, c]) => c.dial === n);
    if (cheat) { runCheat(cheat[0]); return { title: 'Cheat accepted', lines: [cheat[1].sub] }; }
    if (NUMBERS[n]) return NUMBERS[n];
    if (!n) return null;
    return { title: `Calling ${n}…`, lines: ['The number you have dialled is not in service.', "Neither is Matt's motivation."] };
  }

  window.Eggs = { on, emit, find, banner, dial, runCheat, found, total: PACKAGES.length, paint, CHEATS };
  document.addEventListener('DOMContentLoaded', paint);
})();
