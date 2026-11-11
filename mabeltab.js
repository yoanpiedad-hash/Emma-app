'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · PESTAÑA MABEL (11/11)
   Todo lo de Mabel en un solo lugar, entre Live y Clientes:
   - Derivados: bandeja de lo que Mabel le pasa a Yanaina, por categoría. Queda pendiente hasta tocar "Resuelto"
     (tabla derivados: una fila por derivación, la escribe Mabel; la app solo marca resuelto o cambia la categoría).
   - Conversaciones: quién tiene cada chat (Mabel o Yanaina) y los mensajes, solo lectura.
   - Ajustes: pausa, avisos del día, horarios de retiro, números ignorados (antes en Config).
   - Chat madre: todavía no está.
   Las clientas se muestran con el nombre de su ficha (se busca por teléfono), no por el número.
   "Resuelto" solo saca el pendiente de la lista: no cambia quién atiende la conversación.
   Se carga después de mabel.js.
   ══════════════════════════════════════════════════════════════ */
(() => {
  const st = document.createElement('style');
  st.textContent = `
.dv{border:1px solid var(--bd);border-left:4px solid var(--bd);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--s1)}
.dv.c-pedido{border-left-color:var(--li)}.dv.c-pago{border-left-color:var(--pe)}.dv.c-entrega{border-left-color:#74b9ff}
.dv.c-cambio{border-left-color:var(--gu)}.dv.c-especial{border-left-color:var(--ac)}.dv.c-yharol{border-left-color:#ff8ad1}
.dv.res{opacity:.6}
.dv-mot{font-size:13.5px;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere}
.dv-tel{font-size:12px;color:var(--mu)}
.dv-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center}
.dv select{width:auto;padding:5px 8px;font-size:12.5px;border-radius:8px}
.mbt-chat{max-height:60vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px 2px}
.mbt-m{max-width:85%;border-radius:12px;padding:7px 10px;font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--s2);align-self:flex-start}
.mbt-m.out{align-self:flex-end;background:var(--ac2)}
.mbt-m.echo{align-self:flex-end;background:var(--ok2)}
.mbt-m .q{display:block;font-size:10.5px;color:var(--mu);margin-top:3px}
.mbt-est{border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid var(--bd);background:var(--s1)}
`;
  document.head.appendChild(st);
})();
if (!DB.derivados) DB.derivados = [];
if (typeof CLAVES_NUBE !== 'undefined') CLAVES_NUBE.emma_derivados = () => DB.derivados;
const saveDerivados = () => put('emma_derivados', DB.derivados);

const MB_CATS = [
  ['pedido', '🔴', 'Problema con el pedido'], ['pago', '💰', 'Pagos'], ['entrega', '🚚', 'Entrega'], ['cambio', '🔄', 'Cambios'],
  ['especial', '🛍️', 'Pedidos especiales'], ['yharol', '💄', 'Yharol'], ['otros', '❓', 'Otros']
];
const mbCat = k => MB_CATS.find(c => c[0] === k) || MB_CATS[MB_CATS.length - 1];
const mbCatIdx = k => MB_CATS.indexOf(mbCat(k));
UI.mb = { sub: 'derivados', cat: 'todas', sinPed: false, verRes: false, q: '', convF: 'todas', vincTel: '' };

