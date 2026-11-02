'use strict';
/* =====================================================================
   utils.js — utilidades generales: estado global, formatos, íconos,
   ventanas modales, avisos y cálculos de inventario.
   ===================================================================== */

/* ---------- Estado global ---------- */
const S = {
  db: null,
  view: 'inicio',
  inv: { q: '', f: 'todos', sel: false, pick: {} },   // sel = modo "marcar vendidos"; pick = productos elegidos
  hist: { tab: 'vend', per: 'dia', ref: new Date() }
};

const Actions = {};   // data-action="x"  -> click
const Inputs = {};    // data-input="x"   -> input
const Changes = {};   // data-change="x"  -> change

/* ---------- DOM ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const rq = n => Math.round(Number(n) * 1e6) / 1e6;          // redondeo de cantidades
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? NaN : n; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Formatos ---------- */
function fmtNum(n, dec = 2) {                  // 1.234,56
  n = Number(n) || 0;
  const neg = n < 0; n = Math.abs(n);
  const [i, d] = n.toFixed(dec).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + g + (dec > 0 ? ',' + d : '');
}
function fmtQty(n) {                           // hasta 3 decimales, sin ceros sobrantes
  let s = fmtNum(rq(n), 3);
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return s;
}
const pad = n => String(n).padStart(2, '0');
const pad6 = n => String(n).padStart(6, '0');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = d => { let h = d.getHours(); const ap = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12 || 12; return `${pad(h)}:${pad(d.getMinutes())} ${ap}`; };
const fmtDateTime = d => fmtDate(d) + ' ' + fmtTime(d);
const toInputDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInputDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function rangoPeriodo(per, ref) {
  const d0 = startOfDay(ref); let from, to, label;
  if (per === 'dia') {
    from = d0; to = addDays(d0, 1);
    label = `${cap(DIAS[d0.getDay()])} ${d0.getDate()} de ${MESES[d0.getMonth()]} ${d0.getFullYear()}`;
  } else if (per === 'semana') {
    from = startOfWeek(d0); to = addDays(from, 7);
    const last = addDays(to, -1);
    label = `${from.getDate()} ${MES3[from.getMonth()]} – ${last.getDate()} ${MES3[last.getMonth()]} ${last.getFullYear()}`;
  } else if (per === 'mes') {
    from = new Date(d0.getFullYear(), d0.getMonth(), 1); to = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
    label = `${cap(MESES[d0.getMonth()])} ${d0.getFullYear()}`;
  } else {
    from = new Date(d0.getFullYear(), 0, 1); to = new Date(d0.getFullYear() + 1, 0, 1);
    label = String(d0.getFullYear());
  }
  return { from, to, label };
}
function shiftPeriodo(per, ref, dir) {
  const d = new Date(ref);
  if (per === 'dia') d.setDate(d.getDate() + dir);
  else if (per === 'semana') d.setDate(d.getDate() + 7 * dir);
  else if (per === 'mes') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}
const PERIODOS = { dia: 'Día', semana: 'Semana', mes: 'Mes', ano: 'Año' };

