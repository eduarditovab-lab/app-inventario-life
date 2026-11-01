'use strict';
/* historial.js — Lo vendido y los movimientos del inventario por día / semana / mes / año */

const Historial = {
  datos() {
    const H = S.hist, r = rangoPeriodo(H.per, H.ref);
    const movs = Calc.movs(r.from, r.to).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const vend = movs.filter(m => m.tipo === 'venta');
    return { r, movs, vend, vendOk: vend.filter(m => !m.anulado) };
  },

  /** Agrupa los vendidos por "lote" (lo que se marcó junto en una misma venta) */
  lotes(vend) {
    const mapa = new Map();
    vend.forEach(m => {
      const k = m.lote || m.id;
      if (!mapa.has(k)) mapa.set(k, { id: k, fecha: m.fecha, items: [] });
      mapa.get(k).items.push(m);
    });
    return [...mapa.values()];
  },

  render(root) {
    const H = S.hist, { r, movs, vend, vendOk } = this.datos();
    const nEntr = movs.filter(m => m.tipo === 'entrada').length;
    const nOtros = movs.filter(m => m.tipo === 'salida' || m.tipo === 'ajuste').length;
    const nVentas = this.lotes(vendOk).length;

    root.innerHTML = `
      <div class="page-head">
        <div><h1>Historial</h1><p class="sub">Lo que se vendió y cómo se movió tu inventario</p></div>
        <div class="head-actions">
          <button class="btn btn-soft" data-action="hist-resumen" ${movs.length ? '' : 'disabled'}>${icon('receipt')}<span>Resumen ${{ dia: 'del día', semana: 'de la semana', mes: 'del mes', ano: 'del año' }[H.per]}</span></button>
          <button class="btn" data-action="hist-pdf" ${movs.length ? '' : 'disabled'}>${icon('pdf')}<span>PDF</span></button>
          <button class="btn" data-action="hist-csv" ${movs.length ? '' : 'disabled'}>${icon('download')}<span>Excel</span></button>
        </div>
      </div>

      <div class="period-bar">
        <div class="seg">${Object.entries(PERIODOS).map(([k, l]) => `<button class="${H.per === k ? 'on' : ''}" data-action="hist-per" data-per="${k}">${l}</button>`).join('')}</div>
        <div class="period-nav">
          <button class="icon-btn" data-action="hist-prev" aria-label="Anterior">${icon('chevL')}</button>
          <button class="btn btn-ghost label" data-action="hist-fecha" title="Elegir fecha">${icon('calendar')}${esc(r.label)}</button>
          <input type="date" id="hist-date" value="${toInputDate(H.ref)}" data-change="hist-date">
          <button class="icon-btn" data-action="hist-next" aria-label="Siguiente">${icon('chevR')}</button>
          <button class="btn btn-sm" data-action="hist-hoy">Hoy</button>
        </div>
      </div>

      <div class="grid cols-3" style="margin-bottom:16px">
        <div class="card stat accent"><div class="lab">${icon('check')}Vendidos</div><div class="val">${vendOk.length}</div><div class="sec">${nVentas} salida${nVentas === 1 ? '' : 's'} registrada${nVentas === 1 ? '' : 's'}</div></div>
        <div class="card stat"><div class="lab">${icon('plus')}Entradas</div><div class="val">${nEntr}</div><div class="sec">mercancía que llegó</div></div>
        <div class="card stat"><div class="lab">${icon('refresh')}Otros</div><div class="val">${nOtros}</div><div class="sec">mermas y ajustes</div></div>
      </div>

      <div class="seg" style="margin-bottom:14px">
        <button class="${H.tab === 'vend' ? 'on' : ''}" data-action="hist-tab" data-tab="vend">Vendidos</button>
        <button class="${H.tab === 'movs' ? 'on' : ''}" data-action="hist-tab" data-tab="movs">Todos los movimientos</button>
      </div>
      <div id="hist-body"></div>`;
    this.body();
  },

  desglose(vendOk, r) {
    const per = S.hist.per;
    if (per === 'dia') return '';
    const data = [];
    if (per === 'ano') {
      for (let m = 0; m < 12; m++) {
        const a = new Date(r.from.getFullYear(), m, 1), b = new Date(r.from.getFullYear(), m + 1, 1);
        const n = vendOk.filter(x => { const d = new Date(x.fecha); return d >= a && d < b; }).length;
        data.push({ label: MES3[m], value: n, title: `${cap(MESES[m])}: ${n} vendidos` });
      }
    } else {
      for (let d = new Date(r.from); d < r.to; d = addDays(d, 1)) {
        const a = d, b = addDays(d, 1);
        const n = vendOk.filter(x => { const f = new Date(x.fecha); return f >= a && f < b; }).length;
        data.push({ label: per === 'semana' ? `${DIA3[a.getDay()]} ${a.getDate()}` : String(a.getDate()), value: n, title: `${fmtDate(a)}: ${n} vendidos` });
      }
    }
    if (!data.some(d => d.value > 0)) return '';
    return `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${per === 'ano' ? 'Vendidos por mes' : 'Vendidos por día'}</h3></div>${barChart(data, { height: 120 })}</div>`;
  },

  body() {
    const H = S.hist, { r, movs, vend, vendOk } = this.datos(), box = $('#hist-body');
    if (H.tab === 'movs') return this.movs(box, movs);

    if (!vend.length) {
      box.innerHTML = `<div class="card empty">${icon('check')}<h4>No se vendió nada en este periodo</h4><p>En Inventario pulsa «Marcar vendidos», elige los productos y listo.</p></div>`;
      return;
    }
    // Más vendidos (por cuántas veces se vendió y cantidad total)
    const mapa = {};
    vendOk.forEach(m => {
      const x = mapa[m.pid] = mapa[m.pid] || { nombre: m.nombre, veces: 0, cant: 0, unidad: m.unidad };
      x.veces += 1; x.cant += -m.cant;
    });
    const top = Object.values(mapa).sort((a, b) => b.veces - a.veces || b.cant - a.cant).slice(0, 6);
    const maxTop = top.length ? top[0].veces : 1;
    const lotes = this.lotes(vend);

    box.innerHTML = `
      ${this.desglose(vendOk, r)}
      <div class="grid main-side">
        <div>${lotes.map(l => this.loteHtml(l)).join('')}</div>
        <div class="card">
          <div class="card-head"><h3>Más vendidos</h3></div>
          ${top.length ? `<div class="rank">${top.map(t => `<div class="rank-row"><div class="rk-top"><span>${esc(t.nombre)}</span><b>${fmtQty(t.cant)} ${uShort(t.unidad)}</b></div><div class="meter"><i style="width:${t.veces / maxTop * 100}%"></i></div></div>`).join('')}</div>` : '<p class="muted">Sin datos.</p>'}
        </div>
      </div>`;
  },

  loteHtml(l) {
    const d = new Date(l.fecha), deshecho = l.items.every(m => m.anulado);
    return `<details class="sale ${deshecho ? 'void' : ''}">
      <summary>
        <div class="s-l"><b>${l.items.length} producto${l.items.length === 1 ? '' : 's'} vendido${l.items.length === 1 ? '' : 's'} ${deshecho ? '<span class="badge void">Deshecho</span>' : ''}</b><small>${fmtDateTime(d)}</small></div>
        <div class="s-r"><small>${icon('chevR')}</small></div>
      </summary>
      <div class="sale-body">
        ${l.items.map(m => `<div class="line"><div>${esc(m.nombre)}</div><b>${fmtQty(-m.cant)} ${uShort(m.unidad)}</b></div>`).join('')}
        ${deshecho ? '' : `<div class="sale-actions"><button class="btn btn-sm" data-action="lote-deshacer" data-id="${esc(l.id)}">Deshacer (devolver al inventario)</button></div>`}
      </div></details>`;
  },

  movs(box, movs) {
    if (!movs.length) { box.innerHTML = `<div class="card empty">${icon('box')}<h4>Sin movimientos en este periodo</h4></div>`; return; }
    box.innerHTML = `<div class="card">${movs.map(m => {
      const [lab, cls] = TIPOS_MOV[m.tipo] || [m.tipo, ''];
      return `<div class="mov"><div class="m-main"><b>${esc(m.nombre)}</b><small>${fmtDateTime(new Date(m.fecha))}${m.nota ? ' · ' + esc(m.nota) : ''}${m.anulado ? ' · deshecho' : ''}</small></div>
        <span class="badge ${cls}">${lab}</span>
        <div class="m-q ${m.cant >= 0 ? 'pos' : 'neg'}" style="${m.anulado ? 'text-decoration:line-through;opacity:.6' : ''}">${m.cant >= 0 ? '+' : ''}${fmtQty(m.cant)} ${uShort(m.unidad)}</div></div>`;
    }).join('')}</div>`;
  }
};

