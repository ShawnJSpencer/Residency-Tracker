/* Block & Rotation Schedule */
'use strict';
const ROT_CATS = ['Inpatient psychiatry', 'Outpatient psychiatry', 'Consultation-liaison', 'Emergency / crisis', 'Child & adolescent', 'Addiction', 'Geriatric', 'Forensic / community', 'Neurology', 'Primary care medicine', 'Elective / research', 'Other'];
function defaultRotations() {
  const r = (abbr, name, cat, c) => ({ id: uid(), abbr, name, cat, c, site: 'Utah Valley Hospital', min: '', max: '', notes: '' });
  return [
    r('IP', 'Adult inpatient psychiatry', 'Inpatient psychiatry', 's1'),
    r('NF', 'Night float', 'Inpatient psychiatry', 's7'),
    r('CL', 'Consultation-liaison', 'Consultation-liaison', 's2'),
    r('ED', 'Emergency psychiatry', 'Emergency / crisis', 's8'),
    r('OP', 'Outpatient psychiatry clinic', 'Outpatient psychiatry', 's3'),
    r('CAP', 'Child & adolescent psychiatry', 'Child & adolescent', 's5'),
    r('ADD', 'Addiction psychiatry', 'Addiction', 's4'),
    r('GER', 'Geriatric psychiatry', 'Geriatric', 's4'),
    r('NEU', 'Neurology', 'Neurology', 's7'),
    r('IM', 'Internal medicine', 'Primary care medicine', 's6'),
    r('FM', 'Family medicine', 'Primary care medicine', 's6'),
    r('ELE', 'Elective', 'Elective / research', 's5'),
  ];
}
function ensureBlocks() {
  if (!S.blocks) S.blocks = { mode: '13', rotations: defaultRotations(), assign: {}, targets: {} };
  S.blocks.targets ||= {}; S.blocks.assign ||= {};
}
const nBlocks = () => S.blocks.mode === '12' ? 12 : 13;
function blockDates(ay) {
  const out = [];
  if (nBlocks() === 12) for (let i = 0; i < 12; i++) { const s = new Date(ay, 6 + i, 1), e = new Date(ay, 7 + i, 0); out.push([toISO(s), toISO(e)]); }
  else { let s = new Date(ay, 6, 1); for (let i = 0; i < 13; i++) { const e = new Date(s); e.setDate(e.getDate() + 27); if (i === 12) e.setTime(new Date(ay + 1, 5, 30).getTime()); out.push([toISO(s), toISO(e)]); s = new Date(e); s.setDate(s.getDate() + 1); } }
  return out;
}
const rot = id => S.blocks.rotations.find(r => r.id === id);
// Rows = resident positions for each class present that academic year
function blockRows(ay) {
  const ay0 = acadYear(S.settings.programStart), per = +S.settings.perClass || 1, rows = [];
  for (let pgy = 1; pgy <= 4; pgy++) {
    const cy = ay - pgy + 1; if (cy < ay0) continue;
    classPositions(cy).forEach(p => rows.push({ key: p.key, pgy, cy, i: p.i, label: p.r?.name || `Resident ${posLetter(p.i)}`, named: !!p.r }));
  }
  return rows;
}
const getRow = (ay, key) => { const a = (S.blocks.assign[ay] ||= {}); const r = (a[key] ||= []); while (r.length < nBlocks()) r.push(''); return r; };
let blkBrush = '';

