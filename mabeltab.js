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
UI.mb = { sub: 'derivados', cat: 'todas', sinPed: false, verRes: false, q: '', dq: '', convF: 'todas', vincTel: '' };

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
/** Desde cuándo espera respuesta: el último reabierto o, si no, cuando se creó. */
const dvDesde = d => String(d.reabierto || d.creado || d.ultimo || '');
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
      <button class="b sm" data-act="mbVerChat" data-tel="${esc(d.telKey)}">💬 Chat</button><button class="b sm" data-act="mbWA" data-tel="${esc(d.tel || d.telKey)}">📱 WhatsApp</button>${mbFichaBtn(d.tel || d.telKey, f)}
      ${d.resuelto ? '' : `<select data-chg="dvCat" data-id="${esc(d.id)}" title="Cambiar la categoría">${MB_CATS.map(c => `<option value="${c[0]}"${c[0] === k ? ' selected' : ''}>${c[1]} ${esc(c[2])}</option>`).join('')}</select>`}
      ${conYana && !d.resuelto ? `<button class="b sm gh" data-act="convDevolver" data-id="${esc(cv.id)}" title="Mabel vuelve a atender esta conversación ya">↩️ Devolver a Mabel</button>` : ''}</div>
  </div>`;
}
/** 14/11: buscador de Derivados. Busca por nombre, alias o usuario de la ficha y por teléfono (3 dígitos o más). */
function dvCoincide(d, ix, q, qd) {
  if (!q) return true;
  if (qd.length >= 3 && String(d.tel || d.telKey || '').replace(/\D/g, '').includes(qd)) return true;
  const k = telKey(d.tel || d.telKey);
  return (DB.clientes || []).some(c => c.telKey === k && [c.nombre, c.ref, ...(c.alias || [])].some(s => norm(s).includes(q)));
}
function renderDerivados() {
  const ix = mbIndice(), pend = dvPendientes(), sinPed = d => { const f = mbFicha(d.tel || d.telKey, ix); return !f || !f.abiertos.length; };
  const q = norm(UI.mb.dq), qd = q.replace(/\D/g, '');
  const cuenta = {}; pend.forEach(d => { const k = mbCat(d.categoria)[0]; cuenta[k] = (cuenta[k] || 0) + 1; });
  const nSin = pend.filter(sinPed).length;
  if (UI.mb.cat !== 'todas' && !MB_CATS.some(c => c[0] === UI.mb.cat)) UI.mb.cat = 'todas';
  // Con algo escrito en el buscador se busca en todos los pendientes (sin filtro de categoría) y también en los resueltos.
  let lista = pend.filter(d => q ? dvCoincide(d, ix, q, qd) : (UI.mb.cat === 'todas' || mbCat(d.categoria)[0] === UI.mb.cat) && (!UI.mb.sinPed || sinPed(d)))
    .sort((a, b) => dvDesde(a).localeCompare(dvDesde(b))); // 25/11: del que espera hace más al más reciente, todo junto (las categorías son solo filtro)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const res = (DB.derivados || []).filter(d => d.resuelto && (q ? dvCoincide(d, ix, q, qd) && !d.unidoA : new Date(d.resuelto) >= hoy)).sort((a, b) => String(b.resuelto).localeCompare(String(a.resuelto))).slice(0, q ? 20 : 999);
  let h = `<div class="ptabs"><button class="ptab${UI.mb.cat === 'todas' ? ' on' : ''}" data-act="dvFiltro" data-k="todas">Todos<span class="n">${pend.length}</span></button>`
    + MB_CATS.map(c => `<button class="ptab${UI.mb.cat === c[0] ? ' on' : ''}${cuenta[c[0]] ? '' : ' vac'}" data-act="dvFiltro" data-k="${c[0]}">${c[1]} ${esc(c[2])}<span class="n">${cuenta[c[0]] || 0}</span></button>`).join('')
    + `<button class="ptab${UI.mb.sinPed ? ' on' : ''}${nSin ? '' : ' vac'}" data-act="dvSinPed" title="Solo las que no tienen pedido abierto">Sin pedido<span class="n">${nSin}</span></button></div>`;
  h += lista.length ? lista.map(d => dvItemHTML(d, ix)).join('')
    : `<div class="empty">${q ? 'Ningún pendiente con esa búsqueda' : pend.length ? 'No hay pendientes con este filtro' : '🎉 No hay nada pendiente: Mabel no te pasó nada o ya está todo resuelto'}</div>`;
  if (res.length) h += `<div class="row mt" data-act="dvVerRes" style="cursor:pointer"><span class="small muted">${q ? 'Resueltos' : 'Resueltos hoy'} (${res.length})</span><span class="grow"></span><span class="muted">${UI.mb.verRes ? '▲' : '▼'}</span></div>`
    + (UI.mb.verRes ? '<div class="mt">' + res.map(d => dvItemHTML(d, ix)).join('') + '</div>' : '');
  // 26/11 (Parte B): los que Mabel cerró sola (el equipo ya contestó y la clienta solo agradeció, el pedido ya salió, el pago entró)
  const sem = new Date(Date.now() - 7 * 864e5).toISOString();
  const solos = (DB.derivados || []).filter(d => d.resuelto && d.cerradoSolo && String(d.resuelto) >= sem).sort((a, b) => String(b.resuelto).localeCompare(String(a.resuelto)));
  if (solos.length) h += `<div class="row mt" data-act="dvVerSolos" style="cursor:pointer"><span class="small muted">🤖 Cerrados solos (últimos 7 días) (${solos.length})</span><span class="grow"></span><span class="muted">${UI.mb.verSolos ? '▲' : '▼'}</span></div>`
    + (UI.mb.verSolos ? '<div class="mt">' + solos.map(d => `<div class="small muted" style="margin:6px 2px 2px">${esc(String(d.resueltoPor || '').replace(/^cerrado solo: /, '🤖 '))}</div>` + dvItemHTML(d, ix).replace(/data-act="dvDeshacer"([^>]*)>[^<]*</, 'data-act="dvReabrir"$1>↩︎ Reabrir<')).join('') + '</div>' : '');
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
  // 25/11: primero las que tienen un pendiente sin resolver, del que espera hace más al más reciente; después el resto, la última actividad primero
  const espera = new Map(); dvPendientes().forEach(d => { const t = dvDesde(d); if (!espera.has(d.telKey) || t < espera.get(d.telKey)) espera.set(d.telKey, t); });
  ls.sort((a, b) => { const ea = espera.get(a.v.id), eb = espera.get(b.v.id); if (ea && eb) return ea.localeCompare(eb); if (ea || eb) return ea ? -1 : 1; return cvUltimo(b.v).localeCompare(cvUltimo(a.v)); });
  const tope = 50, total = ls.length; ls = ls.slice(0, tope);
  $('#mbt-conv-l').innerHTML = (ls.length ? ls.map(({ v, f }) => `<div class="dv">
      <div class="row" style="align-items:flex-start"><div class="grow">${mbQuienHTML(v.tel || v.id, f)}</div><span class="small muted">${fechaHoraCorta(cvUltimo(v))}</span></div>
      <div class="dv-chips">${cvConYana(v) ? '<span class="chip pe">🙋‍♀️ La tiene Yanaina</span>' : '<span class="chip ac">🤖 La tiene Mabel</span>'}${mbPedidosHTML(f)}</div>
      ${cvConYana(v) && v.motivo ? `<div class="dv-mot">${esc(v.motivo)}</div>` : ''}
      <div class="row mt"><button class="b sm" data-act="mbVerChat" data-tel="${esc(v.id)}">💬 Chat</button><button class="b sm" data-act="mbWA" data-tel="${esc(v.tel || v.id)}">📱 WhatsApp</button>${mbFichaBtn(v.tel || v.id, f)}${cvConYana(v) ? `<button class="b sm gh" data-act="convDevolver" data-id="${esc(v.id)}">↩️ Devolver a Mabel</button>` : ''}</div>
    </div>`).join('') : `<div class="empty">${q ? 'Sin resultados' : 'No hay conversaciones'}</div>`)
    + (total > tope ? `<div class="small muted mt">Se muestran las ${tope} más recientes de ${total}. Usá el buscador para encontrar otra.</div>` : '');
}
// ─── Chat estilo WhatsApp (25/11, Parte 1) ────────────────────
// Pantalla completa con la conversación de una clienta, traída de la base en el momento (no se guarda en el equipo).
// Se actualiza cada 10 s mientras está abierta. Fotos y PDF salen del bucket `comprobantes` con links firmados de 1 h.
// Responder: solo texto, por whatsapp-enviar (accion 'texto'); mandar = tomar la conversación (como contestar desde el celu).
const CH_OCULTOS = ['edit', 'revoke', 'system', 'ephemeral'];
const CH_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
UI.chat = null;
(() => {
  const st = document.createElement('style');
  st.textContent = `
