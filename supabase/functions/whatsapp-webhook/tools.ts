import { AsyncLocalStorage } from 'node:async_hooks';
// Herramientas de Mabel. Replican la lógica de la app (despacho.js, mabel.js, index.html) sobre la base.
// Regla de seguridad: ninguna herramienta recibe teléfono ni id de clienta del modelo. Siempre usan ctx (el número que escribió).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BARRIOS_GRISAL } from './barrios.ts';

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const TZ = 'America/Montevideo';
export const hoyUY = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const ahoraTxtUY = () => new Intl.DateTimeFormat('es-UY', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
let _n = 0;
export const uid = (p: string) => p + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 5);
export const telKeyDe = (s: string) => String(s || '').replace(/\D/g, '').slice(-8);
const normB = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const BARRIOS = (() => { const m = new Map<string, string>(); BARRIOS_GRISAL.forEach((b) => { if (!m.has(normB(b))) m.set(normB(b), b); }); return m; })();
const barrioCanon = (v: string) => BARRIOS.get(normB(v)) || '';
/** Barrios de la lista que contienen lo que escribió la clienta (ej. "Jardines" → Jardines del Hipódromo, Jardines de Carrasco). */
const barrioOpciones = (v: string) => {
  const n = normB(v); if (n.length < 3) return [] as string[];
  const vistos = new Set<string>(), out: string[] = [];
  const todos = [...BARRIOS.values()].sort((a, b) => a.length - b.length);
  for (const b of todos) {
    const parte = b.split('/').map((x) => x.trim()).find((x) => normB(x).includes(n));
    if (!parte) continue;
    const clave = normB(parte).replace(/s$/, '');
    if (!vistos.has(clave)) { vistos.add(clave); out.push(parte); }
  }
  return out.slice(0, 6);
};
const CUENTAS_DEF = ['BROU', 'Prex', 'Mi Dinero', 'OCA', 'Mercado Pago', 'Efectivo'];
// 20/11 (Tanda E, decisión del 13/11): cuentas que se aceptan para marcar pagos pero nunca se ofrecen (no están en el mensaje de totales).
const CUENTAS_SOLO_MARCAR = ['PREX YOAN'];
const medioDe = (c: string) => /mercado\s*pago/i.test(c || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(c || '') ? 'efectivo' : 'transferencia';
const esHabitual = (a: string) => /^(dac|nu[nñ]ez|correo)/.test(normB(a));

export type Ctx = { telKey: string; wa: string; clienta: any | null; clientas: any[]; media: { path: string; sha256: string; mime: string } | null; llamadas: string[]; derivado?: boolean; inicio?: string; repaso?: boolean; anteriores?: boolean; ausente?: boolean; vivo?: boolean; textos?: string[]; mensajeIds?: string[] };

// ─── Config ───────────────────────────────────────────────────────
// 19/11 (banco de casos): solo el modo prueba (x-mabel-test) pone cfgPrueba, para simular Config sin tocar la real.
// Va por pedido (AsyncLocalStorage): dos pruebas al mismo tiempo no se pisan y la atención real nunca la ve.
const ALS_PRUEBA = new AsyncLocalStorage<Record<string, any> | null>();
export const conCfgPrueba = <T>(c: Record<string, any> | null, f: () => Promise<T>) => ALS_PRUEBA.run(c, f);
/** 23/11 (pedido web): valor simulado del modo prueba (nunca lo ve la atención real). */
export const pruebaDe = (k: string) => { const s = ALS_PRUEBA.getStore(); return s ? s[k] : undefined; };
export async function leerConfig(): Promise<Record<string, any>> {
  const { data } = await sb.from('config').select('clave,valor');
  const o: Record<string, any> = {};
  for (const r of data || []) o[r.clave] = r.valor;
  const cfgPrueba = ALS_PRUEBA.getStore();
  if (cfgPrueba) for (const k in cfgPrueba) { if (cfgPrueba[k] === null) delete o[k]; else o[k] = cfgPrueba[k]; }
  return o;
}
const num = (v: any, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
export const tarifaDe = (c: any) => num(c.tarifaEnvio, 250) || 250;
export const mpDe = (c: any) => (c.mpRecargo === undefined || c.mpRecargo === null || c.mpRecargo === '') ? 10 : Math.max(0, num(c.mpRecargo, 10));
const cuentasDe = (c: any): string[] => Array.isArray(c.cuentasPago) && c.cuentasPago.length ? c.cuentasPago : CUENTAS_DEF;
export const novedadesVigentes = (c: any) => { const n = c.novedadesHoy; return n && n.texto && (!n.vence || n.vence >= hoyUY()) ? n : null; };

// ─── Reglas de la app ───────────────────────────────────────────
const pagado = (p: any) => !!p.cambio || !!p.pago || p.estado === 'listo';
// 21/11 (MAI-08): la fecha desde la que atiende Mabel ya no está fija en el código. Sale de Config (clave mabelInicio, AAAA-MM-DD).
// Sin la clave vale el 4/11 (activación). Con mabelInicio = "" (o null) la regla de pedidos anteriores se apaga (por ejemplo, después del reinicio).
const INICIO_MABEL_DEF = '2026-11-04';
const inicioMabel = (cfg: Record<string, any>) => { const v = cfg?.mabelInicio; if (v === '' || v === null || v === false) return ''; return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : INICIO_MABEL_DEF; };
const esAnteriorAMabel = (r: any, live: any, cfg: Record<string, any>) => { const ini = inicioMabel(cfg); return !!ini && !!live?.fecha && String(live.fecha).slice(0, 10) < ini && !pagado(r.datos) && r.datos.estado === 'pendiente'; };
const entregaEf = (p: any, cli: any) => (p.entrega && p.entrega !== 'sin_definir') ? p.entrega : (cli && cli.datos?.agencia ? 'agencia' : (p.entrega || 'sin_definir'));
// Stock → modelo, para las promos del pedido. Se llena con cargarModelos(filas) antes de calcular (10/11).
const MODELO_DE = new Map<string, string>();
async function cargarModelos(filas: any[]) {
  const ids = new Set<string>();
  for (const r of filas || []) { const p = r?.datos; if (!p || !(p.promoCalc?.promos || []).length) continue; for (const pr of p.prendas || []) if (pr.stockId && !MODELO_DE.has(pr.stockId)) ids.add(pr.stockId); }
  if (!ids.size) return;
  const { data } = await sb.from('stock').select('id,datos').in('id', [...ids]);
  for (const s of data || []) MODELO_DE.set(s.id, s.datos?.modeloId || '');
}
// 10/11: mismo cálculo que la app (promos.js calcularPedido): precio especial, combos N por $X y NxM con las promos guardadas en el pedido
// (promoCalc), descuento del live + VIP solo sobre prendas sin promo, y saldo a favor. Antes no contaba las promos y el total salía de más.
export function calcPedido(p: any, live: any, modeloDe: (id: string) => string | null | undefined = (id) => MODELO_DE.get(id)): { total: number; detalle: string[] } {
  const s = p.promoCalc || {}, hoy = s.fecha || hoyUY();
  const promos = (s.promos || []).filter((x: any) => x && x.activa !== false && !x.borrado && !(x.liveId && x.liveId !== p.liveId) && !(x.desde && hoy < x.desde) && !(x.hasta && hoy > x.hasta));
  const U: any[] = [];
  for (const pr of p.prendas || []) {
    const q = Math.max(1, +pr.qty || 1), lista = +(pr.precioLista ?? pr.precio) || 0;
    const manual = !!pr.manual || (pr.precioLista != null && +pr.precio !== +pr.precioLista && !pr.promoId);
    const mid = pr.stockId ? (modeloDe(pr.stockId) || null) : null;
    for (let k = 0; k < q; k++) U.push({ i: (p.prendas || []).indexOf(pr), mid, lista, precio: manual ? +pr.precio || 0 : lista, manual, promoId: null });
  }
  let descPromos = 0;
  const combos: { id: string; txt: string; monto: number }[] = [];
  for (const x of promos.filter((x: any) => x.tipo === 'especial')) {
    const set = new Set(x.modelos || []);
    for (const u of U) if (!u.manual && !u.promoId && u.mid && set.has(u.mid)) {
      const nuevo = x.modo === 'pct' ? Math.round(u.lista * (1 - (+x.valor || 0) / 100)) : Math.round(+x.valor || 0);
      if (nuevo < u.lista) { u.precio = nuevo; u.promoId = x.id; }
    }
  }
  for (const x of promos.filter((x: any) => x.tipo === 'combo' || x.tipo === 'nxm')) {
    const set = new Set(x.modelos || []), n = Math.max(1, +x.n || 0);
    const el = U.filter((u) => !u.manual && !u.promoId && u.mid && set.has(u.mid)).sort((a, b) => b.precio - a.precio);
    let monto = 0;
    for (let g = 0; g + n <= el.length; g += n) {
      const grupo = el.slice(g, g + n), suma = grupo.reduce((t, u) => t + u.precio, 0);
      let d = 0;
      if (x.tipo === 'combo') d = Math.max(0, suma - Math.round(+x.x || 0));
      else { const gratis = Math.max(0, n - Math.max(0, +x.m || 0)); d = grupo.slice(n - gratis).reduce((t, u) => t + u.precio, 0); }
      if (d > 0) { descPromos += d; monto += d; grupo.forEach((u) => { u.promoId = x.id; }); }
    }
    if (monto > 0) combos.push({ id: x.id, txt: x.tipo === 'combo' ? `${+x.n} por ${plata(x.x)}` : `${+x.n}x${+x.m}`, monto });
  }
  const livePct = (p.descuento !== null && p.descuento !== undefined && p.descuento !== '') ? +p.descuento : (+(live?.datos?.descuento) || 0);
  const vipPct = +s.vipPct || 0;
  const bruto = U.reduce((t, u) => t + u.precio, 0), baseDesc = U.filter((u) => !u.promoId).reduce((t, u) => t + u.precio, 0);
  const sub = Math.max(0, bruto - descPromos - Math.round(baseDesc * livePct / 100) - Math.round(baseDesc * vipPct / 100));
  // Desglose en palabras, para explicarle el total a la clienta (11/11)
  const nom = (i: number, q: number) => `${(p.prendas || [])[i]?.nombre || 'prenda'}${q > 1 ? ' x' + q : ''}`;
  const cuenta = (us: any[]) => { const m = new Map<number, number>(); us.forEach((u) => m.set(u.i, (m.get(u.i) || 0) + 1)); return [...m].sort((a, b) => a[0] - b[0]); };
  const detalle: string[] = [];
  for (const k of combos) { const us = U.filter((u) => u.promoId === k.id), antes = us.reduce((t, u) => t + u.precio, 0); detalle.push(`Promo ${k.txt}: ${cuenta(us).map(([i, q]) => nom(i, q)).join(' + ')} → le queda en ${plata(antes - k.monto)} (sin promo serían ${plata(antes)})`); }
  const ids = new Set(combos.map((k) => k.id)), fuera = U.filter((u) => !u.promoId || !ids.has(u.promoId));
  for (const [i, q] of cuenta(fuera)) detalle.push(`${combos.length ? 'Fuera de promo: ' : ''}${nom(i, q)}: ${plata(fuera.filter((u) => u.i === i).reduce((t, u) => t + u.precio, 0))}`);
  if (livePct && baseDesc) detalle.push(`Descuento del live ${livePct}%: -${plata(Math.round(baseDesc * livePct / 100))}`);
  if (vipPct && baseDesc) detalle.push(`Descuento VIP ${vipPct}%: -${plata(Math.round(baseDesc * vipPct / 100))}`);
  const saldo = Math.min(+p.saldoAplicado || 0, sub);
  if (saldo) detalle.push(`Saldo a favor: -${plata(saldo)}`);
  return { total: sub - saldo, detalle };
}
const plata = (n: any) => '$' + Math.round(+n || 0).toLocaleString('es-UY');
export function calcTotal(p: any, live: any, modeloDe: (id: string) => string | null | undefined = (id) => MODELO_DE.get(id)): number { return calcPedido(p, live, modeloDe).total; }
function esperadoDe(base: number, env: number, cuenta: string, mp: number) {
  const rec = medioDe(cuenta) === 'mercadopago' ? Math.round((base + env) * mp / 100) : 0;
  return { base, env, rec, total: base + env + rec };
}
function estadoPago(p: any, cli: any): string {
  if (pagado(p)) return 'pagado';
  if (p.estado === 'guardado' && p.guardadoSinPagar) return 'guardado_sin_pagar';
  if (p.pagaAlRetirar && entregaEf(p, cli) === 'retiro') return 'al_retirar';
  return 'pendiente';
}
const porCreado = (a: any, b: any) => (a.datos.fechas?.creado || '').localeCompare(b.datos.fechas?.creado || '') || (a.datos.num - b.datos.num);

// ─── Lectura ──────────────────────────────────────────────────────
export async function cargarClienta(ctx: Ctx) {
  const { data } = await sb.from('clientas').select('*').eq('tel_key', ctx.telKey).eq('borrado', false).order('actualizado', { ascending: false });
  ctx.clientas = data || [];
  ctx.clienta = ctx.clientas[0] || null;
}
async function abiertos(ctx: Ctx) {
  const ids = ctx.clientas.map((c) => c.id);
  if (!ids.length) return { filas: [] as any[], lives: new Map<string, any>(), cobros: [] as any[] };
  const { data } = await sb.from('pedidos').select('*').in('clienta_id', ids).eq('borrado', false).in('estado', ['pendiente', 'listo', 'guardado']);
  const filas = (data || []).filter((r) => !r.datos?.cambio).sort(porCreado);
  await cargarModelos(filas);
  const lids = [...new Set(filas.map((r) => r.live_id))];
  const lives = new Map<string, any>();
  if (lids.length) { const { data: ls } = await sb.from('lives').select('id,nombre,fecha,datos').in('id', lids); (ls || []).forEach((l) => lives.set(l.id, l)); }
  const { data: cb } = await sb.from('cobros').select('*').eq('borrado', false).filter('datos->>estado', 'eq', 'abierto');
  const cobros = (cb || []).filter((k) => ids.includes(k.datos?.clienteId));
  return { filas, lives, cobros };
}

export async function buscarPedido(ctx: Ctx) {
  const cfg = await leerConfig();
  await cargarClienta(ctx);
  const c = ctx.clienta;
  await vencerPedidosWeb(ctx.clientas.map((k) => k.id)).catch((e) => console.error('pedido web (vencer):', (e as Error).message || e));
  const { filas, lives, cobros } = await abiertos(ctx);
  const tar = tarifaDe(cfg), mp = mpDe(cfg);
  // 5/11: pedidos de lives anteriores a la activación de Mabel (Config mabelInicio, por defecto 4/11) que figuran sin pagar: puede ser que estén pagados y no marcados. No se piden comprobantes: se busca en el historial y, si no se puede confirmar, queda para Yanaina en silencio.
  const anteriores = new Set<string>();
  const evidencia: Record<string, any> = {};
  for (const r of filas) {
    const live0 = lives.get(r.live_id);
    if (esAnteriorAMabel(r, live0, cfg)) {
      anteriores.add(r.id);
      try {
        const { data: tot } = await sb.from('mabel_historial').select('fecha').eq('tel_key', ctx.telKey).eq('de', 'equipo').ilike('texto', `%pedido #${r.datos.num}%`).gte('fecha', String(live0.fecha)).order('fecha', { ascending: false }).limit(1);
        const f0 = tot?.[0]?.fecha || String(live0.fecha);
        const { data: cp } = await sb.from('mabel_historial').select('fecha,tipo').eq('tel_key', ctx.telKey).eq('de', 'clienta').in('tipo', ['media_placeholder', 'image', 'document']).gt('fecha', f0).order('fecha').limit(5);
        evidencia[r.id] = { total_enviado_el: tot?.[0]?.fecha || null, archivos_de_la_clienta_despues_del_total: (cp || []).map((x: any) => x.fecha) };
      } catch (_) { /* sin indicio */ }
    }
  }
  const pedidos = filas.map((r) => {
    const p = r.datos, live = lives.get(r.live_id);
    const { total, detalle } = calcPedido(p, live);
    return {
      ...(anteriores.has(r.id) ? { anterior_a_mabel_sin_marcar_pago: true, indicio_en_historial: evidencia[r.id] || null, aviso: 'NO le pidas comprobante de este pedido y no le digas que lo debe: puede estar pagado y sin marcar. Si hace falta, pasalo a Yanaina en silencio.' } : {}),
      numero: p.num, live: live?.nombre || '', fecha_live: live?.fecha || null, plazo_para_pagar_hasta: p.web?.pagarHasta ? String(p.web.pagarHasta).slice(0, 10) : (live?.datos?.fechaPagoISO || null),
      ...(p.web ? { pedido_web: true, pagar_hasta: horaPlazoTxt(p.web.pagarHasta), ...(!pagado(p) && p.estado === 'pendiente' && Date.parse(p.web.pagarHasta) < ahoraMs() ? { plazo_vencido: true, que_hacer_plazo: 'Pedido del catálogo web con el plazo vencido. Si manda el comprobante, registralo normal con marcar_pagado (la ropa sigue apartada hasta que el equipo la libere). Si pregunta si todavía puede pagar o pide más tiempo, no lo prometas: "Bella, el plazo para pagarlo ya venció, lo consulto con Yanaina y te confirma 🫶" y pasá a Yanaina (pago, con_frase_propia).' } : {}) } : {}), ...(pagado(p) && p.estado !== 'enviado' && p.pago?.fecha ? { pagado_el: p.pago.fecha, salida_prevista: salidaPrevista(entregaEf(p, c), c?.datos?.agencia || '', p.pago.fecha, cfg) } : {}), total, detalle_del_total: detalle, estado: p.estado, estado_pago: estadoPago(p, c),
      entrega: entregaEf(p, c), confirmado: !!p.confirmado, guardado_sin_pagar_hasta: p.guardadoSinPagar?.hasta || null, paga_al_retirar: !!p.pagaAlRetirar,
      cadeteria_cobra_el_cadete: p.entrega === 'cadeteria' ? (p.cobroEnvio === 'pago' ? 0 : p.cobroEnvio === 'monto' ? (+p.cobroMonto || 0) : tar) : null,
      en_cobro_agrupado: cobros.find((k) => (k.datos.pedidos || []).includes(r.id))?.id || null,
    };
  });
  const sinPagar = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente' && !anteriores.has(r.id));
  let a_transferir: any = null;
  const kab = cobros[0];
  const baseDe = (rs: any[]) => rs.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  if (kab) {
    const rs = filas.filter((r) => (kab.datos.pedidos || []).includes(r.id) && !pagado(r.datos)); const env = +kab.datos.envio || 0;
    a_transferir = { cobro_agrupado: true, pedidos: rs.map((r) => r.datos.num), transferencia: esperadoDe(baseDe(rs), env, 'BROU', mp).total, mercado_pago: esperadoDe(baseDe(rs), env, 'Mercado Pago', mp).total, incluye_envio_cadeteria: env };
  } else if (sinPagar.length === 1) {
    const b = baseDe(sinPagar);
    a_transferir = { pedidos: [sinPagar[0].datos.num], transferencia: b, transferencia_con_cadeteria: b + tar, mercado_pago: esperadoDe(b, 0, 'Mercado Pago', mp).total, mercado_pago_con_cadeteria: esperadoDe(b, tar, 'Mercado Pago', mp).total };
  }
  // 5/11: para cambios — pedidos ya enviados/entregados en los últimos 21 días, con los días que pasaron desde que salieron
  let enviados_recientes: any[] = [];
  if (ctx.clientas.length) {
    const { data: en } = await sb.from('pedidos').select('*').in('clienta_id', ctx.clientas.map((k) => k.id)).eq('borrado', false).eq('estado', 'enviado');
    const hoyMs = Date.now(), hoyF = hoyUY(), horaUY = +new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date());
    // 5/11: "enviado" en la app = etiqueta impresa, NO que salió. Salida real = el equipo ya le mandó la foto del comprobante de envío (o pasaron más de 5 días).
    const minF = (en || []).map((r) => r.datos.fechas?.enviado || r.datos.fechas?.listo).filter(Boolean).sort()[0];
    let fotosEquipo: string[] = [];
    if (minF) {
      const desde = new Date(minF + 'T00:00:00-03:00').toISOString();
      const [{ data: e1 }, { data: e2 }] = await Promise.all([
        sb.from('mabel_mensajes').select('creado').eq('tel_key', ctx.telKey).eq('direccion', 'echo').in('tipo', ['image', 'document', 'video']).gte('creado', desde).limit(50),
        sb.from('mabel_historial').select('fecha').eq('tel_key', ctx.telKey).eq('de', 'equipo').in('tipo', ['image', 'media_placeholder', 'document', 'video']).gte('fecha', desde).limit(50),
      ]);
      fotosEquipo = [...(e1 || []).map((x: any) => x.creado), ...(e2 || []).map((x: any) => x.fecha)].map((x) => new Date(x).toISOString());
    }
    // 7/11: domingo no sale nada; sábado sale todo menos Correo.
    const sumarDia = (f: string, ent?: string) => { let d = new Date(new Date(f + 'T12:00:00Z').getTime() + 864e5); while (d.getUTCDay() === 0) d = new Date(d.getTime() + 864e5); return d.toISOString().slice(0, 10); };
    enviados_recientes = (en || []).map((r) => {
      const p = r.datos, f = p.fechas?.enviado || p.fechas?.listo || null;
      const dias = f ? Math.floor((hoyMs - new Date(f + 'T12:00:00-03:00').getTime()) / 864e5) : null;
      const desdeMs = f ? new Date(f + 'T00:00:00-03:00').getTime() : 0;
      const hayFoto = fotosEquipo.some((x) => new Date(x).getTime() >= desdeMs);
      const confirmada = hayFoto || (dias !== null && dias > 5);
      const ent = entregaEf(p, c), esperada = p.fechas?.listo ? sumarDia(p.fechas.listo, ent) : (f ? sumarDia(f, ent) : null);
      const vencida = !!esperada && (hoyF > esperada || (hoyF === esperada && horaUY >= 12));
      return { numero: p.num, etiqueta_impresa_el: f, dias_desde_la_etiqueta: dias, entrega: entregaEf(p, c), prendas: (p.prendas || []).map((x: any) => x.nombre).filter(Boolean), salida_confirmada: confirmada, ...(confirmada ? {} : { fecha_esperada_de_salida: esperada, fecha_esperada_vencida: vencida, que_decir: vencida ? 'SOLO si pregunta dónde está o cuándo sale este pedido (no si habla de un cambio: si ya tiene la prenda, le llegó): decile "Tu pedido ya está pronto para despachar, te paso con Yanaina para que te diga con exactitud" y pasá a Yanaina (entrega, con_frase_propia). NO digas que ya salió.' : 'SOLO si pregunta dónde está o cuándo sale: NO digas que ya salió; decile que sale en la fecha esperada.' }) };
    }).filter((x) => x.dias_desde_la_etiqueta !== null && (x.dias_desde_la_etiqueta as number) <= 21).sort((a, b) => (a.dias_desde_la_etiqueta as number) - (b.dias_desde_la_etiqueta as number));
  }
  return {
    enviados_recientes,
    clienta_encontrada: !!c,
    nota_de_la_clienta: c?.datos?.notaMabel || '',
    datos_guardados: c ? { direccion: c.datos.direccion || '', barrio: c.datos.barrio || '', agencia: c.datos.agencia || '', ciudad: c.datos.ciudad || '', departamento: c.datos.depto || '', nombre_envio: c.datos.nombreEnvio || '', ci: c.datos.ci || '', nota_cadete: c.datos.notaCadete || '', otras_direcciones: (c.datos.direcciones || []).filter((x: any) => normD(x.direccion) !== normD(c.datos.direccion)).map((x: any) => ({ direccion: x.direccion, barrio: x.barrio || '', etiqueta: x.etiqueta || '' })), puede_guardar_sin_pagar: !!c.datos.puedeGuardarSinPagar } : null,
    ...(c && num(c.datos.saldoFavor) > 0 ? { saldo_a_favor: num(c.datos.saldoFavor), ...(c.datos.saldoVence ? { saldo_vence: c.datos.saldoVence } : {}) } : {}), // 20/11 (D-10)
    pedidos_abiertos: pedidos,
    a_transferir,
    sin_pagar_para_marcar: sinPagar.length,
    config: { tarifa_cadeteria: tar, recargo_mercado_pago_pct: mp, cuentas: cuentasDe(cfg) },
  };
}

// ─── Escritura con control de cambios ─────────────────────────
const normD = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
// Lista de direcciones de cadetería de la clienta (3/11): la principal es datos.direccion; las demás quedan en datos.direcciones.
function sumarDireccion(d: any, dir: string, barrio: string, etiqueta: string) {
  const l = Array.isArray(d.direcciones) ? [...d.direcciones] : [];
  if (d.direccion && !l.some((x: any) => normD(x.direccion) === normD(d.direccion))) l.push({ direccion: d.direccion, barrio: d.barrio || '' });
  const i = l.findIndex((x: any) => normD(x.direccion) === normD(dir));
  const nueva = { ...(i >= 0 ? l[i] : {}), direccion: dir, barrio: barrio || (i >= 0 ? l[i].barrio : ''), ...(etiqueta ? { etiqueta } : {}) };
  if (i >= 0) l[i] = nueva; else l.push(nueva);
  return l.slice(-5);
}
async function guardarPedido(row: any, datos: any) {
  const { data, error } = await sb.from('pedidos').update({ estado: datos.estado || 'pendiente', entrega: datos.entrega || 'sin_definir', datos, actualizado: new Date().toISOString() }).eq('id', row.id).eq('actualizado', row.actualizado).select('id');
  if (error) throw new Error('No se pudo guardar el pedido: ' + error.message);
  if (!data?.length) throw new Error('conflicto: el pedido cambió mientras se guardaba');
}
async function guardarClienta(row: any, datos: any) {
  const { data, error } = await sb.from('clientas').update({ datos, actualizado: new Date().toISOString() }).eq('id', row.id).eq('actualizado', row.actualizado).select('id');
  if (error) throw new Error('No se pudo guardar la clienta: ' + error.message);
  if (!data?.length) throw new Error('conflicto: la ficha cambió mientras se guardaba');
}
async function conReintento<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { if (String((e as Error).message).startsWith('conflicto')) return await fn(); throw e; }
}

