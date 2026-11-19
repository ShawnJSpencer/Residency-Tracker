/* Residency Tracker — core: state, helpers, router, modals */
'use strict';
const APP_VERSION = 'v7';
const KEY = 'residencyTracker.v1';

const CATS = {
  acgme:   { label: 'ACGME & Accreditation',   c: 's1' },
  match:   { label: 'NRMP / ERAS / Match',     c: 's2' },
  recruit: { label: 'Recruitment & Marketing', c: 's3' },
  conf:    { label: 'Conferences & Dues',      c: 's4' },
  ops:     { label: 'Staffing & Operations',   c: 's7' },
  ni:      { label: 'New Innovations Build',   c: 's6' },
  fd:      { label: 'Faculty Development',     c: 's5' },
  onboard: { label: 'Onboarding & Curriculum', c: 's8' },
};
const STATUS = { todo: 'Not started', doing: 'In progress', done: 'Done', blocked: 'Blocked' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const curYM = () => todayISO().slice(0, 7);
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymLabel = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const ymAdd = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${pad(m)}`; };
const ymRange = (a, b) => { const out = []; let x = a; while (x <= b && out.length < 240) { out.push(x); x = ymAdd(x, 1); } return out; };
const fmtDate = (iso, opt = {}) => { if (!iso) return ''; const d = parseISO(iso); return d.toLocaleDateString(undefined, { weekday: opt.wd ? 'short' : undefined, month: 'short', day: 'numeric', year: opt.noYear ? undefined : 'numeric' }); };
const fmtTime = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const norm = s => String(s || '').toLowerCase().replace(/acmgme|acmge/g, 'acgme').replace(/accredidation/g, 'accreditation').replace(/-\s*psych\b/g, '').replace(/[^a-z0-9]/g, '');
const acadYear = iso => { const d = parseISO(iso); return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; }; // AY start year
const ayLabel = y => `${y}–${String(y + 1).slice(2)}`;
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const round1 = x => x == null ? '' : (Math.round(x * 10) / 10).toFixed(1);
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

/* ---------- defaults ---------- */
function defaultRubric() {
  return [
    { id: uid(), name: 'Academic & clinical preparation', weight: 1, desc: 'Transcript, MSPE, clerkship performance, letters' },
    { id: uid(), name: 'Commitment to psychiatry', weight: 1, desc: 'Experiences, personal statement, clarity of interest' },
    { id: uid(), name: 'Communication & interpersonal skills', weight: 1.5, desc: 'Listening, empathy, rapport during interview' },
    { id: uid(), name: 'Professionalism & integrity', weight: 1.5, desc: 'Reliability, honesty, red flags' },
    { id: uid(), name: 'Teamwork & resilience', weight: 1, desc: 'Handles feedback, collaborative, self-aware' },
    { id: uid(), name: 'Program & community fit', weight: 1, desc: 'Ties to Utah/region, mission alignment, interest in our program' },
  ];
}
function defaultAccreditation() {
  const g = (area, items) => items.map(item => ({ id: uid(), area, item, status: 'todo', owner: '', due: '', notes: '' }));
  return [
    ...g('Leadership & staffing', ['Program Director appointed; qualifications documented', 'Associate Program Director(s) identified', 'Program Coordinator hired with protected time', 'Core faculty identified and protected time confirmed', 'Site directors named for each participating site']),
    ...g('Application & accreditation', ['GMEC / DIO approval of new program', 'ADS new program application submitted', 'Program Letters of Agreement (PLAs) signed with participating sites', 'Site visit preparation (documents, tours, interviews)', 'Review Committee decision received', 'NRMP new program registration & quota set']),
    ...g('Curriculum', ['Four-year block diagram / rotation schedule', 'Rotation goals & objectives (all rotations)', 'Didactic curriculum mapped for all PGY years', 'Psychotherapy curriculum & supervision plan', 'Scholarly activity / QI curriculum', 'Call schedule and supervision structure']),
    ...g('Evaluation & committees', ['Rotation evaluations built (milestone-mapped)', 'Multi-source (360°) evaluations', 'Resident evaluation of faculty & rotations', 'Clinical Competency Committee (CCC) roster & charter', 'Program Evaluation Committee (PEC) roster & charter', 'Semiannual review & summative evaluation templates', 'In-training exam (PRITE) registration plan']),
    ...g('Policies', ['Supervision policy', 'Clinical & educational work hours policy', 'Moonlighting policy', 'Well-being & fatigue mitigation policy', 'Leave policy (vacation, medical, parental, caregiver)', 'Transitions of care / handoff policy', 'Evaluation, promotion & dismissal policy', 'Grievance & due process policy', 'Resident recruitment & selection (eligibility) policy', 'Diversity recruitment & retention plan']),
    ...g('Resources', ['Resident workspace, call rooms, lockers', 'EHR access & templates for residents', 'Library / educational resources', 'Lactation & well-being resources', 'Didactic space & AV for Thursday half-day']),
    ...g('Annual cycle (once residents start)', ['ADS annual update', 'ACGME Resident & Faculty Surveys', 'Milestones reported to ACGME (semiannual)', 'Annual Program Evaluation (APE) & action plan', 'Faculty development hours tracked']),
  ];
}
function defaultEvents() {
  return [
    { id: uid(), title: 'AADPRT registration window', date: '2026-12-04', end: '2027-01-07', type: 'conf', notes: 'From planner' },
    { id: uid(), title: 'ACGME Annual Educational Conference (San Antonio)', date: '2027-02-25', end: '2027-02-27', type: 'conf', notes: '' },
    { id: uid(), title: 'AADPRT Annual Conference (Nashville)', date: '2027-02-28', end: '2027-03-03', type: 'conf', notes: '' },
    { id: uid(), title: 'NRMP rank-order list opens', date: '2028-02-01', end: '', type: 'match', notes: '' },
    { id: uid(), title: 'ACGME Annual Educational Conference (Orlando)', date: '2028-02-24', end: '2028-02-26', type: 'conf', notes: '' },
    { id: uid(), title: 'Match Day', date: '2028-03-17', end: '', type: 'match', notes: '' },
    { id: uid(), title: 'First residents start (PGY-1)', date: '2028-07-01', end: '', type: 'onboard', notes: '' },
  ];
}
function seedState() {
  const tasks = (window.RT_SEED_TASKS || []).map((t, i) => ({ id: uid(), status: 'todo', checklist: [], links: '', order: i, ...t }));
  return {
    v: 1,
    settings: { theme: 'auto', programName: 'Utah Valley Hospital Psychiatry Residency', programStart: '2028-07-01', matchDay: '2028-03-17', perClass: 4, rangeStart: '2026-10', rangeEnd: '2028-07', cycle: 'Match 2028' },
    tasks, applicants: [], interviewDays: [], rubric: defaultRubric(), rankOrder: [], meetings: [], faculty: [], residents: [],
    accreditation: defaultAccreditation(), events: defaultEvents(), didactics: { sessions: {}, cancelled: {} },
    ui: { view: 'dashboard', planner: { mode: 'gantt', q: '', cat: '', owner: '', status: '', hideDone: false, sort: 'sheet', group: false, hidden: [] }, recruitTab: 'applicants', resTab: 'roster', calMonth: curYM(), didAY: 2028, mtgFilter: '' },
  };
}
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  const base = seedState();
  if (!S || !S.v) { S = base; save(true); return; }
  // shallow-fill anything added in newer versions
  for (const k in base) if (S[k] === undefined) S[k] = base[k];
  S.settings = { ...base.settings, ...S.settings };
  S.ui = { ...base.ui, ...S.ui, planner: { ...base.ui.planner, ...(S.ui || {}).planner } };
}
let saveT;
function save(now) {
  clearTimeout(saveT);
  const w = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage full?'); } };
  now ? w() : (saveT = setTimeout(w, 250));
}
function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/* ---------- derived ---------- */
const findTask = id => S.tasks.find(t => t.id === id);
function taskOverdue(t) { if (t.status === 'done' || !t.months.length) return false; return [...t.months].sort().pop() < curYM(); }
function taskStart(t) { return t.months.length ? [...t.months].sort()[0] : '9999-99'; }
function catColor(cat) { return `var(--${(CATS[cat] || CATS.ops).c})`; }
function guessCat(name) {
  const l = name.toLowerCase();
  if (/new innovations|^ni-|^ni /.test(l)) return 'ni';
  if (/faculty development/.test(l)) return 'fd';
  if (/conference|aadprt.*dues/.test(l)) return 'conf';
  if (/acgme|acmge|acmgme/.test(l)) return 'acgme';
  if (/nrmp|eras|match|rank-order|rank order|soap/.test(l)) return 'match';
  if (/program manager|coordinator|budget|annual calendar/.test(l)) return 'ops';
  if (/onboarding|orientation|contract|handbook|academic schedule|curriculum/.test(l)) return 'onboard';
  return 'recruit';
}
function applicantScore(a) {
  const totW = S.rubric.reduce((s, r) => s + (+r.weight || 0), 0) || 1;
  const per = (a.scores || []).map(sc => { let s = 0, w = 0; S.rubric.forEach(r => { const v = +sc.c?.[r.id]; if (v) { s += v * (+r.weight || 0); w += (+r.weight || 0); } }); return w ? s / w : null; }).filter(x => x != null);
  return per.length ? avg(per) : null;
}
function pgyOf(r, iso = todayISO()) { const n = acadYear(iso) - r.classYear + 1; return n; }

/* ---------- modal / drawer ---------- */
function openModal(html, opts = {}) {
  closeModal();
  const sc = document.createElement('div');
  sc.className = 'scrim' + (opts.drawer ? '' : ' center'); sc.id = 'scrim';
  sc.innerHTML = opts.drawer ? `<div class="drawer">${html}</div>` : `<div class="modal ${opts.wide ? 'wide' : ''}">${html}</div>`;
  sc.addEventListener('mousedown', e => { if (e.target === sc) { closeModal(); opts.onClose && opts.onClose(); } });
  document.body.appendChild(sc);
  sc._onClose = opts.onClose;
  const f = sc.querySelector('[autofocus]'); if (f) f.focus();
  return sc;
}
function closeModal() { const s = $('#scrim'); if (s) { s.remove(); } }
function confirmBox(msg, onYes, yesLabel = 'Delete') {
  openModal(`<div class="modal-head"><h2>Are you sure?</h2></div><p>${msg}</p><div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn danger" id="cfy">${esc(yesLabel)}</button></div>`);
  $('#cfy').onclick = () => { closeModal(); onYes(); };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#scrim')) { const s = $('#scrim'); const oc = s._onClose; closeModal(); oc && oc(); } });

/* ---------- tooltip ---------- */
let tipEl;
function showTip(html, x, y) { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); } tipEl.innerHTML = html; tipEl.style.display = 'block'; const w = tipEl.offsetWidth; tipEl.style.left = Math.min(x + 12, innerWidth - w - 8) + 'px'; tipEl.style.top = (y + 14) + 'px'; }
function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
let tipOn = false;
document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('[data-tip]'); if (el) { showTip(el.dataset.tip, e.clientX, e.clientY); tipOn = true; } }, { passive: true });
document.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('[data-tip]'); if (el) { showTip(el.dataset.tip, e.clientX, e.clientY); tipOn = true; } else if (tipOn) { hideTip(); tipOn = false; } }, { passive: true });
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && tipOn) { hideTip(); tipOn = false; } }, { passive: true });

