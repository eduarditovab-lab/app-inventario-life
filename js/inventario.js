'use strict';
/* inventario.js — Productos: agregar, editar, ajustar stock, marcar vendidos, eliminar */

const DEMO = [
  ['Manzana roja', '', 'Frutas y verduras', 'kg', 18.5],
  ['Cambur', '', 'Frutas y verduras', 'kg', 25],
  ['Queso blanco', '', 'Lácteos', 'kg', 6.25],
  ['Pollo entero', '', 'Carnes', 'kg', 14],
  ['Carne molida', '', 'Carnes', 'kg', 3.5],
  ['Leche líquida', '1 L', 'Lácteos', 'und', 24],
  ['Leche en polvo', '500 g', 'Lácteos', 'und', 10],
  ['Leche en polvo', '1 kg', 'Lácteos', 'und', 8],
  ['Harina de maíz', '1 kg', 'Víveres', 'und', 40],
  ['Arroz', '1 kg', 'Víveres', 'und', 30],
  ['Huevos', 'Cartón 30', 'Víveres', 'und', 12],
  ['Refresco', '2 L', 'Bebidas', 'und', 4]
];

const Inventario = {
  filtrados() {
    const q = norm(S.inv.q.trim());
    return S.db.productos.filter(p => {
      if (S.inv.f === 'bajo' && !Calc.stockBajo(p)) return false;
      if (S.inv.f === 'agotado' && !Calc.agotado(p)) return false;
      if (S.inv.f.startsWith('cat:') && p.categoria !== S.inv.f.slice(4)) return false;
      if (!q) return true;
      return norm([p.nombre, p.presentacion, p.categoria, p.sku].join(' ')).includes(q);
    }).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  },

  nPick() { return Object.keys(S.inv.pick).filter(id => Calc.prod(id)).length; },

  render(root) {
    const sel = S.inv.sel, hay = S.db.productos.length > 0;
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Inventario</h1><p class="sub" id="inv-sub"></p></div>
        <div class="head-actions">
          ${sel ? `<button class="btn" data-action="inv-sel-off">${icon('x')}<span>Cancelar</span></button>` : `
          <button class="btn" data-action="inv-pdf" ${hay ? '' : 'disabled'}>${icon('pdf')}<span>PDF</span></button>
          <button class="btn" data-action="inv-csv" ${hay ? '' : 'disabled'}>${icon('download')}<span>Excel</span></button>
          <button class="btn btn-soft" data-action="inv-sel-on" ${hay ? '' : 'disabled'}>${icon('check')}<span>Marcar vendidos</span></button>
          <button class="btn btn-primary" data-action="prod-nuevo">${icon('plus')}<span>Nuevo producto</span></button>`}
        </div>
      </div>
      ${sel ? `<div class="banner">${icon('check')}<span>Toca los productos que se vendieron y después pulsa <b>Vendidos</b>. Se descontarán del inventario.</span></div>` : ''}
      <label class="search">${icon('search')}<input type="search" id="inv-q" placeholder="Buscar producto, presentación o código…" value="${esc(S.inv.q)}" data-input="inv-q" autocomplete="off"></label>
      <div class="chips" id="inv-chips"></div>
      <div id="inv-list"></div>
      <div class="sel-bar ${sel ? 'show' : ''}" id="sel-bar"></div>`;
    this.renderChips();
    this.renderList();
    this.renderSelBar();
  },

  renderChips() {
    const ps = S.db.productos;
    const nBajo = ps.filter(Calc.stockBajo).length, nOut = ps.filter(Calc.agotado).length;
    const chip = (f, label, n) => `<button class="chip-f ${S.inv.f === f ? 'on' : ''}" data-action="inv-f" data-f="${esc(f)}">${esc(label)}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
    const cats = [...new Set(ps.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    $('#inv-chips').innerHTML = chip('todos', 'Todos', ps.length) + chip('bajo', 'Stock bajo', nBajo) + chip('agotado', 'Agotados', nOut) +
      cats.map(c => chip('cat:' + c, c, ps.filter(p => p.categoria === c).length)).join('');
  },

  renderSelBar() {
    const bar = $('#sel-bar'); if (!bar) return;
    const n = Inventario.nPick();
    bar.classList.toggle('show', S.inv.sel);
    bar.innerHTML = `<div><b>${n}</b> producto${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}</div>
      <button class="btn btn-lg" data-action="inv-vendidos" ${n ? '' : 'disabled'}>${icon('check')}Vendidos</button>`;
  },

  renderList() {
    const ps = Inventario.filtrados();
    const n = S.db.productos.length;
    const nAl = S.db.productos.filter(p => Calc.agotado(p) || Calc.stockBajo(p)).length;
    $('#inv-sub').textContent = `${n} producto${n === 1 ? '' : 's'}${nAl ? ` · ${nAl} por reponer` : ''}`;
    const box = $('#inv-list');
    if (!n) {
      box.innerHTML = `<div class="card empty">${icon('box')}<h4>Tu inventario está vacío</h4><p>Agrega tu primer producto o carga unos de ejemplo para probar el sistema.</p>
        <div class="row-actions" style="justify-content:center"><button class="btn btn-primary" data-action="prod-nuevo">${icon('plus')}Agregar producto</button><button class="btn" data-action="prod-demo">Cargar ejemplos</button></div></div>`;
      return;
    }
    if (!ps.length) { box.innerHTML = `<div class="card empty">${icon('search')}<h4>Sin resultados</h4><p>Prueba con otra búsqueda o filtro.</p></div>`; return; }
    const sel = S.inv.sel;
    box.innerHTML = `<div class="products">${ps.map(p => {
      const out = Calc.agotado(p), low = Calc.stockBajo(p);
      const st = out ? 'out' : low ? 'low' : '';
      const min = Math.max(Calc.minimo(p), 0.0001);
      const pct = Math.min(100, p.stock / (min * 3) * 100);
      const picked = sel && S.inv.pick[p.id];
      return `<article class="prod ${sel ? (out ? 'nopick' : 'selectable') : ''} ${picked ? 'picked' : ''}" ${sel && !out ? `data-action="inv-pick" data-id="${p.id}"` : ''}>
        <div class="prod-top">
          <div class="avatar" style="--h:${hueOf(p.categoria || p.nombre)}">${picked ? icon('check') : esc((p.nombre[0] || '?').toUpperCase())}</div>
          <div class="prod-name"><h4>${esc(p.nombre)}</h4>
            <div class="meta">${p.presentacion ? `<span class="chip">${esc(p.presentacion)}</span>` : ''}${p.categoria ? `<span>${esc(p.categoria)}</span>` : ''}</div></div>
          ${out ? '<span class="badge out">Agotado</span>' : low ? '<span class="badge low">Stock bajo</span>' : ''}
        </div>
        <div class="prod-mid">
          <div class="stock ${st}" style="text-align:left"><b>${fmtQty(p.stock)}</b><small>${uShort(p.unidad)} en stock</small></div>
        </div>
        <div class="meter ${st}"><i style="width:${pct}%"></i></div>
        ${sel ? '' : `<div class="prod-actions">
          <button class="btn btn-sm btn-soft" data-action="prod-stock" data-id="${p.id}">${icon('plus')}Stock</button>
          <button class="btn btn-sm" data-action="prod-editar" data-id="${p.id}">${icon('edit')}Editar</button>
          <button class="icon-btn danger" data-action="prod-borrar" data-id="${p.id}" aria-label="Eliminar">${icon('trash')}</button>
        </div>`}
      </article>`;
    }).join('')}</div>`;
  },

  formProducto(p) {
    const edit = !!p;
    p = p || { nombre: '', presentacion: '', categoria: '', unidad: 'und', stock: '', minimo: MIN_DEFAULT.und, sku: '' };
    const unitOpts = Object.keys(UNITS).map(k => `<option value="${k}" ${p.unidad === k ? 'selected' : ''}>${UNITS[k].label}</option>`).join('');
    return `<div class="form">
      <div class="field"><label>Nombre del producto *</label><input class="input" name="nombre" value="${esc(p.nombre)}" placeholder="Ej: Leche en polvo" autocomplete="off" ${edit ? '' : 'autofocus'}></div>
      <div class="field-row">
        <div class="field"><label>Presentación / tamaño</label><input class="input" name="presentacion" value="${esc(p.presentacion || '')}" placeholder="Ej: 500 g, 1 kg, 2 L"></div>
        <div class="field"><label>Categoría</label><input class="input" name="categoria" list="cat-list" value="${esc(p.categoria || '')}" placeholder="Elige o escribe una">
          <datalist id="cat-list">${S.db.categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
      <div class="field"><label>Se cuenta en</label><select class="select" name="unidad" data-input="prod-unidad" ${edit ? 'disabled' : ''}>${unitOpts}</select></div>
      <div class="field-row">
        ${edit ? '' : `<div class="field"><label id="lbl-stock">Cantidad inicial (${uShort(p.unidad)})</label><input class="input" name="stock" type="number" inputmode="decimal" step="any" min="0" value="${p.stock}" placeholder="0"></div>`}
        <div class="field"><label id="lbl-min">Avisar si baja de (${uShort(p.unidad)})</label><input class="input" name="minimo" type="number" inputmode="decimal" step="any" min="0" value="${p.minimo ?? S.db.config.stockMinimo}"></div>
      </div>
      <div class="field"><label>Código o referencia (opcional)</label><input class="input" name="sku" value="${esc(p.sku || '')}" placeholder="Código de barras, etc."></div>
      ${edit ? '<div class="hint">La unidad no se puede cambiar. Para cambiar la cantidad usa el botón «Stock».</div>'
             : '<div class="tip">Si un producto viene en varios tamaños (leche de 500 g y de 1 kg), crea cada uno por separado con su presentación.</div>'}
    </div>`;
  },

  abrirForm(p) {
    openModal({
      title: p ? 'Editar producto' : 'Nuevo producto',
      html: Inventario.formProducto(p),
      footer: `<button class="btn" data-modal-close>Cancelar</button><button class="btn btn-primary" data-submit data-action="prod-guardar" data-id="${p ? p.id : ''}">${icon('check')}Guardar</button>`
    });
  }
};

Actions['inv-f'] = t => { S.inv.f = t.dataset.f; Inventario.renderChips(); Inventario.renderList(); };
Inputs['inv-q'] = t => { S.inv.q = t.value; Inventario.renderList(); };
Actions['prod-nuevo'] = () => Inventario.abrirForm(null);
Actions['prod-editar'] = t => Inventario.abrirForm(Calc.prod(t.dataset.id));

Inputs['prod-unidad'] = t => {
  const m = t.closest('.modal'), u = t.value;
  const ls = $('#lbl-stock', m); if (ls) ls.textContent = `Cantidad inicial (${uShort(u)})`;
  $('#lbl-min', m).textContent = `Avisar si baja de (${uShort(u)})`;
  if (ls) $('[name=minimo]', m).value = MIN_DEFAULT[u];
};

Actions['prod-guardar'] = t => {
  const m = t.closest('.modal'), id = t.dataset.id, f = n => $(`[name=${n}]`, m);
  const nombre = f('nombre').value.trim(), presentacion = f('presentacion').value.trim();
  const categoria = f('categoria').value.trim(), unidad = f('unidad').value;
  const minimo = num(f('minimo').value), sku = f('sku').value.trim();
  const stock = id ? null : (f('stock') && f('stock').value !== '' ? num(f('stock').value) : 0);
  if (!nombre) return toast('Escribe el nombre del producto', 'err');
  if (!id && (isNaN(stock) || stock < 0)) return toast('Escribe una cantidad válida', 'err');
  if (unidad === 'und' && !id && !Number.isInteger(stock)) return toast('Los productos por unidad llevan cantidades enteras', 'err');
  const dup = S.db.productos.find(p => p.id !== id && norm(p.nombre) === norm(nombre) && norm(p.presentacion || '') === norm(presentacion));
  if (dup) return toast('Ya existe un producto con ese nombre y presentación', 'err');
  if (categoria && !S.db.categorias.some(c => norm(c) === norm(categoria))) S.db.categorias.push(categoria);

  if (id) {
    Object.assign(Calc.prod(id), { nombre, presentacion, categoria, minimo: isNaN(minimo) ? S.db.config.stockMinimo : minimo, sku });
    toast('Producto actualizado');
  } else {
    const p = { id: uid(), nombre, presentacion, categoria, unidad, stock: rq(stock), minimo: isNaN(minimo) ? MIN_DEFAULT[unidad] : minimo, sku, creado: new Date().toISOString() };
    S.db.productos.push(p);
    if (p.stock > 0) S.db.movimientos.push({ id: uid(), fecha: new Date().toISOString(), pid: p.id, nombre: nombreCompleto(p), tipo: 'entrada', cant: p.stock, unidad, nota: 'Cantidad inicial' });
    toast('Producto agregado');
  }
  closeTopModal(); Storage.save(); App.render();
};

Actions['prod-borrar'] = async t => {
  const p = Calc.prod(t.dataset.id); if (!p) return;
  const ok = await confirmDialog({ title: 'Eliminar producto', msg: `¿Seguro que quieres eliminar <b>${esc(nombreCompleto(p))}</b> del inventario? El historial no se borra.`, ok: 'Eliminar', danger: true });
  if (!ok) return;
  S.db.productos = S.db.productos.filter(x => x.id !== p.id);
  delete S.inv.pick[p.id];
  Storage.save(); App.render(); toast('Producto eliminado');
};

Actions['prod-demo'] = () => {
  DEMO.forEach(([nombre, presentacion, categoria, unidad, stock]) => {
    const p = { id: uid(), nombre, presentacion, categoria, unidad, stock, minimo: MIN_DEFAULT[unidad], sku: '', creado: new Date().toISOString() };
    S.db.productos.push(p);
    S.db.movimientos.push({ id: uid(), fecha: new Date().toISOString(), pid: p.id, nombre: nombreCompleto(p), tipo: 'entrada', cant: stock, unidad, nota: 'Cantidad inicial' });
  });
  Storage.save(); App.render(); toast('Productos de ejemplo cargados');
};

/* ----- Marcar productos como vendidos (descuenta del inventario) ----- */
Actions['inv-sel-on'] = () => { S.inv.sel = true; S.inv.pick = {}; Inventario.render($('#view')); };
Actions['inv-sel-off'] = () => { S.inv.sel = false; S.inv.pick = {}; Inventario.render($('#view')); };
Actions['inv-pick'] = t => {
  const id = t.dataset.id;
  if (S.inv.pick[id]) delete S.inv.pick[id]; else S.inv.pick[id] = true;
  Inventario.renderList(); Inventario.renderSelBar();
};

Actions['inv-vendidos'] = () => {
  const ps = Object.keys(S.inv.pick).map(Calc.prod).filter(Boolean)
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  if (!ps.length) return toast('Elige al menos un producto', 'err');
  openModal({
    title: 'Productos vendidos',
    html: `<div class="form">
      <p class="muted-p">Escribe cuánto se vendió de cada producto. Se descontará del inventario.</p>
      ${ps.map((p, i) => `<div class="sell-row" data-pid="${p.id}">
        <div class="sr-name"><b>${esc(nombreCompleto(p))}</b><small>Hay ${fmtQty(p.stock)} ${uShort(p.unidad)}</small></div>
        <input class="input" name="cant" type="number" inputmode="decimal" step="any" min="0" value="${p.unidad === 'und' ? 1 : ''}" placeholder="0" ${i === 0 ? 'autofocus' : ''}>
        <select class="select" name="ud">${compatibleUnits(p.unidad).map(u => `<option value="${u}" ${u === p.unidad ? 'selected' : ''}>${UNITS[u].short}</option>`).join('')}</select>
      </div>`).join('')}
    </div>`,
    footer: `<button class="btn" data-modal-close>Cancelar</button><button class="btn btn-primary" data-submit data-action="inv-vendidos-ok">${icon('check')}Descontar del inventario</button>`
  });
};

Actions['inv-vendidos-ok'] = t => {
  const m = t.closest('.modal'), lista = [];
  for (const row of $$('.sell-row', m)) {
    const p = Calc.prod(row.dataset.pid); if (!p) continue;
    const c = num($('[name=cant]', row).value), ud = $('[name=ud]', row).value;
    if (isNaN(c) || c <= 0) return toast(`Escribe la cantidad vendida de ${nombreCompleto(p)}`, 'err');
    const cant = convert(c, ud, p.unidad);
    if (p.unidad === 'und' && !Number.isInteger(cant)) return toast(`${nombreCompleto(p)} se cuenta en unidades enteras`, 'err');
    if (cant > p.stock + 1e-9) return toast(`No hay suficiente ${nombreCompleto(p)}. Hay ${fmtQty(p.stock)} ${uShort(p.unidad)}`, 'err');
    lista.push({ p, cant });
  }
  if (!lista.length) return;
  const fecha = new Date().toISOString(), lote = uid();
  lista.forEach(({ p, cant }) => {
    p.stock = rq(p.stock - cant);
    S.db.movimientos.push({ id: uid(), fecha, pid: p.id, nombre: nombreCompleto(p), tipo: 'venta', cant: -cant, unidad: p.unidad, nota: '', lote });
  });
  S.inv.sel = false; S.inv.pick = {};
  closeTopModal(); Storage.save(); App.render();
  toast(`${lista.length} producto${lista.length === 1 ? '' : 's'} descontado${lista.length === 1 ? '' : 's'} del inventario`);
  App.recordarRespaldo();
};

/* ----- Ajuste de stock ----- */
Actions['prod-stock'] = t => {
  const p = Calc.prod(t.dataset.id); if (!p) return;
  const units = compatibleUnits(p.unidad);
  openModal({
    title: 'Ajustar stock',
    html: `<div class="form">
      <div><b>${esc(nombreCompleto(p))}</b><div class="muted">Stock actual: ${fmtQty(p.stock)} ${uShort(p.unidad)}</div></div>
      <div class="field"><label>¿Qué quieres hacer?</label>
        <select class="select" name="tipo" data-input="stk-prev">
          <option value="entrada">Agregar mercancía (entrada)</option>
          <option value="salida">Quitar mercancía (merma, daño, consumo)</option>
          <option value="fijar">Corregir el total (conteo físico)</option>
        </select></div>
      <div class="field-row">
        <div class="field"><label>Cantidad</label><input class="input" name="cant" type="number" inputmode="decimal" step="any" min="0" placeholder="0" data-input="stk-prev" autofocus></div>
        <div class="field"><label>Unidad</label><select class="select" name="ud" data-input="stk-prev">${units.map(u => `<option value="${u}" ${u === p.unidad ? 'selected' : ''}>${UNITS[u].short}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Nota (opcional)</label><input class="input" name="nota" placeholder="Ej: compra al proveedor" autocomplete="off"></div>
      <div class="preview-box"><span class="muted">Quedará en</span><b id="stk-new">${fmtQty(p.stock)} ${uShort(p.unidad)}</b></div>
    </div>`,
    footer: `<button class="btn" data-modal-close>Cancelar</button><button class="btn btn-primary" data-submit data-action="stk-guardar" data-id="${p.id}">${icon('check')}Guardar</button>`
  });
};
function calcStock(m, p) {
  const tipo = $('[name=tipo]', m).value, ud = $('[name=ud]', m).value;
  const c = num($('[name=cant]', m).value);
  if (isNaN(c)) return { nuevo: p.stock, delta: 0, valid: false };
  const q = convert(c, ud, p.unidad);
  const nuevo = tipo === 'entrada' ? rq(p.stock + q) : tipo === 'salida' ? rq(p.stock - q) : q;
  return { nuevo, delta: rq(nuevo - p.stock), valid: true, tipo };
}
Inputs['stk-prev'] = t => {
  const m = t.closest('.modal'), p = Calc.prod($('[data-action=stk-guardar]', m).dataset.id);
  const r = calcStock(m, p);
  const el = $('#stk-new', m);
  el.textContent = `${fmtQty(r.nuevo)} ${uShort(p.unidad)}`;
  el.style.color = r.nuevo < 0 ? 'var(--danger)' : '';
};
Actions['stk-guardar'] = t => {
  const m = t.closest('.modal'), p = Calc.prod(t.dataset.id);
  const r = calcStock(m, p);
  if (!r.valid || Number($('[name=cant]', m).value) < 0) return toast('Escribe una cantidad válida', 'err');
  if (r.nuevo < 0) return toast('No puedes quitar más de lo que hay en stock', 'err');
  if (p.unidad === 'und' && !Number.isInteger(r.nuevo)) return toast('Este producto se maneja en unidades enteras', 'err');
  if (r.delta === 0) return toast('No hay cambios que guardar', 'err');
  p.stock = r.nuevo;
  S.db.movimientos.push({ id: uid(), fecha: new Date().toISOString(), pid: p.id, nombre: nombreCompleto(p), tipo: r.tipo === 'fijar' ? 'ajuste' : r.tipo, cant: r.delta, unidad: p.unidad, nota: $('[name=nota]', m).value.trim() });
  closeTopModal(); Storage.save(); App.render(); toast('Stock actualizado');
};
