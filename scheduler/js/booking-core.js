/* ==========================================================================
   booking-core.js — shared booking engine (identical in every iteration).
   Renders the calendar, time slots and questionnaire into whatever containers
   a page hands it, validates answers, and posts them to the backend set in
   config.js. Pages only add styling and theatrics on top.

   Public API: window.PS5Booking
     init({ source })                 load booked slots, add demo badge
     renderCalendar(el) / renderSlots(el) / renderQuestions(el, { groups })
     validate({ schedule, groups })   -> boolean (marks + focuses errors)
     submit()                         -> Promise<{ ok, error?, message? }>
     on(event, fn)   events: taken, date, slot, answer, dayblocked,
                             slotblocked, invalid, submitting, submitted, error
   ========================================================================== */
(function () {
  'use strict';

  const C = window.BOOKING_CONFIG;
  const QUESTIONS = window.BOOKING_QUESTIONS;
  const COPY = window.BOOKING_COPY;
  const DEMO_KEY = 'ps5-demo-bookings';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const ICON = {
    left: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const START = fromISO(C.startDate);
  const END = fromISO(C.endDate);

  const state = {
    date: null,
    slotId: null,
    values: {},
    touched: new Set(),
    taken: new Set(),
    mode: C.endpoint ? 'live' : 'demo',
    source: 'unknown',
    submitting: false,
    lastBooking: null,
  };

  /* ---------- events ---------- */
  const handlers = {};
  function on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); }
  function emit(evt, data) {
    (handlers[evt] || []).forEach((fn) => { try { fn(data); } catch (err) { console.error(err); } });
  }

  /* ---------- dates & slots ---------- */
  function hourParts(h) {
    const hh = h % 24;
    return { n: hh % 12 === 0 ? 12 : hh % 12, ap: hh < 12 ? 'AM' : 'PM' };
  }
  function timeRange(slot) {
    const a = hourParts(slot.start), b = hourParts(slot.end);
    return a.ap === b.ap ? `${a.n} – ${b.n} ${b.ap}` : `${a.n} ${a.ap} – ${b.n} ${b.ap}`;
  }
  function formatDate(iso, style) {
    const d = fromISO(iso);
    if (style === 'short') return `${DAYS[d.getDay()].slice(0, 3)} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  const slotById = (id) => C.slots.find((s) => s.id === id) || null;
  const slotsFor = (iso) => { const dow = fromISO(iso).getDay(); return C.slots.filter((s) => !s.days || s.days.includes(dow)); };
  const blackoutFor = (iso) => (C.blackouts || []).find((b) => iso >= b.from && iso <= b.to) || null;
  const tagFor = (iso) => (C.dayTags || []).find((t) => iso >= t.from && iso <= t.to) || null;
  function slotStart(iso, slot) { const d = fromISO(iso); d.setHours(slot.start, 0, 0, 0); return d; }
  function slotEnd(iso, slot) { const d = fromISO(iso); d.setHours(slot.end, 0, 0, 0); return d; }

  function slotState(iso, slot) {
    const key = iso + '|' + slot.id;
    const reserved = C.hostReserved && C.hostReserved[key];
    if (reserved) return { open: false, kind: 'reserved', note: reserved, badge: 'Reserved' };
    if (state.taken.has(key)) return { open: false, kind: 'taken', note: COPY.takenLines[hash(key) % COPY.takenLines.length], badge: 'Booked' };
    if (slotStart(iso, slot) < new Date()) return { open: false, kind: 'past', note: COPY.past, badge: 'Gone' };
    return { open: true, kind: 'open', note: slot.blurb, badge: 'Open' };
  }

  function dayState(iso) {
    if (iso < C.startDate) return { open: false, kind: 'prelaunch', note: COPY.prelaunch };
    if (iso > C.endDate) return { open: false, kind: 'beyond', note: COPY.beyond };
    const bo = blackoutFor(iso);
    if (bo) return { open: false, kind: 'blackout', note: bo.reason, tag: bo.tag || 'NOPE' };
    const slots = slotsFor(iso);
    const free = slots.filter((s) => slotState(iso, s).open).length;
    const t = tagFor(iso);
    if (!free) {
      const allPast = slots.every((s) => slotStart(iso, s) < new Date());
      return allPast ? { open: false, kind: 'past', note: COPY.past } : { open: false, kind: 'full', note: COPY.full, tag: 'FULL' };
    }
    return { open: true, kind: 'open', free, total: slots.length, tag: t ? t.tag : '', note: t ? t.note : '' };
  }

  /* ---------- selection ---------- */
  function selectDate(iso) {
    if (state.date === iso) return;
    state.date = iso;
    const s = state.slotId && slotById(state.slotId);
    if (s && (!slotsFor(iso).includes(s) || !slotState(iso, s).open)) state.slotId = null;
    emit('date', iso);
    emit('slot', state.slotId);
  }
  function selectSlot(id) {
    state.slotId = id;
    emit('slot', id);
  }

  function shake(el) {
    if (!el || reduceMotion()) return;
    el.classList.remove('bk-shake');
    void el.offsetWidth;
    el.classList.add('bk-shake');
  }

  /* ---------- calendar ---------- */
  function renderCalendar(root) {
    const minView = new Date(START.getFullYear(), START.getMonth(), 1);
    const maxView = new Date(END.getFullYear(), END.getMonth(), 1);
    let view = new Date(minView);

    root.classList.add('bk-cal');
    root.innerHTML = `
      <div class="bk-cal__head">
        <button type="button" class="bk-cal__nav" data-step="-1" aria-label="Previous month">${ICON.left}</button>
        <h3 class="bk-cal__title" aria-live="polite"></h3>
        <button type="button" class="bk-cal__nav" data-step="1" aria-label="Next month">${ICON.right}</button>
      </div>
      <div class="bk-cal__dow" aria-hidden="true">${DAYS.map((d) => `<span>${d.slice(0, 3)}</span>`).join('')}</div>
      <div class="bk-cal__grid" role="group" aria-label="Choose a day"></div>
      <p class="bk-cal__note" aria-live="polite"></p>
      <ul class="bk-cal__legend" aria-hidden="true">
        <li><i class="is-open"></i>Open</li><li><i class="is-full"></i>Booked up</li><li><i class="is-blocked"></i>Not happening</li>
      </ul>`;

    const title = root.querySelector('.bk-cal__title');
    const grid = root.querySelector('.bk-cal__grid');
    const note = root.querySelector('.bk-cal__note');
    const [prev, next] = root.querySelectorAll('.bk-cal__nav');

    function setNote(text, kind) { note.textContent = text || ''; note.dataset.kind = kind || ''; }

    function draw(focusISO) {
      const y = view.getFullYear(), m = view.getMonth();
      title.textContent = `${MONTHS[m]} ${y}`;
      prev.disabled = view <= minView;
      next.disabled = view >= maxView;
      const lead = new Date(y, m, 1).getDay();
      const count = new Date(y, m + 1, 0).getDate();
      let html = '';
      for (let i = 0; i < lead; i++) html += '<span class="bk-day bk-day--blank" aria-hidden="true"></span>';
      for (let d = 1; d <= count; d++) {
        const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
        const st = dayState(iso);
        const sel = iso === state.date;
        const label = `${formatDate(iso)}${st.open ? `, ${st.free} of ${st.total} slots open` : ` — ${st.note}`}`;
        html += `<button type="button" class="bk-day is-${st.kind}${sel ? ' is-selected' : ''}${st.tag ? ' has-tag' : ''}" data-date="${iso}" aria-pressed="${sel}"${st.open ? '' : ' aria-disabled="true"'} aria-label="${esc(label)}" tabindex="-1">
          <span class="bk-day__num">${d}</span>
          ${st.tag ? `<span class="bk-day__tag">${esc(st.tag)}</span>` : ''}
          ${st.open ? `<span class="bk-day__dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(st.free, 6))}</span>` : ''}
        </button>`;
      }
      grid.innerHTML = html;
      // roving tabindex: one tab stop for the whole grid
      const days = [...grid.querySelectorAll('.bk-day[data-date]')];
      const anchor = days.find((b) => b.dataset.date === (focusISO || state.date)) ||
        days.find((b) => !b.hasAttribute('aria-disabled')) || days[0];
      if (anchor) anchor.tabIndex = 0;
      if (focusISO && anchor) anchor.focus();
    }

    function show(iso) {
      const d = fromISO(iso);
      view = new Date(d.getFullYear(), d.getMonth(), 1);
    }

    prev.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); draw(); setNote(''); });
    next.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); draw(); setNote(''); });

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.bk-day[data-date]');
      if (!btn) return;
      const iso = btn.dataset.date;
      const st = dayState(iso);
      if (!st.open) {
        setNote(st.note, 'blocked');
        shake(btn);
        emit('dayblocked', Object.assign({ date: iso }, st));
        return;
      }
      selectDate(iso);
      draw(iso);
      setNote(st.note || `${st.free} slot${st.free === 1 ? '' : 's'} open. Choose wisely.`, st.note ? 'tag' : 'info');
    });

    grid.addEventListener('keydown', (e) => {
      const btn = e.target.closest('.bk-day[data-date]');
      if (!btn) return;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      let target;
      if (e.key in moves) {
        const d = fromISO(btn.dataset.date);
        d.setDate(d.getDate() + moves[e.key]);
        target = d;
      } else if (e.key === 'Home' || e.key === 'End') {
        const d = fromISO(btn.dataset.date);
        target = e.key === 'Home' ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth() + 1, 0);
      } else return;
      e.preventDefault();
      const tm = new Date(target.getFullYear(), target.getMonth(), 1);
      if (tm < minView || tm > maxView) return;
      view = tm;
      draw(toISO(target));
    });

    on('taken', () => draw());
    on('date', (iso) => { if (iso) { const d = fromISO(iso); const vm = new Date(d.getFullYear(), d.getMonth(), 1); if (+vm !== +view) { view = vm; draw(); } } });

    draw();
    return { draw, show, setNote };
  }

  /* ---------- time slots ---------- */
  function renderSlots(root) {
    root.classList.add('bk-slots');

    function draw() {
      const focused = root.contains(document.activeElement) && document.activeElement.dataset.slot;
      if (!state.date) {
        root.innerHTML = `<div class="bk-slots__empty">${ICON.calendar}<p>${esc(COPY.pickDayFirst)}</p></div>`;
        return;
      }
      const iso = state.date;
      const t = tagFor(iso);
      root.innerHTML = `
        <div class="bk-slots__head">
          <p class="bk-slots__date">${esc(formatDate(iso))}</p>
          ${t ? `<p class="bk-slots__tag"><span>${esc(t.tag)}</span>${esc(t.note)}</p>` : ''}
        </div>
        <div class="bk-slots__list" role="group" aria-label="Time slots for ${esc(formatDate(iso))}">
          ${slotsFor(iso).map((s) => {
            const st = slotState(iso, s);
            const sel = state.slotId === s.id;
            return `<button type="button" class="bk-slot is-${st.kind}${sel ? ' is-selected' : ''}" data-slot="${s.id}" aria-pressed="${sel}"${st.open ? '' : ' aria-disabled="true"'}>
              <span class="bk-slot__time">${timeRange(s)}</span>
              <span class="bk-slot__name">${esc(s.name)}</span>
              <span class="bk-slot__note">${esc(st.note)}</span>
              <span class="bk-slot__badge">${sel ? 'Locked in' : st.badge}</span>
            </button>`;
          }).join('')}
        </div>`;
      if (focused) { const b = root.querySelector(`[data-slot="${focused}"]`); if (b) b.focus(); }
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('.bk-slot');
      if (!b) return;
      if (b.getAttribute('aria-disabled') === 'true') {
        shake(b);
        emit('slotblocked', { date: state.date, slotId: b.dataset.slot });
        return;
      }
      selectSlot(b.dataset.slot);
    });

    on('date', draw);
    on('slot', draw);
    on('taken', draw);
    draw();
    return { draw };
  }

  /* ---------- questionnaire ---------- */
  const qNum = (q) => pad(QUESTIONS.indexOf(q) + 1);
  const fid = (q, suffix) => `bk-${q.id}${suffix ? '-' + suffix : ''}`;

  function rangeComment(q, v) {
    let out = '';
    (q.comments || []).forEach(([min, text]) => { if (v >= min) out = text; });
    return out;
  }

  function labelHTML(q, tag) {
    const inner = `<span class="bk-q__num">${qNum(q)}</span><span class="bk-q__text">${esc(q.label)}</span>${q.required ? '<span class="bk-q__req" aria-hidden="true">*</span>' : ''}`;
    return tag === 'legend'
      ? `<legend class="bk-q__label">${inner}</legend>`
      : `<label class="bk-q__label" for="${fid(q)}">${inner}</label>`;
  }

  function questionHTML(q) {
    const hint = q.hint ? `<p class="bk-q__hint" id="${fid(q, 'hint')}">${esc(q.hint)}</p>` : '';
    const err = `<p class="bk-q__error" id="${fid(q, 'err')}"></p>`;
    const describedBy = [q.hint ? fid(q, 'hint') : '', fid(q, 'err')].filter(Boolean).join(' ');
    const req = q.required ? ' required aria-required="true"' : '';

    switch (q.type) {
      case 'text':
        return `<div class="bk-q bk-q--text" data-q="${q.id}">${labelHTML(q)}${hint}
          <input class="bk-input" id="${fid(q)}" type="text" maxlength="${q.maxlength || 100}" autocomplete="${q.autocomplete || 'off'}" placeholder="${esc(q.placeholder || '')}" aria-describedby="${describedBy}"${req}>${err}</div>`;
      case 'textarea':
        return `<div class="bk-q bk-q--textarea" data-q="${q.id}">${labelHTML(q)}${hint}
          <textarea class="bk-input bk-textarea" id="${fid(q)}" rows="3" maxlength="${q.maxlength || 400}" placeholder="${esc(q.placeholder || '')}" aria-describedby="${describedBy}"${req}></textarea>${err}</div>`;
      case 'choice':
      case 'multi': {
        const type = q.type === 'choice' ? 'radio' : 'checkbox';
        return `<fieldset class="bk-q bk-q--${q.type}${q.options.some((o) => o.runaway) ? ' has-runaway' : ''}" data-q="${q.id}" aria-describedby="${describedBy}">
          ${labelHTML(q, 'legend')}${hint}
          <div class="bk-q__options">
            ${q.options.map((o, i) => `<label class="bk-chip${o.runaway ? ' bk-chip--runaway' : ''}" data-value="${esc(o.value)}">
              <input type="${type}" name="${fid(q)}" value="${esc(o.value)}" id="${fid(q, i)}"${q.required && type === 'radio' && i === 0 ? ' required' : ''}>
              <span class="bk-chip__box" aria-hidden="true">${ICON.check}</span>
              <span class="bk-chip__text">${esc(o.label)}</span>
            </label>`).join('')}
          </div>
          <p class="bk-q__reply" aria-live="polite"></p>${err}</fieldset>`;
      }
      case 'range': {
        const v = q.value != null ? q.value : q.min;
        return `<div class="bk-q bk-q--range" data-q="${q.id}">${labelHTML(q)}${hint}
          <div class="bk-range">
            <input type="range" id="${fid(q)}" min="${q.min}" max="${q.max}" step="${q.step || 1}" value="${v}" aria-describedby="${describedBy}">
            <output class="bk-range__value" for="${fid(q)}">${esc(q.format ? q.format(v) : v)}</output>
          </div>
          <p class="bk-q__reply" aria-live="polite">${esc(rangeComment(q, v))}</p>${err}</div>`;
      }
      case 'consent':
        return `<div class="bk-q bk-q--consent" data-q="${q.id}">
          <label class="bk-consent" for="${fid(q)}">
            <input type="checkbox" id="${fid(q)}" aria-describedby="${describedBy}"${req}>
            <span class="bk-consent__box" aria-hidden="true">${ICON.check}</span>
            <span class="bk-consent__text">${esc(q.label)}${q.required ? '<span class="bk-q__req" aria-hidden="true">*</span>' : ''}</span>
          </label>${err}</div>`;
      default:
        return '';
    }
  }

  function setError(q, msg) {
    const box = document.querySelector(`.bk-q[data-q="${q.id}"]`);
    if (!box) return;
    box.classList.toggle('is-invalid', !!msg);
    const e = box.querySelector('.bk-q__error');
    if (e) e.textContent = msg || '';
    box.querySelectorAll('input:not([type=hidden]), textarea').forEach((el) => {
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
  }

  function commit(q, value, reply) {
    state.values[q.id] = value;
    state.touched.add(q.id);
    const box = document.querySelector(`.bk-q[data-q="${q.id}"]`);
    if (box && reply !== undefined) {
      const r = box.querySelector('.bk-q__reply');
      if (r) { r.textContent = reply || ''; r.classList.remove('bk-pop'); void r.offsetWidth; if (reply) r.classList.add('bk-pop'); }
    }
    if (box && box.classList.contains('is-invalid')) setError(q, '');
    emit('answer', { id: q.id, value, question: q });
  }

  function wireRunaway(q, box) {
    const label = box.querySelector('.bk-chip--runaway');
    if (!label) return;
    const wrap = box.querySelector('.bk-q__options');
    const text = label.querySelector('.bk-chip__text');
    const lines = q.runawayLines || [];
    let dodges = 0;

    function dodge() {
      dodges++;
      if (lines.length) text.textContent = lines[Math.min(dodges - 1, lines.length - 1)];
      if (dodges >= lines.length + 2) {           // they earned it: auto-answer for them
        const first = box.querySelector('input[type=radio]');
        first.checked = true;
        commit(q, q.options[0].value, q.runawayFixed);
        label.classList.add('is-gone');
        return;
      }
      if (reduceMotion()) return;
      label.style.transform = '';
      const ox = label.offsetLeft, oy = label.offsetTop;
      const maxX = Math.max(0, wrap.clientWidth - label.offsetWidth);
      const maxY = Math.max(0, wrap.clientHeight - label.offsetHeight);
      let tx = ox, ty = oy, tries = 0;
      do { tx = Math.random() * maxX; ty = Math.random() * maxY; tries++; }
      while (tries < 8 && Math.hypot(tx - ox, ty - oy) < 70);
      label.style.transform = `translate(${Math.round(tx - ox)}px, ${Math.round(ty - oy)}px) rotate(${Math.round(Math.random() * 16 - 8)}deg)`;
    }

    label.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dodge(); });
    label.addEventListener('click', (e) => { e.preventDefault(); dodge(); });
    // keyboard users who arrow onto "No" get quietly corrected
    label.querySelector('input').addEventListener('change', (e) => {
      if (!e.target.checked) return;
      const first = box.querySelector('input[type=radio]');
      first.checked = true;
      first.focus();
      commit(q, q.options[0].value, q.runawayFixed);
    });
  }

  function wireQuestion(q, box) {
    if (q.type === 'text' || q.type === 'textarea') {
      const el = box.querySelector('input, textarea');
      el.addEventListener('input', () => commit(q, el.value));
    } else if (q.type === 'choice') {
      box.querySelectorAll('input[type=radio]').forEach((inp) => {
        const opt = q.options.find((o) => o.value === inp.value);
        if (opt.runaway) return;
        inp.addEventListener('change', () => { if (inp.checked) commit(q, inp.value, opt.reply || ''); });
      });
      wireRunaway(q, box);
    } else if (q.type === 'multi') {
      box.querySelectorAll('input[type=checkbox]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const vals = [...box.querySelectorAll('input:checked')].map((i) => i.value);
          const opt = q.options.find((o) => o.value === inp.value);
          commit(q, vals, inp.checked ? opt.reply || '' : (vals.length ? undefined : ''));
        });
      });
    } else if (q.type === 'range') {
      const el = box.querySelector('input[type=range]');
      const out = box.querySelector('output');
      const paint = () => {
        const v = Number(el.value);
        el.style.setProperty('--pct', ((v - q.min) / (q.max - q.min)) * 100 + '%');
        out.textContent = q.format ? q.format(v) : v;
        return v;
      };
      paint();
      state.values[q.id] = Number(el.value);
      el.addEventListener('input', () => { const v = paint(); commit(q, v, rangeComment(q, v)); });
    } else if (q.type === 'consent') {
      const el = box.querySelector('input');
      el.addEventListener('change', () => commit(q, el.checked));
    }
  }

  function renderQuestions(root, opts) {
    opts = opts || {};
    const list = QUESTIONS.filter((q) => !opts.groups || opts.groups.includes(q.group));
    root.classList.add('bk-questions');
    root.innerHTML = list.map(questionHTML).join('');
    if (!document.querySelector('.bk-hp')) {
      root.insertAdjacentHTML('beforeend', '<div class="bk-hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>');
    }
    list.forEach((q) => wireQuestion(q, root.querySelector(`.bk-q[data-q="${q.id}"]`)));
    return { questions: list };
  }

  /* ---------- validation ---------- */
  function isEmpty(v) { return v == null || v === false || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length); }

  function validate(opts) {
    opts = opts || {};
    const errors = [];
    if (opts.schedule) {
      if (!state.date) errors.push({ kind: 'date', message: COPY.needDate });
      else if (!state.slotId) errors.push({ kind: 'slot', message: COPY.needSlot });
    }
    QUESTIONS.filter((q) => !opts.groups || opts.groups.includes(q.group)).forEach((q) => {
      if (!document.querySelector(`.bk-q[data-q="${q.id}"]`)) return;
      const bad = q.required && isEmpty(state.values[q.id]);
      setError(q, bad ? (q.error || 'This one is required.') : '');
      if (bad) errors.push({ kind: 'question', id: q.id, message: q.error });
    });
    if (errors.length && opts.focus !== false) {
      const first = errors[0];
      emit('invalid', first);
      if (first.kind === 'question') {
        const box = document.querySelector(`.bk-q[data-q="${first.id}"]`);
        const el = box && box.querySelector('input:not([type=hidden]), textarea');
        if (box) box.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
        if (el) setTimeout(() => el.focus({ preventScroll: true }), reduceMotion() ? 0 : 350);
        shake(box);
      }
    }
    return errors.length === 0;
  }

  /* ---------- submission ---------- */
  function displayValue(q) {
    const v = state.values[q.id];
    switch (q.type) {
      case 'text': case 'textarea': return (v || '').trim() || '—';
      case 'choice': { const o = q.options.find((x) => x.value === v); return o ? o.label : '—'; }
      case 'multi': return (v && v.length) ? v.map((x) => q.options.find((o) => o.value === x).label).join(', ') : '—';
      case 'range': { const n = v != null ? v : q.value; return (q.format ? q.format(n) : String(n)) + (state.touched.has(q.id) ? '' : ' (left at default)'); }
      case 'consent': return v ? 'Yes, solemnly' : 'Did not tick it';
      default: return String(v == null ? '—' : v);
    }
  }

  function buildPayload() {
    const slot = slotById(state.slotId);
    const hp = document.querySelector('.bk-hp input');
    return {
      date: state.date,
      dateLabel: formatDate(state.date),
      slotId: slot.id,
      slotLabel: slot.name,
      slotTime: timeRange(slot),
      startsAt: stamp(slotStart(state.date, slot)),
      endsAt: stamp(slotEnd(state.date, slot)),
      name: (state.values.name || '').trim(),
      contact: (state.values.contact || '').trim(),
      crew: displayValue(QUESTIONS.find((q) => q.id === 'crew') || {}),
      answers: QUESTIONS.filter((q) => q.id !== 'name' && q.id !== 'contact').map((q) => ({ q: q.label, a: displayValue(q) })),
      source: state.source,
      website: hp ? hp.value : '',
    };
  }

  function readDemo() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) { return []; } }
  function writeDemo(list) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch (e) { /* private mode: fine */ } }

  async function demoSend(payload) {
    console.info('[PS5 booking — demo mode] This is what would be emailed:', payload);
    await new Promise((r) => setTimeout(r, 900));
    const list = readDemo();
    list.push({ date: payload.date, slotId: payload.slotId, name: payload.name });
    writeDemo(list);
    return { ok: true, demo: true };
  }

  async function liveSend(payload) {
    const body = JSON.stringify(payload);   // text/plain body keeps it a "simple" CORS request
    try {
      const res = await fetch(C.endpoint, { method: 'POST', body });
      return await res.json();
    } catch (err) {
      // If the browser refuses to read Apps Script's redirect, post blind.
      // The backend's lock + taken-check stops this from double-booking.
      await fetch(C.endpoint, { method: 'POST', body, mode: 'no-cors' });
      return { ok: true, unverified: true };
    }
  }

  async function loadTaken() {
    if (state.mode === 'demo') {
      readDemo().forEach((b) => state.taken.add(b.date + '|' + b.slotId));
      emit('taken');
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(C.endpoint + (C.endpoint.includes('?') ? '&' : '?') + 'action=taken', { signal: ctrl.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (data && Array.isArray(data.taken)) data.taken.forEach((k) => state.taken.add(k));
    } catch (err) {
      console.warn('Could not load booked slots; the backend will still reject doubles.', err);
    }
    emit('taken');
  }

  async function submit() {
    if (state.submitting) return { ok: false, error: 'busy' };
    if (!validate({ schedule: true })) return { ok: false, error: 'invalid', message: COPY.errors.invalid };
    state.submitting = true;
    emit('submitting');
    const payload = buildPayload();
    const key = payload.date + '|' + payload.slotId;
    try {
      const res = state.mode === 'demo' ? await demoSend(payload) : await liveSend(payload);
      if (!res || !res.ok) throw Object.assign(new Error((res && res.error) || 'network'), { code: (res && res.error) || 'network' });
      state.taken.add(key);
      state.lastBooking = { date: payload.date, dateLabel: payload.dateLabel, slot: slotById(payload.slotId), slotTime: payload.slotTime, name: payload.name };
      emit('taken');
      emit('submitted', state.lastBooking);
      return { ok: true };
    } catch (err) {
      const code = err.code || 'network';
      if (code === 'taken') {
        state.taken.add(key);
        state.slotId = null;
        emit('taken');
        emit('slot', null);
      }
      const message = COPY.errors[code] || COPY.errors.network;
      emit('error', { code, message });
      return { ok: false, error: code, message };
    } finally {
      state.submitting = false;
    }
  }

  /* ---------- extras pages can use ---------- */
  function countdown(target) {
    const ms = new Date(target || C.launch) - new Date();
    const s = Math.max(0, Math.floor(ms / 1000));
    return { done: ms <= 0, d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  }

  function stamp(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
  function calendarLinks(b) {
    b = b || state.lastBooking;
    if (!b) return null;
    const s = slotStart(b.date, b.slot), e = slotEnd(b.date, b.slot);
    const title = "GTA VI at Hayden's";
    const where = `${C.address}, ${C.city}`;
    const details = `${b.slot.name} (${b.slotTime}). Bring snacks. Do not touch Hayden's save file.`;
    const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(title)}&dates=${stamp(s)}/${stamp(e)}&ctz=${encodeURIComponent(C.timezone)}` +
      `&location=${encodeURIComponent(where)}&details=${encodeURIComponent(details)}`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hayden PS5//Booking//EN', 'BEGIN:VEVENT',
      `UID:${b.date}-${b.slot.id}@haydens-ps5`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART;TZID=${C.timezone}:${stamp(s)}`, `DTEND;TZID=${C.timezone}:${stamp(e)}`,
      `SUMMARY:${title}`, `LOCATION:${where.replace(/,/g, '\\,')}`, `DESCRIPTION:${details.replace(/,/g, '\\,')}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return { google, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
  }

  function progress() {
    const req = QUESTIONS.filter((q) => q.required);
    const answered = QUESTIONS.filter((q) => state.touched.has(q.id) && !isEmpty(state.values[q.id])).length;
    return {
      date: !!state.date, slot: !!state.slotId,
      answered, total: QUESTIONS.length,
      requiredDone: req.every((q) => !isEmpty(state.values[q.id])),
      groupDone: (g) => QUESTIONS.filter((q) => q.group === g && q.required).every((q) => !isEmpty(state.values[q.id])),
    };
  }

  function init(opts) {
    opts = opts || {};
    state.source = opts.source || state.source;
    document.documentElement.dataset.bookingMode = state.mode;
    if (state.mode === 'demo' && !document.querySelector('.bk-demo')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="bk-demo" role="status"><b>${esc(COPY.demoBadge)}</b><span> · ${esc(COPY.demoBadgeMore || '')}</span></div>`);
    }
    return loadTaken();
  }

  window.PS5Booking = {
    config: C, questions: QUESTIONS, copy: COPY, state,
    init, on, renderCalendar, renderSlots, renderQuestions, validate, submit,
    selectDate, selectSlot, slotById, slotsFor, slotState, dayState, timeRange, formatDate,
    countdown, calendarLinks, progress, displayValue, reduceMotion,
  };
})();
