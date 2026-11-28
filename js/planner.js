/* Startup Planner — Gantt (centerpiece), notes table, task drawer */
'use strict';
let paintEdit = false;   // "Edit bars" mode
let openTaskId = null;

function plannerTasks() {
  const p = S.ui.planner, q = p.q.trim().toLowerCase();
  let ts = S.tasks.filter(t =>
    (!q || [t.name, t.owner, t.steps, t.contacts, t.thoughts].join(' ').toLowerCase().includes(q)) &&
    (!p.cat || t.cat === p.cat) && (!p.owner || (t.owner || '') === p.owner) &&
    (!p.status || (p.status === 'overdue' ? taskOverdue(t) : t.status === p.status)) &&
    !(p.hideDone && t.status === 'done') && !p.hidden.includes(t.cat));
  if (p.sort === 'start') ts.sort((a, b) => taskStart(a).localeCompare(taskStart(b)) || a.order - b.order);
  else if (p.sort === 'cat') ts.sort((a, b) => Object.keys(CATS).indexOf(a.cat) - Object.keys(CATS).indexOf(b.cat) || a.order - b.order);
  else ts.sort((a, b) => a.order - b.order);
  return ts;
}
function statusChip(st, act, id) { return `<span class="chip st-${st} ${act ? 'click' : ''}" ${act ? `data-act="${act}" data-id="${id}"` : ''}>${STATUS[st] || st}</span>`; }