// ─── Nombre de la clienta a partir del teléfono ───────────────
/** Índice por render: pedidos abiertos y último pedido de cada clienta. */
function mbIndice() {
  const ix = new Map();
  for (const p of todosPedidos()) {
    if (!p.clienteId || p.cambio) continue;
    let e = ix.get(p.clienteId); if (!e) ix.set(p.clienteId, e = { abiertos: [], ult: '' });
    if (sinSalir(p)) e.abiertos.push(p);
    const f = (p.fechas && p.fechas.creado) || ''; if (f > e.ult) e.ult = f;
  }
  return ix;
}
/** Ficha(s) de un número: la de pedido más reciente primero. { c, otras, abiertos } o null si el número no está registrado. */
function mbFicha(tel, ix) {
  const k = telKey(tel); if (!k) return null;
  const cs = DB.clientes.filter(c => c.telKey === k); if (!cs.length) return null;
  cs.sort((a, b) => ((ix.get(b.id) || {}).ult || '').localeCompare((ix.get(a.id) || {}).ult || ''));
  const abiertos = cs.flatMap(c => (ix.get(c.id) || { abiertos: [] }).abiertos).sort((a, b) => a.num - b.num);
  return { c: cs[0], otras: cs.length - 1, abiertos };
}
const mbTelLindo = t => { const k = telKey(t); return k.length === 8 ? '0' + k.slice(0, 2) + ' ' + k.slice(2, 5) + ' ' + k.slice(5) : String(t || ''); };
function mbQuienHTML(tel, f) {
  if (f) return `<b>${nomAlias(f.c)}</b>${f.otras ? ` <span class="chip pe" title="Hay ${f.otras + 1} fichas con este teléfono">⚠️ ${f.otras + 1} fichas</span>` : ''}<div class="dv-tel">${esc(mbTelLindo(tel))}</div>`;
  return `<b>Sin registrar</b><div class="dv-tel">${esc(mbTelLindo(tel))} · este número no está en ninguna ficha</div>`;
}
const mbPedidosHTML = f => f && f.abiertos.length ? f.abiertos.map(p => `<button class="b sm" data-act="irPedido" data-id="${p.id}" title="Abrir el pedido">#${p.num}${pagado(p) ? ' ✓' : ''}</button>`).join('') : '<span class="chip li">Sin pedido</span>';
const mbFichaBtn = (tel, f) => f ? `<button class="b sm" data-act="verFicha" data-cid="${f.c.id}">👤 Ficha</button>` : `<button class="b sm" data-act="mbVinc" data-tel="${esc(tel)}">🔗 Vincular a una ficha</button>`;

