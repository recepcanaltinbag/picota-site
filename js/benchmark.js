/* PICOTA — simulated benchmark (Supplementary Data 1) */
(function () {
  'use strict';

  const fmt = n => n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const onView = window.picotaOnView || ((n, f) => f());
  const asObjects = t => t.rows.map(r => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])));

  fetch('data/benchmark.json').then(r => r.json()).then(d => {
    scenarios(asObjects(d.architectures));
    copyNumber(asObjects(d.copy_number));
    negative(asObjects(d.negative_control));
  }).catch(err => {
    document.getElementById('scenarios').textContent = 'Could not load the benchmark data (' + err.message + ').';
  });

  /* ---------- architecture cards ---------- */
  // Schematics: what is implanted, drawn left to right.
  const SHAPES = {
    baseline: [['is', 1], ['cargo', 4], ['is', 1]],
    novel_cargo: [['is', 1], ['novel', 4], ['is', 1]],
    compact: [['pad', 1.2], ['is', 1], ['cargo', 1.6], ['is', 1], ['pad', 1.2]],
    shared_is: [['is', 0.8], ['cargo', 1.5], ['is', 0.8], ['gap', 0.6], ['is', 0.8], ['cargo', 1.5], ['is', 0.8]],
    cargo_is_diff: [['is', 1], ['cargo', 1.6], ['is2', 0.8], ['cargo', 1.6], ['is', 1]],
    cargo_is_same: [['is', 1], ['cargo', 1.6], ['is', 0.8], ['cargo', 1.6], ['is', 1]],
  };
  const ORDER = ['baseline', 'novel_cargo', 'compact', 'shared_is', 'cargo_is_diff', 'cargo_is_same'];
  const COL = { is: 'var(--is)', cargo: 'var(--cargo)', novel: 'var(--cargo)', is2: 'var(--rev)' };

  function schematic(id) {
    const parts = SHAPES[id] || SHAPES.baseline;
    const tot = parts.reduce((a, p) => a + p[1], 0);
    let x = 12, svg = `<svg viewBox="0 0 300 54" aria-hidden="true"><line x1="0" y1="27" x2="300" y2="27" style="stroke:var(--host);stroke-width:4"/>`;
    parts.forEach(([k, w]) => {
      const pw = 276 * w / tot;
      if (COL[k]) svg += `<rect x="${x.toFixed(1)}" y="17" width="${(pw - 2).toFixed(1)}" height="20" rx="4" style="fill:${COL[k]};${k === 'novel' ? 'fill-opacity:.35;stroke:var(--cargo);stroke-width:1.5;stroke-dasharray:4 3' : ''}"/>`;
      if (k === 'gap') svg += `<rect x="${x}" y="17" width="${pw}" height="20" style="fill:var(--surface)"/><text x="${x + pw / 2}" y="31" text-anchor="middle" class="svg-small">…</text>`;
      x += pw;
    });
    if (id === 'shared_is') svg += `<text x="296" y="10" text-anchor="end" class="svg-small" style="fill:var(--is)">multi-copy IS</text>`;
    if (id === 'novel_cargo') svg += `<text x="150" y="31" text-anchor="middle" class="svg-small" style="fill:var(--cargo)">?</text>`;
    return svg + '</svg>';
  }

  function scenarios(rows) {
    const host = document.getElementById('scenarios');
    rows.sort((a, b) => ORDER.indexOf(a.Architecture) - ORDER.indexOf(b.Architecture));
    rows.forEach(r => {
      const sens = 100 * r.Sensitivity, prec = 100 * r.Precision;
      const card = document.createElement('div');
      card.className = 'scn' + (sens < 50 ? ' bad' : '');
      card.innerHTML = `<h3>${esc(r.Architecture)}</h3><p>${esc(r.Structure)}</p>${schematic(r.Architecture)}
        <div class="metric"><span>Sensitivity</span><div class="term-track"><div class="term-fill" style="width:0" data-w="${sens}"></div></div><b>${sens.toFixed(1)}%</b></div>
        <div class="metric prec"><span>Precision</span><div class="term-track"><div class="term-fill" style="width:0" data-w="${prec}"></div></div><b>${prec.toFixed(1)}%</b></div>
        <dl class="scn-facts">
          <div><dt>recovered</dt><dd>${r.Recovered} / ${r.Elements}</dd></div>
          <div><dt>false positives</dt><dd>${r['False positives']}</dd></div>
          <div><dt>whole in one SPAdes contig</dt><dd>${r['Intact in one SPAdes contig']} / ${r.Elements}</dd></div>
        </dl>`;
      host.appendChild(card);
    });
    onView(host, () => host.querySelectorAll('.term-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }));
  }

  /* ---------- copy-number experiment ---------- */
  function copyNumber(rows) {
    const S = [
      { k: 'PICOTA, SPAdes graph: recovered', n: 'PICOTA · SPAdes graph', c: 'var(--accent)', w: 3.5, on: true },
      { k: 'PICOTA, MEGAHIT graph: recovered', n: 'PICOTA · MEGAHIT graph', c: 'var(--accent)', w: 2, dash: '6 5', on: true },
      { k: 'MEF, complete chromosome: recovered', n: 'MEF · complete chromosome', c: 'var(--rev)', w: 2, dash: '2 5', on: true },
      { k: 'MEF, SPAdes contigs: recovered', n: 'MEF · SPAdes contigs', c: 'var(--cargo)', w: 2.5, on: true },
      { k: 'MEF, MEGAHIT contigs: recovered', n: 'MEF · MEGAHIT contigs', c: 'var(--cargo)', w: 2, dash: '6 5', on: false },
      { k: 'Intact in one SPAdes contig', n: 'Whole in one SPAdes contig', c: 'var(--host)', w: 2, on: false },
    ];
    const legend = document.getElementById('cn-legend');
    S.forEach(s => {
      const b = document.createElement('button');
      b.className = 'series' + (s.on ? ' on' : '');
      b.innerHTML = `<svg width="26" height="10"><line x1="1" y1="5" x2="25" y2="5" style="stroke:${s.c};stroke-width:${Math.min(s.w, 3)};${s.dash ? 'stroke-dasharray:' + s.dash : ''}"/></svg>${s.n}`;
      b.setAttribute('aria-pressed', s.on);
      b.addEventListener('click', () => { s.on = !s.on; b.classList.toggle('on', s.on); b.setAttribute('aria-pressed', s.on); draw(); });
      legend.appendChild(b);
    });

    const svg = d3.select('#cn-chart');
    const tip = document.getElementById('cn-tip');
    const xs = rows.map(r => r['Flanking-IS copies']);
    const N = rows[0].Elements;
    let drawn = false;

    function draw() {
      const W = svg.node().clientWidth || 800, H = 340, m = { t: 18, r: 24, b: 44, l: 46 };
      svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();
      const x = d3.scaleLinear().domain([2, 8]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain([0, N]).range([H - m.b, m.t]);
      const g = svg.append('g');
      y.ticks(4).concat([N]).forEach(t => {
        g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--line)');
        g.append('text').attr('x', m.l - 10).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('class', 'svg-small').text(t);
      });
      xs.forEach(v => g.append('text').attr('x', x(v)).attr('y', H - m.b + 20).attr('text-anchor', 'middle').attr('class', 'svg-small').text(v));
      g.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('class', 'svg-small').text('genomic copies of the flanking IS');
      g.append('text').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('class', 'svg-small').text(`elements recovered (of ${N})`);

      const line = d3.line().x(r => x(r['Flanking-IS copies']));
      S.filter(s => s.on).forEach(s => {
        const p = g.append('path').datum(rows).attr('d', line.y(r => y(r[s.k]))(rows))
          .style('fill', 'none').style('stroke', s.c).style('stroke-width', s.w).style('stroke-linejoin', 'round');
        if (s.dash) p.style('stroke-dasharray', s.dash);
        else if (!drawn) {
          const len = p.node().getTotalLength();
          p.style('stroke-dasharray', `${len} ${len}`).style('stroke-dashoffset', len)
            .transition().duration(1200).ease(d3.easeCubicOut).style('stroke-dashoffset', 0)
            .on('end', function () { d3.select(this).style('stroke-dasharray', null); });
        }
        g.selectAll(null).data(rows).join('circle').attr('cx', r => x(r['Flanking-IS copies'])).attr('cy', r => y(r[s.k])).attr('r', s.w + 1)
          .style('fill', 'var(--surface)').style('stroke', s.c).style('stroke-width', 2);
      });

      const rule = g.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--ink)').style('stroke-opacity', 0.25).style('display', 'none');
      svg.on('pointermove', e => {
        const [px] = d3.pointer(e);
        const r = rows.reduce((a, b) => Math.abs(x(b['Flanking-IS copies']) - px) < Math.abs(x(a['Flanking-IS copies']) - px) ? b : a);
        const cx = x(r['Flanking-IS copies']);
        rule.attr('x1', cx).attr('x2', cx).style('display', null);
        const rep = r['PICOTA, SPAdes graph: reported cycles'];
        tip.hidden = false;
        tip.innerHTML = `<b>${r['Flanking-IS copies']} IS copies</b>` +
          S.map(s => `<div><i style="background:${s.c}"></i>${s.n}<span>${r[s.k]}</span></div>`).join('') +
          `<div class="tip-note">PICOTA reported ${rep} cycles, ${r['PICOTA, SPAdes graph: false positives']} false positive${r['PICOTA, SPAdes graph: false positives'] === 1 ? '' : 's'} · precision ${(100 * r['PICOTA, SPAdes graph: recovered'] / rep).toFixed(1)}%<br>MEF on the complete chromosome made ${r['MEF, complete chromosome: predictions']} predictions</div>`;
        const box = svg.node().getBoundingClientRect();
        const left = cx / W * box.width;
        tip.style.left = (left > box.width / 2 ? left - tip.offsetWidth - 14 : left + 14) + 'px';
        tip.style.top = '12px';
      }).on('pointerleave', () => { rule.style('display', 'none'); tip.hidden = true; });
      drawn = true;
    }
    const box = document.getElementById('cn-chart');
    onView(box, draw);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (drawn) draw(); }, 150); });
  }

  /* ---------- negative control ---------- */
  function negative(rows) {
    const host = document.getElementById('neg-bars');
    const max = Math.max(...rows.map(r => r.Predictions));
    host.innerHTML = rows.map(r => {
      const reported = /reported/.test(r.Route);
      const range = r['Per genome, min'] == null ? '' : ` · ${r['Per genome, min']}–${r['Per genome, max']} per genome`;
      return `<div class="bar-row${reported ? ' hl' : ''}">
        <div class="bar-label">${esc(r.Route.replace(' (candidate cycles)', ''))}<small>${r.Genomes} genome${r.Genomes === 1 ? '' : 's'}${range}</small></div>
        <div class="bar-track"><div class="bar-fill" data-w="${(100 * r.Predictions / max).toFixed(1)}"></div></div>
        <div class="bar-val">${r.Predictions}</div>
      </div>`;
    }).join('');
    onView(host, () => host.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }));
  }

})();