VIEWS.blocks = {
  title: 'Block Schedule',
  render() {
    ensureBlocks();
    const tab = S.ui.blkTab || 'grid', T = (k, l) => `<button class="${tab === k ? 'active' : ''}" data-act="blktab" data-t="${k}">${l}</button>`;
    return `<div class="page-head"><div><h1>Block & Rotation Schedule</h1><div class="sub">${nBlocks()} blocks per year (${nBlocks() === 13 ? '4-week' : 'monthly'}) · rows are resident positions until residents are named</div></div></div>
      <div class="tabs">${T('grid', 'Schedule')}${T('coverage', 'Coverage')}${T('req', 'Requirements')}${T('call', 'Call')}${T('rot', `Rotations (${S.blocks.rotations.length})`)}</div>
      ${{ grid: blkGridHTML, coverage: blkCoverageHTML, req: blkReqHTML, rot: blkRotHTML, call: callHTML }[tab]()}`;
  },
  after() {
    const s = $('#blkAY'); if (s) s.onchange = () => { S.ui.blkAY = +s.value; save(); render(); };
    const w = $('.blk-wrap'); if (w) setupBlkPaint(w);
  },
};
ACT.blktab = el => { S.ui.blkTab = el.dataset.t; save(); render(); };
function ayPicker() {
  const ay0 = acadYear(S.settings.programStart), ay = S.ui.blkAY || ay0;
  return `<select id="blkAY">${[0, 1, 2, 3, 4, 5].map(i => `<option value="${ay0 + i}" ${ay === ay0 + i ? 'selected' : ''}>AY ${ayLabel(ay0 + i)}</option>`).join('')}</select>`;
}
const curAY = () => S.ui.blkAY || acadYear(S.settings.programStart);
function blkGridHTML() {
  const ay = curAY(), bd = blockDates(ay), rows = blockRows(ay), t = todayISO();
  const curB = bd.findIndex(([s, e]) => t >= s && t <= e);
  const gaps = coverageGaps(ay);
  let lastPgy = 0;
  const body = rows.map(r => {
    const a = getRow(ay, r.key);
    const sep = r.pgy !== lastPgy ? `<tr class="grp"><td class="rcol">PGY-${r.pgy} · Class of ${r.cy + 4}</td><td colspan="${bd.length + 1}"></td></tr>` : ''; lastPgy = r.pgy;
    return sep + `<tr data-key="${r.key}"><td class="rcol"><span class="${r.named ? '' : 'muted'}">${esc(r.label)}</span></td>${a.slice(0, bd.length).map((id, b) => { const R = rot(id); return `<td class="bc ${b === curB ? 'cur' : ''}" data-b="${b}">${R ? `<div class="blk" style="--c:var(--${R.c})" data-tip="<b>${esc(r.label)}</b><br>Block ${b + 1}: ${esc(R.name)}">${esc(R.abbr)}</div>` : ''}</td>`; }).join('')}<td class="small muted" style="padding:0 6px;white-space:nowrap">${a.filter(Boolean).length}/${bd.length}</td></tr>`;
  }).join('');
  return `<div class="toolbar">${ayPicker()}<div class="spacer"></div><button class="btn" data-act="blkStagger">Copy & stagger…</button><button class="btn" data-act="blkCSV">Export CSV</button><button class="btn" data-act="blkPrint">Print</button></div>
    <div class="brushes"><span class="small muted" style="margin-right:4px">Brush:</span><span class="chip click ${!blkBrush ? 'st-doing' : ''}" data-act="brush" data-id="">☝ Pick</span>${S.blocks.rotations.map(R => `<span class="chip click brush ${blkBrush === R.id ? 'sel' : ''}" data-act="brush" data-id="${R.id}" style="--c:var(--${R.c})"><span class="dot" style="background:var(--${R.c})"></span>${esc(R.abbr)}</span>`).join('')}<span class="chip click ${blkBrush === 'erase' ? 'st-blocked' : ''}" data-act="brush" data-id="erase">⌫ Erase</span></div>
    <div class="small muted" style="margin:-4px 0 8px">${blkBrush ? 'Tap or drag across blocks to paint. Choose “Pick” to go back to tap-to-choose.' : 'Tap a block to choose its rotation, or pick a brush and drag across blocks.'}${gaps.length ? ` · <a href="#" data-act="blktab" data-t="coverage" style="color:var(--bad);font-weight:600">${gaps.length} coverage issue${gaps.length > 1 ? 's' : ''}</a>` : ''}</div>
    ${rows.length ? `<div class="blk-wrap"><table class="blkt"><thead><tr><th class="rcol">Resident</th>${bd.map(([s, e], b) => `<th class="${b === curB ? 'cur' : ''}">B${b + 1}<small>${fmtDate(s, { noYear: 1 })}<br>– ${fmtDate(e, { noYear: 1 })}</small></th>`).join('')}<th></th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="card empty"><b>No residents this year</b>Pick an academic year starting with the first class.</div>'}`;
}
function setupBlkPaint(wrap) {
  let painting = false;
  const ay = curAY();
  const paint = td => {
    if (!td || !td.matches('td.bc')) return;
    const key = td.closest('tr').dataset.key, b = +td.dataset.b, a = getRow(ay, key), v = blkBrush === 'erase' ? '' : blkBrush;
    if (a[b] === v) return; a[b] = v; const R = rot(v);
    td.innerHTML = R ? `<div class="blk" style="--c:var(--${R.c})">${esc(R.abbr)}</div>` : '';
  };
  wrap.addEventListener('pointerdown', e => {
    const td = e.target.closest('td.bc'); if (!td) return;
    if (!blkBrush) return;
    e.preventDefault(); painting = true; paint(td); try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
  });
  wrap.addEventListener('pointermove', e => { if (painting) { e.preventDefault(); const el = document.elementFromPoint(e.clientX, e.clientY); paint(el && el.closest('td.bc')); } });
  const end = () => { if (painting) { painting = false; save(); render(); } };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('click', e => { const td = e.target.closest('td.bc'); if (td && !blkBrush) pickRotation(ay, td.closest('tr').dataset.key, +td.dataset.b); });
  wrap.classList.toggle('painting', !!blkBrush);
}
ACT.brush = el => { blkBrush = el.dataset.id; render(); };
function pickRotation(ay, key, b) {
  const a = getRow(ay, key), row = blockRows(ay).find(r => r.key === key), [s, e] = blockDates(ay)[b];
  openModal(`<div class="modal-head"><h2>${esc(row?.label || '')} · Block ${b + 1}</h2><button class="iconbtn" data-act="close">✕</button></div><div class="small muted" style="margin:-8px 0 12px">${fmtDate(s, { wd: 1 })} – ${fmtDate(e, { wd: 1 })}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">${S.blocks.rotations.map(R => `<button class="btn ${a[b] === R.id ? 'on' : ''}" data-pick="${R.id}" style="justify-content:flex-start"><span class="blk" style="--c:var(--${R.c});position:static;width:40px;flex:none">${esc(R.abbr)}</span>${esc(R.name)}</button>`).join('')}</div>
    <div class="modal-foot"><button class="btn" data-pick="">Clear block</button><label class="check" style="margin-right:auto"><input type="checkbox" id="pkNext"> Also fill the next block</label><button class="btn" data-act="close">Cancel</button></div>`);
  $$('[data-pick]').forEach(btn => btn.onclick = () => { a[b] = btn.dataset.pick; if ($('#pkNext').checked && b + 1 < nBlocks()) a[b + 1] = btn.dataset.pick; save(); closeModal(); render(); });
}
ACT.blkStagger = () => {
  const ay = curAY(), rows = blockRows(ay), pgys = [...new Set(rows.map(r => r.pgy))];
  openModal(`<div class="modal-head"><h2>Copy & stagger a rotation sequence</h2><button class="iconbtn" data-act="close">✕</button></div>
    <p class="small muted" style="margin-top:0">Build one resident's year, then copy it to the rest of the class, shifted so residents rotate through services at different times (Resident B starts one rotation later than A, etc.). Rows that already have blocks filled will be overwritten.</p>
    <div class="form"><label class="f">Class<select id="sgP">${pgys.map(p => `<option value="${p}">PGY-${p}</option>`).join('')}</select></label>
    <label class="f">Copy from<select id="sgFrom"></select></label>
    <label class="f">Shift each next resident by<select id="sgShift">${[0, 1, 2, 3, 4, 6].map(n => `<option value="${n}" ${n === 1 ? 'selected' : ''}>${n} block${n === 1 ? '' : 's'}${n === 0 ? ' (identical copy)' : ''}</option>`).join('')}</select></label></div>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="sgGo">Copy</button></div>`);
  const fill = () => { const p = +$('#sgP').value; $('#sgFrom').innerHTML = rows.filter(r => r.pgy === p).map(r => `<option value="${r.key}">${esc(r.label)}</option>`).join(''); };
  $('#sgP').onchange = fill; fill();
  $('#sgGo').onclick = () => {
    const p = +$('#sgP').value, from = $('#sgFrom').value, sh = +$('#sgShift').value, src = getRow(ay, from).slice(0, nBlocks());
    if (!src.some(Boolean)) return toast('That row is empty — fill it first');
    const others = rows.filter(r => r.pgy === p && r.key !== from); const n = nBlocks();
    others.forEach((r, k) => { const dst = getRow(ay, r.key); for (let b = 0; b < n; b++) dst[b] = src[((b - (k + 1) * sh) % n + n) % n]; });
    save(); closeModal(); render(); toast(`Copied to ${others.length} resident(s)`);
  };
};
ACT.blkCSV = () => { const ay = curAY(), bd = blockDates(ay); download(`block-schedule-${ayLabel(ay)}.csv`, toCSV([['Resident', 'PGY', ...bd.map(([s, e], b) => `B${b + 1} ${s}`)], ...blockRows(ay).map(r => [r.label, r.pgy, ...getRow(ay, r.key).slice(0, bd.length).map(id => rot(id)?.abbr || '')])]), 'text/csv'); };
ACT.blkPrint = () => window.print();

