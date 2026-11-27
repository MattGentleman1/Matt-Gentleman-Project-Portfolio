/* ==========================================================================
   phone.js — Hayden's burner phone (a "Haydia 1257").
   Monochrome LCD, soft keys, a real keypad. Used for the opening story
   (incoming call → call → texts → self-destruct) and afterwards as the HUD
   phone: contacts with voicemails, and a dial pad that takes cheat codes.
   ========================================================================== */
(function () {
  'use strict';

  const E = window.Eggs;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce() ? Math.min(ms, 60) : ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICON = {
    call: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    end: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3.6 14.9c4.7-4.4 12.1-4.4 16.8 0l-1.9 2.6-3.6-1.3.1-2.5a10 10 0 00-6 0l.1 2.5-3.6 1.3z" fill="currentColor"/></svg>',
  };
  const KEYS = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', '+'], ['#', '']];

  const CONTACTS = [
    { id: 'hayden', name: 'Hayden', lines: ['"It\'s Hayden. If this is about the save file: no."', '"If this is about the bin: also no."'] },
    { id: 'robert', name: 'Robert', lines: ['"You\'ve reached Robert."', '"Yes. I am."', '*beep*'] },
    { id: 'matt', name: 'Matt', lines: ['Matt can\'t come to the phone.', 'He is refreshing his co-op portal.', 'He has been refreshing it since August.'] },
    { id: 'landlord', name: 'Landlord', lines: ['It rings once.', 'Then you hear knocking.', 'At the front door of 1257.', 'Do not answer the door.'] },
    { id: 'pizza', name: 'Pizza Corner', lines: ['"Pizza Corner."', '"...Oh. It\'s you guys again."', '"It\'s 3 AM. Two donairs?"'] },
    { id: 'steve', name: 'Steve (Flowers)', lines: ['"Flowers by Steve, I—"', '"...wrong number."', '*click*'] },
    { id: 'bin', name: '???', hidden: true, lines: ['You\'ve reached the green bin.', 'Leave a message after the hiss.', 'ssssssssssss'] },
  ];

  function pixelate(src, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.className = 'lcd__px';
    const img = new Image();
    img.onload = () => {
      const g = c.getContext('2d');
      const s = Math.max(w / img.width, h / img.height);
      const iw = img.width * s, ih = img.height * s;
      g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    };
    img.src = src;
    return c;
  }

  function create() {
    const root = document.createElement('div');
    root.className = 'burner';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Burner phone');
    root.innerHTML = `
      <div class="burner__ear" aria-hidden="true"><span class="burner__brand">HAYDIA</span><span class="burner__grille"></span></div>
      <div class="burner__bezel">
        <div class="lcd">
          <div class="lcd__status" aria-hidden="true"><span class="lcd__sig"><i></i><i></i><i></i><i></i></span><span class="lcd__clock">--:--</span><span class="lcd__batt"><i></i></span></div>
          <div class="lcd__body" aria-live="polite"></div>
          <div class="lcd__soft" aria-hidden="true"><span data-soft="l"></span><span data-soft="r"></span></div>
        </div>
      </div>
      <div class="burner__keys">
        <button type="button" class="key key--soft" data-key="softL" aria-label="Left soft key"><i></i></button>
        <div class="key-nav">
          <button type="button" class="key key--nav" data-key="up" aria-label="Up"><svg viewBox="0 0 10 6" width="12" height="8" aria-hidden="true"><path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
          <button type="button" class="key key--nav" data-key="down" aria-label="Down"><svg viewBox="0 0 10 6" width="12" height="8" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
        </div>
        <button type="button" class="key key--soft" data-key="softR" aria-label="Right soft key"><i></i></button>
        <button type="button" class="key key--call" data-key="call" aria-label="Call or answer">${ICON.call}</button>
        <span class="key-spacer" aria-hidden="true"></span>
        <button type="button" class="key key--end" data-key="end" aria-label="End call or decline">${ICON.end}</button>
        ${KEYS.map(([d, l]) => `<button type="button" class="key key--num" data-key="${d}" aria-label="${d}${l ? ' ' + l.toUpperCase() : ''}"><b>${d}</b><small>${l}</small></button>`).join('')}
      </div>`;

    const body = root.querySelector('.lcd__body');
    const softL = root.querySelector('[data-soft=l]');
    const softR = root.querySelector('[data-soft=r]');
    const clock = root.querySelector('.lcd__clock');
    const fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: (window.BOOKING_CONFIG || {}).timezone || undefined });
    const tick = () => { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 20000);

    let mode = 'idle';
    let handlers = {};
    let digits = '';
    let sel = 0;
    let list = [];
    let declines = 0;
    let unlockedBin = false;

    function soft(l, r) {
      softL.textContent = l || '';
      softR.textContent = r || '';
      root.querySelector('[data-key=softL]').setAttribute('aria-label', l ? l : 'Left soft key');
      root.querySelector('[data-key=softR]').setAttribute('aria-label', r ? r : 'Right soft key');
    }
    function screen(html, l, r) { body.innerHTML = html; soft(l, r); }
    function setMode(m, h) { mode = m; handlers = h || {}; root.dataset.mode = m; }

    /* ---------- navigation screens ---------- */
    function menu() {
      setMode('menu', {});
      list = [['contacts', 'Contacts'], ['messages', 'Messages'], ['dial', 'Dial a number']];
      sel = 0;
      drawList('MENU', 'Select', 'Close');
      handlers.softL = handlers.call = () => openItem(list[sel][0]);
      handlers.softR = handlers.end = () => api.emit('close');
    }
    function drawList(title, l, r) {
      screen(`<p class="lcd__title">${esc(title)}</p><ul class="lcd__list" role="list">${list.map((it, i) => `<li><button type="button" class="${i === sel ? 'is-sel' : ''}" data-i="${i}">${esc(it[1])}</button></li>`).join('')}</ul>`, l, r);
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { sel = Number(b.dataset.i); drawList(title, l, r); handlers.softL(); }));
    }
    function openItem(id) {
      if (id === 'contacts') return contacts();
      if (id === 'messages') {
        setMode('result', { softR: menu, end: menu, softL: menu });
        return screen('<p class="lcd__title">MESSAGES</p><p class="lcd__text">No messages.</p><p class="lcd__text">Hayden deleted them. Hayden is thorough.</p>', '', 'Back');
      }
      if (id === 'dial') return dialScreen('');
    }
    function contacts() {
      setMode('contacts', {});
      list = CONTACTS.filter((c) => !c.hidden || unlockedBin).map((c) => [c.id, c.name]);
      sel = 0;
      drawList('CONTACTS', 'Call', 'Back');
      handlers.softL = handlers.call = () => callContact(CONTACTS.find((c) => c.id === list[sel][0]));
      handlers.softR = handlers.end = menu;
    }
    async function callContact(c) {
      setMode('calling', { end: contacts, softR: contacts });
      screen(`<p class="lcd__title">CALLING</p><p class="lcd__big">${esc(c.name)}</p><p class="lcd__dots"><i></i><i></i><i></i></p>`, '', 'End');
      await wait(1400);
      if (mode !== 'calling') return;
      screen(`<p class="lcd__title">${esc(c.name.toUpperCase())}</p>${c.lines.map((l) => `<p class="lcd__text">${esc(l)}</p>`).join('')}`, '', 'Back');
      if (c.id === 'bin') E.find('bincall');
    }
    function dialScreen(start) {
      digits = start || '';
      setMode('dial', {});
      const draw = () => screen(`<p class="lcd__title">DIAL</p><p class="lcd__digits">${esc(digits) || '<span class="lcd__cursor">_</span>'}</p><p class="lcd__hint">Press the green key to call</p>`, digits ? 'Call' : '', digits ? 'Clear' : 'Back');
      draw();
      handlers.num = (d) => { if (digits.length < 16) { digits += d; draw(); } };
      handlers.softL = handlers.call = () => {
        if (!digits) return;
        const res = E.dial(digits);
        setMode('result', { softR: menu, end: menu, softL: () => dialScreen('') });
        screen(`<p class="lcd__title">${esc(res.title)}</p>${res.lines.map((l) => `<p class="lcd__text">${esc(l)}</p>`).join('')}`, 'Again', 'Back');
      };
      handlers.softR = () => { if (digits) { digits = digits.slice(0, -1); draw(); } else menu(); };
      handlers.end = menu;
    }

    /* ---------- story screens ---------- */
    function incoming(opts) {
      return new Promise((resolve) => {
        setMode('incoming', {});
        root.classList.add('is-ringing');
        const avatar = opts.avatar ? '' : '<div class="lcd__unknown" aria-hidden="true">?</div>';
        screen(`<p class="lcd__title">INCOMING CALL</p>${avatar}<p class="lcd__big">${esc(opts.name)}</p><p class="lcd__text">${esc(opts.sub || '')}</p>`, 'Answer', 'Decline');
        const answer = () => { root.classList.remove('is-ringing'); resolve('answer'); };
        handlers.softL = handlers.call = answer;
        handlers.softR = handlers.end = () => decline();
      });
    }
    function decline() {
      declines++;
      const endKey = root.querySelector('[data-key=end]');
      const labels = ['Decline', 'Decl.', 'Dec', 'D', ''];
      softR.textContent = labels[Math.min(declines, labels.length - 1)];
      api.emit('declined', declines);
      if (declines < 3) {
        endKey.style.setProperty('--shrink', String(1 - declines * 0.22));
        endKey.classList.remove('is-wobble'); void endKey.offsetWidth; endKey.classList.add('is-wobble');
        return;
      }
      if (endKey.classList.contains('is-gone')) return;
      // the decline key falls off the phone
      const r = endKey.getBoundingClientRect();
      const ghost = endKey.cloneNode(true);
      ghost.className = 'key key--end key-falling';
      ghost.removeAttribute('data-key');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      document.body.appendChild(ghost);
      setTimeout(() => ghost.remove(), 2200);
      endKey.classList.add('is-gone');
      endKey.setAttribute('aria-hidden', 'true');
      endKey.tabIndex = -1;
      softR.textContent = '';
      E.find('decline');
    }

    async function inCall(opts) {
      setMode('call', {});
      const started = Date.now();
      const avatarEl = opts.avatar ? pixelate(opts.avatar, 44, 44) : null;
      screen(`<p class="lcd__title">IN CALL</p><div class="lcd__caller"></div><p class="lcd__big" data-name>${esc(opts.name)}</p><p class="lcd__timer">00:00</p><p class="lcd__wave" aria-hidden="true">${'<i></i>'.repeat(14)}</p>`, 'Mute', 'Hang up');
      const callerBox = body.querySelector('.lcd__caller');
      if (avatarEl) callerBox.appendChild(avatarEl); else callerBox.innerHTML = '<div class="lcd__unknown" aria-hidden="true">?</div>';
      const timer = body.querySelector('.lcd__timer');
      const iv = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        if (timer.isConnected) timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 500);
      let hangups = 0;
      const hangup = () => {
        hangups++;
        api.emit('caption', { who: 'Hayden', text: hangups > 1 ? 'Stop pressing that.' : "Don't you dare hang up on me.", interrupt: true });
        E.find('hangup');
      };
      handlers.softR = handlers.end = hangup;
      handlers.softL = () => { softL.textContent = 'Muted?'; api.emit('caption', { who: 'Hayden', text: 'I can still hear you breathing.', interrupt: true }); };
      for (const line of opts.script) {
        await wait(line.delay || 1400);
        if (line.reveal) {
          callerBox.innerHTML = '';
          callerBox.appendChild(pixelate(line.reveal.avatar, 44, 44));
          body.querySelector('[data-name]').textContent = line.reveal.name;
        }
        api.emit('caption', line);
      }
      await wait(1600);
      clearInterval(iv);
      screen('<p class="lcd__title">CALL ENDED</p><p class="lcd__big">Hayden (burner)</p><p class="lcd__text">He hung up on you.</p><p class="lcd__text">Classic Hayden.</p>', '', '');
      setMode('ended', {});
      api.emit('caption', null);
      await wait(1100);
    }

    async function thread(opts) {
      setMode('thread', {});
      screen(`<p class="lcd__title">1 NEW MESSAGE</p><div class="lcd__thread"></div>`, '', '');
      const t = body.querySelector('.lcd__thread');
      for (const m of opts.messages) {
        const typing = document.createElement('p');
        typing.className = 'lcd__typing';
        typing.innerHTML = '<i></i><i></i><i></i>';
        t.appendChild(typing);
        t.scrollTop = t.scrollHeight;
        await wait(m.img ? 900 : 380 + m.text.length * 20);
        typing.remove();
        const p = document.createElement('div');
        p.className = 'lcd__msg' + (m.img ? ' lcd__msg--img' : '') + (m.pin ? ' lcd__msg--pin' : '');
        if (m.img) p.appendChild(pixelate(m.img, 96, 64));
        const txt = document.createElement('span');
        txt.textContent = m.text;
        p.appendChild(txt);
        t.appendChild(p);
        t.scrollTop = t.scrollHeight;
        body.querySelector('.lcd__title').textContent = `${t.querySelectorAll('.lcd__msg').length} NEW MESSAGES`;
        await wait(260);
      }
    }

    async function selfDestruct(n) {
      const t = body.querySelector('.lcd__thread');
      const p = document.createElement('div');
      p.className = 'lcd__msg lcd__msg--warn';
      t.appendChild(p);
      for (let i = n; i > 0; i--) {
        p.textContent = `this message will self-destruct in ${i}`;
        t.scrollTop = t.scrollHeight;
        await wait(900);
      }
      root.classList.add('is-destructing');
      t.querySelectorAll('.lcd__msg').forEach((m, i) => { m.style.animationDelay = `${i * 70}ms`; m.classList.add('is-burning'); });
      await wait(1300);
      root.classList.remove('is-destructing');
      screen('<p class="lcd__title">MESSAGES</p><p class="lcd__big">DELETED</p><p class="lcd__text">0 messages.</p><p class="lcd__text">Hayden is thorough.</p>', '', '');
      setMode('ended', {});
    }

    /* ---------- keys ---------- */
    root.addEventListener('click', (e) => {
      const k = e.target.closest('[data-key]');
      if (!k || k.classList.contains('is-gone')) return;
      const key = k.dataset.key;
      k.classList.remove('is-press'); void k.offsetWidth; k.classList.add('is-press');
      if (/^[0-9*#]$/.test(key)) {
        if (handlers.num) handlers.num(key);
        else if (['menu', 'contacts', 'result', 'idle'].includes(mode)) { dialScreen(''); handlers.num(key); }
        return;
      }
      if ((key === 'up' || key === 'down') && list.length && (mode === 'menu' || mode === 'contacts')) {
        sel = (sel + (key === 'up' ? -1 : 1) + list.length) % list.length;
        body.querySelectorAll('.lcd__list button').forEach((b, i) => b.classList.toggle('is-sel', i === sel));
        return;
      }
      if (handlers[key]) handlers[key]();
      else if ((key === 'softL' || key === 'call') && (mode === 'idle' || mode === 'ended')) menu();
    });

    const events = {};
    const api = {
      el: root,
      on(evt, fn) { (events[evt] = events[evt] || []).push(fn); },
      emit(evt, d) { (events[evt] || []).forEach((fn) => fn(d)); },
      incoming, inCall, thread, selfDestruct, menu,
      idle() { setMode('idle', {}); screen('<p class="lcd__title">HAYDIA 1257</p><p class="lcd__big">Ready.</p><p class="lcd__text">Menu: left key.</p><p class="lcd__text">Or just start dialling.</p>', 'Menu', ''); },
      unlockBin() { unlockedBin = true; },
    };
    E.on('package', (p) => { if (p.id === 'bin') unlockedBin = true; });
    if (E.found.has('bin')) unlockedBin = true;
    return api;
  }

  window.BurnerPhone = { create };
})();
