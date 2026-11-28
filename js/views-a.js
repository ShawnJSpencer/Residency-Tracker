/* Dashboard, Calendar, Faculty, Accreditation, Settings */
'use strict';

/* ---------- shared: dated items for calendar/dashboard/ics ---------- */
const EV_COLORS = { meeting: 's1', interview: 's3', event: 's7', didactic: 's4' };
function datedItems() {
  const out = [];
  S.meetings.forEach(m => m.date && out.push({ date: m.date, end: '', title: `${m.type === 'Other' ? '' : m.type + ': '}${m.title || ''}`.replace(/: $/, ''), time: m.time, c: m.type === 'CCC' ? 's1' : m.type === 'PEC' || m.type === 'APE' ? 's2' : 's5', kind: 'meeting', id: m.id, tentative: m.tentative }));
  S.interviewDays.forEach(d => d.date && out.push({ date: d.date, title: `Interview day${d.format ? ' (' + d.format + ')' : ''}`, c: 's3', kind: 'interview', id: d.id }));
  S.events.forEach(e => e.date && out.push({ date: e.date, end: e.end, title: e.title, c: (CATS[e.type] || CATS.ops).c, kind: 'event', id: e.id }));
  (S.wellness?.events || []).forEach(e => e.date && out.push({ date: e.date, title: e.title || 'Wellness event', time: e.time, c: 's5', kind: 'wellness', id: e.id }));
  Object.keys(S.didactics.sessions).map(k => k.split('|')[0]).filter((v, i, a) => a.indexOf(v) === i).forEach(d => { if (!S.didactics.cancelled[d]) out.push({ date: d, title: 'Didactics 1–5 pm', time: '13:00', c: 's4', kind: 'didactic' }); });
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

/* ---------- charts (hand-built SVG) ---------- */
function hbarList(rows) { // rows: {label, done, doing, total, c}
  return rows.map(r => {
    const pd = r.total ? r.done / r.total * 100 : 0, pg = r.total ? r.doing / r.total * 100 : 0;
    return `<div class="barrow" data-tip="<b>${esc(r.label)}</b><br>${r.done} done · ${r.doing} in progress · ${r.total - r.done - r.doing} not started"><span class="ellipsis"><span class="dot" style="background:var(--${r.c})"></span> ${esc(r.label)}</span>
      <div class="meter">${pd ? `<i style="width:${pd}%;background:var(--${r.c})"></i>` : ''}${pg ? `<i style="width:${pg}%;background:var(--${r.c});opacity:.4"></i>` : ''}<i style="flex:1;background:transparent"></i></div><span class="v">${r.done}/${r.total}</span></div>`;
  }).join('');
}
function rampChart() {
  const start = acadYear(S.settings.programStart), per = +S.settings.perClass || 0;
  const years = [0, 1, 2, 3, 4].map(i => start + i);
  const W = 520, H = 210, L = 34, B = 26, T = 14, bw = 54;
  const maxV = Math.max(4, per * 4), sy = v => H - B - (v / maxV) * (H - B - T);
  const gx = i => L + 20 + i * ((W - L - 40) / years.length);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto" role="img" aria-label="Residents by PGY each academic year">`;
  for (let k = 0; k <= 4; k++) { const v = maxV / 4 * k; svg += `<g class="grid"><line x1="${L}" x2="${W - 6}" y1="${sy(v)}" y2="${sy(v)}"/></g><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  years.forEach((y, i) => {
    let acc = 0; const x = gx(i);
    for (let p = 1; p <= 4; p++) {
      if (y - start + 1 < p) continue;
      const v = per, y0 = sy(acc), y1 = sy(acc + v); acc += v;
      const top = p === Math.min(4, y - start + 1);
      svg += `<path d="M${x},${y0 - (p > 1 ? 1 : 0)} V${y1 + (top ? 4 : 1)} ${top ? `q0,-4 4,-4 H${x + bw - 4} q4,0 4,4` : `H${x + bw}`} V${y0 - (p > 1 ? 1 : 0)} Z" fill="var(--s${p})" data-tip="<b>AY ${ayLabel(y)}</b><br>PGY-${p}: ${v} residents"/>`;
    }
    svg += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${ayLabel(y)}</text>`;
    if (acc) svg += `<text x="${x + bw / 2}" y="${sy(acc) - 5}" text-anchor="middle" style="font-weight:700;fill:var(--ink)">${acc}</text>`;
  });
  return svg + `<g class="axis"><line x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/></g></svg>
    <div class="legend" style="margin:6px 0 0">${[1, 2, 3, 4].map(p => `<span style="cursor:default"><i style="background:var(--s${p})"></i>PGY-${p}</span>`).join('')}<span class="muted" style="cursor:default">${per} positions per class (Settings)</span></div>`;
}