#chat{position:fixed;inset:0;z-index:180;background:var(--bg);display:flex;flex-direction:column}
#chat .ch-col{width:100%;max-width:860px;margin:0 auto;display:flex;flex-direction:column;flex:1;min-height:0}
.ch-top{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--bd);background:var(--s1)}
.ch-top .ch-nom{font-weight:700;font-size:16px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-top .ch-sub{font-size:12px;color:var(--mu)}
.ch-acc{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid var(--bd);background:var(--s1)}
.ch-ped{border-bottom:1px solid var(--bd);background:var(--s1);padding:0 12px}
.ch-ped summary{cursor:pointer;padding:8px 0;font-size:13.5px;list-style:none}
.ch-ped summary::-webkit-details-marker{display:none}
.ch-ped .ch-pl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 0 10px;font-size:13.5px}
.ch-msgs{flex:1;min-height:0;overflow-y:auto;padding:10px 12px 14px;display:flex;flex-direction:column;gap:4px}
.ch-dia{align-self:center;font-size:11.5px;color:var(--mu);background:var(--s2);border-radius:8px;padding:3px 10px;margin:10px 0 4px}
.ch-m{max-width:78%;border-radius:12px;padding:6px 9px 4px;font-size:14px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere;align-self:flex-start;background:var(--s2);border-top-left-radius:4px}
.ch-m.mabel{align-self:flex-end;background:#2f2550;border-top-left-radius:12px;border-top-right-radius:4px}
.ch-m.equipo{align-self:flex-end;background:#1f4a35;border-top-left-radius:12px;border-top-right-radius:4px}
.ch-m.auto{align-self:flex-end;background:var(--s3);border-top-left-radius:12px;border-top-right-radius:4px}
.ch-m .ch-q{display:block;text-align:right;font-size:10.5px;color:var(--mu);margin-top:2px}
.ch-m .ch-who{display:block;font-size:11px;font-weight:700;margin-bottom:2px;opacity:.85}
.ch-m img{display:block;max-width:240px;max-height:300px;border-radius:8px;cursor:zoom-in;margin-bottom:3px;background:var(--s3);min-height:60px;min-width:80px}
.ch-m a.ch-pdf{display:inline-block;padding:8px 10px;border-radius:8px;background:var(--s3);color:var(--tx);text-decoration:none;margin-bottom:3px}
.ch-m .ch-nota{font-style:italic;color:var(--mu)}
.ch-sis{align-self:flex-end;font-size:11.5px;color:var(--mu);padding:0 4px}
.ch-mas{align-self:center;margin:4px 0 8px}
.ch-pie{border-top:1px solid var(--bd);background:var(--s1);padding:8px 10px calc(8px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:flex-end}
.ch-pie textarea{flex:1;resize:none;min-height:42px;max-height:140px;border-radius:20px;padding:10px 14px;font:inherit;font-size:15px}
.ch-pie .b{border-radius:50%;width:46px;height:46px;padding:0;font-size:19px;flex:none}
.ch-aviso{border-top:1px solid var(--bd);background:var(--s1);padding:10px 12px calc(10px + env(safe-area-inset-bottom));font-size:13.5px}
#chat-foto{position:fixed;inset:0;z-index:190;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out}
#chat-foto img{max-width:96vw;max-height:94vh;object-fit:contain}
@media (max-width:700px){.ch-m{max-width:88%}.ch-acc .b{flex:1 1 auto}}
`;
  document.head.appendChild(st);
})();
const chHora = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function chDia(iso) {
  const d = new Date(iso), f = localISO(d), hoy = hoyISO(), ay = localISO(new Date(Date.now() - 864e5));
  return f === hoy ? 'Hoy' : f === ay ? 'Ayer' : CH_DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + (d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : '');
}
const chConv = k => (DB.conversaciones || []).find(v => v.id === k) || null;
/** Último mensaje real de la clienta (para la ventana de 24 h de Meta). */
const chUltimoDeElla = ms => { for (let i = ms.length - 1; i >= 0; i--) { const m = ms[i]; if (m.direccion === 'in' && !CH_OCULTOS.includes(m.tipo) && m.tipo !== 'reaction') return m.creado; } return null; };
const chVentanaAbierta = ms => { const u = chUltimoDeElla(ms); return !!u && Date.now() - new Date(u).getTime() < 24 * 3600e3; };
const ENT_TXT = { retiro: '🏠 Retiro', cadeteria: '🚴 Cadetería', agencia: '📦 Agencia', sin_definir: '❔ Entrega sin definir' };

async function chatAbrir(k) {
  if (!k) return;
  chatCerrar(true);
  UI.chat = { k, ms: [], hayMas: false, cargando: true, error: '', urls: {}, enviando: false, borrador: '' };
  const el = document.createElement('div'); el.id = 'chat'; document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  try { history.pushState({ chat: k }, ''); } catch (_) {}
  chatPintar('abajo');
  await chatTraer();
  UI.chat && (UI.chat.timer = setInterval(() => { if (UI.chat && !document.hidden) chatTraer(true); }, 10000));
}
function chatCerrar(sinHistoria) {
  const c = UI.chat; if (c && c.timer) clearInterval(c.timer);
  UI.chat = null;
  const el = $('#chat'); if (el) el.remove();
  const fo = $('#chat-foto'); if (fo) fo.remove();
  document.body.style.overflow = '';
  if (!sinHistoria && history.state && history.state.chat) { try { history.back(); } catch (_) {} }
}
window.addEventListener('popstate', () => { if (UI.chat) chatCerrar(true); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#chat-foto')) $('#chat-foto').remove(); else if (UI.chat) chatCerrar(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'ch-txt' && matchMedia('(min-width: 701px)').matches) { e.preventDefault(); ACT.chatEnviar(); }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'ch-txt' && UI.chat) { UI.chat.borrador = e.target.value; e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; } });

/** Trae los últimos 80 (o, con nuevos=true, solo lo que llegó después del último que se ve). */
async function chatTraer(nuevos) {
  const c = UI.chat; if (!c) return;
  try {
    if (!navigator.onLine) throw new Error('sin conexión');
    let q = NUBE.sb.from('mabel_mensajes').select('id,direccion,tipo,texto,media,creado').eq('tel_key', c.k);
    const ult = c.ms.length ? c.ms[c.ms.length - 1].creado : null;
    if (nuevos && ult) q = q.gt('creado', ult).order('creado', { ascending: true }).limit(200);
    else q = q.order('creado', { ascending: false }).limit(80);
    const r = await q; if (r.error) throw new Error(r.error.message);
    if (UI.chat !== c) return;
    const filas = r.data || [];
    if (nuevos && ult) {
      const ids = new Set(c.ms.map(m => m.id)), add = filas.filter(m => !ids.has(m.id));
      c.error = '';
      if (add.length) { const abajo = chatEstaAbajo(); c.ms.push(...add); chatPintar(abajo ? 'abajo' : 'quedar'); } else chatPintarCabeza();
      return;
    }
    c.ms = filas.reverse(); c.hayMas = filas.length === 80; c.cargando = false; c.error = '';
    chatPintar('abajo');
  } catch (e) { if (UI.chat !== c) return; c.cargando = false; c.error = String(e.message || e); chatPintar('quedar'); }
}
async function chatAnteriores() {
  const c = UI.chat; if (!c || !c.ms.length) return;
  const caja = $('#ch-msgs'), alto = caja ? caja.scrollHeight - caja.scrollTop : 0;
  const r = await NUBE.sb.from('mabel_mensajes').select('id,direccion,tipo,texto,media,creado').eq('tel_key', c.k).lt('creado', c.ms[0].creado).order('creado', { ascending: false }).limit(80);
  if (r.error || UI.chat !== c) return toast('No se pudieron traer los anteriores');
  const viejos = (r.data || []).reverse(); c.ms = [...viejos, ...c.ms]; c.hayMas = viejos.length === 80;
  chatPintar('quedar');
  const cj = $('#ch-msgs'); if (cj) cj.scrollTop = cj.scrollHeight - alto;
}
const chatEstaAbajo = () => { const cj = $('#ch-msgs'); return !cj || cj.scrollHeight - cj.scrollTop - cj.clientHeight < 80; };

function chatCabezaHTML() {
  const c = UI.chat, ix = mbIndice(), f = mbFicha(c.k, ix), v = chConv(c.k), yana = v && cvConYana(v);
  const nom = f ? esc(f.c.nombre) : 'Sin registrar', pend = dvPendientes().filter(d => d.telKey === c.k).length;
  const quien = yana ? `🙋‍♀️ La tiene el equipo${v.hasta ? ' hasta las ' + chHora(v.hasta) : ''}` : '🤖 La tiene Mabel';
  const peds = f ? f.abiertos : [];
  const resumen = p => { const t = calc(p); return `<b>#${p.num}</b> · ${fmt(t.total)} · ${pagado(p) ? '<span class="chip ok">✓ Pagó</span>' : '<span class="chip pe">Sin pagar</span>'} · ${ENT_TXT[entregaEf(p)] || esc(entregaEf(p))}`; };
  const abierto = UI.chat.pedAbierto != null ? UI.chat.pedAbierto : matchMedia('(min-width: 701px)').matches;
  return `<div class="ch-top"><button class="b sm gh" data-act="chatCerrar" title="Volver" style="font-size:18px">←</button>
      <div class="grow" style="min-width:0"><div class="ch-nom">${nom}${f && f.otras ? ` <span class="chip pe">⚠️ ${f.otras + 1} fichas</span>` : ''}</div><div class="ch-sub">${esc(mbTelLindo(c.k))} · ${quien}${pend ? ` · <b>${pend} pendiente${pend > 1 ? 's' : ''}</b>` : ''}</div></div>
      ${f ? `<button class="b sm" data-act="chatFicha" data-cid="${f.c.id}" title="Ficha">👤</button>` : ''}<button class="b sm" data-act="mbWA" data-tel="${esc(c.k)}" title="Abrir en WhatsApp">📱</button></div>
    <div class="ch-acc">${yana ? `<button class="b sm" data-act="chatDevolver">↩️ Devolver a Mabel</button>` : `<button class="b sm" data-act="chatTomar">🙋‍♀️ Tomar</button>`}
      <button class="b sm ok" data-act="chatResuelta"${pend ? '' : ' disabled title="No tiene pendientes"'}>✓ Resuelta</button></div>
    ${peds.length <= 1 ? `<div class="ch-ped"><div class="ch-pl" style="padding:8px 0">🛍️ ${peds.length ? resumen(peds[0]) + ` <button class="b sm" data-act="chatPedido" data-id="${peds[0].id}">Abrir pedido</button>` : '<span class="muted">Sin pedido abierto</span>'}</div></div>`
      : `<details class="ch-ped" id="ch-ped"${abierto ? ' open' : ''}><summary>🛍️ ${peds.length} pedidos abiertos · ${resumen(peds[peds.length - 1])} <span class="muted">▾</span></summary>
      <div class="ch-pl">${peds.map(p => `<button class="b sm" data-act="chatPedido" data-id="${p.id}" title="Abrir el pedido">${resumen(p)}</button>`).join('')}</div></details>`}`;
}
function chatMsgHTML(m) {
  const md = m.media || {}, tipo = m.tipo || 'text', txt = String(m.texto || '');
  if (tipo === 'reaction') return m.direccion === 'echo' ? `<div class="ch-sis">🙋‍♀️ reaccionó · ${chHora(m.creado)}</div>` : '';
  const cls = m.direccion === 'in' ? '' : m.direccion === 'echo' ? 'equipo' : tipo === 'plantilla' ? 'auto' : 'mabel';
  const who = m.direccion === 'in' ? '' : m.direccion === 'echo' ? '🙋‍♀️ Equipo' + (md.desde === 'app' ? ' (app)' : '') : tipo === 'plantilla' ? '📨 Mensaje automático' : '🤖 Mabel';
  const sinCorchete = t => /^\[[^\]]*\]$/.test(t.trim()) ? '' : t;
  let cuerpo = '';
  if (md.path && /pdf/i.test(md.mime || '') ) cuerpo = `<a class="ch-pdf" href="#" data-act="chatPdf" data-path="${esc(md.path)}">📄 PDF · tocá para abrirlo</a>` + (sinCorchete(txt) ? '\n' + esc(txt) : '');
  else if (md.path) cuerpo = `<img data-path="${esc(md.path)}" data-act="chatFoto" alt="Foto">` + (sinCorchete(txt) ? esc(txt) : '');
  else if (tipo === 'audio' || tipo === 'voice') cuerpo = '<span class="ch-nota">🎤 Audio (escuchalo en el celu)</span>';
  else if (tipo === 'video') cuerpo = '<span class="ch-nota">🎬 Video (miralo en el celu)</span>';
  else if (tipo === 'sticker') cuerpo = '<span class="ch-nota">🩷 Sticker (miralo en el celu)</span>';
  else if (tipo === 'image') cuerpo = '<span class="ch-nota">📷 Foto (mirala en el celu)</span>' + (sinCorchete(txt) && !/no se pudo descargar/.test(txt) ? '\n' + esc(txt) : '');
  else if (tipo === 'document') cuerpo = '<span class="ch-nota">📄 Archivo (miralo en el celu)</span>';
  else if (tipo === 'location') cuerpo = '<span class="ch-nota">📍 Ubicación (mirala en el celu)</span>';
  else if (tipo === 'contacts') cuerpo = '<span class="ch-nota">👤 Contacto (miralo en el celu)</span>';
  else if (tipo === 'unsupported') cuerpo = '<span class="ch-nota">⚠️ Mandó algo que no llegó (miralo en el celu)</span>';
  else cuerpo = esc(txt || '[' + tipo + ']');
  return `<div class="ch-m ${cls}">${who ? `<span class="ch-who">${who}</span>` : ''}${cuerpo}<span class="ch-q">${chHora(m.creado)}</span></div>`;
}
function chatMsgsHTML() {
  const c = UI.chat;
  if (c.cargando) return '<div class="empty">Cargando mensajes…</div>';
  if (c.error && !c.ms.length) return `<div class="alert li">No se pudieron traer los mensajes (${esc(c.error)}). Hace falta internet.</div>`;
  if (!c.ms.length) return '<div class="empty">No hay mensajes guardados de este número</div>';
  let h = c.hayMas ? '<button class="b sm ch-mas" data-act="chatMas">⬆️ Ver anteriores</button>' : '', dia = '';
  for (const m of c.ms) {
    if (CH_OCULTOS.includes(m.tipo)) continue;
    const d = chDia(m.creado); if (d !== dia) { dia = d; h += `<div class="ch-dia">${d}</div>`; }
    h += chatMsgHTML(m);
  }
  return h;
}
function chatPieHTML() {
  const c = UI.chat;
  if (c.cargando) return '';
  if (!chVentanaAbierta(c.ms)) return `<div class="ch-aviso">⏳ <b>Pasaron 24 h</b> desde el último mensaje de la clienta: solo se puede mandar una plantilla. Escribile desde el celu (📱 arriba).</div>`;
  return `<div class="ch-pie"><textarea id="ch-txt" rows="1" placeholder="Escribí un mensaje…" maxlength="4000"></textarea><button class="b pri" data-act="chatEnviar" title="Mandar"${c.enviando ? ' disabled' : ''}>${c.enviando ? '…' : '➤'}</button></div>`;
}
function chatPintarCabeza() { const c = UI.chat, el = $('#ch-cab'); if (c && el) { const h = chatCabezaHTML(); if (el.innerHTML !== h) el.innerHTML = h; } }
function chatPintar(scroll) {
  const c = UI.chat, el = $('#chat'); if (!c || !el) return;
  const foco = document.activeElement && document.activeElement.id === 'ch-txt';
  if (!$('#ch-msgs')) el.innerHTML = `<div class="ch-col"><div id="ch-cab"></div><div class="ch-msgs" id="ch-msgs"></div><div id="ch-pie"></div></div>`;
  chatPintarCabeza();
  $('#ch-msgs').innerHTML = chatMsgsHTML();
  const pie = chatPieHTML();
  if ($('#ch-pie').dataset.h !== pie) {
    $('#ch-pie').innerHTML = pie; $('#ch-pie').dataset.h = pie;
    const t = $('#ch-txt'); if (t) { t.value = c.borrador || ''; if (foco) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  chatFotos();
  if (scroll === 'abajo') { const cj = $('#ch-msgs'); cj.scrollTop = cj.scrollHeight; }
}
/** Pide los links firmados (1 h) de las fotos que se ven y los cachea. */
async function chatUrl(path) {
  const c = UI.chat; if (!c) return null;
  const x = c.urls[path]; if (x && x.hasta > Date.now()) return x.url;
  const { data, error } = await NUBE.sb.storage.from('comprobantes').createSignedUrl(path, 3600);
  if (error || !data) return null;
  c.urls[path] = { url: data.signedUrl, hasta: Date.now() + 55 * 60e3 };
  return data.signedUrl;
}
function chatFotos() {
  document.querySelectorAll('#chat img[data-path]').forEach(async img => {
    if (img.dataset.ok) return; img.dataset.ok = '1';
    const u = await chatUrl(img.dataset.path);
    if (u) { img.onload = () => { if (chatEstaAbajoCasi()) { const cj = $('#ch-msgs'); if (cj) cj.scrollTop = cj.scrollHeight; } }; img.src = u; }
    else img.replaceWith(Object.assign(document.createElement('span'), { className: 'ch-nota', textContent: '📷 Foto (no se pudo cargar)' }));
  });
}
const chatEstaAbajoCasi = () => { const cj = $('#ch-msgs'); return cj && cj.scrollHeight - cj.scrollTop - cj.clientHeight < 400; };
/** Tomar / devolver / resolver desde el chat (mismas reglas que el resto de la pestaña). */
function chatTomarConv(k) {
  const ix = mbIndice(), f = mbFicha(k, ix), ahora = new Date();
  let v = chConv(k);
  if (!v) { v = { id: k, tel: (f && f.c.tel) || '0' + k, clienteId: f ? f.c.id : null }; DB.conversaciones.push(v); }
  Object.assign(v, { estado: 'yanaina', motivo: 'La tomó el equipo desde la app', desde: ahora.toISOString(), hasta: new Date(ahora.getTime() + 3600e3).toISOString() });
  delete v.devuelta; delete v.notaDevuelta; delete v.espera;
  saveConvs();
}

Object.assign(ACT, {
  chatCerrar: () => chatCerrar(),
  chatMas: () => chatAnteriores(),
  chatFicha: d => { chatCerrar(); verFicha(d.cid); },
  chatPedido: d => { chatCerrar(); irPedido(d.id); },
  chatFoto: async (d, el) => {
    const u = await chatUrl(d.path); if (!u) return toast('No se pudo abrir la foto');
    const fo = document.createElement('div'); fo.id = 'chat-foto'; fo.innerHTML = `<img src="${esc(u)}" alt="Foto">`; fo.addEventListener('click', () => fo.remove()); document.body.appendChild(fo);
  },
  chatPdf: async (d, el, e) => {
    if (e) e.preventDefault();
    const w = window.open('', '_blank'); const u = await chatUrl(d.path);
    if (!u) { if (w) w.close(); return toast('No se pudo abrir el PDF'); }
    if (w) w.location.href = u; else location.href = u;
  },
  chatTomar: () => { const c = UI.chat; if (!c) return; chatTomarConv(c.k); toast('🙋‍♀️ La tomaste: Mabel no le contesta por 1 h (se renueva con cada mensaje tuyo)'); chatPintarCabeza(); render(); },
  chatDevolver: () => {
    const c = UI.chat; if (!c) return;
    const nota = prompt('↩️ Devolver a Mabel\n\nNota para Mabel (opcional): qué quedó resuelto o qué tiene que tener en cuenta.', '');
    if (nota === null) return;
    devolverAMabel(c.k);
    const v = chConv(c.k); if (v) { if (nota.trim()) v.notaDevuelta = nota.trim().slice(0, 400); else delete v.notaDevuelta; saveConvs(); }
    toast('↩️ Mabel vuelve a atender esta conversación'); chatPintarCabeza(); render();
  },
  chatResuelta: () => {
    const c = UI.chat; if (!c) return;
    const ps = dvPendientes().filter(d => d.telKey === c.k); if (!ps.length) return toast('No tiene pendientes');
    const por = (NUBE.user && NUBE.user.email) || '';
    ps.forEach(d => { d.resuelto = ahoraISO(); d.resueltoPor = por; });
    saveDerivados(); toast(`✓ ${ps.length} pendiente${ps.length > 1 ? 's' : ''} resuelto${ps.length > 1 ? 's' : ''}`); chatPintarCabeza(); render();
  },
  chatEnviar: async () => {
    const c = UI.chat, t = $('#ch-txt'); if (!c || !t || c.enviando) return;
    const texto = t.value.trim(); if (!texto) return;
    if (!navigator.onLine) return toast('Sin internet: no se puede mandar');
    if (!chVentanaAbierta(c.ms)) return toast('Pasaron 24 h: solo se puede mandar una plantilla');
    c.enviando = true; c.borrador = texto; chatPintar('quedar');
    try {
      const { data, error } = await NUBE.sb.functions.invoke('whatsapp-enviar', { body: { accion: 'texto', tel: c.k, texto } });
      if (error) throw error;
      if (!data || !data.ok) { if (data && data.ventana === false) { toast('Pasaron 24 h: solo se puede mandar una plantilla', 5000); } else throw new Error((data && data.error) || 'no salió'); return; }
      if (UI.chat !== c) return;
      c.borrador = '';
      // el estado de la conversación lo cambió la función en la base: llega solo por la nube (no se toca acá para no pisarlo)
      setTimeout(() => { if (UI.chat === c) chatPintarCabeza(); }, 2500);
      $('#ch-pie').dataset.h = ''; await chatTraer(true); chatPintar('abajo');
    } catch (e) { toast('⚠️ No salió: ' + (e.message || e), 6000); }
    finally { if (UI.chat === c) { c.enviando = false; $('#ch-pie') && ($('#ch-pie').dataset.h = ''); chatPintar('quedar'); } }
  }
});
document.addEventListener('toggle', e => { if (e.target && e.target.id === 'ch-ped' && UI.chat) UI.chat.pedAbierto = e.target.open; }, true);
async function mbVerChat(k) { return chatAbrir(k); }

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
// 14/11: modo ausente (viaje). Lo lee Mabel en config.mabelAusente.
// 14/11 tarde: se puede programar (desde/hasta). Mabel lo prende sola al llegar "desde" y lo apaga sola al terminar "hasta".
const mbAusenteOn = au => !!au && au.activo === true && (!au.hasta || au.hasta >= hoyISO());          // prendido o programado
const mbAusenteProg = au => mbAusenteOn(au) && !!au.desde && au.desde > ahoraISO();                  // programado, todavía no empezó
const mbDiaHoraAu = iso => { const d = new Date(iso); return mbDiaAu(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) + (d.getHours() || d.getMinutes() ? ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ' 00:00'); };
function mbDiaAu(f) { if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) return f || ''; const d = new Date(f + 'T12:00:00'); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }
const mbTextoAu = au => (au && au.texto) || `Hola bella, estamos de viaje hasta el ${mbDiaAu(au && au.hasta)}. Escribinos a partir de ahí y te respondemos. ¡Gracias!`;
function renderAjustesMabel() {
  const activa = cfgN('mabelActiva', true) !== false, solo = cfgN('mabelSolo', []) || [];
  const hoy = typeof horariosRetiro === 'function' && horariosRetiro().some(x => x.fecha === hoyISO());
  const au = cfgN('mabelAusente', null) || {}, auOn = mbAusenteOn(au);
  const h = `<div class="mbt-est"><div class="row"><b class="grow">${activa ? '🟢 Mabel está atendiendo' : '⏸️ Mabel está en pausa: no le contesta a nadie'}</b>
      <button class="b sm${activa ? ' dan' : ' ok'}" data-act="mbPausa">${activa ? '⏸️ Pausar a Mabel' : '▶️ Activar a Mabel'}</button></div>
      ${Array.isArray(solo) && solo.length ? `<div class="alert pe">Modo piloto: Mabel solo le contesta a ${solo.length} número(s).</div>` : ''}
      ${hoy ? '' : '<div class="alert pe">⚠️ No hay horario de retiro cargado para hoy: Mabel no le va a dar horario a nadie. Cargalo más abajo.</div>'}</div>
    <div class="mbt-est"><div class="row"><b class="grow">${!auOn ? '✈️ Modo ausente apagado' : mbAusenteProg(au) ? '✈️ Modo ausente PROGRAMADO: se prende solo el ' + esc(mbDiaHoraAu(au.desde)) + ' y se apaga solo al terminar el ' + esc(mbDiaAu(au.hasta)) : '✈️ Modo ausente PRENDIDO hasta el ' + esc(mbDiaAu(au.hasta)) + ' (se apaga solo)'}</b>
      <button class="b sm${auOn ? ' ok' : ''}" data-act="mbAusente">${!auOn ? 'Programar modo ausente' : mbAusenteProg(au) ? 'Cancelar programación' : 'Apagar modo ausente'}</button></div>${auOn && au.texto ? `<div class="small muted mt">Mensaje: "${esc(au.texto)}"</div>` : ''}
      <div class="small muted">${auOn ? 'A cada clienta le contesta una sola vez: "' + esc(mbTextoAu(au)) + '". No marca pagos, no toma entregas ni deriva. Se apaga solo al terminar ese día.' : 'Para el viaje: a cada clienta le contesta una sola vez que están de viaje y nada más.'}</div></div>`;
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
  if (!$('#mbt-dq')) { const i = document.createElement('input'); i.id = 'mbt-dq'; i.className = 'mb'; i.autocomplete = 'off'; i.dataset.inp = 'mbDerQ'; i.placeholder = '🔎 Buscar por nombre, alias o teléfono…'; $('#mbt-deriv').before(i); }
  $('#mbt-dq').hidden = UI.mb.sub !== 'derivados';
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
  dvVerSolos: () => { UI.mb.verSolos = !UI.mb.verSolos; render(); },
  // 26/11 (Parte B): reabrir uno que Mabel cerró sola. Queda reabiertoManual: Mabel no lo vuelve a cerrar hasta que haya algo nuevo.
  dvReabrir: d => { const x = dvPorId(d.id); if (!x) return; x.resuelto = null; delete x.resueltoPor; delete x.cerradoSolo; x.reabiertoManual = ahoraISO(); saveDerivados(); toast('↩︎ Volvió a la bandeja'); render(); },
  dvDeshacer: d => { const x = dvPorId(d.id); if (!x) return; if (x.cerradoSolo) { delete x.cerradoSolo; x.reabiertoManual = ahoraISO(); } x.resuelto = null; delete x.resueltoPor; saveDerivados(); toast('↩︎ Volvió a pendientes'); render(); },
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
  mbAusente: () => {
    const au = cfgN('mabelAusente', null) || {};
    if (mbAusenteProg(au)) {
      if (!confirm('¿Cancelar el modo ausente programado para el ' + mbDiaHoraAu(au.desde) + '?\n\nMabel sigue atendiendo normal.')) return;
      saveConfig({ mabelAusente: { ...au, activo: false, apagado: au.desde, cancelado: ahoraISO() } }); toast('✓ Programación cancelada'); render(); return;
    }
    if (mbAusenteOn(au)) {
      if (!confirm('¿Apagar el modo ausente?\n\nMabel vuelve a atender normal los mensajes que lleguen desde ahora. Lo que llegó durante el viaje no lo contesta sola: queda sin leer en el celular.')) return;
      saveConfig({ mabelAusente: { ...au, activo: false, apagado: ahoraISO() } }); toast('✓ Modo ausente apagado'); render(); return;
    }
    const desdeF = (prompt('¿Desde qué día? (AAAA-MM-DD; arranca a las 00:00 de ese día. Si es hoy, se prende ya)', hoyISO()) || '').trim();
    if (!desdeF) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeF) || desdeF < hoyISO()) { alert('La fecha tiene que ser AAAA-MM-DD y de hoy en adelante (ej. 2026-11-18).'); return; }
    const desde = desdeF === hoyISO() ? ahoraISO() : new Date(desdeF + 'T00:00:00-03:00').toISOString();
    const hasta = (prompt('¿Hasta qué día inclusive? (AAAA-MM-DD; se apaga solo al terminar ese día)', au.hasta && au.hasta >= hoyISO() ? au.hasta : '2026-11-21') || '').trim();
    if (!hasta) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desdeF) { alert('La fecha tiene que ser AAAA-MM-DD y no antes del día de inicio (ej. 2026-11-20).'); return; }
    const def = mbTextoAu({ hasta });
    const texto = (prompt('Mensaje que le manda Mabel a cada clienta, una sola vez:', def) || '').trim();
    if (!texto) return;
    if (!confirm('¿' + (desdeF === hoyISO() ? 'Prender' : 'Programar') + ' el modo ausente?\n\nDel ' + mbDiaHoraAu(desde) + ' al ' + mbDiaAu(hasta) + ' (inclusive), Mabel le contesta a cada clienta una sola vez:\n\n"' + texto + '"\n\ny nada más (no marca pagos, no toma entregas, no deriva). Se prende y se apaga solo.')) return;
    saveConfig({ mabelAusente: { activo: true, hasta, texto, desde, apagado: null } }); toast(desdeF === hoyISO() ? '✈️ Modo ausente prendido' : '✈️ Modo ausente programado'); render();
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
  mbDerQ: el => { UI.mb.dq = el.value; renderDerivados(); },
  mbVincQ: () => mbVincPintar()
});
