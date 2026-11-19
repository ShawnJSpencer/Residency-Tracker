/* Evaluation completion tracking — evaluations OF residents, BY residents, and of faculty / program */
'use strict';
const EV_EVALUATORS = ['Rotation supervisor', 'Faculty', 'Program Director', 'Psychotherapy supervisor', 'Nursing / staff', 'Peer resident', 'Patient', 'Medical student', 'Self', 'Resident'];
const EV_SUBJECTS = ['Resident', 'Faculty', 'Rotation', 'Program', 'Didactics', 'ACGME survey'];
const EV_FREQ = { block: 'Every block (end of rotation)', quarterly: 'Quarterly', semiannual: 'Semiannual (mid-year & year-end)', annual: 'Annual', event: 'As needed (add manually)' };
function defaultEvalTypes() {
  const t = (id, name, evaluator, subject, freq, extra = {}) => ({ id, name, evaluator, subject, freq, dueDays: 14, dueMD: '04-30', dueMD2: ['12-15', '06-15'], anon: false, active: true, pgys: [], ...extra });
  return [
    // Of residents
    t('rot-res', 'End-of-rotation evaluation', 'Rotation supervisor', 'Resident', 'block'),
    t('msf-staff', 'Multi-source (360°): nursing / staff', 'Nursing / staff', 'Resident', 'semiannual'),
    t('msf-peer', 'Multi-source (360°): peer', 'Peer resident', 'Resident', 'annual', { dueMD: '03-31' }),
    t('msf-pt', 'Patient feedback', 'Patient', 'Resident', 'annual', { dueMD: '03-31' }),
    t('msf-ms', 'Medical student → resident (teaching)', 'Medical student', 'Resident', 'event'),
    t('psychotx', 'Psychotherapy supervision evaluation', 'Psychotherapy supervisor', 'Resident', 'semiannual'),
    t('csv', 'Clinical Skills Verification (CSV)', 'Faculty', 'Resident', 'event'),
    t('self', 'Self-assessment & individual learning plan', 'Self', 'Resident', 'semiannual', { dueMD2: ['11-30', '05-31'] }),
    t('semi', 'Semiannual review with Program Director', 'Program Director', 'Resident', 'semiannual', { dueMD2: ['12-31', '06-30'] }),
    t('final', 'Final summative evaluation', 'Program Director', 'Resident', 'annual', { dueMD: '06-15', pgys: [4] }),
    // By residents
    t('res-rot', 'Resident → rotation evaluation', 'Resident', 'Rotation', 'block'),
    t('res-fac', 'Resident → faculty evaluation (confidential)', 'Resident', 'Faculty', 'annual', { anon: true }),
    t('res-prog', 'Resident → program evaluation (confidential)', 'Resident', 'Program', 'annual', { anon: true }),
    t('res-did', 'Resident → didactics evaluation', 'Resident', 'Didactics', 'semiannual'),
    t('acgme-res', 'ACGME Resident Survey', 'Resident', 'ACGME survey', 'annual'),
    // Faculty & program
    t('fac-prog', 'Faculty → program evaluation (confidential)', 'Faculty', 'Program', 'annual', { anon: true }),
    t('acgme-fac', 'ACGME Faculty Survey', 'Faculty', 'ACGME survey', 'annual'),
    t('pd-fac', 'Annual faculty review (PD → faculty)', 'Program Director', 'Faculty', 'annual', { dueMD: '06-30' }),
  ];
}
function ensureEvals() { if (!S.evals) S.evals = { types: defaultEvalTypes(), items: [] }; }
const evType = id => S.evals.types.find(t => t.id === id);
const evGroup = t => t.subject === 'Resident' ? 'of' : t.evaluator === 'Resident' ? 'by' : 'fac';
const EV_GROUPS = { of: 'Evaluations of residents', by: 'Evaluations by residents', fac: 'Faculty & program' };
function evStatus(it) { if (it.na) return 'na'; if (it.completed) return 'done'; if (it.due < todayISO()) return 'overdue'; return 'pending'; }
const EV_ST = { pending: 'Pending', overdue: 'Overdue', done: 'Complete', na: 'Waived' };
const evChipCls = { pending: 'st-todo', overdue: 'st-blocked', done: 'st-done', na: 'st-na' };

