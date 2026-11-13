(() => {
  'use strict';

  const STORAGE_KEY = 'ideation-tools.morph-matrix.v1';
  const MIN_N = 2, MAX_N = 6, DEFAULT_N = 3;
  const LETTERS = ['A', 'B', 'C'];
  const CLASSES = ['a', 'b', 'c'];

  const blankState = () => ({
    goal: '',
    n: DEFAULT_N,
    dims: [0, 1, 2].map(() => ({ title: '', params: Array(MAX_N).fill('') })),
    ideas: {} // "a-b-c" -> { text, starred }
  });

  let state = load();
  let editing = null; // [a, b, c]

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (_) { /* storage unavailable or corrupt */ }
    return blankState();
  }

  function normalise(data) {
    const s = blankState();
    if (!data || typeof data !== 'object') return s;
    s.goal = String(data.goal ?? '');
    const n = parseInt(data.n, 10);
    s.n = Number.isInteger(n) ? Math.min(MAX_N, Math.max(MIN_N, n)) : DEFAULT_N;
    if (Array.isArray(data.dims)) {
      data.dims.slice(0, 3).forEach((d, i) => {
        s.dims[i].title = String(d?.title ?? '');
        (Array.isArray(d?.params) ? d.params : []).slice(0, MAX_N)
          .forEach((p, j) => { s.dims[i].params[j] = String(p ?? ''); });
      });
    }
    if (data.ideas && typeof data.ideas === 'object') {
      for (const [k, v] of Object.entries(data.ideas)) {
        if (/^\d-\d-\d$/.test(k) && v && typeof v.text === 'string') {
          s.ideas[k] = { text: v.text, starred: !!v.starred };
        }
      }
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

  const dimName = (d) => state.dims[d].title.trim() || `Dimension ${LETTERS[d]}`;
  const paramName = (d, i) => state.dims[d].params[i].trim() || `${LETTERS[d]}${i + 1}`;
  const key = (a, b, c) => `${a}-${b}-${c}`;

  /* ---------- Rendering ---------- */

  function renderSize() {
    const sel = $('size');
    sel.textContent = '';
    for (let n = MIN_N; n <= MAX_N; n++) {
      const o = el('option', null, `${n} × ${n} × ${n}`);
      o.value = n;
      sel.appendChild(o);
    }
    sel.value = state.n;
  }

  function renderDims() {
    const wrap = $('dims');
    wrap.textContent = '';
    for (let d = 0; d < 3; d++) {
      const box = el('div', 'dim');
      box.dataset.d = d;
      box.appendChild(el('div', 'tag', `Dimension ${LETTERS[d]}`));

      const title = el('input');
      title.type = 'text';
      title.className = 'title';
      title.placeholder = 'Theme, e.g. ' + ['Users', 'Materials', 'Context'][d];
      title.value = state.dims[d].title;
      title.setAttribute('aria-label', `Dimension ${LETTERS[d]} theme`);
      title.addEventListener('input', () => { state.dims[d].title = title.value; save(); renderMatrix(); renderIdeas(); });
      box.appendChild(title);

      const ol = el('ol');
      for (let i = 0; i < state.n; i++) {
        const li = el('li');
        const inp = el('input');
        inp.type = 'text';
        inp.placeholder = `Option ${i + 1}`;
        inp.value = state.dims[d].params[i];
        inp.setAttribute('aria-label', `${LETTERS[d]} option ${i + 1}`);
        inp.addEventListener('input', () => { state.dims[d].params[i] = inp.value; save(); renderMatrix(); renderIdeas(); });
        li.appendChild(inp);
        ol.appendChild(li);
      }
      box.appendChild(ol);
      wrap.appendChild(box);
    }
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, text) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  const clip = (s, m = 12) => (s.length > m ? s.slice(0, m - 1) + '…' : s);

  function renderCube() {
    const svg = $('cube');
    svg.textContent = '';
    const n = state.n;
    const u = Math.min(64, 300 / n);       // pitch of one cell
    const K = Math.cos(Math.PI / 6) * u;   // horizontal step
    const S = 0.5 * u;                     // vertical step
    const w = 0.7;                         // cube size as fraction of pitch (gaps reveal the interior)
    const g = (1 - w) / 2;
    // a runs to the front-left, b to the front-right, c upwards
    const P = (a, b, c) => [((b - a) * K).toFixed(1), (((a + b) * S) - c * u).toFixed(1)].join(',');

    const mx = 170, top = 30, bottom = 30;
    const halfW = n * K;
    svg.setAttribute('viewBox', `${-halfW - mx} ${-n * u - top} ${2 * (halfW + mx)} ${2 * n * u + top + bottom}`);

    // Cubes, painted back to front
    let filled = 0;
    for (let c = 0; c < n; c++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const idea = state.ideas[key(a, b, c)];
      const has = !!(idea && idea.text.trim());
      if (has) filled++;
      const a0 = a + g, a1 = a + g + w, b0 = b + g, b1 = b + g + w, c0 = c + g, c1 = c + g + w;
      const label = `${paramName(0, a)} + ${paramName(1, b)} + ${paramName(2, c)}`;
      const grp = svgEl('g', {
        class: 'cb' + (has ? ' filled' : '') + (has && idea.starred ? ' starred' : ''),
        tabindex: 0, role: 'button', 'aria-label': label + (has ? ': ' + idea.text : ': empty')
      });
      grp.appendChild(svgEl('title', {}, label + (has ? '\n' + idea.text : '')));
      grp.appendChild(svgEl('polygon', { class: 'l', points: [P(a1, b0, c0), P(a1, b1, c0), P(a1, b1, c1), P(a1, b0, c1)].join(' ') }));
      grp.appendChild(svgEl('polygon', { class: 'r', points: [P(a0, b1, c0), P(a1, b1, c0), P(a1, b1, c1), P(a0, b1, c1)].join(' ') }));
      grp.appendChild(svgEl('polygon', { class: 't', points: [P(a0, b0, c1), P(a1, b0, c1), P(a1, b1, c1), P(a0, b1, c1)].join(' ') }));
      grp.addEventListener('click', () => openEditor(a, b, c));
      grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(a, b, c); } });
      svg.appendChild(grp);
    }

    // Axis labels
    const xy = (a, b, c) => P(a, b, c).split(',').map(Number);
    for (let i = 0; i < n; i++) {
      // B options along the front-left edge
      let [x, y] = xy(n + 0.15, i + 0.5, 0);
      svg.appendChild(svgEl('text', { x: x - 4, y: y + 4, 'text-anchor': 'end', class: 'ax-1' }, clip(paramName(1, i))));
      // A options along the front-right edge
      [x, y] = xy(i + 0.5, n + 0.15, 0);
      svg.appendChild(svgEl('text', { x: x + 4, y: y + 4, 'text-anchor': 'start', class: 'ax-0' }, clip(paramName(0, i))));
      // C options up the left-hand vertical
      [x, y] = xy(n, 0, i + 0.5);
      svg.appendChild(svgEl('text', { x: x - 8, y: y + 4, 'text-anchor': 'end', class: 'ax-2' }, clip(paramName(2, i))));
    }
    let [x, y] = xy(n + 0.7, n / 2, 0);
    svg.appendChild(svgEl('text', { x: x - 6, y: y + 24, 'text-anchor': 'end', class: 'axis ax-1' }, clip(dimName(1), 22) + ' (B)'));
    [x, y] = xy(n / 2, n + 0.7, 0);
    svg.appendChild(svgEl('text', { x: x + 6, y: y + 24, 'text-anchor': 'start', class: 'axis ax-0' }, clip(dimName(0), 22) + ' (A)'));
    [x, y] = xy(n, 0, n);
    svg.appendChild(svgEl('text', { x: x - 8, y: y - 14, 'text-anchor': 'end', class: 'axis ax-2' }, clip(dimName(2), 22) + ' (C)'));

    const total = n * n * n;
    $('cube-stats').textContent = `${filled} of ${total} combinations explored (${Math.round(filled / total * 100)}%)`;
  }

  function renderMatrix() {
    renderCube();
    const wrap = $('matrix');
    wrap.textContent = '';
    const n = state.n;
    for (let c = 0; c < n; c++) {
      const slice = el('div', 'slice');
      const h = el('h3', null, paramName(2, c));
      h.appendChild(el('span', null, ` · ${dimName(2)}`));
      slice.appendChild(h);

      const table = el('table', 'grid');
      const thead = el('thead');
      const hr = el('tr');
      const corner = el('th');
      corner.textContent = '';
      hr.appendChild(corner);
      for (let b = 0; b < n; b++) hr.appendChild(el('th', null, paramName(1, b)));
      thead.appendChild(hr);
      table.appendChild(thead);

      const tbody = el('tbody');
      for (let a = 0; a < n; a++) {
        const tr = el('tr');
        tr.appendChild(el('th', null, paramName(0, a)));
        tr.firstChild.scope = 'row';
        for (let b = 0; b < n; b++) {
          const td = el('td');
          const btn = el('button', 'cell');
          btn.type = 'button';
          const idea = state.ideas[key(a, b, c)];
          const label = `${paramName(0, a)} + ${paramName(1, b)} + ${paramName(2, c)}`;
          btn.setAttribute('aria-label', label + (idea ? ': ' + idea.text : ': empty'));
          btn.title = label;
          if (idea && idea.text.trim()) {
            btn.classList.add('filled');
            if (idea.starred) btn.appendChild(el('span', 'star', '★ '));
            btn.appendChild(el('span', 'txt', idea.text));
          } else {
            btn.textContent = '+';
          }
          btn.addEventListener('click', () => openEditor(a, b, c));
          td.appendChild(btn);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      slice.appendChild(table);
      wrap.appendChild(slice);
    }
  }

  function renderIdeas() {
    const list = $('ideas');
    list.textContent = '';
    const starredOnly = $('starred-only').checked;
    const items = [];
    for (let a = 0; a < state.n; a++)
      for (let b = 0; b < state.n; b++)
        for (let c = 0; c < state.n; c++) {
          const idea = state.ideas[key(a, b, c)];
          if (idea && idea.text.trim()) items.push({ a, b, c, idea });
        }
    $('idea-count').textContent = items.length ? `(${items.length})` : '';
    const shown = starredOnly ? items.filter((i) => i.idea.starred) : items;
    if (!shown.length) {
      const li = el('li', 'empty', items.length ? 'No starred ideas yet.' : 'No ideas yet. Click a cell in the matrix to add one.');
      li.style.cursor = 'default';
      list.appendChild(li);
      return;
    }
    for (const { a, b, c, idea } of shown) {
      const li = el('li');
      const chips = el('div', 'chips');
      [[0, a], [1, b], [2, c]].forEach(([d, i]) => chips.appendChild(el('span', 'chip ' + CLASSES[d], paramName(d, i))));
      if (idea.starred) chips.appendChild(el('span', 'chip', '★'));
      li.appendChild(chips);
      li.appendChild(el('p', null, idea.text));
      li.addEventListener('click', () => openEditor(a, b, c));
      list.appendChild(li);
    }
  }

  function renderAll() {
    $('goal').value = state.goal;
    renderSize();
    renderDims();
    renderMatrix();
    renderIdeas();
  }

  /* ---------- Editor dialog ---------- */

  function openEditor(a, b, c) {
    editing = [a, b, c];
    const combo = $('editor-combo');
    combo.textContent = '';
    [[0, a], [1, b], [2, c]].forEach(([d, i]) => {
      const li = el('li', CLASSES[d]);
      li.appendChild(el('small', null, dimName(d)));
      li.appendChild(document.createTextNode(paramName(d, i)));
      combo.appendChild(li);
    });
    const idea = state.ideas[key(a, b, c)] || { text: '', starred: false };
    $('idea-text').value = idea.text;
    $('idea-star').checked = idea.starred;
    $('editor').showModal();
    $('idea-text').focus();
  }

  function commitEditor() {
    if (!editing) return;
    const k = key(...editing);
    const text = $('idea-text').value;
    if (text.trim()) state.ideas[k] = { text, starred: $('idea-star').checked };
    else delete state.ideas[k];
    editing = null;
    save();
    renderMatrix();
    renderIdeas();
  }

  /* ---------- Events ---------- */

  $('goal').addEventListener('input', (e) => { state.goal = e.target.value; save(); });

  $('size').addEventListener('change', (e) => {
    const n = parseInt(e.target.value, 10);
    const hidden = Object.entries(state.ideas).filter(([k, v]) => v.text.trim() && k.split('-').some((x) => +x >= n)).length;
    if (hidden && !confirm(`${hidden} idea(s) sit outside the smaller matrix. They will be hidden but kept if you enlarge it again. Continue?`)) {
      e.target.value = state.n;
      return;
    }
    state.n = n;
    save();
    renderDims();
    renderMatrix();
    renderIdeas();
  });

  $('starred-only').addEventListener('change', renderIdeas);

  $('editor').addEventListener('close', commitEditor);
  $('idea-clear').addEventListener('click', () => {
    $('idea-text').value = '';
    $('idea-star').checked = false;
    $('editor').close();
  });
  // Click on backdrop closes (and saves)
  $('editor').addEventListener('click', (e) => { if (e.target === $('editor')) $('editor').close(); });

  $('btn-print').addEventListener('click', () => window.print());

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'morphological-matrix.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace your current matrix with the imported file?')) return;
      state = normalise(data);
      save();
      renderAll();
    } catch (_) {
      alert('Sorry, that file could not be read as a matrix export.');
    }
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Clear everything and start a new matrix? Export first if you want a copy.')) return;
    state = blankState();
    save();
    renderAll();
  });

  renderAll();
})();