// ─── pasar_a_yanaina ──────────────────────────────────────────
// 10/11: día de salida del pedido calculado con la hora REAL del pago (p.pago.fecha), no con el plazo del live.
// Domingo no sale nada; sábado salen cadetería, DAC y Núñez (DAC y Núñez antes de las 12); Correo solo de lunes a viernes.
// Pago pasadas las 20:00 (DAC: pasadas las 20 también, aunque sale al día siguiente): no se promete día, lo confirma Yanaina.
// 15/11: días sin salida (viaje, feriados). config.diasSinSalida = [{ fecha: 'AAAA-MM-DD', solo?: ['dac'|'nunez'|'correo'|'cadeteria'|'retiro'], motivo? }].
// Sin "solo", ese día no sale nada ni hay retiro. Las fechas de salida los saltean igual que al domingo.
export function sinSalida(cfg: any, fecha: string, kind: string) {
  const l = Array.isArray(cfg?.diasSinSalida) ? cfg.diasSinSalida : [];
  return l.some((x: any) => x?.fecha === fecha && (!Array.isArray(x.solo) || !x.solo.length || x.solo.includes(kind)));
}
const DIAS_NOM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Días sin salida que vienen (desde hoy, hasta 14 días), para avisarle a Mabel: hasta cuándo se paga para que salga antes y qué día sale lo que se pague después. */
export function pausaTexto(cfg: any) {
  const hoy = hoyUY(), lim = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const l = (Array.isArray(cfg?.diasSinSalida) ? cfg.diasSinSalida : []).filter((x: any) => x?.fecha >= hoy && x.fecha <= lim).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  if (!l.length) return '';
  const dia = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return DIAS_NOM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  const sumar = (f: string, n: number) => new Date(new Date(f + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
  const total = l.filter((x: any) => !Array.isArray(x.solo) || !x.solo.length);
  const nombre: Record<string, string> = { dac: 'DAC', nunez: 'Núñez', correo: 'Correo Uruguayo', cadeteria: 'cadetería', retiro: 'retiro' };
  const parciales = l.filter((x: any) => Array.isArray(x.solo) && x.solo.length).map((x: any) => dia(x.fecha) + ' no hay ' + x.solo.map((k: string) => nombre[k] || k).join(' ni '));
  // Último día de pago (antes de las 20, o de las 15 en DAC) que todavía sale antes de la pausa, y qué día sale lo que se pague después.
  const at = (f: string, hh: string) => new Date(f + 'T' + hh + ':00-03:00').toISOString();
  const primero = l[0].fecha;
  let ultimo = '';
  for (let f = hoy; f < primero; f = sumar(f, 1)) { const r: any = salidaPrevista('cadeteria', '', at(f, '19:00'), cfg); if (r?.dia && r.dia === salidaPrevista('cadeteria', '', at(f, '19:00'), {})?.dia) ultimo = f; }
  const desp = total.length ? total[total.length - 1].fecha : l[l.length - 1].fecha;
  const tras = (tipo: string, ag: string) => (salidaPrevista(tipo, ag, at(desp, '12:00'), cfg) as any)?.texto || '';
  return 'PAUSA DE DESPACHO (el equipo está de viaje): ' + (total.length ? 'del ' + dia(total[0].fecha) + ' al ' + dia(desp) + ' no sale ningún envío ni hay retiro' : '') + (parciales.length ? (total.length ? '; además el ' : '') + parciales.join('; ') : '') + '. '
    + (ultimo ? 'Último pago que sale antes del viaje: el ' + dia(ultimo) + ' hasta las 20:00 (cadetería ' + ((salidaPrevista('cadeteria', '', at(ultimo, '19:00'), cfg) as any)?.texto || '') + '; Núñez ' + ((salidaPrevista('agencia', 'nunez', at(ultimo, '19:00'), cfg) as any)?.texto || '') + '; Correo ' + ((salidaPrevista('agencia', 'correo', at(ultimo, '19:00'), cfg) as any)?.texto || '') + ') y DAC hasta las 15:00 (' + String((salidaPrevista('agencia', 'dac', at(ultimo, '14:00'), cfg) as any)?.texto || '').replace(/^sale hoy \((.+?)\)/, 'sale el $1') + '). ' : '')
    + (ultimo ? 'Lo que se pague después' : 'Lo que se pague ahora') + ': cadetería ' + tras('cadeteria', '') + '; Núñez ' + tras('agencia', 'nunez') + '; DAC ' + tras('agencia', 'dac') + '; Correo Uruguayo ' + tras('agencia', 'correo') + '. '
    + 'Usá estos días tal cual (SALIDAS SI PAGA AHORA y salida_prevista ya los tienen en cuenta), solo si pregunta cuándo sale o por qué tarda; no la pases a Yanaina por esto. Retiro esos días no hay: ofrecé el primer día con horario cargado o "escribinos para coordinar a la vuelta".';
}
export function salidaPrevista(tipo: string, agencia: string, pagoISO: string | null, cfg: any = {}) {
  if (!pagoISO) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }).formatToParts(new Date(pagoISO)).map((x) => [x.type, x.value]));
  const h = +p.hour + (+p.minute) / 60, d0 = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
  const fmt = (d: Date) => DIAS_NOM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ag = String(agencia || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const kind = tipo === 'cadeteria' ? 'cadeteria' : /\bdac\b/.test(ag) ? 'dac' : /nunez|nunes/.test(ag) ? 'nunez' : /correo/.test(ag) ? 'correo' : null;
  if (!kind) return { texto: 'No hay salida calculable para esta agencia: que lo confirme Yanaina.', confirmar_yanaina: true };
  const sab = kind !== 'correo';
  const sigue = (desde: Date, pausa = true) => { let d = new Date(desde.getTime() + 864e5); while (d.getUTCDay() === 0 || (d.getUTCDay() === 6 && !sab) || (pausa && sinSalida(cfg, iso(d), kind))) d = new Date(d.getTime() + 864e5); return d; };
  const cuando = (d: Date) => kind === 'cadeteria' ? '' : (kind === 'dac' ? (d.getUTCDay() === 6 ? ' antes de las 12' : ' entre las 17 y las 18') : (d.getUTCDay() === 6 ? ' antes de las 12' : ' al mediodía'));
  if (h >= 20) {
    // Pasadas las 20 entra al corte del día siguiente. Sin pausa lo confirma Yanaina; si una pausa corre la salida, el día ya es seguro.
    const base = new Date(d0.getTime() + 864e5), dP = sigue(base), dN = sigue(base, false);
    if (iso(dP) !== iso(dN)) return { texto: 'sale el ' + fmt(dP) + cuando(dP) + ' (el equipo está de viaje)', dia: fmt(dP) };
    return { texto: 'Pagó pasadas las 20 hs: no le prometas día, Yanaina le confirma el día de salida.', confirmar_yanaina: true };
  }
  if (kind === 'dac' && h < 15 && d0.getUTCDay() >= 1 && d0.getUTCDay() <= 5 && !sinSalida(cfg, iso(d0), 'dac')) return { texto: 'sale hoy (' + fmt(d0) + ') entre las 17 y las 18', dia: fmt(d0) };
  const d = sigue(d0);
  return { texto: 'sale el ' + fmt(d) + cuando(d), dia: fmt(d) };
}
// ─── Bandeja de derivados (pestaña Mabel de la app, 11/11) ─────
// Cada pase a Yanaina deja una fila en la tabla derivados con su categoría. La app la muestra como pendiente hasta que alguien toca "Resuelto".
export const CATEGORIAS = ['pedido', 'pago', 'entrega', 'cambio', 'especial', 'yharol', 'otros'];
/** Categoría por palabras del motivo: se usa cuando Mabel no la manda o manda una que no existe. */
export function categoriaDe(motivo: string): string {
  const m = String(motivo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/yharol|yarol|maquillaje|perfum|bazar/.test(m)) return 'yharol';
  if (/\bcambio\b|cambiar (la|el|los|las|de talle)|devoluci|devolver/.test(m)) return 'cambio';
  if (/desconoce|no (lo |la )?pidio|no es (de ella|suyo|mio)|(prenda|remera|pantalon|short|cosa|algo|una|uno)s? de (mas|menos)|le falta|falta (una|la|el) |equivocad|mal anotad|reclam|no coincide con lo que pidio|numero sin pedido|sin pedido (abierto|de un live)|varios pedidos|dice ser/.test(m)) return 'pedido';
  if (/comprobante|transfi|pago\b|pagar|pagado|faltan \$|mercado ?pago|\bmp\b|link|cuenta|efectivo|plazo/.test(m)) return 'pago';
  if (/agencia|cadete|envio|enviar|retir|direccion|barrio|salio|sale |despach|dac\b|nunez|correo|local/.test(m)) return 'entrega';
  if (/agregar|sumar|guardar|guardad|avis(en|ar) cuando|consulta|pregunta (si|por)|talle|prenda|precio|tene[sn]\b|tienen|queda[n]?\b|\bhay\b|cuanto (sale|cuesta)|proximo vivo/.test(m)) return 'especial';
  return 'otros';
}
// 14/11 (MAC-07, MAC-08): UN solo pendiente por clienta. Los motivos se suman como lista con fecha (motivos[]) y `motivo`
// queda como texto armado para la app (lo más nuevo arriba). La categoría es la más urgente (orden de CATEGORIAS),
// salvo que la hayan puesto a mano en la app (categoriaManual). Si había varias filas pendientes, se unen en una y las
// otras quedan resueltas con "unido a …". "Resuelto" en la app resuelve así a la clienta entera.
// Devuelve null si no se pudo guardar (se reintenta una vez): en ese caso NO se le promete a la clienta que le escriben.
// repetido = ya había un motivo pendiente de la MISMA categoría de antes de `antesDe` (inicio del turno): el pase va en silencio.
const urg = (c: string) => { const i = CATEGORIAS.indexOf(c); return i < 0 ? 99 : i; };
const fechaCorta = (iso: string) => { try { return new Intl.DateTimeFormat('es-UY', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', ''); } catch (_) { return ''; } };
const motivosDe = (d: any): any[] => Array.isArray(d?.motivos) && d.motivos.length ? d.motivos : [{ fecha: d?.ultimo || d?.creado || new Date().toISOString(), categoria: d?.categoria || 'otros', motivo: String(d?.motivo || 'Sin motivo'), ...(d?.silencio ? { silencio: true } : {}) }];
const textoMotivos = (ms: any[]) => ms.slice(-6).reverse().map((m) => fechaCorta(m.fecha) + ' · ' + m.motivo).join('\n') + (ms.length > 6 ? '\n(+' + (ms.length - 6) + ' anteriores)' : '');
async function dosVeces<T>(f: () => PromiseLike<{ data?: T; error: any }>) { let r = await f(); if (r.error) { await new Promise((x) => setTimeout(x, 400)); r = await f(); } return r; }
export async function registrarDerivado(telKey: string, c: any, motivo: string, categoria: string | undefined, silencio: boolean, origen: string, antesDe?: string): Promise<{ id: string; repetido: boolean } | null> {
  try {
    const cat = CATEGORIAS.includes(String(categoria)) ? String(categoria) : categoriaDe(motivo);
    const ahora = new Date().toISOString(), mot = String(motivo || 'Sin motivo').replace(/\s+/g, ' ').trim().slice(0, 300);
    const corte = antesDe || ahora;
    const { data: ab, error: e0 } = await dosVeces(() => sb.from('derivados').select('id,datos').eq('datos->>telKey', telKey).eq('borrado', false).order('actualizado', { ascending: false }).limit(30));
    if (e0) { console.error('derivados (leer):', e0.message); return null; }
    const pend = ((ab || []) as any[]).filter((r) => r.datos && !r.datos.resuelto);
    const previos = pend.flatMap((r) => motivosDe(r.datos));
    const repetido = previos.some((m) => m.categoria === cat && String(m.fecha) < corte);
    const nuevo = { fecha: ahora, categoria: cat, motivo: mot, origen, ...(silencio || repetido ? { silencio: true } : {}) };
    if (!pend.length) {
      // 14/11 tarde: si el último pendiente lo cerró el equipo al escribirle desde el celular, se reabre esa misma fila (queda la historia)
      const re = ((ab || []) as any[]).find((r) => r.datos?.resueltoPor === 'equipo respondió' && String(r.datos.resuelto || '') > new Date(Date.now() - 7 * 864e5).toISOString());
      if (re) {
        const ms = [...motivosDe(re.datos), nuevo].slice(-15);
        const d2: any = { ...re.datos, categoria: re.datos.categoriaManual ? re.datos.categoria : cat, motivos: ms, motivo: textoMotivos(ms), ultimo: ahora, veces: (+re.datos.veces || 1) + 1, resuelto: null, reabierto: ahora, silencio: !!nuevo.silencio, clienteId: c?.id || re.datos.clienteId || null };
        delete d2.resueltoPor; delete d2.resueltoEquipo;
        const { error } = await dosVeces(() => sb.from('derivados').update({ datos: d2 }).eq('id', re.id));
        if (error) { console.error('derivados (reabrir):', error.message); return null; }
        return { id: re.id, repetido: false };
      }
      const id = 'dv' + telKey + Date.now().toString(36);
      const datos = { id, telKey, tel: c?.datos?.tel || '0' + telKey, clienteId: c?.id || null, categoria: cat, motivo: textoMotivos([nuevo]), motivos: [nuevo], silencio: !!nuevo.silencio, origen, creado: ahora, ultimo: ahora, veces: 1, resuelto: null };
      const { error } = await dosVeces(() => sb.from('derivados').insert({ id, datos, borrado: false }));
      if (error) { console.error('derivados (crear):', error.message); return null; }
      return { id, repetido: false };
    }
    // Se queda la fila con categoría puesta a mano; si no, la más urgente; si empatan, la más vieja.
    const keep = [...pend].sort((x, y) => (y.datos.categoriaManual ? 1 : 0) - (x.datos.categoriaManual ? 1 : 0) || urg(x.datos.categoria) - urg(y.datos.categoria) || String(x.datos.creado).localeCompare(String(y.datos.creado)))[0];
    const vistos = new Set<string>();
    const todos = [...previos, nuevo].filter((m) => { const k = m.fecha + '|' + m.motivo; if (vistos.has(k)) return false; vistos.add(k); return true; }).sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))).slice(-15);
    const categoriaFinal = keep.datos.categoriaManual ? keep.datos.categoria : [...todos].sort((x, y) => urg(x.categoria) - urg(y.categoria))[0].categoria;
    const veces = pend.reduce((n, r) => n + (+r.datos.veces || 1), 0) + 1;
    const datos = { ...keep.datos, categoria: categoriaFinal, motivos: todos, motivo: textoMotivos(todos), ultimo: ahora, veces, clienteId: c?.id || keep.datos.clienteId || null, silencio: todos.every((m) => m.silencio) };
    const { error } = await dosVeces(() => sb.from('derivados').update({ datos }).eq('id', keep.id));
    if (error) { console.error('derivados (sumar):', error.message); return null; }
    for (const r of pend) if (r.id !== keep.id) {
      const { error: e2 } = await sb.from('derivados').update({ datos: { ...r.datos, resuelto: ahora, resueltoPor: 'Mabel: unido a ' + keep.id, unidoA: keep.id } }).eq('id', r.id);
      if (e2) console.error('derivados (unir):', e2.message);
    }
    return { id: keep.id, repetido };
  } catch (e) { console.error('derivados:', (e as Error).message || e); return null; }
}

