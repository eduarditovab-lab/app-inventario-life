'use strict';
/* app.js — Arranque, navegación, tema y pantalla de bienvenida */

const VIEWS = {
  inicio: { label: 'Inicio', icon: 'home', mod: () => Inicio },
  inventario: { label: 'Inventario', icon: 'box', mod: () => Inventario },
  historial: { label: 'Historial', icon: 'chart', mod: () => Historial },
  ajustes: { label: 'Ajustes', icon: 'settings', mod: () => Ajustes }
};

const App = {
  _recordado: false,

  /* ---------- Tema y color ---------- */
  applyTheme() {
    const c = S.db ? S.db.config : { color: '#0f766e', tema: 'auto' };
    const root = document.documentElement;
    const [r, g, b] = hex01(c.color || '#0f766e');
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    root.style.setProperty('--brand', c.color || '#0f766e');
    root.style.setProperty('--on-brand', lum > 0.6 ? '#10141a' : '#ffffff');
    const dark = c.tema === 'oscuro' || (c.tema !== 'claro' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('meta[name=theme-color]'); if (meta) meta.content = c.color || '#0f766e';
  },

  /* ---------- Estructura principal ---------- */
  launch() {
    App.applyTheme();
    $('#root').innerHTML = `
      <div class="app">
        <aside class="sidebar">
          <div class="brand brand-slot"></div>
          <nav class="nav">${Object.entries(VIEWS).map(([k, v]) => `<a href="#/${k}" class="nav-item" data-view="${k}">${icon(v.icon)}<span>${v.label}</span></a>`).join('')}</nav>
          <div class="side-foot" id="side-foot"></div>
        </aside>
        <div class="main-col">
          <header class="topbar">
            <div class="brand brand-slot"></div>
            <div class="spacer"></div>
            <button class="chip-btn" id="chip-save" data-action="save-chip"></button>
          </header>
          <main id="view" class="view"></main>
        </div>
        <nav class="bottom-nav">${Object.entries(VIEWS).map(([k, v]) => `<a href="#/${k}" class="nav-item" data-view="${k}">${icon(v.icon)}<span>${v.label}</span></a>`).join('')}</nav>
      </div>`;
    App.refreshChrome();
    const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
    App.go(VIEWS[v] ? v : 'inicio');
  },

  go(v) {
    S.view = v;
    if (v !== 'inventario') { S.inv.sel = false; S.inv.pick = {}; }
    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === v));
    window.scrollTo(0, 0);
    App.render();
  },
  navigate(v) { if (location.hash === '#/' + v) App.go(v); else location.hash = '#/' + v; },
  render() {
    const root = $('#view'); if (!root) return;
    VIEWS[S.view].mod().render(root);
  },

  brandHTML() {
    const c = S.db.config;
    return `<div class="brand-mark">${c.logo ? `<img src="${c.logo}" alt="">` : esc((c.negocio[0] || 'B').toUpperCase())}</div>
      <div class="brand-txt"><strong>${esc(c.negocio)}</strong><small>Control de inventario</small></div>`;
  },

  saveChipInfo() {
    const c = S.db.config, st = Storage.status;
    if (Storage.mode === 'file' && Storage.hasHandle) {
      if (st === 'saving') return { cls: '', ic: 'refresh', txt: 'Guardando…' };
      if (st === 'error') return { cls: 'err', ic: 'alert', txt: 'Error al guardar' };
      return { cls: 'ok', ic: 'check', txt: 'Guardado' };
    }
    const hayDatos = S.db.productos.length;
    const dias = c.ultimoRespaldo ? (Date.now() - new Date(c.ultimoRespaldo)) / 864e5 : Infinity;
    return { cls: hayDatos && dias >= 2 ? 'warn' : '', ic: 'save', txt: c.ultimoRespaldo ? 'Respaldo ' + tiempoRelativo(c.ultimoRespaldo) : 'Guardar respaldo' };
  },

  /** Nombre e ícono de la pestaña / acceso directo: usan el nombre y el logo del negocio */
  setIdentity() {
    const c = S.db.config;
    document.title = c.negocio || 'Inventario de Bodega';
    ['icon', 'apple-touch-icon'].forEach(rel => {
      let l = document.querySelector(`link[rel="${rel}"]`);
      if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
      if (l.dataset.base === undefined) l.dataset.base = l.getAttribute('href') || '';
      if (c.logo) l.href = c.logo; else if (l.dataset.base) l.setAttribute('href', l.dataset.base); else l.removeAttribute('href');
    });
  },

  refreshChrome() {
    if (!$('#chip-save')) return;
    App.setIdentity();
    const c = S.db.config;
    $$('.brand-slot').forEach(b => b.innerHTML = App.brandHTML());
    const s = App.saveChipInfo(), chip = $('#chip-save');
    chip.className = 'chip-btn ' + s.cls;
    chip.innerHTML = `${icon(s.ic)}<span class="hide-sm">${esc(s.txt)}</span>`;
    chip.title = s.txt;
    const foot = $('#side-foot');
    if (foot) foot.textContent = Storage.mode === 'file' && Storage.hasHandle ? 'Archivo: ' + Storage.fileName : 'Modo compatible: guarda respaldos';
  },

  recordarRespaldo() {
    if (App._recordado || (Storage.mode === 'file' && Storage.hasHandle)) return;
    const u = S.db.config.ultimoRespaldo;
    if (!u || Date.now() - new Date(u) > 864e5) {
      App._recordado = true;
      setTimeout(() => toast('Recuerda guardar un respaldo (chip de arriba o Ajustes)'), 1200);
    }
  },

  /* ---------- Pantalla de bienvenida ---------- */
  welcome(info) {
    const modoArchivo = Storage.supportsFile;
    let botones;
    if (modoArchivo) {
      botones = `
        ${info.fileName ? `<button class="btn btn-primary btn-lg btn-block" data-action="w-continue">${icon('folder')}Continuar con «${esc(info.fileName)}»</button>` : ''}
        <button class="btn ${info.fileName ? '' : 'btn-primary'} btn-lg btn-block" data-action="w-create">${icon('plus')}Crear archivo de datos nuevo</button>
        <button class="btn btn-lg btn-block" data-action="w-open">${icon('folder')}Abrir un archivo existente</button>
        <button class="link" data-action="w-local">Usar sin archivo (solo en este navegador)</button>`;
    } else {
      botones = `
        <button class="btn btn-primary btn-lg btn-block" data-action="w-local">${icon('check')}Empezar</button>
        <button class="btn btn-lg btn-block" data-action="w-import">${icon('folder')}Abrir un respaldo (.json)</button>`;
    }
    $('#root').innerHTML = `
      <div class="welcome"><div class="card welcome-card">
        <div class="brand-mark">B</div>
        <h1>Inventario de Bodega</h1>
        <p>Controla lo que entra y lo que sale de tu negocio.${modoArchivo
          ? ' Tus datos viven en un <b>archivo dentro de tu equipo</b>: no dependen del navegador ni de internet.'
          : ' Funciona sin internet. Guarda respaldos con frecuencia para no perder tu información.'}</p>
        <div class="stack">${botones}</div>
        <input type="file" id="w-file" accept=".json,application/json" hidden data-change="w-file">
        ${modoArchivo ? '' : '<p class="small muted">En este navegador el archivo no se puede actualizar solo. Para guardado automático en archivo usa Chrome o Edge en una computadora.</p>'}
      </div></div>`;
  },

  async entrar(db) {
    S.db = db;
    Storage.save();
    App.launch();
  }
};