// ─── Derivados ────────────────────────────────────────────────
const dvPendientes = () => (DB.derivados || []).filter(d => d && !d.resuelto);
const dvPorId = id => (DB.derivados || []).find(d => d.id === id);
/** Los resueltos hace más de 30 días se sacan (quedan marcados como borrados en la base). Una vez por sesión. */
function dvLimpiar() {
  if (UI.mb.limpio || !NUBE.listo) return; UI.mb.limpio = true;
  const corte = new Date(Date.now() - 30 * 864e5).toISOString(), n = DB.derivados.length;
  DB.derivados = DB.derivados.filter(d => !(d.resuelto && d.resuelto < corte));
  if (DB.derivados.length !== n) saveDerivados();
}
function dvItemHTML(d, ix) {
  const f = mbFicha(d.tel || d.telKey, ix), [k, ico, nom] = mbCat(d.categoria), cv = (DB.conversaciones || []).find(v => v.id === d.telKey);
  const conYana = cv && cv.estado === 'yanaina' && (!cv.hasta || cv.hasta > ahoraISO());
  return `<div class="dv c-${k}${d.resuelto ? ' res' : ''}">
    <div class="row" style="align-items:flex-start"><div class="grow">${mbQuienHTML(d.tel || d.telKey, f)}</div><span class="small muted">${fechaHoraCorta(d.ultimo || d.creado)}</span></div>
    <div class="dv-chips"><span class="chip">${ico} ${esc(nom)}</span>${mbPedidosHTML(f)}${d.silencio ? '<span class="chip" title="Mabel no le dijo nada a la clienta sobre esto">🔕 no se le avisó</span>' : ''}${d.veces > 1 ? `<span class="chip">×${+d.veces}</span>` : ''}${d.resuelto ? `<span class="chip ok">✓ ${fechaHoraCorta(d.resuelto)}</span>` : ''}</div>
    <div class="dv-mot">${esc(d.motivo || 'Sin motivo')}</div>
    <div class="row mt">${d.resuelto ? `<button class="b sm" data-act="dvDeshacer" data-id="${esc(d.id)}">↩︎ Volver a pendiente</button>`
      : `<button class="b sm ok" data-act="dvResolver" data-id="${esc(d.id)}">✓ Resuelto</button>`}
      <button class="b sm" data-act="mbVerChat" data-tel="${esc(d.telKey)}">👁 Ver mensajes</button><button class="b sm" data-act="mbWA" data-tel="${esc(d.tel || d.telKey)}">💬 WhatsApp</button>${mbFichaBtn(d.tel || d.telKey, f)}
      ${d.resuelto ? '' : `<select data-chg="dvCat" data-id="${esc(d.id)}" title="Cambiar la categoría">${MB_CATS.map(c => `<option value="${c[0]}"${c[0] === k ? ' selected' : ''}>${c[1]} ${esc(c[2])}</option>`).join('')}</select>`}
      ${conYana && !d.resuelto ? `<button class="b sm gh" data-act="convDevolver" data-id="${esc(cv.id)}" title="Mabel vuelve a atender esta conversación ya">↩️ Devolver a Mabel</button>` : ''}</div>
  </div>`;
}
function renderDerivados() {
  const ix = mbIndice(), pend = dvPendientes(), sinPed = d => { const f = mbFicha(d.tel || d.telKey, ix); return !f || !f.abiertos.length; };
  const cuenta = {}; pend.forEach(d => { const k = mbCat(d.categoria)[0]; cuenta[k] = (cuenta[k] || 0) + 1; });
  const nSin = pend.filter(sinPed).length;
  if (UI.mb.cat !== 'todas' && !MB_CATS.some(c => c[0] === UI.mb.cat)) UI.mb.cat = 'todas';
  let lista = pend.filter(d => (UI.mb.cat === 'todas' || mbCat(d.categoria)[0] === UI.mb.cat) && (!UI.mb.sinPed || sinPed(d)))
    .sort((a, b) => mbCatIdx(a.categoria) - mbCatIdx(b.categoria) || String(a.creado).localeCompare(String(b.creado)));
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const res = (DB.derivados || []).filter(d => d.resuelto && new Date(d.resuelto) >= hoy).sort((a, b) => String(b.resuelto).localeCompare(String(a.resuelto)));
  let h = `<div class="ptabs"><button class="ptab${UI.mb.cat === 'todas' ? ' on' : ''}" data-act="dvFiltro" data-k="todas">Todos<span class="n">${pend.length}</span></button>`
    + MB_CATS.map(c => `<button class="ptab${UI.mb.cat === c[0] ? ' on' : ''}${cuenta[c[0]] ? '' : ' vac'}" data-act="dvFiltro" data-k="${c[0]}">${c[1]} ${esc(c[2])}<span class="n">${cuenta[c[0]] || 0}</span></button>`).join('')
    + `<button class="ptab${UI.mb.sinPed ? ' on' : ''}${nSin ? '' : ' vac'}" data-act="dvSinPed" title="Solo las que no tienen pedido abierto">Sin pedido<span class="n">${nSin}</span></button></div>`;
  h += lista.length ? lista.map(d => dvItemHTML(d, ix)).join('')
    : `<div class="empty">${pend.length ? 'No hay pendientes con este filtro' : '🎉 No hay nada pendiente: Mabel no te pasó nada o ya está todo resuelto'}</div>`;
  if (res.length) h += `<div class="row mt" data-act="dvVerRes" style="cursor:pointer"><span class="small muted">Resueltos hoy (${res.length})</span><span class="grow"></span><span class="muted">${UI.mb.verRes ? '▲' : '▼'}</span></div>`
    + (UI.mb.verRes ? '<div class="mt">' + res.map(d => dvItemHTML(d, ix)).join('') + '</div>' : '');
  $('#mbt-deriv').innerHTML = h;
}