// 14/11 (MAC-01): la frase de pase le pide a la clienta que escriba. Esa respuesta queda SIN LEER en el celular de Yanaina
// (con notificación) y Mabel no la contesta mientras el pendiente siga abierto (conversaciones.datos.espera).
// 14/11 tarde: el equipo le escribió a la clienta desde el celular: sus pendientes pasan a resueltos ("equipo respondió").
// Si la clienta vuelve a escribir y nadie le contesta, el repaso de sin respuesta reabre la fila (registrarDerivado).
export async function resolverPorEquipo(telKey: string) {
  const { data, error } = await sb.from('derivados').select('id,datos').eq('datos->>telKey', telKey).eq('borrado', false).order('actualizado', { ascending: false }).limit(10);
  if (error) { console.error('derivados (equipo):', error.message); return 0; }
  const ahora = new Date().toISOString(); let n = 0;
  for (const r of data || []) {
    if (!r.datos || r.datos.resuelto) continue;
    const { error: e } = await sb.from('derivados').update({ datos: { ...r.datos, resuelto: ahora, resueltoPor: 'equipo respondió', resueltoEquipo: true } }).eq('id', r.id);
    if (e) console.error('derivados (equipo):', e.message); else n++;
  }
  return n;
}

export const FRASE_PASE = 'Ya se lo paso a Yanaina. Contame en un mensaje qué necesitás y ella te contesta 🫶';
// 15/11: durante el modo ausente que atiende, el pase avisa que Yanaina contesta a la vuelta.
export const FRASE_PASE_AUSENTE = 'Ya se lo paso a Yanaina. Contame en un mensaje qué necesitás y ella te contesta a la vuelta del viaje 🫶';
// 20/11 (Tanda D, D-2 y D-9): la frase la decide la herramienta. Durante el vivo nadie puede contestar; lo de Yharol lleva su frase.
export const FRASE_PASE_VIVO = 'Ya se lo paso a Yanaina. Ahora estamos en vivo, apenas termine te contesta 🫶';
export const FRASE_YHAROL = 'Dale bella, le avisamos a Yharol por tu pedido 🫶';
export const frasePase = (ctx?: { ausente?: boolean; vivo?: boolean } | null, categoria?: string) => categoria === 'yharol' ? FRASE_YHAROL : ctx?.ausente ? FRASE_PASE_AUSENTE : ctx?.vivo ? FRASE_PASE_VIVO : FRASE_PASE;
// Frases de pase (la vieja sigue en el historial): para no repetirla y para sacarla cuando el pase va en silencio.
export const RE_PASE = /(ya le aviso a yanaina|ya se lo paso a yanaina|contame en un mensaje qu[eé] necesit[aá]s|le avisamos a yharol)/i;
export async function pasarAYanaina(ctx: Ctx, motivo: string, silencio = false, categoria?: string, frasePropia = false) {
  // 4/11: cuando deriva Mabel, la conversación vuelve sola a Mabel en 1 hora (si Yanaina contesta desde el celu, el eco la deja más tiempo)
  const ahora = new Date(), hasta = new Date(ahora.getTime() + 1 * 3600e3);
  const c = ctx.clienta;
  // 14/11 (MAC-07): primero el pendiente de la bandeja. Si no se pudo guardar, no se cambia la conversación ni se promete nada.
  // 14/11 (MAR-01): en_silencio solo vale si alguien del equipo le escribió en la última hora. Excepciones: el repaso (no le
  // escribe nunca), los cambios en plazo (van en silencio a la bandeja por decisión del 13/11) y los pedidos anteriores a Mabel.
  let silencioNegado = false;
  if (silencio && !ctx.repaso && categoria !== 'cambio' && !(ctx.anteriores && categoria === 'pago')) {
    const { data: ec } = await sb.from('mabel_mensajes').select('texto,tipo').eq('tel_key', ctx.telKey).eq('direccion', 'echo').gte('creado', new Date(ahora.getTime() - 3600e3).toISOString()).limit(20);
    const equipoHablo = (ec || []).some((e: any) => !['edit', 'revoke', 'system', 'unsupported', 'ephemeral', 'reaction'].includes(String(e.tipo)) && !/Gracias por elegir Emma Indumentaria|mensaje autom[aá]tico de Emma|me confirm[aá]s con un S[ÍI]|Formas de pago/i.test(String(e.texto || '')));
    if (!equipoHablo) { silencio = false; silencioNegado = true; }
  }
  const dv = await registrarDerivado(ctx.telKey, c, motivo, categoria, silencio, categoria ? 'mabel' : 'regla', ctx.inicio);
  if (!dv) return { ok: false, derivado: false, error: 'No se pudo dejar el pase para Yanaina (falla al guardar).', instruccion: 'NO le digas que le avisás a Yanaina ni que alguien le escribe. Contestale solo lo que puedas resolver vos; si no hay nada para contestar, respondé exactamente "(sin mensaje)".' };
  const { data: prevCv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  const prev = prevCv?.datos || {};
  // 9/11: el repaso tiene que mirar lo que la clienta escribió y nadie contestó: desde el último mensaje nuestro (de Mabel o del equipo) anterior a este pase
  const { data: ultNuestro } = await sb.from('mabel_mensajes').select('creado').eq('tel_key', ctx.telKey).in('direccion', ['out', 'echo']).not('tipo', 'in', '(edit,revoke,reaction,system,ephemeral,unsupported)').order('creado', { ascending: false }).limit(1);
  const revisarDesde = ultNuestro?.[0]?.creado ? new Date(ultNuestro[0].creado).toISOString() : null;
  // 14/11 (punto 8): ya no se calla por "otro pase en las últimas 6 h". Solo se calla si ya había un pendiente del MISMO tema (repetido).
  const datos = { id: ctx.telKey, tel: c?.datos?.tel || '0' + ctx.telKey, clienteId: c?.id || null, estado: 'yanaina', motivo: String(motivo || 'Sin motivo').slice(0, 200), desde: ahora.toISOString(), hasta: hasta.toISOString() , derivadoEn: ahora.toISOString(), derivadoAntes: prev.derivadoEn || null, ...(revisarDesde ? { revisarDesde } : {}), ...(silencio ? { silencio: true } : {}), ...(dv.repetido && !silencio ? { repetido: true } : {}), ...(!silencio && !dv.repetido && !ctx.repaso ? { espera: ahora.toISOString() } : {}), ...(prev.repaso ? { repaso: prev.repaso } : {}), ...(prev.buscar ? { buscar: prev.buscar } : {}) };
  const { error } = await sb.from('conversaciones').upsert({ id: ctx.telKey, datos, borrado: false, actualizado: ahora.toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  ctx.derivado = true;
  if (silencio) return { ok: true, derivado: true, en_silencio: true, instruccion: 'Quedó para Yanaina en silencio: NO le escribas nada a la clienta sobre esto (ni "le aviso a Yanaina"). Si no hay otra cosa para contestarle, respondé exactamente "(sin mensaje)".' };
  if (dv.repetido) return { ok: true, derivado: true, ya_estaba_pendiente: true, instruccion: 'Ya había un pase de este mismo tema esperando a Yanaina: quedó sumado. NO le repitas que le avisás a Yanaina. Si la clienta preguntó otra cosa que podés contestar, contestala; si no, respondé exactamente "(sin mensaje)".' };
  if (frasePropia && categoria !== 'yharol') return { ok: true, derivado: true, instruccion: 'Quedó para Yanaina. Decile solo la frase propia del caso, sin otra frase de pase.' };
  return { ok: true, derivado: true, mensaje_para_la_clienta: frasePase(ctx, categoria), ...(silencioNegado ? { nota: 'No va en silencio: nadie del equipo le escribió en la última hora. Decile mensaje_para_la_clienta.' } : {}) };
}

// 14/11 (MAR-04): ¿es solo un agradecimiento o un "ok"? Mira todas las palabras ("ok gracias", "bien", "Mu has gracias 😘").
const PAL_ACK = new Set('ok oka okay okey oki okis dale listo genial perfecto bueno buenisimo bien gracias muchas mil bella bellas a vos igualmente un una beso besos besito besitos aguardo espero respuesta quedo atenta joya barbaro divino divina hermoso hermosa lindo linda super ahi va si sii claro de nada saludos abrazo abrazos amor mu has tranqui todo ya entendido entiendo vale sticker reaction te tu para mi'.split(' '));
export function esAck(texto: string) {
  const t = String(texto || '');
  if (t.includes('?')) return false;
  const w = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zñ\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!w.length) return true;
  if (w.length > 8) return false;
  return w.every((x) => PAL_ACK.has(x) || /^(ja)+j?$|^(je)+$|^gra+cias+$|^o+k+$|^s+i+$|^bes+o+s*$/.test(x));
}
/** ¿Hay una pregunta? (signo de pregunta o arranca como pregunta) */
export const esPregunta = (texto: string) => /\?/.test(String(texto || '')) || /^\s*(c[oó]mo|cu[aá]ndo|cu[aá]nto|cu[aá]l|d[oó]nde|qu[eé]|por qu[eé]|me (pas[aá]s|dec[ií]s|mand[aá]s|confirm[aá]s)|pod[eé]s|puedo|se puede|hay|tienen|ten[eé]s|sale|llega|ya (sali[oó]|est[aá]))(?!\p{L})/iu.test(String(texto || ''));

// ─── actualizar_nota ──────────────────────────────────────────
export async function actualizarNota(ctx: Ctx, texto: string) {
  if (!ctx.clienta) return { error: 'No hay ficha de clienta para este número; no se guardó la nota.' };
  const t = String(texto || '').trim().split('\n').slice(0, 3).join('\n').slice(0, 300);
  await conReintento(async () => {
    const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
    const d = { ...data.datos }; if (t) d.notaMabel = t; else delete d.notaMabel;
    await guardarClienta(data, d);
  });
  return { ok: true, nota: t };
}

// ─── marcar_pagado ───────────────────────────────────────────────
async function comprobanteReciente(ctx: Ctx): Promise<Ctx['media']> {
  const { data } = await sb.from('mabel_mensajes').select('media,creado').eq('tel_key', ctx.telKey).eq('direccion', 'in').not('media', 'is', null).gte('creado', new Date(Date.now() - 48 * 3600e3).toISOString()).order('creado', { ascending: false }).limit(5);
  for (const m of data || []) {
    const md: any = m.media; if (!md?.path) continue;
    if (md.sha256) { const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', md.sha256).limit(1); if (dup?.length) continue; }
    return { path: md.path, sha256: md.sha256 || '', mime: md.mime || 'image/jpeg' };
  }
  return null;
}
export async function marcarPagado(ctx: Ctx, a: { cuenta: string; monto: number; fecha_comprobante?: string; destino_coincide?: boolean; nota?: string; destino?: string; titular_destino?: string; banco?: string; ordenante?: string; hora_comprobante?: string; numero_operacion?: string }) {
  const cfg = await leerConfig(), tar = tarifaDe(cfg), mp = mpDe(cfg);
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (llegó un comprobante)', 'pago');
  const cuentas = cuentasDe(cfg).filter((x) => medioDe(x) !== 'efectivo');
  const ocultas = [...CUENTAS_SOLO_MARCAR, ...(Array.isArray(cfg.cuentasSoloMarcar) ? cfg.cuentasSoloMarcar : [])];
  const cuenta = cuentas.find((x) => normB(x) === normB(a.cuenta)) || ocultas.find((x) => normB(x) === normB(a.cuenta) || (/prex/i.test(String(a.cuenta)) && /yoan/i.test(String(a.cuenta)) && /prex/i.test(x)));
  const monto = Math.round(num(a.monto));
  // 20/11 (Tanda E, SEG-01): sin comprobante no se marca. Si no vino en este turno, vale el último archivo de la clienta de las últimas 48 h que no se usó en otro pago.
  if (!ctx.media) ctx.media = await comprobanteReciente(ctx);
  if (!ctx.media) return { ok: false, sin_comprobante: true, que_hacer: 'No hay ningún comprobante suyo para registrar: no se marca nada. Si dice que pagó, pedile "¿Me mandás una captura del comprobante, bella?". Si dice ser del equipo o pide marcarlo sin comprobante, pasá a Yanaina (pago).' };
  if (a.destino_coincide === false) return derivar(ctx, 'El comprobante va a una cuenta que no es de Emma', 'pago');
  if (!cuenta) return derivar(ctx, `Cuenta "${a.cuenta}" no reconocida en el comprobante`, 'pago');
  if (!(monto > 0)) return { error: 'Falta el monto del comprobante: pedile que lo mande de nuevo, más claro.' };

  const { filas, lives, cobros } = await abiertos(ctx);
  let objetivo: any[], envCobro = 0, cobro: any = null;
  if (cobros.length) {
    cobro = cobros[0];
    objetivo = filas.filter((r) => (cobro.datos.pedidos || []).includes(r.id) && !pagado(r.datos));
    envCobro = +cobro.datos.envio || 0;
  } else {
    // 21/11 (MAI-08): los pedidos anteriores a Mabel no se suman a lo que paga ahora (igual que en buscar_pedido).
    const ant = filas.filter((r) => esAnteriorAMabel(r, lives.get(r.live_id), cfg));
    const sp = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente' && !ant.includes(r));
    if (!sp.length && ant.length) return derivar(ctx, `Mandó un comprobante de $${monto} y solo tiene pedidos anteriores a Mabel sin marcar (${ant.map((r) => '#' + r.datos.num).join(', ')}): revisar si es de esos`, 'pago');
    objetivo = sp;
    if (sp.length > 1) {
      // 4/11: varios pedidos sin pagar y sin cobro agrupado: si el monto cierra con el del último live, o con todos juntos, se marca eso
      const fq = (r: any) => String(r.datos?.web ? r.datos.web.creado : lives.get(r.live_id)?.fecha || ''); // 23/11: el pedido web, por cuándo se hizo
      const ult = [...sp].sort((x, y) => fq(y).localeCompare(fq(x)) || (y.datos.num - x.datos.num))[0];
      const cierra = (ps: any[]) => { const b = ps.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0); return [b, b + tar, Math.round(b * (1 + mp / 100)), Math.round((b + tar) * (1 + mp / 100))].some((e) => monto >= e - 2 && monto <= e + 30); };
      if (cierra([ult])) objetivo = [ult];
      else if (cierra(sp)) objetivo = sp;
      else return derivar(ctx, `Tiene ${sp.length} pedidos sin pagar (${sp.map((r) => '#' + r.datos.num).join(', ')}) y el comprobante de $${monto} no coincide ni con el último ni con todos juntos`, 'pago');
    }
  }
  if (!objetivo.length) return { error: 'No hay ningún pedido sin pagar para marcar. Si dice que ya pagó, pasalo a Yanaina.' };

  // Fecha del comprobante vs fecha del live
  const f = String(a.fecha_comprobante || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const fl = objetivo.map((r) => r.datos?.web ? r.datos.fechas?.creado : lives.get(r.live_id)?.fecha).filter(Boolean).sort()[0]; // 23/11: el pedido web cuenta desde que se hizo, no desde el registro del mes
    if (fl && f < String(fl).slice(0, 10)) return derivar(ctx, `Comprobante de fecha ${f}, anterior al live (${String(fl).slice(0, 10)})`, 'pago');
  }
  // Comprobante ya usado
  if (ctx.media?.sha256) {
    const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', ctx.media.sha256).limit(1);
    if (dup?.length) return derivar(ctx, 'Ese comprobante ya figura en otro pago', 'pago');
  }
  // 21/11 (SEG-01 paso 3): otra captura del mismo comprobante tiene otra huella. Se compara lo leído: mismo monto, fecha y cuenta,
  // y además la misma hora o el mismo número de operación (sin hora ni número no se compara, para no frenar dos pagos iguales del mismo día).
  const hora = (String(a.hora_comprobante || '').match(/^(\d{1,2}):(\d{2})/) || []).slice(1, 3).map((x, i) => i ? x : x.padStart(2, '0')).join(':');
  const oper = String(a.numero_operacion || '').replace(/\D/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(f) && (hora || oper.length >= 4)) {
    const { data: igu } = await sb.from('pagos').select('id,datos').eq('borrado', false).filter('datos->lectura->>fecha', 'eq', f).filter('datos->lectura->>monto', 'eq', String(monto)).limit(20);
    const rep = (igu || []).find((g: any) => normB(g.datos?.cuenta) === normB(cuenta) && ((hora && g.datos?.lectura?.hora === hora) || (oper.length >= 4 && g.datos?.lectura?.operacion === oper)));
    if (rep) return derivar(ctx, `Ese comprobante ya figura en otro pago (mismo monto, fecha${hora ? ', hora' : ''}${oper.length >= 4 ? ', n° de operación' : ''} y cuenta)`, 'pago');
  }
  // Esperado (sin cadetería, salvo cobro agrupado que ya la trae) y faltante
  const base = objetivo.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  const esp = esperadoDe(base, envCobro, cuenta, mp);
  if (monto < esp.total) return derivar(ctx, `Transfirió de menos (faltan $${esp.total - monto}) · esperado $${esp.total}, transfirió $${monto} por ${cuenta}`, 'pago');

  // Registrar (misma lógica que registrarPagos de la app)
  const ajuste = monto - esp.total;
  const res = await conReintento(async () => {
    const frescas: any[] = [];
    for (const r of objetivo) { const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single(); frescas.push(data); }
    await cargarModelos(frescas);
    if (frescas.some((r) => pagado(r.datos))) throw new Error('Alguno de los pedidos ya figura pagado');
    const orden = [...frescas].sort(porCreado);
    const hoy = hoyUY(), ahora = new Date().toISOString();
    const gs: any[] = [];
    for (const r of orden) {
      const p = JSON.parse(JSON.stringify(r.datos)); const g: any = { id: uid('g'), pedidoId: p.id, clienteId: p.clienteId, cuenta, medio: medioDe(cuenta), monto: calcTotal(p, lives.get(r.live_id)), fecha: ahora, origen: cobro ? 'cobro' : 'mabel', antes: p.estado };
      p.pago = { id: g.id, cuenta, fecha: ahora };
      if (p.estado === 'pendiente') { p.estado = 'listo'; p.fechas = p.fechas || {}; p.fechas.listo = hoy; }
      gs.push({ g, p, r });
    }
    const g0 = gs[gs.length - 1].g;
    g0.envio = envCobro; g0.recargo = esp.rec; g0.esperado = esp.total; g0.ajuste = ajuste; g0.monto = (+g0.monto || 0) + envCobro + esp.rec + ajuste;
    g0.origen = cobro ? 'cobro' : 'mabel';
    if (a.nota) g0.nota = String(a.nota).slice(0, 200);
    { // 20/11 (Tanda E, MAI-01): lo que Mabel leyó del comprobante, para revisarlo después
      const lec: any = { monto, ...(f ? { fecha: f } : {}), ...(hora ? { hora } : {}), ...(oper.length >= 4 ? { operacion: oper.slice(0, 30) } : {}), ...(a.destino ? { destino: String(a.destino).slice(0, 80) } : {}), ...(a.titular_destino ? { titular_destino: String(a.titular_destino).slice(0, 80) } : {}), ...(a.banco ? { banco: String(a.banco).slice(0, 40) } : {}), ...(a.ordenante ? { ordenante: String(a.ordenante).slice(0, 80) } : {}), cuenta_dicha: String(a.cuenta || '').slice(0, 40) };
      g0.lectura = lec;
    }
    if (ctx.media) { g0.comprobante = ctx.media.path; g0.sha256 = ctx.media.sha256; }
    if (cobro) gs.forEach(({ g }) => { g.cobroId = cobro.id; });
    if (cobro && envCobro > 0) gs.forEach(({ p }) => { p.pago.conEnvio = true; p.entrega = 'cadeteria'; p.cobroEnvio = 'pago'; p.cobroMonto = 0; });
    for (const { p, r } of gs) await guardarPedido(r, p);
    const { error } = await sb.from('pagos').insert(gs.map(({ g }) => ({ id: g.id, pedido_id: g.pedidoId, cuenta: g.cuenta, monto: g.monto, fecha: g.fecha, comprobante: g.comprobante || null, datos: g, borrado: false })));
    if (error) throw new Error('No se pudo guardar el pago: ' + error.message);
    if (cobro) {
      const k = { ...cobro.datos, estado: 'pagado', pagos: gs.map(({ g }) => g.id), pagado: ahora };
      await sb.from('cobros').update({ datos: k, actualizado: ahora }).eq('id', cobro.id);
    }
    return gs.map(({ p }) => p.num);
  });
  // 20/11 (Tanda D, pregunta 7): con saldo a favor y un pago de más, lo de más lo ve Yanaina (puede haber pagado sin descontar el saldo).
  const saldoCli = num(ctx.clienta?.datos?.saldoFavor);
  if (saldoCli > 0 && ajuste > 30) {
    await registrarDerivado(ctx.telKey, ctx.clienta, `Pagó $${ajuste} de más y tiene $${saldoCli} de saldo a favor: revisar si pagó sin descontar el saldo`, 'pago', true, 'mabel', ctx.inicio);
    return { ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste, que_hacer: 'Quedó pagado. Lo de más ya lo ve Yanaina: no le preguntes por la diferencia ni la pases. Seguí con cómo recibe el pedido.' };
  }
  return {
    ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste,
    que_hacer: ajuste <= 30 ? 'Es redondeo o exacto: no digas nada de la diferencia. Seguí con cómo recibe el pedido.'
      : ajuste === tar ? `Sobran justo $${tar}: preguntale "¿los $${tar} de más son para la cadetería?". Si dice que sí, guardá la entrega con tipo cadetería y envio_transferido=${tar}.`
      : `Sobran $${ajuste}: preguntale por qué ("Vi que transferiste $${monto} y era $${esp.total}, ¿es por algo en especial?"). Si dice que es por la cadetería (vale $${tar}), guardá la entrega con envio_transferido=${ajuste} y avisale cuánto falta ($${tar - ajuste}) que se lo paga al cadete. Si es por otra cosa o no queda claro, pasalo a Yanaina con la diferencia.`,
  };
}
async function derivar(ctx: Ctx, motivo: string, categoria?: string) { const r = await pasarAYanaina(ctx, motivo, false, categoria || categoriaDe(motivo)); return { ...r, ok: false, motivo }; }

// ─── guardar_entrega ───────────────────────────────────────────
const AVISO_BARRIO = 'Falta el barrio de la cadetería';
// 15/11 (Yoan, caso La Morocha): para agencia el nombre de quien retira es obligatorio (va en la etiqueta). Si falta, se carga igual, queda el aviso en Despacho y Mabel lo pregunta.
const AVISO_NOMBRE = 'Falta el nombre de quien retira';
export async function guardarEntrega(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (eligió entrega)', 'entrega');
  const cfg = await leerConfig(), tar = tarifaDe(cfg);
  const tipo = String(a.tipo || '');
  if (!['retiro', 'cadeteria', 'agencia'].includes(tipo)) return { error: 'tipo tiene que ser retiro, cadeteria o agencia' };
  const { filas, cobros, lives } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (!objetivo.length && !cobros.length) objetivo = filas.filter((r) => r.datos.estado === 'guardado' && pagado(r.datos)); // guardado con pago: se le puede dejar anotada la entrega
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  // 4/11: con varios pedidos abiertos la entrega se carga en todos (salen juntos)
  if (!objetivo.length) return { error: 'No hay pedido abierto al que cargarle la entrega. Pasalo a Yanaina.' };

  const s = (v: any) => String(v ?? '').trim();
  const cambiosCli: Record<string, string> = {};
  const hint: any = {};
  // 11/11 (Yoan, caso Xime): el barrio ya no frena la carga. Si falta o no se reconoce, la cadetería se carga igual con la dirección,
  // queda el aviso "Falta el barrio" en Despacho y Mabel lo pregunta una sola vez; si la clienta contesta, se vuelve a llamar con el barrio.
  let faltaBarrio = false, faltaNombre = false, opBarrio: string[] = [];
  if (tipo === 'cadeteria') {
    if (!s(a.direccion)) return { error: 'Falta la dirección.' };
    const barrio = barrioCanon(s(a.barrio));
    if (!barrio) { faltaBarrio = true; opBarrio = s(a.barrio) ? barrioOpciones(s(a.barrio)) : []; }
    cambiosCli.direccion = s(a.direccion); if (barrio) cambiosCli.barrio = barrio;
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.nota_cadete)) cambiosCli.notaCadete = s(a.nota_cadete);
  } else if (tipo === 'agencia') {
    if (!s(a.agencia) || !s(a.ciudad)) return { error: 'Faltan la agencia y la ciudad.' };
    cambiosCli.agencia = s(a.agencia); cambiosCli.ciudad = s(a.ciudad);
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.ci)) cambiosCli.ci = s(a.ci);
    if (s(a.departamento)) cambiosCli.depto = s(a.departamento);
    hint.agencia_habitual = esHabitual(cambiosCli.agencia);
    faltaNombre = !s(a.nombre_retira) && !s(ctx.clienta?.datos?.nombreEnvio);
  }
  // 20/11 (Tanda D, D-13): retiro sin pagar, como máximo hasta la fecha de pago del vivo (salvo clientas con la marca de confianza).
  let retiroLejos = '';
  if (tipo === 'retiro' && /^\d{4}-\d{2}-\d{2}$/.test(s(a.retiro_fecha)) && !ctx.clienta?.datos?.puedeGuardarSinPagar) {
    const sinPago = objetivo.filter((r) => !pagado(r.datos));
    const tope = sinPago.map((r) => String(lives.get(r.live_id)?.datos?.fechaPagoISO || '')).filter(Boolean).sort().pop() || '';
    if (sinPago.length && tope && s(a.retiro_fecha) > tope) retiroLejos = tope;
  }
  // 20/11 (Tanda D, pregunta 9): pasa de cadetería con el envío transferido a otra entrega: el envío queda como saldo a favor.
  let envioASaldo = 0;
  if (tipo !== 'cadeteria') for (const r of objetivo) { const p0 = r.datos; if (p0.entrega === 'cadeteria' && p0.cobroEnvio === 'pago' && p0.pago) { envioASaldo = tar; break; } }
  const cambio = !!a.con_cambio, tarE = cambio ? Math.round(tar * 1.5) : tar; // 4/11: si el cadete además lleva/retira un cambio, cobra un envío y medio
  const pedido_x = Math.max(0, Math.min(tarE, Math.round(num(a.envio_transferido))));
  // 21/11 (MAI-01): el envío cuenta como transferido solo si sobra en un pago ya registrado (lo de más del pago, o lo que ya se le había asignado al envío).
  // Sin pago registrado, o si el pago vino justo, el cadete cobra la tarifa: decirlo no alcanza.
  let x = 0, pagoEnvio: any = null;
  if (tipo === 'cadeteria' && pedido_x > 0) {
    const ids = [...new Set(objetivo.map((r) => r.datos.pago?.id).filter(Boolean))];
    if (ids.length) {
      const { data: gs } = await sb.from('pagos').select('*').in('id', ids).eq('borrado', false);
      const disp = (g: any) => Math.max(0, num(g.datos?.ajuste)) + Math.max(0, num(g.datos?.envio));
      pagoEnvio = (gs || []).sort((u: any, v: any) => disp(v) - disp(u))[0] || null;
      if (pagoEnvio) x = Math.min(pedido_x, disp(pagoEnvio));
    }
  }
  const envioNoFigura = tipo === 'cadeteria' && pedido_x > x;
  await conReintento(async () => {
    if (Object.keys(cambiosCli).length) {
      const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
      if (tipo === 'cadeteria' && !cambiosCli.barrio) {
        // Sin barrio nuevo: si es la misma dirección de la ficha y ya tenía barrio, vale ese; si es otra dirección, el barrio viejo no corresponde
        const guardada = (Array.isArray(data.datos.direcciones) ? data.datos.direcciones : []).find((x: any) => normD(x.direccion) === normD(cambiosCli.direccion));
        const conocido = (normD(data.datos.direccion) === normD(cambiosCli.direccion) && s(data.datos.barrio)) || s(guardada?.barrio);
        if (conocido) { cambiosCli.barrio = conocido; faltaBarrio = false; } else cambiosCli.barrio = '';
      }
      const extra: any = tipo === 'cadeteria' ? { direcciones: sumarDireccion(data.datos, cambiosCli.direccion, cambiosCli.barrio, s(a.etiqueta).toLowerCase()) } : {};
      await guardarClienta(data, { ...data.datos, ...cambiosCli, ...extra });
    }
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos)); p.entrega = tipo;
      if (s(a.nota_interna) && !String(p.notas || '').includes(s(a.nota_interna))) { const n = '📦 ' + s(a.nota_interna).slice(0, 150); p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
      if (tipo === 'retiro') { if (!pagado(p)) p.pagaAlRetirar = true; else delete p.pagaAlRetirar; if (s(a.horario_retiro)) { const f = s(a.retiro_fecha), hh = s(a.retiro_hora).match(/^(\d{1,2}):(\d{2})$/); p.retiroCuando = { texto: s(a.horario_retiro).slice(0, 80), ...(/^\d{4}-\d{2}-\d{2}$/.test(f) ? { fecha: f } : {}), ...(hh && +hh[1] < 24 && +hh[2] < 60 ? { hora: hh[1].padStart(2, '0') + ':' + hh[2] } : {}) }; if (!p.retiroCuando.fecha) delete p.retiroCuando.hora; } if (s(a.horario_retiro)) { const n = '🕒 Pasa a retirar: ' + s(a.horario_retiro).slice(0, 80) + ' (le dijo a Mabel)'; p.notas = p.notas ? String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() + (String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() ? '\n' : '') + n : n; } }
      else { delete p.pagaAlRetirar; delete p.retiroCuando; }
      if (tipo !== 'cadeteria' && envioASaldo) { delete p.cobroEnvio; delete p.cobroMonto; if (p.pago) p.pago.conEnvio = false; }
      { // aviso de Despacho por el barrio: se pone si falta y se saca cuando se completa o cambia la entrega
        const partes = String(p.avisoDespacho || '').split(' · ').map((t: string) => t.trim()).filter((t: string) => t && t !== AVISO_BARRIO && t !== AVISO_NOMBRE);
        if (tipo === 'cadeteria' && faltaBarrio) partes.unshift(AVISO_BARRIO);
        if (tipo === 'agencia' && faltaNombre) partes.unshift(AVISO_NOMBRE);
        const av = partes.join(' · ').slice(0, 200); if (av) p.avisoDespacho = av; else delete p.avisoDespacho;
      }
      if (tipo === 'cadeteria') {
        p.tipoEnvio = p.tipoEnvio || 'comun';
        if (x >= tarE) { p.cobroEnvio = 'pago'; p.cobroMonto = 0; } else if (x > 0 || cambio) { p.cobroEnvio = 'monto'; p.cobroMonto = tarE - x; } else { p.cobroEnvio = 'cobrar'; p.cobroMonto = 0; }
        if (cambio) { const n = '🔄 Con cambio: el cadete cobra un envío y medio ($' + tarE + ')'; if (!String(p.notas || '').includes('Con cambio')) p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
        if (p.pago && x > 0) p.pago.conEnvio = x >= tarE;
      }
      await guardarPedido(data, p);
      // El envío ya transferido va a la fila de pago más nueva del pedido (misma convención que la app: envio, ajuste)
      if (tipo === 'cadeteria' && x > 0 && pagoEnvio && p.pago?.id === pagoEnvio.id) {
        const { data: g } = await sb.from('pagos').select('*').eq('id', pagoEnvio.id).single();
        const prev = Math.max(0, num(g?.datos?.envio)), aj = num(g?.datos?.ajuste);
        if (g && aj + prev >= x && prev !== x) { const d = { ...g.datos, envio: x, ajuste: aj + prev - x, esperado: num(g.datos.esperado) - prev + x }; await sb.from('pagos').update({ datos: d, actualizado: new Date().toISOString() }).eq('id', g.id); }
      }
    }
  });
  const cadete = tipo === 'cadeteria' ? (x >= tarE ? 0 : tarE - x) : null;
  if (envioASaldo) {
    await conReintento(async () => { const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single(); await guardarClienta(data, { ...data.datos, saldoFavor: num(data.datos.saldoFavor) + envioASaldo }); });
    await registrarDerivado(ctx.telKey, ctx.clienta, `Pasó de cadetería (envío transferido) a ${tipo}: los $${envioASaldo} del envío quedaron como saldo a favor`, 'entrega', true, 'mabel', ctx.inicio);
  }
  if (retiroLejos) {
    const d = await derivar(ctx, `Quiere retirar y pagar el ${s(a.retiro_fecha)}, después del plazo de pago (${retiroLejos}): autorizar`, 'pago');
    return { ...d, entrega_guardada: true, que_hacer: 'El retiro quedó anotado, pero pagar después del plazo lo autoriza Yanaina: no le confirmes la fecha. Decile solo mensaje_para_la_clienta.' };
  }
  return {
    ...(envioASaldo ? { envio_a_saldo: envioASaldo, que_hacer_saldo: `Decile que los $${envioASaldo} del envío que transfirió le quedan como saldo a favor para la próxima compra.` } : {}),
    ok: true, tipo, pedidos: objetivo.map((r) => r.datos.num), ...hint,
    ...(cadete !== null ? { el_cadete_cobra: cadete } : {}),
    ...(envioNoFigura ? { envio_no_figura_en_el_pago: true, que_hacer_envio: x > 0 ? `En el pago registrado sobran solo $${x} para el envío: el cadete cobra $${cadete}. Decile cuánto le cobra el cadete, sin discutir.` : `El envío no figura en ningún pago registrado (el pago vino justo o todavía no pagó): el cadete cobra $${cadete}. Decíselo una vez ("El cadete te cobra los $${cadete} del envío al recibir"). Si dice que lo transfirió aparte, pedile la captura de esa transferencia y pasá a Yanaina (pago) con "Dice que transfirió el envío aparte".` } : {}),
    ...(tipo === 'retiro' ? { paga_al_retirar: objetivo.some((r) => !pagado(r.datos)) } : {}),
    ...(tipo === 'cadeteria' && faltaBarrio ? { falta_barrio: true, ...(opBarrio.length ? { opciones: opBarrio } : {}), que_hacer: 'La cadetería YA quedó cargada con la dirección y sale igual. ' + (opBarrio.length ? 'El barrio no es exacto: preguntale cuál de estas opciones es (sin decir que es una lista).' : s(a.barrio) ? 'Ese barrio no está en la lista de GrisalExpress: preguntáselo una vez más (puede estar mal escrito).' : 'Preguntale el barrio.') + ' Una sola vez y en el mismo mensaje del cierre. Si lo contesta, volvé a llamar guardar_entrega con la misma dirección y el barrio. Si no contesta, no insistas ni lo repitas en otro mensaje: el equipo lo completa.' } : {}),
    ...(tipo === 'agencia' && faltaNombre ? { falta_nombre: true, que_hacer: 'La agencia YA quedó cargada. Falta el nombre y apellido de quien retira en la agencia (va en la etiqueta): preguntáselo una vez, en este mismo mensaje. Cuando lo diga, volvé a llamar guardar_entrega con nombre_retira.' } : {}),
    ...(tipo === 'agencia' && !faltaNombre && !s(a.nombre_retira) ? { nombre_guardado: s(ctx.clienta?.datos?.nombreEnvio), que_hacer: 'Se usó el nombre guardado: confirmáselo en el mensaje de cierre.' } : {}),
    mensaje_de_cierre: tipo === 'agencia' && !faltaNombre && !s(a.nombre_retira) ? `Listo, anotado. ¿Lo mandamos a nombre de ${s(ctx.clienta?.datos?.nombreEnvio)} como la otra vez? Cuando salga te mandamos la foto del comprobante de envío.` : tipo === 'agencia' && faltaNombre ? 'Listo, anotado. ¿A nombre de quién lo mandamos? Pasame nombre y apellido de quien lo retira en la agencia.' : tipo === 'cadeteria' && faltaBarrio ? 'Listo, ya lo tenemos anotado. ¿Me pasás el barrio así queda completo? Cuando salga te avisa la cadetería.' : tipo === 'cadeteria' ? 'Listo, ya lo tenemos anotado. Cuando salga te avisa la cadetería.' : tipo === 'agencia' ? 'Listo, anotado. Cuando salga te mandamos la foto del comprobante de envío.' : 'Listo, anotado. ¡Te esperamos!',
  };
}

