/* Quick links for Startup Planner tasks (matched by task name). Format per line: "Label | URL". */
'use strict';
const QL = {
  aadprt: 'AADPRT home | https://www.aadprt.org/',
  aadprtReg: '2027 Annual Meeting early registration | https://form.jotform.com/261384838222157',
  aadprtFair: 'AADPRT recruitment fairs | https://www.aadprt.org/trainees/recruitment-fairs',
  aec: 'ACGME Annual Educational Conference | https://www.acgme.org/education-and-resources/annual-educational-conference/',
  ads: 'ACGME ADS (Accreditation Data System) | https://apps.acgme.org/ads',
  rc: 'ACGME Psychiatry Review Committee dates | https://www.acgme.org/specialties/psychiatry/review-committee-members/',
  rcDocs: 'ACGME Psychiatry documents & program requirements | https://www.acgme.org/specialties/psychiatry/documents-and-resources',
  nrmpNew: 'NRMP New Program Form (PDF) | https://www.nrmp.org/wp-content/uploads/2021/12/New-Program-Form.pdf',
  nrmpAdd: 'NRMP: adding a new program to the Match | https://www.nrmp.org/help/item/how-do-i-add-a-new-program-or-institution-to-the-match/',
  nrmpCal: 'NRMP calendar for programs & institutions | https://www.nrmp.org/match-calendars/programs-institutions',
  nrmpPrep: 'NRMP: preparing for the Match | https://www.nrmp.org/programs-institutions/preparing-for-the-match',
  r3: 'NRMP R3 system login | https://r3.nrmp.org/',
  eras: 'ERAS for programs: getting started | https://www.aamc.org/services/eras-for-institutions/program-staff/getting-started',
  erasTL: 'ERAS program timeline | https://aamc.org/services/eras-institutions/program-staff/timeline',
  vslo: 'AAMC VSLO (visiting student rotations) | https://www.aamc.org/services/vslo',
  ni: 'New Innovations login | https://www.new-innov.com/',
};
const TASK_LINKS = [
  [/aadprt annual conference registration/i, ['aadprtReg', 'aadprt']],
  [/aadprt annual conference \(/i, ['aadprtReg', 'aadprt']],
  [/aadprt membership dues/i, ['aadprt']],
  [/aadprt virtual recruitment fair/i, ['aadprtFair']],
  [/acg?m?ge annual educational conference/i, ['aec']],
  [/acgme program dues/i, ['ads']],
  [/acgme review committee/i, ['rc', 'rcDocs']],
  [/acgme accred/i, ['rc', 'ads']],
  [/nrmp new program application/i, ['nrmpNew', 'nrmpAdd']],
  [/nrmp match registration/i, ['nrmpPrep', 'r3', 'nrmpCal']],
  [/rank-order list opens|rank-order list due/i, ['r3', 'nrmpCal']],
  [/soap participation|quota change/i, ['nrmpCal', 'r3']],
  [/^match day$/i, ['nrmpCal']],
  [/eras opens/i, ['eras', 'erasTL']],
  [/medical student rotations|medical student applications/i, ['vslo']],
  [/new innovations|^ni-/i, ['ni']],
  [/recruiting interview season|schedule interview days/i, ['erasTL']],
];
function linksForTask(name) { const hit = TASK_LINKS.find(([re]) => re.test(name)); return hit ? hit[1].map(k => QL[k]).join('\n') : ''; }
function parseLinks(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)\s*\|\s*(https?:\/\/\S+)$/); if (m) return { label: m[1] || m[2], url: m[2] }; const u = l.match(/https?:\/\/\S+/); return u ? { label: l.replace(u[0], '').trim() || u[0].replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: u[0] } : null; }).filter(Boolean);
}
function seedTaskLinks() {
  if (S.meta.linksSeeded) return;
  S.tasks.forEach(t => { if (!t.links) t.links = linksForTask(t.name); });
  S.meta.linksSeeded = 1; save(true);
}