// ─── Conversaciones ───────────────────────────────────────────
const cvConYana = v => v.estado === 'yanaina' && (!v.hasta || v.hasta > ahoraISO());
const cvUltimo = v => [v.desde, v.repaso, v.devuelta, v.derivadoEn].filter(Boolean).sort().pop() || '';
function renderConversaciones() {
  const ix = mbIndice(), q = norm(UI.mb.q), qd = q.replace(/\D/g, '');
  const todas = (DB.conversaciones || []).filter(v => v && v.id).map(v => ({ v, f: mbFicha(v.tel || v.id, ix) }));
  const es = { todas: () => true, yanaina: x => cvConYana(x.v), mabel: x => !cvConYana(x.v), sinped: x => !x.f || !x.f.abiertos.length };
  const n = k => todas.filter(es[k]).length;
  $('#mbt-conv-f').innerHTML = [['todas', 'Todas'], ['yanaina', '🙋‍♀️ Las tiene Yanaina'], ['mabel', '🤖 Las tiene Mabel'], ['sinped', 'Sin pedido']]
    .map(([k, t]) => `<button class="ptab${UI.mb.convF === k ? ' on' : ''}" data-act="cvFiltro" data-k="${k}">${t}<span class="n">${n(k)}</span></button>`).join('');
  let ls = todas.filter(es[UI.mb.convF] || es.todas);
  if (q) ls = ls.filter(({ v, f }) => (qd.length >= 3 && String(v.tel || v.id).replace(/\D/g, '').includes(qd)) || (f && [f.c.nombre, f.c.ref, ...(f.c.alias || [])].some(s => norm(s).includes(q))));
  ls.sort((a, b) => cvUltimo(b.v).localeCompare(cvUltimo(a.v)));
  const tope = 50, total = ls.length; ls = ls.slice(0, tope);
  $('#mbt-conv-l').innerHTML = (ls.length ? ls.map(({ v, f }) => `<div class="dv">
      <div class="row" style="align-items:flex-start"><div class="grow">${mbQuienHTML(v.tel || v.id, f)}</div><span class="small muted">${fechaHoraCorta(cvUltimo(v))}</span></div>
      <div class="dv-chips">${cvConYana(v) ? '<span class="chip pe">🙋‍♀️ La tiene Yanaina</span>' : '<span class="chip ac">🤖 La tiene Mabel</span>'}${mbPedidosHTML(f)}</div>
      ${cvConYana(v) && v.motivo ? `<div class="dv-mot">${esc(v.motivo)}</div>` : ''}
      <div class="row mt"><button class="b sm" data-act="mbVerChat" data-tel="${esc(v.id)}">👁 Ver mensajes</button><button class="b sm" data-act="mbWA" data-tel="${esc(v.tel || v.id)}">💬 WhatsApp</button>${mbFichaBtn(v.tel || v.id, f)}${cvConYana(v) ? `<button class="b sm gh" data-act="convDevolver" data-id="${esc(v.id)}">↩️ Devolver a Mabel</button>` : ''}</div>
    </div>`).join('') : `<div class="empty">${q ? 'Sin resultados' : 'No hay conversaciones'}</div>`)
    + (total > tope ? `<div class="small muted mt">Se muestran las ${tope} más recientes de ${total}. Usá el buscador para encontrar otra.</div>` : '');
}
/** Mensajes de una conversación, traídos de la base en el momento (no se guardan en el equipo). */
async function mbVerChat(k) {
  const ix = mbIndice(), f = mbFicha(k, ix), tit = f ? esc(f.c.nombre) : esc(mbTelLindo(k));
  showModal(`<h3>💬 ${tit}</h3><div class="empty">Cargando mensajes…</div>`);
  let ms = null, err = '';
  try {
    if (!navigator.onLine) throw new Error('sin conexión');
    const r = await NUBE.sb.from('mabel_mensajes').select('id,direccion,tipo,texto,media,creado').eq('tel_key', k).order('creado', { ascending: false }).limit(80);
    if (r.error) throw new Error(r.error.message); ms = r.data || [];
  } catch (e) { err = String(e.message || e); }
  if (!$('#modal').classList.contains('on')) return; // la cerró mientras cargaba
  const quien = { in: '', out: '🤖 Mabel', echo: '🙋‍♀️ Equipo', plantilla: '📨 Mensaje de la app' };
  const cuerpo = err ? `<div class="alert li">No se pudieron traer los mensajes (${esc(err)}). Hace falta internet.</div>`
    : !ms.length ? '<div class="empty">No hay mensajes guardados de este número</div>'
    : `<div class="mbt-chat" id="mbt-chat">${ms.filter(m => !['edit', 'revoke', 'system', 'ephemeral'].includes(m.tipo)).reverse().map(m => {
        const d = m.direccion === 'in' ? '' : m.direccion === 'echo' ? ' echo' : ' out';
        const txt = (m.media ? '📎 ' : '') + (m.texto || (m.media ? 'Archivo' : '[' + m.tipo + ']'));
        return `<div class="mbt-m${d}">${esc(txt)}<span class="q">${quien[m.direccion] ? quien[m.direccion] + ' · ' : ''}${fechaHoraCorta(m.creado)}</span></div>`; }).join('')}</div>`;
  showModal(`<h3>💬 ${tit}</h3><div class="small muted mb">${esc(mbTelLindo(k))} · solo lectura, últimos ${ms ? Math.min(ms.length, 80) : 0} mensajes</div>${cuerpo}
    <div class="row mt"><button class="b sm" data-act="mbWA" data-tel="${esc(k)}">💬 Abrir en WhatsApp</button><span class="grow"></span><button class="b pri" data-act="closeModal">Cerrar</button></div>`);
  const c = $('#mbt-chat'); if (c) c.scrollTop = c.scrollHeight;
}