// ─── dejar_aviso_despacho (7/11) ──────────────────────────────
// Un aviso corto para quien cierra el paquete en Despacho ("tiene paquete de Yharol, enviar junto"). Va en los pedidos abiertos de la clienta
// y la app lo muestra arriba mientras el pedido no salió; cuando sale, se olvida con el pedido.
export async function dejarAvisoDespacho(ctx: Ctx, a: any) {
  if (!ctx.clienta) return { error: 'No hay ficha de clienta para este número.' };
  const texto = String(a?.texto ?? '').trim().slice(0, 120);
  if (!texto) return { error: 'Falta el texto del aviso.' };
  const { filas } = await abiertos(ctx);
  const objetivo = filas.filter((r) => ['pendiente', 'listo', 'guardado'].includes(r.datos.estado));
  if (!objetivo.length) return { ok: false, error: 'No hay pedido abierto para dejarle el aviso.' };
  await conReintento(async () => {
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos));
      const previo = String(p.avisoDespacho || '').trim();
      if (previo.toLowerCase().includes(texto.toLowerCase())) continue;
      p.avisoDespacho = (previo ? previo + ' · ' : '') + texto;
      if (p.avisoDespacho.length > 200) p.avisoDespacho = p.avisoDespacho.slice(0, 200);
      await guardarPedido(data, p);
    }
  });
  return { ok: true, pedidos: objetivo.map((r) => r.datos.num) };
}

