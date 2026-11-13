(() => {
  'use strict';

  const STORAGE_KEY = 'ideation-tools.bisociations.v1';
  const MAX_WORDS = 7, MIN_WORDS = 6, MAX_ROUNDS = 200;

  /* ---------- Noun pool ---------- */

  const NOUNS = (
    'accordion,acorn,airport,alarm clock,alligator,anchor,anvil,apron,archway,avalanche,backpack,bagpipe,balloon,bandage,barcode,barn,barrel,basement,bathtub,battery,beehive,bell,bicycle,blanket,boomerang,bottle,bridge,broom,bubble,bucket,bulldozer,butterfly,button,cactus,cage,camel,candle,canyon,carousel,castle,caterpillar,cathedral,chainsaw,chameleon,cheese,chimney,circus,clock tower,cloud,coconut,compass,conveyor belt,cork,crane,crayon,crocodile,crown,cupboard,curtain,dandelion,desert,diamond,dinosaur,doorbell,drawbridge,dragonfly,drum,dustbin,eagle,earthquake,eggshell,elevator,envelope,escalator,eyelash,factory,feather,ferry,fingerprint,fireworks,fishing net,flag,flashlight,fog,fossil,fountain,fridge,frying pan,galaxy,garage,garden hose,glacier,glove,goldfish,gramophone,grasshopper,hammock,harbour,harp,haystack,helicopter,hedgehog,honeycomb,hourglass,igloo,iceberg,island,jellyfish,jigsaw,kettle,keyhole,kite,knot,labyrinth,ladder,lantern,laundrette,lava,lawnmower,lemon,library,lighthouse,lightning,llama,lock,magnet,mailbox,map,marble,mattress,megaphone,meteor,microscope,mirror,mitten,monsoon,moss,motorway,mountain,mousetrap,museum,mushroom,needle,nest,notebook,octopus,orchard,ostrich,oven,padlock,paintbrush,parachute,parrot,passport,peacock,pebble,pendulum,penguin,piano,pillow,pirate,playground,plug,pocket,porcupine,postcard,pyramid,quicksand,rainbow,raincoat,razor,refinery,revolving door,rhinoceros,ribbon,river,rocket,roller coaster,rope,rowing boat,rubber duck,rust,sandcastle,saucepan,scaffolding,scarecrow,scissors,seesaw,shadow,shipwreck,shoelace,skateboard,sledge,slug,snail,snowglobe,sofa,spider web,sponge,staircase,stethoscope,submarine,suitcase,sundial,swamp,swing,tadpole,tambourine,tattoo,teapot,telescope,tent,thermometer,thunderstorm,toaster,tornado,tractor,traffic light,trampoline,treasure chest,treehouse,trombone,tunnel,turtle,umbrella,vacuum cleaner,velcro,vending machine,violin,volcano,waffle,wagon,waterfall,weathervane,wheelbarrow,whistle,windmill,windowsill,wizard,xylophone,yo-yo,zebra,zipper'
  ).split(',');

  /* ---------- Helpers ---------- */

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const rand = (n) => Math.floor(Math.random() * n);

  const blankWord = (text = '') => ({ text, locked: false });
  const blankEntry = () => ({ flow: '', idea: '', starred: false });

  /* Draw n distinct nouns, avoiding anything in `avoid` (lower-cased). */
  function drawNouns(n, avoid) {
    const taken = new Set(avoid.map((w) => w.trim().toLowerCase()));
    const pool = NOUNS.filter((w) => !taken.has(w));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(rand(pool.length), 1)[0]);
    return out;
  }

  const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function blankState() {
    return {
      concept: '', count: MAX_WORDS, round: 1,
      words: drawNouns(MAX_WORDS, []).map((t) => blankWord(t)),
      entries: Array.from({ length: MAX_WORDS }, blankEntry),
      history: []
    };
  }

  /* ---------- State ---------- */

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (_) { /* storage unavailable or corrupt */ }
    return blankState();
  }

  const str = (v, max = 20000) => String(v ?? '').slice(0, max);

  function normalise(data) {
    if (!data || typeof data !== 'object') return blankState();
    const count = +data.count === MIN_WORDS ? MIN_WORDS : MAX_WORDS;
    const s = { concept: str(data.concept), count, round: 1, words: [], entries: [], history: [] };
    const rn = parseInt(data.round, 10);
    s.round = Number.isInteger(rn) && rn > 0 ? Math.min(rn, 100000) : 1;
    for (let i = 0; i < MAX_WORDS; i++) {
      const w = Array.isArray(data.words) ? data.words[i] : null;
      s.words.push({ text: str(w?.text, 60), locked: !!w?.locked });
      const e = Array.isArray(data.entries) ? data.entries[i] : null;
      s.entries.push({ flow: str(e?.flow), idea: str(e?.idea, 2000), starred: !!e?.starred });
    }
    if (Array.isArray(data.history)) {
      data.history.slice(0, MAX_ROUNDS).forEach((h) => {
        if (!h || !Array.isArray(h.items)) return;
        const rnd = parseInt(h.round, 10);
        s.history.push({
          round: Number.isInteger(rnd) && rnd > 0 ? rnd : s.history.length + 1,
          concept: str(h.concept),
          items: h.items.slice(0, MAX_WORDS).map((it) => ({
            word: str(it?.word, 60), flow: str(it?.flow), idea: str(it?.idea, 2000), starred: !!it?.starred
          }))
        });
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

  const conceptLabel = (c) => c.trim() || 'your design';

  /* ---------- Words ---------- */

  const wordInputs = [];

  function renderWords() {
    const ol = $('words');
    ol.replaceChildren();
    wordInputs.length = 0;
    for (let i = 0; i < state.count; i++) {
      const w = state.words[i];
      const li = el('li', 'word' + (w.locked ? ' locked' : ''));
      const input = el('input');
      input.type = 'text';
      input.value = w.text;
      input.maxLength = 60;
      input.placeholder = 'type a noun';
      input.setAttribute('aria-label', `Word ${i + 1}`);
      input.addEventListener('input', () => {
        w.text = input.value;
        updateCard(i);
        renderIdeas();
        save();
      });
      wordInputs.push(input);

      const lock = el('button', null, w.locked ? '🔒' : '🔓');
      lock.type = 'button';
      lock.title = 'Lock this word so Generate leaves it alone';
      lock.setAttribute('aria-label', `Lock word ${i + 1}`);
      lock.setAttribute('aria-pressed', String(w.locked));
      lock.addEventListener('click', () => {
        w.locked = !w.locked;
        lock.textContent = w.locked ? '🔒' : '🔓';
        lock.setAttribute('aria-pressed', String(w.locked));
        li.classList.toggle('locked', w.locked);
        save();
      });

      const roll = el('button', null, '🎲');
      roll.type = 'button';
      roll.title = 'Replace just this word with a random noun';
      roll.setAttribute('aria-label', `Replace word ${i + 1} with a random noun`);
      roll.addEventListener('click', () => {
        const used = state.words.slice(0, state.count).map((x) => x.text);
        const [n] = drawNouns(1, used);
        if (!n) return;
        w.text = n;
        input.value = n;
        updateCard(i);
        renderIdeas();
        save();
      });

      li.append(input, lock, roll);
      ol.append(li);
    }
  }

  function generateWords() {
    const slots = [];
    for (let i = 0; i < state.count; i++) if (!state.words[i].locked) slots.push(i);
    const keep = state.words.slice(0, state.count).filter((w) => w.locked).map((w) => w.text);
    const fresh = drawNouns(slots.length, keep);
    slots.forEach((i, k) => { state.words[i].text = fresh[k] ?? ''; });
    save();
    renderWords();
    updateAllCards();
    renderIdeas();
  }

  /* ---------- Collision cards ---------- */

  const cardRefs = [];

  function renderCards() {
    const host = $('cards');
    host.replaceChildren();
    cardRefs.length = 0;
    for (let i = 0; i < state.count; i++) {
      const e = state.entries[i];
      const card = el('section', 'card');
      card.id = 'card-' + i;

      const h = el('h3', 'collision');
      const n = el('span', 'n', `${i + 1} / ${state.count}`);
      const concept = el('span', 'concept');
      const x = el('span', 'x', '×');
      x.setAttribute('aria-label', 'collides with');
      const noun = el('span', 'noun');
      h.append(n, concept, x, noun);

      const flow = el('textarea', 'flow');
      flow.rows = 6;
      flow.value = e.flow;
      flow.setAttribute('aria-label', `Stream of consciousness for word ${i + 1}`);
      flow.addEventListener('input', () => { e.flow = flow.value; save(); });

      const row = el('div', 'idea-row');
      const lab = el('label', 'lab', 'The idea:');
      const idea = el('input');
      idea.type = 'text';
      idea.id = 'idea-' + i;
      lab.htmlFor = idea.id;
      idea.maxLength = 2000;
      idea.value = e.idea;
      idea.placeholder = 'The concept this collision gave you';
      idea.addEventListener('input', () => {
        e.idea = idea.value;
        card.classList.toggle('done', !!e.idea.trim());
        renderIdeas();
        save();
      });
      const starLab = el('label', 'star');
      const star = el('input');
      star.type = 'checkbox';
      star.checked = e.starred;
      star.addEventListener('change', () => { e.starred = star.checked; renderIdeas(); save(); });
      starLab.append(star, document.createTextNode(' ★ Best'));
      row.append(lab, idea, starLab);

      card.append(h, flow, row);
      host.append(card);
      cardRefs.push({ card, concept, noun, flow });
      card.classList.toggle('done', !!e.idea.trim());
    }
    updateAllCards();
  }

  function updateCard(i) {
    const r = cardRefs[i];
    if (!r) return;
    const w = state.words[i].text.trim();
    r.concept.textContent = capitalise(conceptLabel(state.concept));
    r.noun.textContent = w || '(add a word)';
    r.card.classList.toggle('skip', !w);
    r.flow.placeholder = w
      ? `Start writing: how is "${conceptLabel(state.concept)}" like a ${w}? What would a ${w} do to it? Don't stop…`
      : 'Add a word in step 1 first.';
  }
  const updateAllCards = () => cardRefs.forEach((_, i) => updateCard(i));

  /* ---------- Ideas ---------- */

  function renderIdeas() {
    const ol = $('ideas');
    ol.replaceChildren();
    let filled = 0;
    for (let i = 0; i < state.count; i++) {
      const w = state.words[i].text.trim();
      const e = state.entries[i];
      const idea = e.idea.trim();
      if (idea) filled++;
      const li = el('li', 'bi' + (e.starred && idea ? ' starred' : ''));
      const chips = el('div', 'chips');
      chips.append(el('span', 'chip a', w || '(no word)'));
      if (e.starred && idea) chips.append(el('span', 'mark', '★'));
      li.append(chips);
      if (idea) li.append(el('p', null, idea));
      else li.append(el('p', 'none', 'No idea yet. Click to go to its collision.'));
      li.addEventListener('click', () => {
        const input = $('idea-' + i);
        if (!input) return;
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        input.focus({ preventScroll: true });
      });
      ol.append(li);
    }
    $('idea-count').textContent = `(${filled} of ${state.count})`;
    $('btn-next').disabled = filled === 0;
  }

  /* ---------- Earlier rounds ---------- */

  function renderHistory() {
    const only = $('starred-only').checked;
    const host = $('history');
    host.replaceChildren();
    $('history-panel').hidden = !state.history.length;
    $('history-count').textContent = state.history.length ? `(${state.history.length})` : '';
    state.history.forEach((h) => {
      const items = h.items.filter((it) => it.idea.trim() && (!only || it.starred));
      if (only && !items.length) return;
      const d = el('details');
      d.open = false;
      const sum = el('summary', null, `Round ${h.round}: ${capitalise(conceptLabel(h.concept))}`);
      const total = h.items.filter((it) => it.idea.trim()).length;
      const stars = h.items.filter((it) => it.idea.trim() && it.starred).length;
      sum.append(el('small', null, `${total} ideas${stars ? `, ${stars} ★` : ''}`));
      d.append(sum);
      const ol = el('ol');
      items.forEach((it) => {
        const li = el('li');
        const row = el('div', 'row');
        row.append(el('span', 'chip a', it.word || '(no word)'));
        const lab = el('label');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.checked = it.starred;
        cb.addEventListener('change', () => {
          it.starred = cb.checked;
          save();
          renderHistory();
          // keep the round open after the re-render
          const again = $('history').querySelectorAll('details')[state.history.indexOf(h)];
          if (again) again.open = true;
        });
        lab.append(cb, document.createTextNode('★'));
        row.append(lab);
        li.append(row, el('p', null, it.idea));
        if (it.flow.trim()) {
          const f = el('details');
          f.append(el('summary', null, 'Stream of consciousness'), el('p', null, it.flow));
          li.append(f);
        }
        ol.append(li);
      });
      d.append(ol);
      host.append(d);
    });
  }

  /* ---------- Next round ---------- */

  function openNext() {
    const list = $('next-ideas');
    list.replaceChildren();
    const opts = [];
    for (let i = 0; i < state.count; i++) {
      const e = state.entries[i];
      if (e.idea.trim()) opts.push({ idea: e.idea.trim(), word: state.words[i].text.trim(), starred: e.starred });
    }
    opts.sort((a, b) => b.starred - a.starred);
    const ta = $('next-concept');
    const pick = (text) => { ta.value = text; };
    opts.forEach((o, k) => {
      const lab = el('label');
      const r = el('input');
      r.type = 'radio';
      r.name = 'next-idea';
      r.addEventListener('change', () => pick(o.idea));
      const body = el('span');
      body.append(document.createTextNode((o.starred ? '★ ' : '') + o.idea), el('small', null, `from ${o.word || 'no word'}`));
      lab.append(r, body);
      list.append(lab);
      if (k === 0 && o.starred) { r.checked = true; }
    });
    const first = opts.find((o) => o.starred);
    pick(first ? first.idea : state.concept);
    $('next-dialog').showModal();
  }

  function startNext() {
    const concept = $('next-concept').value.trim() || state.concept;
    const mode = document.querySelector('input[name="next-words"]:checked').value;
    state.history.unshift({
      round: state.round,
      concept: state.concept,
      items: state.words.slice(0, state.count).map((w, i) => ({
        word: w.text.trim(), flow: state.entries[i].flow, idea: state.entries[i].idea, starred: state.entries[i].starred
      })).filter((it) => it.idea.trim() || it.flow.trim())
    });
    state.history = state.history.slice(0, MAX_ROUNDS);
    state.round += 1;
    state.concept = concept;
    state.entries = Array.from({ length: MAX_WORDS }, blankEntry);
    if (mode === 'new') {
      const fresh = drawNouns(MAX_WORDS, state.words.slice(0, state.count).map((w) => w.text));
      state.words = state.words.map((w, i) => ({ text: fresh[i] ?? '', locked: false }));
    } else if (mode === 'empty') {
      state.words = state.words.map(() => blankWord());
    }
    save();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Events ---------- */

  $('concept').addEventListener('input', (e) => {
    state.concept = e.target.value;
    updateAllCards();
    save();
  });
  $('count').addEventListener('change', (e) => {
    state.count = +e.target.value === MIN_WORDS ? MIN_WORDS : MAX_WORDS;
    save();
    renderWords();
    renderCards();
    renderIdeas();
  });
  $('btn-random').addEventListener('click', generateWords);
  $('btn-clear-words').addEventListener('click', () => {
    state.words.forEach((w) => { w.text = ''; w.locked = false; });
    save();
    renderWords();
    updateAllCards();
    renderIdeas();
    if (wordInputs[0]) wordInputs[0].focus();
  });
  $('btn-next').addEventListener('click', openNext);
  $('next-cancel').addEventListener('click', () => $('next-dialog').close('cancel'));
  $('next-dialog').addEventListener('click', (e) => { if (e.target === $('next-dialog')) $('next-dialog').close('cancel'); });
  $('next-dialog').addEventListener('close', () => {
    if ($('next-dialog').returnValue === 'go') startNext();
    $('next-dialog').returnValue = '';
  });
  $('starred-only').addEventListener('change', renderHistory);
  $('btn-print').addEventListener('click', () => {
    $('history').querySelectorAll('details').forEach((d) => { d.open = true; });
    window.print();
  });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bisociations.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace your current work with the imported file?')) return;
      state = normalise(data);
      save();
      renderAll();
    } catch (_) {
      alert('Sorry, that file could not be read as a bisociations export.');
    }
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Clear everything and start again with new random words? Export first if you want a copy.')) return;
    state = blankState();
    save();
    renderAll();
  });

  function renderAll() {
    $('concept').value = state.concept;
    $('count').value = String(state.count);
    $('round-badge').textContent = `Round ${state.round}`;
    renderWords();
    renderCards();
    renderIdeas();
    renderHistory();
  }

  renderAll();
})();