const histRefresh = () => Historial.render($('#view'));
Actions['hist-per'] = t => { S.hist.per = t.dataset.per; histRefresh(); };
Actions['hist-tab'] = t => { S.hist.tab = t.dataset.tab; histRefresh(); };
Actions['hist-prev'] = () => { S.hist.ref = shiftPeriodo(S.hist.per, S.hist.ref, -1); histRefresh(); };
Actions['hist-next'] = () => { S.hist.ref = shiftPeriodo(S.hist.per, S.hist.ref, 1); histRefresh(); };
Actions['hist-hoy'] = () => { S.hist.ref = new Date(); histRefresh(); };
Actions['hist-fecha'] = () => { const i = $('#hist-date'); try { i.showPicker(); } catch (e) { i.focus(); i.click(); } };
Changes['hist-date'] = t => { if (t.value) { S.hist.ref = fromInputDate(t.value); histRefresh(); } };

Actions['hist-resumen'] = conAviso(() => Reportes.resumenPDF(S.hist.per, S.hist.ref));
Actions['hist-pdf'] = conAviso(() => { const { r, movs } = Historial.datos(); return Reportes.movimientosPDF(movs, r.label); });
Actions['hist-csv'] = conAviso(() => { const { r, movs } = Historial.datos(); return Reportes.movimientosExcel(movs, r.label); });

Actions['lote-deshacer'] = async t => {
  const items = S.db.movimientos.filter(m => m.tipo === 'venta' && !m.anulado && (m.lote || m.id) === t.dataset.id);
  if (!items.length) return;
  const ok = await confirmDialog({ title: 'Deshacer lo vendido', msg: `Se devolverán <b>${items.length} producto${items.length === 1 ? '' : 's'}</b> al inventario. ¿Continuar?`, ok: 'Deshacer', danger: true });
  if (!ok) return;
  const ahora = new Date().toISOString();
  items.forEach(m => {
    m.anulado = true;
    const p = Calc.prod(m.pid);
    if (p) p.stock = rq(p.stock - m.cant);       // m.cant es negativo
    S.db.movimientos.push({ id: uid(), fecha: ahora, pid: m.pid, nombre: m.nombre, tipo: 'anulacion', cant: -m.cant, unidad: m.unidad, nota: 'Se deshizo lo vendido' });
  });
  Storage.save(); histRefresh(); toast('Devuelto al inventario');
};