// ─── vincular_pedido (4/11) ───────────────────────────────────
// La clienta escribe desde un número que no está en ningún pedido ("soy Ale, te pedí una remera", "confirmo el pedido 34").
// Busca en los lives de hoy y ayer un pedido sin teléfono que coincida con el número de pedido y/o el nombre (TikTok),
// y le pone este teléfono. Si el pedido que coincide ya tiene OTRO teléfono, no lo toca y avisa a Yanaina.
const EMOJI_PAL: Record<string, string> = { '🦋': 'mariposa', '🌸': 'flor', '🌺': 'flor', '🌷': 'flor', '🌹': 'rosa', '❤': 'corazon', '❤️': 'corazon', '💖': 'corazon', '💕': 'corazon', '⭐': 'estrella', '🌟': 'estrella', '✨': 'brillo', '🌙': 'luna', '☀️': 'sol', '🌞': 'sol', '🐱': 'gato', '🐶': 'perro', '🦄': 'unicornio', '👑': 'reina', '🍒': 'cereza', '🍓': 'frutilla', '🐝': 'abeja', '🌻': 'girasol', '🐼': 'panda', '🦁': 'leon' };
const VACIAS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'soy', 'usuario', 'usuaria', 'user', 'un', 'una', 'que', 'te', 'mi', 'tiktok', 'con']);
// Normaliza nombres de TikTok: emojis a palabra, sin tildes, como suena (z=s, v=b, ll=y, sin h), sin letras repetidas, sin palabras vacías
const normN = (v: any) => {
  let s = String(v || '');
  for (const [e, w] of Object.entries(EMOJI_PAL)) s = s.split(e).join(' ' + w + ' ');
  s = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
  s = s.replace(/z/g, 's').replace(/c([ei])/g, 's$1').replace(/v/g, 'b').replace(/ll/g, 'y').replace(/qu/g, 'k').replace(/c/g, 'k').replace(/h/g, '').replace(/([a-z])\1+/g, '$1');
  return s.split(/\s+/).filter((w) => w && !VACIAS.has(w)).join(' ').trim();
};
function edRatio(sa: string, sb2: string) {
  const m = sa.length, n = sb2.length; if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (sa[i - 1] === sb2[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function parecido(a: string, b: string) {
  a = normN(a); b = normN(b); if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = a.replace(/ /g, ''), sb2 = b.replace(/ /g, '');
  if (sa.length >= 4 && sb2.length >= 4 && (sa.includes(sb2) || sb2.includes(sa))) return 0.9;
  const ta = a.split(' ').filter((x) => x.length >= 4), tb = b.split(' ').filter((x) => x.length >= 4);
  let mejor = edRatio(sa, sb2);
  for (const x of ta) for (const y of tb) { const r = x === y ? 0.9 : edRatio(x, y) * 0.95; if (r > mejor) mejor = r; }
  return mejor;
}
// Si no aparece y hoy hay vivo, puede que el pedido todavía no esté cargado: queda en espera y el repaso (cada 5 min) lo vuelve a buscar.
// 20/11 (D-7): una sola secuencia para el pedido que no aparece.
const NO_ENC = 'No aparece. Si todavía no le preguntaste el usuario de TikTok o el número de pedido, preguntáselo una vez. Si ya lo dijo, pasá a Yanaina (pedido) con lo que dijo.';
async function dejarEnEspera(ctx: Ctx, a: any) {
  const hoy = hoyUY();
  const { data: lv } = await sb.from('lives').select('id,datos').eq('datos->>fecha', hoy).limit(5);
  if (!(lv || []).some((l: any) => !esVentas(l.datos)) || a?.reintento) return null; // 23/11: el registro de ventas del mes no es un vivo
  const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  const buscar = { nombre: String(a?.nombre || ''), num: a?.num || null, confirmar: !!a?.confirmar, hasta: new Date(Date.now() + 3 * 3600e3).toISOString() };
  const datos = { ...(cv?.datos || { id: ctx.telKey, tel: '0' + ctx.telKey, estado: 'agente' }), buscar };
  if (cv) await sb.from('conversaciones').update({ datos }).eq('id', ctx.telKey); else await sb.from('conversaciones').insert({ id: ctx.telKey, datos });
  return { ok: false, no_encontrado: true, en_espera: true, que_hacer: 'Todavía no aparece (puede que lo estén cargando en el vivo). Decile: "Dale bella, apenas aparezca tu pedido te aviso 🫶". No pases a Yanaina ni le vuelvas a pedir el usuario.' };
}
async function limpiarEspera(ctx: Ctx) {
  const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  if (cv?.datos?.buscar) { const d = { ...cv.datos }; delete d.buscar; await sb.from('conversaciones').update({ datos: d }).eq('id', ctx.telKey); }
}
export async function vincularPedido(ctx: Ctx, a: any) {
  const num = parseInt(String(a?.num ?? '').replace(/\D/g, ''), 10) || 0, nombre = String(a?.nombre || '').trim(), prenda = String(a?.prenda || '').trim();
  if (!num && !nombre && !prenda) return { ok: false, que_hacer: 'Pedile el número de pedido o su usuario de TikTok.' };
  const ayer = new Date(Date.now() - 36 * 3600e3).toISOString().slice(0, 10);
  const { data: lvs } = await sb.from('lives').select('id,datos').gte('datos->>fecha', ayer);
  const lids = (lvs || []).map((l: any) => l.id);
  if (!lids.length) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true, que_hacer: NO_ENC };
  const { data: ps } = await sb.from('pedidos').select('*').in('live_id', lids).eq('borrado', false).in('estado', ['pendiente', 'listo']);
  const cids = [...new Set((ps || []).map((p: any) => p.clienta_id))];
  const { data: cls } = cids.length ? await sb.from('clientas').select('*').in('id', cids) : { data: [] as any[] };
  const cl = new Map((cls || []).map((c: any) => [c.id, c]));
  const cand = (ps || []).map((p: any) => {
    const c: any = cl.get(p.clienta_id) || { datos: {} };
    const nombres = [c.datos.nombre, c.datos.nombreEnvio, ...(c.datos.alias || [])].filter(Boolean);
    const sim = nombre ? Math.max(0, ...nombres.map((x: string) => parecido(x, nombre))) : 0;
    return { p, c, sim, porNum: !!num && Number(p.datos.num) === num };
  });
  let elegido: any = null;
  if (num) {
    const xs = cand.filter((x) => x.porNum).sort((x, y) => y.sim - x.sim);
    if (xs.length === 1 && (!nombre || xs[0].sim >= 0.6)) elegido = xs[0];
    else if (xs.length > 1 && nombre && xs[0].sim >= 0.6 && xs[0].sim - (xs[1]?.sim || 0) >= 0.2) elegido = xs[0];
  }
  if (!elegido && nombre) {
    const xs = cand.filter((x) => x.sim >= 0.8).sort((x, y) => y.sim - x.sim);
    // Si hay varias con ese nombre, se descartan las que tienen otro teléfono y, si dijo la prenda, las que no la compraron
    const libres = xs.filter((x) => { const tl = String(x.c.datos.tel || '').replace(/\D/g, ''); return !tl || telKeyDe(tl) === ctx.telKey; });
    const pwN = normN(prenda).split(' ').filter((w) => w.length >= 4);
    const conPrenda = pwN.length ? libres.filter((x) => pwN.some((w) => (x.p.datos.prendas || []).some((pr: any) => normN(pr.nombre).split(' ').some((y) => y === w || edRatio(y, w) >= 0.8)))) : libres;
    if (xs.length === 1 || (xs.length > 1 && xs[0].sim - xs[1].sim >= 0.15)) elegido = xs[0];
    else if (conPrenda.length === 1) elegido = conPrenda[0];
    else if (libres.length === 1) elegido = libres[0];
    else if (xs.length > 1) return derivar(ctx, 'Escribe desde un número sin pedido (' + (nombre || '') + (num ? ', pedido #' + num : '') + '): coincide con varios pedidos: ' + xs.slice(0, 4).map((x) => '#' + x.p.datos.num + ' ' + x.c.datos.nombre).join(', '), 'pedido');
  }
  // Por la prenda que dice que compró, entre los pedidos SIN teléfono (ej. "soy Paola, por el conjunto chocolate")
  if (!elegido && prenda) {
    const pw = normN(prenda).split(' ').filter((w) => w.length >= 4);
    const xs = cand.filter((x) => !String(x.c.datos.tel || '').replace(/\D/g, '') && pw.some((w) => (x.p.datos.prendas || []).some((pr: any) => normN(pr.nombre).split(' ').some((y) => y === w || edRatio(y, w) >= 0.8))));
    const conNombre = nombre ? xs.filter((x) => x.sim >= 0.5) : xs;
    if (conNombre.length === 1) elegido = conNombre[0];
    else if (!nombre && xs.length === 1) elegido = xs[0];
  }
  if (!elegido) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true, que_hacer: NO_ENC };
  const telC = String(elegido.c.datos.tel || '').replace(/\D/g, '');
  if (telC && telKeyDe(telC) === ctx.telKey) { await limpiarEspera(ctx); return { ok: true, ya_vinculado: true, pedido: elegido.p.datos.num, que_hacer: 'Ese pedido ya está a su número.' }; }
  if (telC && telKeyDe(telC) !== ctx.telKey) return derivar(ctx, 'Escribe desde el 0' + ctx.telKey + ' y dice ser ' + (nombre || 'la clienta') + (num ? ' (pedido #' + num + ')' : '') + '. Puede ser el pedido #' + elegido.p.datos.num + ' de ' + elegido.c.datos.nombre + ', pero esa ficha tiene otro teléfono (' + elegido.c.datos.tel + '). Verificar.', 'pedido');
  if (ctx.clienta && ctx.clienta.id !== elegido.c.id) {
    // Este número ya tiene ficha: el pedido pasa a esa ficha y el nombre del live queda como alias
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', elegido.p.id).single();
      const d = { ...r.datos, clienteId: ctx.clienta.id };
      const { error } = await sb.from('pedidos').update({ clienta_id: ctx.clienta.id, datos: d, actualizado: new Date().toISOString() }).eq('id', r.id).eq('actualizado', r.actualizado);
      if (error) throw new Error(error.message);
    });
    await conReintento(async () => {
      const { data: c } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
      const alias = [...new Set([...(c.datos.alias || []), elegido.c.datos.nombre].filter(Boolean))];
      await guardarClienta(c, { ...c.datos, alias });
    });
  } else {
    await conReintento(async () => {
      const { data: c } = await sb.from('clientas').select('*').eq('id', elegido.c.id).single();
      const { data, error } = await sb.from('clientas').update({ tel_key: ctx.telKey, datos: { ...c.datos, tel: '0' + ctx.telKey, telKey: ctx.telKey }, actualizado: new Date().toISOString() }).eq('id', c.id).eq('actualizado', c.actualizado).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('conflicto');
    });
  }
  await cargarClienta(ctx);
  await limpiarEspera(ctx);
  // Si es del vivo de hoy, escribir para identificarse ya cuenta como confirmación (4/11)
  const lvHoy = (lvs || []).find((l: any) => l.id === elegido.p.live_id && l.datos?.fecha === hoyUY());
  if (lvHoy) {
    const rc: any = await confirmarPedido(ctx).catch(() => null);
    return { ok: true, pedido: elegido.p.datos.num, confirmado: !!rc?.ok, que_hacer: 'Quedó con su número y confirmado. Contestá corto: "¡Gracias por confirmar tu pedido bella! 🫶" (con la presentación si es tu primer mensaje). No digas que lo buscaste ni que lo encontraste, y no le pases el total (puede seguir sumando en el vivo).' };
  }
  return { ok: true, pedido: elegido.p.datos.num, nombre_en_el_live: elegido.c.datos.nombre, que_hacer: 'Listo, el pedido quedó con su número. Seguí con lo que pidió (si quería confirmar, llamá confirmar_pedido; si pregunta el total, buscar_pedido).' };
}