VIEWS.planner = {
  title: 'Startup Planner',
  render() {
    const p = S.ui.planner;
    const owners = [...new Set(S.tasks.map(t => t.owner).filter(Boolean))].sort();
    const total = S.tasks.length, done = S.tasks.filter(t => t.status === 'done').length;
    return `
    <div class="page-head"><div><h1>Startup Planner</h1><div class="sub">Elizabeth's Gantt · ${done}/${total} done · ${ymLabel(S.settings.rangeStart)} – ${ymLabel(S.settings.rangeEnd)}</div></div><div class="spacer"></div>
      <div class="seg"><button class="${p.mode === 'gantt' ? 'active' : ''}" data-act="pmode" data-m="gantt">Gantt</button><button class="${p.mode === 'notes' ? 'active' : ''}" data-act="pmode" data-m="notes">Notes & Contacts</button></div>
    </div>
    <div class="toolbar">
      <button class="btn phone-only" data-act="tbToggle">☰ Filters${[p.q, p.cat, p.owner, p.status, p.hideDone].filter(Boolean).length ? ` (${[p.q, p.cat, p.owner, p.status, p.hideDone].filter(Boolean).length})` : ''}</button>
      <div class="tb-more">
      <input type="search" placeholder="Search tasks, notes, contacts…" value="${esc(p.q)}" id="pq">
      <select id="pcat"><option value="">All categories</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${p.cat === k ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
      <select id="powner"><option value="">All owners</option>${owners.map(o => `<option ${p.owner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
      <select id="pstatus"><option value="">Any status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}<option value="overdue" ${p.status === 'overdue' ? 'selected' : ''}>Overdue</option></select>
      <select id="psort"><option value="sheet" ${p.sort === 'sheet' ? 'selected' : ''}>Sheet order</option><option value="start" ${p.sort === 'start' ? 'selected' : ''}>By start month</option><option value="cat" ${p.sort === 'cat' ? 'selected' : ''}>By category</option></select>
      <label class="check"><input type="checkbox" id="phide" ${p.hideDone ? 'checked' : ''}> Hide done</label>
      </div>
      <div class="spacer"></div>
      ${p.mode === 'gantt' ? `<button class="btn ${paintEdit ? 'on' : ''}" data-act="paintmode">${paintEdit ? '✓ Done editing bars' : '✎ Edit bars'}</button>` : ''}
      <div class="tb-more"><button class="btn" data-act="importXlsx">Import Excel</button>
      <button class="btn" data-act="plannerCSV">Export CSV</button></div>
      <button class="btn primary" data-act="addTask">+ Task</button>
    </div>
    <div class="legend">${Object.entries(CATS).map(([k, c]) => `<span data-act="togglecat" data-k="${k}" class="${p.hidden.includes(k) ? 'off' : ''}"><i style="background:${catColor(k)}"></i>${c.label}</span>`).join('')}<span class="muted phone-hide" style="cursor:default">· tap a category to hide it</span></div>
    ${paintEdit && p.mode === 'gantt' ? `<div class="gantt-editing-banner"><b>Editing bars:</b> tap a month to add/remove it, or drag across months to paint. Tap the task name to open details.</div>` : ''}
    ${p.mode === 'gantt' ? ganttHTML() : notesHTML()}`;
  },
  after(st) {
    const p = S.ui.planner;
    const upd = (id, k, rer = true) => { const el = $(id); if (!el) return; el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { p[k] = el.type === 'checkbox' ? el.checked : el.value; save(); if (rer) { const pos = el.selectionStart; render(); if (el.type === 'search') { const n = $(id); n.focus(); n.setSelectionRange(pos, pos); } } }); };
    upd('#pq', 'q'); upd('#pcat', 'cat'); upd('#powner', 'owner'); upd('#pstatus', 'status'); upd('#psort', 'sort'); upd('#phide', 'hideDone');
    const wrap = $('.gantt-wrap');
    if (wrap) {
      if (st && st.sx != null) { wrap.scrollLeft = st.sx; wrap.scrollTop = st.sy; }
      else { const cur = wrap.querySelector('th.mo.cur'); if (cur) wrap.scrollLeft = Math.max(0, cur.getBoundingClientRect().left - wrap.querySelector('table').getBoundingClientRect().left - 300 - 46 * 3); }
      setupPaint(wrap); setupLongPress(wrap);
    }
    $$('.notes-t textarea').forEach(autoGrow);
  },
};

function ganttHTML() {
  const months = ymRange(S.settings.rangeStart, S.settings.rangeEnd);
  const cym = curYM(), d = new Date(), tf = (d.getDate() - 0.5) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // year header
  const yrs = []; months.forEach(m => { const y = m.slice(0, 4); if (!yrs.length || yrs.at(-1).y !== y) yrs.push({ y, n: 1 }); else yrs.at(-1).n++; });
  const tasks = plannerTasks();
  if (!tasks.length) return `<div class="card empty"><b>No tasks match</b>Clear the filters or add a task.</div>`;
  const p = S.ui.planner;
  let rows = '', lastCat = null;
  for (const t of tasks) {
    if (p.sort === 'cat' && t.cat !== lastCat) { lastCat = t.cat; rows += `<tr class="grp"><td class="namecol"><span class="dot" style="background:${catColor(t.cat)}"></span> ${esc(CATS[t.cat]?.label || t.cat)}</td><td colspan="${months.length}"></td></tr>`; }
    const set = new Set(t.months);
    const od = taskOverdue(t);
    const ck = t.checklist?.length ? ` · ☑ ${t.checklist.filter(c => c.done).length}/${t.checklist.length}` : '';
    rows += `<tr data-id="${t.id}" class="${t.status === 'done' ? 'done' : ''} ${openTaskId === t.id ? 'sel' : ''}">
      <td class="namecol" data-act="openTask" data-id="${t.id}"><div class="nm ${t.status === 'done' ? 'done' : ''}"><span class="dot" style="background:${catColor(t.cat)}"></span><span class="t" title="${esc(t.name)}">${esc(t.name)}</span>${od ? '<span class="flag-overdue" title="All scheduled months are past">OVERDUE</span>' : ''}${parseLinks(t.links)[0] ? `<a class="rowlink" href="${esc(parseLinks(t.links)[0].url)}" target="_blank" rel="noopener" title="${esc(parseLinks(t.links)[0].label)}" onclick="event.stopPropagation()">🔗</a>` : ''}${t.status !== 'todo' && t.status !== 'done' ? statusChip(t.status) : ''}</div>
      <div class="meta">${t.owner ? `<span>👤 ${esc(t.owner)}</span>` : ''}${t.steps || t.thoughts || t.contacts ? '<span>📝 notes</span>' : ''}<span>${ck.slice(3)}</span></div></td>` +
      months.map(m => {
        const on = set.has(m), s = on && !set.has(ymAdd(m, -1)), e = on && !set.has(ymAdd(m, 1));
        const note = t.monthNotes?.[m] || '';
        const tip = on ? `data-tip="<b>${esc(t.name)}</b><br>${ymLabel(m)}${note ? ' · ' + esc(note) : ''}"` : '';
        return `<td class="m ${m.endsWith('-01') ? 'jan' : ''} ${m === cym ? 'cur' : ''}" data-m="${m}" ${m === cym ? `style="--tf:${tf.toFixed(3)}"` : ''} ${tip}>${on ? `<div class="bar ${s ? 's' : ''} ${e ? 'e' : ''}" style="--c:${catColor(t.cat)}">${esc(note)}</div>` : ''}</td>`;
      }).join('') + '</tr>';
  }
  return `<div class="gantt-wrap"><table class="gantt ${paintEdit ? 'editing' : ''} ${S.ui.planner.names === 'full' ? 'names-full' : ''}" style="--n:${months.length}"><colgroup><col class="namec">${months.map(() => '<col>').join('')}</colgroup>
    <thead><tr><th class="namecol" rowspan="2" style="padding:0 6px;vertical-align:bottom;padding-bottom:6px"><button class="namecaret" data-act="nameToggle" title="${S.ui.planner.names === 'full' ? 'Shorten task names' : 'Show full task names'}" aria-label="Toggle task names"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="tlabel">Task <span class="muted small">(${tasks.length})</span></span></th>${yrs.map(y => `<th class="yr" colspan="${y.n}">${y.y}</th>`).join('')}</tr>
    <tr>${months.map(m => `<th class="mo ${m.endsWith('-01') ? 'jan' : ''} ${m === cym ? 'cur' : ''}">${MONTHS[+m.slice(5) - 1]}${m === cym ? '<br><span style="font-size:9px">TODAY</span>' : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function setupPaint(wrap) {
  let painting = null; // {id, val}
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('td.m'); };
  const apply = td => {
    if (!td || !painting) return;
    const tr = td.closest('tr'); if (tr.dataset.id !== painting.id) return;
    const t = findTask(painting.id), m = td.dataset.m, has = t.months.includes(m);
    if (painting.val && !has) t.months.push(m);
    if (!painting.val && has) t.months = t.months.filter(x => x !== m);
    if (has !== painting.val) { td.innerHTML = painting.val ? `<div class="bar s e" style="--c:${catColor(t.cat)}"></div>` : ''; }
  };
  wrap.addEventListener('pointerdown', e => {
    const td = e.target.closest('td.m'); if (!td) return;
    const id = td.closest('tr').dataset.id;
    if (!paintEdit) return;
    e.preventDefault();
    const t = findTask(id);
    painting = { id, val: !t.months.includes(td.dataset.m) };
    apply(td);
    try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
  });
  wrap.addEventListener('pointermove', e => { if (painting) { e.preventDefault(); apply(cellAt(e.clientX, e.clientY)); } });
  const end = () => { if (painting) { const t = findTask(painting.id); t.months.sort(); painting = null; save(); render(); if (openTaskId) openTask(openTaskId); } };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('click', e => { const td = e.target.closest('td.m'); if (td && !paintEdit) openTask(td.closest('tr').dataset.id); });
}

function notesHTML() {
  const tasks = plannerTasks();
  return `<div class="card tablewrap" style="padding:0"><table class="t notes-t"><thead><tr><th>Task</th><th>Additional steps</th><th>Contacts</th><th>Thoughts & helpful information</th></tr></thead><tbody>` +
    tasks.map(t => `<tr><td><span class="dot" style="background:${catColor(t.cat)}"></span> <a href="#" data-act="openTask" data-id="${t.id}">${esc(t.name)}</a><div class="small muted">${t.months.length ? ymLabel([...t.months].sort()[0]) : 'Unscheduled'} ${statusChip(t.status)}</div></td>
      <td><textarea rows="1" data-bind="tasks:${t.id}:steps" placeholder="—">${esc(t.steps)}</textarea></td>
      <td><textarea rows="1" data-bind="tasks:${t.id}:contacts" placeholder="—">${esc(t.contacts)}</textarea></td>
      <td><textarea rows="1" data-bind="tasks:${t.id}:thoughts" placeholder="—">${esc(t.thoughts)}</textarea></td></tr>`).join('') + '</tbody></table></div>';
}
function autoGrow(el) { const f = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }; f(); el.addEventListener('input', f); }

ACT.pmode = el => { S.ui.planner.mode = el.dataset.m; save(); render(); };
ACT.nameToggle = el => {
  const p = S.ui.planner, full = p.names !== 'full'; p.names = full ? 'full' : 'short'; save();
  const tb = el.closest('table.gantt'); if (!tb) return render();
  tb.classList.toggle('names-full', full); el.title = full ? 'Shorten task names' : 'Show full task names';
};
/* long-press (touch) on a task name or bar shows the full name */
let lpBubble;
function hideBubble() { if (lpBubble) { lpBubble.remove(); lpBubble = null; } }
function showBubble(t, m, x, y) {
  hideBubble(); hideTip();
  const ms = [...t.months].sort(), when = ms.length ? (ms.length > 1 ? `${ymLabel(ms[0])} – ${ymLabel(ms.at(-1))}` : ymLabel(ms[0])) : 'Unscheduled';
  lpBubble = document.createElement('div'); lpBubble.className = 'lp-bubble';
  lpBubble.innerHTML = `<b>${esc(t.name)}</b><div>${when}${m && t.monthNotes?.[m] ? ' · ' + esc(t.monthNotes[m]) : ''}</div>${t.owner ? `<div>👤 ${esc(t.owner)}</div>` : ''}<div class="lp-hint">Tap to open details</div>`;
  lpBubble.onclick = () => { hideBubble(); openTask(t.id); };
  document.body.appendChild(lpBubble);
  const w = lpBubble.offsetWidth, h = lpBubble.offsetHeight;
  lpBubble.style.left = Math.max(8, Math.min(x - w / 2, innerWidth - w - 8)) + 'px';
  lpBubble.style.top = (y - h - 18 > 8 ? y - h - 18 : y + 24) + 'px';
}
document.addEventListener('pointerdown', e => { if (lpBubble && !e.target.closest('.lp-bubble')) hideBubble(); }, true);
function setupLongPress(wrap) {
  if (wrap._lp) return; wrap._lp = true;
  let timer = null, sx = 0, sy = 0, fired = false;
  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || paintEdit) return;
    const cell = e.target.closest('td.namecol, td.m'), tr = cell && cell.closest('tr[data-id]');
    if (!tr || (cell.matches('td.m') && !cell.querySelector('.bar'))) return;
    sx = e.clientX; sy = e.clientY; fired = false; clearTimeout(timer);
    timer = setTimeout(() => { fired = true; timer = null; showBubble(findTask(tr.dataset.id), cell.dataset.m, sx, sy); if (navigator.vibrate) navigator.vibrate(12); }, 450);
  });
  wrap.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(timer); timer = null; } });
  ['pointerup', 'pointercancel'].forEach(ev => wrap.addEventListener(ev, () => { clearTimeout(timer); timer = null; }));
  wrap.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  wrap.addEventListener('contextmenu', e => e.preventDefault());
  wrap.addEventListener('scroll', hideBubble, { passive: true });
}
ACT.paintmode = () => { paintEdit = !paintEdit; render(); };
ACT.togglecat = el => { const h = S.ui.planner.hidden, k = el.dataset.k; S.ui.planner.hidden = h.includes(k) ? h.filter(x => x !== k) : [...h, k]; save(); render(); };
ACT.openTask = el => openTask(el.dataset.id);
ACT.addTask = () => { const t = { id: uid(), name: 'New task', cat: 'ops', owner: '', months: [curYM()], monthNotes: {}, status: 'todo', steps: '', contacts: '', thoughts: '', checklist: [], links: '', order: Math.max(-1, ...S.tasks.map(x => x.order)) + 1 }; S.tasks.push(t); save(); render(); openTask(t.id, true); };
ACT.plannerCSV = () => {
  const months = ymRange(S.settings.rangeStart, S.settings.rangeEnd);
  const rows = [['Task', 'Category', 'Owner', 'Status', 'Months', 'Additional steps', 'Contacts', 'Thoughts', ...months.map(ymLabel)]];
  S.tasks.slice().sort((a, b) => a.order - b.order).forEach(t => rows.push([t.name, CATS[t.cat]?.label, t.owner, STATUS[t.status], t.months.map(ymLabel).join('; '), t.steps, t.contacts, t.thoughts, ...months.map(m => t.months.includes(m) ? (t.monthNotes?.[m] || '■') : '')]));
  download('residency-planner.csv', toCSV(rows), 'text/csv');
};

/* ---------- task drawer ---------- */
function openTask(id, focusName) {
  const t = findTask(id); if (!t) return;
  openTaskId = id;
  $$('.gantt tr.sel').forEach(r => r.classList.remove('sel')); $(`.gantt tr[data-id="${id}"]`)?.classList.add('sel');
  const allMonths = ymRange(ymAdd(S.settings.rangeStart, -6), ymAdd(S.settings.rangeEnd, 24));
  const ms = [...t.months].sort();
  const html = `
    <div class="drawer-head"><span class="dot" style="background:${catColor(t.cat)};width:12px;height:12px"></span><h2>Task details</h2><button class="iconbtn" data-act="close" title="Close">✕</button></div>
    <label class="f">Task<input type="text" data-bind="tasks:${t.id}:name" value="${esc(t.name)}" ${focusName ? 'autofocus' : ''} data-rr></label>
    <div class="form" style="margin-top:12px">
      <label class="f">Category<select data-bind="tasks:${t.id}:cat" data-rr>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${t.cat === k ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
      <label class="f">Owner<input type="text" data-bind="tasks:${t.id}:owner" value="${esc(t.owner)}" list="ownerlist" data-rr><datalist id="ownerlist">${[...new Set(S.tasks.map(x => x.owner).filter(Boolean))].map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
    </div>
    <div class="section-t">Status</div>
    <div class="seg">${Object.entries(STATUS).map(([k, v]) => `<button class="${t.status === k ? 'active' : ''}" data-act="taskStatus" data-id="${t.id}" data-s="${k}">${v}</button>`).join('')}</div>
    ${taskOverdue(t) ? '<div class="flag-overdue" style="margin-top:6px">All scheduled months are in the past and this isn\'t marked done.</div>' : ''}
    <div class="section-t">Scheduled months & date notes</div>
    ${ms.length ? ms.map(m => `<div class="mrow"><span class="ml">${ymLabel(m)}</span><input type="text" placeholder="date note, e.g. 12/4–1/7" value="${esc(t.monthNotes?.[m] || '')}" data-act-input="mnote" data-id="${t.id}" data-m="${m}"><button class="iconbtn" data-act="rmMonth" data-id="${t.id}" data-m="${m}" title="Remove month">✕</button></div>`).join('') : '<div class="muted small">Not scheduled yet.</div>'}
    <div class="mrow" style="margin-top:6px"><select id="addMonthSel">${allMonths.map(m => `<option value="${m}" ${m === curYM() ? 'selected' : ''}>${ymLabel(m)}</option>`).join('')}</select><button class="btn sm" data-act="addMonth" data-id="${t.id}">+ Add month</button></div>
    <div class="section-t">Checklist</div>
    <div id="cl">${(t.checklist || []).map((c, i) => `<div class="cl ${c.done ? 'done' : ''}"><input type="checkbox" ${c.done ? 'checked' : ''} data-act="clToggle" data-id="${t.id}" data-i="${i}"><input type="text" value="${esc(c.t)}" data-act-input="clText" data-id="${t.id}" data-i="${i}"><button class="iconbtn" data-act="clDel" data-id="${t.id}" data-i="${i}">✕</button></div>`).join('')}</div>
    <div class="mrow"><input type="text" id="clNew" placeholder="Add a checklist item and press Enter"><button class="btn sm" data-act="clAdd" data-id="${t.id}">Add</button></div>
    <div class="section-t">Notes (from the Psych Notes sheet)</div>
    <label class="f">Additional steps<textarea data-bind="tasks:${t.id}:steps">${esc(t.steps)}</textarea></label>
    <label class="f" style="margin-top:10px">Contacts<textarea data-bind="tasks:${t.id}:contacts">${esc(t.contacts)}</textarea></label>
    <label class="f" style="margin-top:10px">Thoughts & helpful information<textarea data-bind="tasks:${t.id}:thoughts">${esc(t.thoughts)}</textarea></label>
    <div class="section-t">Quick links</div>
    <div class="qlinks">${parseLinks(t.links).map(l => `<a class="qlink" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label)}</a>`).join('') || '<span class="small muted">No links yet.</span>'}</div>
    <label class="f" style="margin-top:8px">Edit links (one per line — “Label | https://…”)<textarea data-bind="tasks:${t.id}:links" data-rr placeholder="Registration | https://…">${esc(t.links || '')}</textarea></label>
    <div class="modal-foot"><button class="btn danger" data-act="delTask" data-id="${t.id}">Delete task</button><div class="spacer"></div><button class="btn" data-act="moveTask" data-id="${t.id}" data-d="-1">↑ Move up</button><button class="btn" data-act="moveTask" data-id="${t.id}" data-d="1">↓ Move down</button><button class="btn primary" data-act="close">Done</button></div>`;
  const sc = openModal(html, { drawer: true, onClose: () => { openTaskId = null; render(); } });
  sc.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.actInput === 'mnote') { t.monthNotes = t.monthNotes || {}; t.monthNotes[el.dataset.m] = el.value; save(); }
    if (el.dataset.actInput === 'clText') { t.checklist[+el.dataset.i].t = el.value; save(); }
  });
  sc.addEventListener('change', e => { if (e.target.hasAttribute('data-rr')) { render(); if (e.target.matches('textarea')) openTask(t.id); } });
  const cn = $('#clNew'); cn && cn.addEventListener('keydown', e => { if (e.key === 'Enter') { ACT.clAdd({ dataset: { id: t.id } }); } });
}
ACT.taskStatus = el => { findTask(el.dataset.id).status = el.dataset.s; save(); render(); openTask(el.dataset.id); };
ACT.rmMonth = el => { const t = findTask(el.dataset.id); t.months = t.months.filter(m => m !== el.dataset.m); save(); render(); openTask(t.id); };
ACT.addMonth = el => { const t = findTask(el.dataset.id), m = $('#addMonthSel').value; if (!t.months.includes(m)) t.months.push(m); t.months.sort(); save(); render(); openTask(t.id); };
ACT.clToggle = el => { const t = findTask(el.dataset.id); t.checklist[+el.dataset.i].done = el.checked; save(); render(); openTask(t.id); };
ACT.clDel = el => { const t = findTask(el.dataset.id); t.checklist.splice(+el.dataset.i, 1); save(); render(); openTask(t.id); };
ACT.clAdd = el => { const t = findTask(el.dataset.id), v = $('#clNew').value.trim(); if (!v) return; (t.checklist ||= []).push({ t: v, done: false }); save(); render(); openTask(t.id); setTimeout(() => $('#clNew')?.focus(), 0); };
ACT.delTask = el => confirmBox('Delete this task from the planner?', () => { S.tasks = S.tasks.filter(t => t.id !== el.dataset.id); openTaskId = null; save(); render(); });
ACT.moveTask = el => {
  const list = S.tasks.slice().sort((a, b) => a.order - b.order), i = list.findIndex(t => t.id === el.dataset.id), j = i + +el.dataset.d;
  if (j < 0 || j >= list.length) return;
  [list[i].order, list[j].order] = [list[j].order, list[i].order];
  if (S.ui.planner.sort !== 'sheet') { S.ui.planner.sort = 'sheet'; toast('Switched to sheet order'); }
  save(); render(); openTask(el.dataset.id);
};
// checkbox in drawer uses click delegation but needs checked state
ACT.clToggle = el => { const t = findTask(el.dataset.id); t.checklist[+el.dataset.i].done = !t.checklist[+el.dataset.i].done; save(); render(); openTask(t.id); };
