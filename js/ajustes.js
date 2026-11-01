'use strict';
/* ajustes.js — Personalización del negocio, categorías, inventario y datos */

const PRESETS = [
  ['#0f766e', 'Verde azulado'], ['#2563eb', 'Azul'], ['#4f46e5', 'Índigo'], ['#7c3aed', 'Morado'],
  ['#db2777', 'Rosa'], ['#dc2626', 'Rojo'], ['#ea580c', 'Naranja'], ['#ca8a04', 'Mostaza'],
  ['#16a34a', 'Verde'], ['#334155', 'Grafito']
];

function tiempoRelativo(iso) {
  if (!iso) return 'nunca';
  const min = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const Ajustes = {
  render(root) {
    const c = S.db.config;
    const modoArchivo = Storage.mode === 'file' && Storage.hasHandle;
    root.innerHTML = `
      <div class="page-head"><div><h1>Ajustes</h1><p class="sub">Personaliza el sistema a tu negocio</p></div></div>
      <div class="grid cols-2" style="align-items:start">
        <div class="stack">

          <div class="card"><div class="card-head"><h3>Tu negocio</h3></div><div class="stack">
            <div class="logo-edit">
              <div class="brand-mark" id="aj-logo">${c.logo ? `<img src="${c.logo}" alt="Logo">` : esc((c.negocio[0] || 'B').toUpperCase())}</div>
              <div class="row-actions">
                <label class="btn btn-sm">${icon('upload')}Subir logo<input type="file" accept="image/*" hidden data-change="cfg-logo"></label>
                ${c.logo ? `<button class="btn btn-sm btn-ghost" data-action="cfg-logo-quitar">Quitar</button>` : ''}
              </div>
            </div>
            <div class="field"><label>Nombre de la bodega</label><input class="input" value="${esc(c.negocio)}" data-input="cfg-negocio" autocomplete="off"></div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Apariencia</h3></div><div class="stack">
            <div class="field"><label>Color principal</label>
              <div class="swatches">
                ${PRESETS.map(([hx, n]) => `<button class="swatch ${c.color.toLowerCase() === hx ? 'on' : ''}" style="background:${hx}" title="${n}" data-action="cfg-preset" data-c="${hx}" aria-label="${n}"></button>`).join('')}
                <input type="color" class="color-custom" value="${c.color}" data-input="cfg-color" title="Elegir otro color">
              </div></div>
            <div class="field"><label>Tema</label>
              <div class="seg full">
                ${[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([k, l]) => `<button class="${c.tema === k ? 'on' : ''}" data-action="cfg-tema" data-t="${k}">${l}</button>`).join('')}
              </div></div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Categorías</h3></div><div class="stack">
            <div class="cat-list">${S.db.categorias.map((cat, i) => `<span class="cat-pill">${esc(cat)}<button data-action="cat-del" data-i="${i}" aria-label="Quitar">${icon('x')}</button></span>`).join('')}</div>
            <div class="field-row" style="grid-template-columns:1fr auto;align-items:end">
              <div class="field"><label>Nueva categoría</label><input class="input" id="cat-new" placeholder="Ej: Charcutería" data-submit-cat autocomplete="off"></div>
              <button class="btn btn-soft" data-action="cat-add">${icon('plus')}Agregar</button>
            </div>
          </div></div>
        </div>

        <div class="stack">
          <div class="card"><div class="card-head"><h3>Inventario</h3></div><div class="stack">
            <div class="field"><label>Avisar de stock bajo cuando queden menos de</label><input class="input" type="number" inputmode="decimal" step="any" min="0" value="${c.stockMinimo}" data-input="cfg-num" data-k="stockMinimo"></div>
            <div class="hint">Es el valor general. Cada producto también puede tener su propio mínimo al editarlo.</div>
          </div></div>

          ${esAppInstalada() ? '' : `<div class="card"><div class="card-head"><h3>Instalar en el teléfono</h3></div><div class="stack">
            <p class="muted-p">Instálalo para tenerlo como una app en la pantalla de inicio, con su ícono, a pantalla completa y funcionando sin internet.</p>
            ${installEvt ? `<button class="btn btn-primary" data-action="pwa-install">${icon('download')}Instalar app</button>` : `<div class="hint">
              <b>Android (Chrome):</b> menú ⋮ → «Instalar app» o «Agregar a la pantalla de inicio».<br>
              <b>iPhone (Safari):</b> botón Compartir → «Agregar a inicio».<br>
              ${window.isSecureContext ? '' : 'Para que aparezca la opción de instalar, el sistema debe abrirse desde una dirección https (publicada) y no desde un archivo o una red local.'}</div>`}
          </div></div>`}

          <div class="card"><div class="card-head"><h3>Tus datos</h3></div><div class="stack">
            <div>
              <div class="kv"><span>Dónde se guardan</span><b>${modoArchivo ? 'Archivo en tu equipo' : 'Este dispositivo'}</b></div>
              ${modoArchivo ? `<div class="kv"><span>Archivo</span><b>${esc(Storage.fileName)}</b></div>` : `<div class="kv"><span>Último respaldo</span><b>${tiempoRelativo(c.ultimoRespaldo)}</b></div>`}
              <div class="kv"><span>Productos registrados</span><b>${S.db.productos.length}</b></div>
            </div>
            <p class="muted-p">${modoArchivo
              ? 'Cada cambio se guarda solo dentro de ese archivo. Puedes copiarlo a un pendrive cuando quieras.'
              : 'En este navegador el archivo no se puede actualizar solo. Pulsa «Guardar respaldo» con frecuencia: se guarda un archivo .json en Descargas/Documentos que puedes volver a abrir.'}</p>
            <div class="row-actions">
              <button class="btn btn-primary" data-action="cfg-respaldo">${icon('save')}Guardar respaldo</button>
              <button class="btn" data-action="cfg-importar">${icon('folder')}Abrir archivo…</button>
              ${Storage.supportsFile ? `<button class="btn" data-action="cfg-crear-archivo">Crear archivo nuevo</button>` : ''}
            </div>
            <input type="file" id="aj-import" accept=".json,application/json" hidden data-change="cfg-import-file">
            <div><button class="btn btn-sm btn-ghost" style="color:var(--danger)" data-action="cfg-borrar">${icon('trash')}Borrar todos los datos</button></div>
          </div></div>
        </div>
      </div>`;
  }
};

/* ----- Texto / números / interruptores genéricos ----- */
Inputs['cfg-text'] = t => { S.db.config[t.dataset.k] = t.value; Storage.save(); App.refreshChrome(); };
Inputs['cfg-num'] = t => { const v = num(t.value); S.db.config[t.dataset.k] = isNaN(v) || v < 0 ? 0 : v; Storage.save(); };
Changes['cfg-bool'] = t => { S.db.config[t.dataset.k] = t.checked; Storage.save(); };
Inputs['cfg-negocio'] = t => {
  S.db.config.negocio = t.value.trim() || 'Mi Bodega';
  Storage.save(); App.refreshChrome();
  const l = $('#aj-logo'); if (l && !S.db.config.logo) l.textContent = (S.db.config.negocio[0] || 'B').toUpperCase();
};

/* ----- Color y tema ----- */
Actions['cfg-preset'] = t => { S.db.config.color = t.dataset.c; Storage.save(); App.applyTheme(); Ajustes.render($('#view')); };
Inputs['cfg-color'] = t => { S.db.config.color = t.value; Storage.save(); App.applyTheme(); };
Actions['cfg-tema'] = t => { S.db.config.tema = t.dataset.t; Storage.save(); App.applyTheme(); Ajustes.render($('#view')); };

/* ----- Logo ----- */
Changes['cfg-logo'] = t => {
  const file = t.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      S.db.config.logo = cv.toDataURL('image/jpeg', 0.88);
      Storage.save(); App.refreshChrome(); Ajustes.render($('#view')); toast('Logo actualizado');
    };
    img.onerror = () => toast('No se pudo leer la imagen', 'err');
    img.src = rd.result;
  };
  rd.readAsDataURL(file); t.value = '';
};
Actions['cfg-logo-quitar'] = () => { S.db.config.logo = ''; Storage.save(); App.refreshChrome(); Ajustes.render($('#view')); };