/* ---------- coverage ---------- */
function coverageCounts(ay) {
  const rows = blockRows(ay), n = nBlocks(), c = {};
  S.blocks.rotations.forEach(R => c[R.id] = Array(n).fill(0));
  rows.forEach(r => getRow(ay, r.key).slice(0, n).forEach((id, b) => { if (c[id]) c[id][b]++; }));
  return c;
}
function coverageGaps(ay) {
  const c = coverageCounts(ay), out = [];
  if (!blockRows(ay).some(r => getRow(ay, r.key).some(Boolean))) return out; // nothing scheduled yet
  S.blocks.rotations.forEach(R => c[R.id].forEach((v, b) => { if ((R.min !== '' && v < +R.min) || (R.max !== '' && v > +R.max)) out.push({ R, b, v }); }));
  return out;
}
function blkCoverageHTML() {
  const ay = curAY(), bd = blockDates(ay), c = coverageCounts(ay), gaps = coverageGaps(ay);
  return `<div class="toolbar">${ayPicker()}<span class="small muted">Residents on each service per block. Set minimum / maximum staffing on the Rotations tab; cells outside the range turn red.</span></div>
  <div class="card tablewrap" style="padding:0"><table class="t blkt cov"><thead><tr><th class="rcol">Rotation</th><th>Min–Max</th>${bd.map((_, b) => `<th style="text-align:center">B${b + 1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${S.blocks.rotations.map(R => `<tr><td class="rcol"><span class="dot" style="background:var(--${R.c})"></span> <b>${esc(R.abbr)}</b> <span class="small">${esc(R.name)}</span></td><td class="small muted">${R.min === '' && R.max === '' ? '—' : `${R.min === '' ? '0' : R.min}–${R.max === '' ? '∞' : R.max}`}</td>${c[R.id].map((v, b) => { const bad = gaps.some(g => g.R === R && g.b === b); return `<td style="text-align:center;font-weight:700;${bad ? 'background:var(--bad-soft);color:var(--bad)' : v ? '' : 'color:var(--ink-3)'}" ${bad ? `data-tip="Block ${b + 1}: ${v} on ${esc(R.abbr)} (target ${R.min || 0}–${R.max || '∞'})"` : ''}>${v || '·'}</td>`; }).join('')}<td><b>${c[R.id].reduce((s, x) => s + x, 0)}</b></td></tr>`).join('')}</tbody></table></div>
  ${gaps.length ? `<div class="card" style="margin-top:14px"><h2 style="color:var(--bad)">${gaps.length} coverage issue${gaps.length > 1 ? 's' : ''}</h2><div class="list">${gaps.slice(0, 30).map(g => `<div class="li"><span class="when">Block ${g.b + 1}</span><div class="grow">${esc(g.R.name)}: <b>${g.v}</b> resident(s) (target ${g.R.min || 0}–${g.R.max || '∞'})</div></div>`).join('')}</div></div>` : ''}`;
}

/* ---------- requirements ---------- */
function blkReqHTML() {
  const ay0 = acadYear(S.settings.programStart), per = +S.settings.perClass || 1, tg = S.blocks.targets;
  // every resident position across the 4 years of its class
  const people = [];
  for (let cy = ay0; cy <= ay0 + 4; cy++) {
    classPositions(cy).forEach(p => people.push({ key: p.key, cy, label: p.r?.name || `Class of ${cy + 4} · ${posLetter(p.i)}` }));
  }
  const tally = p => { const t = {}; for (let y = p.cy; y < p.cy + 4; y++) (S.blocks.assign[y]?.[p.key] || []).slice(0, nBlocks()).forEach(id => { const R = rot(id); if (R) t[R.cat] = (t[R.cat] || 0) + 1; }); return t; };
  const used = ROT_CATS.filter(c => S.blocks.rotations.some(R => R.cat === c));
  const rows = people.map(p => ({ p, t: tally(p) })).filter(x => Object.keys(x.t).length || x.p.cy === ay0);
  return `<div class="card" style="margin-bottom:14px"><h2>Targets per resident (whole residency, in blocks)</h2>
    <p class="small muted" style="margin-top:0">Enter minimums from the ACGME Psychiatry Program Requirements and your own curriculum. Each resident's four-year total is compared against them below. ${nBlocks() === 13 ? '1 block = 4 weeks.' : '1 block = 1 month.'}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px 16px">${used.map(c => `<label class="f">${esc(c)}<input type="number" min="0" step="0.5" data-tg="${esc(c)}" value="${tg[c] ?? ''}" placeholder="no target"></label>`).join('')}</div></div>
  <div class="card tablewrap" style="padding:0"><table class="t"><thead><tr><th>Resident</th>${used.map(c => `<th style="white-space:normal;font-size:10px;min-width:70px">${esc(c)}${tg[c] ? `<br><span style="color:var(--ink-2)">≥ ${tg[c]}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(({ p, t }) => `<tr><td style="white-space:nowrap"><b>${esc(p.label)}</b></td>${used.map(c => { const v = t[c] || 0, need = tg[c]; const st = need ? (v >= +need ? 'color:var(--good)' : 'color:var(--bad)') : ''; return `<td style="font-weight:700;${st}">${v || '·'}${need && v < +need ? `<span class="small" style="font-weight:500"> (−${+need - v})</span>` : ''}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${used.length + 1}" class="muted">Nothing scheduled yet.</td></tr>`}</tbody></table></div>
  <div class="small muted" style="margin-top:6px">Counts include every academic year scheduled so far, so early on most residents will show shortfalls — that's expected until all four years are laid out.</div>`;
}
document.addEventListener('change', e => { const el = e.target.closest('[data-tg]'); if (!el) return; S.blocks.targets[el.dataset.tg] = el.value === '' ? '' : +el.value; save(); render(); });

/* ---------- rotation catalog ---------- */
function blkRotHTML() {
  return `<div class="toolbar"><span class="small muted">The abbreviation shows inside each block. Min / max = residents needed on that service each block (for the coverage check).</span><div class="spacer"></div><button class="btn primary" data-act="rotAdd">+ Rotation</button></div>
  <div class="card tablewrap" style="padding:0"><table class="t"><thead><tr><th>Abbr</th><th>Rotation</th><th>Category</th><th>Site</th><th>Supervisor <span style="text-transform:none">(evaluator)</span></th><th>Color</th><th>Min</th><th>Max</th><th></th></tr></thead><tbody>${S.blocks.rotations.map(R => `<tr>
    <td><input type="text" data-bind="blocks.rotations:${R.id}:abbr" value="${esc(R.abbr)}" style="width:60px" maxlength="5" data-rerender></td>
    <td><input type="text" data-bind="blocks.rotations:${R.id}:name" value="${esc(R.name)}" style="width:100%;min-width:180px"></td>
    <td><select data-bind="blocks.rotations:${R.id}:cat">${ROT_CATS.map(c => `<option ${R.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    <td><select data-bind="blocks.rotations:${R.id}:siteId" style="min-width:150px"><option value="">— no site —</option>${(S.sites || []).map(x => `<option value="${x.id}" ${R.siteId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td>
    <td><input type="text" list="supl" data-bind="blocks.rotations:${R.id}:supervisor" value="${esc(R.supervisor || '')}" placeholder="faculty name" style="min-width:140px"></td>
    <td><select data-bind="blocks.rotations:${R.id}:c" data-rerender style="background:var(--${R.c});color:#fff;font-weight:700">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<option value="s${i}" ${R.c === 's' + i ? 'selected' : ''}>${['Blue', 'Orange', 'Aqua', 'Yellow', 'Pink', 'Green', 'Violet', 'Red'][i - 1]}</option>`).join('')}</select></td>
    <td><input type="number" min="0" data-bind="blocks.rotations:${R.id}:min" value="${R.min}" style="width:60px"></td>
    <td><input type="number" min="0" data-bind="blocks.rotations:${R.id}:max" value="${R.max}" style="width:60px"></td>
    <td><button class="iconbtn" data-act="rotDel" data-id="${R.id}" title="Delete">✕</button></td></tr>`).join('')}</tbody></table><datalist id="supl">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></div>
  <div class="card" style="margin-top:14px"><h2>Block length</h2><div class="seg"><button class="${nBlocks() === 13 ? 'active' : ''}" data-act="blkMode" data-m="13">13 × 4-week blocks</button><button class="${nBlocks() === 12 ? 'active' : ''}" data-act="blkMode" data-m="12">12 calendar months</button></div><div class="small muted" style="margin-top:6px">Switching keeps blocks 1–12 in place; with 12 months, anything in block 13 is hidden.</div></div>`;
}
ACT.rotAdd = () => { S.blocks.rotations.push({ id: uid(), abbr: 'NEW', name: 'New rotation', cat: 'Other', c: 's1', site: '', min: '', max: '', notes: '' }); save(); render(); };
ACT.rotDel = el => { const R = rot(el.dataset.id); const used = Object.values(S.blocks.assign).some(a => Object.values(a).some(r => r.includes(R.id))); confirmBox(`Delete <b>${esc(R.name)}</b>?${used ? ' It is scheduled in some blocks — those blocks will be cleared.' : ''}`, () => { S.blocks.rotations = S.blocks.rotations.filter(x => x !== R); Object.values(S.blocks.assign).forEach(a => Object.values(a).forEach(r => r.forEach((v, i) => { if (v === R.id) r[i] = ''; }))); save(); render(); }); };
ACT.blkMode = el => { S.blocks.mode = el.dataset.m; save(); render(); };
