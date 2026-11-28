/* v9 extras: onboarding, wellness, call schedule, interview-day mode, document library, APE report builder */
'use strict';
function ensureExtras() {
  S.onboarding ||= { items: [
    ['Contract signed', 0], ['Training license', 1], ['Background check & drug screen', 0], ['Immunizations / TB screen', 0], ['Badge & parking', 0],
    ['EHR training', 0], ['BLS certification', 1], ['ACLS certification', 1], ['New Innovations account', 0], ['Orientation attended', 0], ['Handbook acknowledged', 0], ['Directory photo', 0],
  ].map(([name, exp]) => ({ id: uid(), name, exp: !!exp })) };
  S.wellness ||= { events: [], cadence: 90 };
  S.call ||= { types: [{ id: uid(), name: 'Weeknight call', days: 'weekday', c: 's1' }, { id: uid(), name: 'Weekend day', days: 'weekend', c: 's3' }, { id: uid(), name: 'Weekend night', days: 'weekend', c: 's7' }], assign: {}, swaps: [] };
  S.docs ||= [];
}

/* ================= ONBOARDING (Residents tab) ================= */
function onboardHTML() {
  const rs = S.residents.slice().sort((a, b) => b.classYear - a.classYear || a.name.localeCompare(b.name)), items = S.onboarding.items, t = todayISO();
  if (!rs.length) return '<div class="card empty"><b>No residents yet</b>Add the incoming class after Match Day — each resident gets this checklist.</div>';
  const exp = credentialAlerts();
  return `${exp.length ? `<div class="card" style="margin-bottom:14px"><h2 style="color:var(--bad)">Credentials expiring or expired (${exp.length})</h2><div class="list">${exp.map(x => `<div class="li"><div class="grow"><b>${esc(x.r.name)}</b> · ${esc(x.item.name)}</div><span class="chip ${x.days < 0 ? 'st-blocked' : 'st-doing'}">${x.days < 0 ? 'expired ' + fmtDate(x.date) : 'expires ' + fmtDate(x.date)}</span></div>`).join('')}</div></div>` : ''}
  <div class="card tablewrap" style="padding:0"><table class="t onb"><thead><tr><th>Resident</th>${items.map(i => `<th title="${esc(i.name)}">${esc(i.name)}${i.exp ? ' <span title="Has an expiration date">⏳</span>' : ''}</th>`).join('')}<th>Done</th></tr></thead><tbody>
  ${rs.map(r => { const o = r.onb || {}, d = items.filter(i => o[i.id]?.done).length; return `<tr><td style="white-space:nowrap"><div style="display:flex;gap:8px;align-items:center">${avatar(r.photoId, r.name, 28)}<div><b>${esc(r.name)}</b><div class="small muted">Class of ${r.classYear + 4}</div></div></div></td>${items.map(i => { const v = o[i.id] || {}, ex = i.exp && v.exp ? daysBetween(t, v.exp) : null; return `<td class="onbc"><input type="checkbox" data-onb="${r.id}|${i.id}" ${v.done ? 'checked' : ''}>${i.exp ? `<input type="date" data-onbx="${r.id}|${i.id}" value="${v.exp || ''}" title="Expires" style="${ex != null && ex < 60 ? 'border-color:var(--bad);color:var(--bad)' : ''}">` : ''}</td>`; }).join('')}<td><b>${d}/${items.length}</b></td></tr>`; }).join('')}</tbody></table></div>
  <div class="toolbar" style="margin-top:10px"><span class="small muted">⏳ items take an expiration date; anything expiring within 60 days shows above and on the Dashboard.</span><div class="spacer"></div><button class="btn sm" data-act="onbEdit">Edit checklist items</button></div>`;
}
function credentialAlerts() {
  const t = todayISO(), out = [];
  (S.residents || []).forEach(r => (S.onboarding?.items || []).filter(i => i.exp).forEach(i => { const e = r.onb?.[i.id]?.exp; if (e) { const days = daysBetween(t, e); if (days <= 60) out.push({ r, item: i, date: e, days }); } }));
  return out.sort((a, b) => a.days - b.days);
}
document.addEventListener('change', e => {
  const a = e.target.closest('[data-onb],[data-onbx]'); if (!a) return;
  const [rid, iid] = (a.dataset.onb || a.dataset.onbx).split('|'), r = S.residents.find(x => x.id === rid); r.onb ||= {}; const v = (r.onb[iid] ||= {});
  if (a.dataset.onb) v.done = a.checked ? todayISO() : ''; else { v.exp = a.value; if (a.value) v.done ||= todayISO(); }
  save(); render();
});
ACT.onbEdit = () => {
  const html = () => `<div class="modal-head"><h2>Onboarding checklist items</h2><button class="iconbtn" data-act="close">✕</button></div>${S.onboarding.items.map((i, k) => `<div class="mrow"><input type="text" value="${esc(i.name)}" data-oi="${k}"><label class="check small"><input type="checkbox" data-oe="${k}" ${i.exp ? 'checked' : ''}> expires</label><button class="iconbtn" data-od="${k}">✕</button></div>`).join('')}<div class="mrow"><input type="text" id="oiNew" placeholder="New item"><button class="btn sm" id="oiAdd">Add</button></div><div class="modal-foot"><button class="btn primary" data-act="close">Done</button></div>`;
  const sc = openModal(html(), { onClose: () => render() });
  const wire = () => {
    $$('[data-oi]', sc).forEach(x => x.onchange = () => { S.onboarding.items[+x.dataset.oi].name = x.value; save(); });
    $$('[data-oe]', sc).forEach(x => x.onchange = () => { S.onboarding.items[+x.dataset.oe].exp = x.checked; save(); });
    $$('[data-od]', sc).forEach(x => x.onclick = () => { S.onboarding.items.splice(+x.dataset.od, 1); save(); sc.querySelector('.modal').innerHTML = html(); wire(); });
    $('#oiAdd').onclick = () => { const v = $('#oiNew').value.trim(); if (!v) return; S.onboarding.items.push({ id: uid(), name: v, exp: false }); save(); sc.querySelector('.modal').innerHTML = html(); wire(); };
  };
  wire();
};