/* ---------- Unidades ---------- */
const UNITS = {
  und: { label: 'Unidad', short: 'und', group: 'und', factor: 1 },
  kg: { label: 'Kilogramo (kg)', short: 'kg', group: 'peso', factor: 1e6 },
  g: { label: 'Gramo (g)', short: 'g', group: 'peso', factor: 1e3 },
  mg: { label: 'Miligramo (mg)', short: 'mg', group: 'peso', factor: 1 },
  l: { label: 'Litro (L)', short: 'L', group: 'vol', factor: 1e3 },
  ml: { label: 'Mililitro (ml)', short: 'ml', group: 'vol', factor: 1 }
};
const convert = (q, from, to) => rq(q * UNITS[from].factor / UNITS[to].factor);
const compatibleUnits = u => Object.keys(UNITS).filter(k => UNITS[k].group === UNITS[u].group);
const uShort = u => (UNITS[u] || UNITS.und).short;
const MIN_DEFAULT = { und: 5, kg: 5, l: 5, g: 500, ml: 500, mg: 5000 };
const nombreCompleto = p => p.nombre + (p.presentacion ? ' ' + p.presentacion : '');
const hueOf = s => { let h = 0; for (const c of String(s || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/* ---------- Íconos (SVG en línea) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  upload: '<path d="M12 16V5m0 0L8 9m4-4 4 4M5 20h14"/>',
  pdf: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 9"/>',
  print: '<path d="M7 9V3h10v6M7 17H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-3"/><rect x="7" y="14" width="10" height="7"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>',
  chevR: '<path d="m9 5 7 7-7 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  dollar: '<path d="M12 3v18M16.5 7.5C16 6 14.5 5 12 5c-2.5 0-4 1.1-4 3s1.5 2.7 4 3.2 4 1.3 4 3.3-1.6 3.5-4 3.5c-2.5 0-4.1-1-4.5-2.5"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Avisos ---------- */
function toast(msg, type = 'ok') {
  const c = $('#toasts'); if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `${icon(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 280); }, type === 'err' ? 3600 : 2600);
}

/* ---------- Modales ---------- */
function openModal({ title = '', html = '', footer = '', wide = false, onClose = null, onMount = null }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-modal-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">${html}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  let closed = false;
  const api = {
    el: wrap,
    body: $('.modal-body', wrap),
    close() {
      if (closed) return; closed = true;
      wrap.classList.remove('open');
      setTimeout(() => { wrap.remove(); if (!$('.modal-wrap')) document.body.classList.remove('no-scroll'); }, 190);
      if (onClose) onClose();
    }
  };
  wrap.addEventListener('mousedown', e => { wrap._down = e.target === wrap; });
  wrap.addEventListener('click', e => {
    if ((e.target === wrap && wrap._down) || e.target.closest('[data-modal-close]')) api.close();
  });
  const first = $('[autofocus]', wrap) || null;
  if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 60);
  if (onMount) onMount(api);
  return api;
}
const closeTopModal = () => { const all = $$('.modal-wrap'); const m = all[all.length - 1]; if (m) $('[data-modal-close]', m).click(); };

function confirmDialog({ title = '¿Confirmar?', msg = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise(res => {
    let done = false;
    const m = openModal({
      title, html: `<p class="muted-p">${msg}</p>`,
      footer: `<button class="btn" data-modal-close>${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${esc(ok)}</button>`,
      onClose: () => { if (!done) { done = true; res(false); } }
    });
    $('[data-confirm-ok]', m.el).addEventListener('click', () => { done = true; res(true); m.close(); });
  });
}

/* ---------- Descargas ---------- */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function shareOrDownload(blob, name, title) {
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  downloadBlob(blob, name);
  toast('Archivo guardado en Descargas');
}
function csvDownload(nombre, filas) {
  const txt = '\ufeff' + filas.map(r => r.map(c => {
    c = String(c ?? '');
    return /[;"\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
  }).join(';')).join('\r\n');
  downloadBlob(new Blob([txt], { type: 'text/csv;charset=utf-8' }), nombre);
}
const numES = n => String(Number(n)).replace('.', ',');

/* ---------- Cálculos de inventario ---------- */
const Calc = {
  minimo: p => (p.minimo ?? S.db.config.stockMinimo),
  agotado: p => p.stock <= 0,
  stockBajo: p => p.stock > 0 && p.stock < Calc.minimo(p),
  prod: id => S.db.productos.find(p => p.id === id),
  /** Movimientos dentro de un rango de fechas (opcionalmente de un tipo) */
  movs(from, to, tipo) {
    return S.db.movimientos.filter(m => {
      if (tipo && m.tipo !== tipo) return false;
      const d = new Date(m.fecha); return d >= from && d < to;
    });
  },
  /** Vendidos válidos (no deshechos) */
  vendidos(from, to) { return Calc.movs(from, to, 'venta').filter(m => !m.anulado); }
};

/* ---------- Gráfico de barras sencillo ---------- */
function barChart(data, { height = 130 } = {}) {
  const max = Math.max(...data.map(d => d.value), 0.0001);
  const every = data.length > 14 ? 5 : 1;
  return `<div class="bars" style="--bh:${height}px">${data.map((d, i) => {
    const pct = d.value > 0 ? Math.max(d.value / max * 100, 4) : 0;
    const showVal = data.length <= 8 && d.value > 0;
    const lab = (i % every === 0 || i === data.length - 1) ? esc(d.label) : '';
    return `<div class="bar-col" title="${esc(d.title || '')}">
      <div class="bar-val">${showVal ? fmtNum(d.value, 0) : ''}</div>
      <div class="bar-track"><div class="bar-fill ${d.hl ? 'hl' : ''}" style="height:${pct}%"></div></div>
      <div class="bar-lab">${lab}</div></div>`;
  }).join('')}</div>`;
}

/* ---------- Delegación global de eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t || t.disabled) return;
  const fn = Actions[t.dataset.action];
  if (fn) fn(t, e);
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-input]');
  if (!t) return;
  const fn = Inputs[t.dataset.input];
  if (fn) fn(t, e);
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-change]');
  if (!t) return;
  const fn = Changes[t.dataset.change];
  if (fn) fn(t, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('.modal-wrap')) closeTopModal(); return; }
  if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=color]):not([type=file])')) {
    const m = e.target.closest('.modal');
    const b = m && $('[data-submit]', m);
    if (b) { e.preventDefault(); b.click(); }
  }
});
