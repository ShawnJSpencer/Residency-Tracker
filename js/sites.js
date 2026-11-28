/* Training Sites: profiles, people, photos, maps & directions, PLA status, rotation→site, "Where am I?" */
'use strict';
const SITE_TYPES = ['Hospital – inpatient', 'Outpatient clinic', 'Emergency / crisis', 'Community mental health (CMHC)', 'VA', 'Child & adolescent', 'Addiction / SUD', 'State hospital / forensic', 'Other'];
const PLA_ST = { none: 'Not started', draft: 'Drafting', review: 'In review / legal', signed: 'Signed', expired: 'Expired' };
const PLA_CLS = { none: 'st-todo', draft: 'st-doing', review: 'st-doing', signed: 'st-done', expired: 'st-blocked' };
function newSite(o = {}) { return { id: uid(), name: '', type: 'Outpatient clinic', address: '', phone: '', lat: '', lng: '', photoBuilding: '', photoEntrance: '', photoParking: '', director: '', visitLead: '', facultyIds: [], contacts: '', plaStatus: 'none', plaSigned: '', plaExpires: '', plaUrl: '', parking: '', badge: '', ehr: '', firstDay: '', notes: '', ...o }; }
function ensureSites() {
  if (!S.sites) {
    const uvh = newSite({ name: 'Utah Valley Hospital', type: 'Hospital – inpatient', address: '1034 N 500 W, Provo, UT 84604', lat: 40.24722, lng: -111.66583, plaStatus: 'signed', notes: 'Sponsoring institution — no PLA needed.' });
    S.sites = [uvh];
    ensureBlocks(); S.blocks.rotations.forEach(r => { if (!r.siteId && (r.site || '').toLowerCase().includes('utah valley')) r.siteId = uvh.id; });
  }
}
const siteById = id => S.sites.find(s => s.id === id);
const fullAddr = s => s.address || '';
const dirURL = s => { const q = s.lat && s.lng ? `${s.lat},${s.lng}` : fullAddr(s); return isIOS() ? `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&q=${encodeURIComponent(s.name)}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`; };
const mapEmbed = s => `https://www.google.com/maps?q=${encodeURIComponent(s.lat && s.lng ? `${s.lat},${s.lng}` : fullAddr(s))}&z=15&output=embed`;
function plaChip(s) { const soon = s.plaExpires && daysBetween(todayISO(), s.plaExpires) <= 90; const st = s.plaExpires && s.plaExpires < todayISO() ? 'expired' : s.plaStatus; return `<span class="chip ${PLA_CLS[st]}">PLA: ${PLA_ST[st]}${soon && st === 'signed' ? ' · renews ' + fmtDate(s.plaExpires, { noYear: 0 }) : ''}</span>`; }
const rotationsAt = s => S.blocks.rotations.filter(r => r.siteId === s.id);

/* where a resident position is on a date */
function whereIs(posKey, iso) {
  ensureBlocks(); const ay = acadYear(iso), bd = blockDates(ay), b = bd.findIndex(([s, e]) => iso >= s && iso <= e);
  if (b < 0) return null; const rid = (S.blocks.assign[ay]?.[posKey] || [])[b], R = rot(rid);
  return { ay, b, start: bd[b][0], end: bd[b][1], R, site: R && siteById(R.siteId) };
}