/* ----- Acciones de la bienvenida ----- */
const abortado = e => e && (e.name === 'AbortError');
Actions['w-continue'] = async () => {
  try { App.entrar(await Storage.resume()); } catch (e) { if (!abortado(e)) toast('No se pudo abrir el archivo. Elige uno manualmente.', 'err'); }
};
Actions['w-open'] = async () => {
  try { App.entrar(await Storage.openFile()); } catch (e) { if (!abortado(e)) toast('No se pudo abrir el archivo', 'err'); }
};
Actions['w-create'] = async () => {
  try { App.entrar(await Storage.createFile()); } catch (e) { if (!abortado(e)) toast('No se pudo crear el archivo', 'err'); }
};
Actions['w-local'] = async () => App.entrar(await Storage.useLocalOnly());
Actions['w-import'] = () => $('#w-file').click();
Changes['w-file'] = async t => {
  const f = t.files[0]; if (!f) return;
  try { App.entrar(Storage.parseText(await f.text())); } catch (e) { toast('El archivo no es válido', 'err'); }
  t.value = '';
};

Actions['save-chip'] = () => {
  if (Storage.mode === 'file' && Storage.hasHandle) toast('Guardado automático en: ' + Storage.fileName);
  else Storage.exportBackup();
  setTimeout(() => App.refreshChrome(), 300);
};

/* ----- Instalación como app (PWA) ----- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  if (S.db && S.view === 'ajustes') Ajustes.render($('#view'));
});
window.addEventListener('appinstalled', () => { installEvt = null; toast('App instalada en tu pantalla de inicio'); if (S.db && S.view === 'ajustes') Ajustes.render($('#view')); });
Actions['pwa-install'] = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => {});
  installEvt = null;
  if (S.view === 'ajustes') Ajustes.render($('#view'));
};
const esAppInstalada = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Pide al navegador que NO borre los datos cuando falte espacio
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ----- Arranque ----- */
window.addEventListener('hashchange', () => {
  if (!S.db) return;
  const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (VIEWS[v]) App.go(v);
});
Storage.onStatus(() => { if (S.db) App.refreshChrome(); });
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => App.applyTheme());

(async function boot() {
  App.applyTheme();
  let r;
  try { r = await Storage.start(); } catch (e) { r = { needsAction: true }; }
  if (r.db) { S.db = r.db; App.launch(); } else App.welcome(r);
})();