/* ----- people helpers (resident positions come from the block schedule rows) ----- */
function resLabel(key) {
  const [cy, i] = key.split('#').map(Number);
  const named = S.residents.filter(r => r.classYear === cy).sort((a, b) => a.name.localeCompare(b.name));
  return named[i]?.name || `Class of ${cy + 4} · Resident ${String.fromCharCode(65 + i)}`;
}
const facName = id => S.faculty.find(f => f.id === id)?.name || '(removed faculty)';
function partyLabel(kind, ref, text) { return kind === 'resident' ? resLabel(ref) : kind === 'faculty' ? facName(ref) : text; }
const evEvaluator = it => partyLabel(it.evKind, it.evRef, it.evText);
const evSubject = it => partyLabel(it.subKind, it.subRef, it.subText);
function pdFaculty() { return S.faculty.find(f => (f.roles || []).includes('Program Director')); }
function evalFaculty() { const core = S.faculty.filter(f => (f.roles || []).includes('Core faculty')); return core.length ? core : S.faculty; }

/* ----- generation ----- */
function plannedItems(ay) {
  ensureBlocks();
  const out = [], rows = blockRows(ay), bd = blockDates(ay);
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const md = (m, yr) => `${yr}-${m}`; // MM-DD → date in given year
  const ayDate = mmdd => md(mmdd, +mmdd.slice(0, 2) >= 7 ? ay : ay + 1);
  const periods = t => {
    if (t.freq === 'annual') return [{ p: 'Annual', due: ayDate(t.dueMD || '04-30') }];
    if (t.freq === 'semiannual') return [{ p: 'Mid-year', due: ayDate(t.dueMD2?.[0] || '12-15') }, { p: 'Year-end', due: ayDate(t.dueMD2?.[1] || '06-15') }];
    if (t.freq === 'quarterly') return [['Q1', `${ay}-09-30`], ['Q2', `${ay}-12-31`], ['Q3', `${ay + 1}-03-31`], ['Q4', `${ay + 1}-06-30`]].map(([p, d]) => ({ p, due: addDays(d, +t.dueDays || 0) }));
    return [];
  };
  const pd = pdFaculty();
  // evaluator party for a resident-subject eval
  const evParty = (t, row, R) => {
    if (t.evaluator === 'Self') return { evKind: 'resident', evRef: row.key };
    if (t.evaluator === 'Program Director') return pd ? { evKind: 'faculty', evRef: pd.id } : { evKind: 'role', evText: 'Program Director' };
    if (t.evaluator === 'Rotation supervisor' && R) { const f = S.faculty.find(x => x.name && x.name === R.supervisor); return f ? { evKind: 'faculty', evRef: f.id } : { evKind: 'role', evText: R.supervisor || `${R.name} supervisor` }; }
    if (t.evaluator === 'Psychotherapy supervisor') { const r = S.residents.find(x => resRowKey(x) === row.key); const f = r && S.faculty.find(x => x.name === r.advisor && (x.roles || []).includes('Psychotherapy supervisor')); return f ? { evKind: 'faculty', evRef: f.id } : { evKind: 'role', evText: 'Psychotherapy supervisor' }; }
    return { evKind: 'role', evText: t.evaluator };
  };
  for (const t of S.evals.types.filter(x => x.active && x.freq !== 'event')) {
    const rowsT = rows.filter(r => !t.pgys?.length || t.pgys.includes(r.pgy));
    if (t.subject === 'Resident') {
      rowsT.forEach(row => {
        if (t.freq === 'block') getRow(ay, row.key).slice(0, bd.length).forEach((rid, b) => { const R = rot(rid); if (!R) return; out.push({ typeId: t.id, ay, period: `Block ${b + 1} · ${R.abbr}`, due: addDays(bd[b][1], +t.dueDays || 0), ...evParty(t, row, R), subKind: 'resident', subRef: row.key }); });
        else periods(t).forEach(({ p, due }) => out.push({ typeId: t.id, ay, period: p, due, ...evParty(t, row), subKind: 'resident', subRef: row.key }));
      });
    } else if (t.evaluator === 'Resident') {
      rowsT.forEach(row => {
        const base = { typeId: t.id, ay, evKind: 'resident', evRef: row.key };
        if (t.freq === 'block') getRow(ay, row.key).slice(0, bd.length).forEach((rid, b) => { const R = rot(rid); if (R) out.push({ ...base, period: `Block ${b + 1}`, due: addDays(bd[b][1], +t.dueDays || 0), subKind: 'text', subText: R.name }); });
        else periods(t).forEach(({ p, due }) => {
          if (t.subject === 'Faculty') { const fs = evalFaculty(); if (fs.length) fs.forEach(f => out.push({ ...base, period: p, due, subKind: 'faculty', subRef: f.id })); else out.push({ ...base, period: p, due, subKind: 'text', subText: 'All faculty' }); }
          else out.push({ ...base, period: p, due, subKind: 'text', subText: t.subject === 'Program' ? 'Program' : t.subject === 'Didactics' ? 'Didactic series' : t.subject === 'ACGME survey' ? 'ACGME Resident Survey' : t.subject });
        });
      });
    } else {
      // faculty / PD evaluators of program, faculty, surveys
      if (!rows.length) continue; // only once residents are in the program
      periods(t).forEach(({ p, due }) => {
        if (t.evaluator === 'Program Director' && t.subject === 'Faculty') { const ev = pd ? { evKind: 'faculty', evRef: pd.id } : { evKind: 'role', evText: 'Program Director' }; evalFaculty().filter(f => f !== pd).forEach(f => out.push({ typeId: t.id, ay, period: p, due, ...ev, subKind: 'faculty', subRef: f.id })); }
        else { const fs = evalFaculty(); const subj = { subKind: 'text', subText: t.subject === 'ACGME survey' ? 'ACGME Faculty Survey' : t.subject }; if (fs.length) fs.forEach(f => out.push({ typeId: t.id, ay, period: p, due, evKind: 'faculty', evRef: f.id, ...subj })); else out.push({ typeId: t.id, ay, period: p, due, evKind: 'role', evText: 'Each faculty member', ...subj }); }
      });
    }
  }
  return out.map(it => ({ ...it, sig: [it.typeId, it.ay, it.period, it.evKind, it.evRef || it.evText, it.subKind, it.subRef || it.subText].join('|') }));
}
function resRowKey(r) { const named = S.residents.filter(x => x.classYear === r.classYear).sort((a, b) => a.name.localeCompare(b.name)); return `${r.classYear}#${named.indexOf(r)}`; }