/* ----- Categorías ----- */
Actions['cat-add'] = () => {
  const i = $('#cat-new'), v = i.value.trim();
  if (!v) return;
  if (S.db.categorias.some(c => norm(c) === norm(v))) return toast('Esa categoría ya existe', 'err');
  S.db.categorias.push(v); Storage.save(); Ajustes.render($('#view'));
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-submit-cat]')) { e.preventDefault(); Actions['cat-add'](); } });
Actions['cat-del'] = t => { S.db.categorias.splice(+t.dataset.i, 1); Storage.save(); Ajustes.render($('#view')); };

/* ----- Datos: respaldo, importar, crear archivo, borrar ----- */
Actions['cfg-respaldo'] = () => { Storage.exportBackup(); setTimeout(() => App.refreshChrome(), 300); };

async function cargarDB(db, aviso) {
  S.db = db; App.applyTheme();
  await Storage.saveNow();
  App.render(); App.refreshChrome();
  toast(aviso);
}
Actions['cfg-importar'] = async () => {
  if (Storage.supportsFile) {
    if (!await confirmDialog({ title: 'Abrir otro archivo', msg: 'Se cargarán los datos del archivo que elijas y el sistema empezará a guardar en él.', ok: 'Elegir archivo' })) return;
    try { await cargarDB(await Storage.openFile(), 'Archivo abierto correctamente'); }
    catch (e) { if (e.name !== 'AbortError') toast('No se pudo abrir el archivo', 'err'); }
  } else $('#aj-import').click();
};
Changes['cfg-import-file'] = async t => {
  const f = t.files[0]; if (!f) return;
  try {
    const db = Storage.parseText(await f.text());
    if (!await confirmDialog({ title: 'Reemplazar datos', msg: `Se reemplazarán los datos actuales por los del archivo <b>${esc(f.name)}</b> (${db.productos.length} productos).`, ok: 'Reemplazar', danger: true })) { t.value = ''; return; }
    await cargarDB(db, 'Datos cargados correctamente');
  } catch (e) { toast('El archivo no es válido', 'err'); }
  t.value = '';
};
Actions['cfg-crear-archivo'] = async () => {
  try {
    const actual = S.db;
    const db = await Storage.createFile();
    Object.assign(db, { config: { ...actual.config }, categorias: [...actual.categorias], productos: actual.productos, movimientos: actual.movimientos });
    S.db = db; await Storage.saveNow(); App.render(); App.refreshChrome();
    toast('Archivo creado: ' + Storage.fileName);
  } catch (e) { if (e.name !== 'AbortError') toast('No se pudo crear el archivo', 'err'); }
};
Actions['cfg-borrar'] = () => {
  openModal({
    title: 'Borrar todos los datos',
    html: `<div class="form"><p class="muted-p">Se borrarán <b>todos los productos y el historial</b>. Esta acción no se puede deshacer. Antes de seguir, guarda un respaldo.</p>
      <div class="field"><label>Escribe BORRAR para confirmar</label><input class="input" id="borrar-conf" autocomplete="off" autofocus></div></div>`,
    footer: `<button class="btn" data-modal-close>Cancelar</button><button class="btn btn-danger" data-submit data-action="cfg-borrar-ok">Borrar todo</button>`
  });
};
Actions['cfg-borrar-ok'] = async () => {
  if ($('#borrar-conf').value.trim().toUpperCase() !== 'BORRAR') return toast('Escribe BORRAR para confirmar', 'err');
  const c = S.db.config, nuevo = defaultDB();
  nuevo.config = { ...c };
  S.db = nuevo; S.inv.sel = false; S.inv.pick = {};
  await Storage.saveNow(); closeTopModal(); App.render(); toast('Datos borrados');
};
