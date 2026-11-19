/* Anonymous reporting — share link/QR, review inbox with a loud "new report" alert */
'use strict';
const RPT_ST = { new: 'New', ack: 'Acknowledged', review: 'Under review', action: 'Action taken', closed: 'Closed' };
const RPT_CLS = { new: 'st-blocked', ack: 'st-doing', review: 'st-doing', action: 'st-done', closed: 'st-na' };
const RPT_SAMPLES = [
  { category: 'Patient safety or supervision', where: 'Night float / call', when: 'Within the last month', what: 'On several overnight shifts I couldn\'t reach the backup attending for over an hour while a patient on the unit was escalating. I didn\'t feel I could raise this directly. I\'m worried about patient safety and about being on my own for these calls.', help: 'A clear expectation for how fast backup should respond, and a way to escalate when they don\'t.' },
  { category: 'Mistreatment, harassment or discrimination', where: 'Off-service rotation', when: '1–3 months ago', what: 'A staff member on an off-service rotation repeatedly made comments about psychiatry residents "not being real doctors" in front of patients and nurses. It has happened to more than one of us.', help: 'Leadership awareness and a conversation with that service.' },
  { category: 'Work hours / fatigue / workload', where: 'Inpatient psychiatry', when: "It's ongoing", what: 'Notes and discharges are regularly pushing us past our scheduled hours and we feel pressure not to log it accurately.', help: 'Help with discharge workflow; reassurance that accurate hour logging won\'t be held against us.' },
];
function ensureReports() {
  if (!S.reports) {
    const d = new Date(); d.setHours(d.getHours() - 2);
    S.reports = { items: [{ id: uid(), sample: true, received: d.toISOString(), status: 'new', code: 'SMPL-7KQ4', reviewer: '', notes: [], response: '', ...RPT_SAMPLES[0] }], checklist: {} };
  }
}
const reportsNew = () => { ensureReports(); return S.reports.items.filter(r => r.status === 'new').length; };
const fmtDT = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const reportURL = () => new URL('report.html', location.href.split('#')[0]).href;
function reportBanner() {
  const n = reportsNew(); if (!n) return '';
  const newest = S.reports.items.filter(r => r.status === 'new').sort((a, b) => b.received.localeCompare(a.received))[0];
  return `<a class="rpt-alert" href="#/reports"><span class="rpt-siren"></span><div><b>${n} new anonymous report${n > 1 ? 's' : ''}</b><div class="small">Latest received ${fmtDT(newest.received)} · ${esc(newest.category)}${newest.sample ? ' · SAMPLE' : ''}</div></div><span class="rpt-go">Review now →</span></a>`;
}