/* ----- view ----- */
VIEWS.evals = {
  title: 'Evaluations',
  render() {
    ensureEvals(); ensureBlocks();
    const tab = S.ui.evTab || 'overview', T = (k, l) => `<button class="${tab === k ? 'active' : ''}" data-act="evtab" data-t="${k}">${l}</button>`;
    const ay0 = acadYear(S.settings.programStart), ay = S.ui.evAY || Math.max(ay0, acadYear(todayISO()));
    return `<div class="page-head"><div><h1>Evaluations</h1><div class="sub">Completion tracking — who owes which evaluation, and what's overdue. Content stays in New Innovations; confidential evaluations are tracked by completion only.</div></div><div class="spacer"></div>
      <select id="evAY">${[0, 1, 2, 3, 4, 5].map(i => `<option value="${ay0 + i}" ${ay === ay0 + i ? 'selected' : ''}>AY ${ayLabel(ay0 + i)}</option>`).join('')}</select>
      <button class="btn" data-act="evGen">Generate for AY ${ayLabel(ay)}…</button><button class="btn primary" data-act="evAdd">+ Evaluation</button></div>
      <div class="tabs">${T('overview', 'Overview')}${T('tracker', 'Tracker')}${T('people', 'By person')}${T('types', `Evaluation types (${S.evals.types.length})`)}</div>
      ${{ overview: evOverviewHTML, tracker: evTrackerHTML, people: evPeopleHTML, types: evTypesHTML }[tab](ay)}`;
  },
  after() {
    const s = $('#evAY'); if (s) s.onchange = () => { S.ui.evAY = +s.value; save(); render(); };
    [['#evQ', 'evQ', 'input'], ['#evG', 'evG', 'change'], ['#evS', 'evS', 'change'], ['#evT', 'evT', 'change']].forEach(([sel, k, ev]) => { const el = $(sel); if (el) el.addEventListener(ev, () => { S.ui[k] = el.value; save(); const p = el.selectionStart; render(); if (ev === 'input') { const n = $(sel); n.focus(); n.setSelectionRange(p, p); } }); });
  },
};
ACT.evtab = el => { S.ui.evTab = el.dataset.t; save(); render(); };
const evItemsAY = ay => S.evals.items.filter(i => i.ay === ay);

