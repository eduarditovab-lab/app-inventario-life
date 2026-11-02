'use strict';
/* =====================================================================
   storage.js — Persistencia de la base de datos.

   MODO ARCHIVO (Chrome / Edge en PC): el sistema abre un archivo .json
   real del equipo y lo sobrescribe después de cada cambio. No depende
   del caché del navegador.

   MODO COMPATIBLE (teléfonos, Safari, Firefox): los navegadores no dejan
   sobrescribir un archivo solos, así que se guarda una copia interna y el
   usuario guarda el archivo .json con el botón "Guardar respaldo"
   (queda en Descargas / Documentos) y lo vuelve a abrir cuando quiera.
   ===================================================================== */

function defaultDB() {
  return {
    app: 'bodega-inventario',
    version: 1,
    creado: new Date().toISOString(),
    config: {
      negocio: 'Mi Bodega', logo: '',
      color: '#0f766e', tema: 'auto',
      stockMinimo: 5,
      ultimoRespaldo: ''
    },
    categorias: ['Frutas y verduras', 'Carnes', 'Lácteos', 'Víveres', 'Bebidas', 'Limpieza', 'Otros'],
    productos: [],
    movimientos: []
  };
}

function normalizeDB(d) {
  const base = defaultDB();
  if (!d || typeof d !== 'object') return base;
  const out = { ...base, ...d };
  out.config = { ...base.config, ...(d.config || {}) };
  ['categorias', 'productos', 'movimientos'].forEach(k => { if (!Array.isArray(out[k])) out[k] = base[k]; });
  return out;
}

const Storage = (() => {
  const STORE = 'kv';
  const FILE_TYPES = [{ description: 'Datos del inventario (.json)', accept: { 'application/json': ['.json'] } }];
  const supportsFile = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
  let handle = null;
  let mode = supportsFile ? 'file' : 'compat';
  let status = 'idle';            // idle | saving | saved | error
  let timer = null, writing = false, pending = false;
  const listeners = [];

  /* --- IndexedDB mínima (guarda el "puntero" al archivo y una copia interna) --- */
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('bodega-inventario', 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  async function kvGet(k) {
    try {
      const d = await idb();
      return await new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    } catch (e) { return undefined; }
  }
  async function kvSet(k, v) {
    try {
      const d = await idb();
      await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) { /* sin IndexedDB: se ignora */ }
  }

  const setStatus = s => { status = s; listeners.forEach(f => f(s)); };

  async function readHandle(h) {
    const file = await h.getFile();
    const text = await file.text();
    if (!text.trim()) return defaultDB();
    return normalizeDB(JSON.parse(text));
  }
  async function writeHandle() {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(S.db, null, 2));
    await w.close();
  }

  async function flush() {
    if (writing) { pending = true; return; }
    writing = true;
    try {
      await kvSet('db', S.db);                      // copia interna de seguridad
      if (handle && mode === 'file') await writeHandle();
      setStatus('saved');
    } catch (e) {
      console.error('Error al guardar', e);
      setStatus('error');
      toast('No se pudo guardar en el archivo. Revisa los permisos.', 'err');
    }
    writing = false;
    if (pending) { pending = false; flush(); }
  }

  return {
    get mode() { return mode; },
    get supportsFile() { return supportsFile; },
    get fileName() { return handle ? handle.name : ''; },
    get hasHandle() { return !!handle; },
    get status() { return status; },
    onStatus(f) { listeners.push(f); },

    /** Intenta arrancar sin interacción. Devuelve {db} o {needsAction, ...} */
    async start() {
      if (supportsFile) {
        const h = await kvGet('handle');
        if (h) {
          handle = h;
          try {
            const p = await h.queryPermission({ mode: 'readwrite' });
            if (p === 'granted') return { db: await readHandle(h) };
          } catch (e) { handle = null; }
          if (handle) return { needsAction: true, fileName: handle.name };
        }
        return { needsAction: true };
      }
      const local = await kvGet('db');
      if (local) return { db: normalizeDB(local) };
      return { needsAction: true, first: true };
    },

    async resume() {            // pedir permiso otra vez sobre el archivo recordado
      const p = await handle.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') throw new Error('permiso denegado');
      return readHandle(handle);
    },
    async openFile() {
      const [h] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
      const p = await h.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') throw new Error('permiso denegado');
      handle = h; mode = 'file';
      await kvSet('handle', h);
      return readHandle(h);
    },
    async createFile() {
      const h = await window.showSaveFilePicker({ suggestedName: 'inventario.json', types: FILE_TYPES });
      handle = h; mode = 'file';
      await kvSet('handle', h);
      const db = defaultDB();
      S.db = db;
      await writeHandle();
      return db;
    },
    parseText(text) { return normalizeDB(JSON.parse(text)); },
    async useLocalOnly() {          // trabajar sin archivo (solo copia interna del navegador)
      mode = 'compat'; handle = null;
      const local = await kvGet('db');
      return local ? normalizeDB(local) : defaultDB();
    },

    save() { setStatus('saving'); clearTimeout(timer); timer = setTimeout(flush, 250); },
    async saveNow() { clearTimeout(timer); await flush(); },

    exportBackup() {
      S.db.config.ultimoRespaldo = new Date().toISOString();
      const blob = new Blob([JSON.stringify(S.db, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `inventario_${toInputDate(new Date())}.json`);
      this.save();
      toast('Respaldo guardado en Descargas');
    }
  };
})();

window.addEventListener('beforeunload', e => {
  if (Storage.status === 'saving') { e.preventDefault(); e.returnValue = ''; }
});