VIEWS.sites = {
  title: 'Training Sites',
  render() {
    ensureSites();
    const tab = S.ui.siteTab || 'list', T = (k, l) => `<button class="${tab === k ? 'active' : ''}" data-act="sitetab" data-t="${k}">${l}</button>`;
    return `<div class="page-head"><div><h1>Training Sites</h1><div class="sub">Where residents train — people, photos, directions, and affiliation agreements</div></div><div class="spacer"></div><button class="btn primary" data-act="siteAdd">+ Site</button></div>
      <div class="tabs">${T('list', `Sites (${S.sites.length})`)}${T('map', 'Map')}${T('where', 'Where am I?')}</div>
      ${{ list: siteListHTML, map: siteMapHTML, where: whereHTML }[tab]()}`;
  },
  after() { if ((S.ui.siteTab || 'list') === 'map') drawSiteMap(); const a = $('#whR'), b = $('#whD'); if (a) [a, b].forEach(el => el.onchange = () => { S.ui.whR = a.value; S.ui.whD = b.value; save(); render(); }); },
};
ACT.sitetab = el => { S.ui.siteTab = el.dataset.t; save(); render(); };
function siteListHTML() {
  return `<div class="sites">${S.sites.map(s => { const ph = photoSrc(s.photoBuilding), rs = rotationsAt(s); return `<div class="site" data-act="siteOpen" data-id="${s.id}">
    <div class="site-img">${ph ? `<img src="${ph}" alt="">` : '<span>🏥<br><small>Add a building photo</small></span>'}</div>
    <div class="site-body"><b class="site-name">${esc(s.name || '(unnamed site)')}</b><div class="small muted">${esc(s.type)}</div>
    <div class="small" style="margin:6px 0">${esc(s.address || 'No address yet')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${plaChip(s)}${rs.map(r => `<span class="chip"><span class="dot" style="background:var(--${r.c})"></span>${esc(r.abbr)}</span>`).join('')}</div>
    ${s.director ? `<div class="small">Site director: <b>${esc(s.director)}</b></div>` : ''}
    ${s.address ? `<a class="btn sm" href="${dirURL(s)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="margin-top:8px">📍 Directions</a>` : ''}</div></div>`; }).join('')}</div>
    <div class="small muted" style="margin-top:10px">Link rotations to sites on Block Schedule → Rotations; residents' blocks then show where to go.</div>`;
}
ACT.siteAdd = () => { const s = newSite(); S.sites.push(s); openSite(s.id, true); };
ACT.siteOpen = el => openSite(el.dataset.id);
ACT.sitePhoto = async el => {
  const s = siteById(el.dataset.id), k = el.dataset.k;
  if (el.dataset.op === 'del') { await delPhoto(s[k]); s[k] = ''; }
  else { const d = await pickPhoto({ square: false, max: 1280, quality: 0.78 }); if (!d) return; if (s[k]) await delPhoto(s[k]); s[k] = await putPhoto(d); }
  save(); openSite(s.id);
};
ACT.siteGeo = async el => {
  const s = siteById(el.dataset.id); if (!s.address) return toast('Enter an address first');
  try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(s.address)}`, { headers: { Accept: 'application/json' } }); const j = await r.json(); if (!j[0]) return toast('Address not found — enter latitude/longitude by hand'); s.lat = +(+j[0].lat).toFixed(5); s.lng = +(+j[0].lon).toFixed(5); save(); openSite(s.id); toast('Location found'); }
  catch (e) { toast('Could not look up the address (offline?)'); }
};
function openSite(id, isNew) {
  const s = siteById(id), b = k => `data-bind="sites:${id}:${k}"`, rs = rotationsAt(s);
  const fac = S.faculty.filter(f => (s.facultyIds || []).includes(f.id));
  openModal(`<div class="modal-head"><h2>${isNew ? 'New site' : esc(s.name)}</h2><button class="iconbtn" data-act="close">✕</button></div>
    <div class="sitephotos">${[['photoBuilding', 'Building'], ['photoEntrance', 'Entrance to use'], ['photoParking', 'Parking']].map(([k, l]) => `<div><div class="small" style="font-weight:600;margin-bottom:4px">${l}</div>${photoSlotHTML(s[k], l, 'sitePhoto', `data-id="${id}" data-k="${k}"`, { square: false, w: 180 })}</div>`).join('')}</div>
    <div class="form"><label class="f">Site name<input type="text" ${b('name')} value="${esc(s.name)}" ${isNew ? 'autofocus' : ''}></label><label class="f">Type<select ${b('type')}>${SITE_TYPES.map(t => `<option ${s.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f full">Address<input type="text" ${b('address')} value="${esc(s.address)}" placeholder="Street, city, state ZIP"></label>
    <label class="f">Main phone<input type="text" ${b('phone')} value="${esc(s.phone)}"></label><div class="f"><span class="small" style="font-weight:600;color:var(--ink-2)">Map location</span><div style="display:flex;gap:6px"><input type="text" ${b('lat')} value="${s.lat}" placeholder="lat" style="width:50%"><input type="text" ${b('lng')} value="${s.lng}" placeholder="lng" style="width:50%"></div><button type="button" class="btn sm" data-act="siteGeo" data-id="${id}" style="margin-top:4px">Find from address</button></div></div>
    ${s.address ? `<div class="sitemap"><iframe src="${mapEmbed(s)}" loading="lazy" referrerpolicy="no-referrer" title="Map"></iframe></div><a class="btn" href="${dirURL(s)}" target="_blank" rel="noopener">📍 Directions in ${isIOS() ? 'Apple' : 'Google'} Maps</a>` : ''}
    <div class="section-t">People</div>
    <div class="form"><label class="f">Site director<input type="text" list="sfl" ${b('director')} value="${esc(s.director)}"></label><label class="f">Site visit lead<input type="text" list="sfl" ${b('visitLead')} value="${esc(s.visitLead)}"></label>
    <datalist id="sfl">${S.faculty.map(f => `<option value="${esc(f.name)}">`).join('')}</datalist>
    <div class="f full"><span class="small" style="font-weight:600;color:var(--ink-2)">Faculty who teach here</span><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px">${S.faculty.map(f => `<label class="check"><input type="checkbox" data-sf="${f.id}" ${(s.facultyIds || []).includes(f.id) ? 'checked' : ''}> ${avatar(f.photoId, f.name, 24)} ${esc(f.name)}</label>`).join('') || '<span class="small muted">Add faculty on the Faculty page.</span>'}</div></div>
    <label class="f full">Other key contacts (unit manager, front desk, scheduler)<textarea ${b('contacts')}>${esc(s.contacts)}</textarea></label></div>
    <div class="section-t">Affiliation agreement (PLA)</div>
    <div class="form"><label class="f">Status<select ${b('plaStatus')}>${Object.entries(PLA_ST).map(([k, v]) => `<option value="${k}" ${s.plaStatus === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="f">Signed<input type="date" ${b('plaSigned')} value="${s.plaSigned}"></label>
    <label class="f">Expires / renew by<input type="date" ${b('plaExpires')} value="${s.plaExpires}"></label><label class="f">Link to signed copy<input type="text" ${b('plaUrl')} value="${esc(s.plaUrl)}" placeholder="SharePoint / Drive link"></label></div>
    <div class="section-t">First-day info for residents</div>
    <div class="form"><label class="f full">Where to go on day one<textarea ${b('firstDay')} placeholder="Which entrance, who to ask for, what time">${esc(s.firstDay)}</textarea></label>
    <label class="f">Parking<textarea ${b('parking')}>${esc(s.parking)}</textarea></label><label class="f">Badge / building access<textarea ${b('badge')}>${esc(s.badge)}</textarea></label>
    <label class="f">EHR / logins<textarea ${b('ehr')}>${esc(s.ehr)}</textarea></label><label class="f">Notes<textarea ${b('notes')}>${esc(s.notes)}</textarea></label></div>
    ${rs.length ? `<div class="section-t">Rotations here</div><div>${rs.map(r => `<span class="chip" style="margin:2px"><span class="dot" style="background:var(--${r.c})"></span>${esc(r.abbr)} · ${esc(r.name)}</span>`).join('')}</div>` : ''}
    <div class="modal-foot"><button class="btn danger" id="sDel">Delete site</button><div class="spacer"></div><button class="btn primary" data-act="close">Done</button></div>`, { wide: true, onClose: () => { if (!s.name) S.sites = S.sites.filter(x => x !== s); save(); render(); } });
  $$('[data-sf]').forEach(cb => cb.onchange = () => { s.facultyIds = $$('[data-sf]').filter(c => c.checked).map(c => c.dataset.sf); save(); });
  $('#sDel').onclick = () => confirmBox(`Delete <b>${esc(s.name || 'this site')}</b>? Rotations linked to it will be unlinked.`, () => { S.sites = S.sites.filter(x => x !== s); S.blocks.rotations.forEach(r => { if (r.siteId === s.id) r.siteId = ''; }); });
}

/* overview map — Leaflet + OpenStreetMap tiles, loaded only when this tab opens */
function siteMapHTML() {
  const missing = S.sites.filter(s => !(s.lat && s.lng));
  return `<div class="card" style="padding:0;overflow:hidden"><div id="siteMap" style="height:min(62vh,560px)"><div class="empty" style="padding-top:120px">Loading map…</div></div></div>
    ${missing.length ? `<div class="small muted" style="margin-top:8px">Not on the map yet (open the site and tap “Find from address”): ${missing.map(s => `<a href="#" data-act="siteOpen" data-id="${s.id}">${esc(s.name || 'unnamed')}</a>`).join(', ')}</div>` : ''}`;
}
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve();
  return new Promise((ok, bad) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = ok; js.onerror = bad; document.head.appendChild(js);
  });
}
async function drawSiteMap() {
  const el = $('#siteMap'); if (!el) return;
  try { await loadLeaflet(); } catch (e) { el.innerHTML = '<div class="empty"><b>Map unavailable</b>The map needs an internet connection.</div>'; return; }
  if (!$('#siteMap')) return;
  el.innerHTML = '';
  const pts = S.sites.filter(s => s.lat && s.lng), map = window.L.map(el, { scrollWheelZoom: false });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  if (!pts.length) { map.setView([40.2338, -111.6585], 11); return; }
  const b = [];
  pts.forEach(s => { const m = window.L.marker([+s.lat, +s.lng]).addTo(map); m.bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.address)}<br><a href="${dirURL(s)}" target="_blank" rel="noopener">Directions</a> · <a href="#" onclick="openSite('${s.id}');return false">Details</a>`); b.push([+s.lat, +s.lng]); });
  pts.length === 1 ? map.setView(b[0], 14) : map.fitBounds(b, { padding: [40, 40] });
}

