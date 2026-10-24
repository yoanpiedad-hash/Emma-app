'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · TRAER UN LIVE DE LA APP VIEJA (Chrome, sin nube)
   Se carga el "Exportar todos los datos" de la app vieja y se elige qué live traer.
   Trae el live, sus pedidos y las clientas de esos pedidos. NO toca stock, compras ni config.
   Si un pedido ya está en la nube, no se pisa (la nube manda: puede tener pagos o salidas).
   Clientas que ya están: se actualizan con lo de la app vieja, pero se conservan los datos
   que solo existen en la nube (VIP, nota de Mabel, guardar sin pagar).
   ══════════════════════════════════════════════════════════════ */
const SOLO_NUBE_CLI = ['vip', 'vipDesde', 'bienvenidaVip', 'noVip', 'notaMabel', 'puedeGuardarSinPagar'];
let IMP = null;   // { lives, clientes, fecha }
function montarImportarLive() {
  const cf = document.getElementById('p-config'); if (!cf || document.getElementById('cf-implive')) return;
  const d = document.createElement('div'); d.className = 'card'; d.id = 'cf-implive';
  d.innerHTML = `<div class="card-t">📥 Traer un live de la app vieja</div>
    <p class="small muted mb">En la app de Chrome: ⚙️ Config → <b>Exportar todos los datos</b>. Cargá ese archivo acá y elegí el live. Se suman el live, sus pedidos y sus clientas; <b>no se toca el stock</b> ni nada de lo que ya está en la nube.</p>
    <input type="file" id="il-file" accept=".json,application/json" data-chg="ilArchivo">
    <div id="il-res"></div>`;
  const v = document.getElementById('cf-mabel') || document.getElementById('cf-version');
  if (v) cf.insertBefore(d, v); else cf.appendChild(d);
}
function leerBackupViejo(txt) {
  const b = JSON.parse(txt);
  if (b.app !== 'emma' || !b.datos || !Array.isArray(b.datos.emma_lives)) throw new Error('Ese archivo no es un "Exportar todos los datos" de Emma.');
  const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
  return { fecha: b.fecha, lives: parse(b.datos.emma_lives) || [], clientes: parse(b.datos.emma_clientes) || [] };
}
function pintarImportar() {
  const el = $('#il-res'); if (!el) return;
  if (!IMP) { el.innerHTML = ''; return; }
  const enNube = new Set(todosPedidos().map(p => p.id));
  const L = [...IMP.lives].filter(l => (l.pedidos || []).length).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 12);
  el.innerHTML = `<div class="small muted mt mb">Archivo del ${new Date(IMP.fecha).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })}. Elegí el live:</div>` + L.map((l, i) => {
    const n = l.pedidos.length, nuevos = l.pedidos.filter(p => !enNube.has(p.id)).length;
    return `<label class="row" style="padding:7px 0;border-bottom:1px solid var(--bd)"><input type="radio" name="il-live" value="${esc(l.id)}"${i === 0 && nuevos ? ' checked' : ''}${nuevos ? '' : ' disabled'}>
      <span class="grow" style="flex:1"><b>${esc(l.nombre)}</b> <span class="muted small">${fechaUY(l.fecha)} · ${n} pedidos</span></span>
      <span class="small ${nuevos ? 'c-ok' : 'muted'}">${nuevos ? nuevos + ' nuevos' : 'ya está en la nube'}</span></label>`;
  }).join('') + `<label class="row small mt"><input type="checkbox" id="il-actual" checked> Dejarlo como live actual</label>
    <button class="b pri mt" data-act="ilImportar">📥 Traer este live</button>`;
}
function importarLiveViejo(liveId, actual) {
  const lv = IMP.lives.find(l => l.id === liveId); if (!lv) return null;
  const cliOld = new Map(IMP.clientes.map(c => [c.id, c]));
  const r = { pedidos: 0, ya: 0, cliNuevas: 0, cliAct: 0 };
  const ids = new Set(todosPedidos().map(p => p.id));
  const nuevos = (lv.pedidos || []).filter(p => { if (ids.has(p.id)) { r.ya++; return false; } return true; });
  // Clientas de esos pedidos
  for (const cid of new Set(nuevos.map(p => p.clienteId))) {
    const o = cliOld.get(cid); if (!o) continue;
    const c = cliById(cid);
    if (!c) { DB.clientes.push(JSON.parse(JSON.stringify(o))); r.cliNuevas++; }
    else {
      const guardar = {}; SOLO_NUBE_CLI.forEach(k => { if (c[k] !== undefined) guardar[k] = c[k]; });
      Object.keys(c).forEach(k => { if (!(k in o) && !SOLO_NUBE_CLI.includes(k)) delete c[k]; });
      Object.assign(c, JSON.parse(JSON.stringify(o)), guardar); r.cliAct++;
    }
  }
  // Live y pedidos
  let l = liveById(lv.id);
  if (!l) { const { pedidos, ...resto } = lv; l = Object.assign(JSON.parse(JSON.stringify(resto)), { pedidos: [] }); DB.lives.push(l); DB.lives.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))); }
  for (const p of nuevos) { const q = JSON.parse(JSON.stringify(p)); q.liveId = l.id; l.pedidos.push(q); r.pedidos++; }
  l.pedidos.sort((a, b) => a.num - b.num);
  l.pedidoCounter = Math.max(+l.pedidoCounter || 0, +lv.pedidoCounter || 0, ...l.pedidos.map(p => +p.num || 0));
  if (actual) saveConfig({ liveActualId: l.id });
  guardar();
  return { r, live: l };
}
const _renderConfigIL = renderConfig;
renderConfig = function () { _renderConfigIL(); montarImportarLive(); };
Object.assign(CHG, {
  ilArchivo: (d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = e => { try { IMP = leerBackupViejo(e.target.result); pintarImportar(); } catch (err) { IMP = null; $('#il-res').innerHTML = `<div class="alert li">${esc(err.message)}</div>`; } };
    rd.readAsText(f);
  }
});
Object.assign(ACT, {
  ilImportar: () => {
    const sel = document.querySelector('input[name=il-live]:checked'); if (!sel) return toast('Elegí un live');
    const lv = IMP.lives.find(l => l.id === sel.value);
    if (!confirm(`¿Traer "${lv.nombre}" (${lv.pedidos.length} pedidos) a la nube?\n\nNo se toca el stock. Desde ahora organizá este live en la nube (totales, pagos y despacho), no en la app vieja.`)) return;
    const x = importarLiveViejo(sel.value, $('#il-actual').checked); if (!x) return;
    const { r, live } = x;
    $('#il-res').innerHTML = `<div class="alert ok">✓ ${esc(live.nombre)}: ${r.pedidos} pedidos traídos${r.ya ? ` (${r.ya} ya estaban y no se tocaron)` : ''} · ${r.cliNuevas} clientas nuevas · ${r.cliAct} actualizadas.</div>`;
    $('#il-file').value = ''; IMP = null;
    toast('📥 Live traído: ya podés mandar los totales');
  }
});