/* ---------- Dashboard ---------- */
VIEWS.dashboard = {
  title: 'Dashboard',
  render() {
    const t = todayISO(), cym = curYM(), nym = ymAdd(cym, 1);
    const tasks = S.tasks, done = tasks.filter(x => x.status === 'done').length;
    const overdue = tasks.filter(taskOverdue);
    const now = tasks.filter(x => x.status !== 'done' && (x.months.includes(cym) || x.months.includes(nym)) && !taskOverdue(x)).sort((a, b) => taskStart(a).localeCompare(taskStart(b)));
    const dStart = daysBetween(t, S.settings.programStart), dMatch = daysBetween(t, S.settings.matchDay);
    const upcoming = datedItems().filter(x => x.date >= t && daysBetween(t, x.date) <= 60).slice(0, 8);
    const actions = S.meetings.flatMap(m => (m.actions || []).filter(a => !a.done).map(a => ({ ...a, m }))).slice(0, 6);
    const catRows = Object.entries(CATS).map(([k, c]) => { const ts = tasks.filter(x => x.cat === k); return { label: c.label, c: c.c, total: ts.length, done: ts.filter(x => x.status === 'done').length, doing: ts.filter(x => x.status === 'doing').length }; }).filter(r => r.total);
    const acc = S.accreditation, accDone = acc.filter(a => a.status === 'done' || a.status === 'na').length;
    const appl = S.applicants.filter(a => a.cycle === S.settings.cycle);
    const li = x => `<div class="li"><span class="dot" style="background:${catColor(x.cat)}"></span><div class="grow ellipsis"><a href="#" data-act="dashTask" data-id="${x.id}">${esc(x.name)}</a></div><span class="muted small">${x.months.length ? [...x.months].sort().map(ymLabel).filter((v, i, a) => i === 0 || i === a.length - 1).join(' – ') : ''}</span>${statusChip(x.status, 'cycleTask', x.id)}</div>`;
    return `
    <div class="page-head"><div><h1>${esc(S.settings.programName)}</h1><div class="sub">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div></div>
    ${reportBanner()}
    ${dataSafetyNotices()}
    ${(() => { const c = typeof credentialAlerts === 'function' ? credentialAlerts() : []; const pla = (S.sites || []).filter(s => s.plaExpires && daysBetween(todayISO(), s.plaExpires) <= 90); return c.length || pla.length ? `<div class="notice warn">${c.length ? `<b>${c.length} resident credential${c.length > 1 ? 's' : ''} expiring within 60 days.</b> <a href="#/residents" onclick="S.ui.resTab='onboard'">Review →</a>` : ''}${c.length && pla.length ? '<br>' : ''}${pla.length ? `<b>Affiliation agreement renewal due:</b> ${pla.map(s => esc(s.name) + ' (' + fmtDate(s.plaExpires) + ')').join(', ')} <a href="#/sites">Sites →</a>` : ''}</div>` : ''; })()}
    ${setupGuideCard()}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span class="lbl">Until first residents start</span><span class="num">${dStart > 0 ? dStart.toLocaleString() : '—'}</span><span class="cap">days · ${fmtDate(S.settings.programStart)}</span></div>
      <div class="card stat"><span class="lbl">Until Match Day</span><span class="num">${dMatch > 0 ? dMatch.toLocaleString() : '—'}</span><span class="cap">days · ${fmtDate(S.settings.matchDay)}</span></div>
      <div class="card stat"><span class="lbl">Startup plan complete</span><span class="num">${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</span><span class="cap">${done} of ${tasks.length} tasks done</span><div class="meter" style="margin-top:6px"><i style="width:${tasks.length ? done / tasks.length * 100 : 0}%;background:var(--good)"></i></div></div>
      <div class="card stat"><span class="lbl">Overdue tasks</span><span class="num" style="color:${overdue.length ? 'var(--bad)' : 'var(--good)'}">${overdue.length}</span><span class="cap">${overdue.length ? 'scheduled months already past' : 'all caught up'}</span></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>This month & next <span class="spacer"></span><a class="small" href="#/planner">Open planner →</a></h2>
        ${now.length ? `<div class="list">${now.map(li).join('')}</div>` : '<div class="muted">Nothing scheduled for this month or next.</div>'}
        ${overdue.length ? `<div class="section-t" style="color:var(--bad)">Overdue</div><div class="list">${overdue.map(li).join('')}</div>` : ''}
        <div class="small muted" style="margin-top:8px">Tap a status chip to advance it.</div></div>
      <div class="card"><h2>Coming up (60 days) <span class="spacer"></span><a class="small" href="#/calendar">Calendar →</a></h2>
        ${upcoming.length ? `<div class="list">${upcoming.map(x => `<div class="li"><span class="when">${fmtDate(x.date, { wd: 1, noYear: 1 })}</span><span class="dot" style="background:var(--${x.c})"></span><div class="grow ellipsis">${esc(x.title)}${x.tentative ? ' <span class="chip st-na">tentative</span>' : ''}</div><span class="small muted">${fmtTime(x.time)}</span></div>`).join('')}</div>` : '<div class="muted">No meetings, interview days or events in the next 60 days.</div>'}
        ${actions.length ? `<div class="section-t">Open action items</div><div class="list">${actions.map(a => `<div class="li"><div class="grow ellipsis">${esc(a.t)}</div><span class="small muted">${esc(a.owner || '')} ${a.due ? '· ' + fmtDate(a.due, { noYear: 1 }) : ''}</span><span class="chip">${esc(a.m.type)}</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="card"><h2>Progress by area</h2>${hbarList(catRows)}<div class="small muted" style="margin-top:6px">Solid = done, light = in progress.</div></div>
      <div class="card"><h2>Resident complement ramp-up</h2>${rampChart()}</div>
      <div class="card"><h2>Accreditation readiness <span class="spacer"></span><a class="small" href="#/accred">Checklist →</a></h2>
        <div class="stat"><span class="num">${accDone}/${acc.length}</span><span class="cap">items done or N/A</span></div>
        <div style="margin-top:10px">${hbarList([...new Set(acc.map(a => a.area))].map((ar, i) => { const it = acc.filter(a => a.area === ar); return { label: ar, c: 's' + (i % 8 + 1), total: it.length, done: it.filter(a => a.status === 'done' || a.status === 'na').length, doing: it.filter(a => a.status === 'doing').length }; }))}</div></div>
      ${typeof whereDashCard === 'function' ? whereDashCard() : ''}
      ${evalDashCard()}
      <div class="card"><h2>Recruitment · ${esc(S.settings.cycle)} <span class="spacer"></span><a class="small" href="#/recruit">Recruitment →</a></h2>
        ${appl.length ? funnelHTML(appl) : `<div class="empty"><b>No applicants yet</b>ERAS opens in the fall; add or import applicants on the Recruitment page.</div>`}
        <div class="small muted" style="margin-top:6px">${S.interviewDays.length} interview day(s) set · ${S.faculty.filter(f => (f.roles || []).includes('Interviewer')).length} faculty interviewers</div></div>
    </div>`;
  },
};
ACT.dashTask = el => { location.hash = '#/planner'; setTimeout(() => openTask(el.dataset.id), 30); };
ACT.cycleTask = el => { const t = findTask(el.dataset.id); const o = ['todo', 'doing', 'done']; t.status = o[(o.indexOf(t.status) + 1) % 3]; save(); render(); };

/* ---------- Calendar ---------- */
VIEWS.calendar = {
  title: 'Calendar',
  render() {
    const ym = S.ui.calMonth, [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1), startD = new Date(first); startD.setDate(1 - first.getDay());
    const items = datedItems(), t = todayISO();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startD); d.setDate(startD.getDate() + i); const iso = toISO(d);
      if (i >= 35 && d.getMonth() !== m - 1) break;
      const its = items.filter(x => x.date === iso || (x.end && x.date < iso && x.end >= iso));
      cells.push(`<div class="d ${d.getMonth() !== m - 1 ? 'out' : ''} ${iso === t ? 'today' : ''}"><div class="n">${d.getDate()}</div>${its.map(x => `<span class="ev" style="--c:var(--${x.c})" data-act="calItem" data-kind="${x.kind}" data-id="${x.id || ''}" data-date="${x.date}" data-tip="${esc(x.title)}${x.time ? ' · ' + fmtTime(x.time) : ''}">${x.time ? fmtTime(x.time).replace(':00', '') + ' ' : ''}${esc(x.title)}</span>`).join('')}</div>`);
    }
    const plan = S.tasks.filter(x => x.months.includes(ym));
    return `<div class="page-head"><div><h1>Calendar</h1><div class="sub">Meetings, interview days, didactics and key dates</div></div><div class="spacer"></div>
      <button class="btn" data-act="icsExport">Export .ics (Outlook)</button><button class="btn primary" data-act="addEvent">+ Key date</button></div>
      <div class="toolbar"><button class="btn" data-act="calNav" data-d="-1">‹</button><b style="font-size:17px;min-width:160px;text-align:center">${MONTHS_LONG[m - 1]} ${y}</b><button class="btn" data-act="calNav" data-d="1">›</button><button class="btn" data-act="calNav" data-d="0">Today</button></div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 260px;align-items:start" id="calgrid">
        <div class="card" style="padding:0;overflow:hidden"><div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dh">${d}</div>`).join('')}${cells.join('')}</div></div>
        <div class="card"><h2>Planner this month</h2>${plan.length ? `<div class="list">${plan.map(x => `<div class="li"><span class="dot" style="background:${catColor(x.cat)}"></span><div class="grow"><a href="#" data-act="dashTask" data-id="${x.id}">${esc(x.name)}</a>${x.monthNotes?.[ym] ? `<div class="small muted">${esc(x.monthNotes[ym])}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="muted small">No planner tasks this month.</div>'}
          <div class="section-t">Key dates</div><div class="list">${S.events.slice().sort((a, b) => a.date.localeCompare(b.date)).filter(e => e.date.slice(0, 7) >= ym).slice(0, 8).map(e => `<div class="li"><span class="when">${fmtDate(e.date, { noYear: e.date.slice(0, 4) === String(y) })}</span><div class="grow ellipsis"><a href="#" data-act="editEvent" data-id="${e.id}">${esc(e.title)}</a></div></div>`).join('') || '<div class="muted small">None</div>'}</div></div>
      </div>
      <style>@media (max-width:900px){#calgrid{grid-template-columns:1fr!important}}</style>`;
  },
};
ACT.calNav = el => { const d = +el.dataset.d; S.ui.calMonth = d === 0 ? curYM() : ymAdd(S.ui.calMonth, d); save(); render(); };
ACT.calItem = el => {
  const k = el.dataset.kind, id = el.dataset.id;
  if (k === 'meeting') editMeeting(id); else if (k === 'interview') editInterviewDay(id); else if (k === 'event') editEvent(id);
  else if (k === 'wellness') wevEdit(id);
  else if (k === 'didactic') { S.ui.didAY = acadYear(el.dataset.date); location.hash = '#/didactics'; }
};
ACT.addEvent = () => { const e = { id: uid(), title: '', date: todayISO(), end: '', type: 'ops', notes: '' }; S.events.push(e); editEvent(e.id, true); };
ACT.editEvent = el => editEvent(el.dataset.id);
function editEvent(id, isNew) {
  const e = S.events.find(x => x.id === id); if (!e) return;
  openModal(`<div class="modal-head"><h2>${isNew ? 'New key date' : 'Key date'}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f full">Title<input type="text" data-bind="events:${id}:title" value="${esc(e.title)}" autofocus></label>
    <label class="f">Date<input type="date" data-bind="events:${id}:date" value="${e.date}"></label><label class="f">End date (optional)<input type="date" data-bind="events:${id}:end" value="${e.end || ''}"></label>
    <label class="f">Category<select data-bind="events:${id}:type">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <label class="f full">Notes<textarea data-bind="events:${id}:notes">${esc(e.notes)}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="evDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { onClose: () => { if (!e.title) S.events = S.events.filter(x => x !== e); save(); render(); } });
  $('#evDel').onclick = () => { closeModal(); withUndo('Key date deleted', () => { S.events = S.events.filter(x => x !== e); }); };
}
ACT.icsExport = () => {
  const dt = s => s.replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const escI = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Residency Tracker//EN', 'CALSCALE:GREGORIAN'];
  datedItems().forEach((x, i) => {
    L.push('BEGIN:VEVENT', `UID:rt-${x.kind}-${x.id || x.date}-${i}@residency-tracker`, `DTSTAMP:${stamp}`);
    if (x.time) { const [h, mi] = x.time.split(':'); L.push(`DTSTART:${dt(x.date)}T${h}${mi}00`); const eh = x.kind === 'didactic' ? 17 : (+h + 1); L.push(`DTEND:${dt(x.date)}T${pad(eh)}${mi}00`); }
    else { const e = new Date(parseISO(x.end || x.date)); e.setDate(e.getDate() + 1); L.push(`DTSTART;VALUE=DATE:${dt(x.date)}`, `DTEND;VALUE=DATE:${dt(toISO(e))}`); }
    L.push(`SUMMARY:${escI(x.title)}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR'); download('residency-calendar.ics', L.join('\r\n'), 'text/calendar');
};

/* ---------- Faculty ---------- */
const FAC_ROLES = ['Program Director', 'Associate PD', 'Core faculty', 'CCC', 'PEC', 'Interviewer', 'Didactics', 'Psychotherapy supervisor', 'Site director'];
VIEWS.faculty = {
  title: 'Faculty',
  render() {
    const F = S.faculty;
    const cnt = r => F.filter(f => (f.roles || []).includes(r)).length;
    const ready = k => F.filter(f => f[k]).length;
    return `<div class="page-head"><div><h1>Faculty</h1><div class="sub">Roster, committee roles, website readiness, New Innovations training & faculty development</div></div><div class="spacer"></div><div class="seg"><button class="${S.ui.facView !== 'table' ? 'active' : ''}" data-act="facView" data-v="faces">Faces</button><button class="${S.ui.facView === 'table' ? 'active' : ''}" data-act="facView" data-v="table">Table</button></div><button class="btn" data-act="facWeb">Website export (.zip)</button><button class="btn" data-act="facCSV">Export CSV</button><button class="btn primary" data-act="addFac">+ Faculty</button></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span class="lbl">Core faculty</span><span class="num">${cnt('Core faculty')}</span><span class="cap">${F.length} total</span></div>
      <div class="card stat"><span class="lbl">CCC / PEC members</span><span class="num">${cnt('CCC')} / ${cnt('PEC')}</span><span class="cap">${cnt('Interviewer')} interviewers</span></div>
      <div class="card stat"><span class="lbl">Website ready</span><span class="num">${F.filter(f => f.photo && f.bio).length}/${F.length}</span><span class="cap">photo + bio collected</span></div>
      <div class="card stat"><span class="lbl">NI trained</span><span class="num">${ready('niTrained')}/${F.length}</span><span class="cap">${F.reduce((s, f) => s + (+f.fdHours || 0), 0)} faculty-development hours logged</span></div>
    </div>
    ${F.length && S.ui.facView !== 'table' ? `<div class="faces">${F.map(f => `<div class="face" data-act="editFac" data-id="${f.id}">${avatar(f.photoId, f.name, 112)}<b>${esc(f.name || '(no name)')}${f.degree ? ', ' + esc(f.degree) : ''}</b><span class="small muted">${esc(f.title || (f.roles || [])[0] || '')}</span>${!f.photoId || !f.bioText ? `<span class="chip st-todo" style="margin-top:4px">${!f.photoId ? 'needs photo' : 'needs bio'}</span>` : ''}</div>`).join('')}</div>` : `<div class="card tablewrap" style="padding:0">${F.length ? `<table class="t"><thead><tr><th>Name</th><th>Roles</th><th>Photo</th><th>Bio</th><th>NI trained</th><th>Interviewer trained</th><th>FD hrs</th></tr></thead><tbody>${F.map(f => `<tr class="click" data-act="editFac" data-id="${f.id}"><td><div style="display:flex;gap:10px;align-items:center">${avatar(f.photoId, f.name, 36)}<div><b>${esc(f.name || '(no name)')}</b>${f.degree ? ', ' + esc(f.degree) : ''}<div class="small muted">${esc(f.title || '')}</div></div></div></td><td>${(f.roles || []).map(r => `<span class="chip" style="margin:1px">${esc(r)}</span>`).join('')}</td>${['photo', 'bio', 'niTrained', 'intTrained'].map(k => `<td>${f[k] ? '<span style="color:var(--good);font-weight:700">✓</span>' : '<span class="muted">—</span>'}</td>`).join('')}<td>${f.fdHours || 0}</td></tr>`).join('')}</tbody></table>` : `<div class="empty"><b>No faculty yet</b>Add core faculty to track CCC/PEC membership, website photos & bios, and New Innovations training.</div>`}</div>`}`;
  },
};
ACT.facView = el => { S.ui.facView = el.dataset.v; save(); render(); };
ACT.facPhoto = async el => {
  const f = S.faculty.find(x => x.id === el.dataset.id);
  if (el.dataset.op === 'del') { await delPhoto(f.photoId); f.photoId = ''; f.photo = false; }
  else { const d = await pickPhoto({ square: true, max: 600 }); if (!d) return; if (f.photoId) await delPhoto(f.photoId); f.photoId = await putPhoto(d); f.photo = true; }
  save(); editFac(f.id);
};
ACT.facWeb = () => {
  const F = S.faculty.filter(f => f.name); if (!F.length) return toast('Add faculty first');
  const enc = new TextEncoder(), files = [];
  F.forEach(f => { const src = photoSrc(f.photoId); if (src) files.push({ name: `photos/${safeName(f.name)}.jpg`, data: dataURLBytes(src) }); });
  const bios = F.map(f => `${f.name}${f.degree ? ', ' + f.degree : ''}\n${f.title || ''}\n\n${f.bioText || '(bio not collected yet)'}\n\nPhoto: ${f.photoId ? 'photos/' + safeName(f.name) + '.jpg' : 'not collected yet'}`).join('\n\n----------------------------------------\n\n');
  files.push({ name: 'faculty-bios.txt', data: enc.encode(bios) });
  files.push({ name: 'faculty.csv', data: enc.encode(toCSV([['Name', 'Degree', 'Title', 'Roles', 'Photo file', 'Bio'], ...F.map(f => [f.name, f.degree, f.title, (f.roles || []).join('; '), f.photoId ? `photos/${safeName(f.name)}.jpg` : '', f.bioText || ''])])) });
  downloadBlob(`faculty-website-${todayISO()}.zip`, makeZip(files));
  const miss = F.filter(f => !f.photoId || !f.bioText).length; toast(miss ? `Exported — ${miss} still missing a photo or bio` : 'Exported photos + bios');
};
ACT.addFac = () => { const f = { id: uid(), name: '', degree: 'MD', title: '', email: '', roles: [], photo: false, bio: false, niTrained: false, intTrained: false, fdHours: 0, notes: '' }; S.faculty.push(f); editFac(f.id, true); };
ACT.editFac = el => editFac(el.dataset.id);
function editFac(id, isNew) {
  const f = S.faculty.find(x => x.id === id);
  openModal(`<div class="modal-head"><h2>${isNew ? 'Add faculty' : esc(f.name)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="photorow">${photoSlotHTML(f.photoId, 'Headshot', 'facPhoto', `data-id="${id}"`)}<div class="small muted">Take or choose a headshot. It's cropped square and shrunk to save space. Used in the face book, on interview days, meetings, and the website export.</div></div>
    <div class="form"><label class="f">Name<input type="text" data-bind="faculty:${id}:name" value="${esc(f.name)}" ${isNew ? 'autofocus' : ''}></label><label class="f">Degree<input type="text" data-bind="faculty:${id}:degree" value="${esc(f.degree)}"></label>
    <label class="f">Title / position<input type="text" data-bind="faculty:${id}:title" value="${esc(f.title)}"></label><label class="f">Email<input type="email" data-bind="faculty:${id}:email" value="${esc(f.email)}"></label>
    <div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">Roles</span><div style="display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:4px">${FAC_ROLES.map(r => `<label class="check"><input type="checkbox" data-role="${esc(r)}" ${(f.roles || []).includes(r) ? 'checked' : ''}> ${r}</label>`).join('')}</div></div>
    <div class="f full" style="display:flex;flex-wrap:wrap;gap:8px 18px;flex-direction:row">${[['photo', 'Photo collected'], ['bio', 'Bio collected'], ['niTrained', 'New Innovations trained'], ['intTrained', 'Interviewer training done']].map(([k, l]) => `<label class="check"><input type="checkbox" data-bind="faculty:${id}:${k}" ${f[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label class="f full">Website bio<textarea rows="4" data-bind="faculty:${id}:bioText" id="fBio" placeholder="A short bio for the program website">${esc(f.bioText || '')}</textarea></label>
    <label class="f">Faculty development hours<input type="number" step="0.5" data-bind="faculty:${id}:fdHours" value="${f.fdHours || 0}"></label>
    <label class="f full">Notes<textarea data-bind="faculty:${id}:notes">${esc(f.notes)}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="fDel">Remove</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { onClose: () => { if (!f.name) S.faculty = S.faculty.filter(x => x !== f); save(); render(); } });
  $$('[data-role]').forEach(cb => cb.onchange = () => { f.roles = $$('[data-role]').filter(c => c.checked).map(c => c.dataset.role); save(); });
  $('#fBio').addEventListener('input', e => { f.bio = !!e.target.value.trim(); });
  $('#fDel').onclick = () => confirmBox(`Remove ${esc(f.name || 'this person')}?`, () => { S.faculty = S.faculty.filter(x => x !== f); save(); render(); }, 'Remove');
}
ACT.facCSV = () => download('faculty.csv', toCSV([['Name', 'Degree', 'Title', 'Email', 'Roles', 'Photo', 'Bio', 'NI trained', 'Interviewer trained', 'FD hours'], ...S.faculty.map(f => [f.name, f.degree, f.title, f.email, (f.roles || []).join('; '), f.photo ? 'Y' : '', f.bio ? 'Y' : '', f.niTrained ? 'Y' : '', f.intTrained ? 'Y' : '', f.fdHours])]), 'text/csv');

/* ---------- Accreditation ---------- */
const ACC_ST = { todo: 'Not started', doing: 'In progress', done: 'Done', na: 'N/A' };
VIEWS.accred = {
  title: 'Accreditation',
  render() {
    const areas = [...new Set(S.accreditation.map(a => a.area))];
    return `<div class="page-head"><div><h1>Accreditation & Readiness</h1><div class="sub">ACGME new-program checklist, policies, and the annual cycle. Tap a status to advance it; tap an item for owner, due date and notes.</div></div><div class="spacer"></div><button class="btn" data-act="apeBuild">Build APE report</button><button class="btn primary" data-act="addAcc">+ Item</button></div>
    <div class="grid g2">${areas.map((ar, i) => { const it = S.accreditation.filter(a => a.area === ar), d = it.filter(a => a.status === 'done' || a.status === 'na').length; return `<div class="card"><h2><span class="dot" style="background:var(--s${i % 8 + 1})"></span>${esc(ar)}<span class="spacer"></span><span class="small muted">${d}/${it.length}</span></h2>
      <div class="meter" style="margin-bottom:8px"><i style="width:${d / it.length * 100}%;background:var(--s${i % 8 + 1})"></i></div>
      <div class="list">${it.map(a => `<div class="li"><div class="grow"><a href="#" data-act="editAcc" data-id="${a.id}" style="${a.status === 'done' ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(a.item)}</a>${a.owner || a.due ? `<div class="small muted">${esc(a.owner)}${a.owner && a.due ? ' · ' : ''}${a.due ? 'due ' + fmtDate(a.due) : ''}</div>` : ''}</div><span class="chip click st-${a.status}" data-act="accCycle" data-id="${a.id}">${ACC_ST[a.status]}</span></div>`).join('')}</div></div>`; }).join('')}</div>`;
  },
};
ACT.accCycle = el => { const a = S.accreditation.find(x => x.id === el.dataset.id), o = Object.keys(ACC_ST); a.status = o[(o.indexOf(a.status) + 1) % o.length]; save(); render(); };
ACT.addAcc = () => { const a = { id: uid(), area: S.accreditation[0]?.area || 'General', item: '', status: 'todo', owner: '', due: '', notes: '' }; S.accreditation.push(a); editAcc(a.id); };
ACT.editAcc = el => editAcc(el.dataset.id);
function editAcc(id) {
  const a = S.accreditation.find(x => x.id === id), areas = [...new Set(S.accreditation.map(x => x.area))];
  openModal(`<div class="modal-head"><h2>Checklist item</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="form"><label class="f full">Item<input type="text" data-bind="accreditation:${id}:item" value="${esc(a.item)}" autofocus></label>
    <label class="f">Area<input type="text" list="arealist" data-bind="accreditation:${id}:area" value="${esc(a.area)}"><datalist id="arealist">${areas.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label class="f">Status<select data-bind="accreditation:${id}:status">${Object.entries(ACC_ST).map(([k, v]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f">Owner<input type="text" data-bind="accreditation:${id}:owner" value="${esc(a.owner)}"></label><label class="f">Due<input type="date" data-bind="accreditation:${id}:due" value="${a.due}"></label>
    <label class="f full">Notes<textarea data-bind="accreditation:${id}:notes">${esc(a.notes)}</textarea></label></div>
    <div class="modal-foot"><button class="btn danger" id="aDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { onClose: () => { if (!a.item) S.accreditation = S.accreditation.filter(x => x !== a); save(); render(); } });
  $('#aDel').onclick = () => { closeModal(); withUndo('Checklist item deleted', () => { S.accreditation = S.accreditation.filter(x => x !== a); }); };
}

/* ---------- Settings ---------- */
VIEWS.settings = {
  title: 'Settings & Data',
  render() {
    const s = S.settings, b = k => `data-bind="settings:-:${k}"`;
    return `<div class="page-head"><div><h1>Settings & Data</h1></div></div>
    <div class="grid g2">
      <div class="card"><h2>Program</h2><div class="form">
        <label class="f full">Program name<input type="text" ${b('programName')} value="${esc(s.programName)}" data-rerender></label>
        <label class="f">First residents start<input type="date" ${b('programStart')} value="${s.programStart}"></label>
        <label class="f">Match Day<input type="date" ${b('matchDay')} value="${s.matchDay}"></label>
        <label class="f">Positions per class<input type="number" min="1" max="30" ${b('perClass')} value="${s.perClass}" onchange="ensureRoadmap();S.roadmap.checked['setup:perclass']=true;save()"></label>
        <label class="f">Current recruitment cycle<input type="text" ${b('cycle')} value="${esc(s.cycle)}"></label>
        <label class="f">Planner starts<input type="month" ${b('rangeStart')} value="${s.rangeStart}"></label>
        <label class="f">Planner ends<input type="month" ${b('rangeEnd')} value="${s.rangeEnd}"></label>
        <label class="f">Theme<select ${b('theme')} id="themeSel"><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Match device</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option></select></label>
      </div></div>
      <div class="card"><h2>Data</h2>
        <p class="small muted" style="margin-top:0">Everything is stored in this browser only — nothing is sent to GitHub or anywhere else. Use a backup file to move data between your work PC, iPad and iPhone.</p>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
          <button class="btn primary" data-act="importXlsx">Import Elizabeth's Excel tracker (.xlsx)</button>
          <span class="small muted">Reads the Gantt sheet (colored months, owners, date notes) and the Notes sheet. Merge keeps your statuses & checklists.</span>
          <div class="small" style="font-weight:600">Last backup: ${S.meta.lastBackup ? fmtDate(S.meta.lastBackup) + ` (${daysSince(S.meta.lastBackup)} day${daysSince(S.meta.lastBackup) === 1 ? '' : 's'} ago)` : 'never'}</div>
          <button class="btn primary" data-act="shareBackup">Send backup to another device…</button>
          <span class="small muted">Opens the share sheet (AirDrop, Messages, Mail, Files). On the other device, open this app → Settings → Restore from backup.</span>
          <button class="btn" data-act="backup">Download backup (.json)</button>
          <button class="btn" data-act="restore">Restore from backup…</button>
          <button class="btn" data-act="plannerCSV">Export planner (.csv)</button>
          <button class="btn danger" data-act="resetAll">Reset everything to the original tracker</button>
        </div>
        <div class="section-t">Storage</div><div class="small muted">${(JSON.stringify(S).length / 1024).toFixed(0)} KB used · ${S.tasks.length} tasks · ${S.applicants.length} applicants · ${S.residents.length} residents · ${S.meetings.length} meetings</div>
      </div>
    </div>`;
  },
  after() { $('#themeSel').addEventListener('change', () => setTimeout(applyTheme, 0)); },
};
ACT.backup = () => { download(`residency-tracker-backup-${todayISO()}.json`, backupJSON(), 'application/json'); markBackedUp(); render(); };
ACT.restore = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    try { const d = JSON.parse(await inp.files[0].text()); if (!d.v || !d.tasks) throw new Error('not a Residency Tracker backup'); confirmBox('Replace all data on this device with the backup?', async () => { const ph = d.photos; delete d.photos; localStorage.setItem(KEY, JSON.stringify(d)); if (ph) await replaceAllPhotos(ph); load(); bootExtras(); applyTheme(); render(); toast('Backup restored'); }, 'Restore'); }
    catch (e) { toast('Restore failed: ' + e.message); }
  };
  inp.click();
};
ACT.resetAll = () => confirmBox('This erases everything on this device (applicants, residents, meetings, notes) and reloads the original planner. Download a backup first if unsure.', () => { localStorage.removeItem(KEY); load(); applyTheme(); render(); toast('Reset complete'); }, 'Erase & reset');

function evalDashCard() {
  ensureEvals();
  const its = S.evals.items, t = todayISO(), soon = toISO(new Date(Date.now() + 14 * 864e5));
  const od = its.filter(i => evStatus(i) === 'overdue'), up = its.filter(i => evStatus(i) === 'pending' && i.due <= soon);
  const by = g => od.filter(i => evGroup(evType(i.typeId) || {}) === g).length;
  return `<div class="card"><h2>Evaluations <span class="spacer"></span><a class="small" href="#/evals">Evaluations →</a></h2>${its.length ? `<div class="grid g2" style="gap:10px"><div class="stat"><span class="lbl">Overdue</span><span class="num" style="color:${od.length ? 'var(--bad)' : 'var(--good)'}">${od.length}</span><span class="cap">${by('of')} of residents · ${by('by')} by residents · ${by('fac')} faculty/program</span></div><div class="stat"><span class="lbl">Due in 14 days</span><span class="num">${up.length}</span></div></div>` : '<div class="empty" style="padding:16px"><b>Not set up yet</b>Generate each academic year\'s evaluations on the Evaluations page.</div>'}</div>`;
}
