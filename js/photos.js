/* Photos: compressed JPEGs kept in IndexedDB (much more room than localStorage), cached in memory. */
'use strict';
const PHOTOS = new Map();
let photoDB = null;
function idb() {
  if (photoDB) return Promise.resolve(photoDB);
  return new Promise((res, rej) => { const r = indexedDB.open('residencyTracker.photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => { photoDB = r.result; res(photoDB); }; r.onerror = () => rej(r.error); });
}
async function initPhotos() {
  try { const db = await idb(); await new Promise((res) => { const tx = db.transaction('p'), st = tx.objectStore('p'), req = st.openCursor(); req.onsuccess = () => { const c = req.result; if (c) { PHOTOS.set(c.key, c.value); c.continue(); } else res(); }; req.onerror = () => res(); }); }
  catch (e) { console.warn('Photo storage unavailable', e); }
}
async function putPhoto(dataURL, id = 'ph_' + uid()) { PHOTOS.set(id, dataURL); try { const db = await idb(); db.transaction('p', 'readwrite').objectStore('p').put(dataURL, id); } catch (e) { toast('Could not save photo on this device'); } return id; }
async function delPhoto(id) { if (!id) return; PHOTOS.delete(id); try { const db = await idb(); db.transaction('p', 'readwrite').objectStore('p').delete(id); } catch (e) {} }
async function replaceAllPhotos(obj) { PHOTOS.clear(); try { const db = await idb(); await new Promise(r => { const tx = db.transaction('p', 'readwrite'), st = tx.objectStore('p'); st.clear(); Object.entries(obj || {}).forEach(([k, v]) => { st.put(v, k); PHOTOS.set(k, v); }); tx.oncomplete = r; tx.onerror = r; }); } catch (e) {} }
const photoSrc = id => (id && PHOTOS.get(id)) || '';

/* pick + compress: square crop for faces, max-width for buildings */
function pickPhoto({ square = false, max = 640, quality = 0.82 } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return resolve(null);
      try {
        const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(f); });
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = Math.max(0, (sh - s) / 2 - s * 0.08); sw = sh = s; }
        const scale = Math.min(1, max / Math.max(sw, sh)), cw = Math.round(sw * scale), ch = Math.round(sh * scale);
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) { toast('Could not read that image'); resolve(null); }
    };
    inp.click();
  });
}
/* avatar with initials fallback */
function initials(name) { return String(name || '?').replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'; }
function avatar(photoId, name, size = 32) {
  const src = photoSrc(photoId);
  return src ? `<img class="av" src="${src}" alt="" style="width:${size}px;height:${size}px">` : `<span class="av av-i" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${esc(initials(name))}</span>`;
}
/* photo slot UI used by faculty / residents / applicants / sites */
function photoSlotHTML(photoId, label, act, attrs, { square = true, w = 120 } = {}) {
  const src = photoSrc(photoId);
  return `<div class="pslot ${square ? 'sq' : ''}" style="width:${w}px">${src ? `<img src="${src}" alt="">` : `<div class="pslot-empty">📷<span>${esc(label)}</span></div>`}
    <div class="pslot-btns"><button type="button" class="btn sm" data-act="${act}" ${attrs} data-op="set">${src ? 'Change' : 'Add'}</button>${src ? `<button type="button" class="btn sm" data-act="${act}" ${attrs} data-op="del">Remove</button>` : ''}</div></div>`;
}

/* ---------- tiny ZIP writer (store, no compression — JPEGs are already compressed) ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files) { // [{name, data: Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + sz;
  }
  const csz = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
const dataURLBytes = d => { const b = atob(d.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const safeName = s => String(s || 'unnamed').replace(/^(dr\.?)\s+/i, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
