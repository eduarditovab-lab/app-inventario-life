'use strict';
/* inicio.js — Panel de resumen */

const Inicio = {
  render(root) {
    const db = S.db, cfg = db.config;
    const hoy = rangoPeriodo('dia', new Date());
    const vendHoy = Calc.vendidos(hoy.from, hoy.to);
    const entrHoy = Calc.movs(hoy.from, hoy.to, 'entrada');
    const alertas = db.productos.filter(p => Calc.agotado(p) || Calc.stockBajo(p)).sort((a, b) => a.stock - b.stock);
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    // Últimos 7 días: productos vendidos por día
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(hoy.from, -i);
      const n = Calc.vendidos(d, addDays(d, 1)).length;
      dias.push({ label: DIA3[d.getDay()], value: n, hl: i === 0, title: `${fmtDate(d)}: ${n} vendidos` });
    }
    const semTotal = dias.reduce((s, d) => s + d.value, 0);
    const recientes = [...db.movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6);

    root.innerHTML = `
      <div class="page-head">
        <div><h1>${saludo}</h1><p class="sub">${cap(DIAS[new Date().getDay()])}, ${new Date().getDate()} de ${MESES[new Date().getMonth()]} de ${new Date().getFullYear()} · ${esc(cfg.negocio)}</p></div>
        <div class="head-actions"><button class="btn btn-primary" data-action="ir-vendidos">${icon('check')}<span>Marcar vendidos</span></button></div>
      </div>

      <div class="grid cols-4">
        <div class="card stat accent"><div class="lab">${icon('check')}Vendidos hoy</div><div class="val">${vendHoy.length}</div><div class="sec">${vendHoy.length ? 'productos descontados' : 'Aún no hay ventas hoy'}</div></div>
        <div class="card stat"><div class="lab">${icon('plus')}Entradas hoy</div><div class="val">${entrHoy.length}</div><div class="sec">${entrHoy.length ? 'mercancía que llegó' : 'Sin entradas hoy'}</div></div>
        <div class="card stat"><div class="lab">${icon('box')}En inventario</div><div class="val">${db.productos.length}</div><div class="sec">productos registrados</div></div>
        <div class="card stat"><div class="lab">${icon('alert')}Por reponer</div><div class="val" style="${alertas.length ? 'color:var(--warn)' : ''}">${alertas.length}</div><div class="sec">${alertas.length ? 'Productos con poco stock' : 'Todo en orden'}</div></div>
      </div>

      <div class="grid main-side" style="margin-top:16px">
        <div>
          <div class="card">
            <div class="card-head"><h3>Vendidos en los últimos 7 días</h3><span class="muted">${semTotal}</span></div>
            ${semTotal > 0 ? barChart(dias) : `<div class="empty" style="padding:26px"><p>Cuando marques productos como vendidos verás aquí cómo van tus días.</p></div>`}
          </div>
          <div class="card">
            <div class="card-head"><h3>Últimos movimientos</h3><button class="link" data-action="nav" data-v="historial">Ver historial</button></div>
            ${recientes.length ? recientes.map(m => {
              const [lab, cls] = tipoMov(m);
              return `<div class="mov"><div class="m-main"><b>${esc(m.nombre)}</b><small>${fmtDateTime(new Date(m.fecha))}${notaMov(m) ? ' · ' + esc(notaMov(m)) : ''}</small></div>
                <span class="badge ${cls}">${lab}</span>
                <div class="m-q ${m.cant >= 0 ? 'pos' : 'neg'}">${m.cant >= 0 ? '+' : ''}${fmtQty(m.cant)} ${uShort(m.unidad)}</div></div>`;
            }).join('') : `<p class="muted">Todavía no hay movimientos. Agrega tus productos en el Inventario.</p>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Hay que reponer</h3>${alertas.length ? `<span class="badge low">${alertas.length}</span>` : ''}</div>
          ${alertas.length ? alertas.slice(0, 8).map(p => `
            <div class="mov">
              <div class="m-main"><b>${esc(nombreCompleto(p))}</b><small>${Calc.agotado(p) ? 'Agotado' : 'Quedan ' + fmtQty(p.stock) + ' ' + uShort(p.unidad)}</small></div>
              <button class="btn btn-sm btn-soft" data-action="prod-stock" data-id="${p.id}">${icon('plus')}Stock</button>
            </div>`).join('') : `<p class="muted">Ningún producto está por debajo del mínimo.</p>`}
          ${alertas.length > 8 ? `<button class="link" style="margin-top:10px" data-action="inv-filtro" data-f="bajo">Ver los ${alertas.length} productos</button>` : ''}
        </div>
      </div>`;
  }
};

Actions['nav'] = t => App.navigate(t.dataset.v);
Actions['inv-filtro'] = t => { S.inv.f = t.dataset.f; App.navigate('inventario'); };
Actions['ir-vendidos'] = () => { S.inv.sel = true; S.inv.pick = {}; S.inv.f = 'todos'; S.inv.q = ''; App.navigate('inventario'); };
