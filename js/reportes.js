'use strict';
/* =====================================================================
   reportes.js — Generación de PDF y Excel (.xlsx) sin librerías externas.
   ===================================================================== */

/* ---------- Mini generador de PDF ---------- */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584
];
function pdfTextWidth(str, size, bold) {
  let w = 0;
  for (const ch of String(str)) {
    let c = ch.charCodeAt(0);
    if (c > 126 || c < 32) { c = (ch.normalize('NFD')[0] || '?').charCodeAt(0); if (c > 126 || c < 32) c = 110; }
    let cw = HELV[c - 32] || 556;
    if (bold && !(c >= 48 && c <= 57)) cw *= 1.07;
    w += cw;
  }
  return w * size / 1000;
}
function pdfFit(str, size, maxW, bold) {
  str = String(str);
  if (pdfTextWidth(str, size, bold) <= maxW) return str;
  while (str.length > 1 && pdfTextWidth(str + '...', size, bold) > maxW) str = str.slice(0, -1);
  return str.trimEnd() + '...';
}
const hex01 = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

class MiniPDF {
  constructor(w = 595.28, h = 841.89) { this.W = w; this.H = h; this.pages = []; this.images = []; this.cur = null; this.addPage(); }
  addPage(h) { this.cur = { ops: [], h: h || this.H }; this.pages.push(this.cur); }
  _y(y) { return (this.cur.h - y).toFixed(2); }
  _clean(s) {
    return String(s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
      .replace(/[^\x00-\xff]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  text(str, x, y, { size = 10, bold = false, align = 'left', color = [0, 0, 0] } = {}) {
    const w = pdfTextWidth(str, size, bold);
    if (align === 'right') x -= w; else if (align === 'center') x -= w / 2;
    this.cur.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.map(c => c.toFixed(3)).join(' ')} rg ${x.toFixed(2)} ${this._y(y)} Td (${this._clean(str)}) Tj ET`);
  }
  rect(x, y, w, h, { fill = null, stroke = null, lw = 0.5 } = {}) {
    let op = '';
    if (fill) op += `${fill.map(c => c.toFixed(3)).join(' ')} rg `;
    if (stroke) op += `${stroke.map(c => c.toFixed(3)).join(' ')} RG ${lw} w `;
    op += `${x.toFixed(2)} ${(this.cur.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`;
    this.cur.ops.push(op);
  }
  line(x1, y1, x2, y2, { color = [.8, .8, .8], lw = 0.5 } = {}) {
    this.cur.ops.push(`${color.map(c => c.toFixed(3)).join(' ')} RG ${lw} w ${x1.toFixed(2)} ${this._y(y1)} m ${x2.toFixed(2)} ${this._y(y2)} l S`);
  }
  image(img, x, y, w, h) {                       // img = { data:Uint8Array(JPEG), w, h }
    let idx = this.images.indexOf(img);
    if (idx < 0) { this.images.push(img); idx = this.images.length - 1; }
    this.cur.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(this.cur.h - y - h).toFixed(2)} cm /Im${idx} Do Q`);
  }
  output() {
    const parts = []; let len = 0; const offs = [];
    const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    const push = d => { const b = typeof d === 'string' ? enc(d) : d; parts.push(b); len += b.length; };
    const ni = this.images.length, np = this.pages.length;
    const pageObj = k => 5 + ni + 2 * k;
    const total = 5 + ni + 2 * np;                    // número de objetos + 1 (objeto 0)

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    offs[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offs[2] = len; push(`2 0 obj\n<< /Type /Pages /Kids [${this.pages.map((_, k) => pageObj(k) + ' 0 R').join(' ')}] /Count ${np} >>\nendobj\n`);
    offs[3] = len; push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
    offs[4] = len; push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
    this.images.forEach((im, i) => {
      const n = 5 + i; offs[n] = len;
      push(`${n} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
      push(im.data); push('\nendstream\nendobj\n');
    });
    const xobj = this.images.map((_, i) => `/Im${i} ${5 + i} 0 R`).join(' ');
    this.pages.forEach((pg, k) => {
      const po = pageObj(k), co = po + 1;
      offs[po] = len;
      push(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W.toFixed(2)} ${pg.h.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobj} >> >> /Contents ${co} 0 R >>\nendobj\n`);
      const content = enc(pg.ops.join('\n'));
      offs[co] = len;
      push(`${co} 0 obj\n<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream\nendobj\n');
    });
    const xref = len;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
}

function dataUrlToBytes(url) {
  const b = atob(url.split(',')[1]); const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
function canvasToJpegImage(canvas, q = 0.92) {
  return { data: dataUrlToBytes(canvas.toDataURL('image/jpeg', q)), w: canvas.width, h: canvas.height };
}
function loadImage(src) {
  return new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/* ---------- Reportes en PDF (tabla A4) ---------- */
async function buildTablePDF({ titulo, subtitulo = '', cols, rows, resumen = [] }) {
  const cfg = S.db.config;
  const doc = new MiniPDF();
  const M = 36, CW = doc.W - 2 * M, ROW = 19;
  const brand = hex01(cfg.color || '#0f766e');
  const onBrand = [1, 1, 1];
  const grey = [.42, .45, .5];
  const logoImg = await loadImage(cfg.logo);
  const logo = logoImg ? (() => {
    const k = 120 / Math.max(logoImg.width, logoImg.height);
    const cv = document.createElement('canvas'); cv.width = Math.round(logoImg.width * k); cv.height = Math.round(logoImg.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(logoImg, 0, 0, cv.width, cv.height);
    return canvasToJpegImage(cv, 0.9);
  })() : null;
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const widths = cols.map(c => c.w / totalW * CW);
  let y;

  const tableHead = () => {
    doc.rect(M, y, CW, ROW + 2, { fill: brand });
    let x = M;
    cols.forEach((c, i) => {
      const tx = c.align === 'right' ? x + widths[i] - 6 : x + 6;
      doc.text(c.title, tx, y + 13.5, { size: 8.5, bold: true, color: onBrand, align: c.align === 'right' ? 'right' : 'left' });
      x += widths[i];
    });
    y += ROW + 2;
  };
  const header = first => {
    y = M;
    if (first) {
      let x = M;
      if (logo) {
        const k = 44 / Math.max(logo.w, logo.h);
        doc.image(logo, M, y, logo.w * k, logo.h * k);
        x += logo.w * k + 12;
      }
      doc.text(cfg.negocio || 'Mi Bodega', x, y + 17, { size: 19, bold: true });
      doc.text(titulo, x, y + 33, { size: 11, color: grey });
      doc.text('Generado: ' + fmtDateTime(new Date()), doc.W - M, y + 14, { size: 8.5, color: grey, align: 'right' });
      if (subtitulo) doc.text(subtitulo, doc.W - M, y + 26, { size: 8.5, color: grey, align: 'right' });
      y += 62;
    } else {
      doc.text(`${cfg.negocio || ''} · ${titulo}`, M, y + 8, { size: 8.5, color: grey });
      y += 22;
    }
    tableHead();
  };

  header(true);
  rows.forEach((r, ri) => {
    if (y + ROW > doc.H - M - 28) { doc.addPage(); header(false); }
    if (ri % 2 === 1) doc.rect(M, y, CW, ROW, { fill: [.96, .97, .98] });
    let x = M;
    cols.forEach((c, i) => {
      const raw = c.get(r);
      const bold = !!c.bold;
      const col = c.color ? (c.color(r) || [0.07, 0.09, 0.13]) : [0.07, 0.09, 0.13];
      const txt = pdfFit(raw, 8.5, widths[i] - 12, bold);
      doc.text(txt, c.align === 'right' ? x + widths[i] - 6 : x + 6, y + 13, { size: 8.5, bold, color: col, align: c.align === 'right' ? 'right' : 'left' });
      x += widths[i];
    });
    doc.line(M, y + ROW, M + CW, y + ROW, { color: [.9, .91, .93], lw: .4 });
    y += ROW;
  });
  if (!rows.length) doc.text('Sin registros para mostrar.', M + 6, y + 18, { size: 10, color: grey });

  if (resumen.length) {
    const bh = 12 + resumen.length * 16 + 8;
    if (y + bh + 14 > doc.H - M - 20) { doc.addPage(); y = M; }
    y += 14;
    const bw = 230, bx = doc.W - M - bw;
    doc.rect(bx, y, bw, bh, { fill: [.96, .97, .98], stroke: [.88, .9, .92] });
    resumen.forEach((r, i) => {
      const last = i === resumen.length - 1;
      doc.text(r[0], bx + 12, y + 20 + i * 16, { size: last ? 10 : 9, bold: last, color: last ? [0, 0, 0] : grey });
      doc.text(r[1], bx + bw - 12, y + 20 + i * 16, { size: last ? 10 : 9, bold: true, align: 'right' });
    });
  }
  const n = doc.pages.length;
  doc.pages.forEach((p, i) => { doc.cur = p; doc.text(`Página ${i + 1} de ${n}`, doc.W / 2, doc.H - 20, { size: 8, color: grey, align: 'center' }); });
  return doc.output();
}

/* ---------- Excel real (.xlsx) con bordes, sin librerías ---------- */
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zipStore(files) {                       // files: [{name, data(string)}]  (sin compresión)
  const te = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach(f => {
    const name = te.encode(f.name), data = te.encode(f.data), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** cols: [{title, w, tipo:'texto'|'dinero'|'cant'}]  rows: [[valores]]  total: fila opcional (array, null = vacío) */
function xlsxBlob({ hoja, cols, rows, total }) {
  const X = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const L = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const brand = (S.db.config.color || '#0f766e').replace('#', '').toUpperCase();
  const [r, g, b] = hex01('#' + brand); const claro = (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.6;
  // estilos: 0 normal | 1 encabezado | 2 texto | 3 dinero | 4 cantidad | 5 total texto | 6 total dinero
  const styleOf = t => t === 'dinero' ? 3 : t === 'cant' ? 4 : 2;
  const cell = (v, ref, s) => (v === null || v === undefined || v === '')
    ? `<c r="${ref}" s="${s}"/>`
    : (typeof v === 'number' ? `<c r="${ref}" s="${s}"><v>${v}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`);
  let n = 1;
  let sheetRows = `<row r="1" ht="24" customHeight="1">${cols.map((c, i) => cell(c.title, L(i) + 1, 1)).join('')}</row>`;
  rows.forEach(rw => { n++; sheetRows += `<row r="${n}">${cols.map((c, i) => cell(rw[i], L(i) + n, styleOf(c.tipo))).join('')}</row>`; });
  if (total) { n++; sheetRows += `<row r="${n}">${cols.map((c, i) => cell(total[i], L(i) + n, c.tipo === 'dinero' ? 6 : 5)).join('')}</row>`; }
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
  const border = '<border><left style="thin"><color rgb="FF8A8F98"/></left><right style="thin"><color rgb="FF8A8F98"/></right><top style="thin"><color rgb="FF8A8F98"/></top><bottom style="thin"><color rgb="FF8A8F98"/></bottom><diagonal/></border>';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="${claro ? 'FF111111' : 'FFFFFFFF'}"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${brand}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const nombreHoja = X(hoja).slice(0, 30);
  return zipStore([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }
  ]);
}

const TIPOS_MOV = { entrada: ['Entrada', 'ok'], salida: ['Salida', 'low'], venta: ['Vendido', 'sold'], ajuste: ['Ajuste', ''], anulacion: ['Devuelto', 'ok'] };
const tipoMovTxt = m => (TIPOS_MOV[m.tipo] || [m.tipo])[0] + (m.anulado ? ' (deshecho)' : '');
const estadoStock = p => Calc.agotado(p) ? 'Agotado' : Calc.stockBajo(p) ? 'Stock bajo' : 'Normal';

const Reportes = {
  inventarioRows() {
    return [...S.db.productos].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  },
  async inventarioPDF() {
    const rows = Reportes.inventarioRows();
    const cols = [
      { title: 'PRODUCTO', w: 36, get: p => nombreCompleto(p), bold: true },
      { title: 'CATEGORÍA', w: 20, get: p => p.categoria || '-' },
      { title: 'STOCK', w: 16, align: 'right', get: p => `${fmtQty(p.stock)} ${uShort(p.unidad)}`, bold: true },
      { title: 'MÍNIMO', w: 12, align: 'right', get: p => `${fmtQty(Calc.minimo(p))} ${uShort(p.unidad)}` },
      { title: 'ESTADO', w: 14, get: p => estadoStock(p), color: p => Calc.agotado(p) ? [.85, .18, .13] : Calc.stockBajo(p) ? [.71, .28, .03] : null }
    ];
    const resumen = [['Productos registrados', String(rows.length)], ['Con stock bajo', String(rows.filter(Calc.stockBajo).length)], ['Agotados', String(rows.filter(Calc.agotado).length)]];
    const blob = await buildTablePDF({ titulo: 'Inventario de productos', cols, rows, resumen });
    downloadBlob(blob, `Inventario_${toInputDate(new Date())}.pdf`);
    toast('PDF guardado en Descargas');
  },
  inventarioExcel() {
    const rows = Reportes.inventarioRows();
    const cols = [
      { title: 'Producto', w: 28, get: p => p.nombre },
      { title: 'Presentación', w: 16, get: p => p.presentacion || '' },
      { title: 'Categoría', w: 18, get: p => p.categoria || '' },
      { title: 'Código', w: 12, get: p => p.sku || '' },
      { title: 'Unidad', w: 9, get: p => uShort(p.unidad) },
      { title: 'Stock', w: 11, tipo: 'cant', get: p => rq(p.stock) },
      { title: 'Stock mínimo', w: 13, tipo: 'cant', get: p => rq(Calc.minimo(p)) },
      { title: 'Estado', w: 13, get: p => estadoStock(p) }
    ];
    const data = rows.map(p => cols.map(c => c.get(p)));
    const total = cols.map((c, i) => i === 0 ? 'TOTAL' : i === 1 ? `${rows.length} productos` : null);
    downloadBlob(xlsxBlob({ hoja: 'Inventario', cols, rows: data, total }), `Inventario_${toInputDate(new Date())}.xlsx`);
    toast('Excel guardado en Descargas');
  },

  /** Movimientos del periodo (vendidos, entradas, ajustes…) */
  async movimientosPDF(movs, etiqueta) {
    const rows = [...movs].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const cols = [
      { title: 'FECHA', w: 17, get: m => fmtDateTime(new Date(m.fecha)) },
      { title: 'PRODUCTO', w: 35, get: m => m.nombre, bold: true },
      { title: 'TIPO', w: 15, get: m => tipoMovTxt(m) },
      { title: 'CANTIDAD', w: 14, align: 'right', get: m => `${m.cant >= 0 ? '+' : ''}${fmtQty(m.cant)} ${uShort(m.unidad)}`, bold: true },
      { title: 'NOTA', w: 19, get: m => m.nota || '' }
    ];
    const vend = rows.filter(m => m.tipo === 'venta' && !m.anulado).length;
    const resumen = [['Movimientos', String(rows.length)], ['Productos vendidos (registros)', String(vend)]];
    const blob = await buildTablePDF({ titulo: 'Movimientos de inventario', subtitulo: etiqueta, cols, rows, resumen });
    downloadBlob(blob, `Movimientos_${etiqueta.replace(/[^\w]+/g, '_')}.pdf`);
    toast('PDF guardado en Descargas');
  },
  movimientosExcel(movs, etiqueta) {
    const rows = [...movs].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const cols = [
      { title: 'Fecha', w: 12, get: m => fmtDate(new Date(m.fecha)) },
      { title: 'Hora', w: 11, get: m => fmtTime(new Date(m.fecha)) },
      { title: 'Producto', w: 34, get: m => m.nombre },
      { title: 'Tipo', w: 18, get: m => tipoMovTxt(m) },
      { title: 'Cantidad', w: 12, tipo: 'cant', get: m => rq(m.cant) },
      { title: 'Unidad', w: 9, get: m => uShort(m.unidad) },
      { title: 'Nota', w: 30, get: m => m.nota || '' }
    ];
    const data = rows.map(m => cols.map(c => c.get(m)));
    const total = cols.map((c, i) => i === 0 ? 'TOTAL' : i === 2 ? `${rows.length} movimientos` : null);
    downloadBlob(xlsxBlob({ hoja: 'Movimientos', cols, rows: data, total }), `Movimientos_${etiqueta.replace(/[^\w]+/g, '_')}.xlsx`);
    toast('Excel guardado en Descargas');
  },

  /** Resumen del periodo por producto: cuánto entró, cuánto se vendió y cuánto queda */
  resumenFilas(r) {
    const mapa = {};
    Calc.movs(r.from, r.to).forEach(m => {
      if (m.tipo === 'anulacion' || (m.tipo === 'venta' && m.anulado)) return;
      const x = mapa[m.pid] = mapa[m.pid] || { pid: m.pid, nombre: m.nombre, unidad: m.unidad, entro: 0, vendido: 0, otras: 0 };
      if (m.tipo === 'venta') x.vendido += -m.cant;
      else if (m.cant > 0) x.entro += m.cant;
      else x.otras += -m.cant;
    });
    return Object.values(mapa).map(x => ({ ...x, entro: rq(x.entro), vendido: rq(x.vendido), otras: rq(x.otras), prod: Calc.prod(x.pid) }))
      .sort((a, b) => b.vendido - a.vendido || a.nombre.localeCompare(b.nombre, 'es'));
  },
  async resumenPDF(per, ref) {
    const r = rangoPeriodo(per, ref);
    const rows = Reportes.resumenFilas(r);
    const q = (n, u) => n ? `${fmtQty(n)} ${uShort(u)}` : '-';
    const cols = [
      { title: 'PRODUCTO', w: 34, get: x => x.nombre, bold: true },
      { title: 'ENTRÓ', w: 15, align: 'right', get: x => q(x.entro, x.unidad) },
      { title: 'VENDIDO', w: 17, align: 'right', get: x => q(x.vendido, x.unidad), bold: true },
      { title: 'OTRAS SALIDAS', w: 17, align: 'right', get: x => q(x.otras, x.unidad) },
      { title: 'QUEDA', w: 17, align: 'right', get: x => x.prod ? `${fmtQty(x.prod.stock)} ${uShort(x.prod.unidad)}` : '-' }
    ];
    const resumen = [['Productos con movimiento', String(rows.length)], ['Productos que se vendieron', String(rows.filter(x => x.vendido > 0).length)]];
    const nombre = { dia: 'diario', semana: 'semanal', mes: 'mensual', ano: 'anual' }[per];
    const blob = await buildTablePDF({ titulo: `Resumen ${nombre} de inventario`, subtitulo: r.label, cols, rows, resumen });
    downloadBlob(blob, `Resumen_${nombre}_${r.label.replace(/[^\w]+/g, '_')}.pdf`);
    toast('Resumen guardado en Descargas');
  }
};

const conAviso = f => async () => { try { await f(); } catch (e) { console.error(e); toast('No se pudo crear el archivo', 'err'); } };
Actions['inv-pdf'] = conAviso(() => Reportes.inventarioPDF());
Actions['inv-csv'] = conAviso(() => Reportes.inventarioExcel());
