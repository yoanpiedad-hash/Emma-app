'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · PAGOS DEL DÍA (control)
   Pagos por cuenta con su total, para comparar con cada banco. Los pagos se marcan en Despacho.
   Usa anularPago de despacho.js (tabla pagos).
   ══════════════════════════════════════════════════════════════ */

(() => {
  const st = document.createElement('style');
  st.textContent = `
.pg-cta{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--bd);border-radius:12px;background:var(--s1);margin-bottom:8px;cursor:pointer}
.pg-cta .tt{font-family:var(--mono);font-weight:800;font-size:18px;margin-left:auto}
.pg-l{display:flex;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid var(--bd);font-size:13px;flex-wrap:wrap}
`;
  document.head.appendChild(st);
})();

UI.pag = { dia: hoyISO(), abierta: null };

// ─── Pantalla ─────────────────────────────────────────────────
function renderPagos() {
  const el = $('#p-pagos'); if (!el) return;
  if (!el.dataset.ok) {
    el.innerHTML = `<div class="row mb"><button class="b" data-act="tab" data-t="despacho">← Despacho</button><span class="card-t" style="margin:0">📊 Pagos del día</span></div>
      <div id="pg-control"></div>`;
    el.dataset.ok = '1';
  }
  $('#pg-control').innerHTML = controlHTML();
}

// ── Control del día ──
function pagosDelDia(dia) { return (DB.pagos || []).filter(g => localISO(new Date(g.fecha)) === dia).sort((a, b) => a.fecha.localeCompare(b.fecha)); }
function controlHTML() {
  const P = UI.pag, gs = pagosDelDia(P.dia);
  const por = new Map();
  gs.forEach(g => { if (!por.has(g.cuenta)) por.set(g.cuenta, []); por.get(g.cuenta).push(g); });
  const total = gs.reduce((s, g) => s + (+g.monto || 0), 0);
  const hora = iso => { const d = new Date(iso); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ctas = [...por.entries()].sort((a, b) => b[1].reduce((s, g) => s + +g.monto, 0) - a[1].reduce((s, g) => s + +g.monto, 0)).map(([cta, l]) => {
    const t = l.reduce((s, g) => s + (+g.monto || 0), 0), ab = P.abierta === cta;
    return `<div class="pg-cta" data-act="pagAbrirCta" data-c="${esc(cta)}"><b style="font-size:16px">${esc(cta)}</b><span class="chip">${l.length} pago${l.length > 1 ? 's' : ''}</span><span class="tt">${fmt(t)}</span><span class="muted">${ab ? '▲' : '▼'}</span></div>
      ${ab ? `<div class="box mb">${l.map(g => { const p = pedById(g.pedidoId), c = cliById(g.clienteId || (p && p.clienteId)) || { nombre: '?' };
        return `<div class="pg-l"><span class="mono muted">${hora(g.fecha)}</span><span style="flex:1;min-width:120px"><b>${esc(c.nombre)}</b> <span class="muted">#${p ? p.num : '?'}${g.origen === 'despacho' ? ' · desde Despacho' : ''}</span></span><b class="mono">${fmt(g.monto)}</b><button class="b sm gh" data-act="pagAnular" data-id="${g.id}" title="Anular este pago">↩️</button></div>`; }).join('')}</div>` : ''}`;
  }).join('');
  return `<div class="card"><div class="row"><label class="small muted">Día</label><input type="date" id="pg-dia" data-chg="pagDia" value="${P.dia}" style="width:auto;flex:1"><button class="b sm" data-act="pagHoy">Hoy</button></div></div>
    ${gs.length ? `<div class="card"><div class="row"><span class="card-t" style="margin:0">Total del día · ${gs.length} pagos</span><span class="grow"></span><span class="mono" style="font-size:22px;font-weight:800">${fmt(total)}</span></div></div>
      ${ctas}
      <div class="row mt"><button class="b" data-act="pagCopiar">📋 Copiar resumen</button></div>
      <div class="small muted mt">Comparalo con lo que entró en cada cuenta. Solo cuentan los pagos marcados con cuenta (en Pagos o en Despacho).</div>`
    : '<div class="empty">No hay pagos marcados ese día</div>'}`;
}

// ─── Acciones ─────────────────────────────────────────────────
Object.assign(ACT, {
  pagAbrirCta: d => { UI.pag.abierta = UI.pag.abierta === d.c ? null : d.c; render(); },
  pagAnular: (d, el, e) => {
    if (e) e.stopPropagation();
    const g = DB.pagos.find(x => x.id === d.id); if (!g) return;
    const p = pedById(g.pedidoId), c = cliById(g.clienteId) || { nombre: '?' };
    if (!confirm(`¿Anular el pago de ${c.nombre}${p ? ' #' + p.num : ''} (${fmt(g.monto)} · ${g.cuenta})?\n\nEl pedido vuelve a "sin pagar".`)) return;
    anularPago(d.id); savePagos(); guardar(); toast('↩️ Pago anulado'); render();
  },
  pagHoy: () => { UI.pag.dia = hoyISO(); render(); },
  pagCopiar: async () => {
    const P = UI.pag, gs = pagosDelDia(P.dia), por = new Map();
    gs.forEach(g => por.set(g.cuenta, (por.get(g.cuenta) || 0) + (+g.monto || 0)));
    const txt = `Pagos ${fechaUY(P.dia)}\n` + [...por.entries()].map(([c, t]) => `${c}: ${fmt(t)}`).join('\n') + `\nTotal: ${fmt(gs.reduce((s, g) => s + (+g.monto || 0), 0))} (${gs.length} pagos)`;
    toast(await copiarTexto(txt) ? '📋 Resumen copiado' : 'No se pudo copiar');
  }
});
Object.assign(CHG, { pagDia: (d, el) => { UI.pag.dia = el.value || hoyISO(); UI.pag.abierta = null; render(); } });