/* ---------- router ---------- */
const VIEWS = {}; // name -> {title, render()}
const ACT = {};   // data-act handlers
const NAV = [
  ['dashboard', 'Dashboard', '<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>'],
  ['planner', 'Startup Planner', '<path d="M3 5h10v3H3zm4 5h12v3H7zm-2 5h9v3H5z"/>'],
  ['calendar', 'Calendar', '<path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z"/>'],
  ['reports', 'Anonymous Reports', '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1 5h2v6h-2zm0 8h2v2h-2z"/>'],
  ['sep'],
  ['recruit', 'Recruitment', '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/>'],
  ['meetings', 'CCC / PEC / Meetings', '<path d="M4 4h16v11H7l-3 3zM8 8h8v2H8z"/>'],
  ['blocks', 'Block Schedule', '<path d="M3 4h18v16H3zm2 2v3h4V6zm6 0v3h4V6zm6 0v3h2V6zM5 11v3h4v-3zm6 0v3h4v-3zm6 0v3h2v-3zM5 16v2h4v-2zm6 0v2h4v-2z"/>'],
  ['evals', 'Evaluations', '<path d="M9 3h6v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3zm1.5 13.6 6-6-1.4-1.4-4.6 4.6-2.1-2.1-1.4 1.4z"/>'],
  ['didactics', 'Didactics', '<path d="M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2V17l7 4 7-4v-3.8L12 17z"/>'],
  ['sep'],
  ['residents', 'Residents & Milestones', '<path d="M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z"/>'],
  ['faculty', 'Faculty', '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1c0-3 3.5-5 7-5s7 2 7 5v1zm15 0v-1c0-1.6-.7-2.9-1.8-3.9 3 .2 6.8 1.6 6.8 3.9v1z"/>'],
  ['accred', 'Accreditation', '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"/>'],
  ['sep'],
  ['roadmap', 'Roadmap & Checklists', '<path d="M4 5h2v2H4zm4 0h12v2H8zm-4 6h2v2H4zm4 0h12v2H8zm-4 6h2v2H4zm4 0h12v2H8z"/>'],
  ['settings', 'Settings & Data', '<path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4L10.7 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>'],
];
function renderNav() {
  const v = S.ui.view;
  $('#nav').innerHTML = `<div class="brand"><b>Residency Tracker</b><small>${esc(S.settings.programName)}</small></div>` +
    NAV.map(n => { if (n[0] === 'sep') return '<div class="sep"></div>'; const b = n[0] === 'reports' && typeof reportsNew === 'function' ? reportsNew() : 0; const rc = n[0] === 'roadmap' && typeof roadmapOpen === 'function' ? roadmapOpen() : 0; return `<a href="#/${n[0]}" class="${v === n[0] ? 'active' : ''} ${b ? 'has-alert' : ''}"><svg viewBox="0 0 24 24" fill="currentColor">${n[2]}</svg>${n[1]}${b ? `<span class="nav-badge">${b}</span>` : ''}${rc ? `<span class="nav-count">${rc}</span>` : ''}</a>`; }).join('') +
    `<div class="foot">${APP_VERSION} · data saved on this device</div>`;
}
function render() {
  const v = VIEWS[S.ui.view] ? S.ui.view : 'dashboard';
  S.ui.view = v;
  renderNav();
  const main = $('#main');
  const sx = main.querySelector('.gantt-wrap')?.scrollLeft, sy = main.querySelector('.gantt-wrap')?.scrollTop;
  main.innerHTML = VIEWS[v].render();
  const nr = typeof reportsNew === 'function' ? reportsNew() : 0; document.title = `${nr ? `(${nr}) New report · ` : ''}${VIEWS[v].title} · Residency Tracker`;
  VIEWS[v].after && VIEWS[v].after({ sx, sy });
}
function route() { const h = location.hash.replace(/^#\/?/, '') || 'dashboard'; S.ui.view = h.split('/')[0]; save(); render(); window.scrollTo(0, 0); }

/* ---------- global delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
ACT.close = () => { const s = $('#scrim'); const oc = s && s._onClose; closeModal(); oc && oc(); };
// Generic form-field binding: <input data-bind="collection:id:field">
function bindGet(path) { const [col, id, field] = path.split(':'); const arr = col.split('.').reduce((o, k) => o[k], S); const obj = Array.isArray(arr) ? arr.find(x => x.id === id) : arr; return { obj, field }; }
function onBind(e) {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  const { obj, field } = bindGet(el.dataset.bind); if (!obj) return;
  obj[field] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
  save();
  if (e.type === 'change' && el.dataset.rerender !== undefined) render();
}
document.addEventListener('input', onBind);
document.addEventListener('change', onBind);