// ─── guardar_pedido (3/11) ────────────────────────────────────
// Pagado → Guardado (con pago). Sin pagar → solo si la ficha tiene puedeGuardarSinPagar, hasta 7 días. Si no, Yanaina.
export async function guardarPedidoCli(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'Pide guardar el pedido pero no hay ficha de clienta para este número', 'especial');
  const { filas, cobros } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  if (!objetivo.length) return { ok: true, ya_guardado: true, que_hacer: 'Sus pedidos ya están guardados: confirmale corto que siguen guardados.' };
  const hoy = hoyUY(), max = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const pagos = objetivo.map((r) => pagado(r.datos));
  if (pagos.some((x) => !x) && pagos.some((x) => x)) return derivar(ctx, 'Pide guardar: tiene pedidos pagos y otros sin pagar', 'especial');
  const sinPagar = !pagos[0];
  const { data: cli } = await sb.from('clientas').select('datos').eq('id', ctx.clienta.id).single();
  if (sinPagar && !cli?.datos?.puedeGuardarSinPagar) return derivar(ctx, 'Pide guardar el pedido sin pagar' + (a?.hasta ? ' hasta el ' + a.hasta : '') + ' (no está autorizada a guardar sin pagar)', 'especial');
  let hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(a?.hasta || '')) ? String(a.hasta) : max;
  if (hasta < hoy) hasta = max;
  if (sinPagar && hasta > max) return derivar(ctx, 'Pide guardar sin pagar hasta el ' + hasta + ' (más de 7 días)', 'especial');
  const nums: number[] = [];
  for (const r0 of objetivo) {
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', r0.id).single();
      const p = JSON.parse(JSON.stringify(r.datos));
      p.estado = 'guardado'; p.fechas = p.fechas || {}; p.fechas.guardado = hoy;
      if (sinPagar) p.guardadoSinPagar = { desde: hoy, hasta, porMabel: true };
      const n = '⏸️ Pidió guardarlo' + (a?.hasta ? ' hasta el ' + a.hasta : '') + ' (le dijo a Mabel)';
      p.notas = p.notas ? String(p.notas) + '\n' + n : n;
      await guardarPedido(r, p); nums.push(p.num);
    });
  }
  return { ok: true, pedidos: nums, sin_pagar: sinPagar, ...(sinPagar ? { hasta } : {}), mensaje_de_cierre: sinPagar ? 'Dale bella, te lo guardamos 🫶' : 'Dale bella, te lo guardamos. Cuando quieras que salga, avisanos 🫶' };
}

// ─── confirmar_pedido (3/11) ──────────────────────────────────
// La clienta confirma ("sí", "confirmo mi pedido"): marca confirmado el/los pedidos abiertos del live más reciente (últimos 3 días). No toca pagos.
export async function confirmarPedido(ctx: Ctx) {
  await cargarClienta(ctx);
  const { filas, lives } = await abiertos(ctx);
  const desde = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const cand = filas.filter((r) => r.datos?.estado !== 'guardado' && !r.datos?.guardadoSinPagar && (lives.get(r.live_id)?.fecha || '') >= desde);
  if (!cand.length) return { ok: false, motivo: 'No hay pedido abierto de un live de los últimos 3 días a este número' };
  const ultimo = cand.map((r) => lives.get(r.live_id)?.fecha || '').sort().pop();
  const rs = cand.filter((r) => (lives.get(r.live_id)?.fecha || '') === ultimo);
  const ahora = new Date().toISOString(), nums: number[] = [];
  for (const r0 of rs) {
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', r0.id).single();
      if (!r || r.datos?.confirmado) { if (r) nums.push(r.datos.num); return; }
      await guardarPedido(r, { ...r.datos, confirmado: ahora, confirmadoPor: 'mabel' });
      nums.push(r.datos.num);
    });
  }
  return { ok: true, pedidos_confirmados: nums, live: lives.get(rs[0].live_id)?.nombre || '' };
}