const RPT_CHECKLIST = [
  ['host', 'Choose an Intermountain-approved way to receive reports that records no names, sign-ins, emails or IP addresses'],
  ['reviewers', 'Decide who reviews reports (ideally including someone outside residents\' direct supervision, e.g., the DIO / GME office)'],
  ['secure', 'Move the reviewer inbox off this device to a secured, access-controlled location'],
  ['timeline', 'Set a response standard (e.g., acknowledge within 2 business days) and an escalation path for safety issues'],
  ['policy', 'Put the reporting process and non-retaliation statement in the resident handbook'],
  ['aggregate', 'Agree how reports are summarized for the PEC / APE without identifying anyone'],
  ['publicize', 'Introduce it at orientation; post the QR code in workrooms and on badge cards'],
  ['test', 'Run an end-to-end test before the first residents arrive'],
];
VIEWS.reports = {
  title: 'Anonymous Reports',
  render() {
    ensureReports();
    const R = S.reports.items.slice().sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || b.received.localeCompare(a.received));
    const url = reportURL();
    const cats = {}; R.forEach(r => cats[r.category] = (cats[r.category] || 0) + 1);
    const max = Math.max(1, ...Object.values(cats));
    const ackd = R.filter(r => r.ackAt), avgH = ackd.length ? avg(ackd.map(r => (new Date(r.ackAt) - new Date(r.received)) / 36e5)) : null;
    return `<div class="page-head"><div><h1>Anonymous Reports</h1><div class="sub">A confidential channel for residents to raise concerns without fear of retaliation. <b>Shell / preview</b> — the form isn't live yet.</div></div><div class="spacer"></div><button class="btn" data-act="rptSim">Simulate incoming report</button></div>
    ${reportBanner()}
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h2>Share with residents</h2>
        <div class="rpt-share"><div class="rpt-qr" id="rptQR">${QR.svg(url, { px: 5 })}</div>
        <div style="min-width:0"><div class="small muted">Report form link</div><div class="rpt-url">${esc(url)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button class="btn sm" data-act="rptCopy">Copy link</button><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Open form</a><button class="btn sm" data-act="rptQRdl">Download QR</button><button class="btn sm" data-act="rptPoster">Print poster</button></div>
          <div class="small muted" style="margin-top:8px">No sign-in. The form page loads nothing that tracks visitors and sends no referrer. It's in preview mode, so submissions aren't delivered yet.</div></div></div></div>
      <div class="card"><h2>Report summary</h2>
        <div class="grid g3" style="gap:10px;margin-bottom:10px"><div class="stat"><span class="lbl">Total</span><span class="num">${R.length}</span></div><div class="stat"><span class="lbl">Open</span><span class="num">${R.filter(r => r.status !== 'closed').length}</span></div><div class="stat"><span class="lbl">Avg. time to acknowledge</span><span class="num" style="font-size:22px">${avgH == null ? '—' : avgH < 48 ? round1(avgH) + ' h' : round1(avgH / 24) + ' d'}</span></div></div>
        ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div class="barrow" style="grid-template-columns:minmax(0,1.5fr) 1fr 30px"><span class="ellipsis">${esc(c)}</span><div class="meter"><i style="width:${n / max * 100}%;background:var(--s1)"></i></div><span class="v">${n}</span></div>`).join('') || '<div class="muted small">No reports yet.</div>'}
        <div class="small muted" style="margin-top:6px">Use counts like these, never individual reports, when presenting to the PEC or for the Annual Program Evaluation.</div></div>
    </div>
    <div class="card" style="padding:0;margin-bottom:16px"><div style="padding:14px 16px 4px;font-weight:650;font-size:15px">Inbox</div>
      ${R.length ? `<div class="list" style="padding:0 16px 8px">${R.map(r => `<div class="li rpt-row ${r.status === 'new' ? 'is-new' : ''}" data-act="rptOpen" data-id="${r.id}"><span class="chip ${RPT_CLS[r.status]}">${r.status === 'new' ? '● ' : ''}${RPT_ST[r.status]}</span><div class="grow" style="min-width:0"><b>${esc(r.category)}</b>${r.sample ? ' <span class="chip st-na">SAMPLE</span>' : ''}<div class="small muted ellipsis">${esc(r.what)}</div></div><span class="when" style="text-align:right">${fmtDate(toISO(new Date(r.received)), { noYear: 1 })}</span></div>`).join('')}</div>` : '<div class="empty"><b>No reports</b>When reports arrive they will show up here and flash on the dashboard.</div>'}</div>
    <div class="card"><h2>Before going live</h2><div class="list">${RPT_CHECKLIST.map(([k, l]) => `<label class="li check" style="font-size:13.5px;align-items:flex-start"><input type="checkbox" data-rcl="${k}" ${S.reports.checklist[k] ? 'checked' : ''} style="margin-top:3px"> <span style="${S.reports.checklist[k] ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${l}</span></label>`).join('')}</div></div>`;
  },
};
document.addEventListener('change', e => { const el = e.target.closest('[data-rcl]'); if (!el) return; S.reports.checklist[el.dataset.rcl] = el.checked; save(); render(); });
ACT.rptCopy = async () => { try { await navigator.clipboard.writeText(reportURL()); toast('Link copied'); } catch (_) { prompt('Copy this link:', reportURL()); } };
ACT.rptQRdl = () => download('anonymous-report-qr.svg', QR.svg(reportURL(), { px: 12 }), 'image/svg+xml');
ACT.rptPoster = () => {
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
  w.document.write(`<title>Anonymous reporting poster</title><body style="font-family:system-ui;text-align:center;padding:40px;color:#0f2c4f"><h1 style="font-size:40px;margin:0">Have a concern?</h1><h2 style="font-weight:500;margin:8px 0 28px">Report it anonymously.</h2>${QR.svg(reportURL(), { px: 10 })}<p style="font-size:18px;margin-top:24px">Scan with your phone camera. No name, no sign-in.</p><p style="font-size:14px;color:#555">${esc(reportURL())}</p><p style="font-size:14px;color:#555;max-width:520px;margin:20px auto 0">Utah Valley Hospital Psychiatry Residency · Concerns raised in good faith are protected from retaliation. If anyone is in immediate danger, call 911.</p></body>`);
  w.document.close(); setTimeout(() => w.print(), 300);
};
ACT.rptSim = () => {
  const t = RPT_SAMPLES[S.reports.items.length % RPT_SAMPLES.length], a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  S.reports.items.push({ id: uid(), sample: true, received: new Date().toISOString(), status: 'new', code: 'SMPL-' + [...Array(4)].map(() => a[Math.floor(Math.random() * a.length)]).join(''), reviewer: '', notes: [], response: '', ...t });
  save(); render(); toast('🔔 New anonymous report received (sample)');
};
ACT.rptOpen = el => openReport(el.dataset.id);
function openReport(id) {
  const r = S.reports.items.find(x => x.id === id); if (!r) return;
  const html = () => `<div class="modal-head"><h2>${esc(r.category)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 14px"><span class="chip ${RPT_CLS[r.status]}">${RPT_ST[r.status]}</span>${r.sample ? '<span class="chip st-na">SAMPLE — not a real report</span>' : ''}<span class="chip">Received ${fmtDT(r.received)}</span>${r.code ? `<span class="chip">Follow-up code ${esc(r.code)}</span>` : ''}</div>
    ${r.status === 'new' ? `<div class="rpt-alert" style="cursor:default"><span class="rpt-siren"></span><div><b>Not yet acknowledged</b><div class="small">Acknowledging stops the alert and starts the response clock.</div></div><button class="btn primary" id="rAck">Acknowledge receipt</button></div>` : ''}
    <div class="form"><div class="f"><span class="small" style="font-weight:600;color:var(--ink-2)">Where</span>${esc(r.where)}</div><div class="f"><span class="small" style="font-weight:600;color:var(--ink-2)">When</span>${esc(r.when)}</div>
    <div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">What happened</span><div class="rpt-quote">${esc(r.what)}</div></div>
    ${r.help ? `<div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">What would help</span><div class="rpt-quote">${esc(r.help)}</div></div>` : ''}</div>
    <div class="section-t">Review</div>
    <div class="seg" style="flex-wrap:wrap">${Object.entries(RPT_ST).map(([k, v]) => `<button class="${r.status === k ? 'active' : ''}" data-rst="${k}">${v}</button>`).join('')}</div>
    <div class="form" style="margin-top:12px"><label class="f">Assigned reviewer<input type="text" id="rRev" value="${esc(r.reviewer)}" list="rRevL"><datalist id="rRevL">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist></label><div></div>
    <label class="f full">Response to the reporter <span class="muted">(they'll see it with their follow-up code once live)</span><textarea id="rResp" ${r.code ? '' : 'disabled placeholder="The reporter did not request a follow-up code."'}>${esc(r.response)}</textarea></label></div>
    <div class="section-t">Internal notes & actions</div>
    ${r.notes.map(n => `<div class="li"><span class="when">${fmtDate(toISO(new Date(n.at)), { noYear: 1 })}</span><div class="grow">${esc(n.t)}</div></div>`).join('') || '<div class="small muted">No notes yet.</div>'}
    <div class="mrow" style="margin-top:6px"><input type="text" id="rNote" placeholder="Add a note (e.g., met with service chief)"><button class="btn sm" id="rAdd">Add</button></div>
    <div class="modal-foot"><button class="btn danger" id="rDel">Delete</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`;
  const sc = openModal(html(), { wide: true, onClose: () => render() });
  const refresh = () => { sc.querySelector('.modal').innerHTML = html(); wire(); };
  const setStatus = st => { if (r.status === 'new' && st !== 'new' && !r.ackAt) r.ackAt = new Date().toISOString(); r.status = st; r.notes.push({ at: new Date().toISOString(), t: `Status → ${RPT_ST[st]}` }); save(); refresh(); renderNav(); };
  const wire = () => {
    const ack = $('#rAck'); if (ack) ack.onclick = () => setStatus('ack');
    $$('[data-rst]', sc).forEach(b => b.onclick = () => setStatus(b.dataset.rst));
    $('#rRev').onchange = e => { r.reviewer = e.target.value; save(); };
    $('#rResp').oninput = e => { r.response = e.target.value; save(); };
    const add = () => { const v = $('#rNote').value.trim(); if (!v) return; r.notes.push({ at: new Date().toISOString(), t: v }); save(); refresh(); };
    $('#rAdd').onclick = add; $('#rNote').onkeydown = e => { if (e.key === 'Enter') add(); };
    $('#rDel').onclick = () => confirmBox(r.sample ? 'Delete this sample report?' : 'Delete this report permanently? Consider closing it instead so it still counts in summaries.', () => { S.reports.items = S.reports.items.filter(x => x !== r); save(); render(); });
  };
  wire();
}
