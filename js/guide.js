/* Dashboard: data-safety notices + first-run setup guide; backup sharing */
'use strict';
const GUIDE = [
  ['home', 'Open the app from your Home Screen', 'In Safari: Share → Add to Home Screen. Data in a plain Safari tab can be cleared after about a week without a visit.', () => !isIOS() || isStandalone(), null],
  ['excel', 'Import Elizabeth\'s Excel', 'Restores the Contacts column, which isn\'t stored in the public code.', () => S.tasks.some(t => t.contacts), 'importXlsx'],
  ['perclass', 'Confirm program settings', 'Positions per class (default 4) is a placeholder — confirm the real number.', null, '#/settings'],
  ['faculty', 'Add faculty and tag their roles', 'PD, core faculty, CCC, PEC, interviewers, psychotherapy supervisors.', () => S.faculty.some(f => (f.roles || []).length), '#/faculty'],
  ['supervisors', 'Set rotation supervisors', 'Block Schedule → Rotations. End-of-rotation evaluations go to these people.', () => S.blocks?.rotations.length && S.blocks.rotations.every(r => r.supervisor), '#/blocks'],
  ['meetings', 'Lay out CCC / PEC meetings', 'Use “Generate an academic-year cycle”, then firm up dates.', () => S.meetings.length > 0, '#/meetings'],
  ['backup', 'Save your first backup', 'Send it to yourself (AirDrop, email, Files) so it can be restored on another device.', () => !!S.meta?.lastBackup, 'shareBackup'],
];
function guideState() { return GUIDE.map(([k, t, d, auto, go]) => ({ k, t, d, go, auto: !!auto, done: (auto && auto()) || !!S.roadmap?.checked['setup:' + k] })); }
function setupGuideCard() {
  if (S.ui.hideGuide) return '';
  const g = guideState(), done = g.filter(x => x.done).length;
  if (done === g.length) return '';
  const next = g.find(x => !x.done);
  return `<div class="card guide" style="margin-bottom:16px"><h2>Getting started <span class="small muted" style="font-weight:500">${done} of ${g.length}</span><span class="spacer"></span><button class="btn sm ghost" data-act="guideHide">Hide</button></h2>
    <div class="meter" style="margin-bottom:10px"><i style="width:${done / g.length * 100}%;background:var(--good)"></i></div>
    <div class="list">${g.map((x, i) => `<div class="li guide-row ${x.done ? 'done' : ''} ${x === next ? 'next' : ''}"><span class="gnum">${x.done ? '✓' : i + 1}</span><div class="grow" style="min-width:0"><b>${esc(x.t)}</b>${x === next || !x.done ? `<div class="small muted">${esc(x.d)}</div>` : ''}</div>${x.done ? '' : `${x.auto ? '' : `<button class="btn sm ghost" data-act="guideDone" data-k="${x.k}" title="Mark done">✓ Done</button>`}${x.go ? `<button class="btn sm ${x === next ? 'primary' : ''}" data-act="guideGo" data-go="${x.go}">Go</button>` : ''}`}</div>`).join('')}</div></div>`;
}
ACT.guideHide = () => { S.ui.hideGuide = true; save(); render(); toast('Setup guide hidden — show it again from Roadmap & Checklists'); };
ACT.guideDone = el => { ensureRoadmap(); S.roadmap.checked['setup:' + el.dataset.k] = true; save(); render(); };
ACT.guideGo = el => { const g = el.dataset.go; if (g.startsWith('#')) location.hash = g; else ACT[g](el); };

function dataSafetyNotices() {
  let out = '';
  if (isIOS() && !isStandalone() && daysSince(S.meta.tabSnooze) > 30)
    out += `<div class="notice warn"><b>You're using the Safari tab version.</b> Safari can erase this app's data after about 7 days without a visit. For safety, add it to your Home Screen (Share → Add to Home Screen) and use it from there.<div class="notice-actions"><button class="btn sm" data-act="snooze" data-k="tabSnooze">Remind me later</button></div></div>`;
  const since = daysSince(S.meta.lastBackup);
  if (since > 7 && daysSince(S.meta.backupSnooze) > 3)
    out += `<div class="notice"><b>${S.meta.lastBackup ? `Last backup was ${since} days ago.` : 'No backup yet.'}</b> Everything is stored only on this device — a backup protects it and lets you copy it to your other devices.<div class="notice-actions"><button class="btn sm primary" data-act="shareBackup">Back up now</button><button class="btn sm" data-act="snooze" data-k="backupSnooze">Later</button></div></div>`;
  return out;
}
ACT.snooze = el => { S.meta[el.dataset.k] = todayISO(); save(); render(); };
ACT.shareBackup = async () => {
  const name = `residency-tracker-backup-${todayISO()}.json`, json = backupJSON();
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Residency Tracker backup' }); markBackedUp(); render(); toast('Backup sent'); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  download(name, json, 'application/json'); markBackedUp(); render(); toast('Backup downloaded');
};