/* ================= WELLNESS (Residents tab) ================= */
function wellnessHTML() {
  const t = todayISO(), cad = +S.wellness.cadence || 90, ev = S.wellness.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const rs = S.residents.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="grid g2"><div class="card"><h2>Wellness events <span class="spacer"></span><button class="btn sm primary" data-act="wevAdd">+ Event</button></h2>
    ${ev.length ? `<div class="list">${ev.map(e => `<div class="li" style="${e.date < t ? 'opacity:.55' : ''}"><span class="when">${fmtDate(e.date, { wd: 1, noYear: 1 })}</span><div class="grow"><a href="#" data-act="wevEdit" data-id="${e.id}"><b>${esc(e.title)}</b></a><div class="small muted">${esc(e.type)}${e.time ? ' · ' + fmtTime(e.time) : ''}${e.where ? ' · ' + esc(e.where) : ''}</div></div></div>`).join('')}</div>` : '<div class="muted small">Retreats, socials, resilience sessions, protected wellness half-days. Events also show on the Calendar.</div>'}</div>
    <div class="card"><h2>Advisor check-ins <span class="spacer"></span><label class="small" style="font-weight:500">every <input type="number" data-bind="wellness:-:cadence" value="${cad}" style="width:62px" data-rerender> days</label></h2>
    ${rs.length ? `<div class="list">${rs.map(r => { const last = (r.checkins || []).map(c => c.date).sort().pop(), d = last ? daysBetween(last, t) : null, due = d == null || d > cad; return `<div class="li"><div style="display:flex;gap:8px;align-items:center;flex:1;min-width:0">${avatar(r.photoId, r.name, 30)}<div class="grow"><b>${esc(r.name)}</b><div class="small muted">${last ? `Last check-in ${fmtDate(last, { noYear: 1 })} (${d} days ago)` : 'No check-ins yet'}${r.advisor ? ' · advisor ' + esc(r.advisor) : ''}</div></div></div>${due ? '<span class="chip st-doing">due</span>' : '<span class="chip st-done">ok</span>'}<button class="btn sm" data-act="chkAdd" data-id="${r.id}">+ Check-in</button></div>`; }).join('')}</div>
    <div class="small muted" style="margin-top:8px">Log that a check-in happened — keep private details out of the app.</div>` : '<div class="muted small">Add residents to track check-ins.</div>'}</div></div>`;
}
ACT.wevAdd = () => { const e = { id: uid(), title: '', date: todayISO(), time: '', type: 'Social', where: '', notes: '' }; S.wellness.events.push(e); wevEdit(e.id, true); };
ACT.wevEdit = el => wevEdit(el.dataset.id);
function wevEdit(id, isNew) {
  const e = S.wellness.events.find(x => x.id === id), b = k => `data-bind="wellness.events:${id}:${k}"`;
  openModal(`<div class="modal-head"><h2>${isNew ? 'New wellness event' : 'Wellness event'}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f full">Title<input type="text" ${b('title')} value="${esc(e.title)}" autofocus></label><label class="f">Date<input type="date" ${b('date')} value="${e.date}"></label><label class="f">Time<input type="time" ${b('time')} value="${e.time}"></label>
    <label class="f">Type<select ${b('type')}>${['Social', 'Retreat', 'Resilience / skills session', 'Protected wellness time', 'Other'].map(x => `<option ${e.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">Where<input type="text" ${b('where')} value="${esc(e.where)}"></label>
    <label class="f full">Notes<textarea ${b('notes')}>${esc(e.notes)}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="weDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { onClose: () => { if (!e.title) S.wellness.events = S.wellness.events.filter(x => x !== e); save(); render(); } });
  $('#weDel').onclick = () => { closeModal(); withUndo('Event deleted', () => { S.wellness.events = S.wellness.events.filter(x => x !== e); }); };
}
ACT.chkAdd = el => {
  const r = S.residents.find(x => x.id === el.dataset.id);
  openModal(`<div class="modal-head"><h2>Check-in · ${esc(r.name)}</h2><button class="iconbtn" data-act="close">✕</button></div><div class="form"><label class="f">Date<input type="date" id="ckD" value="${todayISO()}"></label><label class="f">With<input type="text" id="ckB" value="${esc(r.advisor || '')}" list="ckL"><datalist id="ckL">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></label><label class="f full">Follow-up needed? (optional, keep it general)<input type="text" id="ckN"></label></div>
    ${(r.checkins || []).length ? `<div class="section-t">History</div>${r.checkins.slice().reverse().map(c => `<div class="small">${fmtDate(c.date)} · ${esc(c.by || '')}${c.note ? ' — ' + esc(c.note) : ''}</div>`).join('')}` : ''}
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="ckGo">Log check-in</button></div>`);
  $('#ckGo').onclick = () => { (r.checkins ||= []).push({ date: $('#ckD').value || todayISO(), by: $('#ckB').value.trim(), note: $('#ckN').value.trim() }); save(); closeModal(); render(); toast('Check-in logged'); };
};

/* ================= CALL SCHEDULE (Block Schedule tab) ================= */
const isWeekend = iso => [0, 6].includes(parseISO(iso).getDay());
function callHTML() {
  const ym = S.ui.callMonth || (curYM() < S.settings.programStart.slice(0, 7) ? S.settings.programStart.slice(0, 7) : curYM());
  const [y, m] = ym.split('-').map(Number), days = new Date(y, m, 0).getDate(), ay = acadYear(`${ym}-01`), rows = blockRows(ay);
  const opts = sel => `<option value="">—</option>${rows.map(r => `<option value="${r.key}" ${sel === r.key ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}`;
  const T = S.call.types, cnt = {}; rows.forEach(r => cnt[r.key] = {});
  Object.entries(S.call.assign).forEach(([k, v]) => { const [d, tid] = k.split('|'); if (acadYear(d) === ay && cnt[v]) cnt[v][tid] = (cnt[v][tid] || 0) + 1; });
  let body = '';
  for (let d = 1; d <= days; d++) {
    const iso = `${ym}-${pad(d)}`, we = isWeekend(iso);
    body += `<tr class="${we ? 'we' : ''} ${iso === todayISO() ? 'today' : ''}"><td style="white-space:nowrap"><b>${parseISO(iso).toLocaleDateString(undefined, { weekday: 'short' })}</b> ${d}</td>${T.map(t => { const ok = t.days === 'all' || (t.days === 'weekend') === we; const v = S.call.assign[`${iso}|${t.id}`] || ''; return `<td>${ok ? `<select data-call="${iso}|${t.id}" style="${v ? `border-left:4px solid var(--${t.c})` : ''}">${opts(v)}</select>` : ''}</td>`; }).join('')}</tr>`;
  }
  return `<div class="toolbar"><button class="btn" data-act="callNav" data-d="-1">‹</button><b style="min-width:150px;text-align:center;font-size:16px">${MONTHS_LONG[m - 1]} ${y}</b><button class="btn" data-act="callNav" data-d="1">›</button><div class="spacer"></div><button class="btn" data-act="callFill" data-ym="${ym}">Auto-fill empty</button><button class="btn" data-act="callTypes">Call types</button><button class="btn" data-act="callCSV" data-ym="${ym}">Export CSV</button></div>
  ${!rows.length ? '<div class="card empty"><b>No residents this academic year</b>Call starts with the first class.</div>' : `<div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start" id="callgrid">
  <div class="card tablewrap" style="padding:0"><table class="t calltab"><thead><tr><th>Date</th>${T.map(t => `<th><span class="dot" style="background:var(--${t.c})"></span> ${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
  <div><div class="card"><h2>AY ${ayLabel(ay)} totals</h2><table class="t"><thead><tr><th>Resident</th>${T.map(t => `<th title="${esc(t.name)}"><span class="dot" style="background:var(--${t.c})"></span></th>`).join('')}<th>All</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td>${T.map(t => `<td>${cnt[r.key][t.id] || 0}</td>`).join('')}<td><b>${Object.values(cnt[r.key]).reduce((s, x) => s + x, 0)}</b></td></tr>`).join('')}</tbody></table></div>
  <div class="card" style="margin-top:14px"><h2>Swap log</h2>${S.call.swaps.filter(s => acadYear(s.date) === ay).slice(-12).reverse().map(s => `<div class="small">${fmtDate(s.date, { noYear: 1 })} · ${esc(T.find(t => t.id === s.type)?.name || '')}: ${esc(resLabel(s.from))} → ${esc(resLabel(s.to))}</div>`).join('') || '<div class="small muted">Changing an already-filled shift is logged here as a swap.</div>'}</div></div></div>
  <style>@media (max-width:900px){#callgrid{grid-template-columns:1fr!important}}</style>`}`;
}
document.addEventListener('change', e => {
  const el = e.target.closest('[data-call]'); if (!el) return;
  const k = el.dataset.call, prev = S.call.assign[k];
  if (prev && el.value && prev !== el.value) S.call.swaps.push({ date: k.split('|')[0], type: k.split('|')[1], from: prev, to: el.value, at: todayISO() });
  if (el.value) S.call.assign[k] = el.value; else delete S.call.assign[k];
  save(); render();
});
ACT.callNav = el => { const cur = S.ui.callMonth || (curYM() < S.settings.programStart.slice(0, 7) ? S.settings.programStart.slice(0, 7) : curYM()); S.ui.callMonth = ymAdd(cur, +el.dataset.d); save(); render(); };
ACT.callFill = el => {
  const ym = el.dataset.ym, [y, m] = ym.split('-').map(Number), ay = acadYear(`${ym}-01`), rows = blockRows(ay); if (!rows.length) return;
  const load = {}; rows.forEach(r => load[r.key] = 0); Object.entries(S.call.assign).forEach(([k, v]) => { if (acadYear(k.split('|')[0]) === ay && v in load) load[v]++; });
  let n = 0;
  withUndo('Call auto-filled', () => {
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const iso = `${ym}-${pad(d)}`, we = isWeekend(iso), busy = new Set(S.call.types.map(t => S.call.assign[`${iso}|${t.id}`]).filter(Boolean));
      S.call.types.forEach(t => { if (!(t.days === 'all' || (t.days === 'weekend') === we)) return; const k = `${iso}|${t.id}`; if (S.call.assign[k]) return;
        const pick = rows.map(r => r.key).filter(x => !busy.has(x)).sort((a, b) => load[a] - load[b])[0]; if (!pick) return; S.call.assign[k] = pick; load[pick]++; busy.add(pick); n++; });
    }
  });
  toast(`${n} shifts filled, balancing totals`);
};
ACT.callTypes = () => {
  const html = () => `<div class="modal-head"><h2>Call types</h2><button class="iconbtn" data-act="close">✕</button></div>${S.call.types.map((t, k) => `<div class="mrow"><input type="text" value="${esc(t.name)}" data-ct="${k}"><select data-cd="${k}">${[['weekday', 'Weekdays'], ['weekend', 'Weekends'], ['all', 'Every day']].map(([v, l]) => `<option value="${v}" ${t.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="iconbtn" data-cx="${k}">✕</button></div>`).join('')}<button class="btn sm" id="ctAdd">+ Call type</button><div class="modal-foot"><button class="btn primary" data-act="close">Done</button></div>`;
  const sc = openModal(html(), { onClose: () => render() });
  const wire = () => {
    $$('[data-ct]', sc).forEach(x => x.onchange = () => { S.call.types[+x.dataset.ct].name = x.value; save(); });
    $$('[data-cd]', sc).forEach(x => x.onchange = () => { S.call.types[+x.dataset.cd].days = x.value; save(); });
    $$('[data-cx]', sc).forEach(x => x.onclick = () => { S.call.types.splice(+x.dataset.cx, 1); save(); sc.querySelector('.modal').innerHTML = html(); wire(); });
    $('#ctAdd').onclick = () => { S.call.types.push({ id: uid(), name: 'New call type', days: 'all', c: 's' + (S.call.types.length % 8 + 1) }); save(); sc.querySelector('.modal').innerHTML = html(); wire(); };
  };
  wire();
};
ACT.callCSV = el => { const ym = el.dataset.ym, [y, m] = ym.split('-').map(Number), rows = [['Date', ...S.call.types.map(t => t.name)]]; for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) { const iso = `${ym}-${pad(d)}`; rows.push([iso, ...S.call.types.map(t => { const v = S.call.assign[`${iso}|${t.id}`]; return v ? resLabel(v) : ''; })]); } download(`call-${ym}.csv`, toCSV(rows), 'text/csv'); };

/* ================= INTERVIEW-DAY MODE ================= */
ACT.dayMode = el => dayMode(el.dataset.id);
function dayMode(dayId) {
  const d = S.interviewDays.find(x => x.id === dayId), apps = S.applicants.filter(a => a.dayId === dayId).sort((a, b) => a.name.localeCompare(b.name));
  const me = S.ui.ivMe || '', facNames = S.faculty.map(f => f.name);
  const myScore = a => (a.scores || []).find(s => s.by === me);
  const html = () => `<div class="modal-head"><h2>Interview day · ${fmtDate(d.date, { wd: 1 })}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="toolbar"><label class="small" style="font-weight:600">I am <select id="dmMe"><option value="">— choose —</option>${facNames.map(n => `<option ${n === me ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><span class="small muted">${apps.length} applicant${apps.length === 1 ? '' : 's'} · ${esc(d.format)}</span></div>
    ${d.itinerary ? `<details class="small" style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:600">Day schedule</summary><pre style="white-space:pre-wrap;font:inherit">${esc(d.itinerary)}</pre></details>` : ''}
    ${!apps.length ? '<div class="empty"><b>No applicants assigned</b>Assign applicants to this day from their applicant record.</div>' : apps.map(a => { const sc = myScore(a); return `<div class="dm-card">
      <div class="dm-top">${avatar(a.photoId, a.name, 64)}<div style="min-width:0"><b style="font-size:16px">${esc(a.name)}</b><div class="small muted">${esc(a.school || '')}${a.degree ? ' · ' + esc(a.degree) : ''}</div><div class="small">${[a.signal ? '📶 Signal' : '', a.ties ? '🏔 Utah ties' : '', a.rotated ? 'Rotated here' : ''].filter(Boolean).join(' · ')}</div>
      <div class="small muted" style="margin-top:2px">Interviewers: ${(a.ivBy || []).map(esc).join(', ') || '—'} <a href="#" data-dmiv="${a.id}">edit</a></div></div></div>
      ${me ? `<div class="dm-scores">${S.rubric.map(r => `<div class="dm-row"><span class="small" title="${esc(r.desc)}">${esc(r.name)}</span><div class="seg">${[1, 2, 3, 4, 5].map(v => `<button class="${+sc?.c?.[r.id] === v ? 'active' : ''}" data-dms="${a.id}|${r.id}|${v}">${v}</button>`).join('')}</div></div>`).join('')}
      <input type="text" placeholder="Quick note" value="${esc(sc?.comment || '')}" data-dmn="${a.id}" style="width:100%;margin-top:6px">${applicantScore(a) ? `<div class="small muted" style="margin-top:4px">Overall so far: <b>${round1(applicantScore(a))}</b> from ${a.scores.length} interviewer(s)</div>` : ''}</div>` : '<div class="small muted">Choose “I am” above to score.</div>'}</div>`; }).join('')}
    <div class="modal-foot"><button class="btn primary" data-act="close">Done</button></div>`;
  const sc = openModal(html(), { wide: true, onClose: () => render() });
  const refresh = () => { const st = sc.scrollTop; sc.querySelector('.modal').innerHTML = html(); sc.scrollTop = st; wire(); };
  const mine = a => { let s = (a.scores ||= []).find(x => x.by === S.ui.ivMe); if (!s) { s = { by: S.ui.ivMe, c: {}, comment: '' }; a.scores.push(s); } if (a.status === 'Scheduled' || a.status === 'Invited') a.status = 'Interviewed'; return s; };
  const wire = () => {
    $('#dmMe').onchange = e => { S.ui.ivMe = e.target.value; save(); dayMode(dayId); };
    $$('[data-dms]', sc).forEach(b => b.onclick = () => { const [aid, rid, v] = b.dataset.dms.split('|'), a = S.applicants.find(x => x.id === aid); mine(a).c[rid] = +v; save(); refresh(); });
    $$('[data-dmn]', sc).forEach(i => i.onchange = () => { mine(S.applicants.find(x => x.id === i.dataset.dmn)).comment = i.value; save(); });
    $$('[data-dmiv]', sc).forEach(l => l.onclick = ev => { ev.preventDefault(); const a = S.applicants.find(x => x.id === l.dataset.dmiv); const v = prompt('Interviewers for ' + a.name + ' (comma-separated):', (a.ivBy || []).join(', ')); if (v != null) { a.ivBy = v.split(',').map(x => x.trim()).filter(Boolean); save(); refresh(); } });
  };
  wire();
}

/* ================= DOCUMENT LIBRARY ================= */
const DOC_CATS = ['Policy', 'Affiliation agreement (PLA)', 'Handbook', 'Meeting minutes', 'Curriculum', 'Accreditation', 'Forms & templates', 'Other'];
VIEWS.docs = {
  title: 'Documents',
  render() {
    const q = (S.ui.docQ || '').toLowerCase(), D = S.docs.filter(d => !q || [d.title, d.cat, d.notes].join(' ').toLowerCase().includes(q));
    const plas = (S.sites || []).filter(s => s.plaUrl);
    return `<div class="page-head"><div><h1>Documents</h1><div class="sub">Links to policies, PLAs, the handbook, minutes and forms — the files stay in SharePoint / OneDrive / Drive</div></div><div class="spacer"></div><button class="btn primary" data-act="docAdd">+ Document</button></div>
    <div class="toolbar"><input type="search" id="docQ" placeholder="Search documents…" value="${esc(S.ui.docQ || '')}"></div>
    ${D.length || plas.length ? `<div class="grid g2">${DOC_CATS.map(c => { const list = D.filter(d => d.cat === c); const extra = c.startsWith('Affiliation') ? plas.filter(s => !q || s.name.toLowerCase().includes(q)) : []; if (!list.length && !extra.length) return ''; return `<div class="card"><h2>${esc(c)}</h2><div class="list">${list.map(d => `<div class="li"><div class="grow" style="min-width:0"><a href="${esc(d.url)}" target="_blank" rel="noopener"><b>${esc(d.title)}</b></a><div class="small muted">${d.date ? 'Updated ' + fmtDate(d.date) : ''}${d.notes ? (d.date ? ' · ' : '') + esc(d.notes) : ''}</div></div><button class="iconbtn" data-act="docEdit" data-id="${d.id}" title="Edit">✎</button></div>`).join('')}${extra.map(s => `<div class="li"><div class="grow"><a href="${esc(s.plaUrl)}" target="_blank" rel="noopener"><b>${esc(s.name)} PLA</b></a><div class="small muted">from Training Sites ${plaChip(s)}</div></div></div>`).join('')}</div></div>`; }).join('')}</div>`
      : `<div class="card empty"><b>No documents yet</b>Add links to the resident handbook, policies, signed PLAs, and meeting minutes so they're one tap away.</div>`}`;
  },
  after() { const q = $('#docQ'); if (q) q.addEventListener('input', () => { S.ui.docQ = q.value; const p = q.selectionStart; render(); const n = $('#docQ'); n.focus(); n.setSelectionRange(p, p); }); },
};
ACT.docAdd = () => { const d = { id: uid(), title: '', cat: 'Policy', url: '', date: todayISO(), notes: '' }; S.docs.push(d); docEdit(d.id, true); };
ACT.docEdit = el => docEdit(el.dataset.id);
function docEdit(id, isNew) {
  const d = S.docs.find(x => x.id === id), b = k => `data-bind="docs:${id}:${k}"`;
  openModal(`<div class="modal-head"><h2>${isNew ? 'Add document' : 'Document'}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f full">Title<input type="text" ${b('title')} value="${esc(d.title)}" autofocus></label><label class="f">Category<select ${b('cat')}>${DOC_CATS.map(c => `<option ${d.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="f">Last updated<input type="date" ${b('date')} value="${d.date}"></label>
    <label class="f full">Link<input type="text" ${b('url')} value="${esc(d.url)}" placeholder="https://… (SharePoint, OneDrive, Drive)"></label><label class="f full">Notes<input type="text" ${b('notes')} value="${esc(d.notes)}" placeholder="Version, approval date, owner"></label></div>
    <div class="modal-foot"><button class="btn danger" id="dcDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { onClose: () => { if (!d.title) S.docs = S.docs.filter(x => x !== d); save(); render(); } });
  $('#dcDel').onclick = () => { closeModal(); withUndo('Document deleted', () => { S.docs = S.docs.filter(x => x !== d); }); };
}

/* ================= APE REPORT BUILDER ================= */
ACT.apeBuild = () => {
  const ay0 = acadYear(S.settings.programStart), cur = Math.max(ay0, acadYear(todayISO()));
  openModal(`<div class="modal-head"><h2>Build Annual Program Evaluation report</h2><button class="iconbtn" data-act="close">✕</button></div>
    <p class="small muted" style="margin-top:0">Drafts the APE from data already in the app — residents, milestones, PRITE, evaluation completion, anonymous-report themes, faculty development, accreditation readiness, and last year's action items. Strengths/weaknesses and the action plan are left for the PEC to write.</p>
    <label class="f">Academic year<select id="apeAY">${[-1, 0, 1, 2, 3, 4].map(k => cur + k).filter(y => y >= ay0 - 1).map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${ayLabel(y)}</option>`).join('')}</select></label>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="apeGo">Build report</button></div>`);
  $('#apeGo').onclick = () => { const ay = +$('#apeAY').value; closeModal(); openAPE(ay); };
};
function apeHTML(ay) {
  ensureBlocks(); ensureEvals(); ensureReports(); ensureSites();
  const inAY = iso => iso && acadYear(iso) === ay, rows = blockRows(ay);
  const byPgy = [1, 2, 3, 4].map(p => rows.filter(r => r.pgy === p && r.named).length);
  const endP = `${ay}-end`, midP = `${ay}-mid`;
  const domAvg = (p) => Object.keys(DOMAINS).map(d => { const vs = S.residents.flatMap(r => MS.filter(m => m[2] === d).map(m => r.milestones?.[p]?.[m[0]])).filter(v => v !== '' && v != null).map(Number); return [DOMAINS[d], vs.length ? round1(avg(vs)) : '—']; });
  const prite = S.residents.flatMap(r => (r.prite || []).filter(x => +x.year === ay + 1 || +x.year === ay).map(x => ({ r, ...x })));
  const ev = S.evals.items.filter(i => i.ay === ay && !i.na), evG = g => { const L = ev.filter(i => evGroup(evType(i.typeId) || {}) === g); return L.length ? `${Math.round(L.filter(i => i.completed).length / L.length * 100)}% (${L.filter(i => i.completed).length}/${L.length})` : '—'; };
  const rp = S.reports.items.filter(r => !r.sample && inAY(toISO(new Date(r.received)))), cats = {}; rp.forEach(r => cats[r.category] = (cats[r.category] || 0) + 1);
  const acc = S.accreditation, accD = acc.filter(a => a.status === 'done' || a.status === 'na').length;
  const prevAPE = S.meetings.filter(m => m.type === 'APE' && acadYear(m.date) === ay - 1).flatMap(m => m.actions || []);
  const fd = S.faculty.reduce((s, f) => s + (+f.fdHours || 0), 0);
  const tr = (a, b) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>APE ${ayLabel(ay)} — ${esc(S.settings.programName)}</title><style>body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;max-width:820px;margin:30px auto;padding:0 20px;color:#111}h1{margin:0;color:#0f2c4f}h2{border-bottom:2px solid #0f2c4f;padding-bottom:3px;margin-top:28px;font-size:17px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}.box{border:1px dashed #999;min-height:90px;border-radius:6px;padding:8px;color:#888}.muted{color:#666;font-size:12.5px}@media print{.noprint{display:none}}</style></head><body>
  <div class="noprint" style="text-align:right"><button onclick="print()">Print / Save as PDF</button></div>
  <h1>Annual Program Evaluation</h1><div>${esc(S.settings.programName)} · Academic year ${ayLabel(ay)}</div><div class="muted">Draft generated ${fmtDate(todayISO())} from the Residency Tracker. Review every number before the PEC meeting.</div>
  <h2>1. Program overview</h2><table>${tr('Residents (PGY-1 / 2 / 3 / 4)', byPgy.join(' / ') + ` (total ${byPgy.reduce((s, x) => s + x, 0)})`)}${tr('Faculty on roster', S.faculty.length)}${tr('Core faculty', S.faculty.filter(f => (f.roles || []).includes('Core faculty')).length)}${tr('Training sites', S.sites.length + ' · PLAs signed: ' + S.sites.filter(s => s.plaStatus === 'signed').length)}</table>
  <h2>2. Resident performance</h2><p class="muted">Milestone domain averages across all residents (Psychiatry Milestones 2.0).</p><table><tr><th>Domain</th><th>Mid-year</th><th>Year-end</th></tr>${domAvg(midP).map(([d, v], i) => `<tr><td>${d}</td><td>${v}</td><td>${domAvg(endP)[i][1]}</td></tr>`).join('')}</table>
  <p><b>PRITE:</b> ${prite.length ? `${prite.length} result(s), mean percentile ${round1(avg(prite.map(x => +x.pct).filter(x => x))) || '—'}` : 'no results entered'}</p>
  <h2>3. Evaluation completion</h2><table>${tr('Evaluations of residents', evG('of'))}${tr('Evaluations by residents (rotations, faculty, program)', evG('by'))}${tr('Faculty & program evaluations', evG('fac'))}</table>
  <h2>4. Learning environment</h2><p>Anonymous reports received: <b>${rp.length}</b>${rp.length ? ' — ' + Object.entries(cats).map(([c, n]) => `${esc(c)} (${n})`).join('; ') : ''}. <span class="muted">Counts only; no individual reports are included.</span></p><div class="box">ACGME Resident & Faculty Survey highlights…</div>
  <h2>5. Faculty development</h2><p>${fd} faculty-development hours logged · ${S.faculty.filter(f => f.niTrained).length}/${S.faculty.length} trained in New Innovations · ${S.faculty.filter(f => f.intTrained).length} trained interviewers.</p>
  <h2>6. Accreditation readiness</h2><p>${accD}/${acc.length} checklist items done or N/A.</p>${acc.filter(a => a.status !== 'done' && a.status !== 'na').length ? `<p class="muted">Open: ${acc.filter(a => a.status !== 'done' && a.status !== 'na').slice(0, 12).map(a => esc(a.item)).join('; ')}${acc.filter(a => a.status !== 'done' && a.status !== 'na').length > 12 ? '…' : ''}</p>` : ''}
  <h2>7. Graduate outcomes</h2><div class="box">Board pass rates, fellowship / job placement (once the first class graduates)…</div>
  <h2>8. Progress on last year's action plan</h2>${prevAPE.length ? `<table><tr><th>Action item</th><th>Status</th></tr>${prevAPE.map(a => `<tr><td>${esc(a.t)}</td><td>${a.done ? 'Done' : 'Open'}</td></tr>`).join('')}</table>` : '<div class="box">No APE action items recorded for the prior year.</div>'}
  <h2>9. Strengths, weaknesses, opportunities, threats</h2><div class="box">PEC discussion…</div>
  <h2>10. Action plan for ${ayLabel(ay + 1)}</h2><div class="box">Goal · owner · timeline · how progress will be measured…</div>
  </body></html>`;
}
function openAPE(ay) {
  const html = apeHTML(ay), w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  download(`APE-${ayLabel(ay)}.html`, html, 'text/html');
  toast(w ? 'APE draft opened and downloaded' : 'APE draft downloaded');
}
