/* Recruitment, Meetings (CCC/PEC/APE), Didactics, Residents & Milestones */
'use strict';

/* ======================= RECRUITMENT ======================= */
const APP_STAGES = ['Applied', 'Screened', 'Invited', 'Scheduled', 'Interviewed', 'Ranked', 'Matched'];
const APP_EXITS = ['Not invited', 'Withdrew', 'Do not rank'];
const DEFAULT_ITIN = `7:30  Breakfast & welcome (Program Director)
8:00  Program overview & Q&A
8:45  Faculty interviews (3 × 20 min)
10:00 Tour – Utah Valley Hospital & clinics
11:30 Lunch with faculty (and residents, once we have them)
12:30 Wrap-up, next steps, second-look info`;
function funnelHTML(appl) {
  const n = s => appl.filter(a => a.status === s).length;
  const max = Math.max(1, ...APP_STAGES.map(n));
  const seq = ['seq2', 'seq3', 'seq3', 'seq4', 'seq5', 'seq6', 'seq7'];
  return APP_STAGES.map((s, i) => `<div class="barrow" data-tip="<b>${s}</b>: ${n(s)} applicant(s)"><span>${s}</span><div class="meter" style="height:14px;border-radius:4px"><i style="width:${n(s) / max * 100}%;background:var(--${seq[i]});border-radius:4px"></i></div><span class="v">${n(s)}</span></div>`).join('') +
    `<div class="small muted" style="margin-top:4px">${APP_EXITS.map(s => `${s}: ${n(s)}`).join(' · ')}</div>`;
}
VIEWS.recruit = {
  title: 'Recruitment',
  render() {
    const tab = S.ui.recruitTab;
    const T = (k, l) => `<button class="${tab === k ? 'active' : ''}" data-act="rtab" data-t="${k}">${l}</button>`;
    return `<div class="page-head"><div><h1>Recruitment</h1><div class="sub">${esc(S.settings.cycle)} · applicants, interview days, scoring and rank list</div></div></div>
      <div class="tabs">${T('applicants', `Applicants (${S.applicants.filter(a => a.cycle === S.settings.cycle).length})`)}${T('days', `Interview days (${S.interviewDays.length})`)}${T('rubric', 'Scoring rubric')}${T('rank', 'Rank list')}</div>
      ${{ applicants: applicantsHTML, days: daysHTML, rubric: rubricHTML, rank: rankHTML }[tab]()}`;
  },
  after() { const q = $('#aq'); if (q) q.addEventListener('input', () => { S.ui.aq = q.value; const p = q.selectionStart; render(); const n = $('#aq'); n.focus(); n.setSelectionRange(p, p); }); const f = $('#afilter'); if (f) f.onchange = () => { S.ui.afilter = f.value; render(); }; },
};
ACT.rtab = el => { S.ui.recruitTab = el.dataset.t; save(); render(); };
function applicantsHTML() {
  const q = (S.ui.aq || '').toLowerCase(), f = S.ui.afilter || '';
  const all = S.applicants.filter(a => a.cycle === S.settings.cycle);
  const list = all.filter(a => (!q || [a.name, a.school, a.aamc, a.email].join(' ').toLowerCase().includes(q)) && (!f || a.status === f));
  const day = id => S.interviewDays.find(d => d.id === id);
  return `<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start" id="agrid">
    <div><div class="toolbar"><input type="search" id="aq" placeholder="Search name, school, AAMC ID…" value="${esc(S.ui.aq || '')}"><select id="afilter"><option value="">All statuses</option>${[...APP_STAGES, ...APP_EXITS].map(s => `<option ${f === s ? 'selected' : ''}>${s}</option>`).join('')}</select><div class="spacer"></div><button class="btn" data-act="importApps">Import ERAS CSV</button><button class="btn" data-act="appCSV">Export CSV</button><button class="btn primary" data-act="addApp">+ Applicant</button></div>
    <div class="card tablewrap" style="padding:0">${list.length ? `<table class="t"><thead><tr><th>Applicant</th><th>School</th><th>Status</th><th>Interview</th><th>Score</th><th>Flags</th></tr></thead><tbody>${list.map(a => { const sc = applicantScore(a); const d = day(a.dayId); return `<tr class="click" data-act="editApp" data-id="${a.id}"><td><b>${esc(a.name)}</b><div class="small muted">${esc(a.degree || '')}${a.aamc ? ' · ' + esc(a.aamc) : ''}</div></td><td>${esc(a.school || '')}</td><td><span class="chip ${APP_EXITS.includes(a.status) ? 'st-na' : a.status === 'Matched' ? 'st-done' : 'st-doing'}">${esc(a.status)}</span></td><td class="small">${d ? fmtDate(d.date, { noYear: 1 }) : '—'}</td><td><b>${sc ? round1(sc) : '—'}</b><span class="small muted"> ${a.scores?.length ? `(${a.scores.length})` : ''}</span></td><td class="small">${[a.signal ? '📶 Signal' : '', a.ties ? '🏔 Utah ties' : '', a.visa ? 'Visa' : '', a.rotated ? 'Rotated here' : ''].filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty"><b>${all.length ? 'No matches' : 'No applicants yet'}</b>${all.length ? 'Try a different search.' : 'Add applicants one at a time or import a CSV exported from ERAS / Thalamus.'}</div>`}</div></div>
    <div class="card"><h2>Pipeline</h2>${funnelHTML(all)}</div></div><style>@media (max-width:1000px){#agrid{grid-template-columns:1fr!important}}</style>`;
}
ACT.addApp = () => { const a = { id: uid(), cycle: S.settings.cycle, name: '', aamc: '', email: '', phone: '', school: '', degree: 'MD', gradYear: '', exams: '', status: 'Applied', dayId: '', signal: false, ties: false, visa: false, rotated: false, notes: '', scores: [] }; S.applicants.push(a); editApp(a.id, true); };
ACT.editApp = el => editApp(el.dataset.id);
function editApp(id, isNew) {
  const a = S.applicants.find(x => x.id === id);
  const fac = S.faculty.filter(f => (f.roles || []).includes('Interviewer')).map(f => f.name).concat(S.faculty.filter(f => !(f.roles || []).includes('Interviewer')).map(f => f.name));
  const scoreRows = () => (a.scores || []).map((sc, i) => { let s = 0, w = 0; S.rubric.forEach(r => { const v = +sc.c?.[r.id]; if (v) { s += v * r.weight; w += +r.weight; } }); return `<tr><td><input type="text" list="facl" value="${esc(sc.by)}" data-sc="${i}" data-k="by" placeholder="Interviewer" style="width:130px"></td>${S.rubric.map(r => `<td><select data-sc="${i}" data-c="${r.id}"><option value="">–</option>${[1, 2, 3, 4, 5].map(v => `<option ${+sc.c?.[r.id] === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td>`).join('')}<td><b>${w ? round1(s / w) : '—'}</b></td><td><button class="iconbtn" data-act="scDel" data-i="${i}">✕</button></td></tr><tr><td colspan="${S.rubric.length + 3}"><input type="text" value="${esc(sc.comment || '')}" data-sc="${i}" data-k="comment" placeholder="Comments" style="width:100%"></td></tr>`; }).join('');
  const html = () => `<div class="modal-head"><h2>${isNew ? 'New applicant' : esc(a.name)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f">Name<input type="text" data-bind="applicants:${id}:name" value="${esc(a.name)}" autofocus></label><label class="f">AAMC ID<input type="text" data-bind="applicants:${id}:aamc" value="${esc(a.aamc)}"></label>
    <label class="f">Email<input type="email" data-bind="applicants:${id}:email" value="${esc(a.email)}"></label><label class="f">Phone<input type="text" data-bind="applicants:${id}:phone" value="${esc(a.phone)}"></label>
    <label class="f">Medical school<input type="text" data-bind="applicants:${id}:school" value="${esc(a.school)}"></label><label class="f">Degree<select data-bind="applicants:${id}:degree">${['MD', 'DO', 'IMG'].map(d => `<option ${a.degree === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <label class="f">Graduation year<input type="text" data-bind="applicants:${id}:gradYear" value="${esc(a.gradYear)}"></label><label class="f">Exams (USMLE / COMLEX)<input type="text" data-bind="applicants:${id}:exams" value="${esc(a.exams)}" placeholder="Step 1 P · Step 2 245"></label>
    <label class="f">Status<select data-bind="applicants:${id}:status">${[...APP_STAGES, ...APP_EXITS].map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f">Interview day<select data-bind="applicants:${id}:dayId"><option value="">—</option>${S.interviewDays.slice().sort((x, y) => x.date.localeCompare(y.date)).map(d => `<option value="${d.id}" ${a.dayId === d.id ? 'selected' : ''}>${fmtDate(d.date, { wd: 1 })} (${S.applicants.filter(x => x.dayId === d.id).length}/${d.capacity || '∞'})</option>`).join('')}</select></label>
    <div class="f full" style="flex-direction:row;flex-wrap:wrap;gap:8px 18px;display:flex">${[['signal', 'Program signal'], ['ties', 'Utah / regional ties'], ['rotated', 'Rotated with us'], ['visa', 'Needs visa sponsorship']].map(([k, l]) => `<label class="check"><input type="checkbox" data-bind="applicants:${id}:${k}" ${a[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label class="f full">Notes<textarea data-bind="applicants:${id}:notes">${esc(a.notes)}</textarea></label></div>
    <div class="section-t">Interview scores (1–5 per rubric item, weighted) ${applicantScore(a) ? `· overall <b style="color:var(--ink)">${round1(applicantScore(a))}</b>` : ''}</div>
    <div class="tablewrap"><table class="t ms"><thead><tr><th>Interviewer</th>${S.rubric.map(r => `<th title="${esc(r.name)} (weight ${r.weight})" style="white-space:normal;min-width:70px;font-size:10px">${esc(r.name)}</th>`).join('')}<th>Avg</th><th></th></tr></thead><tbody>${scoreRows()}</tbody></table></div>
    <datalist id="facl">${fac.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <button class="btn sm" data-act="scAdd" style="margin-top:6px">+ Add interviewer score</button>
    <div class="modal-foot"><button class="btn danger" id="apDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Save</button></div>`;
  const sc = openModal(html(), { wide: true, onClose: () => { if (!a.name) S.applicants = S.applicants.filter(x => x !== a); save(); render(); } });
  const refresh = () => { const mm = sc.querySelector('.modal'); const st = sc.scrollTop; mm.innerHTML = html(); sc.scrollTop = st; wire(); };
  const wire = () => {
    $('#apDel').onclick = () => confirmBox(`Delete ${esc(a.name || 'applicant')}?`, () => { S.applicants = S.applicants.filter(x => x !== a); S.rankOrder = S.rankOrder.filter(x => x !== a.id); save(); render(); });
    $$('[data-sc]', sc).forEach(el => el.onchange = () => { const s = a.scores[+el.dataset.sc]; if (el.dataset.c) { (s.c ||= {})[el.dataset.c] = el.value ? +el.value : ''; save(); refresh(); } else { s[el.dataset.k] = el.value; save(); } });
  };
  ACT.scAdd = () => { (a.scores ||= []).push({ by: '', c: {}, comment: '' }); save(); refresh(); };
  ACT.scDel = el => { a.scores.splice(+el.dataset.i, 1); save(); refresh(); };
  wire();
}
ACT.appCSV = () => { const L = S.applicants.filter(a => a.cycle === S.settings.cycle); download(`applicants-${S.settings.cycle.replace(/\s/g, '')}.csv`, toCSV([['Name', 'AAMC ID', 'Email', 'School', 'Degree', 'Grad year', 'Exams', 'Status', 'Interview day', 'Score', 'Signal', 'Utah ties', 'Rotated', 'Visa', 'Notes'], ...L.map(a => [a.name, a.aamc, a.email, a.school, a.degree, a.gradYear, a.exams, a.status, S.interviewDays.find(d => d.id === a.dayId)?.date || '', round1(applicantScore(a)), a.signal ? 'Y' : '', a.ties ? 'Y' : '', a.rotated ? 'Y' : '', a.visa ? 'Y' : '', a.notes])]), 'text/csv'); };
ACT.importApps = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.txt,text/csv';
  inp.onchange = async () => {
    const rows = parseCSV(await inp.files[0].text()); if (rows.length < 2) return toast('No rows found');
    const h = rows[0].map(x => x.toLowerCase().trim());
    const col = (...res) => h.findIndex(x => res.some(r => r.test(x)));
    const c = { first: col(/^first/), last: col(/^last/), name: col(/^(applicant )?name$|full name/), aamc: col(/aamc/), email: col(/e-?mail/), phone: col(/phone/), school: col(/medical school|school/), degree: col(/^degree|medical degree/), grad: col(/grad/), signal: col(/signal/) };
    const examCols = h.map((x, i) => /usmle|comlex|step|level/.test(x) ? i : -1).filter(i => i >= 0);
    const g = (r, k) => c[k] >= 0 ? (r[c[k]] || '').trim() : '';
    const existing = new Set(S.applicants.map(a => a.aamc).filter(Boolean));
    const list = rows.slice(1).map(r => { const nm = g(r, 'name') || [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' '); const deg = g(r, 'degree').toUpperCase(); return { id: uid(), cycle: S.settings.cycle, name: nm, aamc: g(r, 'aamc'), email: g(r, 'email'), phone: g(r, 'phone'), school: g(r, 'school'), degree: /DO/.test(deg) ? 'DO' : /IMG|MBBS/.test(deg) ? 'IMG' : 'MD', gradYear: g(r, 'grad'), exams: examCols.map(i => r[i] ? `${rows[0][i]}: ${r[i]}` : '').filter(Boolean).join(' · '), status: 'Applied', dayId: '', signal: /^(y|yes|true|1)$/i.test(g(r, 'signal')), ties: false, visa: false, rotated: false, notes: '', scores: [] }; }).filter(a => a.name && !(a.aamc && existing.has(a.aamc)));
    confirmBox(`Import <b>${list.length}</b> applicant(s) into ${esc(S.settings.cycle)}? (Rows already present by AAMC ID are skipped.)<br><span class="small muted">Columns detected: ${Object.entries(c).filter(([, v]) => v >= 0).map(([k]) => k).join(', ')}${examCols.length ? ', exams' : ''}</span>`, () => { S.applicants.push(...list); save(); render(); toast(`${list.length} applicants imported`); }, 'Import');
  };
  inp.click();
};
function daysHTML() {
  const ds = S.interviewDays.slice().sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="toolbar"><span class="muted small">Interview season on the planner: ${S.tasks.filter(t => /interview season/i.test(t.name)).flatMap(t => t.months).map(ymLabel).join(', ') || '—'}</span><div class="spacer"></div><button class="btn primary" data-act="addDay">+ Interview day</button></div>
  ${ds.length ? `<div class="grid g3">${ds.map(d => { const booked = S.applicants.filter(a => a.dayId === d.id); return `<div class="card" style="cursor:pointer" data-act="editDay" data-id="${d.id}"><h2>${fmtDate(d.date, { wd: 1 })}<span class="spacer"></span><span class="chip">${esc(d.format)}</span></h2><div class="meter" style="height:10px"><i style="width:${d.capacity ? Math.min(100, booked.length / d.capacity * 100) : 0}%;background:var(--s3)"></i></div><div class="small muted" style="margin:4px 0 8px">${booked.length} of ${d.capacity || '—'} slots filled</div><div class="small">${booked.map(a => esc(a.name)).join(', ') || '<span class="muted">No applicants assigned</span>'}</div><div class="small muted" style="margin-top:6px">Interviewers: ${esc((d.interviewers || []).join(', ') || '—')}</div></div>`; }).join('')}</div>` : `<div class="card empty"><b>No interview days yet</b>Add the dates once they're set (see “Schedule Interview Days” on the planner).</div>`}`;
}
ACT.addDay = () => { const d = { id: uid(), date: todayISO(), format: 'In person', capacity: 8, interviewers: [], itinerary: DEFAULT_ITIN, notes: '' }; S.interviewDays.push(d); editInterviewDay(d.id); };
ACT.editDay = el => editInterviewDay(el.dataset.id);
function editInterviewDay(id) {
  const d = S.interviewDays.find(x => x.id === id); if (!d) return;
  const booked = S.applicants.filter(a => a.dayId === d.id);
  openModal(`<div class="modal-head"><h2>Interview day</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f">Date<input type="date" data-bind="interviewDays:${id}:date" value="${d.date}"></label><label class="f">Format<select data-bind="interviewDays:${id}:format">${['In person', 'Virtual', 'Hybrid'].map(x => `<option ${d.format === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="f">Capacity (applicants)<input type="number" data-bind="interviewDays:${id}:capacity" value="${d.capacity}"></label><div></div>
    <div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">Interviewers</span><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px">${S.faculty.length ? S.faculty.map(f => `<label class="check"><input type="checkbox" data-iv="${esc(f.name)}" ${(d.interviewers || []).includes(f.name) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('') : '<span class="small muted">Add faculty on the Faculty page to pick interviewers.</span>'}</div></div>
    <label class="f full">Day schedule / outline<textarea rows="7" data-bind="interviewDays:${id}:itinerary" style="font-family:ui-monospace,Menlo,monospace;font-size:13px">${esc(d.itinerary)}</textarea></label>
    <label class="f full">Notes (logistics, food, rooms, Zoom links)<textarea data-bind="interviewDays:${id}:notes">${esc(d.notes)}</textarea></label></div>
    <div class="section-t">Applicants (${booked.length})</div><div class="small">${booked.map(a => `<a href="#" data-act="editApp" data-id="${a.id}">${esc(a.name)}</a>`).join(' · ') || '<span class="muted">Assign applicants from their applicant record.</span>'}</div>
    <div class="modal-foot"><button class="btn danger" id="dDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Save</button></div>`, { onClose: () => { save(); render(); } });
  $$('[data-iv]').forEach(cb => cb.onchange = () => { d.interviewers = $$('[data-iv]').filter(c => c.checked).map(c => c.dataset.iv); save(); });
  $('#dDel').onclick = () => confirmBox('Delete this interview day? Assigned applicants will be unassigned.', () => { S.interviewDays = S.interviewDays.filter(x => x !== d); S.applicants.forEach(a => { if (a.dayId === d.id) a.dayId = ''; }); save(); render(); });
}
function rubricHTML() {
  return `<div class="card"><h2>Applicant scoring rubric<span class="spacer"></span><button class="btn sm" data-act="rubReset">Reset to defaults</button><button class="btn sm primary" data-act="rubAdd">+ Criterion</button></h2>
    <p class="small muted" style="margin-top:0">Interviewers score each criterion 1–5. An applicant's score is the weighted average across criteria, averaged across interviewers. Matches the “Interview Applicant Scoring Rubric” task on the planner.</p>
    <table class="t"><thead><tr><th>Criterion</th><th>What to look for</th><th style="width:90px">Weight</th><th></th></tr></thead><tbody>${S.rubric.map(r => `<tr><td><input type="text" data-bind="rubric:${r.id}:name" value="${esc(r.name)}" style="width:100%"></td><td><input type="text" data-bind="rubric:${r.id}:desc" value="${esc(r.desc)}" style="width:100%"></td><td><input type="number" step="0.5" min="0" data-bind="rubric:${r.id}:weight" value="${r.weight}" style="width:70px"></td><td><button class="iconbtn" data-act="rubDel" data-id="${r.id}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
}
ACT.rubAdd = () => { S.rubric.push({ id: uid(), name: 'New criterion', weight: 1, desc: '' }); save(); render(); };
ACT.rubDel = el => { S.rubric = S.rubric.filter(r => r.id !== el.dataset.id); save(); render(); };
ACT.rubReset = () => confirmBox('Replace the rubric with the defaults? Existing scores on removed criteria will no longer count.', () => { S.rubric = defaultRubric(); save(); render(); }, 'Reset');
function rankPool() {
  const pool = S.applicants.filter(a => a.cycle === S.settings.cycle && ['Interviewed', 'Ranked', 'Do not rank', 'Matched'].includes(a.status));
  const ordered = S.rankOrder.map(id => pool.find(a => a.id === id)).filter(Boolean);
  pool.filter(a => !ordered.includes(a)).sort((a, b) => (applicantScore(b) || 0) - (applicantScore(a) || 0)).forEach(a => ordered.push(a));
  return ordered;
}
function rankHTML() {
  const L = rankPool(); let n = 0;
  return `<div class="toolbar"><span class="small muted">Applicants with status Interviewed, Ranked or Do not rank appear here. Order is saved; new applicants drop in by score.</span><div class="spacer"></div><button class="btn" data-act="rankSort">Sort by score</button><button class="btn" data-act="rankCSV">Export CSV</button></div>
  <div style="max-width:760px">${L.length ? L.map((a, i) => { const dnr = a.status === 'Do not rank'; if (!dnr) n++; const sc = applicantScore(a); return `<div class="rank ${dnr ? 'dnr' : ''}"><span class="no">${dnr ? '–' : n}</span><div class="grow" style="flex:1;min-width:0"><a href="#" data-act="editApp" data-id="${a.id}"><b>${esc(a.name)}</b></a><div class="small muted">${esc(a.school || '')} · ${esc(a.degree)}${a.signal ? ' · signal' : ''}${a.ties ? ' · Utah ties' : ''}</div></div><b>${sc ? round1(sc) : '—'}</b><button class="iconbtn" data-act="rankMove" data-id="${a.id}" data-d="-1" title="Up">▲</button><button class="iconbtn" data-act="rankMove" data-id="${a.id}" data-d="1" title="Down">▼</button><button class="btn sm" data-act="rankDNR" data-id="${a.id}">${dnr ? 'Rank' : "Don't rank"}</button></div>`; }).join('') : `<div class="card empty"><b>Nothing to rank yet</b>Mark applicants as “Interviewed” after their interview day.</div>`}</div>`;
}
ACT.rankMove = el => { const L = rankPool().map(a => a.id), i = L.indexOf(el.dataset.id), j = i + +el.dataset.d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; S.rankOrder = L; save(); render(); };
ACT.rankSort = () => { S.rankOrder = rankPool().sort((a, b) => (applicantScore(b) || 0) - (applicantScore(a) || 0)).map(a => a.id); save(); render(); };
ACT.rankDNR = el => { const a = S.applicants.find(x => x.id === el.dataset.id); a.status = a.status === 'Do not rank' ? 'Ranked' : 'Do not rank'; S.rankOrder = rankPool().map(x => x.id); save(); render(); };
ACT.rankCSV = () => { let n = 0; download('rank-list.csv', toCSV([['Rank', 'Name', 'AAMC ID', 'School', 'Score', 'Status'], ...rankPool().map(a => [a.status === 'Do not rank' ? '' : ++n, a.name, a.aamc, a.school, round1(applicantScore(a)), a.status])]), 'text/csv'); };

/* ======================= MEETINGS ======================= */
const MTG_TYPES = ['CCC', 'PEC', 'APE', 'Faculty', 'Other'];
const MTG_NAMES = { CCC: 'Clinical Competency Committee', PEC: 'Program Evaluation Committee', APE: 'Annual Program Evaluation', Faculty: 'Faculty meeting', Other: 'Meeting' };
const MTG_AGENDA = {
  CCC: '1. Review prior action items\n2. Resident-by-resident review (evaluations, milestones, PRITE, procedure/psychotherapy logs, concerns)\n3. Milestone ratings — consensus\n4. Recommendations to the PD (advancement, focused learning plans, remediation)\n5. Action items',
  PEC: '1. Review prior action items\n2. Curriculum & rotation review\n3. Resident / faculty feedback and survey results\n4. ACGME requirements, citations, areas for improvement\n5. Update the action plan',
  APE: '1. Resident performance (aggregate milestones, PRITE)\n2. Faculty development\n3. Graduate performance (boards, placement)\n4. Program quality — ACGME surveys, evaluations\n5. Progress on last year\'s action plan\n6. SWOT & new action plan',
  Faculty: '1. Announcements\n2. Recruitment / interview updates\n3. Teaching & supervision\n4. Open discussion', Other: '',
};
const MTG_C = { CCC: 's1', PEC: 's2', APE: 's2', Faculty: 's5', Other: 's7' };
VIEWS.meetings = {
  title: 'CCC / PEC / Meetings',
  render() {
    const f = S.ui.mtgFilter, t = todayISO();
    const ms = S.meetings.filter(m => !f || m.type === f).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const up = ms.filter(m => m.date >= t), past = ms.filter(m => m.date < t).reverse();
    const row = m => { const open = (m.actions || []).filter(a => !a.done).length; return `<div class="li" style="cursor:pointer" data-act="editMtg" data-id="${m.id}"><span class="when">${fmtDate(m.date, { wd: 1 })}</span><span class="chip" style="border-color:var(--${MTG_C[m.type]});color:var(--ink)"><span class="dot" style="background:var(--${MTG_C[m.type]})"></span>${m.type}</span><div class="grow ellipsis"><b>${esc(m.title)}</b> <span class="small muted">${fmtTime(m.time)}${m.location ? ' · ' + esc(m.location) : ''}</span></div>${m.tentative ? '<span class="chip st-na">tentative</span>' : ''}${open ? `<span class="chip st-doing">${open} open action${open > 1 ? 's' : ''}</span>` : ''}</div>`; };
    return `<div class="page-head"><div><h1>CCC, PEC & Meetings</h1><div class="sub">Agendas, attendance, minutes and action items. CCC meets at least semiannually to recommend milestone ratings; the PEC runs the Annual Program Evaluation.</div></div><div class="spacer"></div><button class="btn" data-act="genCycle">Generate an academic-year cycle…</button><button class="btn primary" data-act="addMtg">+ Meeting</button></div>
      <div class="toolbar"><div class="seg">${['', ...MTG_TYPES].map(x => `<button class="${f === x ? 'active' : ''}" data-act="mtgF" data-f="${x}">${x || 'All'}</button>`).join('')}</div></div>
      <div class="grid g2"><div class="card"><h2>Upcoming</h2>${up.length ? `<div class="list">${up.map(row).join('')}</div>` : '<div class="muted">No upcoming meetings. Use “Generate an academic-year cycle” to lay out tentative CCC/PEC/APE dates.</div>'}</div>
      <div class="card"><h2>Past</h2>${past.length ? `<div class="list">${past.map(row).join('')}</div>` : '<div class="muted">None yet.</div>'}</div></div>`;
  },
};
ACT.mtgF = el => { S.ui.mtgFilter = el.dataset.f; save(); render(); };
ACT.addMtg = () => { const ty = S.ui.mtgFilter || 'CCC'; const m = { id: uid(), type: ty, title: MTG_NAMES[ty], date: todayISO(), time: '12:00', location: '', tentative: false, attendees: [], agenda: MTG_AGENDA[ty], minutes: '', actions: [], reviewed: [] }; S.meetings.push(m); editMeeting(m.id); };
ACT.editMtg = el => editMeeting(el.dataset.id);
function editMeeting(id) {
  const m = S.meetings.find(x => x.id === id); if (!m) return;
  const facs = S.faculty.filter(f => m.type === 'CCC' ? (f.roles || []).includes('CCC') : m.type === 'PEC' || m.type === 'APE' ? (f.roles || []).includes('PEC') : true);
  const pool = facs.length ? facs : S.faculty;
  const res = S.residents.filter(r => pgyOf(r, m.date) >= 1 && pgyOf(r, m.date) <= 4);
  const html = () => `<div class="modal-head"><h2>${esc(m.title || MTG_NAMES[m.type])}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f">Type<select data-bind="meetings:${id}:type" id="mtype">${MTG_TYPES.map(t => `<option ${m.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f">Title<input type="text" data-bind="meetings:${id}:title" value="${esc(m.title)}"></label>
    <label class="f">Date<input type="date" data-bind="meetings:${id}:date" value="${m.date}"></label><label class="f">Time<input type="time" data-bind="meetings:${id}:time" value="${m.time}"></label>
    <label class="f">Location / link<input type="text" data-bind="meetings:${id}:location" value="${esc(m.location)}"></label><label class="check" style="align-self:end;padding-bottom:8px"><input type="checkbox" data-bind="meetings:${id}:tentative" ${m.tentative ? 'checked' : ''}> Tentative date</label>
    <div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">Attendance ${facs.length ? '' : '(tag faculty as CCC / PEC on the Faculty page to filter this list)'}</span><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px">${pool.map(f => `<label class="check"><input type="checkbox" data-att="${f.id}" ${(m.attendees || []).includes(f.id) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('') || '<span class="small muted">No faculty added yet.</span>'}</div></div>
    ${m.type === 'CCC' ? `<div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">Residents reviewed</span><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px">${res.map(r => `<label class="check"><input type="checkbox" data-rv="${r.id}" ${(m.reviewed || []).includes(r.id) ? 'checked' : ''}> ${esc(r.name)} <span class="muted small">PGY-${pgyOf(r, m.date)}</span></label>`).join('') || '<span class="small muted">No active residents on this date.</span>'}</div>${res.length ? `<div class="small" style="margin-top:4px"><a href="#/residents" data-act="close">Enter milestone ratings on Residents →</a></div>` : ''}</div>` : ''}
    <label class="f full">Agenda<textarea rows="6" data-bind="meetings:${id}:agenda">${esc(m.agenda)}</textarea></label>
    <label class="f full">Minutes / decisions<textarea rows="5" data-bind="meetings:${id}:minutes">${esc(m.minutes)}</textarea></label></div>
    <div class="section-t">Action items</div>
    ${(m.actions || []).map((a, i) => `<div class="cl ${a.done ? 'done' : ''}"><input type="checkbox" ${a.done ? 'checked' : ''} data-ai="${i}" data-k="done"><input type="text" value="${esc(a.t)}" data-ai="${i}" data-k="t"><input type="text" value="${esc(a.owner || '')}" data-ai="${i}" data-k="owner" placeholder="Owner" style="width:110px;flex:none"><input type="date" value="${a.due || ''}" data-ai="${i}" data-k="due" style="flex:none"><button class="iconbtn" data-act="aiDel" data-i="${i}">✕</button></div>`).join('')}
    <button class="btn sm" data-act="aiAdd">+ Action item</button>
    <div class="modal-foot"><button class="btn danger" id="mDel">Delete</button><button class="btn" data-act="mtgPrint">Print agenda</button><div class="spacer"></div><button class="btn primary" data-act="close">Save</button></div>`;
  const sc = openModal(html(), { wide: true, onClose: () => { save(); render(); } });
  const refresh = () => { sc.querySelector('.modal').innerHTML = html(); wire(); };
  const wire = () => {
    $('#mDel').onclick = () => confirmBox('Delete this meeting?', () => { S.meetings = S.meetings.filter(x => x !== m); save(); render(); });
    $('#mtype').addEventListener('change', () => setTimeout(() => { if (!m.agenda || Object.values(MTG_AGENDA).includes(m.agenda)) m.agenda = MTG_AGENDA[m.type]; if (!m.title || Object.values(MTG_NAMES).includes(m.title)) m.title = MTG_NAMES[m.type]; save(); refresh(); }, 0));
    $$('[data-att]', sc).forEach(cb => cb.onchange = () => { m.attendees = $$('[data-att]', sc).filter(c => c.checked).map(c => c.dataset.att); save(); });
    $$('[data-rv]', sc).forEach(cb => cb.onchange = () => { m.reviewed = $$('[data-rv]', sc).filter(c => c.checked).map(c => c.dataset.rv); save(); });
    $$('[data-ai]', sc).forEach(el => el.onchange = () => { const a = m.actions[+el.dataset.ai]; a[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; save(); if (el.type === 'checkbox') refresh(); });
  };
  ACT.aiAdd = () => { (m.actions ||= []).push({ t: '', owner: '', due: '', done: false }); save(); refresh(); const ins = $$('[data-k="t"]', sc); ins.at(-1)?.focus(); };
  ACT.aiDel = el => { m.actions.splice(+el.dataset.i, 1); save(); refresh(); };
  ACT.mtgPrint = () => { const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print'); w.document.write(`<title>${esc(m.title)}</title><body style="font:14px system-ui;padding:30px;max-width:720px"><h2>${esc(m.title)}</h2><p>${fmtDate(m.date, { wd: 1 })} · ${fmtTime(m.time)} · ${esc(m.location)}</p><h3>Agenda</h3><pre style="font:inherit;white-space:pre-wrap">${esc(m.agenda)}</pre>${m.minutes ? `<h3>Minutes</h3><pre style="font:inherit;white-space:pre-wrap">${esc(m.minutes)}</pre>` : ''}${m.actions?.length ? `<h3>Action items</h3><ul>${m.actions.map(a => `<li>${a.done ? '☑' : '☐'} ${esc(a.t)} ${a.owner ? '— ' + esc(a.owner) : ''} ${a.due ? '(due ' + fmtDate(a.due) + ')' : ''}</li>`).join('')}</ul>` : ''}</body>`); w.document.close(); w.print(); };
  wire();
}
function nthWeekday(y, m, wd, n) { const d = new Date(y, m, 1); d.setDate(1 + (wd - d.getDay() + 7) % 7 + (n - 1) * 7); return toISO(d); }
ACT.genCycle = () => {
  const ay0 = acadYear(S.settings.programStart);
  openModal(`<div class="modal-head"><h2>Generate a meeting cycle</h2><button class="iconbtn" data-act="close">✕</button></div>
    <p class="small muted">Creates <b>tentative</b> meetings you can then move. Defaults: CCC in December and June (ahead of the two milestone reporting periods), PEC quarterly, and the APE in May. Dates land on the second Tuesday at noon.</p>
    <div class="form"><label class="f">Academic year<select id="gAY">${[-1, 0, 1, 2, 3].map(k => `<option value="${ay0 + k}" ${k === 0 ? 'selected' : ''}>${ayLabel(ay0 + k)}</option>`).join('')}</select></label><div></div>
    ${[['CCC', 'CCC — Dec & Jun'], ['PEC', 'PEC — Sep, Dec, Mar, Jun'], ['APE', 'APE — May'], ['Faculty', 'Faculty meeting — monthly']].map(([k, l], i) => `<label class="check"><input type="checkbox" id="g${k}" ${i < 3 ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="gGo">Create</button></div>`);
  $('#gGo').onclick = () => {
    const ay = +$('#gAY').value, mk = (type, mo) => { const y = mo >= 6 ? ay : ay + 1; S.meetings.push({ id: uid(), type, title: MTG_NAMES[type], date: nthWeekday(y, mo, 2, 2), time: '12:00', location: '', tentative: true, attendees: [], agenda: MTG_AGENDA[type], minutes: '', actions: [], reviewed: [] }); };
    let n = S.meetings.length;
    if ($('#gCCC').checked) [11, 5].forEach(mo => mk('CCC', mo));
    if ($('#gPEC').checked) [8, 11, 2, 5].forEach(mo => mk('PEC', mo));
    if ($('#gAPE').checked) mk('APE', 4);
    if ($('#gFaculty').checked) [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5].forEach(mo => mk('Faculty', mo));
    save(); closeModal(); render(); toast(`${S.meetings.length - n} tentative meetings added`);
  };
};

/* ======================= DIDACTICS ======================= */
const DSLOTS = [
  { id: 'all', time: '1–2 pm', label: 'All-class combined', min: 1 },
  { id: 'A', time: '2–3 pm', label: 'Track A · PGY-1/2', min: 1 },
  { id: '34', time: '2–3 pm', label: 'PGY-3/4 combined', min: 3 },
  { id: 'B', time: '3–4 pm', label: 'Track B · PGY-1/2', min: 1 },
  { id: 'P3', time: '3–4 pm', label: 'PGY-3 Psychotherapy Seminar', min: 3 },
  { id: 'C', time: '3–4 pm', label: 'PGY-4 · Track C', min: 4 },
  { id: 'G1', time: '4–5 pm', label: 'PGY-1 class-specific', min: 1 },
  { id: 'G2', time: '4–5 pm', label: 'PGY-2 class-specific', min: 2 },
  { id: 'P3b', time: '4–5 pm', label: 'PGY-3 Psychotherapy (cont.)', min: 3 },
  { id: 'D', time: '4–5 pm', label: 'PGY-4 · Track D', min: 4 },
];
function holidayName(iso) {
  const d = parseISO(iso), m = d.getMonth(), day = d.getDate();
  if (m === 6 && day === 4) return 'Independence Day';
  if (m === 6 && day === 24) return 'Pioneer Day';
  if (m === 10 && day >= 22 && day <= 28) return 'Thanksgiving';
  if ((m === 11 && day >= 24) || (m === 0 && day === 1)) return 'Holiday break';
  return '';
}
const isCancelled = iso => S.didactics.cancelled[iso] ?? !!holidayName(iso);
VIEWS.didactics = {
  title: 'Didactics',
  render() {
    const ay0 = acadYear(S.settings.programStart), ay = S.ui.didAY || ay0, k = ay - ay0 + 1; // classes present
    const slots = DSLOTS.filter(s => k >= s.min);
    const thu = []; let d = new Date(ay, 6, 1); while (d.getDay() !== 4) d.setDate(d.getDate() + 1); while (d <= new Date(ay + 1, 5, 30)) { thu.push(toISO(d)); d.setDate(d.getDate() + 7); }
    const active = thu.filter(x => !isCancelled(x));
    const filled = active.reduce((s, x) => s + slots.filter(sl => S.didactics.sessions[x + '|' + sl.id]?.topic).length, 0);
    let lastM = '';
    return `<div class="page-head"><div><h1>Didactics · Thursdays 1–5 pm</h1><div class="sub">Protected half-day at Utah Valley Hospital · columns follow the ramp-up (${k <= 0 ? 'no residents yet' : k >= 4 ? 'PGY-1 to PGY-4, steady state' : 'PGY-1' + (k > 1 ? ' to PGY-' + k : '') + ' present'})</div></div><div class="spacer"></div>
      <select id="didAY">${[0, 1, 2, 3, 4].map(i => `<option value="${ay0 + i}" ${ay === ay0 + i ? 'selected' : ''}>AY ${ayLabel(ay0 + i)}</option>`).join('')}</select><button class="btn" data-act="didCSV">Export CSV</button></div>
      <div class="grid g3" style="margin-bottom:14px"><div class="card stat"><span class="lbl">Protected Thursdays</span><span class="num" style="color:${active.length === 48 ? 'var(--good)' : 'var(--ink)'}">${active.length}<span style="font-size:16px;color:var(--ink-3)"> / 48 target</span></span><span class="cap">${thu.length - active.length} cancelled (holidays pre-marked; tap a date to toggle)</span></div>
      <div class="card stat"><span class="lbl">Sessions planned</span><span class="num">${filled}<span style="font-size:16px;color:var(--ink-3)"> / ${active.length * slots.length}</span></span><span class="cap">${slots.length} sessions per Thursday this year</span><div class="meter" style="margin-top:6px"><i style="width:${active.length * slots.length ? filled / (active.length * slots.length) * 100 : 0}%;background:var(--s4)"></i></div></div>
      <div class="card stat"><span class="lbl">Presenters</span><span class="num">${new Set(Object.entries(S.didactics.sessions).filter(([kk, v]) => acadYear(kk.split('|')[0]) === ay && v.presenter).map(([, v]) => v.presenter)).size}</span><span class="cap">distinct presenters this year</span></div></div>
      ${k <= 0 ? '<div class="card empty"><b>No residents this year</b>Pick an academic year from the menu.</div>' : `<div class="card tablewrap" style="padding:0;max-height:calc(100vh - 300px);overflow:auto"><table class="t did"><thead style="position:sticky;top:0;background:var(--surface);z-index:2"><tr><th>Thursday</th>${slots.map(s => `<th>${s.time}<small>${s.label}</small></th>`).join('')}</tr></thead><tbody>
      ${thu.map(x => { const off = isCancelled(x), hn = holidayName(x), mo = x.slice(0, 7), sep = mo !== lastM; lastM = mo; return `${sep ? `<tr><td colspan="${slots.length + 1}" style="background:var(--surface-2);font-weight:700;font-size:12px;padding:5px 8px">${MONTHS_LONG[+mo.slice(5) - 1]} ${mo.slice(0, 4)}</td></tr>` : ''}<tr class="${off ? 'off' : ''}"><td class="dt"><a href="#" data-act="didOff" data-d="${x}" title="Toggle no-didactics day">${fmtDate(x, { noYear: 1 })}</a>${off ? `<div class="small muted">${hn || 'Cancelled'}</div>` : hn ? `<div class="small" style="color:var(--warn)">${hn}?</div>` : ''}</td>${slots.map(s => { const v = S.didactics.sessions[x + '|' + s.id]; return `<td>${off ? '' : `<div class="cell ${v?.topic ? 'filled' : ''}" data-act="didCell" data-k="${x}|${s.id}">${v?.topic ? `${v.done ? '✓ ' : ''}${esc(v.topic)}<div class="p">${esc(v.presenter || '')}</div>` : '<span class="muted small">+</span>'}</div>`}</td>`; }).join('')}</tr>`; }).join('')}
      </tbody></table></div>`}`;
  },
  after() { const s = $('#didAY'); if (s) s.onchange = () => { S.ui.didAY = +s.value; save(); render(); }; },
};
ACT.didOff = el => { const d = el.dataset.d; S.didactics.cancelled[d] = !isCancelled(d); save(); render(); };
ACT.didCell = el => {
  const key = el.dataset.k, [date, sid] = key.split('|'), slot = DSLOTS.find(s => s.id === sid);
  const v = S.didactics.sessions[key] || { topic: '', presenter: '', notes: '', done: false };
  openModal(`<div class="modal-head"><h2>${fmtDate(date, { wd: 1 })} · ${slot.time}</h2><button class="iconbtn" data-act="close">✕</button></div><div class="small muted" style="margin:-8px 0 12px">${slot.label}</div>
    <div class="form"><label class="f full">Topic<input type="text" id="dT" value="${esc(v.topic)}" autofocus></label><label class="f">Presenter<input type="text" id="dP" list="dpl" value="${esc(v.presenter)}"><datalist id="dpl">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></label><label class="check" style="align-self:end;padding-bottom:8px"><input type="checkbox" id="dD" ${v.done ? 'checked' : ''}> Delivered</label>
    <label class="f full">Notes / readings / NI link<textarea id="dN">${esc(v.notes)}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="dClr">Clear</button><div class="spacer"></div><button class="btn primary" id="dSave">Save</button></div>`);
  $('#dSave').onclick = () => { const n = { topic: $('#dT').value.trim(), presenter: $('#dP').value.trim(), notes: $('#dN').value, done: $('#dD').checked }; if (n.topic) S.didactics.sessions[key] = n; else delete S.didactics.sessions[key]; save(); closeModal(); render(); };
  $('#dClr').onclick = () => { delete S.didactics.sessions[key]; save(); closeModal(); render(); };
};
ACT.didCSV = () => { const ay = S.ui.didAY; const rows = [['Date', 'Time', 'Session', 'Topic', 'Presenter', 'Delivered', 'Notes']]; Object.entries(S.didactics.sessions).filter(([k]) => acadYear(k.split('|')[0]) === ay).sort().forEach(([k, v]) => { const [d, s] = k.split('|'), sl = DSLOTS.find(x => x.id === s); rows.push([d, sl?.time, sl?.label, v.topic, v.presenter, v.done ? 'Y' : '', v.notes]); }); download(`didactics-${ayLabel(ay)}.csv`, toCSV(rows), 'text/csv'); };

/* ======================= RESIDENTS & MILESTONES ======================= */
// ACGME Psychiatry Milestones 2.0 subcompetencies
const MS = [
  ['PC1', 'Psychiatric Evaluation', 'PC'], ['PC2', 'Psychiatric Formulation & Differential Diagnosis', 'PC'], ['PC3', 'Treatment Planning & Management', 'PC'], ['PC4', 'Psychotherapeutic Interventions', 'PC'], ['PC5', 'Somatic Therapies', 'PC'],
  ['MK1', 'Development Through the Life Cycle', 'MK'], ['MK2', 'Psychopathology', 'MK'], ['MK3', 'Clinical Neuroscience', 'MK'], ['MK4', 'Psychotherapy', 'MK'], ['MK5', 'Somatic Therapies', 'MK'], ['MK6', 'Practice of Psychiatry', 'MK'],
  ['SBP1', 'Patient Safety & Quality Improvement', 'SBP'], ['SBP2', 'System Navigation for Patient-Centered Care', 'SBP'], ['SBP3', 'Physician Role in Health Care Systems', 'SBP'],
  ['PBLI1', 'Evidence-Based & Informed Practice', 'PBLI'], ['PBLI2', 'Reflective Practice & Commitment to Personal Growth', 'PBLI'],
  ['PROF1', 'Professional Behavior & Ethical Principles', 'PROF'], ['PROF2', 'Accountability / Conscientiousness', 'PROF'], ['PROF3', 'Well-Being', 'PROF'],
  ['ICS1', 'Patient- & Family-Centered Communication', 'ICS'], ['ICS2', 'Interprofessional & Team Communication', 'ICS'], ['ICS3', 'Communication within Health Care Systems', 'ICS'],
];
const DOMAINS = { PC: 'Patient Care', MK: 'Medical Knowledge', SBP: 'Systems-Based Practice', PBLI: 'Practice-Based Learning', PROF: 'Professionalism', ICS: 'Communication' };
const LEVELS = ['', '0', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
const periodsFor = r => [0, 1, 2, 3].flatMap(i => [`${r.classYear + i}-mid`, `${r.classYear + i}-end`]);
const periodLabel = p => { const [y, k] = p.split('-'); return `${ayLabel(+y)} ${k === 'mid' ? 'Mid-year' : 'Year-end'}`; };
const periodShort = p => { const [y, k] = p.split('-'); return `${String(+y).slice(2)}–${String(+y + 1).slice(2)} ${k === 'mid' ? 'Mid' : 'End'}`; };
function levelColor(v) { if (v === '' || v == null) return ''; const i = Math.min(7, Math.max(1, Math.round(+v / 5 * 6) + 1)); return `background:var(--seq${i});color:${i >= 5 ? '#fff' : 'var(--ink)'}`; }
VIEWS.residents = {
  title: 'Residents & Milestones',
  render() {
    const tab = S.ui.resTab, T = (k, l) => `<button class="${tab === k ? 'active' : ''}" data-act="restab" data-t="${k}">${l}</button>`;
    return `<div class="page-head"><div><h1>Residents & Milestones</h1><div class="sub">Roster by class, Psychiatry Milestones 2.0 by CCC review period, PRITE</div></div><div class="spacer"></div><button class="btn primary" data-act="addRes">+ Resident</button></div>
    <div class="tabs">${T('roster', `Roster (${S.residents.length})`)}${T('cohort', 'Milestones — cohort view')}${T('prite', 'PRITE')}</div>
    ${{ roster: rosterHTML, cohort: cohortHTML, prite: priteHTML }[tab]()}`;
  },
  after() { const s = $('#cohP'); if (s) s.onchange = () => { S.ui.cohP = s.value; save(); render(); }; },
};
ACT.restab = el => { S.ui.resTab = el.dataset.t; save(); render(); };
function rosterHTML() {
  if (!S.residents.length) return `<div class="card empty"><b>No residents yet</b>The first PGY-1 class starts ${fmtDate(S.settings.programStart)}. After Match Day, add the incoming class here (or move matched applicants over from Recruitment).<div style="margin-top:12px"><button class="btn" data-act="fromMatched">Add matched applicants as residents</button></div></div>`;
  const classes = [...new Set(S.residents.map(r => r.classYear))].sort();
  return classes.map(cy => { const rs = S.residents.filter(r => r.classYear === cy), p = pgyOf(rs[0]); return `<div class="card" style="margin-bottom:14px"><h2>Class of ${cy + 4} <span class="chip">${p < 1 ? 'Incoming' : p > 4 ? 'Graduated' : 'PGY-' + p}</span><span class="spacer"></span><span class="small muted">started ${ayLabel(cy)}</span></h2><div class="grid g3">${rs.map(r => { const last = periodsFor(r).filter(pp => r.milestones?.[pp] && Object.values(r.milestones[pp]).some(v => v !== '')).pop(); const a = last ? avg(Object.values(r.milestones[last]).filter(v => v !== '').map(Number)) : null; return `<div class="li" style="cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:10px" data-act="openRes" data-id="${r.id}"><div class="grow"><b>${esc(r.name)}</b><div class="small muted">${esc(r.school || '')}${r.advisor ? ' · advisor ' + esc(r.advisor) : ''}</div></div>${a != null ? `<div style="text-align:right"><b>${round1(a)}</b><div class="small muted">${periodShort(last)}</div></div>` : '<span class="small muted">no ratings</span>'}</div>`; }).join('')}</div></div>`; }).join('');
}
ACT.fromMatched = () => { const m = S.applicants.filter(a => a.status === 'Matched' && !S.residents.some(r => r.fromApp === a.id)); if (!m.length) return toast('No applicants marked “Matched” yet'); const cy = acadYear(S.settings.programStart) > acadYear(todayISO()) ? acadYear(S.settings.programStart) : acadYear(todayISO()) + 1; m.forEach(a => S.residents.push({ id: uid(), fromApp: a.id, name: a.name, email: a.email, school: a.school, classYear: cy, advisor: '', notes: '', milestones: {}, prite: [] })); save(); render(); toast(`${m.length} resident(s) added`); };
ACT.addRes = () => { const r = { id: uid(), name: '', email: '', school: '', classYear: acadYear(S.settings.programStart), advisor: '', notes: '', milestones: {}, prite: [] }; S.residents.push(r); openRes(r.id, true); };
ACT.openRes = el => openRes(el.dataset.id);
function msChart(r) {
  const ps = periodsFor(r).filter(p => r.milestones?.[p] && Object.values(r.milestones[p]).some(v => v !== ''));
  if (ps.length < 1) return '<div class="small muted">Enter ratings to see the trajectory chart.</div>';
  const W = 640, H = 220, L = 30, R = 120, T = 10, B = 26, all = periodsFor(r);
  const x = p => L + all.indexOf(p) * ((W - L - R) / (all.length - 1)), y = v => T + (5 - v) / 5 * (H - T - B);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto">`;
  for (let v = 0; v <= 5; v++) s += `<g class="grid"><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/></g><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  all.forEach((p, i) => { if (i % 2 === 0) s += `<text x="${x(p)}" y="${H - 6}" text-anchor="start">${ayLabel(+p.slice(0, 4))}</text>`; });
  const ends = [];
  Object.keys(DOMAINS).forEach((d, i) => {
    const pts = ps.map(p => { const vs = MS.filter(m => m[2] === d).map(m => r.milestones[p][m[0]]).filter(v => v !== '' && v != null).map(Number); return vs.length ? [p, avg(vs)] : null; }).filter(Boolean);
    if (!pts.length) return;
    s += `<polyline fill="none" stroke="var(--s${i + 1})" stroke-width="2" points="${pts.map(([p, v]) => `${x(p)},${y(v)}`).join(' ')}"/>`;
    pts.forEach(([p, v]) => s += `<circle cx="${x(p)}" cy="${y(v)}" r="4.5" fill="var(--s${i + 1})" stroke="var(--surface)" stroke-width="2" data-tip="<b>${DOMAINS[d]}</b><br>${periodLabel(p)}: ${round1(v)}"/>`);
    const [lp, lv] = pts.at(-1); ends.push({ y: y(lv), d, i });
  });
  ends.sort((a, b) => a.y - b.y); for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
  const lastX = x(ps.at(-1));
  ends.forEach(e => s += `<text x="${lastX + 10}" y="${e.y + 4}" style="fill:var(--ink-2);font-weight:600">${DOMAINS[e.d]}</text>`);
  return s + '</svg>';
}
function openRes(id, isNew) {
  const r = S.residents.find(x => x.id === id); r.milestones ||= {}; r.prite ||= [];
  const ps = periodsFor(r);
  const html = () => `<div class="modal-head"><h2>${isNew && !r.name ? 'New resident' : esc(r.name)} ${pgyOf(r) >= 1 && pgyOf(r) <= 4 ? `<span class="chip">PGY-${pgyOf(r)}</span>` : ''}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f">Name<input type="text" data-bind="residents:${id}:name" value="${esc(r.name)}" ${isNew ? 'autofocus' : ''}></label><label class="f">Class (start year)<select id="rCY">${[0, 1, 2, 3, 4, 5, 6].map(k => acadYear(S.settings.programStart) + k).map(y => `<option value="${y}" ${r.classYear === y ? 'selected' : ''}>Starts July ${y} · Class of ${y + 4}</option>`).join('')}</select></label>
    <label class="f">Email<input type="email" data-bind="residents:${id}:email" value="${esc(r.email)}"></label><label class="f">Medical school<input type="text" data-bind="residents:${id}:school" value="${esc(r.school)}"></label>
    <label class="f">Faculty advisor<input type="text" list="advl" data-bind="residents:${id}:advisor" value="${esc(r.advisor)}"><datalist id="advl">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></label><div></div>
    <label class="f full">Notes (strengths, learning plan, wellness check-ins)<textarea data-bind="residents:${id}:notes">${esc(r.notes)}</textarea></label></div>
    ${(() => { const e = evSummaryFor('resident', resRowKey(r)); return e.owe.n + e.about.n ? `<div class="section-t">Evaluations <a href="#" data-act="evPerson" data-q="${esc(r.name)}" style="text-transform:none;letter-spacing:0;font-weight:600">open tracker →</a></div><div class="grid g2" style="gap:10px"><div class="small">About ${esc(r.name.split(' ')[0] || 'them')}: <b>${e.about.done}/${e.about.n}</b> complete${e.about.od ? ` · <span style="color:var(--bad);font-weight:700">${e.about.od} overdue</span>` : ''}</div><div class="small">Owed by ${esc(r.name.split(' ')[0] || 'them')}: <b>${e.owe.done}/${e.owe.n}</b> complete${e.owe.od ? ` · <span style="color:var(--bad);font-weight:700">${e.owe.od} overdue</span>` : ''}</div></div>` : ''; })()}
    <div class="section-t">Milestone trajectory (domain averages)</div>${msChart(r)}
    <div class="section-t">Psychiatry Milestones 2.0 — CCC ratings</div>
    <div class="tablewrap"><table class="t ms"><thead><tr><th>Subcompetency</th>${ps.map(p => `<th style="text-align:center;font-size:10px">${periodShort(p)}</th>`).join('')}</tr></thead><tbody>${Object.keys(DOMAINS).map(d => `<tr><td colspan="${ps.length + 1}" style="background:var(--surface-2);font-weight:700;font-size:12px">${DOMAINS[d]}</td></tr>` + MS.filter(m => m[2] === d).map(m => `<tr><td><b>${m[0]}</b> <span class="small">${m[1]}</span></td>${ps.map(p => { const v = r.milestones[p]?.[m[0]] ?? ''; return `<td style="text-align:center"><select data-ms="${p}|${m[0]}" style="${levelColor(v)}">${LEVELS.map(l => `<option ${String(v) === l ? 'selected' : ''}>${l}</option>`).join('')}</select></td>`; }).join('')}</tr>`).join('')).join('')}</tbody></table></div>
    <div class="section-t">PRITE</div>
    ${r.prite.map((p, i) => `<div class="mrow"><input type="number" value="${p.year}" data-pr="${i}" data-k="year" style="width:90px;flex:none" placeholder="Year"><input type="number" value="${p.score ?? ''}" data-pr="${i}" data-k="score" placeholder="Score"><input type="number" value="${p.pct ?? ''}" data-pr="${i}" data-k="pct" placeholder="Percentile vs PGY"><button class="iconbtn" data-act="prDel" data-i="${i}">✕</button></div>`).join('')}
    <button class="btn sm" data-act="prAdd">+ PRITE result</button>
    <div class="modal-foot"><button class="btn danger" id="rDel">Remove resident</button><div class="spacer"></div><button class="btn primary" data-act="close">Save</button></div>`;
  const sc = openModal(html(), { wide: true, onClose: () => { if (!r.name) S.residents = S.residents.filter(x => x !== r); save(); render(); } });
  const refresh = () => { const st = sc.scrollTop; sc.querySelector('.modal').innerHTML = html(); sc.scrollTop = st; wire(); };
  const wire = () => {
    $('#rCY').onchange = e => { r.classYear = +e.target.value; save(); refresh(); };
    $$('[data-ms]', sc).forEach(el => el.onchange = () => { const [p, k] = el.dataset.ms.split('|'); (r.milestones[p] ||= {})[k] = el.value; save(); refresh(); });
    $$('[data-pr]', sc).forEach(el => el.onchange = () => { r.prite[+el.dataset.pr][el.dataset.k] = el.value === '' ? '' : +el.value; save(); });
    $('#rDel').onclick = () => confirmBox(`Remove ${esc(r.name || 'this resident')} and all their ratings?`, () => { S.residents = S.residents.filter(x => x !== r); save(); render(); }, 'Remove');
  };
  ACT.prAdd = () => { r.prite.push({ year: new Date().getFullYear(), score: '', pct: '' }); save(); refresh(); };
  ACT.prDel = el => { r.prite.splice(+el.dataset.i, 1); save(); refresh(); };
  wire();
}
function cohortHTML() {
  const allP = [...new Set(S.residents.flatMap(periodsFor))].sort();
  if (!S.residents.length) return '<div class="card empty"><b>No residents yet</b>Add residents to see the cohort heatmap used at CCC.</div>';
  const cur = acadYear(todayISO()), def = allP.find(p => p.startsWith(cur)) || allP[0];
  const P = S.ui.cohP && allP.includes(S.ui.cohP) ? S.ui.cohP : def;
  const rs = S.residents.filter(r => periodsFor(r).includes(P)).sort((a, b) => a.classYear - b.classYear || a.name.localeCompare(b.name));
  return `<div class="toolbar"><select id="cohP">${allP.map(p => `<option value="${p}" ${p === P ? 'selected' : ''}>${periodLabel(p)}</option>`).join('')}</select><span class="small muted">Click a resident to enter ratings. Darker = higher level.</span></div>
  <div class="card tablewrap" style="padding:0"><table class="t heat"><thead><tr><th>Resident</th>${MS.map(m => `<th style="font-size:10px;text-align:center" title="${esc(m[1])}">${m[0]}</th>`).join('')}<th>Avg</th></tr></thead><tbody>${rs.map(r => { const vals = r.milestones?.[P] || {}; const nums = MS.map(m => vals[m[0]]).filter(v => v !== '' && v != null).map(Number); return `<tr class="click" data-act="openRes" data-id="${r.id}"><td style="white-space:nowrap"><b>${esc(r.name)}</b> <span class="small muted">PGY-${+P.slice(0, 4) - r.classYear + 1}</span></td>${MS.map(m => { const v = vals[m[0]]; return `<td class="h" style="${levelColor(v)}" data-tip="<b>${esc(r.name)}</b><br>${m[0]} ${esc(m[1])}: ${v === '' || v == null ? 'not rated' : v}">${v ?? ''}</td>`; }).join('')}<td><b>${nums.length ? round1(avg(nums)) : '—'}</b></td></tr>`; }).join('')}</tbody></table></div>
  <div class="legend" style="margin-top:8px">${[1, 2, 3, 4, 5].map(v => `<span style="cursor:default"><i style="${levelColor(v)};width:22px;height:12px"></i>Level ${v}</span>`).join('')}</div>`;
}
function priteHTML() {
  const rows = S.residents.flatMap(r => (r.prite || []).map(p => ({ r, ...p }))).sort((a, b) => b.year - a.year || a.r.name.localeCompare(b.r.name));
  return rows.length ? `<div class="card tablewrap" style="padding:0"><table class="t"><thead><tr><th>Year</th><th>Resident</th><th>PGY</th><th>Score</th><th>Percentile</th><th style="width:40%"></th></tr></thead><tbody>${rows.map(x => `<tr class="click" data-act="openRes" data-id="${x.r.id}"><td>${x.year}</td><td><b>${esc(x.r.name)}</b></td><td>PGY-${x.year - x.r.classYear + 1}</td><td>${x.score ?? ''}</td><td>${x.pct ?? ''}</td><td><div class="meter"><i style="width:${+x.pct || 0}%;background:var(--s1)"></i></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty"><b>No PRITE results yet</b>Add results from each resident\'s record.</div>';
}
