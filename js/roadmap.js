/* Roadmap & Checklists — everything still to build or set up, in one place.
   Feature status lives here in code (same on every device); your own checkmarks and ideas are saved on the device. */
'use strict';
const ROADMAP = {
  built: [
    ['v1', 'Startup Planner (Elizabeth\'s Gantt + Notes sheet) with Excel import'],
    ['v1', 'Recruitment: applicants, ERAS CSV import, interview days, scoring rubric, rank list'],
    ['v1', 'CCC / PEC / APE meetings with agendas, minutes, action items'],
    ['v1', 'Didactics Thursday grid following the PGY ramp-up'],
    ['v1', 'Residents & Psychiatry Milestones 2.0, cohort heatmap, PRITE'],
    ['v1', 'Faculty roster, Accreditation checklist, Calendar with Outlook export, Dashboard'],
    ['v2', 'Block & Rotation Schedule with coverage and requirement totals'],
    ['v2', 'iPhone fix: page no longer slides sideways'],
    ['v3', 'Evaluation completion tracking (of residents, by residents, faculty & program)'],
    ['v4', 'Gantt: caret for short/full names; press-and-hold shows full name on iPhone'],
    ['v4', 'Anonymous Reports shell: QR code, resident form preview, flashing new-report alert'],
    ['v5', 'Roadmap & Checklists page'],
    ['v7', 'iPhone: edit panels clear the status bar with a sticky close button; no zoom-in on text boxes; one press-and-hold bubble'],
    ['v6', 'iPad home-screen app fits below the status bar; faster scrolling & caret; name column no longer balloons on wide screens'],
  ],
  ideas: [
    ['rot-now', 'Show each resident\'s current rotation on their profile and the dashboard'],
    ['leave', 'Vacation & leave weeks on the block schedule'],
    ['logs', 'Psychotherapy & case logs'],
    ['scholar', 'Scholarly activity & QI projects'],
    ['sites', 'Training sites & program letters of agreement (PLAs)'],
    ['budget', 'Program budget'],
    ['sync', 'Real syncing between devices (instead of backup files)'],
    ['rpt-live', 'Anonymous reports: decide how reports are actually delivered (with Intermountain IT / GME)'],
  ],
};
// setup tasks for you — some check themselves off automatically when the app can tell they're done
const SETUP = [
  ['perclass', 'Confirm positions per class in Settings (4 is a placeholder)', null],
  ['excel', 'Import Elizabeth\'s Excel on each device to restore the Contacts column', () => S.tasks.some(t => t.contacts)],
  ['faculty', 'Add faculty on the Faculty page', () => S.faculty.length > 0],
  ['roles', 'Tag faculty roles (Program Director, Core, CCC, PEC, Psychotherapy supervisor)', () => S.faculty.some(f => (f.roles || []).length)],
  ['supervisors', 'Name a supervisor for each rotation (Block Schedule → Rotations)', () => S.blocks?.rotations.length && S.blocks.rotations.every(r => r.supervisor)],
  ['evaldates', 'Review default evaluation due dates (Evaluations → Evaluation types)', null],
  ['meetings', 'Firm up tentative CCC / PEC / APE dates', () => S.meetings.length > 0 && !S.meetings.some(m => m.tentative)],
  ['targets', 'Enter rotation requirement targets (Block Schedule → Requirements)', () => S.blocks && Object.values(S.blocks.targets || {}).some(v => v !== '')],
  ['pages', 'Turn on GitHub Pages (Settings → Pages → main / root)', () => location.hostname.endsWith('github.io')],
];
function ensureRoadmap() { if (!S.roadmap) S.roadmap = { checked: {}, mine: [] }; }
function roadmapOpen() {
  ensureRoadmap(); ensureReports();
  const c = S.roadmap.checked;
  return ROADMAP.ideas.filter(([k]) => !c['idea:' + k]).length + SETUP.filter(([k, , auto]) => !(auto && auto()) && !c['setup:' + k]).length + RPT_CHECKLIST.filter(([k]) => !S.reports.checklist[k]).length + S.roadmap.mine.filter(m => !m.done).length;
}
VIEWS.roadmap = {
  title: 'Roadmap & Checklists',
  render() {
    ensureRoadmap(); ensureReports();
    const c = S.roadmap.checked;
    const row = (key, label, done, extra = '') => `<label class="li check" style="align-items:flex-start;font-size:13.5px"><input type="checkbox" data-rm="${key}" ${done ? 'checked' : ''} style="margin-top:3px"><span style="flex:1;${done ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${label}</span>${extra}</label>`;
    const prog = (d, n) => `<span class="small muted">${d}/${n}</span>`;
    const ideasDone = ROADMAP.ideas.filter(([k]) => c['idea:' + k]).length;
    const setupRows = SETUP.map(([k, l, auto]) => { const a = auto && auto(); return { k, l, done: a || !!c['setup:' + k], a }; });
    const rptDone = RPT_CHECKLIST.filter(([k]) => S.reports.checklist[k]).length;
    return `<div class="page-head"><div><h1>Roadmap & Checklists</h1><div class="sub">Everything still to build or set up, in one place. ${roadmapOpen()} open item${roadmapOpen() === 1 ? '' : 's'}.</div></div></div>
    <div class="grid g2">
      <div class="card"><h2>Ideas to build next <span class="spacer"></span>${prog(ideasDone, ROADMAP.ideas.length)}</h2>
        <div class="list">${ROADMAP.ideas.map(([k, l]) => row('idea:' + k, esc(l), !!c['idea:' + k])).join('')}</div>
        <div class="small muted" style="margin-top:6px">Tick one off to skip it, or ask me to build it and I'll mark it done here.</div></div>
      <div class="card"><h2>Setup tasks for you <span class="spacer"></span>${prog(setupRows.filter(r => r.done).length, setupRows.length)}</h2>
        <div class="list">${setupRows.map(r => row('setup:' + r.k, esc(r.l), r.done, r.a ? '<span class="chip st-done" title="Detected automatically">auto</span>' : '')).join('')}</div>
        <div class="small muted" style="margin-top:6px">Items marked “auto” tick themselves when the app can tell they're done.</div></div>
      <div class="card"><h2>Anonymous reporting — before going live <span class="spacer"></span>${prog(rptDone, RPT_CHECKLIST.length)}</h2>
        <div class="list">${RPT_CHECKLIST.map(([k, l]) => row('rpt:' + k, esc(l), !!S.reports.checklist[k])).join('')}</div>
        <div class="small muted" style="margin-top:6px">Same list as on <a href="#/reports">Anonymous Reports</a> — checking either place updates both.</div></div>
      <div class="card"><h2>My own items <span class="spacer"></span>${prog(S.roadmap.mine.filter(m => m.done).length, S.roadmap.mine.length)}</h2>
        <div class="list">${S.roadmap.mine.map(m => `<div class="li" style="font-size:13.5px"><input type="checkbox" data-rmm="${m.id}" ${m.done ? 'checked' : ''}><span style="flex:1;${m.done ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(m.t)}</span><button class="iconbtn" data-act="rmDel" data-id="${m.id}">✕</button></div>`).join('') || '<div class="small muted">Add your own ideas or reminders for the app.</div>'}</div>
        <div class="mrow" style="margin-top:8px"><input type="text" id="rmNew" placeholder="Add an item and press Enter"><button class="btn sm" data-act="rmAdd">Add</button></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Already built</h2><div class="list">${ROADMAP.built.slice().reverse().map(([v, l]) => `<div class="li" style="font-size:13.5px"><span class="chip st-done">${v}</span><span style="flex:1">${esc(l)}</span></div>`).join('')}</div></div>`;
  },
  after() { const n = $('#rmNew'); if (n) n.addEventListener('keydown', e => { if (e.key === 'Enter') ACT.rmAdd(); }); },
};
document.addEventListener('change', e => {
  const el = e.target.closest('[data-rm]');
  if (el) { const k = el.dataset.rm; if (k.startsWith('rpt:')) S.reports.checklist[k.slice(4)] = el.checked; else S.roadmap.checked[k] = el.checked; save(); render(); return; }
  const m = e.target.closest('[data-rmm]'); if (m) { S.roadmap.mine.find(x => x.id === m.dataset.rmm).done = m.checked; save(); render(); }
});
ACT.rmAdd = () => { const v = $('#rmNew').value.trim(); if (!v) return; S.roadmap.mine.push({ id: uid(), t: v, done: false }); save(); render(); setTimeout(() => $('#rmNew')?.focus(), 0); };
ACT.rmDel = el => { S.roadmap.mine = S.roadmap.mine.filter(m => m.id !== el.dataset.id); save(); render(); };
