/* ==========================================================================
   main.js — Most Wanted page glue: the burner-phone opening, the mission
   wizard, the recon scan, the HUD, the hidden bits in the form, and
   Mission Passed.
   ========================================================================== */
(function () {
  'use strict';
  const B = window.PS5Booking;
  const E = window.Eggs;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const reduce = () => B.reduceMotion();
  const html = document.documentElement;
  const startedAt = Date.now();

  /* ---------- booking widgets ---------- */
  B.renderCalendar($('#cal'));
  B.renderSlots($('#slots'));
  B.renderQuestions($('#q-crew'), { groups: ['crew'] });
  B.renderQuestions($('#q-interro'), { groups: ['interrogation'] });
  B.renderQuestions($('#q-fine'), { groups: ['fineprint'] });
  B.init({ source: 'iteration-4-most-wanted' });

  /* ---------- the burner phone ---------- */
  const phone = window.BurnerPhone.create();
  $('#phone-slot').appendChild(phone.el);
  const subs = $('#subs');
  phone.on('caption', (line) => {
    if (!line) { subs.innerHTML = ''; return; }
    const p = document.createElement('p');
    p.className = 'sub' + (line.bg ? ' sub--bg' : '') + (line.interrupt ? ' sub--hot' : '');
    p.innerHTML = '<b></b> <span></span>';
    p.firstChild.textContent = line.who + ':';
    p.lastChild.textContent = line.text;
    subs.appendChild(p);
    while (subs.children.length > 2) subs.firstElementChild.remove();
  });
  phone.on('declined', (n) => {
    const lines = ['', "Hayden doesn't accept declines.", 'The decline key is getting nervous.', 'There is no decline button.'];
    if (lines[Math.min(n, 3)]) phone.emit('caption', { who: 'Phone', text: lines[Math.min(n, 3)], interrupt: true });
  });

  const SCRIPT = [
    { who: '???', text: 'Is this line secure?', delay: 900 },
    { who: '???', text: "Don't answer that. It's not. Nothing is.", delay: 1800 },
    { who: '???', text: "It's me. Hayden.", delay: 1700, reveal: { name: 'Hayden (burner)', avatar: 'assets/hayden-face.jpg' } },
    { who: 'Hayden', text: 'The package drops November 19th.', delay: 1500 },
    { who: 'Hayden', text: 'The package is GTA VI. Relax.', delay: 1800 },
    { who: 'Robert', text: '(in the background) TELL THEM ABOUT THE BIN', delay: 1600, bg: true },
    { who: 'Hayden', text: "I'm not telling them about the bin, Robert.", delay: 1700 },
    { who: 'Matt', text: '(further in the background) is that the co-op people?', delay: 1700, bg: true },
    { who: 'Hayden', text: "It's not the co-op people, Matt.", delay: 1500 },
    { who: 'Hayden', text: "I'm texting you the details. Read them fast.", delay: 1600 },
  ];
  const TEXTS = [
    { pin: true, text: 'LOCATION: 1257 Wright Ave. The safehouse.' },
    { img: 'assets/house.webp', text: 'the spot' },
    { text: 'come by any time after nov 19. book a slot first' },
    { text: 'robert insisted on a "booking system". he built a website. you are on it' },
    { text: 'do NOT open the green bin' },
    { text: 'do not ask why' },
  ];

  let storyStarted = false;
  async function story() {
    if (storyStarted) return;
    storyStarted = true;
    setHead('Incoming call', 'Unknown number');
    await phone.incoming({ name: 'UNKNOWN', sub: 'No caller ID · Halifax, NS' });
    setHead('On a call', 'Unknown number');
    await phone.inCall({ name: 'UNKNOWN', script: SCRIPT.map((l) => (l.reveal ? Object.assign({}, l, { onReveal: true }) : l)) });
    setHead('New messages', 'Hayden (burner)');
    await phone.thread({ messages: TEXTS });
    setHead('Read fast', 'This message will self-destruct');
    await phone.selfDestruct(5);
    setHead('Job offer', 'Hayden has a job for you');
    subs.innerHTML = '<p class="sub sub--note">The messages are gone. So is your plausible deniability.</p>';
    $('#accept').hidden = false;
    $('#accept').focus({ preventScroll: true });
  }
  function setHead(k, t) { if (cur === 0) { $('#step-kicker').textContent = k; $('#step-title').textContent = t; } }

  /* ---------- intro gating ---------- */
  const panel = $('.panel');
  let revealed = false;
  function revealPanel() {
    if (revealed) return;
    revealed = true;
    panel.classList.add('is-in');
    html.classList.add('intro-done');
    setTimeout(story, reduce() ? 0 : 700);
    setTimeout(() => E.banner('Map unlocked', window.innerWidth >= 980 ? 'Drag it, scroll it. Some things on it are hidden. One of them runs.' : 'Tap "Explore map" to poke around. Some things on it are hidden.', 'info'), 1200);
  }
  document.addEventListener('wanted:introdone', revealPanel);
  setTimeout(revealPanel, 12000);
  $('.skip-intro').addEventListener('click', () => { if (window.WantedMap) window.WantedMap.skip(); });

  /* ---------- wizard ---------- */
  const STEPS = [
    { id: 'call', kicker: 'Incoming call', title: 'Unknown number' },
    { id: 'brief', kicker: 'Mission briefing', title: 'Operation: Wright Ave', next: 'Start the job' },
    { id: '1', kicker: 'Mission 1 of 5', title: 'Pick the day', check: () => (B.state.date ? '' : B.copy.needDate) },
    { id: '2', kicker: 'Mission 2 of 5', title: 'Pick your window', check: () => (B.state.slotId ? '' : B.copy.needSlot) },
    { id: '3', kicker: 'Mission 3 of 5', title: 'Assemble the crew', groups: ['crew'] },
    { id: '4', kicker: 'Mission 4 of 5', title: 'Survive the interrogation', groups: ['interrogation'] },
    { id: '5', kicker: 'Mission 5 of 5', title: 'Sign the fine print', groups: ['fineprint'], next: 'Book it' },
  ];
  const foot = $('.panel__foot');
  const msg = $('.panel__msg');
  const backBtn = $('[data-nav=back]');
  const nextBtn = $('[data-nav=next]');
  let cur = 0, completed = 0;

  function scrollToPanel() {
    const top = panel.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 980 ? 12 : 90);
    if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  }
  function show(i, opts) {
    opts = opts || {};
    cur = i;
    const st = STEPS[i];
    $$('.step').forEach((s) => {
      const on = s.dataset.step === st.id;
      s.hidden = !on;
      if (on && !reduce()) { s.classList.remove('is-entering'); void s.offsetWidth; s.classList.add('is-entering'); }
    });
    $('#step-kicker').textContent = st.kicker;
    $('#step-title').textContent = st.title;
    foot.hidden = i === 0;
    backBtn.hidden = i <= 1;
    nextBtn.firstElementChild.textContent = st.next || 'Continue';
    msg.textContent = '';
    $$('.panel__progress li').forEach((li, k) => {
      li.classList.toggle('is-done', k < completed);
      li.classList.toggle('is-current', k === i - 2 && k >= completed);
    });
    if (st.id === 'brief') mountRecon();
    if (opts.focus !== false) { scrollToPanel(); $('#step-title').focus({ preventScroll: true }); }
  }
  function complete(m) {
    if (m <= completed) return;
    completed = m;
    paintStars();
    $$('.objectives li').forEach((li) => li.classList.toggle('is-done', Number(li.dataset.obj) <= completed));
  }
  async function next() {
    const st = STEPS[cur];
    msg.textContent = '';
    if (st.check) { const m = st.check(); if (m) { msg.textContent = m; return; } }
    if (st.groups && !B.validate({ groups: st.groups })) { msg.textContent = 'A few answers are missing. They are highlighted.'; return; }
    if (st.id === '5') {
      nextBtn.disabled = true;
      nextBtn.firstElementChild.textContent = 'Booking…';
      const res = await B.submit();
      nextBtn.disabled = false;
      nextBtn.firstElementChild.textContent = st.next;
      if (!res.ok) {
        msg.textContent = res.message || B.copy.errors.network;
        if (res.error === 'taken') { completed = Math.min(completed, 1); paintStars(); show(3); msg.textContent = res.message; }
      }
      return;
    }
    if (cur >= 2) complete(cur - 1);
    show(cur + 1);
  }
  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', () => show(Math.max(1, cur - 1)));
  $('#booking').addEventListener('submit', (e) => { e.preventDefault(); next(); });
  B.on('slot', (id) => { if (id && cur === 3) setTimeout(() => { if (cur === 3 && B.state.slotId) next(); }, reduce() ? 0 : 450); });
  B.on('invalid', (err) => { if (err.kind === 'date') show(2); else if (err.kind === 'slot') show(3); });

  $('#accept').addEventListener('click', () => {
    // the phone leaves the panel and lives in the HUD from now on
    $('#phone-dock').appendChild(phone.el);
    phone.idle();
    $('.phone-fab').hidden = false;
    show(1);
  });

  /* ---------- burner in the HUD ---------- */
  const fab = $('.phone-fab'), dock = $('#phone-dock');
  function toggleDock(open) {
    dock.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    fab.classList.toggle('is-open', open);
    if (open) { phone.idle(); const k = phone.el.querySelector('[data-key=softL]'); if (k) k.focus({ preventScroll: true }); }
  }
  fab.addEventListener('click', () => toggleDock(dock.hidden));
  phone.on('close', () => toggleDock(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dock.hidden) toggleDock(false); });

  /* ---------- recon scan ---------- */
  const recon = $('#recon');
  const reconHome = document.createComment('recon-home');
  recon.parentNode.insertBefore(reconHome, recon);
  function mountRecon() { if (window.HouseRecon) window.HouseRecon.mount(recon); }
  function expandRecon(on) {
    const btn = $('[data-recon=expand]', recon);
    if (on) { document.body.appendChild(recon); recon.classList.add('is-full'); html.classList.add('recon-open'); }
    else { reconHome.parentNode.insertBefore(recon, reconHome.nextSibling); recon.classList.remove('is-full'); html.classList.remove('recon-open'); }
    btn.textContent = on ? 'Close' : 'Expand';
    btn.setAttribute('aria-pressed', String(on));
    mountRecon();
    const api = window.HouseRecon && window.HouseRecon.api;
    if (api) requestAnimationFrame(() => api.resize());
  }
  $('[data-recon=expand]', recon).addEventListener('click', () => expandRecon(!recon.classList.contains('is-full')));
  $('[data-recon=reset]', recon).addEventListener('click', () => { const api = window.HouseRecon && window.HouseRecon.api; if (api) api.reset(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && recon.classList.contains('is-full')) expandRecon(false); });
  E.on('recon:open', () => { if (window.WantedMap) window.WantedMap.explore(false); expandRecon(true); });

  /* ---------- the redacted dossier ---------- */
  $$('.redact').forEach((b) => {
    let n = 0;
    const deep = b.classList.contains('redact--deep');
    const steps = deep ? ['█████ (nice try)', '[CLASSIFIED BY ORDER OF HAYDEN]', 'fine: the basement'] : [b.dataset.reveal];
    b.setAttribute('aria-label', 'Redacted. Press to reveal.');
    b.addEventListener('click', () => {
      if (n >= steps.length) return;
      b.textContent = steps[n++];
      b.classList.add('is-touched');
      b.classList.toggle('is-open', n >= steps.length);
      b.classList.remove('bk-shake'); void b.offsetWidth; b.classList.add('bk-shake');
      if (deep && n >= steps.length) E.find('redacted');
    });
  });

  /* ---------- Hayden's sticky note over the secret question ---------- */
  (function sticky() {
    const q = $('.bk-q[data-q="leftovers"]');
    if (!q) return;
    q.classList.add('is-covered');
    q.inert = true;
    const note = document.createElement('button');
    note.type = 'button';
    note.className = 'sticky';
    note.setAttribute('aria-label', "Hayden's sticky note is covering a question. Press to peel it off.");
    note.innerHTML = "<span>DON'T answer this one.</span><small>— H.</small>";
    q.parentNode.insertBefore(note, q);
    const wrap = document.createElement('div');
    wrap.className = 'sticky-wrap';
    q.parentNode.insertBefore(wrap, note);
    wrap.appendChild(note);
    wrap.appendChild(q);
    let start = null, dx = 0, dy = 0;
    function peel() {
      note.classList.add('is-peeled');
      q.inert = false;
      q.classList.remove('is-covered');
      E.find('sticky');
      setTimeout(() => note.remove(), 700);
    }
    note.addEventListener('pointerdown', (e) => { start = { x: e.clientX - dx, y: e.clientY - dy }; note.setPointerCapture(e.pointerId); note.classList.add('is-dragging'); });
    note.addEventListener('pointermove', (e) => {
      if (!start) return;
      dx = e.clientX - start.x; dy = e.clientY - start.y;
      note.style.transform = `translate(${dx}px, ${dy}px) rotate(${-4 + dx * 0.04}deg)`;
    });
    note.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      note.classList.remove('is-dragging');
      if (Math.hypot(dx, dy) > 70) peel();
      else { dx = dy = 0; note.style.transform = ''; }
    });
    note.addEventListener('click', (e) => { if (e.detail === 0) peel(); });   // keyboard
  })();

  /* ---------- the fine print rewards scrolling ---------- */
  const terms = $('#terms-box');
  terms.addEventListener('scroll', () => {
    if (terms.scrollTop + terms.clientHeight >= terms.scrollHeight - 6) { $('#terms-secret').classList.add('is-read'); E.find('fineprint'); }
  }, { passive: true });

  /* ---------- the "No" button ---------- */
  let dodges = 0;
  $$('.bk-chip--runaway').forEach((el) => el.addEventListener('pointerenter', () => { if (++dodges === 3) E.find('robert'); }));
  $$('.bk-chip--runaway').forEach((el) => el.addEventListener('click', () => { if (++dodges === 3) E.find('robert'); }));

  /* ---------- HUD ---------- */
  const starEls = $$('#stars svg');
  let starOverride = null;
  function setStars(n) {
    starEls.forEach((s, i) => {
      const was = s.classList.contains('is-on');
      s.classList.toggle('is-on', i < n);
      if (i < n && !was) { s.classList.remove('is-new'); void s.getBoundingClientRect(); s.classList.add('is-new'); }
    });
  }
  function paintStars() { setStars(starOverride != null ? starOverride : completed); }
  function overrideStars(n, ms) { starOverride = n; paintStars(); setTimeout(() => { starOverride = null; paintStars(); }, ms); }

  const moneyEl = $('#money');
  let money = 0, moneyRaf = 0, bonus = 0;
  function setMoney(target) {
    cancelAnimationFrame(moneyRaf);
    const from = money, t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 600);
      money = Math.round(from + (target - from) * k);
      moneyEl.textContent = String(money).padStart(6, '0');
      if (k < 1) moneyRaf = requestAnimationFrame(tick);
    };
    moneyRaf = requestAnimationFrame(tick);
    moneyEl.parentElement.classList.remove('is-bump'); void moneyEl.offsetWidth; moneyEl.parentElement.classList.add('is-bump');
  }
  const pledge = () => (B.state.values.donation || 0) + bonus;

  let fullHealth = false;
  function paintBars() {
    const p = B.progress();
    const health = fullHealth ? 100 : ((p.answered + (p.date ? 1 : 0) + (p.slot ? 1 : 0)) / (p.total + 2)) * 100;
    $('#bar-health').style.setProperty('--v', Math.max(6, health) + '%');
    const snacks = (B.state.values.snacks || []).filter((s) => s !== 'nothing').length;
    $('#bar-armor').style.setProperty('--v', (snacks / 5) * 100 + '%');
  }
  B.on('answer', (a) => {
    paintBars();
    msg.textContent = '';
    if (a.id === 'donation') setMoney(pledge());
    if (a.id === 'transport' && a.value === 'stolen') {
      html.classList.remove('is-busted'); void html.offsetWidth; html.classList.add('is-busted');
      E.emit('alert');
      overrideStars(Math.min(5, completed + 2), 3600);
      setTimeout(() => html.classList.remove('is-busted'), 3600);
    }
  });
  B.on('date', paintBars);
  B.on('slot', paintBars);
  paintBars();

  E.on('cheat:clear', () => overrideStars(0, 12000));
  E.on('cheat:money', () => { bonus = 250000; fullHealth = true; setMoney(pledge()); paintBars(); });
  E.on('cheat:tank', () => overrideStars(5, 6000));

  // click the logo five times
  let logoClicks = 0, logoTimer = 0;
  $('.hud__tl').addEventListener('click', () => {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoClicks = 0; }, 1500);
    if (logoClicks === 5) { logoClicks = 0; overrideStars(5, 5000); E.banner('Wanted level: maximum', "You're now wanted in three provinces. PEI is still deciding.", 'cheat'); }
  });

  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: B.config.timezone });
  const tickClock = () => { clock.textContent = fmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 15000);

  // hidden package list
  const pkgBtn = $('.pkg__btn'), pkgPop = $('#pkg-pop');
  pkgBtn.addEventListener('click', () => { const open = pkgPop.hidden; pkgPop.hidden = !open; pkgBtn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', (e) => { if (!pkgPop.hidden && !e.target.closest('.pkg')) { pkgPop.hidden = true; pkgBtn.setAttribute('aria-expanded', 'false'); } });
  E.on('package', () => { const b = pkgBtn.querySelector('b'); b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); });
  E.paint();

  /* ---------- map controls ---------- */
  $$('[data-map]').forEach((b) => b.addEventListener('click', () => {
    const M = window.WantedMap;
    if (!M) return;
    const a = b.dataset.map;
    if (a === 'in') M.zoom(1.5);
    if (a === 'out') M.zoom(1 / 1.5);
    if (a === 'home') M.home();
    if (a === 'explore') M.explore(!html.classList.contains('exploring'));
  }));
  $('.explore-exit').addEventListener('click', () => { if (window.WantedMap) window.WantedMap.explore(false); });
  new MutationObserver(() => {
    const on = html.classList.contains('exploring');
    $('[data-map=explore]').textContent = on ? 'Exit explore' : 'Explore map';
  }).observe(html, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('exploring') && window.WantedMap) window.WantedMap.explore(false); });

  /* ---------- mission passed ---------- */
  const passed = $('#passed');
  let lastFocus = null;
  B.on('submitted', (b) => {
    complete(5);
    paintBars();
    const v = B.state.values;
    const q = (id) => B.questions.find((x) => x.id === id);
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const stats = [
      ['Session booked', `${B.formatDate(b.date, 'short')} · ${b.slotTime}`],
      ['Beer status', v.beer ? B.displayValue(q('beer')) : 'Undeclared (suspicious)'],
      ["Robert's handsomeness", 'Confirmed'],
      ['Green bin', E.found.has('bin') ? 'Opened. We saw that.' : 'Unopened. Good.'],
      ['Hidden packages', `${E.found.size} of ${E.total}`],
      ['Time taken', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`],
    ];
    $('[data-f=when]', passed).textContent = `${B.formatDate(b.date)} · ${b.slot.name}`;
    $('[data-f=stats]', passed).innerHTML = stats.map(() => '<li><span></span><span></span></li>').join('');
    $$('[data-f=stats] li', passed).forEach((li, i) => { li.firstChild.textContent = stats[i][0]; li.lastChild.textContent = stats[i][1]; });
    const links = B.calendarLinks(b);
    $('[data-f=gcal]', passed).href = links.google;
    $('[data-f=ics]', passed).href = links.ics;
    lastFocus = document.activeElement;
    passed.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('[data-f=gcal]', passed).focus(), reduce() ? 0 : 1000);
  });
  function closePassed() {
    passed.hidden = true;
    document.body.style.overflow = '';
    B.selectSlot(null);
    completed = 1;
    paintStars();
    show(3);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }
  $('[data-f=close]', passed).addEventListener('click', closePassed);
  passed.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePassed();
    if (e.key === 'Tab') {
      const f = $$('a, button', passed);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  show(0, { focus: false });
})();
