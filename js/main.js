/* PICOTA — interactive walkthrough */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = x => x * x * (3 - 2 * x);
  const fmt = n => n.toLocaleString('en-US');

  // Scoring constants, as shipped in config.yaml / scoringv4ProtBlast.py
  const CT_MEAN = 5850, CT_STD = 2586, MAX_Z = 20, THRESHOLD = 50, NOVEL_FLOOR = 0.30;
  const lengthGate = L => { const z = L < CT_MEAN ? 0 : (L - CT_MEAN) / CT_STD; return Math.max(0, 1 - Math.min(z, MAX_Z) / MAX_Z); };
  const componentFit = n => 1 / (1 + Math.abs(n - 2) / 12);

  /* ---------- theme ---------- */
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('picota-theme', root.dataset.theme); } catch (e) {}
  });

  /* ---------- element geometry: a line that bends into a ring ---------- */
  // The element (IS, cargo, IS) is a curve of fixed length with constant curvature
  // t / R. At t = 0 it is straight; at t = 1 it closes into a circle whose
  // circumference is IS + cargo, so the second IS lands exactly on the first.
  function elementGeometry(t, o) {
    const ring = 2 * Math.PI * o.R, isL = o.isFrac * ring, cargoL = ring - isL;
    const total = 2 * isL + cargoL, mid = total / 2;
    const k = t / o.R;
    const raw = s => {
      const u = s - mid;
      if (k < 1e-6) return { x: o.cx + u, y: 0, nx: 0, ny: -1 };
      const th = k * u;
      return { x: o.cx + Math.sin(th) / k, y: (1 - Math.cos(th)) / k, nx: Math.sin(th), ny: -Math.cos(th) };
    };
    // Keep the ends on the chromosome line while the middle rises.
    const yA = o.y0 - raw(total).y;
    const at = s => { const p = raw(s); p.y += yA; return p; };
    const sample = (a, b) => { const pts = [], n = Math.max(2, Math.ceil((b - a) / 4)); for (let i = 0; i <= n; i++) pts.push(at(a + (b - a) * i / n)); return pts; };
    return { is1: sample(0, isL), cargo: sample(isL, isL + cargoL), is2: sample(isL + cargoL, total), at, isL, cargoL, total };
  }
  const pathD = pts => 'M' + pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('L');
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) {
      if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- hero ring ---------- */
  (function hero() {
    const svg = document.getElementById('hero-ring');
    const o = { R: 96, isFrac: 0.17, cx: 160, y0: 268 };
    const g = elementGeometry(1, o);
    el('path', { d: 'M8,' + (g.is1[0].y + 22) + ' Q60,' + (g.is1[0].y + 22) + ' ' + g.is1[0].x + ',' + g.is1[0].y, style: 'stroke:var(--host);stroke-width:10;fill:none;stroke-linecap:round' }, svg);
    el('path', { d: 'M' + g.is2[g.is2.length - 1].x + ',' + g.is2[g.is2.length - 1].y + ' Q260,' + (g.is1[0].y + 22) + ' 312,' + (g.is1[0].y + 22), style: 'stroke:var(--host);stroke-width:10;fill:none;stroke-linecap:round' }, svg);
    el('path', { d: pathD(g.cargo), style: 'stroke:var(--cargo);stroke-width:16;fill:none' }, svg);
    el('path', { d: pathD(g.is1), style: 'stroke:var(--is);stroke-width:22;fill:none' }, svg);
    el('circle', { cx: o.cx, cy: o.y0 - o.R, r: o.R + 26, style: 'fill:none;stroke:var(--line);stroke-width:1.5;stroke-dasharray:3 7' }, svg);
    const walker = el('circle', { r: 6, style: 'fill:var(--accent);stroke:var(--surface);stroke-width:2.5' }, svg);
    el('text', { x: o.cx, y: o.y0 - o.R + 5, 'text-anchor': 'middle', class: 'svg-small', text: 'IS + cargo' }, svg);
    el('text', { x: o.cx, y: o.y0 + 34, 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--is)', text: 'IS ×2' }, svg);
    const ringPts = g.is1.concat(g.cargo);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = null;
    function frame(ts) {
      if (start === null) start = ts;
      const f = ((ts - start) / 6000) % 1;
      const p = ringPts[Math.floor(f * ringPts.length) % ringPts.length];
      walker.setAttribute('cx', p.x); walker.setAttribute('cy', p.y);
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- the idea: line → cycle ---------- */
  (function collapse() {
    const svg = document.getElementById('collapse-svg');
    const o = { R: 80, isFrac: 0.15, cx: 380, y0: 250 };
    const layer = el('g', {}, svg);
    const hostL = el('path', { style: 'stroke:var(--host);stroke-width:12;fill:none;stroke-linecap:round' }, layer);
    const hostR = el('path', { style: 'stroke:var(--host);stroke-width:12;fill:none;stroke-linecap:round' }, layer);
    const cargo = el('path', { style: 'stroke:var(--cargo);stroke-width:16;fill:none' }, layer);
    const is2 = el('path', { style: 'stroke:var(--is);stroke-width:16;fill:none' }, layer);
    const is1 = el('path', { style: 'stroke:var(--is);stroke-width:16;fill:none' }, layer);
    const arrows = el('g', {}, layer);
    const lIs1 = el('text', { 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--is)', text: 'IS' }, layer);
    const lIs2 = el('text', { 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--is)', text: 'IS' }, layer);
    const lCargo = el('text', { 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--cargo)', text: 'cargo · resistance / degradation genes' }, layer);
    const lHostL = el('text', { x: 14, 'text-anchor': 'start', class: 'svg-small', text: 'chromosome' }, layer);
    const lHostR = el('text', { x: 746, 'text-anchor': 'end', class: 'svg-small', text: 'chromosome' }, layer);
    const lNode = el('text', { 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--is)', text: 'one IS node · 2× read depth' }, layer);
    const lCycle = el('text', { 'text-anchor': 'middle', class: 'svg-small', text: 'one cycle' }, layer);

    // Reads: identical short bars over both IS copies
    const g0 = elementGeometry(0, o);
    const reads = el('g', {}, layer);
    [g0.is1, g0.is2].forEach(seg => {
      const x0 = seg[0].x, x1 = seg[seg.length - 1].x, w = x1 - x0;
      [[0.0, 0.55, -40], [0.3, 0.95, -50], [0.12, 0.7, -60], [0.45, 1.0, -70]].forEach(([a, b, dy]) =>
        el('rect', { x: x0 + a * w, y: o.y0 + dy, width: (b - a) * w, height: 5, rx: 2.5, style: 'fill:var(--ink-2);opacity:.55' }, reads));
    });
    const midIs1 = g0.is1[Math.floor(g0.is1.length / 2)].x, midIs2 = g0.is2[Math.floor(g0.is2.length / 2)].x;
    el('path', { d: `M${midIs1},${o.y0 - 78} C${midIs1},${o.y0 - 150} ${midIs2},${o.y0 - 150} ${midIs2},${o.y0 - 78}`, style: 'stroke:var(--accent);stroke-width:1.6;fill:none;stroke-dasharray:5 5' }, reads);
    el('text', { x: (midIs1 + midIs2) / 2, y: o.y0 - 138, 'text-anchor': 'middle', class: 'svg-label', style: 'fill:var(--accent)', text: 'identical sequence — which copy did a read come from?' }, reads);

    const steps = [...document.querySelectorAll('#collapse .idea-step')];
    const bar = document.getElementById('idea-bar');
    const playBtn = document.getElementById('idea-play');
    const STOPS = [0.15, 0.42, 1];

    function place(textEl, p, off) { textEl.setAttribute('x', (p.x + p.nx * off).toFixed(1)); textEl.setAttribute('y', (p.y + p.ny * off + 4).toFixed(1)); }
    // direction arrows along the element, so the traversal (and the way back into the IS) is visible
    function drawArrows(g, t) {
      arrows.innerHTML = '';
      const pts = g.cargo, n = 5;
      for (let i = 1; i <= n; i++) {
        const p = pts[Math.floor(i * (pts.length - 1) / (n + 1))], q = pts[Math.floor(i * (pts.length - 1) / (n + 1)) + 1];
        const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
        el('path', { d: 'M-5,-5 L3,0 L-5,5', transform: `translate(${p.x},${p.y}) rotate(${ang})`, style: `stroke:var(--surface);stroke-width:2.2;fill:none;opacity:${0.25 + 0.75 * t}` }, arrows);
      }
    }

    function render(prog) {
      const step = prog < 0.3 ? 0 : prog < 0.55 ? 1 : 2;
      steps.forEach((s, i) => { s.classList.toggle('on', i === step); s.setAttribute('aria-selected', i === step); });
      bar.style.width = (prog * 100).toFixed(1) + '%';
      const t = smooth(clamp((prog - 0.55) / 0.42));
      const g = elementGeometry(t, o);
      cargo.setAttribute('d', pathD(g.cargo));
      is1.setAttribute('d', pathD(g.is1));
      is2.setAttribute('d', pathD(g.is2));
      is1.style.strokeWidth = 16 + 6 * t;
      is2.style.opacity = 1 - smooth(clamp((t - 0.75) / 0.25));
      drawArrows(g, t);
      const s = g.is1[0], e = g.is2[g.is2.length - 1];
      const yH = o.y0 + 34 * t;
      hostL.setAttribute('d', `M14,${yH} C${(14 + s.x) / 2},${yH} ${s.x - 50 * t},${s.y + 20 * t} ${s.x},${s.y}`);
      hostR.setAttribute('d', `M${e.x},${e.y} C${e.x + 50 * t},${e.y + 20 * t} ${(746 + e.x) / 2},${yH} 746,${yH}`);
      // on a phone the text is scaled up, so the chromosome labels go under the line and the cargo label is shortened
      const narrow = svg.clientWidth < 520;
      lHostL.setAttribute('y', narrow ? yH + 32 : yH - 14); lHostR.setAttribute('y', narrow ? yH + 32 : yH - 14);
      lHostL.style.opacity = lHostR.style.opacity = narrow ? smooth(clamp((t - 0.5) / 0.4)) : 1;
      lCargo.textContent = narrow ? 'cargo genes' : 'cargo · resistance / degradation genes';
      const m1 = g.is1[Math.floor(g.is1.length / 2)], m2 = g.is2[Math.floor(g.is2.length / 2)], mc = g.cargo[Math.floor(g.cargo.length / 2)];
      // labels sit outside the curve; the two IS labels fade out as the copies merge
      place(lIs1, m1, -30); place(lIs2, m2, -30); place(lCargo, mc, 26);
      const fadeIS = 1 - smooth(clamp(t / 0.4));
      lIs1.style.opacity = fadeIS; lIs2.style.opacity = fadeIS;
      lNode.setAttribute('x', o.cx); lNode.setAttribute('y', m1.y + 50);
      lNode.style.opacity = smooth(clamp((t - 0.75) / 0.25));
      lCycle.setAttribute('x', o.cx); lCycle.setAttribute('y', o.y0 - o.R + 4);
      lCycle.style.opacity = smooth(clamp((t - 0.85) / 0.15));
      reads.style.opacity = smooth(clamp((prog - 0.3) / 0.08)) * (1 - smooth(clamp((prog - 0.5) / 0.08)));
    }

    // Plays on its own in a loop while on screen: line → reads → cycle, hold, unwind, again.
    // A step click shows that step and the loop resumes after a pause; the button stops it for good.
    const HOLD = [1600, 2200, 3000];
    // The loop runs continuously; it only rests while the figure is off screen.
    let prog = STOPS[0], anim = null, timer = null, playing = false, userPaused = false, visible = true;
    function tweenTo(target, dur, done) {
      cancelAnimationFrame(anim);
      const from = prog, t0 = performance.now();
      (function tick(now) {
        const k = clamp((now - t0) / dur);
        prog = from + (target - from) * smooth(k);
        render(prog);
        if (k < 1) anim = requestAnimationFrame(tick); else if (done) done();
      })(t0);
    }
    function loop() {
      if (!playing) return;
      const i = STOPS.findIndex(s => s > prog + 1e-3);
      if (i === -1) {                                   // at the cycle: hold, fade, start again from the line
        timer = setTimeout(() => {
          if (!playing) return;
          svg.style.opacity = 0;
          timer = setTimeout(() => {
            prog = STOPS[0]; render(prog); svg.style.opacity = 1;
            if (playing) timer = setTimeout(loop, HOLD[0]);
          }, 450);
        }, HOLD[2]);
        return;
      }
      tweenTo(STOPS[i], i === 2 ? 2200 : 1200, () => { timer = setTimeout(loop, i === 2 ? 0 : HOLD[i]); });
    }
    function play() {
      if (playing) return;
      playing = true; playBtn.textContent = '❚❚ Pause';
      loop();
    }
    function stop() {
      playing = false; cancelAnimationFrame(anim); clearTimeout(timer);
      svg.style.opacity = 1;
      playBtn.textContent = '▶ Play';
    }
    function maybeResume(delay) {
      clearTimeout(timer);
      timer = setTimeout(() => { if (visible && !userPaused) play(); }, delay);
    }
    playBtn.addEventListener('click', () => {
      if (playing) { userPaused = true; stop(); } else { userPaused = false; play(); }
    });
    steps.forEach((s, i) => s.addEventListener('click', () => {
      stop(); tweenTo(STOPS[i], 1000);
      userPaused = false; maybeResume(3000);
    }));
    render(prog);
    play();
    new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (visible && !userPaused) maybeResume(300); else if (!visible) stop();
    }), { threshold: 0.35 }).observe(svg);
  })();

  /* ---------- reveal on view ---------- */
  window.picotaOnView = onView;
  function onView(node, fn) {
    // Fire once any part is well inside the viewport; a ratio threshold never fires for blocks taller than the screen.
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(); io.disconnect(); } }), { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    io.observe(node);
  }

  /* ---------- contigs vs graph ---------- */
  (function routes() {
    const data = [
      ['MEGAHIT contigs', 'contig-based', 0, 520],
      ['SPAdes contigs', 'contig-based', 94, 520],
      ['PICOTA · MEGAHIT graph', 'graph cycles', 188, 520],
      ['PICOTA · SPAdes graph', 'graph cycles', 480, 520, true],
    ];
    const host = document.getElementById('route-bars');
    host.innerHTML = data.map(([l, s, v, n, hl]) => `
      <div class="bar-row${hl ? ' hl' : ''}">
        <div class="bar-label">${l}<small>${v} / ${n} ${s === 'graph cycles' ? 'via a single cycle' : 'in a single contig'}</small></div>
        <div class="bar-track"><div class="bar-fill" data-w="${(100 * v / n).toFixed(1)}"></div></div>
        <div class="bar-val">${Math.round(100 * v / n)}%</div>
      </div>`).join('');
    onView(host, () => host.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }));
  })();

  /* ---------- funnel ---------- */
  (function funnel() {
    const st = [
      [544, 'oriented nodes — 272 contigs × 2 strands'],
      [17, 'back-edges: 13 direct + 4 reverse-complement'],
      [40, 'paths enumerated between their ends'],
      [9, 'distinct cycles of 1–40 kb'],
      [5, 'candidate cycles after k-mer deduplication'],
    ];
    const host = document.getElementById('nitro-funnel');
    const max = Math.log10(544);
    host.innerHTML = st.map(([v, l]) => `<div class="fstage"><div class="fbar" style="width:0" data-w="${Math.max(6, 100 * Math.log10(v + 1) / max)}"></div><b>${fmt(v)}</b><span>${l}</span></div>`).join('');
    onView(host, () => host.querySelectorAll('.fbar').forEach(b => { b.style.width = b.dataset.w + '%'; }));
  })();

  /* ---------- score calculator ---------- */
  const calc = (function scoring() {
    const $ = id => document.getElementById(id);
    const inIs = $('in-is'), inNoIs = $('in-nois'), inLen = $('in-len'), inComp = $('in-comp'), inCargo = $('in-cargo'), inNovel = $('in-novel');
    const presets = [
      { n: 'Typical element', is: 0.92, noIs: false, len: 5200, comp: 2, cargo: 0.88, novel: false },
      { n: 'Novel cargo', is: 0.9, noIs: false, len: 6400, comp: 2, cargo: 0.5, novel: true },
      { n: 'Multi-copy IS', is: 0.95, noIs: false, len: 4800, comp: 16, cargo: 0.9, novel: false },
      { n: 'Host repeat', is: 0.62, noIs: false, len: 17800, comp: 11, cargo: 0.4, novel: true },
      { n: 'Oversized', is: 0.95, noIs: false, len: 36000, comp: 3, cargo: 0.95, novel: false },
      { n: 'No IS', is: 0.9, noIs: true, len: 5000, comp: 2, cargo: 0.95, novel: false },
    ];
    const pHost = $('presets');
    presets.forEach((p, i) => {
      const b = document.createElement('button'); b.className = 'preset'; b.textContent = p.n;
      b.addEventListener('click', () => { set(p); pHost.querySelectorAll('.preset').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      pHost.appendChild(b);
    });

    // gauge
    const gsvg = d3.select('#gauge-svg');
    const arc = d3.arc().innerRadius(80).outerRadius(96).cornerRadius(3);
    const A = v => -Math.PI / 2 + Math.PI * v / 100;
    const gg = gsvg.append('g').attr('transform', 'translate(110,110)');
    gg.append('path').attr('d', arc({ startAngle: A(0), endAngle: A(100) })).style('fill', 'var(--bg-alt)');
    const valArc = gg.append('path');
    const ta = A(THRESHOLD);
    gg.append('line').attr('x1', 74 * Math.sin(ta)).attr('y1', -74 * Math.cos(ta)).attr('x2', 102 * Math.sin(ta)).attr('y2', -102 * Math.cos(ta)).style('stroke', 'var(--ink)').style('stroke-width', 2);
    gg.append('text').attr('x', 0).attr('y', -104).attr('text-anchor', 'middle').attr('class', 'svg-small').text('threshold 50');

    let shown = 0, raf = null;
    function update() {
      inIs.disabled = inNoIs.checked; inCargo.disabled = inNovel.checked;
      const isQ = inNoIs.checked ? 0 : +inIs.value;
      const L = +inLen.value, c = +inComp.value;
      const cq = inNovel.checked ? NOVEL_FLOOR : +inCargo.value;
      const isGate = inNoIs.checked ? 0 : 0.5 + 0.5 * isQ;
      const lg = lengthGate(L), cf = componentFit(c);
      const score = 100 * isGate * lg * (0.5 * cf + 0.5 * cq);
      $('o-is').textContent = inNoIs.checked ? '—' : isQ.toFixed(2);
      $('o-len').textContent = fmt(L) + ' bp';
      $('o-comp').textContent = c;
      $('o-cargo').textContent = inNovel.checked ? '0.30 floor' : cq.toFixed(2);
      const terms = [
        ['IS_gate', isGate, 'var(--is)', 'is'], ['length_gate', lg, 'var(--is)', 'len'],
        ['component_fit', cf, 'var(--cargo)', 'comp'], ['cargo_quality', cq, 'var(--cargo)', 'cargo'],
      ];
      $('terms').innerHTML = terms.map(([n, v, col]) => `<div class="term"><span class="term-name">${n}</span><div class="term-track"><div class="term-fill" style="width:${v * 100}%;background:${col}"></div></div><span class="term-val">${v.toFixed(2)}</span></div>`).join('');
      document.querySelectorAll('#formula .f-term').forEach(f => {
        const t = terms.find(x => x[3] === f.dataset.k);
        f.classList.toggle('zero', t[1] === 0);
      });
      const pass = score >= THRESHOLD;
      const v = $('verdict');
      v.className = 'verdict ' + (pass ? 'pass' : 'fail');
      v.textContent = isGate === 0 ? 'Rejected — no insertion sequence, the IS gate is 0'
        : lg === 0 ? 'Rejected — far too long for a composite transposon'
        : pass ? 'Reported as a composite transposon' : 'Below threshold — not reported';
      valArc.style('fill', pass ? 'var(--good)' : 'var(--accent)');
      const from = shown; cancelAnimationFrame(raf);
      const t0 = performance.now();
      (function tick(now) {
        const k = clamp((now - t0) / 300), s = from + (score - from) * smooth(k);
        shown = s;
        $('score-num').textContent = s.toFixed(1);
        valArc.attr('d', arc({ startAngle: A(0), endAngle: A(Math.max(0.5, s)) }));
        if (k < 1) raf = requestAnimationFrame(tick);
      })(t0);
    }
    function set(p) {
      inIs.value = p.is; inNoIs.checked = p.noIs; inLen.value = p.len; inComp.value = p.comp;
      inCargo.value = p.cargo; inNovel.checked = p.novel; update();
    }
    [inIs, inNoIs, inLen, inComp, inCargo, inNovel].forEach(i => i.addEventListener('input', () => {
      pHost.querySelectorAll('.preset').forEach(x => x.classList.remove('on')); update();
    }));
    pHost.firstChild.classList.add('on');
    update();
    return { setStructure(len, comp) { inLen.value = len; inComp.value = comp; pHost.querySelectorAll('.preset').forEach(x => x.classList.remove('on')); update(); } };
  })();

  /* ---------- pipeline ---------- */
  (function pipeline() {
    const P = [
      ['Read filtering', 'fastp', 'Trimmed FASTQ', false, 'off by default'],
      ['Assembly', 'SPAdes · MEGAHIT', 'An assembly graph (GFA)', false],
      ['Cycle detection', 'DFS over the graph', 'Candidate cycles (FASTA)', true],
      ['Gene prediction', 'Prodigal -p meta', 'ORFs on every candidate', true],
      ['Homology search', 'BLAST × 4 references', 'CARD · ISfinder/TnCentral · KEGG xenobiotics · known CTs', true],
      ['Scoring', 'score3', 'A ranked table, Known vs Novel', true],
      ['Boundary annotation', 'IS / cargo split', 'GenBank per element', true],
      ['Long-read validation', 'minimap2', 'Circular-read evidence', false, 'optional'],
    ];
    document.getElementById('pipeline-list').innerHTML = P.map(([h, t, p, core, opt]) =>
      `<li class="${core ? 'core' : ''}"><h3>${h} ${opt ? `<span class="opt">· ${opt}</span>` : ''}</h3><div class="tool">${t}</div><p>${p}</p></li>`).join('');
  })();

  /* ---------- copy buttons ---------- */
  document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
    const txt = b.closest('.code').querySelector('code').textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Select & copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1500);
  }));

  /* ---------- graph explorer ---------- */
  fetch('data/nitro.json').then(r => r.json()).then(initExplorer).catch(err => {
    document.getElementById('dfs-status').textContent = 'Could not load the graph data (' + err.message + '). Serve the site over HTTP rather than opening the file directly.';
  });

  function initExplorer(data) {
    const seg = id => id.slice(0, -1);
    const nodes = data.segments.map(s => ({ ...s }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const radius = n => 2.4 + Math.sqrt(n.len) / 15;
    const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    const linkMap = new Map();
    data.links.forEach(([a, , b]) => { if (a !== b && !linkMap.has(key(a, b))) linkMap.set(key(a, b), { source: a, target: b, k: key(a, b) }); });
    const links = [...linkMap.values()];

    // Deterministic layout (d3-force uses a fixed-seed LCG)
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(l => 6 + radius(l.source) + radius(l.target)).strength(0.9))
      .force('charge', d3.forceManyBody().strength(-26).distanceMax(260))
      .force('collide', d3.forceCollide(d => radius(d) + 1.5))
      .force('x', d3.forceX(0).strength(0.02)).force('y', d3.forceY(0).strength(0.03))
      .stop();
    for (let i = 0; i < 600; i++) sim.tick();

    const svg = d3.select('#graph-svg');
    const W = svg.node().clientWidth || 800, H = svg.node().clientHeight || 600;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const root = svg.append('g');
    const gLinks = root.append('g'), gCycle = root.append('g'), gNodes = root.append('g'), gPulse = root.append('g');

    const linkSel = gLinks.selectAll('line').data(links).join('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      .style('stroke', 'var(--edge)').style('stroke-width', 1.4).style('stroke-linecap', 'round');
    const linkEl = new Map(); linkSel.each(function (d) { linkEl.set(d.k, this); });

    const nodeSel = gNodes.selectAll('circle').data(nodes).join('circle')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', radius)
      .style('fill', 'var(--host)').style('stroke', 'var(--surface)').style('stroke-width', 1);
    const nodeEl = new Map(); nodeSel.each(function (d) { nodeEl.set(d.id, this); });

    const zoom = d3.zoom().scaleExtent([0.4, 8]).on('zoom', e => root.attr('transform', e.transform));
    svg.call(zoom);
    function fitTo(ns, dur) {
      const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
      const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
      const k = Math.min(2.6, 0.92 * Math.min(W / (x1 - x0), H / (y1 - y0)));
      const tr = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      (dur ? svg.transition().duration(dur) : svg).call(zoom.transform, tr);
    }
    fitTo(nodes, 0);

    // tooltip
    const tip = document.getElementById('graph-tip');
    nodeSel.on('mouseenter', (e, d) => {
      tip.hidden = false;
      tip.textContent = `contig ${d.id} · ${fmt(d.len)} bp` + (d.depth ? ` · k-mer depth ${d.depth}` : '');
    }).on('mousemove', e => {
      const r = svg.node().parentNode.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px';
    }).on('mouseleave', () => { tip.hidden = true; });

    /* DFS replay */
    const ev = data.dfs;
    let i = 0, playing = false, acc = 0, onStack = new Map(), finished = new Set(), stack = [], nBack = 0, nRev = 0, seen = new Set();
    const $ = id => document.getElementById(id);
    const status = $('dfs-status'), playBtn = $('dfs-play');
    function segState(s) {
      if ((onStack.get(s) || 0) > 0) return 'stack';
      if (finished.has(s)) return 'done';
      return 'idle';
    }
    function paint(s) {
      const st = segState(s), n = nodeEl.get(s);
      n.style.fill = st === 'stack' ? 'var(--stack)' : st === 'done' ? 'var(--done)' : 'var(--host)';
    }
    function setLink(a, b, style) {
      const l = linkEl.get(key(a, b)); if (!l) return;
      if (l.dataset.cyc && style !== 'reset') return; // back-edges stay marked
      if (style === 'tree') { l.style.stroke = 'var(--stack)'; l.style.strokeWidth = 2.6; }
      else if (style === 'done') { l.style.stroke = 'var(--done)'; l.style.strokeWidth = 1.6; }
      else if (style === 'back' || style === 'rev') { l.style.stroke = style === 'back' ? 'var(--accent)' : 'var(--rev)'; l.style.strokeWidth = 3.2; l.dataset.cyc = 1; }
      else { l.style.stroke = 'var(--edge)'; l.style.strokeWidth = 1.4; delete l.dataset.cyc; }
    }
    function pulse(s, color) {
      const n = byId.get(s);
      gPulse.append('circle').attr('cx', n.x).attr('cy', n.y).attr('r', radius(n)).style('fill', 'none').style('stroke', color).style('stroke-width', 2.5)
        .transition().duration(900).attr('r', radius(n) + 22).style('opacity', 0).remove();
    }
    function apply(e) {
      const [type, a, b] = e;
      if (type === 'd') {
        const s = seg(a);
        if (stack.length) setLink(seg(stack[stack.length - 1]), s, 'tree');
        stack.push(a); onStack.set(s, (onStack.get(s) || 0) + 1); seen.add(a); paint(s);
      } else if (type === 'f') {
        const s = seg(a); stack.pop();
        onStack.set(s, onStack.get(s) - 1); finished.add(s); paint(s);
        if (stack.length) setLink(seg(stack[stack.length - 1]), s, 'done');
      } else if (type === 'b' || type === 'r') {
        type === 'b' ? nBack++ : nRev++;
        setLink(seg(a), seg(b), type === 'b' ? 'back' : 'rev');
        pulse(seg(b), type === 'b' ? 'var(--accent)' : 'var(--rev)');
        status.innerHTML = type === 'b'
          ? `<b>Back-edge</b> <code>${a}</code> → <code>${b}</code>: <code>${b}</code> is still on the stack, so a cycle closes. PICOTA now enumerates every path from <code>${b}</code> back to <code>${a}</code>.`
          : `<b>Reverse-complement back-edge</b> <code>${a}</code> → <code>${b}</code>: the other strand of <code>${b}</code> is on the stack — a cycle that turns around through an inverted repeat.`;
      }
    }
    function counters() {
      $('c-visited').textContent = seen.size; $('c-back').textContent = nBack; $('c-rev').textContent = nRev;
    }
    function reset() {
      playing = false; i = 0; acc = 0; onStack = new Map(); finished = new Set(); stack = []; nBack = nRev = 0; seen = new Set();
      nodes.forEach(n => paint(n.id)); links.forEach(l => setLink(l.source.id, l.target.id, 'reset'));
      gPulse.selectAll('*').remove();
      playBtn.textContent = '▶ Run DFS'; counters();
      status.innerHTML = 'Press <b>Run DFS</b> to replay the search, or pick a detected cycle below.';
    }
    function finish() {
      playing = false; playBtn.textContent = '↻ Replay';
      status.innerHTML = `<b>Search finished.</b> ${nBack} back-edges and ${nRev} reverse-complement back-edges gave 40 paths, which reduce to <b>${data.cycles.length} candidate cycles</b>. Ranked by score below.`;
    }
    function loop() {
      if (!playing) return;
      acc += +$('dfs-speed').value / 8;
      while (acc >= 1 && i < ev.length) { apply(ev[i++]); acc--; }
      counters();
      if (i >= ev.length) { finish(); return; }
      requestAnimationFrame(loop);
    }
    playBtn.addEventListener('click', () => {
      clearCycle();
      if (i >= ev.length) reset();
      playing = !playing;
      playBtn.textContent = playing ? '❚❚ Pause' : '▶ Resume';
      if (playing) { status.innerHTML = 'Walking the graph depth-first. Orange nodes are on the stack.'; requestAnimationFrame(loop); }
    });
    $('dfs-step').addEventListener('click', () => {
      clearCycle(); playing = false; playBtn.textContent = '▶ Resume';
      // advance to the next back-edge so a single step shows something meaningful
      while (i < ev.length) { const e = ev[i++]; apply(e); if (e[0] === 'b' || e[0] === 'r') break; }
      counters(); if (i >= ev.length) finish();
    });
    $('dfs-reset').addEventListener('click', () => { clearCycle(); reset(); fitTo(nodes, 600); });

    /* cycles, ranked by score3 */
    const list = $('cycle-list');
    const detail = $('cycle-detail'), info = $('cycle-info');
    const cycles = data.cycles.map((c, i) => ({ ...c, num: c.name.split('_').pop() }))
      .sort((a, b) => b.score3 - a.score3);
    const KIND = { is: 'var(--is)', xeno: 'var(--xeno)', amr: 'var(--accent)', ct: 'var(--rev)', orf: 'var(--done)' };
    const pretty = n => n.replace(/^ISFinder_|^PICOTA_/, '').replace(/_/g, ' ').replace(/-MF\d+\.\d+$/, '');
    let selected = null;
    cycles.forEach((c, rank) => {
      const genes = c.features.filter(f => f.k !== 'orf');
      const chips = genes.map(f => `<span class="gchip" style="--c:${KIND[f.k]}">${f.k === 'is' ? 'IS' : f.k === 'xeno' ? 'xeno' : f.k.toUpperCase()} · ${pretty(f.name)}</span>`).join('');
      const b = document.createElement('button');
      b.className = 'cycle-card';
      b.innerHTML = `<div class="cc-h"><span><span class="rank">#${rank + 1}</span> Cycle ${c.num}${c.rev ? '<span class="tag">reverse-oriented</span>' : ''}</span>
          <span class="score-pill ${c.reported ? 'pass' : ''}">${c.score3.toFixed(1)}</span></div>
        <div class="cc-m">${(c.len / 1000).toFixed(1)} kb · ${c.path.length} contigs${c.reported ? ' · <b class="ok">reported</b>' : c.no_is ? ' · no IS found' : ' · below 50'}</div>
        ${chips ? `<div class="gchips">${chips}</div>` : ''}`;
      b.addEventListener('click', () => { if (selected === rank) { clearCycle(); fitTo(nodes, 700); return; } showCycle(rank); });
      list.appendChild(b);
    });
    function clearCycle() {
      selected = null; gCycle.selectAll('*').remove();
      list.querySelectorAll('.cycle-card').forEach(c => c.classList.remove('on'));
      gNodes.style('opacity', 1); gLinks.style('opacity', 1);
    }

    // Each step of the cycle is drawn as a bowed arrow, so the walk visibly returns to its start.
    function drawDirected(c) {
      const col = c.rev ? 'var(--rev)' : 'var(--accent)';
      const segs = c.path.map(seg);
      const steps = segs.map((s, j) => [s, segs[(j + 1) % segs.length]]);
      const curve = ([a, b]) => {
        const p = byId.get(a), q = byId.get(b);
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
        // short cycles get wide bows so the way out and the way back are two separate arcs
        const bow = segs.length <= 3 ? radius(p) + radius(q) + 14 : Math.min(26, 0.28 * L);
        const cx = (p.x + q.x) / 2 - dy / L * bow, cy = (p.y + q.y) / 2 + dx / L * bow;
        const edge = (n, r) => { const ux = cx - n.x, uy = cy - n.y, ul = Math.hypot(ux, uy) || 1; return { x: n.x + ux / ul * r, y: n.y + uy / ul * r }; };
        const s0 = edge(p, radius(p) + 2), s1 = edge(q, radius(q) + 4);
        const mx = 0.25 * s0.x + 0.5 * cx + 0.25 * s1.x, my = 0.25 * s0.y + 0.5 * cy + 0.25 * s1.y;
        return { p: s0, q: s1, cx, cy, mx, my, ang: Math.atan2(s1.y - s0.y, s1.x - s0.x) * 180 / Math.PI };
      };
      const cs = steps.filter(([a, b]) => a !== b).map(curve);
      gCycle.selectAll('path.cyc').data(cs).join('path').attr('class', 'cyc flow')
        .attr('d', d => `M${d.p.x},${d.p.y} Q${d.cx},${d.cy} ${d.q.x},${d.q.y}`)
        .style('fill', 'none').style('stroke', col).style('stroke-width', 3.2).style('stroke-linecap', 'round');
      gCycle.selectAll('path.arr').data(cs).join('path').attr('class', 'arr')
        .attr('d', 'M-5,-4.5 L5,0 L-5,4.5 Z').attr('transform', d => `translate(${d.mx},${d.my}) rotate(${d.ang})`)
        .style('fill', col);
      const ns = segs.map(s => byId.get(s));
      gCycle.selectAll('circle').data(ns).join('circle')
        .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => radius(d) + 1.5)
        .style('fill', 'var(--surface)').style('stroke', col).style('stroke-width', 2.5);
      gCycle.selectAll('text').data(c.path).join('text')
        .attr('x', (d, j) => ns[j].x + radius(ns[j]) + 4).attr('y', (d, j) => ns[j].y + 3)
        .attr('class', 'svg-small').style('font-size', '6px').style('fill', 'var(--ink)')
        .text((d, j) => `${j + 1} · ${d}`);
      return ns;
    }

    function ringMap(c) {
      const svg = d3.select('#ring-svg'); svg.selectAll('*').remove();
      const L = c.len, ang = p => (p - 1) / L * 2 * Math.PI;
      const arc = d3.arc();
      const g = svg.append('g');
      // contig track
      c.spans.forEach((s, j) => {
        g.append('path').attr('d', arc({ innerRadius: 150, outerRadius: 168, startAngle: ang(s.start) + 0.004, endAngle: ang(s.end) - 0.004 }))
          .style('fill', j % 2 ? 'var(--host)' : 'color-mix(in srgb, var(--host) 55%, var(--surface))');
        const mid = (ang(s.start) + ang(s.end)) / 2, span = ang(s.end) - ang(s.start);
        if (span > 0.22 || c.spans.length <= 4) {
          const r = 184, x = r * Math.sin(mid), y = -r * Math.cos(mid);
          g.append('text').attr('x', x).attr('y', y + 3).attr('text-anchor', Math.abs(x) < 20 ? 'middle' : x > 0 ? 'start' : 'end')
            .attr('class', 'svg-small').style('font-size', '9px').text(s.node);
        }
      });
      // direction chevrons on the contig track
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * 2 * Math.PI + 0.13, r = 159;
        g.append('path').attr('d', 'M-3,-3.5 L2,0 L-3,3.5').attr('transform', `translate(${r * Math.sin(a)},${-r * Math.cos(a)}) rotate(${a * 180 / Math.PI})`)
          .style('stroke', 'var(--surface)').style('stroke-width', 1.6).style('fill', 'none');
      }
      // ORFs, + strand outside, - strand inside
      c.features.filter(f => f.k === 'orf').forEach(f => {
        const r0 = f.str > 0 ? 126 : 112;
        g.append('path').attr('d', arc({ innerRadius: r0, outerRadius: r0 + 10, startAngle: ang(f.s), endAngle: ang(f.e) }))
          .style('fill', 'var(--done)');
      });
      // annotated hits
      c.features.filter(f => f.k !== 'orf').forEach(f => {
        g.append('path').attr('d', arc({ innerRadius: 108, outerRadius: 142, startAngle: ang(f.s), endAngle: ang(f.e), cornerRadius: 3 }))
          .style('fill', KIND[f.k]).style('opacity', 0.92).append('title').text(`${pretty(f.name)} · ${fmt(f.s)}–${fmt(f.e)}`);
      });
      // where the walk closes
      g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -146).attr('y2', -174).style('stroke', 'var(--ink)').style('stroke-width', 2);
      g.append('text').attr('x', 6).attr('y', -190).attr('class', 'svg-small').style('font-size', '9px').style('fill', 'var(--ink)').text('start = end ↺');
      // walker
      const walker = g.append('circle').attr('r', 5).style('fill', c.rev ? 'var(--rev)' : 'var(--accent)').style('stroke', 'var(--surface)').style('stroke-width', 2);
      cancelAnimationFrame(ringMap.raf);
      const t0 = performance.now();
      (function tick(now) {
        const a = ((now - t0) / 7000 % 1) * 2 * Math.PI;
        walker.attr('cx', 159 * Math.sin(a)).attr('cy', -159 * Math.cos(a));
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !detail.hidden) ringMap.raf = requestAnimationFrame(tick);
      })(t0);
      // centre
      g.append('text').attr('y', -16).attr('text-anchor', 'middle').attr('class', 'svg-small').text('score3');
      g.append('text').attr('y', 22).attr('text-anchor', 'middle').style('font', '800 40px Inter, sans-serif')
        .style('fill', c.reported ? 'var(--good)' : 'var(--ink)').text(c.score3.toFixed(1));
      g.append('text').attr('y', 44).attr('text-anchor', 'middle').attr('class', 'svg-small').text(`${fmt(c.len)} bp`);
    }

    function showCycle(rank) {
      if (playing) { playing = false; playBtn.textContent = '▶ Resume'; }
      clearCycle(); selected = rank;
      list.children[rank].classList.add('on');
      const c = cycles[rank];
      gNodes.style('opacity', 0.3); gLinks.style('opacity', 0.3);
      const ns = drawDirected(c);
      fitTo(ns, 800);
      detail.hidden = false;
      ringMap(c);
      const lg = lengthGate(c.len), cf = componentFit(c.comp);
      const genes = c.features.filter(f => f.k !== 'orf');
      const orfs = c.features.length - genes.length;
      info.innerHTML = `
        <div class="ci-h"><h3>Cycle ${c.num}</h3>${c.category ? `<span class="badge">${c.category}</span>` : ''}${c.reported ? '<span class="badge ok">reported</span>' : ''}</div>
        <p class="ci-sum">${c.reported ? 'Clears the threshold: an insertion sequence and cargo on a cycle of plausible length.'
          : c.no_is ? 'No insertion sequence on this cycle, so the IS gate is 0 and the score with it — most likely the host\'s own repeat structure.'
          : 'Carries an IS but no cargo hit, so cargo falls back to the 0.30 floor; with this length and component count it stays under 50.'}</p>
        <div class="term"><span class="term-name">score3</span><div class="term-track thr"><div class="term-fill" style="width:${c.score3}%;background:${c.reported ? 'var(--good)' : 'var(--accent)'}"></div></div><span class="term-val">${c.score3.toFixed(1)}</span></div>
        <div class="term"><span class="term-name">length_gate</span><div class="term-track"><div class="term-fill" style="width:${lg * 100}%;background:var(--is)"></div></div><span class="term-val">${lg.toFixed(2)}</span></div>
        <div class="term"><span class="term-name">component_fit</span><div class="term-track"><div class="term-fill" style="width:${cf * 100}%;background:var(--cargo)"></div></div><span class="term-val">${cf.toFixed(2)}</span></div>
        <h4>What is on it</h4>
        <ul class="hits">${genes.map(f => `<li><i style="background:${KIND[f.k]}"></i><span>${pretty(f.name)}</span><small>${f.k === 'is' ? 'insertion sequence' : f.k === 'xeno' ? 'xenobiotic degradation' : f.k === 'amr' ? 'antibiotic resistance' : f.k} · ${fmt(f.s)}–${fmt(f.e)}</small></li>`).join('') || '<li class="muted">No database hit.</li>'}
          <li><i style="background:var(--done)"></i><span>${orfs} other predicted ORFs</span><small>Prodigal</small></li></ul>
        <h4>The walk</h4>
        <div class="walk">${c.path.map((n, j) => `<span class="step-chip">${j + 1} · ${n}</span>`).join('<span class="arrow">→</span>')}<span class="arrow">→</span><span class="step-chip back">↺ ${c.path[0]}</span></div>
        <p class="fineprint">${data.scoring_note || ''}</p>`;
      status.innerHTML = `<b>Cycle ${c.num}</b> — follow the arrows: ${c.path.length} oriented contigs, and the last leads back into the first. ${c.rev ? 'Found through a reverse-complement back-edge, so it turns through an inverted repeat.' : ''}`;
    }
    reset();
    showCycle(0);
  }
})();