// ─── Vincular un número a una ficha ───────────────────────────
function mbVincModal(tel) {
  UI.mb.vincTel = tel;
  showModal(`<h3>🔗 ¿De quién es el ${esc(mbTelLindo(tel))}?</h3><p class="small muted mb">Buscá la ficha de la clienta para ponerle este teléfono, o creá una nueva.</p>
    <input id="mbv-q" data-inp="mbVincQ" placeholder="🔎 Nombre o usuario de TikTok…" autocomplete="off"><div id="mbv-res" class="mt"></div>
    <div class="row mt"><button class="b sm" data-act="mbVincNueva">+ Crear ficha nueva</button><span class="grow"></span><button class="b gh" data-act="closeModal">Cancelar</button></div>`);
  setTimeout(() => { const el = $('#mbv-q'); if (el) el.focus(); }, 40);
}
function mbVincPintar() {
  const el = $('#mbv-res'); if (!el) return;
  const q = norm(($('#mbv-q') || {}).value);
  if (q.length < 2) { el.innerHTML = ''; return; }
  const cs = DB.clientes.filter(c => [c.nombre, c.ref, ...(c.alias || [])].some(s => norm(s).includes(q))).slice(0, 8);
  el.innerHTML = cs.length ? cs.map(c => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--bd)"><span class="grow">${nomAlias(c)}<div class="dv-tel">${c.tel ? 'Tiene el ' + esc(mbTelLindo(c.tel)) : 'Sin teléfono'}</div></span><button class="b sm ok" data-act="mbVincElegir" data-cid="${c.id}">Es ella</button></div>`).join('')
    : '<div class="small muted">No hay fichas con ese nombre.</div>';
}

// ─── Ajustes ──────────────────────────────────────────────────
function renderAjustesMabel() {
  const activa = cfgN('mabelActiva', true) !== false, solo = cfgN('mabelSolo', []) || [];
  const hoy = typeof horariosRetiro === 'function' && horariosRetiro().some(x => x.fecha === hoyISO());
  const h = `<div class="mbt-est"><div class="row"><b class="grow">${activa ? '🟢 Mabel está atendiendo' : '⏸️ Mabel está en pausa: no le contesta a nadie'}</b>
      <button class="b sm${activa ? ' dan' : ' ok'}" data-act="mbPausa">${activa ? '⏸️ Pausar a Mabel' : '▶️ Activar a Mabel'}</button></div>
      ${Array.isArray(solo) && solo.length ? `<div class="alert pe">Modo piloto: Mabel solo le contesta a ${solo.length} número(s).</div>` : ''}
      ${hoy ? '' : '<div class="alert pe">⚠️ No hay horario de retiro cargado para hoy: Mabel no le va a dar horario a nadie. Cargalo más abajo.</div>'}</div>`;
  const el = $('#mbt-pausa'); if (el.innerHTML !== h) el.innerHTML = h;
  if (typeof pintarCfgMabel === 'function') pintarCfgMabel();
}

// ─── Pestaña ──────────────────────────────────────────────────
const MB_SUBS = [['derivados', '📥 Derivados'], ['conversaciones', '💬 Conversaciones'], ['ajustes', '⚙️ Ajustes'], ['madre', '🧠 Chat madre']];
function renderMabel() {
  if (!$('#p-mabel')) return;
  dvLimpiar();
  const n = dvPendientes().length;
  $('#mbt-sub').innerHTML = MB_SUBS.map(([k, t]) => `<button class="ptab${UI.mb.sub === k ? ' on' : ''}" data-act="mbSub" data-k="${k}">${t}${k === 'derivados' ? `<span class="n">${n}</span>` : ''}</button>`).join('');
  $('#mbt-deriv').hidden = UI.mb.sub !== 'derivados'; $('#mbt-conv').hidden = UI.mb.sub !== 'conversaciones';
  $('#mbt-aj').hidden = UI.mb.sub !== 'ajustes'; $('#mbt-madre').hidden = UI.mb.sub !== 'madre';
  if (UI.mb.sub === 'derivados') renderDerivados();
  else if (UI.mb.sub === 'conversaciones') renderConversaciones();
  else if (UI.mb.sub === 'ajustes') renderAjustesMabel();
}
const _renderMbt = render;
render = function () { _renderMbt(); if (UI.tab === 'mabel') conFoco(renderMabel); };
const _renderBadgesMbt = renderBadges;
renderBadges = function () { _renderBadgesMbt(); const b = $('#bdg-mabel'); if (b) { const n = dvPendientes().length, h = n ? ` <span class="bdg red">${n}</span>` : ''; if (b.innerHTML !== h) b.innerHTML = h; } };

