/* Minimal in-browser .xlsx reader (no libraries) + importer for Elizabeth's Gantt/Notes workbook */
'use strict';
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .xlsx (zip) file');
  const n = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
  const files = {}, td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
    const name = td.decode(u8.subarray(off + 46, off + 46 + nl));
    files[name] = { method, csize, lo };
    off += 46 + nl + el + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true);
    const data = u8.subarray(start, start + f.csize);
    if (f.method === 0) return td.decode(data);
    const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(ds).text();
  };
}
const xml = s => new DOMParser().parseFromString(s, 'application/xml');
const colIdx = ref => { const L = ref.match(/^[A-Z]+/)[0]; let n = 0; for (const c of L) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
const rowIdx = ref => +ref.match(/\d+$/)[0];

async function readXlsx(file) {
  const get = await unzip(await file.arrayBuffer());
  const wb = xml(await get('xl/workbook.xml')), rels = xml(await get('xl/_rels/workbook.xml.rels'));
  const relMap = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => relMap[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ssx = await get('xl/sharedStrings.xml');
  const ss = ssx ? [...xml(ssx).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  // styles → fill key per style index
  const stx = await get('xl/styles.xml'); let xfFill = [];
  if (stx) {
    const st = xml(stx);
    const fills = [...(st.getElementsByTagName('fills')[0]?.getElementsByTagName('fill') || [])].map(f => {
      const pf = f.getElementsByTagName('patternFill')[0]; if (!pf || (pf.getAttribute('patternType') || 'none') === 'none') return null;
      const fg = pf.getElementsByTagName('fgColor')[0]; if (!fg) return 'solid';
      return fg.getAttribute('rgb') || ('t' + fg.getAttribute('theme') + ':' + (fg.getAttribute('tint') || '0')) || ('i' + fg.getAttribute('indexed'));
    });
    const cx = st.getElementsByTagName('cellXfs')[0];
    xfFill = cx ? [...cx.getElementsByTagName('xf')].map(x => fills[+x.getAttribute('fillId') || 0] || null) : [];
  }
  const sheets = [];
  for (const s of wb.getElementsByTagName('sheet')) {
    let target = relMap[s.getAttribute('r:id')] || ''; target = target.replace(/^\/?xl\//, '');
    const sx = await get('xl/' + target); if (!sx) continue;
    const d = xml(sx), cells = {};
    for (const c of d.getElementsByTagName('c')) {
      const r = c.getAttribute('r'), t = c.getAttribute('t'), sIdx = +(c.getAttribute('s') || 0);
      const vEl = c.getElementsByTagName('v')[0];
      let v = vEl ? vEl.textContent : '';
      if (t === 's') v = ss[+v] ?? ''; else if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      cells[r] = { v: String(v).replace(/ /g, ' ').trim(), fill: xfFill[sIdx] || null, r: rowIdx(r), c: colIdx(r) };
    }
    sheets.push({ name: s.getAttribute('name'), cells: Object.values(cells) });
  }
  return sheets;
}

function parsePlannerWorkbook(sheets) {
  const monthIdx = v => { const l = v.toLowerCase().trim(); return MONTHS_LONG.findIndex(m => l === m.toLowerCase() || l === m.slice(0, 3).toLowerCase()); };
  let gantt = null, notes = null;
  for (const sh of sheets) {
    const byRow = {}; sh.cells.forEach(c => (byRow[c.r] ||= []).push(c));
    // Gantt: a row with >= 6 month names
    if (!gantt) for (const r in byRow) {
      const mcells = byRow[r].filter(c => c.v && monthIdx(c.v) >= 0);
      if (mcells.length >= 6) { gantt = { sh, byRow, hdr: +r, mcells: mcells.sort((a, b) => a.c - b.c) }; break; }
    }
    if (!notes && sh !== gantt?.sh) {
      for (const r in byRow) { const vs = byRow[r].map(c => c.v.toLowerCase()); if (vs.some(v => v.includes('additional steps')) || vs.some(v => v.startsWith('contacts'))) { notes = { sh, byRow, hdr: +r }; break; } }
    }
  }
  if (!gantt) throw new Error('Could not find a Gantt sheet (a row of month names).');
  // assign year-month to each month column
  const yearRow = gantt.byRow[gantt.hdr - 1] || [];
  const yearAt = c => { const yc = yearRow.filter(x => /^20\d\d$/.test(x.v) && x.c <= c).sort((a, b) => b.c - a.c)[0]; return yc ? +yc.v : null; };
  let year = yearAt(gantt.mcells[0].c) || new Date().getFullYear(), prev = -1;
  const colYM = {};
  for (const mc of gantt.mcells) {
    const mi = monthIdx(mc.v); const explicit = yearRow.find(x => x.c === mc.c && /^20\d\d$/.test(x.v));
    if (explicit) year = +explicit.v; else if (prev >= 0 && mi < prev) year++;
    prev = mi; colYM[mc.c] = `${year}-${pad(mi + 1)}`;
  }
  const mcols = Object.keys(colYM).map(Number);
  const tasks = [];
  for (const r of Object.keys(gantt.byRow).map(Number).sort((a, b) => a - b)) {
    if (r <= gantt.hdr) continue;
    const row = gantt.byRow[r], name = (row.find(c => c.c === 0)?.v || '').trim();
    const mc = row.filter(c => mcols.includes(c.c));
    const filled = mc.filter(c => c.fill && !/^(FF)?FFFFFF$/i.test(c.fill));
    if (!name || filled.length >= mcols.length - 1) continue; // blank or separator row
    let owner = ''; const monthNotes = {};
    mc.forEach(c => { if (!c.v) return; if (/^[A-Za-z]+$/.test(c.v)) owner = c.v; else monthNotes[colYM[c.c]] = c.v; });
    tasks.push({ name, owner, months: filled.map(c => colYM[c.c]).sort(), monthNotes });
  }
  if (notes) {
    const hdr = notes.byRow[notes.hdr]; const colOf = re => hdr.find(c => re.test(c.v.toLowerCase()))?.c;
    const cS = colOf(/additional|steps/), cC = colOf(/contact/), cT = colOf(/thought|helpful|info/);
    const map = {};
    for (const r of Object.keys(notes.byRow).map(Number)) {
      const row = notes.byRow[r], name = row.find(c => c.c === 0)?.v; if (!name || r === notes.hdr) continue;
      const g = c => (c == null ? '' : row.find(x => x.c === c)?.v || '');
      map[norm(name)] = { steps: g(cS), contacts: g(cC), thoughts: g(cT) };
    }
    tasks.forEach(t => Object.assign(t, map[norm(t.name)] || {}));
  }
  return { tasks, range: [Object.values(colYM)[0], Object.values(colYM).at(-1)], gName: gantt.sh.name, nName: notes?.sh.name };
}

ACT.importXlsx = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const res = parsePlannerWorkbook(await readXlsx(f));
      const byNorm = {}; S.tasks.forEach(t => byNorm[norm(t.name)] = t);
      let added = 0, updated = 0; const changes = [];
      res.tasks.forEach(it => {
        const ex = byNorm[norm(it.name)];
        if (!ex) { added++; changes.push(`<li><b>New:</b> ${esc(it.name)}</li>`); return; }
        const diff = JSON.stringify([ex.months, ex.monthNotes, ex.owner, ex.steps, ex.contacts, ex.thoughts]) !== JSON.stringify([it.months, it.monthNotes, it.owner || ex.owner, it.steps ?? ex.steps, it.contacts ?? ex.contacts, it.thoughts ?? ex.thoughts]);
        if (diff) { updated++; changes.push(`<li><b>Updated:</b> ${esc(it.name)}</li>`); }
      });
      const onlyApp = S.tasks.filter(t => !res.tasks.some(it => norm(it.name) === norm(t.name))).length;
      openModal(`<div class="modal-head"><h2>Import “${esc(f.name)}”</h2><button class="iconbtn" data-act="close">✕</button></div>
        <p>Found <b>${res.tasks.length}</b> tasks on <b>${esc(res.gName)}</b>${res.nName ? ` with notes from <b>${esc(res.nName)}</b>` : ''} (${ymLabel(res.range[0])} – ${ymLabel(res.range[1])}).</p>
        <p><b>${added}</b> new · <b>${updated}</b> changed · ${res.tasks.length - added - updated} unchanged · ${onlyApp} only in this app (kept).</p>
        <p class="small muted">Merging updates months, date notes, owner and the notes columns from the spreadsheet. Your statuses and checklists are kept.</p>
        ${changes.length ? `<ul class="small" style="max-height:220px;overflow:auto">${changes.join('')}</ul>` : ''}
        <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn" id="impReplace">Replace planner</button><button class="btn primary" id="impMerge">Merge</button></div>`);
      const finish = replace => {
        if (replace) S.tasks = [];
        const bn = {}; S.tasks.forEach(t => bn[norm(t.name)] = t);
        res.tasks.forEach((it, i) => {
          const ex = bn[norm(it.name)];
          if (ex) { ex.months = it.months; ex.monthNotes = it.monthNotes; if (it.owner) ex.owner = it.owner; ['steps', 'contacts', 'thoughts'].forEach(k => { if (it[k]) ex[k] = it[k]; }); ex.order = i; }
          else S.tasks.push({ id: uid(), cat: guessCat(it.name), status: 'todo', checklist: [], links: '', steps: '', contacts: '', thoughts: '', ...it, order: i });
        });
        let o = res.tasks.length; S.tasks.filter(t => !res.tasks.some(it => norm(it.name) === norm(t.name))).forEach(t => t.order = o++);
        if (res.range[0] < S.settings.rangeStart) S.settings.rangeStart = res.range[0];
        if (res.range[1] > S.settings.rangeEnd) S.settings.rangeEnd = res.range[1];
        save(); closeModal(); location.hash = '#/planner'; render(); toast('Planner imported');
      };
      $('#impMerge').onclick = () => finish(false);
      $('#impReplace').onclick = () => finish(true);
    } catch (e) { console.error(e); toast('Import failed: ' + e.message); }
  };
  inp.click();
};
