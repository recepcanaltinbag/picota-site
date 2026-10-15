/* PICOTA — candidate elimination, one dot per candidate */
(function () {
  'use strict';

  const STAGES = [
    { name: 'Paths enumerated', n: 1023, why: 'Every path between the two ends of each back-edge the search found.' },
    { name: 'Path deduplication', n: 587, removed: 436, why: 'Rotations and reverse-complement traversals of one cycle.' },
    { name: 'Size and component filter', n: 30, removed: 557, why: 'Outside 1–40 kb, or threading more than 25 graph components.' },
    { name: 'Sequence deduplication', n: 21, removed: 9, why: 'Near-identical candidates, by k-mer similarity.' },
    { name: 'Scoring', n: 11, removed: 10, why: 'Prodigal, four BLAST searches and score3: below 50 is not reported.' },
  ];
  const COMPLETE = 8;          // complete elements among the 11 reported
  const N = STAGES[0].n;
  const HOLD = 1700, MOVE = 1100;

  const canvas = document.getElementById('elim-canvas');
  const ctx = canvas.getContext('2d');
  const stepsEl = document.getElementById('elim-steps');
  const nEl = document.getElementById('elim-n'), unitEl = document.getElementById('elim-unit'), whyEl = document.getElementById('elim-why');
  const bar = document.getElementById('elim-bar'), playBtn = document.getElementById('elim-play');
  const fmt = n => n.toLocaleString('en-US');
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  // Which stage removes each dot, decided once with a fixed seed so the picture is stable.
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const fate = new Array(N).fill(STAGES.length);       // survivors keep the last index
  const order = [...Array(N).keys()].sort(() => rand() - 0.5);
  let k = 0;
  STAGES.forEach((s, i) => { for (let j = 0; j < (s.removed || 0); j++) fate[order[k++]] = i; });
  const survivors = order.slice(k);                     // the 11 reported
  const complete = new Set(survivors.slice(0, COMPLETE));

  stepsEl.innerHTML = STAGES.map((s, i) => `<li><button class="elim-step" data-i="${i}"><span class="idea-n">${i + 1}</span><span><b>${s.name}</b><small>${fmt(s.n)}${s.removed ? ` <em>−${fmt(s.removed)}</em>` : ''}</small></span></button></li>`).join('')
    + `<li><button class="elim-step" data-i="${STAGES.length}"><span class="idea-n">✓</span><span><b>Complete elements</b><small>${COMPLETE} / ${COMPLETE}</small></span></button></li>`;
  const stepBtns = [...stepsEl.querySelectorAll('.elim-step')];

  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    layoutAll(); draw();
  }

  // Packed grid positions for the dots still in at stage s; cells grow as the crowd thins.
  const pos = [];   // per stage: Map dot -> {x, y, r}
  function layout(s) {
    const alive = [];
    // a dot whose fate is i is removed at stage i; the last view keeps the scoring survivors
    const upto = Math.min(s, STAGES.length - 1);
    for (let d = 0; d < N; d++) if (fate[d] > upto) alive.push(d);
    const n = alive.length, pad = 8;
    let cell = Math.sqrt(((W - 2 * pad) * (H - 2 * pad)) / n);
    let cols = Math.max(1, Math.floor((W - 2 * pad) / cell));
    while (Math.ceil(n / cols) * cell > H - 2 * pad) { cell *= 0.96; cols = Math.max(1, Math.floor((W - 2 * pad) / cell)); }
    cell = Math.min(cell, 64);
    const rows = Math.ceil(n / cols);
    const ox = (W - Math.min(cols, n) * cell) / 2, oy = (H - rows * cell) / 2;
    const m = new Map();
    alive.forEach((d, i) => m.set(d, { x: ox + (i % cols + 0.5) * cell, y: oy + (Math.floor(i / cols) + 0.5) * cell, r: Math.max(1.6, cell * 0.36) }));
    return m;
  }
  function layoutAll() { for (let s = 0; s <= STAGES.length; s++) pos[s] = layout(s); }

  let stage = 0, t = 1;   // t: progress of the move into `stage`
  function colours() {
    const cs = getComputedStyle(document.documentElement);
    return { live: cs.getPropertyValue('--accent').trim(), gone: cs.getPropertyValue('--done').trim(), ok: cs.getPropertyValue('--good').trim() };
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const c = colours();
    const from = pos[Math.max(0, stage - 1)], to = pos[stage], e = ease(t);
    const final = stage === STAGES.length;
    for (let d = 0; d < N; d++) {
      const a = from.get(d), b = to.get(d);
      if (!a && !b) continue;
      let x, y, r, col, alpha = 1;
      if (b && a) { x = a.x + (b.x - a.x) * e; y = a.y + (b.y - a.y) * e; r = a.r + (b.r - a.r) * e; col = c.live; }
      else if (b) { x = b.x; y = b.y; r = b.r; col = c.live; }
      else { x = a.x; y = a.y + 14 * e; r = a.r * (1 - 0.5 * e); col = c.gone; alpha = 1 - e; }   // eliminated here
      if (final && b) col = complete.has(d) ? c.ok : c.live;
      if (stage === STAGES.length && !a) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
      if (final && b && complete.has(d) && r > 9 && t > 0.6) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath();
        ctx.moveTo(x - r * 0.38, y); ctx.lineTo(x - r * 0.08, y + r * 0.3); ctx.lineTo(x + r * 0.42, y - r * 0.32); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function label() {
    const final = stage === STAGES.length;
    const s = STAGES[Math.min(stage, STAGES.length - 1)];
    nEl.textContent = final ? `${COMPLETE} / ${COMPLETE}` : fmt(s.n);
    unitEl.textContent = final ? 'complete elements reported' : stage === 0 ? 'candidate paths' : 'candidates left';
    whyEl.innerHTML = final ? 'Every element known to be present is among the 11 reported cycles, whole.'
      : s.removed ? `<b>−${fmt(s.removed)}</b> ${s.why}` : s.why;
    stepBtns.forEach((b, i) => b.classList.toggle('on', i === stage));
    bar.style.width = (100 * (stage + t) / (STAGES.length + 1)).toFixed(1) + '%';
  }

  let raf = null, timer = null, playing = false, visible = true;
  function goTo(s, dur, done) {
    cancelAnimationFrame(raf);
    stage = s; t = 0; label();
    const t0 = performance.now();
    (function tick(now) {
      t = Math.min(1, (now - t0) / dur);
      draw(); label();
      if (t < 1) raf = requestAnimationFrame(tick); else if (done) done();
    })(t0);
  }
  function loop() {
    if (!playing) return;
    const next = stage + 1;
    if (next > STAGES.length) {
      timer = setTimeout(() => { if (!playing) return; canvas.style.opacity = 0;
        timer = setTimeout(() => { stage = 0; t = 1; draw(); label(); canvas.style.opacity = 1; timer = setTimeout(loop, HOLD); }, 450); }, HOLD * 1.6);
      return;
    }
    goTo(next, MOVE, () => { timer = setTimeout(loop, HOLD); });
  }
  function play() { if (playing) return; playing = true; playBtn.textContent = '❚❚ Pause'; timer = setTimeout(loop, 600); }
  function stop() { playing = false; clearTimeout(timer); cancelAnimationFrame(raf); t = 1; draw(); label(); playBtn.textContent = '▶ Play'; }
  playBtn.addEventListener('click', () => playing ? stop() : play());
  stepBtns.forEach(b => b.addEventListener('click', () => {
    stop(); goTo(+b.dataset.i, 700);
    timer = setTimeout(() => { if (visible) play(); }, 4000);
  }));
  new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    if (visible) play(); else stop();
  }), { threshold: 0.25 }).observe(canvas);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 120); });
  size(); label();
})();