function evOverviewHTML(ay) {
  const items = evItemsAY(ay), t = todayISO(), soon = toISO(new Date(Date.now() + 14 * 864e5));
  if (!items.length) return evEmpty(ay);
  const dueNow = items.filter(i => i.due <= t && evStatus(i) !== 'na'), done = items.filter(i => evStatus(i) === 'done');
  const onTime = done.filter(i => i.completed <= i.due).length;
  const overdue = items.filter(i => evStatus(i) === 'overdue'), upcoming = items.filter(i => evStatus(i) === 'pending' && i.due <= soon);
  const pct = dueNow.length ? Math.round(dueNow.filter(i => i.completed).length / dueNow.length * 100) : null;
  const byType = S.evals.types.map((ty, k) => { const its = items.filter(i => i.typeId === ty.id && evStatus(i) !== 'na'); return { ty, its, g: evGroup(ty) }; }).filter(x => x.its.length);
  const grpCard = g => { const rows = byType.filter(x => x.g === g); if (!rows.length) return ''; return `<div class="card"><h2>${EV_GROUPS[g]}</h2>${rows.map(({ ty, its }) => { const d = its.filter(i => i.completed).length, od = its.filter(i => evStatus(i) === 'overdue').length; return `<div class="barrow" style="grid-template-columns:minmax(0,1.4fr) 1fr 74px" data-tip="<b>${esc(ty.name)}</b><br>${d} complete · ${od} overdue · ${its.length - d - od} not yet due/pending"><span class="ellipsis">${esc(ty.name)}${ty.anon ? ' 🔒' : ''}</span><div class="meter">${d ? `<i style="width:${d / its.length * 100}%;background:var(--good)"></i>` : ''}${od ? `<i style="width:${od / its.length * 100}%;background:var(--bad)"></i>` : ''}<i style="flex:1;background:transparent"></i></div><span class="v">${d}/${its.length}</span></div>`; }).join('')}<div class="small muted" style="margin-top:6px">Green = complete, red = overdue. 🔒 = confidential.</div></div>`; };
  const ownerAgg = {}; overdue.forEach(i => { const k = evEvaluator(i); ownerAgg[k] = (ownerAgg[k] || 0) + 1; });
  const worst = Object.entries(ownerAgg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return `<div class="grid g4" style="margin-bottom:16px">
    <div class="card stat"><span class="lbl">Completion (due to date)</span><span class="num">${pct == null ? '—' : pct + '%'}</span><span class="cap">${dueNow.filter(i => i.completed).length} of ${dueNow.length} due so far</span></div>
    <div class="card stat"><span class="lbl">Overdue</span><span class="num" style="color:${overdue.length ? 'var(--bad)' : 'var(--good)'}">${overdue.length}</span><span class="cap"><a href="#" data-act="evJump" data-s="overdue">See list →</a></span></div>
    <div class="card stat"><span class="lbl">Due in next 14 days</span><span class="num">${upcoming.length}</span><span class="cap"><a href="#" data-act="evJump" data-s="pending">See list →</a></span></div>
    <div class="card stat"><span class="lbl">Completed on time</span><span class="num">${done.length ? Math.round(onTime / done.length * 100) + '%' : '—'}</span><span class="cap">${done.length} completed this year</span></div></div>
    <div class="grid g2">${grpCard('of')}${grpCard('by')}${grpCard('fac')}
    <div class="card"><h2>Most overdue evaluators</h2>${worst.length ? `<div class="list">${worst.map(([n, c]) => `<div class="li"><div class="grow ellipsis">${esc(n)}</div><span class="chip st-blocked">${c} overdue</span></div>`).join('')}</div>` : '<div class="muted">Nobody is overdue. 🎉</div>'}</div></div>`;
}
function evEmpty(ay) {
  const rows = blockRows(ay), anyBlocks = rows.some(r => getRow(ay, r.key).some(Boolean));
  return `<div class="card empty"><b>No evaluations set up for AY ${ayLabel(ay)}</b>Tap <b>Generate</b> to create the year's evaluations from the evaluation types, the resident roster${anyBlocks ? '' : ' and the block schedule (end-of-rotation evaluations come from the block schedule — none scheduled for this year yet)'}${S.faculty.length ? '' : ', and faculty (add faculty first so each person gets their own evaluations)'}.</div>`;
}
ACT.evJump = el => { S.ui.evTab = 'tracker'; S.ui.evS = el.dataset.s; save(); render(); };

function evFiltered(ay) {
  const q = (S.ui.evQ || '').toLowerCase(), g = S.ui.evG || '', st = S.ui.evS || '', ty = S.ui.evT || '';
  return evItemsAY(ay).filter(i => { const t = evType(i.typeId); if (!t) return false; return (!g || evGroup(t) === g) && (!ty || i.typeId === ty) && (!st || evStatus(i) === st) && (!q || [t.name, evEvaluator(i), evSubject(i), i.period].join(' ').toLowerCase().includes(q)); }).sort((a, b) => a.due.localeCompare(b.due) || evEvaluator(a).localeCompare(evEvaluator(b)));
}
function evTrackerHTML(ay) {
  if (!evItemsAY(ay).length) return evEmpty(ay);
  const L = evFiltered(ay), lim = S.ui.evLim || 150;
  return `<div class="toolbar"><input type="search" id="evQ" placeholder="Search person, type, rotation…" value="${esc(S.ui.evQ || '')}">
    <select id="evG"><option value="">All groups</option>${Object.entries(EV_GROUPS).map(([k, v]) => `<option value="${k}" ${S.ui.evG === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="evT"><option value="">All types</option>${S.evals.types.map(t => `<option value="${t.id}" ${S.ui.evT === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <select id="evS"><option value="">Any status</option>${Object.entries(EV_ST).map(([k, v]) => `<option value="${k}" ${S.ui.evS === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div class="spacer"></div><button class="btn" data-act="evBulk">Mark shown complete</button><button class="btn" data-act="evCSV">Export CSV</button></div>
    <div class="card tablewrap" style="padding:0">${L.length ? `<table class="t"><thead><tr><th style="width:36px"></th><th>Due</th><th>Evaluation</th><th>Evaluator</th><th>Subject</th><th>Status</th></tr></thead><tbody>${L.slice(0, lim).map(i => { const t = evType(i.typeId), st = evStatus(i); return `<tr><td><input type="checkbox" ${i.completed ? 'checked' : ''} ${i.na ? 'disabled' : ''} data-evdone="${i.id}" title="Mark complete" style="width:18px;height:18px"></td><td style="white-space:nowrap">${fmtDate(i.due, { noYear: 1 })}</td><td><a href="#" data-act="evEdit" data-id="${i.id}">${esc(t.name)}</a>${t.anon ? ' 🔒' : ''}<div class="small muted">${esc(i.period)}</div></td><td>${esc(evEvaluator(i))}</td><td>${esc(evSubject(i))}</td><td><span class="chip ${evChipCls[st]}">${EV_ST[st]}</span>${i.completed ? `<div class="small muted">${fmtDate(i.completed, { noYear: 1 })}</div>` : ''}</td></tr>`; }).join('')}</tbody></table>${L.length > lim ? `<div style="padding:10px;text-align:center"><button class="btn" data-act="evMore">Show ${Math.min(150, L.length - lim)} more (${L.length - lim} hidden)</button></div>` : ''}` : '<div class="empty"><b>No evaluations match</b>Try different filters.</div>'}</div>`;
}
document.addEventListener('change', e => { const el = e.target.closest('[data-evdone]'); if (!el) return; const i = S.evals.items.find(x => x.id === el.dataset.evdone); i.completed = el.checked ? todayISO() : ''; save(); render(); });
ACT.evMore = () => { S.ui.evLim = (S.ui.evLim || 150) + 150; render(); };
ACT.evBulk = () => { const ay = S.ui.evAY || Math.max(acadYear(S.settings.programStart), acadYear(todayISO())); const L = evFiltered(ay).filter(i => !i.completed && !i.na); if (!L.length) return toast('Nothing to mark'); confirmBox(`Mark <b>${L.length}</b> evaluation(s) in the current filter as completed today?`, () => { L.forEach(i => i.completed = todayISO()); save(); render(); }, 'Mark complete'); };
ACT.evCSV = () => { const ay = S.ui.evAY || Math.max(acadYear(S.settings.programStart), acadYear(todayISO())); download(`evaluations-${ayLabel(ay)}.csv`, toCSV([['Due', 'Evaluation', 'Period', 'Evaluator', 'Subject', 'Status', 'Completed', 'Notes'], ...evFiltered(ay).map(i => [i.due, evType(i.typeId)?.name, i.period, evEvaluator(i), evSubject(i), EV_ST[evStatus(i)], i.completed, i.notes || ''])]), 'text/csv'); };

function evPeopleHTML(ay) {
  const items = evItemsAY(ay); if (!items.length) return evEmpty(ay);
  const rows = blockRows(ay), t = todayISO();
  const stat = its => { const due = its.filter(i => i.due <= t && !i.na), d = its.filter(i => i.completed).length; return { n: its.length, due: due.length, done: d, od: its.filter(i => evStatus(i) === 'overdue').length, pct: due.length ? Math.round(due.filter(i => i.completed).length / due.length * 100) : null }; };
  const cell = s => `<td><b>${s.done}</b>/${s.n}${s.pct != null ? ` <span class="small muted">(${s.pct}% of due)</span>` : ''}</td><td>${s.od ? `<span class="chip st-blocked">${s.od}</span>` : '<span class="muted">0</span>'}</td>`;
  const res = rows.map(r => ({ r, owe: stat(items.filter(i => i.evKind === 'resident' && i.evRef === r.key)), about: stat(items.filter(i => i.subKind === 'resident' && i.subRef === r.key)) }));
  const facs = S.faculty.map(f => ({ f, owe: stat(items.filter(i => i.evKind === 'faculty' && i.evRef === f.id)) })).filter(x => x.owe.n);
  const roles = [...new Set(items.filter(i => i.evKind === 'role').map(i => i.evText))].map(n => ({ n, owe: stat(items.filter(i => i.evKind === 'role' && i.evText === n)) }));
  return `<div class="card tablewrap" style="padding:0;margin-bottom:16px"><table class="t"><thead><tr><th>Resident</th><th>Evaluations they owe</th><th>Overdue</th><th>Evaluations about them</th><th>Overdue</th></tr></thead><tbody>${res.map(x => `<tr class="click" data-act="evPerson" data-q="${esc(x.r.label)}"><td><b>${esc(x.r.label)}</b> <span class="small muted">PGY-${x.r.pgy}</span></td>${cell(x.owe)}${cell(x.about)}</tr>`).join('')}</tbody></table></div>
    <div class="grid g2"><div class="card tablewrap" style="padding:0"><table class="t"><thead><tr><th>Faculty</th><th>Completed</th><th>Overdue</th><th></th></tr></thead><tbody>${facs.map(x => `<tr><td><a href="#" data-act="evPerson" data-q="${esc(x.f.name)}"><b>${esc(x.f.name)}</b></a></td>${cell(x.owe)}<td>${x.owe.od && x.f.email ? `<button class="btn sm" data-act="evRemind" data-id="${x.f.id}">Email reminder</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No faculty-assigned evaluations. Add faculty (and set rotation supervisors on the Block Schedule → Rotations tab), then regenerate.</td></tr>'}</tbody></table></div>
    <div class="card tablewrap" style="padding:0"><table class="t"><thead><tr><th>Other evaluators</th><th>Completed</th><th>Overdue</th></tr></thead><tbody>${roles.map(x => `<tr class="click" data-act="evPerson" data-q="${esc(x.n)}"><td><b>${esc(x.n)}</b></td>${cell(x.owe)}</tr>`).join('') || '<tr><td colspan="3" class="muted">None</td></tr>'}</tbody></table></div></div>`;
}
ACT.evPerson = el => { S.ui.evTab = 'tracker'; S.ui.evQ = el.dataset.q; S.ui.evS = ''; S.ui.evG = ''; S.ui.evT = ''; save(); closeModal(); if (S.ui.view !== 'evals') location.hash = '#/evals'; else render(); };
ACT.evRemind = el => {
  const f = S.faculty.find(x => x.id === el.dataset.id), L = S.evals.items.filter(i => i.evKind === 'faculty' && i.evRef === f.id && evStatus(i) === 'overdue');
  const body = `Hi ${f.name.split(' ')[0] === 'Dr.' ? f.name : f.name.split(' ')[0]},\n\nA quick reminder that these evaluations are past due in New Innovations:\n\n${L.map(i => `• ${evType(i.typeId).name} — ${evSubject(i)} (${i.period}, due ${fmtDate(i.due)})`).join('\n')}\n\nThank you!`;
  location.href = `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent('Overdue evaluations')}&body=${encodeURIComponent(body)}`;
};

function evTypesHTML() {
  const grp = g => S.evals.types.filter(t => evGroup(t) === g);
  return `<div class="toolbar"><span class="small muted">Turn types on/off and set how often they're due. Changes apply the next time you generate a year (existing evaluations aren't changed).</span><div class="spacer"></div><button class="btn" data-act="evTypesReset">Restore defaults</button><button class="btn primary" data-act="evTypeAdd">+ Type</button></div>
  ${Object.entries(EV_GROUPS).map(([g, label]) => `<div class="card tablewrap" style="padding:0;margin-bottom:14px"><div style="padding:12px 14px 0;font-weight:650">${label}</div><table class="t"><thead><tr><th>On</th><th>Evaluation</th><th>Evaluator → Subject</th><th>Frequency</th><th>Due</th><th>🔒</th><th></th></tr></thead><tbody>${grp(g).map(t => `<tr style="${t.active ? '' : 'opacity:.5'}"><td><input type="checkbox" data-bind="evals.types:${t.id}:active" ${t.active ? 'checked' : ''} data-rerender></td><td><input type="text" data-bind="evals.types:${t.id}:name" value="${esc(t.name)}" style="width:100%;min-width:200px"></td>
    <td style="white-space:nowrap"><select data-bind="evals.types:${t.id}:evaluator" data-rerender>${EV_EVALUATORS.map(x => `<option ${t.evaluator === x ? 'selected' : ''}>${x}</option>`).join('')}</select> → <select data-bind="evals.types:${t.id}:subject" data-rerender>${EV_SUBJECTS.map(x => `<option ${t.subject === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    <td><select data-bind="evals.types:${t.id}:freq" data-rerender>${Object.entries(EV_FREQ).map(([k, v]) => `<option value="${k}" ${t.freq === k ? 'selected' : ''}>${v}</option>`).join('')}</select>${t.pgys?.length ? `<div class="small muted">PGY-${t.pgys.join(', ')} only</div>` : ''}</td>
    <td style="white-space:nowrap">${t.freq === 'block' || t.freq === 'quarterly' ? `<input type="number" data-bind="evals.types:${t.id}:dueDays" value="${t.dueDays}" style="width:60px"> <span class="small muted">days after</span>` : t.freq === 'annual' ? `<input type="text" data-bind="evals.types:${t.id}:dueMD" value="${esc(t.dueMD)}" style="width:70px" placeholder="MM-DD">` : t.freq === 'semiannual' ? `<input type="text" data-ev2="${t.id}" data-k="0" value="${esc(t.dueMD2?.[0] || '')}" style="width:62px" placeholder="MM-DD"> / <input type="text" data-ev2="${t.id}" data-k="1" value="${esc(t.dueMD2?.[1] || '')}" style="width:62px" placeholder="MM-DD">` : '<span class="small muted">manual</span>'}</td>
    <td><input type="checkbox" data-bind="evals.types:${t.id}:anon" ${t.anon ? 'checked' : ''} title="Confidential"></td><td><button class="iconbtn" data-act="evTypeDel" data-id="${t.id}">✕</button></td></tr>`).join('') || `<tr><td colspan="7" class="muted">None</td></tr>`}</tbody></table></div>`).join('')}`;
}
document.addEventListener('change', e => { const el = e.target.closest('[data-ev2]'); if (!el) return; const t = evType(el.dataset.ev2); (t.dueMD2 ||= ['', ''])[+el.dataset.k] = el.value.trim(); save(); });
ACT.evTypeAdd = () => { S.evals.types.push({ id: uid(), name: 'New evaluation', evaluator: 'Faculty', subject: 'Resident', freq: 'semiannual', dueDays: 14, dueMD: '04-30', dueMD2: ['12-15', '06-15'], anon: false, active: true, pgys: [] }); save(); render(); };
ACT.evTypeDel = el => { const t = evType(el.dataset.id), n = S.evals.items.filter(i => i.typeId === t.id).length; confirmBox(`Delete “${esc(t.name)}”?${n ? ` Its ${n} tracked evaluation(s) will be removed too.` : ''}`, () => { S.evals.types = S.evals.types.filter(x => x !== t); S.evals.items = S.evals.items.filter(i => i.typeId !== t.id); save(); render(); }); };
ACT.evTypesReset = () => confirmBox('Restore the default evaluation types? Custom types are removed; tracked evaluations for default types are kept.', () => { const d = defaultEvalTypes(), ids = new Set(d.map(t => t.id)); S.evals.types = d; S.evals.items = S.evals.items.filter(i => ids.has(i.typeId)); save(); render(); }, 'Restore');

ACT.evGen = () => {
  const ay = S.ui.evAY || Math.max(acadYear(S.settings.programStart), acadYear(todayISO()));
  const planned = plannedItems(ay), have = new Set(S.evals.items.map(i => i.sig)), fresh = planned.filter(p => !have.has(p.sig));
  const byT = {}; fresh.forEach(p => byT[p.typeId] = (byT[p.typeId] || 0) + 1);
  const rows = blockRows(ay), noBlocks = !rows.some(r => getRow(ay, r.key).some(Boolean));
  openModal(`<div class="modal-head"><h2>Generate evaluations · AY ${ayLabel(ay)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <p>${fresh.length ? `<b>${fresh.length}</b> new evaluation(s) to add` : 'Everything for this year is already set up.'}${planned.length - fresh.length ? ` · ${planned.length - fresh.length} already tracked (kept as is)` : ''}.</p>
    ${fresh.length ? `<div class="list small" style="max-height:260px;overflow:auto">${Object.entries(byT).map(([id, n]) => `<div class="li"><div class="grow">${esc(evType(id).name)}</div><b>${n}</b></div>`).join('')}</div>` : ''}
    <div class="small muted" style="margin-top:10px">Built from ${rows.length} resident position(s)${S.faculty.length ? `, ${evalFaculty().length} faculty` : ', no faculty yet (faculty items use a placeholder)'}${noBlocks ? ', and <b>no block schedule for this year</b> — end-of-rotation evaluations will be added once blocks are filled in and you generate again' : ' and the block schedule'}. Safe to run again any time; it only adds what's missing.</div>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button>${fresh.length ? '<button class="btn primary" id="evGo">Add evaluations</button>' : ''}</div>`);
  const go = $('#evGo'); if (go) go.onclick = () => { fresh.forEach(p => S.evals.items.push({ id: uid(), completed: '', na: false, notes: '', ...p })); save(); closeModal(); S.ui.evAY = ay; render(); toast(`${fresh.length} evaluations added`); };
};
ACT.evAdd = () => {
  const ay = S.ui.evAY || Math.max(acadYear(S.settings.programStart), acadYear(todayISO())), rows = blockRows(ay);
  const people = [...rows.map(r => [`resident:${r.key}`, r.label]), ...S.faculty.map(f => [`faculty:${f.id}`, f.name])];
  openModal(`<div class="modal-head"><h2>Add an evaluation</h2><button class="iconbtn" data-act="close">✕</button></div>
    <p class="small muted" style="margin-top:0">For one-off evaluations — Clinical Skills Verifications, medical-student feedback, a specific lecture, etc.</p>
    <div class="form"><label class="f full">Type<select id="eaT">${S.evals.types.map(t => `<option value="${t.id}" ${t.id === 'csv' ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label class="f">Evaluator<input type="text" id="eaE" list="eaPeople" placeholder="Name or role"></label><label class="f">Subject<input type="text" id="eaS" list="eaPeople" placeholder="Resident, faculty, rotation…"></label>
    <datalist id="eaPeople">${people.map(([, n]) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label class="f">Due<input type="date" id="eaD" value="${todayISO()}"></label><label class="f">Label / period<input type="text" id="eaP" placeholder="e.g. CSV #1, Block 4"></label>
    <label class="check"><input type="checkbox" id="eaC"> Already completed</label></div>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="eaGo">Add</button></div>`);
  const party = v => { const hit = people.find(([, n]) => n === v.trim()); if (!hit) return null; const [kind, ref] = hit[0].split(/:(.+)/); return { kind, ref }; };
  $('#eaGo').onclick = () => {
    const ev = $('#eaE').value.trim(), su = $('#eaS').value.trim(); if (!ev || !su) return toast('Enter an evaluator and a subject');
    const pe = party(ev), ps = party(su), due = $('#eaD').value || todayISO();
    S.evals.items.push({ id: uid(), sig: uid(), typeId: $('#eaT').value, ay: acadYear(due), period: $('#eaP').value.trim() || 'Ad hoc', due, evKind: pe ? pe.kind : 'role', evRef: pe?.ref, evText: pe ? '' : ev, subKind: ps ? ps.kind : 'text', subRef: ps?.ref, subText: ps ? '' : su, completed: $('#eaC').checked ? todayISO() : '', na: false, notes: '' });
    save(); closeModal(); S.ui.evAY = acadYear(due); render(); toast('Evaluation added');
  };
};
ACT.evEdit = el => {
  const i = S.evals.items.find(x => x.id === el.dataset.id), t = evType(i.typeId);
  openModal(`<div class="modal-head"><h2>${esc(t.name)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="small muted" style="margin:-8px 0 12px">${esc(i.period)} · ${esc(evEvaluator(i))} → ${esc(evSubject(i))}${t.anon ? ' · confidential' : ''}</div>
    <div class="form"><label class="f">Due<input type="date" data-bind="evals.items:${i.id}:due" value="${i.due}"></label><label class="f">Completed on<input type="date" data-bind="evals.items:${i.id}:completed" value="${i.completed || ''}"></label>
    ${i.evKind === 'role' ? `<label class="f full">Evaluator (name or role)<input type="text" data-bind="evals.items:${i.id}:evText" value="${esc(i.evText)}"></label>` : ''}
    <label class="check full"><input type="checkbox" data-bind="evals.items:${i.id}:na" ${i.na ? 'checked' : ''}> Waived / not applicable (leave, rotation change, etc.)</label>
    <label class="f full">Notes${t.anon ? ' (completion only — don\'t record confidential content here)' : ''}<textarea data-bind="evals.items:${i.id}:notes">${esc(i.notes || '')}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="eiDel">Delete</button><div class="spacer"></div><button class="btn" id="eiNow">Completed today</button><button class="btn primary" data-act="close">Save</button></div>`, { onClose: () => render() });
  $('#eiNow').onclick = () => { i.completed = todayISO(); save(); closeModal(); render(); };
  $('#eiDel').onclick = () => { S.evals.items = S.evals.items.filter(x => x !== i); save(); closeModal(); render(); };
};
/* summary used on the dashboard and resident record */
function evSummaryFor(kind, ref) { ensureEvals(); const its = S.evals.items; const owe = its.filter(i => i.evKind === kind && i.evRef === ref), about = its.filter(i => i.subKind === kind && i.subRef === ref); const f = L => ({ n: L.length, done: L.filter(i => i.completed).length, od: L.filter(i => evStatus(i) === 'overdue').length }); return { owe: f(owe), about: f(about) }; }
