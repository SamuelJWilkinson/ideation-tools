(() => {
  'use strict';

  const STORAGE_KEY = 'ideation-tools.sliding-scales.v1';
  const MAX_STICKS = 12, MAX_LABELS = 40;
  const ROWS = 7, ITEM = 46; // must match --rows / --item in sliding-scales.css
  const HUES = [212, 148, 32, 338, 268, 184, 12, 92, 300, 52, 232, 124];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Preset sticks ---------- */

  const PRESETS = [
    { title: 'Material', labels: ['Bamboo', 'Recycled plastic', 'Cast aluminium', 'Plywood', 'Felted wool', 'Cork', 'Mycelium composite', 'Glass', 'Concrete', 'Stainless steel', 'Cardboard', 'Fired clay'] },
    { title: 'Process', labels: ['Hand weaving', 'Injection moulding', 'CNC routing', '3D printing', 'Laser cutting', 'Sand casting', 'Folding / origami', 'Hand stitching', 'Extrusion', 'Flat-pack assembly', 'Hand carving', 'Heat bending'] },
    { title: 'Economics', labels: ['Costs under £5 to make', 'Luxury price point', 'Pay-per-use', 'Open-source / DIY kit', 'Crowd-funded', 'Community co-operative', 'Charity-subsidised', 'Mass-market retail', 'Made to order', 'Rented, not owned', 'Given away free', 'Repair as a service'] },
    { title: 'Social consequence', labels: ['Brings neighbours together', 'Preserves a craft skill', 'Creates local jobs', 'Reduces isolation', 'Widens access for disabled users', 'Shifts a gendered chore', 'Teaches children', 'Encourages sharing', 'Replaces a wasteful habit', 'Raises awareness of a cause', 'Builds trust between strangers', 'Gives people a voice'] },
    { title: 'Aesthetic', labels: ['Playful', 'Austere and minimal', 'Rugged', 'Ornate', 'Soft and tactile', 'Raw industrial', 'Futuristic', 'Nostalgic', 'Jewel-like', 'Camouflaged', 'Monumental', 'Humble'] },
    { title: 'Safety function', labels: ['Fails safe', 'Child-proof', 'Fire-resistant', 'Non-toxic', 'Visible warning cues', 'Stable if knocked over', 'Easy to sanitise', 'Waterproof and sealed', 'Needs two hands to operate', 'Soft edges only', 'Tamper-evident', 'Isolates itself when faulty'] },
    { title: 'User', labels: ['Young children', 'Older adults', 'Wheelchair users', 'Daily commuters', 'Displaced people', 'Farmers', 'Students', 'Night-shift workers', 'People with low vision', 'Tourists', 'Rural households', 'Emergency responders'] },
    { title: 'Context of use', labels: ['Kitchen', 'Street', 'Disaster zone', 'Hospital', 'School', 'Garden', 'Public transport', 'Off-grid cabin', 'Festival', 'Workplace', 'Beach or water', 'Market stall'] },
    { title: 'Energy', labels: ['Human-powered', 'Solar', 'Wind-up spring', 'Disposable battery', 'Gravity', 'Mains electricity', 'Waste heat', 'Wind', 'Flowing water', 'Biofuel', 'Passive: none needed'] },
    { title: 'Life cycle', labels: ['Compostable', 'Fully recyclable', 'Repairable', 'Handed down for generations', 'Single-use', 'Upcycled into something else', 'Modular and upgradable', 'Taken back by maker', 'Biodegrades within a year', 'Designed to be dismantled', 'Heirloom quality'] },
    { title: 'Scale', labels: ['Microscopic', 'Pocket-sized', 'Handheld', 'Wearable', 'Desktop', 'Furniture-scale', 'Room-sized', 'Vehicle-sized', 'Building-sized', 'City infrastructure'] },
    { title: 'Interaction', labels: ['Push or press', 'Twist', 'Slide', 'Fold', 'Pull', 'Squeeze', 'Voice', 'Pedal', 'Tap or touch', 'Shake', 'Gesture', 'Automatic: no input'] }
  ];
  const DEFAULT_TITLES = ['Material', 'Process', 'Economics', 'Social consequence', 'Aesthetic', 'Safety function'];

  /* ---------- Helpers ---------- */

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const rand = (n) => Math.floor(Math.random() * n);
  let counter = 0;
  const newId = () => 'x' + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);

  const nextHue = (sticks) => {
    const used = new Set(sticks.map((s) => s.hue));
    return HUES.find((h) => !used.has(h)) ?? HUES[rand(HUES.length)];
  };
  const stickFrom = (title, labels, hue, pos = 0) => ({ id: newId(), title, labels: [...labels], pos, locked: false, hue });

  const blankState = () => {
    const sticks = [];
    DEFAULT_TITLES.forEach((t) => {
      const p = PRESETS.find((x) => x.title === t);
      sticks.push(stickFrom(p.title, p.labels, nextHue(sticks), rand(p.labels.length)));
    });
    return { goal: '', sticks, readings: [] };
  };

  /* ---------- State ---------- */

  let state = load();
  let editingId = null;
  let skipCommit = false;
  const refs = new Map(); // stick id -> { track, items, win }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (_) { /* storage unavailable or corrupt */ }
    return blankState();
  }

  function normalise(data) {
    if (!data || typeof data !== 'object') return blankState();
    const s = { goal: String(data.goal ?? ''), sticks: [], readings: [] };
    if (!Array.isArray(data.sticks)) {
      s.sticks = blankState().sticks;
    } else {
      const seen = new Set();
      data.sticks.slice(0, MAX_STICKS).forEach((d) => {
        const labels = (Array.isArray(d?.labels) ? d.labels : [])
          .map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, MAX_LABELS);
        if (!labels.length) return;
        let id = typeof d.id === 'string' && d.id ? d.id : newId();
        if (seen.has(id)) id = newId();
        seen.add(id);
        const pos = parseInt(d.pos, 10);
        const hue = Number.isFinite(+d.hue) ? ((+d.hue % 360) + 360) % 360 : nextHue(s.sticks);
        s.sticks.push({
          id, title: String(d.title ?? '').trim() || 'Untitled', labels,
          pos: clamp(Number.isInteger(pos) ? pos : 0, 0, labels.length - 1),
          locked: !!d.locked, hue
        });
      });
    }
    if (Array.isArray(data.readings)) {
      data.readings.slice(0, 500).forEach((r) => {
        if (!r || !Array.isArray(r.picks)) return;
        const picks = r.picks.slice(0, MAX_STICKS).map((p) => ({
          stickId: String(p?.stickId ?? ''), title: String(p?.title ?? ''), label: String(p?.label ?? ''),
          index: Number.isInteger(p?.index) ? p.index : 0,
          hue: Number.isFinite(+p?.hue) ? +p.hue : 212
        }));
        if (!picks.length) return;
        s.readings.push({ id: typeof r.id === 'string' && r.id ? r.id : newId(), note: String(r.note ?? ''), starred: !!r.starred, picks });
      });
    }
    return s;
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }, 150);
  }

  const byId = (id) => state.sticks.find((s) => s.id === id);

  /* ---------- Sticks ---------- */

  // Move a stick's track so fractional position p sits on the reading line.
  function place(s, p, animate, opts = {}) {
    const r = refs.get(s.id);
    if (!r) return;
    const { dur = 0.35, delay = 0 } = opts;
    r.track.style.transition = animate && !reduceMotion
      ? `transform ${dur}s cubic-bezier(.2,.8,.25,1) ${delay}s` : 'none';
    r.track.style.transform = `translateY(${(ROWS / 2 - (p + 0.5)) * ITEM}px)`;
    const idx = Math.round(p);
    r.items.forEach((it, i) => it.classList.toggle('on', i === idx));
    r.win.setAttribute('aria-valuenow', idx + 1);
    r.win.setAttribute('aria-valuetext', s.labels[idx] ?? '');
  }

  function setIndex(s, idx, opts) {
    s.pos = clamp(idx, 0, s.labels.length - 1);
    place(s, s.pos, true, opts);
    save();
    renderReading();
  }

  function buildStick(s) {
    const col = el('div', 'stick' + (s.locked ? ' locked' : ''));
    col.style.setProperty('--h', s.hue);

    const head = el('div', 'stick-head');
    head.appendChild(el('h3', null, s.title));
    const edit = el('button', null, 'Edit');
    edit.type = 'button';
    edit.setAttribute('aria-label', `Edit ${s.title} stick`);
    edit.addEventListener('click', () => openEditor(s.id));
    head.appendChild(edit);
    col.appendChild(head);

    const win = el('div', 'window');
    win.tabIndex = 0;
    win.setAttribute('role', 'slider');
    win.setAttribute('aria-orientation', 'vertical');
    win.setAttribute('aria-label', s.title);
    win.setAttribute('aria-valuemin', 1);
    win.setAttribute('aria-valuemax', s.labels.length);
    const track = el('div', 'track');
    const items = s.labels.map((label) => {
      const it = el('div', 'item');
      it.appendChild(el('span', null, label));
      track.appendChild(it);
      return it;
    });
    win.appendChild(track);
    col.appendChild(win);
    refs.set(s.id, { track, items, win });

    // Dragging
    let drag = null;
    win.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || s.locked) return;
      win.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, p0: s.pos, p: s.pos, moved: false };
    });
    win.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 5) return;
      drag.moved = true;
      drag.p = clamp(drag.p0 - dy / ITEM, 0, s.labels.length - 1);
      place(s, drag.p, false);
      const idx = Math.round(drag.p);
      if (idx !== s.pos) { s.pos = idx; renderReading(); }
    });
    const finish = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.moved) {
        setIndex(s, Math.round(d.p));
      } else if (e.type === 'pointerup') { // a click: slide the clicked label to the line
        const row = Math.floor((e.clientY - win.getBoundingClientRect().top) / ITEM);
        setIndex(s, s.pos + row - Math.floor(ROWS / 2));
      } else {
        setIndex(s, d.p0);
      }
    };
    win.addEventListener('pointerup', finish);
    win.addEventListener('pointercancel', finish);

    win.addEventListener('keydown', (e) => {
      if (s.locked) return;
      const k = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
      if (k) { e.preventDefault(); setIndex(s, s.pos + k); }
      else if (e.key === 'Home') { e.preventDefault(); setIndex(s, 0); }
      else if (e.key === 'End') { e.preventDefault(); setIndex(s, s.labels.length - 1); }
    });

    // Footer controls
    const foot = el('div', 'stick-foot');
    const mk = (text, label, fn, pressed) => {
      const b = el('button', null, text);
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', `${label}: ${s.title}`);
      if (pressed != null) b.setAttribute('aria-pressed', pressed);
      b.addEventListener('click', fn);
      foot.appendChild(b);
      return b;
    };
    const ctl = [
      mk('▲', 'Previous label', () => setIndex(s, s.pos - 1)),
      mk('▼', 'Next label', () => setIndex(s, s.pos + 1)),
      mk('Roll', 'Randomise this stick', () => randomise(s))
    ];
    mk('Lock', 'Lock this stick in place', () => {
      s.locked = !s.locked;
      save();
      renderSticks();
    }, s.locked);
    if (s.locked) ctl.forEach((b) => { b.disabled = true; });
    col.appendChild(foot);

    return col;
  }

  function renderSticks() {
    const wrap = $('sticks');
    wrap.textContent = '';
    refs.clear();
    if (!state.sticks.length) {
      wrap.appendChild(el('p', 'empty', 'No sticks yet. Use "Add stick" to begin.'));
    } else {
      state.sticks.forEach((s) => wrap.appendChild(buildStick(s)));
      const line = el('div', 'cursor');
      line.setAttribute('aria-hidden', 'true');
      wrap.appendChild(line);
      state.sticks.forEach((s) => place(s, s.pos, false));
    }
    $('btn-random').disabled = !state.sticks.length;
    $('btn-save').disabled = !state.sticks.length;
    $('btn-add').disabled = state.sticks.length >= MAX_STICKS;
    renderReading();
  }

  function randomise(only) {
    const targets = only ? [only] : state.sticks.filter((s) => !s.locked);
    targets.forEach((s, i) => {
      const n = s.labels.length;
      let idx = rand(n);
      if (n > 1) while (idx === s.pos) idx = rand(n);
      setIndex(s, idx, { dur: 0.55 + Math.random() * 0.5, delay: only ? 0 : i * 0.06 });
    });
  }

  /* ---------- Reading ---------- */

  const currentPicks = () => state.sticks.map((s) => ({
    stickId: s.id, title: s.title, label: s.labels[s.pos], index: s.pos, hue: s.hue
  }));

  function chip(p) {
    const c = el('span', 'chip stk');
    c.style.setProperty('--h', p.hue);
    c.appendChild(el('small', null, p.title));
    c.appendChild(el('b', null, p.label));
    return c;
  }

  function renderReading() {
    const list = $('reading');
    list.textContent = '';
    if (!state.sticks.length) {
      list.appendChild(el('li', 'none', 'Add some sticks to see a reading.'));
      return;
    }
    currentPicks().forEach((p) => {
      const li = el('li');
      li.appendChild(chip(p));
      list.appendChild(li);
    });
  }

  /* ---------- Saved readings ---------- */

  function renderSaved(focusId) {
    const list = $('saved');
    list.textContent = '';
    const starredOnly = $('starred-only').checked;
    $('saved-count').textContent = state.readings.length ? `(${state.readings.length})` : '';
    const shown = starredOnly ? state.readings.filter((r) => r.starred) : state.readings;
    if (!shown.length) {
      const li = el('li', 'empty', state.readings.length ? 'No starred readings yet.' : 'Nothing saved yet. Slide the sticks to a combination you like and choose "Save this reading".');
      list.appendChild(li);
      return;
    }
    shown.forEach((r) => {
      const li = el('li');
      const chips = el('div', 'chips');
      r.picks.forEach((p) => chips.appendChild(chip(p)));
      li.appendChild(chips);

      const note = el('textarea');
      note.rows = 2;
      note.value = r.note;
      note.placeholder = 'What idea does this combination suggest?';
      note.setAttribute('aria-label', 'Note for this reading');
      note.addEventListener('input', () => { r.note = note.value; save(); });
      li.appendChild(note);

      const row = el('div', 'row');
      const star = el('label', 'star');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = r.starred;
      cb.addEventListener('change', () => { r.starred = cb.checked; save(); if (starredOnly) renderSaved(); });
      star.append(cb, ' Star');
      row.appendChild(star);
      row.appendChild(el('span', 'spacer'));
      const restore = el('button', null, 'Restore on sticks');
      restore.type = 'button';
      restore.addEventListener('click', () => { restoreReading(r); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      const del = el('button', 'danger', 'Delete');
      del.type = 'button';
      del.addEventListener('click', () => {
        if (!confirm('Delete this saved reading?')) return;
        state.readings = state.readings.filter((x) => x !== r);
        save();
        renderSaved();
      });
      row.append(restore, del);
      li.appendChild(row);
      list.appendChild(li);
      if (r.id === focusId) note.focus();
    });
  }

  function restoreReading(r) {
    r.picks.forEach((p) => {
      const s = byId(p.stickId) || state.sticks.find((x) => x.title === p.title);
      if (!s) return;
      const i = s.labels[p.index] === p.label ? p.index : s.labels.indexOf(p.label);
      if (i >= 0) setIndex(s, i);
    });
  }

  /* ---------- Stick editor ---------- */

  function openEditor(id) {
    const s = byId(id);
    if (!s) return;
    editingId = id;
    skipCommit = false;
    $('stick-title').value = s.title;
    $('stick-labels').value = s.labels.join('\n');
    $('stick-editor').showModal();
    $('stick-title').focus();
  }

  function commitEditor() {
    const s = byId(editingId);
    editingId = null;
    if (!s || skipCommit) return;
    const current = s.labels[s.pos];
    const labels = $('stick-labels').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, MAX_LABELS);
    if (labels.length) {
      s.labels = labels;
      const kept = labels.indexOf(current);
      s.pos = kept >= 0 ? kept : clamp(s.pos, 0, labels.length - 1);
    }
    s.title = $('stick-title').value.trim() || 'Untitled';
    save();
    renderSticks();
  }

  function moveStick(dir) {
    const i = state.sticks.findIndex((s) => s.id === editingId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.sticks.length) return;
    // Keep any unsaved edits to this stick before re-rendering
    const s = state.sticks[i];
    s.title = $('stick-title').value.trim() || s.title;
    const labels = $('stick-labels').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, MAX_LABELS);
    if (labels.length) {
      const cur = s.labels[s.pos];
      s.labels = labels;
      s.pos = labels.indexOf(cur) >= 0 ? labels.indexOf(cur) : clamp(s.pos, 0, labels.length - 1);
    }
    [state.sticks[i], state.sticks[j]] = [state.sticks[j], state.sticks[i]];
    save();
    renderSticks();
  }

  /* ---------- Add dialog ---------- */

  function openAdd() {
    const list = $('add-list');
    list.textContent = '';
    const addBtn = (title, sub, tag, fn, hue) => {
      const b = el('button');
      b.type = 'button';
      if (hue != null) b.style.setProperty('--sc', `hsl(${hue} 55% 42%)`);
      if (tag) b.appendChild(el('span', 'tag', tag));
      b.appendChild(el('b', null, title));
      b.appendChild(el('small', null, sub));
      b.addEventListener('click', fn);
      list.appendChild(b);
    };
    addBtn('Blank stick', 'Name it and write your own labels', '', () => {
      const s = stickFrom('New stick', ['Option 1', 'Option 2', 'Option 3'], nextHue(state.sticks));
      state.sticks.push(s);
      save();
      renderSticks();
      $('add-dialog').close();
      openEditor(s.id);
      $('stick-title').select();
    });
    PRESETS.forEach((p) => {
      const onBoard = state.sticks.some((s) => s.title === p.title);
      addBtn(p.title, p.labels.slice(0, 4).join(', ') + '…', onBoard ? 'on the rule' : '', () => {
        state.sticks.push(stickFrom(p.title, p.labels, nextHue(state.sticks), rand(p.labels.length)));
        save();
        renderSticks();
        $('add-dialog').close();
        $('sticks').scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'smooth' });
      });
    });
    $('add-dialog').showModal();
  }

  /* ---------- Events ---------- */

  $('goal').addEventListener('input', (e) => { state.goal = e.target.value; save(); });
  $('btn-random').addEventListener('click', () => randomise());
  $('btn-add').addEventListener('click', openAdd);

  $('btn-save').addEventListener('click', () => {
    const r = { id: newId(), note: '', starred: false, picks: currentPicks() };
    state.readings.unshift(r);
    $('starred-only').checked = false;
    save();
    renderSaved(r.id);
  });
  $('starred-only').addEventListener('change', () => renderSaved());

  $('stick-editor').addEventListener('close', commitEditor);
  $('stick-editor').addEventListener('click', (e) => { if (e.target === $('stick-editor')) $('stick-editor').close(); });
  $('add-dialog').addEventListener('click', (e) => { if (e.target === $('add-dialog')) $('add-dialog').close(); });
  $('stick-left').addEventListener('click', () => moveStick(-1));
  $('stick-right').addEventListener('click', () => moveStick(1));
  $('stick-delete').addEventListener('click', () => {
    const s = byId(editingId);
    if (!s) return;
    if (!confirm(`Delete the "${s.title}" stick?`)) return;
    state.sticks = state.sticks.filter((x) => x !== s);
    skipCommit = true;
    save();
    renderSticks();
    $('stick-editor').close();
  });

  $('btn-print').addEventListener('click', () => window.print());

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sliding-scales.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace your current sticks and readings with the imported file?')) return;
      state = normalise(data);
      save();
      renderAll();
    } catch (_) {
      alert('Sorry, that file could not be read as a sliding scales export.');
    }
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Clear everything and restore the preset sticks? Export first if you want a copy.')) return;
    state = blankState();
    save();
    renderAll();
  });

  function renderAll() {
    $('goal').value = state.goal;
    renderSticks();
    renderSaved();
  }

  renderAll();
})();