// ─── crear_pedido_web (23/11, Paso 2: catálogo web) ──────────────
// La clienta arma la bolsa en el catálogo y manda por WhatsApp un mensaje con una línea por prenda:
//   "• E142 Vestido lino · talle M · $1.290"  (código de modelo + talle + precio; también vale el código de prenda de 4 cifras).
// Es la ÚNICA excepción a "vendemos solo en los vivos". La herramienta lee el mensaje tal como llegó (ctx.textos, nunca lo que
// transcribe el modelo), revisa el stock en la base, aparta cada prenda con su movimiento (mover_stock, motivo 'venta', ref = pedido)
// y crea el pedido en el registro "Ventas · mes" (live con tipo 'ventas', como ventas.js de Distrito).
// Precio: manda el de la base (si el mensaje dice otro, se avisa). Lo que no tiene stock se informa y sigue con el resto.
// Plazo para pagar: 2 horas; si el pedido llega desde las 21 h (o de madrugada, antes de las 6), hasta las 11 h de la mañana siguiente.
// Si no paga, el pedido queda marcado "para liberar" (vencerPedidosWeb): aviso en Despacho + pendiente en la bandeja. Liberar lo hace el equipo.
// Durante un vivo no se crea (el catálogo está pausado).
export const esVentas = (d: any) => !!(d && d.tipo === 'ventas');
const esNumPrueba = (telKey: string) => /^99000\d{3}$/.test(telKey);
const MESES_V = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Hora actual (el modo prueba puede simularla con ahoraPrueba, solo para el plazo del pedido web). */
export const ahoraMs = () => { const v = pruebaDe('ahoraPrueba'); const t = v ? Date.parse(String(v)) : NaN; return Number.isFinite(t) ? t : Date.now(); };
const partesUY = (ms: number) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { fecha: `${p.year}-${p.month}-${p.day}`, h: +p.hour, mi: +p.minute }; };
const sumarDiaF = (f: string, n = 1) => new Date(new Date(f + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
/** Hasta cuándo paga un pedido web hecho en `ms`. */
export function plazoPedidoWeb(ms: number): number {
  const p = partesUY(ms);
  if (p.h >= 21) return Date.parse(sumarDiaF(p.fecha) + 'T11:00:00-03:00');
  if (p.h < 6) return Date.parse(p.fecha + 'T11:00:00-03:00');
  return ms + 2 * 3600e3;
}
/** "el lunes 23/11 a las 15:40" (nunca "hoy" ni "mañana"). */
export function horaPlazoTxt(iso: any) {
  const t = Date.parse(String(iso || '')); if (!Number.isFinite(t)) return '';
  const p = partesUY(t), d = new Date(p.fecha + 'T12:00:00Z');
  return 'el ' + DIAS_NOM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + ' a las ' + String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0');
}
/** ¿Hay un vivo en curso? Un live de la app con fecha de hoy (o de ayer antes de las 6). El registro de ventas del mes NO es un vivo. */
export async function vivoEnCurso(): Promise<string | null> {
  const pv = pruebaDe('vivoPrueba'); if (pv === true) return hoyUY(); if (pv === false) return null;
  const hoyF = hoyUY(), h = partesUY(Date.now()).h;
  const fechas = [hoyF, ...(h < 6 ? [sumarDiaF(hoyF, -1)] : [])];
  const { data } = await sb.from('lives').select('datos').eq('borrado', false).in('datos->>fecha', fechas);
  return (data || []).filter((l: any) => !esVentas(l.datos)).map((l: any) => l.datos?.fecha).sort().pop() || null;
}
const normTalle = (t: string) => { const x = String(t || '').trim().toUpperCase(); return /^([UÚ]NIC[OA]|U|TU|T\.?U\.?)$/.test(x) ? 'U' : x; };
const plataNum = (v: string) => { const t = String(v || '').replace(/\s/g, ''); const n = /[.,]\d{3}(?!\d)/.test(t) ? t.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.') : t.replace(',', '.'); const r = Math.round(+n); return Number.isFinite(r) && r > 0 ? r : null; };
/** Lee el mensaje del catálogo: una línea por prenda con código, talle y precio. Lo que no se entiende queda en `raras`. */
export function leerMensajeCatalogo(texto: string) {
  const t = String(texto || ''), cabecera = /quiero pedir/i.test(t);
  const lineas: { codigo: string; prenda: boolean; talle: string; precio: number | null; nombre: string; linea: string }[] = [], raras: string[] = [];
  for (const l0 of t.split(/\r?\n/)) {
    const l = l0.trim(); if (!l || /quiero pedir/i.test(l) || /^total\b/i.test(l.replace(/^[^a-z]+/i, ''))) continue;
    const m = l.match(/^[•\-*·▪●◦]*\s*([a-z]{1,3}\.?\s?)?#?(\d{1,6})\b\s*(.*)$/i);
    const tl = l.match(/talle\s*:?\s*([úu]nic[oa]|[a-z0-9]{1,5})\b/i);
    if (m && tl) {
      const pr = l.match(/\$\s*([\d.,]+)/);
      const nombre = m[3].split(/[·|]?\s*talle\b/i)[0].replace(/^[\s·|\-–]+|[\s·|\-–]+$/g, '').slice(0, 60);
      lineas.push({ codigo: m[2], prenda: !m[1] && /^\d{4}$/.test(m[2]), talle: normTalle(tl[1]), precio: pr ? plataNum(pr[1]) : null, nombre, linea: l.slice(0, 120) });
    } else if (/^[•\-*·▪●◦]/.test(l) || /talle|\$/i.test(l)) raras.push(l.slice(0, 120));
  }
  return { lineas, raras, esCatalogo: lineas.length > 0 && (cabecera || lineas.every((x) => x.precio !== null)) };
}
export const pareceCatalogo = (texto: string) => leerMensajeCatalogo(texto).esCatalogo;
const stockNum = (d: any) => { const n = Math.floor(+d?.stock); return Number.isFinite(n) ? n : 0; };
/** Registro "Ventas · mes" (lo crea si no existe). En el modo prueba (099000xxx) es el live propio del número, nunca el real. */
async function registroVentas(telKey: string) {
  const hoy = hoyUY(), ym = hoy.slice(0, 7), ahora = new Date().toISOString();
  if (esNumPrueba(telKey)) {
    const id = 'lbanco-' + telKey;
    const { data: ya } = await sb.from('lives').select('*').eq('id', id).maybeSingle();
    if (ya) return ya;
    const d = { id, tipo: 'ventas', mes: ym, nombre: 'BANCO MABEL (prueba, no tocar)', fecha: hoy, fechaPago: '', fechaPagoISO: '', descuento: 0, pedidoCounter: 0 };
    await sb.from('lives').upsert({ id, nombre: d.nombre, fecha: hoy, datos: d, borrado: false, actualizado: ahora });
    return (await sb.from('lives').select('*').eq('id', id).single()).data;
  }
  const buscar = async () => (await sb.from('lives').select('*').eq('borrado', false).eq('datos->>tipo', 'ventas').eq('datos->>mes', ym).order('actualizado', { ascending: true }).limit(1)).data?.[0] || null;
  const ya = await buscar(); if (ya) return ya;
  const id = 'lventas-' + ym, nombre = 'Ventas · ' + MESES_V[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);
  const d = { id, tipo: 'ventas', mes: ym, nombre, fecha: hoy, fechaPago: '', fechaPagoISO: '', descuento: 0, pedidoCounter: 0 };
  const { error } = await sb.from('lives').upsert({ id, nombre, fecha: hoy, datos: d, borrado: false, actualizado: ahora }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('No se pudo crear el registro de ventas: ' + error.message);
  return await buscar();
}
async function moverUno(stockId: string, cantidad: number, motivo: string, ref: string) {
  const { error } = await sb.rpc('mover_stock', { p_stock: stockId, p_cantidad: cantidad, p_motivo: motivo, p_ref: ref });
  if (error) throw new Error('mover_stock: ' + error.message);
}
export async function crearPedidoWeb(ctx: Ctx, a: any = {}) {
  const textos = (ctx.textos || []).map((x) => String(x || '')).filter((x) => x.trim());
  const texto = textos.find(pareceCatalogo) || textos.join('\n');
  const leido = leerMensajeCatalogo(texto);
  if (!leido.lineas.length) return { ok: false, no_es_catalogo: true, que_hacer: 'Este mensaje no es una lista del catálogo (código, talle y precio por prenda): no se creó ningún pedido. Seguí las reglas de siempre (vendemos solo en los vivos).' };
  const cfg = await leerConfig();
  // Durante un vivo el catálogo está pausado: no se crea el pedido ni se aparta nada.
  const vivo = ctx.vivo !== undefined ? ctx.vivo : !!(await vivoEnCurso()); // atender ya lo calculó (vivoEnCurso)
  if (vivo) return { ok: false, vivo_en_curso: true, que_hacer: 'Ahora hay un vivo y el catálogo está pausado: NO se creó el pedido ni se apartó nada. Decile: "Bella, ahora estamos en vivo y el catálogo está pausado. Conectate al vivo y pedilo ahí, o mandanos el pedido del catálogo cuando termine 🫶" con el link de VIVO. No le pases total ni cuentas.' };
  await cargarClienta(ctx);
  const firma = leido.lineas.map((x) => x.codigo + '|' + x.talle).sort().join(',');
  // Mismo mensaje dos veces (reintento o lo mandó de nuevo): si ya hay un pedido web abierto con esas prendas, es ese.
  const msgId = (ctx.mensajeIds || []).slice(-1)[0] || '';
  if (ctx.clientas.length) {
    const { data: ws } = await sb.from('pedidos').select('*').in('clienta_id', ctx.clientas.map((k) => k.id)).eq('borrado', false).in('estado', ['pendiente', 'listo']).not('datos->web', 'is', null);
    const ya = (ws || []).find((r: any) => (msgId && r.datos.web?.mensaje === msgId) || (r.datos.web?.firma === firma && Date.parse(r.datos.web?.creado || '') > ahoraMs() - 24 * 3600e3));
    if (ya) {
      await cargarModelos([ya]);
      const { total } = calcPedido(ya.datos, null);
      return { ok: true, ya_existia: true, pedido: ya.datos.num, total, pagado: pagado(ya.datos), pagar_hasta: horaPlazoTxt(ya.datos.web.pagarHasta), que_hacer: pagado(ya.datos) ? 'Ese pedido ya está hecho y pagado: no se creó otro. Seguí con la entrega si falta.' : 'Ese pedido ya estaba hecho: no se creó otro ni se apartó nada de nuevo. Recordale el total por transferencia y hasta cuándo paga, sin repetir todo el detalle.' };
    }
  }
  // Prendas: código de prenda de 4 cifras (una fila de stock) o número de modelo + talle.
  const cods4 = [...new Set(leido.lineas.filter((x) => x.prenda).map((x) => x.codigo))]; // "E12" es siempre modelo; 4 cifras sin letra, código de prenda
  const nums = [...new Set(leido.lineas.map((x) => +x.codigo).filter((n) => n > 0))];
  const { data: mds } = await sb.from('modelos').select('id,num,datos').in('num', nums).eq('borrado', false);
  const modelos = new Map<string, any>((mds || []).map((m: any) => [m.id, m]));
  const { data: s1 } = cods4.length ? await sb.from('stock').select('id,codigo,datos').in('codigo', cods4).eq('borrado', false) : { data: [] as any[] };
  const { data: s2 } = modelos.size ? await sb.from('stock').select('id,codigo,datos').in('datos->>modeloId', [...modelos.keys()]).eq('borrado', false) : { data: [] as any[] };
  const filasStock = new Map<string, any>([...(s1 || []), ...(s2 || [])].map((s: any) => [s.id, s]));
  const faltaMd = [...new Set([...(s1 || [])].map((s: any) => s.datos?.modeloId).filter((id: string) => id && !modelos.has(id)))];
  if (faltaMd.length) { const { data: m2 } = await sb.from('modelos').select('id,num,datos').in('id', faltaMd); (m2 || []).forEach((m: any) => modelos.set(m.id, m)); }
  const grupos = new Map<string, { fila: any; modelo: any; qty: number; precioDicho: number | null; linea: string }>();
  const noExisten: string[] = [];
  for (const x of leido.lineas) {
    let fila: any = null;
    if (x.prenda) fila = (s1 || []).find((s: any) => s.codigo === x.codigo) || null;
    if (!fila) {
      const md = (mds || []).find((m: any) => +m.num === +x.codigo);
      if (md) fila = [...filasStock.values()].find((s: any) => s.datos?.modeloId === md.id && normTalle(s.datos?.talle) === x.talle) || null;
    }
    if (!fila) { noExisten.push(x.linea); continue; }
    const g = grupos.get(fila.id);
    if (g) g.qty++; else grupos.set(fila.id, { fila, modelo: modelos.get(fila.datos?.modeloId) || null, qty: 1, precioDicho: x.precio, linea: x.linea });
  }
  const nombreDe = (g: any) => String(g.fila.datos?.descripcion || g.modelo?.datos?.nombre || g.linea).slice(0, 60);
  const sinRef = { no_existen: noExisten, no_entendidas: leido.raras };
  if (!grupos.size) return { ok: false, nada_valido: true, ...sinRef, que_hacer: 'Ninguna prenda del mensaje coincide con el catálogo (código o talle que no existe): no se creó pedido. Decile que no encontramos esas prendas y que las vuelva a elegir desde el catálogo (sin cambiar el mensaje). No pases a Yanaina.' };
  // Apartar: un movimiento por prenda. Si en el medio se vendió (vivo, mostrador), la base compensa con 'sin_stock' y esa unidad no entra.
  const pid = esNumPrueba(ctx.telKey) ? 'pw' + ctx.telKey + '-' + Date.now().toString(36) : uid('p');
  const apartadas = new Map<string, number>(), noQuedan: { prenda: string; pedidas: number; quedaban: number }[] = [];
  const devolver = async () => { for (const [sid, n] of apartadas) for (let k = 0; k < n; k++) await moverUno(sid, 1, 'devolucion', pid).catch((e) => console.error('pedido web (devolver):', e.message)); };
  try {
    for (const [sid, g] of grupos) {
      const activa = g.fila.datos?.activo !== false && g.modelo?.datos?.activo !== false;
      const hay = activa ? Math.max(0, stockNum(g.fila.datos)) : 0;
      const n = Math.min(g.qty, hay);
      for (let k = 0; k < n; k++) {
        const sim = pruebaDe('ventaSimultanea'); // modo prueba: el vivo vende esa prenda justo antes de apartarla
        if (sim && k === 0 && (String(sim) === sid || String(sim) === String(g.fila.codigo))) await moverUno(sid, -1, 'venta', 'prueba-vivo-' + pid);
        await moverUno(sid, -1, 'venta', pid);
      }
      let ok = n;
      if (n) {
        const { data: mv } = await sb.from('movimientos').select('id').eq('ref', pid).eq('stock_id', sid).eq('motivo', 'venta');
        const ids = (mv || []).map((m: any) => m.id + '-sin');
        const { data: sin } = ids.length ? await sb.from('movimientos').select('id').in('id', ids) : { data: [] as any[] };
        ok = Math.max(0, n - (sin || []).length);
      }
      if (ok) apartadas.set(sid, ok);
      if (ok < g.qty) noQuedan.push({ prenda: nombreDe(g), pedidas: g.qty, quedaban: ok });
    }
  } catch (e) {
    await devolver();
    console.error('pedido web (apartar):', (e as Error).message);
    return derivar(ctx, 'Pedido del catálogo web: no se pudo apartar el stock (' + String((e as Error).message).slice(0, 80) + ')', 'pedido');
  }
  const baseNoQueda = { ...sinRef, no_quedan: noQuedan };
  if (!apartadas.size) return { ok: false, nada_con_stock: true, ...baseNoQueda, que_hacer: 'No queda ninguna de las prendas que pidió (se vendieron): no se creó pedido. Decíselo con tacto, nombrando las prendas, y que puede elegir otras en el catálogo. No pases a Yanaina.' };
  // Clienta: la de este número o una ficha nueva.
  try {
    if (!ctx.clienta) {
      const ahora = new Date().toISOString(), id = esNumPrueba(ctx.telKey) ? 'cb' + ctx.telKey : uid('c');
      const datos = { id, nombre: 'Web 0' + ctx.telKey, ref: 'catálogo web', alias: [], tel: '0' + ctx.telKey, telKey: ctx.telKey, nombreEnvio: '', ci: '', agencia: '', depto: '', ciudad: '', direccion: '', barrio: '', notaCadete: '', saldoFavor: 0, historialViejo: [], ultimoUso: ahora, creado: ahora, origen: 'catalogo' };
      const { error } = await sb.from('clientas').insert({ id, nombre: datos.nombre, tel_key: ctx.telKey, datos, borrado: false, actualizado: ahora });
      if (error) throw new Error('ficha: ' + error.message);
      await cargarClienta(ctx);
    }
    const c = ctx.clienta;
    const live = await registroVentas(ctx.telKey);
    if (!live) throw new Error('sin registro de ventas');
    const ahoraT = ahoraMs(), hasta = new Date(plazoPedidoWeb(ahoraT)).toISOString(), hoy = hoyUY();
    const prendas = [...apartadas].map(([sid, qty]) => {
      const g = grupos.get(sid)!, lista = Math.round(+g.fila.datos?.precioVenta || +g.modelo?.datos?.precioVenta || 0) || (g.precioDicho || 0);
      return { stockId: sid, codigo: g.fila.codigo || g.fila.datos?.codigo || null, nombre: nombreDe(g), precioLista: lista, precio: lista, qty };
    });
    const precioDistinto = [...apartadas.keys()].map((sid) => { const g = grupos.get(sid)!, pr = prendas.find((x) => x.stockId === sid)!; return g.precioDicho && g.precioDicho !== pr.precio ? { prenda: pr.nombre, en_el_mensaje: g.precioDicho, precio_real: pr.precio } : null; }).filter(Boolean);
    // Promos que valen hoy para esas prendas y % VIP (igual que refrescarPromos de la app)
    const mids = new Set(prendas.map((x) => grupos.get(x.stockId)?.fila.datos?.modeloId).filter(Boolean));
    const { data: prs } = await sb.from('promos').select('datos').eq('borrado', false);
    const promos = (prs || []).map((x: any) => x.datos).filter((x: any) => x && x.activa !== false && !x.borrado && !x.liveId && !(x.desde && hoy < x.desde) && !(x.hasta && hoy > x.hasta) && (x.modelos || []).some((m: string) => mids.has(m)));
    const vipPct = c.datos?.vip ? Math.max(0, cfg.vipPct === undefined || cfg.vipPct === null || cfg.vipPct === '' ? 5 : +cfg.vipPct || 0) : 0;
    const modeloDe = (id: string) => grupos.get(id)?.fila.datos?.modeloId || MODELO_DE.get(id);
    const p: any = { id: pid, codigo: '', num: 0, liveId: live.id, clienteId: c.id, prendas, descuento: null, saldoAplicado: 0, estado: 'pendiente', entrega: c.datos?.agencia ? 'agencia' : 'sin_definir', cobroEnvio: null,
      fechas: { creado: hoy }, avisos: [], notas: '🛒 Pedido del catálogo web (lo cargó Mabel). Paga ' + horaPlazoTxt(hasta), promoCalc: { fecha: hoy, promos, vipPct },
      web: { mensaje: msgId, firma, creado: new Date(ahoraT).toISOString(), pagarHasta: hasta, texto: texto.slice(0, 600) } };
    // Saldo a favor (como recalcSaldo de la app)
    const sub = calcPedido(p, live, modeloDe).total, saldo = Math.max(0, num(c.datos?.saldoFavor));
    const ap = Math.min(saldo, sub);
    if (ap > 0) { await conReintento(async () => { const { data } = await sb.from('clientas').select('*').eq('id', c.id).single(); const disp = Math.max(0, num(data.datos.saldoFavor)); p.saldoAplicado = Math.min(disp, sub); await guardarClienta(data, { ...data.datos, saldoFavor: disp - p.saldoAplicado }); }); }
    // Número del pedido en el registro y código de 5 cifras, sin repetir (si choca con otro equipo, se prueba el siguiente)
    const { data: un } = await sb.from('pedidos').select('num').eq('live_id', live.id).order('num', { ascending: false }).limit(1);
    let n = Math.max(+(un?.[0]?.num) || 0, +live.datos?.pedidoCounter || 0) + 1;
    const { data: uc } = await sb.from('pedidos').select('codigo').gte('codigo', '00000').lte('codigo', '99999').order('codigo', { ascending: false }).limit(1);
    let cod = Math.max(parseInt(uc?.[0]?.codigo, 10) || 0, +cfg.codigoCounter || 0) + 1;
    let creado = false;
    for (let i = 0; i < 6 && !creado; i++, n++, cod++) {
      p.num = n; p.codigo = esNumPrueba(ctx.telKey) ? 'W' + ctx.telKey.slice(-3) + n : String(cod).padStart(5, '0');
      const { error } = await sb.from('pedidos').insert({ id: pid, live_id: live.id, clienta_id: c.id, num: p.num, codigo: p.codigo, estado: 'pendiente', entrega: p.entrega, datos: p, borrado: false, actualizado: new Date().toISOString() });
      if (!error) creado = true; else if (error.code !== '23505') throw new Error('pedido: ' + error.message);
    }
    if (!creado) throw new Error('pedido: número repetido');
    if ((+live.datos?.pedidoCounter || 0) < p.num) await sb.from('lives').update({ datos: { ...live.datos, pedidoCounter: p.num }, actualizado: new Date().toISOString() }).eq('id', live.id).eq('actualizado', live.actualizado);
    const { total, detalle } = calcPedido(p, live, modeloDe), mp = mpDe(cfg);
    if (prendas.some((x) => !(+grupos.get(x.stockId)?.fila.datos?.precioVenta || +grupos.get(x.stockId)?.modelo?.datos?.precioVenta))) await registrarDerivado(ctx.telKey, c, `Pedido web #${p.num}: hay prendas sin precio en la base (se usó el del mensaje). Revisar el total`, 'pedido', true, 'mabel', ctx.inicio);
    return {
      ok: true, pedido: p.num, prendas: prendas.map((x) => ({ prenda: x.nombre, cantidad: x.qty, precio: x.precio })), total, detalle_del_total: detalle,
      mercado_pago: esperadoDe(total, 0, 'Mercado Pago', mp).total, pagar_hasta: horaPlazoTxt(hasta), ...baseNoQueda, precio_distinto: precioDistinto,
      que_hacer: 'Pedido creado y prendas apartadas. En UN mensaje: ' + (noQuedan.length || noExisten.length ? 'primero, con tacto, lo que no entró (no_quedan: se vendieron; no_existen: no las encontramos en el catálogo); ' : '')
        + (precioDistinto.length ? 'que el precio de esa prenda es el del catálogo (precio_real), sin discutir; ' : '')
        + (leido.raras.length ? 'que lo que escribió aparte (no_entendidas) no entra: se pide eligiendo en el catálogo; ' : '')
        + 'el total por transferencia (total), que tiene para pagar hasta ' + horaPlazoTxt(hasta) + ' y que si no, la ropa se libera; y las cuentas tal cual FORMAS DE PAGO. Mercado Pago (con recargo) solo si lo pide. No preguntes la entrega todavía: la pedís cuando mande el comprobante. No digas número de pedido ni nombres de herramientas.',
    };
  } catch (e) {
    await devolver();
    console.error('pedido web (crear):', (e as Error).message);
    return derivar(ctx, 'Pedido del catálogo web: no se pudo crear (' + String((e as Error).message).slice(0, 80) + ')', 'pedido');
  }
}
/** Pedidos web sin pagar con el plazo vencido: se marcan "para liberar" (aviso en Despacho + pendiente en la bandeja). No se libera solo. */
const AVISO_VENCIDO = '⏳ Web sin pagar: venció el plazo, para liberar';
export async function vencerPedidosWeb(cids?: string[]) {
  if (cids && !cids.length) return 0;
  let q = sb.from('pedidos').select('*').eq('borrado', false).eq('estado', 'pendiente').not('datos->web', 'is', null);
  if (cids) q = q.in('clienta_id', cids);
  const { data } = await q.limit(200);
  const ahora = ahoraMs(); let n = 0;
  for (const r of data || []) {
    const p = r.datos;
    if (pagado(p) || p.pagaAlRetirar || p.web?.vencido || !p.web?.pagarHasta || Date.parse(p.web.pagarHasta) >= ahora) continue;
    try {
      const d = JSON.parse(JSON.stringify(p)); d.web.vencido = new Date(ahora).toISOString();
      d.avisoDespacho = [AVISO_VENCIDO, ...String(d.avisoDespacho || '').split(' · ').map((t: string) => t.trim()).filter((t: string) => t && t !== AVISO_VENCIDO)].join(' · ').slice(0, 200);
      await guardarPedido(r, d);
      const { data: cl } = await sb.from('clientas').select('*').eq('id', r.clienta_id).maybeSingle();
      const tk = cl?.tel_key || telKeyDe(cl?.datos?.tel || '');
      if (tk) await registrarDerivado(tk, cl, `Pedido web #${p.num} sin pagar: venció el plazo (${horaPlazoTxt(p.web.pagarHasta)}). Para liberar (la ropa vuelve al stock) o aplazar`, 'pago', true, 'regla');
      n++;
    } catch (e) { console.error('pedido web (vencer):', (e as Error).message || e); }
  }
  return n;
}

// ─── Definición de herramientas para la API de Claude ─────────────
export const HERRAMIENTAS = [
  { name: 'buscar_pedido', description: 'Refresca el ESTADO ACTUAL de la clienta (pedidos abiertos, totales, entrega guardada, nota). Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'marcar_pagado', description: 'Registra el pago del comprobante que mandó la clienta (sin comprobante no marca nada). Calcula lo esperado y la diferencia y dice qué hacer; si no cierra, deriva sola a Yanaina.', input_schema: { type: 'object', properties: {
    cuenta: { type: 'string', description: 'Cuenta de Emma de destino: BROU, Prex, Mi Dinero, OCA, Mercado Pago, o PREX YOAN si es una Prex a nombre de Yoan Piedad' },
    monto: { type: 'number', description: 'Monto del comprobante, en pesos' },
    fecha_comprobante: { type: 'string', description: 'Fecha del comprobante AAAA-MM-DD, si se lee' },
    destino_coincide: { type: 'boolean', description: 'false si el destino no es ninguna cuenta de las FORMAS DE PAGO ni PREX YOAN' },
    destino: { type: 'string', description: 'Cuenta o número de destino tal como se lee' }, titular_destino: { type: 'string', description: 'Titular de destino tal como se lee' },
    banco: { type: 'string', description: 'Banco o app del comprobante' }, ordenante: { type: 'string', description: 'Nombre de quien transfirió, si se lee' },
    hora_comprobante: { type: 'string', description: 'Hora del comprobante HH:MM, si se lee' }, numero_operacion: { type: 'string', description: 'Número de operación o referencia, si se lee' },
    nota: { type: 'string', description: 'Nota corta opcional' } }, required: ['cuenta', 'monto', 'destino_coincide'] } },
  { name: 'guardar_entrega', description: 'Carga cómo recibe el pedido (retiro, cadeteria en Montevideo o agencia) en todos sus pedidos abiertos. Se puede llamar sin barrio o sin nombre: queda cargada y dice qué preguntar.', input_schema: { type: 'object', properties: {
    tipo: { type: 'string', enum: ['retiro', 'cadeteria', 'agencia'] },
    direccion: { type: 'string', description: 'Cadetería: dirección' }, barrio: { type: 'string', description: 'Cadetería: barrio tal como lo dijo' },
    nota_cadete: { type: 'string', description: 'Cadetería: solo referencias para llegar o el horario de entrega' }, nota_interna: { type: 'string', description: 'Nota para el equipo sobre este pedido (no la ve el cadete)' }, etiqueta: { type: 'string', description: 'Cadetería: casa, trabajo, mamá… si lo dijo' }, con_cambio: { type: 'boolean', description: 'Cadetería: true si el cadete además lleva o retira un cambio' },
    envio_transferido: { type: 'number', description: 'Cadetería: cuánto del envío ya transfirió (0 si lo paga al cadete). Solo cuenta si sobra en un pago ya registrado' },
    agencia: { type: 'string' }, ciudad: { type: 'string' }, departamento: { type: 'string' }, ci: { type: 'string', description: 'C.I. de quien retira en la agencia' },
    nombre_retira: { type: 'string', description: 'Nombre y apellido de quien recibe o retira (agencia: obligatorio, salvo que ya esté en datos_guardados.nombre_envio)' }, horario_retiro: { type: 'string', description: 'Retiro: cuándo dice que pasa, con día y fecha (ej. "sábado 21/11 a las 18")' }, retiro_fecha: { type: 'string', description: 'Retiro: fecha del día que pasa, AAAA-MM-DD, sacada de HOY. Pasala siempre que diga un día' }, retiro_hora: { type: 'string', description: 'Retiro: hora aproximada, HH:MM en 24 hs' } }, required: ['tipo'] } },
  { name: 'dejar_aviso_despacho', description: 'Aviso de una línea para quien arma el paquete en Despacho (paquete de Yharol para mandar junto, lo retira otra persona…). Va en sus pedidos abiertos.', input_schema: { type: 'object', properties: { texto: { type: 'string', description: 'Ej: "Tiene paquete de Yharol: enviar junto"' } }, required: ['texto'] } },
  { name: 'vincular_pedido', description: 'Busca en los vivos de hoy y ayer el pedido de una clienta que escribe desde un número sin pedido y le pone este número.', input_schema: { type: 'object', properties: { num: { type: 'number', description: 'Número de pedido si lo dijo' }, nombre: { type: 'string', description: 'Nombre o usuario de TikTok tal como lo escribió' }, confirmar: { type: 'boolean', description: 'true si estaba confirmando el pedido' }, prenda: { type: 'string', description: 'Lo que dice que compró, si lo dijo' } } } },
  { name: 'guardar_pedido', description: 'Guarda el pedido (que no salga todavía). Decide sola si se puede; si no, avisa a Yanaina.', input_schema: { type: 'object', properties: { hasta: { type: 'string', description: 'AAAA-MM-DD, solo si dijo una fecha' } } } },
  { name: 'confirmar_pedido', description: 'Marca confirmados sus pedidos del vivo más reciente (últimos 3 días). Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'pasar_a_yanaina', description: 'Deja la conversación para Yanaina con el motivo en una línea. Devuelve la frase para la clienta.', input_schema: { type: 'object', properties: { motivo: { type: 'string' }, categoria: { type: 'string', enum: CATEGORIAS, description: 'Obligatoria. pedido = problema con el pedido (desconoce la compra, prenda de más o de menos, mal anotado, reclamo, cancelar o sacar una prenda, número sin pedido que no se pudo vincular) · pago = comprobantes, faltantes, plazo para pagar, pedidos viejos sin marcar pago · entrega = cadetería, agencia, retiro, día de salida, juntar paquetes · cambio = cambio de talle o de prenda · especial = pide algo aparte que no podés resolver (guardar sin pagar, avisar cuando haya algo) · yharol = emprendimiento de Yharol · otros = no entra en ninguna. Si hay más de un tema, el que frena el pedido.' }, en_silencio: { type: 'boolean', description: 'true = no se le escribe a la clienta. Para cambios y pedidos anteriores a Mabel; en lo demás lo controla la herramienta.' }, con_frase_propia: { type: 'boolean', description: 'true si ya le dijiste la frase propia del caso: no devuelve frase de pase' } }, required: ['motivo', 'categoria'] } },
  { name: 'crear_pedido_web', description: 'SOLO para un mensaje del catálogo web (lista de prendas con código, talle y precio). Lee el mensaje tal como llegó, revisa stock, aparta las prendas y crea el pedido. Devuelve total, plazo y qué no queda. Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'actualizar_nota', description: 'Reescribe la nota de la clienta: máximo 3 líneas, solo hechos con fecha, sin opiniones ni datos sensibles.', input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
];

export async function ejecutar(name: string, input: any, ctx: Ctx) {
  ctx.llamadas.push(name);
  switch (name) {
    case 'buscar_pedido': return await buscarPedido(ctx);
    case 'marcar_pagado': return await marcarPagado(ctx, input || {});
    case 'guardar_entrega': return await guardarEntrega(ctx, input || {});
    case 'confirmar_pedido': return await confirmarPedido(ctx);
    case 'dejar_aviso_despacho': return await dejarAvisoDespacho(ctx, input || {});
    case 'vincular_pedido': return await vincularPedido(ctx, input || {});
    case 'guardar_pedido': return await guardarPedidoCli(ctx, input || {});
    case 'pasar_a_yanaina': return await pasarAYanaina(ctx, input?.motivo, !!input?.en_silencio, CATEGORIAS.includes(String(input?.categoria)) ? String(input.categoria) : categoriaDe(input?.motivo), !!input?.con_frase_propia);
    case 'actualizar_nota': return await actualizarNota(ctx, input?.texto);
    case 'crear_pedido_web': return await crearPedidoWeb(ctx, input || {});
    default: return { error: 'Herramienta desconocida' };
  }
}
// 5/11: horarios de retiro por fecha (cargados en la app, Config → Mabel). Siempre con la fecha real, nunca "hoy/mañana" sueltos.
export function horariosRetiroTexto(c: any) {
  const hoy = hoyUY(), dia = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  const hs = (Array.isArray(c.horariosRetiro) ? c.horariosRetiro : []).filter((x: any) => x?.fecha >= hoy && !sinSalida(c, x.fecha, 'retiro')).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)).slice(0, 14);
  if (!hs.length) return 'HORARIOS DE RETIRO: no hay ninguno cargado. No des horario: "Dale bella, escribinos un día antes para coordinar".';
  return 'HORARIOS DE RETIRO CARGADOS (decí siempre el día con nombre y fecha): ' + hs.map((x: any) => (x.fecha === hoy ? 'HOY ' : '') + dia(x.fecha) + ': ' + (x.cerrado ? 'sin retiro' : 'de ' + x.desde + ' a ' + x.hasta + ' hs')).join('; ') + '. Para un día que no está en la lista no des horario: "Dale bella, escribinos un día antes para coordinar".';
}