/* "Where am I?" — a resident's site for a date (resident-facing preview) */
function whereHTML() {
  const ay0 = acadYear(S.settings.programStart), t = todayISO(), D = S.ui.whD || (t < S.settings.programStart ? S.settings.programStart : t);
  const rows = blockRows(acadYear(D)); const R = rows.find(r => r.key === S.ui.whR) || rows[0];
  const w = R && whereIs(R.key, D);
  return `<div class="toolbar"><label class="small" style="font-weight:600">Resident <select id="whR">${rows.map(r => `<option value="${r.key}" ${R && r.key === R.key ? 'selected' : ''}>${esc(r.label)} (PGY-${r.pgy})</option>`).join('') || '<option>No residents this year</option>'}</select></label><label class="small" style="font-weight:600">Date <input type="date" id="whD" value="${D}"></label></div>
    <p class="small muted" style="margin-top:0">This is what a resident's “Where do I go?” card will look like once residents can sign in. It reads their block schedule and the rotation's site.</p>
    ${!R ? '<div class="card empty"><b>No residents in that academic year</b>Pick a date on or after July 1, ' + ay0 + '.</div>' : !w ? '<div class="card empty"><b>Not in a block on that date</b></div>' : !w.R ? `<div class="card empty"><b>No rotation scheduled</b>${esc(R.label)} has nothing in block ${w.b + 1} (${fmtDate(w.start, { noYear: 1 })} – ${fmtDate(w.end, { noYear: 1 })}). Fill it in on the Block Schedule.</div>` : whereCard(R.label, w)}`;
}
function whereCard(label, w) {
  const s = w.site;
  return `<div class="card where"><div class="small muted">${esc(label)} · Block ${w.b + 1} · ${fmtDate(w.start, { noYear: 1 })} – ${fmtDate(w.end, { noYear: 1 })}</div>
    <h2 style="font-size:20px;margin:6px 0 2px"><span class="dot" style="background:var(--${w.R.c});width:12px;height:12px"></span> ${esc(w.R.name)}</h2>
    ${s ? `<div style="font-weight:600">${esc(s.name)}</div><div class="small muted">${esc(s.address)}</div>
      ${photoSrc(s.photoBuilding) ? `<img class="where-img" src="${photoSrc(s.photoBuilding)}" alt="">` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">${s.address ? `<a class="btn primary" href="${dirURL(s)}" target="_blank" rel="noopener">📍 Directions</a>` : ''}${s.phone ? `<a class="btn" href="tel:${esc(s.phone)}">📞 Call site</a>` : ''}</div>
      ${s.firstDay ? `<div class="section-t">Day one</div><div style="white-space:pre-wrap">${esc(s.firstDay)}</div>` : ''}
      ${photoSrc(s.photoEntrance) ? `<div class="section-t">Entrance</div><img class="where-img" src="${photoSrc(s.photoEntrance)}" alt="">` : ''}
      ${s.parking ? `<div class="section-t">Parking</div><div style="white-space:pre-wrap">${esc(s.parking)}</div>` : ''}
      ${w.R.supervisor || s.director ? `<div class="section-t">Who to ask for</div><div>${esc(w.R.supervisor || s.director)}</div>` : ''}`
      : `<div class="small" style="margin-top:6px;color:var(--warn)">This rotation isn't linked to a site yet — set it on Block Schedule → Rotations.</div>`}</div>`;
}
/* dashboard card: where residents are this block */
function whereDashCard() {
  ensureSites(); const t = todayISO(), ay = acadYear(t), rows = blockRows(ay);
  const items = rows.map(r => ({ r, w: whereIs(r.key, t) })).filter(x => x.w && x.w.R);
  if (!items.length) return '';
  return `<div class="card"><h2>Where residents are this block <span class="spacer"></span><a class="small" href="#/sites">Sites →</a></h2><div class="list">${items.map(({ r, w }) => `<div class="li"><div class="grow"><b>${esc(r.label)}</b> <span class="small muted">PGY-${r.pgy}</span><div class="small">${esc(w.R.name)}${w.site ? ' · ' + esc(w.site.name) : ''}</div></div>${w.site?.address ? `<a class="btn sm" href="${dirURL(w.site)}" target="_blank" rel="noopener">📍</a>` : ''}</div>`).join('')}</div></div>`;
}