Object.assign(ACT, {
  mbSub: d => { UI.mb.sub = d.k; render(); },
  mbIrDerivados: () => { UI.mb.sub = 'derivados'; UI.mb.cat = 'todas'; UI.mb.sinPed = false; ACT.tab({ t: 'mabel' }); },
  mbIrAjustes: () => { UI.mb.sub = 'ajustes'; ACT.tab({ t: 'mabel' }); },
  dvFiltro: d => { UI.mb.cat = d.k; render(); },
  dvSinPed: () => { UI.mb.sinPed = !UI.mb.sinPed; render(); },
  dvVerRes: () => { UI.mb.verRes = !UI.mb.verRes; render(); },
  dvResolver: d => { const x = dvPorId(d.id); if (!x) return; x.resuelto = ahoraISO(); x.resueltoPor = (NUBE.user && NUBE.user.email) || ''; saveDerivados(); toast('✓ Resuelto. Si fue sin querer, está en "Resueltos hoy"'); render(); },
  dvDeshacer: d => { const x = dvPorId(d.id); if (!x) return; x.resuelto = null; delete x.resueltoPor; saveDerivados(); toast('↩︎ Volvió a pendientes'); render(); },
  cvFiltro: d => { UI.mb.convF = d.k; render(); },
  mbVerChat: d => { mbVerChat(telKey(d.tel)); },
  mbWA: d => { abrirWA(d.tel, ''); },
  mbVinc: d => mbVincModal(d.tel),
  mbVincElegir: d => {
    const c = cliById(d.cid), tel = UI.mb.vincTel; if (!c || !telKey(tel)) return;
    if (c.telKey && c.telKey !== telKey(tel) && !confirm(`${c.nombre} ya tiene el ${mbTelLindo(c.tel)}.\n\n¿Cambiarlo por el ${mbTelLindo(tel)}?`)) return;
    editarClienta(c, { tel: mbTelLindo(tel).replace(/\s/g, '') }); closeModal(); toast(`🔗 ${c.nombre} quedó con el ${mbTelLindo(tel)}`); render();
  },
  mbVincNueva: () => {
    const tel = UI.mb.vincTel; if (!telKey(tel)) return;
    const nombre = (prompt('Nombre o usuario de TikTok de la clienta:', (($('#mbv-q') || {}).value || '').trim()) || '').trim(); if (!nombre) return;
    const c = nuevaClienta(nombre, mbTelLindo(tel).replace(/\s/g, '')); DB.clientes.push(c); saveClientes(); closeModal(); toast(`✓ Ficha creada: ${c.nombre}`); render();
  },
  mbPausa: () => {
    const activa = cfgN('mabelActiva', true) !== false;
    if (!confirm(activa ? '¿Pausar a Mabel?\n\nDeja de contestarle a TODAS las clientas hasta que la vuelvas a activar. Los mensajes siguen llegando al celular.' : '¿Activar a Mabel?\n\nVuelve a contestar los mensajes que lleguen desde ahora.')) return;
    saveConfig({ mabelActiva: !activa }); toast(activa ? '⏸️ Mabel en pausa' : '▶️ Mabel activa'); render();
  }
});
Object.assign(CHG, {
  dvCat: (d, el) => { const x = dvPorId(d.id); if (!x) return; x.categoria = el.value; x.categoriaManual = true; saveDerivados(); toast('✓ Pasó a ' + mbCat(el.value)[2]); render(); }
});
Object.assign(INP, {
  mbConvQ: el => { UI.mb.q = el.value; renderConversaciones(); },
  mbVincQ: () => mbVincPintar()
});
