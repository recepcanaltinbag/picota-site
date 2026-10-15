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
    cell = Math.min(cell, 92);
    const rows = Math.ceil(n / cols);
    const ox = (W - Math.min(cols, n) * cell) / 2, oy = (H - rows * cell) / 2;
    const m = new Map();
    alive.forEach((d, i) => m.set(d, { x: ox + (i % cols + 0.5) * cell, y: oy + (Math.floor(i / cols) + 0.5) * cell, r: Math.max(1.6, cell * 0.5) }));
    return m;
  }
  // Stage 0 is drawn as a tangle, the way the candidates come out of an assembly graph:
  // points strung along chains that cross and share nodes, each joined to its nearest neighbours.
  const gx = new Float32Array(N), gy = new Float32Array(N);
  (function tangle() {
    let d = 0;
    while (d < N) {
      let x = 0.1 + 0.8 * rand(), y = 0.1 + 0.8 * rand(), ang = rand() * 2 * Math.PI;
      const len = 12 + Math.floor(rand() * 30);
      for (let j = 0; j < len && d < N; j++, d++) {
        ang += (rand() - 0.5) * 1.3;
        let nx = x + Math.cos(ang) * 0.022, ny = y + Math.sin(ang) * 0.034;
        // bounce off the frame rather than stopping on it, so chains turn back inside
        if (nx < 0.03 || nx > 0.97) { ang = Math.PI - ang; nx = x + Math.cos(ang) * 0.022; }
        if (ny < 0.04 || ny > 0.96) { ang = -ang; ny = y + Math.sin(ang) * 0.034; }
        x = Math.min(0.97, Math.max(0.03, nx)); y = Math.min(0.96, Math.max(0.04, ny));
        gx[d] = x; gy[d] = y;
      }
    }
  })();
  const edges = [];
  (function neighbours() {
    for (let d = 0; d < N; d++) {
      let b1 = -1, b2 = -1, d1 = 1e9, d2 = 1e9;
      for (let e = 0; e < N; e++) {
        if (e === d) continue;
        const q = (gx[d] - gx[e]) ** 2 + (gy[d] - gy[e]) ** 2;
        if (q < d1) { d2 = d1; b2 = b1; d1 = q; b1 = e; } else if (q < d2) { d2 = q; b2 = e; }
      }
      if (b1 > d) edges.push([d, b1]);
      if (b2 > d && rand() < 0.6) edges.push([d, b2]);
    }
  })();
  function layoutAll() {
    for (let s = 0; s <= STAGES.length; s++) pos[s] = layout(s);
    const pad = 14, r0 = [...pos[0].values()][0].r;
    for (let d = 0; d < N; d++) pos[0].set(d, { x: pad + gx[d] * (W - 2 * pad), y: pad + gy[d] * (H - 2 * pad), r: r0 });
  }

  let stage = 0, t = 1;   // t: progress of the move into `stage`
  function colours() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    return { live: v('--muted'), gone: v('--done'), ok: v('--good'), other: v('--host'), is: v('--is'), ink: v('--ink'), edge: v('--edge') };
  }
  // Each candidate is drawn as a small cycle: a ring with its IS node, sized by the cycle's
  // length. The size filter's rejects are the rings that are too small or too large; the
  // survivors close as IS + cargo, and a walker runs round the ones big enough to show it.
  const sf = Array.from({ length: N }, (_, d) =>
    fate[d] === 2 ? (rand() < 0.5 ? 0.42 : 1.12) : fate[d] === STAGES.length ? 0.92 : 0.62 + 0.3 * rand());
  const phase0 = Array.from({ length: N }, () => rand() * 2 * Math.PI);

  function glyph(d, x, y, r, c, state, now) {
    const R = r * 0.74 * sf[d], lw = Math.min(4.5, Math.max(1, r * 0.2));
    if (R < 2.2) { ctx.fillStyle = state === 'gone' ? c.gone : c.live; ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, R), 0, 2 * Math.PI); ctx.fill(); return; }
    const top = -Math.PI / 2, isArc = 0.55;
    ctx.lineWidth = lw; ctx.lineCap = 'butt';
    if (state === 'gone') {
      ctx.strokeStyle = c.gone; ctx.beginPath(); ctx.arc(x, y, R, 0, 2 * Math.PI); ctx.stroke(); return;
    }
    const resolved = state === 'final';
    // cargo (or, before scoring decides, the rest of the cycle)
    ctx.strokeStyle = resolved ? (complete.has(d) ? c.ok : c.other) : c.live;
    ctx.beginPath(); ctx.arc(x, y, R, top + isArc / 2, top - isArc / 2 + 2 * Math.PI); ctx.stroke();
    // the collapsed IS node the cycle runs through
    ctx.strokeStyle = c.is; ctx.lineWidth = lw * 1.5;
    ctx.beginPath(); ctx.arc(x, y, R, top - isArc / 2, top + isArc / 2); ctx.stroke();
    if (R > 9) {   // a walker going round: the path leaves the IS and comes back into it
      const a = phase0[d] + now / 900;
      ctx.fillStyle = c.ink;
      ctx.beginPath(); ctx.arc(x + R * Math.cos(a), y + R * Math.sin(a), Math.max(1.6, lw * 0.55), 0, 2 * Math.PI); ctx.fill();
    }
    if (resolved && complete.has(d) && R > 12) {
      ctx.strokeStyle = c.ok; ctx.lineWidth = Math.max(2, lw * 0.6); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - R * 0.32, y + R * 0.02); ctx.lineTo(x - R * 0.06, y + R * 0.28); ctx.lineTo(x + R * 0.36, y - R * 0.26); ctx.stroke();
    }
  }

  const cx = new Float32Array(N), cy = new Float32Array(N), cr = new Float32Array(N);
  function draw(now = performance.now()) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const c = colours();
    const from = pos[Math.max(0, stage - 1)], to = pos[stage], e = ease(t);
    const final = stage === STAGES.length;
    const graphness = stage === 0 ? 1 : stage === 1 ? 1 - e : 0;   // the tangle dissolves on the first move
    for (let d = 0; d < N; d++) {
      const a = from.get(d), b = to.get(d);
      cr[d] = 0;
      if (!a && !b) continue;
      if (b && a) { cx[d] = a.x + (b.x - a.x) * e; cy[d] = a.y + (b.y - a.y) * e; cr[d] = a.r + (b.r - a.r) * e; }
      else if (b) { cx[d] = b.x; cy[d] = b.y; cr[d] = b.r; }
      else { cx[d] = a.x; cy[d] = a.y + 14 * e; cr[d] = a.r * (1 - 0.4 * e); }
    }
    if (graphness > 0) {
      ctx.globalAlpha = 0.55 * graphness; ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [p, q] of edges) { ctx.moveTo(cx[p], cy[p]); ctx.lineTo(cx[q], cy[q]); }
      ctx.stroke();
    }
    for (let d = 0; d < N; d++) {
      const a = from.get(d), b = to.get(d);
      if (!a && !b) continue;
      if (final && !a) continue;
      const state = b ? (final ? 'final' : 'live') : 'gone';
      ctx.globalAlpha = state === 'gone' ? (1 - e) * 0.8 : 1;
      if (graphness > 0.5) {         // still a graph node
        ctx.fillStyle = state === 'gone' ? c.gone : c.live;
        ctx.beginPath(); ctx.arc(cx[d], cy[d], 2.1, 0, 2 * Math.PI); ctx.fill();
      } else glyph(d, cx[d], cy[d], cr[d], c, state, now);
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

  let raf = null, timer = null, playing = false, visible = true, tweening = false;
  (function idle(now) {             // redraw between moves so the walkers keep going round
    if (visible && !tweening && stage >= 3) draw(now);
    requestAnimationFrame(idle);
  })(performance.now());
  function goTo(s, dur, done) {
    cancelAnimationFrame(raf);
    stage = s; t = 0; label(); tweening = true;
    const t0 = performance.now();
    (function tick(now) {
      t = Math.min(1, (now - t0) / dur);
      draw(now); label();
      if (t < 1) raf = requestAnimationFrame(tick); else { tweening = false; if (done) done(); }
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
  function stop() { playing = false; clearTimeout(timer); cancelAnimationFrame(raf); tweening = false; t = 1; draw(); label(); playBtn.textContent = '▶ Play'; }
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
