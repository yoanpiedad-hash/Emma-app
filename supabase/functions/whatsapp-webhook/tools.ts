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
const medioDe = (c: string) => /mercado\s*pago/i.test(c || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(c || '') ? 'efectivo' : 'transferencia';
const esHabitual = (a: string) => /^(dac|nu[nñ]ez|correo)/.test(normB(a));

export type Ctx = { telKey: string; wa: string; clienta: any | null; clientas: any[]; media: { path: string; sha256: string; mime: string } | null; llamadas: string[]; derivado?: boolean };

// ─── Config ───────────────────────────────────────────────────────
export async function leerConfig(): Promise<Record<string, any>> {
  const { data } = await sb.from('config').select('clave,valor');
  const o: Record<string, any> = {};
  for (const r of data || []) o[r.clave] = r.valor;
  return o;
}
const num = (v: any, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
export const tarifaDe = (c: any) => num(c.tarifaEnvio, 250) || 250;
export const mpDe = (c: any) => (c.mpRecargo === undefined || c.mpRecargo === null || c.mpRecargo === '') ? 10 : Math.max(0, num(c.mpRecargo, 10));
const cuentasDe = (c: any): string[] => Array.isArray(c.cuentasPago) && c.cuentasPago.length ? c.cuentasPago : CUENTAS_DEF;
export const novedadesVigentes = (c: any) => { const n = c.novedadesHoy; return n && n.texto && (!n.vence || n.vence >= hoyUY()) ? n : null; };

// ─── Reglas de la app ───────────────────────────────────────────
const pagado = (p: any) => !!p.cambio || !!p.pago || p.estado === 'listo';
const entregaEf = (p: any, cli: any) => (p.entrega && p.entrega !== 'sin_definir') ? p.entrega : (cli && cli.datos?.agencia ? 'agencia' : (p.entrega || 'sin_definir'));
function calcTotal(p: any, live: any): number {
  let bruto = 0;
  for (const pr of p.prendas || []) bruto += (+pr.precio || 0) * (pr.qty || 1);
  const d = (p.descuento !== null && p.descuento !== undefined && p.descuento !== '') ? +p.descuento : (+(live?.datos?.descuento) || 0);
  const sub = bruto - Math.round(bruto * d / 100);
  return sub - Math.min(p.saldoAplicado || 0, sub);
}
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
  const { filas, lives, cobros } = await abiertos(ctx);
  const tar = tarifaDe(cfg), mp = mpDe(cfg);
  // 5/11: pedidos de lives anteriores a la activación de Mabel (4/11) que figuran sin pagar: puede ser que estén pagados y no marcados. No se piden comprobantes: se busca en el historial y, si no se puede confirmar, queda para Yanaina en silencio.
  const anteriores = new Set<string>();
  const evidencia: Record<string, any> = {};
  for (const r of filas) {
    const live0 = lives.get(r.live_id);
    if (live0?.fecha && String(live0.fecha) < '2026-11-04' && !pagado(r.datos) && r.datos.estado === 'pendiente') {
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
    const total = calcTotal(p, live);
    return {
      ...(anteriores.has(r.id) ? { anterior_a_mabel_sin_marcar_pago: true, indicio_en_historial: evidencia[r.id] || null, aviso: 'NO le pidas comprobante de este pedido y no le digas que lo debe: puede estar pagado y sin marcar. Si hace falta, pasalo a Yanaina en silencio.' } : {}),
      numero: p.num, live: live?.nombre || '', fecha_live: live?.fecha || null, fecha_pago: live?.datos?.fechaPagoISO || null, total, estado: p.estado, estado_pago: estadoPago(p, c),
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
    const sumarDia = (f: string) => new Date(new Date(f + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10);
    enviados_recientes = (en || []).map((r) => {
      const p = r.datos, f = p.fechas?.enviado || p.fechas?.listo || null;
      const dias = f ? Math.floor((hoyMs - new Date(f + 'T12:00:00-03:00').getTime()) / 864e5) : null;
      const desdeMs = f ? new Date(f + 'T00:00:00-03:00').getTime() : 0;
      const hayFoto = fotosEquipo.some((x) => new Date(x).getTime() >= desdeMs);
      const confirmada = hayFoto || (dias !== null && dias > 5);
      const esperada = p.fechas?.listo ? sumarDia(p.fechas.listo) : (f ? sumarDia(f) : null);
      const vencida = !!esperada && (hoyF > esperada || (hoyF === esperada && horaUY >= 12));
      return { numero: p.num, etiqueta_impresa_el: f, dias_desde_la_etiqueta: dias, entrega: entregaEf(p, c), prendas: (p.prendas || []).map((x: any) => x.nombre).filter(Boolean), salida_confirmada: confirmada, ...(confirmada ? {} : { fecha_esperada_de_salida: esperada, fecha_esperada_vencida: vencida, que_decir: vencida ? 'Todavía no figura el comprobante de envío y ya pasó la fecha esperada: decile "Tu pedido ya está pronto para despachar, te paso con Yanaina para que te diga con exactitud" y pasá a Yanaina. NO digas que ya salió.' : 'Todavía no figura el comprobante de envío: NO digas que ya salió; decile que sale en la fecha esperada.' }) };
    }).filter((x) => x.dias_desde_la_etiqueta !== null && (x.dias_desde_la_etiqueta as number) <= 21).sort((a, b) => (a.dias_desde_la_etiqueta as number) - (b.dias_desde_la_etiqueta as number));
  }
  return {
    enviados_recientes,
    clienta_encontrada: !!c,
    nota_de_la_clienta: c?.datos?.notaMabel || '',
    datos_guardados: c ? { direccion: c.datos.direccion || '', barrio: c.datos.barrio || '', agencia: c.datos.agencia || '', ciudad: c.datos.ciudad || '', departamento: c.datos.depto || '', nombre_envio: c.datos.nombreEnvio || '', ci: c.datos.ci || '', nota_cadete: c.datos.notaCadete || '', otras_direcciones: (c.datos.direcciones || []).filter((x: any) => normD(x.direccion) !== normD(c.datos.direccion)).map((x: any) => ({ direccion: x.direccion, barrio: x.barrio || '', etiqueta: x.etiqueta || '' })), puede_guardar_sin_pagar: !!c.datos.puedeGuardarSinPagar } : null,
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
export async function pasarAYanaina(ctx: Ctx, motivo: string, silencio = false) {
  // 4/11: cuando deriva Mabel, la conversación vuelve sola a Mabel en 1 hora (si Yanaina contesta desde el celu, el eco la deja más tiempo)
  const ahora = new Date(), hasta = new Date(ahora.getTime() + 1 * 3600e3);
  const c = ctx.clienta;
  const { data: prevCv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  const prev = prevCv?.datos || {};
  const datos = { id: ctx.telKey, tel: c?.datos?.tel || '0' + ctx.telKey, clienteId: c?.id || null, estado: 'yanaina', motivo: String(motivo || 'Sin motivo').slice(0, 200), desde: ahora.toISOString(), hasta: hasta.toISOString() , derivadoEn: ahora.toISOString(), derivadoAntes: prev.derivadoEn || null, ...(silencio ? { silencio: true } : {}), ...(prev.repaso ? { repaso: prev.repaso } : {}), ...(prev.buscar ? { buscar: prev.buscar } : {}) };
  const { error } = await sb.from('conversaciones').upsert({ id: ctx.telKey, datos, borrado: false, actualizado: ahora.toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  ctx.derivado = true;
  if (silencio) return { ok: true, derivado: true, en_silencio: true, instruccion: 'Quedó para Yanaina en silencio: NO le escribas nada a la clienta sobre esto (ni "le aviso a Yanaina").' };
  return { ok: true, derivado: true, mensaje_para_la_clienta: 'Ya le aviso a Yanaina y te escribe enseguida 🫶' };
}

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
export async function marcarPagado(ctx: Ctx, a: { cuenta: string; monto: number; fecha_comprobante?: string; destino_coincide?: boolean; nota?: string }) {
  const cfg = await leerConfig(), tar = tarifaDe(cfg), mp = mpDe(cfg);
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (llegó un comprobante)');
  const cuentas = cuentasDe(cfg).filter((x) => medioDe(x) !== 'efectivo');
  const cuenta = cuentas.find((x) => normB(x) === normB(a.cuenta));
  const monto = Math.round(num(a.monto));
  if (a.destino_coincide === false) return derivar(ctx, 'El comprobante va a una cuenta que no es de Emma');
  if (!cuenta) return derivar(ctx, `Cuenta "${a.cuenta}" no reconocida en el comprobante`);
  if (!(monto > 0)) return { error: 'Falta el monto del comprobante: pedile que lo mande de nuevo, más claro.' };

  const { filas, lives, cobros } = await abiertos(ctx);
  let objetivo: any[], envCobro = 0, cobro: any = null;
  if (cobros.length) {
    cobro = cobros[0];
    objetivo = filas.filter((r) => (cobro.datos.pedidos || []).includes(r.id) && !pagado(r.datos));
    envCobro = +cobro.datos.envio || 0;
  } else {
    const sp = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente');
    objetivo = sp;
    if (sp.length > 1) {
      // 4/11: varios pedidos sin pagar y sin cobro agrupado: si el monto cierra con el del último live, o con todos juntos, se marca eso
      const ult = [...sp].sort((x, y) => String(lives.get(y.live_id)?.fecha || '').localeCompare(String(lives.get(x.live_id)?.fecha || '')) || (y.datos.num - x.datos.num))[0];
      const cierra = (ps: any[]) => { const b = ps.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0); return [b, b + tar, Math.round(b * (1 + mp / 100)), Math.round((b + tar) * (1 + mp / 100))].some((e) => monto >= e - 2 && monto <= e + 30); };
      if (cierra([ult])) objetivo = [ult];
      else if (cierra(sp)) objetivo = sp;
      else return derivar(ctx, `Tiene ${sp.length} pedidos sin pagar (${sp.map((r) => '#' + r.datos.num).join(', ')}) y el comprobante de $${monto} no coincide ni con el último ni con todos juntos`);
    }
  }
  if (!objetivo.length) return { error: 'No hay ningún pedido sin pagar para marcar. Si dice que ya pagó, pasalo a Yanaina.' };

  // Fecha del comprobante vs fecha del live
  const f = String(a.fecha_comprobante || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const fl = objetivo.map((r) => lives.get(r.live_id)?.fecha).filter(Boolean).sort()[0];
    if (fl && f < String(fl).slice(0, 10)) return derivar(ctx, `Comprobante de fecha ${f}, anterior al live (${String(fl).slice(0, 10)})`);
  }
  // Comprobante ya usado
  if (ctx.media?.sha256) {
    const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', ctx.media.sha256).limit(1);
    if (dup?.length) return derivar(ctx, 'Ese comprobante ya figura en otro pago');
  }
  // Esperado (sin cadetería, salvo cobro agrupado que ya la trae) y faltante
  const base = objetivo.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  const esp = esperadoDe(base, envCobro, cuenta, mp);
  if (monto < esp.total) return derivar(ctx, `Transfirió de menos (faltan $${esp.total - monto}) · esperado $${esp.total}, transfirió $${monto} por ${cuenta}`);

  // Registrar (misma lógica que registrarPagos de la app)
  const ajuste = monto - esp.total;
  const res = await conReintento(async () => {
    const frescas: any[] = [];
    for (const r of objetivo) { const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single(); frescas.push(data); }
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
  return {
    ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste,
    que_hacer: ajuste <= 30 ? 'Es redondeo o exacto: no digas nada de la diferencia. Seguí con cómo recibe el pedido.'
      : ajuste === tar ? `Sobran justo $${tar}: preguntale "¿los $${tar} de más son para la cadetería?". Si dice que sí, guardá la entrega con tipo cadetería y envio_transferido=${tar}.`
      : `Sobran $${ajuste}: preguntale por qué ("Vi que transferiste $${monto} y era $${esp.total}, ¿es por algo en especial?"). Si dice que es por la cadetería (vale $${tar}), guardá la entrega con envio_transferido=${ajuste} y avisale cuánto falta ($${tar - ajuste}) que se lo paga al cadete. Si es por otra cosa o no queda claro, pasalo a Yanaina con la diferencia.`,
  };
}
async function derivar(ctx: Ctx, motivo: string) { const r = await pasarAYanaina(ctx, motivo); return { ...r, ok: false, motivo }; }

// ─── guardar_entrega ───────────────────────────────────────────
export async function guardarEntrega(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (eligió entrega)');
  const cfg = await leerConfig(), tar = tarifaDe(cfg);
  const tipo = String(a.tipo || '');
  if (!['retiro', 'cadeteria', 'agencia'].includes(tipo)) return { error: 'tipo tiene que ser retiro, cadeteria o agencia' };
  const { filas, cobros } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (!objetivo.length && !cobros.length) objetivo = filas.filter((r) => r.datos.estado === 'guardado' && pagado(r.datos)); // guardado con pago: se le puede dejar anotada la entrega
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  // 4/11: con varios pedidos abiertos la entrega se carga en todos (salen juntos)
  if (!objetivo.length) return { error: 'No hay pedido abierto al que cargarle la entrega. Pasalo a Yanaina.' };

  const s = (v: any) => String(v ?? '').trim();
  const cambiosCli: Record<string, string> = {};
  const hint: any = {};
  if (tipo === 'cadeteria') {
    if (!s(a.direccion)) return { error: 'Falta la dirección.' };
    const barrio = barrioCanon(s(a.barrio));
    if (!barrio) {
      const op = barrioOpciones(s(a.barrio));
      if (op.length) return { ok: false, preguntar_barrio: true, opciones: op, que_hacer: 'El barrio no es exacto. Preguntale a la clienta cuál de estas opciones es (sin decir que es una lista) y volvé a llamar guardar_entrega con el que elija.' };
      return { ok: false, preguntar_barrio: true, que_hacer: 'Ese barrio no está en la lista de GrisalExpress. Preguntale el barrio de nuevo (puede estar mal escrito o ser otro nombre). Si la segunda vez tampoco está, pasá a Yanaina con la dirección y el barrio.' };
    }
    cambiosCli.direccion = s(a.direccion); cambiosCli.barrio = barrio;
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.nota_cadete)) cambiosCli.notaCadete = s(a.nota_cadete);
  } else if (tipo === 'agencia') {
    if (!s(a.agencia) || !s(a.ciudad)) return { error: 'Faltan la agencia y la ciudad.' };
    cambiosCli.agencia = s(a.agencia); cambiosCli.ciudad = s(a.ciudad);
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.ci)) cambiosCli.ci = s(a.ci);
    if (s(a.departamento)) cambiosCli.depto = s(a.departamento);
    hint.agencia_habitual = esHabitual(cambiosCli.agencia);
  }
  const cambio = !!a.con_cambio, tarE = cambio ? Math.round(tar * 1.5) : tar; // 4/11: si el cadete además lleva/retira un cambio, cobra un envío y medio
  const x = Math.max(0, Math.min(tarE, Math.round(num(a.envio_transferido))));
  await conReintento(async () => {
    if (Object.keys(cambiosCli).length) { const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single(); const extra: any = tipo === 'cadeteria' ? { direcciones: sumarDireccion(data.datos, cambiosCli.direccion, cambiosCli.barrio, s(a.etiqueta).toLowerCase()) } : {}; await guardarClienta(data, { ...data.datos, ...cambiosCli, ...extra }); }
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos)); p.entrega = tipo;
      if (s(a.nota_interna) && !String(p.notas || '').includes(s(a.nota_interna))) { const n = '📦 ' + s(a.nota_interna).slice(0, 150); p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
      if (tipo === 'retiro') { if (!pagado(p)) p.pagaAlRetirar = true; else delete p.pagaAlRetirar; if (s(a.horario_retiro)) { const n = '🕒 Pasa a retirar: ' + s(a.horario_retiro).slice(0, 80) + ' (le dijo a Mabel)'; p.notas = p.notas ? String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() + (String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() ? '\n' : '') + n : n; } }
      else delete p.pagaAlRetirar;
      if (tipo === 'cadeteria') {
        p.tipoEnvio = p.tipoEnvio || 'comun';
        if (x >= tarE) { p.cobroEnvio = 'pago'; p.cobroMonto = 0; } else if (x > 0 || cambio) { p.cobroEnvio = 'monto'; p.cobroMonto = tarE - x; } else { p.cobroEnvio = 'cobrar'; p.cobroMonto = 0; }
        if (cambio) { const n = '🔄 Con cambio: el cadete cobra un envío y medio ($' + tarE + ')'; if (!String(p.notas || '').includes('Con cambio')) p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
        if (p.pago && x > 0) p.pago.conEnvio = x >= tarE;
      }
      await guardarPedido(data, p);
      // El envío ya transferido va a la fila de pago más nueva del pedido (misma convención que la app: envio, ajuste)
      if (tipo === 'cadeteria' && x > 0 && p.pago?.id) {
        const { data: g } = await sb.from('pagos').select('*').eq('id', p.pago.id).single();
        if (g && (g.datos.ajuste || 0) >= x) { const d = { ...g.datos, envio: x, ajuste: (g.datos.ajuste || 0) - x, esperado: (g.datos.esperado || 0) + x }; await sb.from('pagos').update({ datos: d, actualizado: new Date().toISOString() }).eq('id', g.id); }
      }
    }
  });
  const cadete = tipo === 'cadeteria' ? (x >= tarE ? 0 : tarE - x) : null;
  return {
    ok: true, tipo, pedidos: objetivo.map((r) => r.datos.num), ...hint,
    ...(cadete !== null ? { el_cadete_cobra: cadete } : {}),
    ...(tipo === 'retiro' ? { paga_al_retirar: objetivo.some((r) => !pagado(r.datos)) } : {}),
    mensaje_de_cierre: tipo === 'cadeteria' ? 'Listo, ya lo tenemos anotado. Cuando salga te avisa la cadetería.' : tipo === 'agencia' ? 'Listo, anotado. Cuando salga te mandamos la foto del comprobante de envío.' : 'Listo, anotado. ¡Te esperamos!',
  };
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
async function dejarEnEspera(ctx: Ctx, a: any) {
  const hoy = hoyUY();
  const { data: lv } = await sb.from('lives').select('id').eq('datos->>fecha', hoy).limit(1);
  if (!lv?.length || a?.reintento) return null;
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
  if (!lids.length) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true };
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
    else if (xs.length > 1) return derivar(ctx, 'Escribe desde un número sin pedido (' + (nombre || '') + (num ? ', pedido #' + num : '') + '): coincide con varios pedidos: ' + xs.slice(0, 4).map((x) => '#' + x.p.datos.num + ' ' + x.c.datos.nombre).join(', '));
  }
  // Por la prenda que dice que compró, entre los pedidos SIN teléfono (ej. "soy Paola, por el conjunto chocolate")
  if (!elegido && prenda) {
    const pw = normN(prenda).split(' ').filter((w) => w.length >= 4);
    const xs = cand.filter((x) => !String(x.c.datos.tel || '').replace(/\D/g, '') && pw.some((w) => (x.p.datos.prendas || []).some((pr: any) => normN(pr.nombre).split(' ').some((y) => y === w || edRatio(y, w) >= 0.8))));
    const conNombre = nombre ? xs.filter((x) => x.sim >= 0.5) : xs;
    if (conNombre.length === 1) elegido = conNombre[0];
    else if (!nombre && xs.length === 1) elegido = xs[0];
  }
  if (!elegido) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true };
  const telC = String(elegido.c.datos.tel || '').replace(/\D/g, '');
  if (telC && telKeyDe(telC) === ctx.telKey) { await limpiarEspera(ctx); return { ok: true, ya_vinculado: true, pedido: elegido.p.datos.num, que_hacer: 'Ese pedido ya está a su número.' }; }
  if (telC && telKeyDe(telC) !== ctx.telKey) return derivar(ctx, 'Escribe desde el 0' + ctx.telKey + ' y dice ser ' + (nombre || 'la clienta') + (num ? ' (pedido #' + num + ')' : '') + '. Puede ser el pedido #' + elegido.p.datos.num + ' de ' + elegido.c.datos.nombre + ', pero esa ficha tiene otro teléfono (' + elegido.c.datos.tel + '). Verificar.');
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
  if (!ctx.clienta) return derivar(ctx, 'Pide guardar el pedido pero no hay ficha de clienta para este número');
  const { filas, cobros } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  if (!objetivo.length) return { ok: true, ya_guardado: true, que_hacer: 'Sus pedidos ya están guardados: confirmale corto que siguen guardados.' };
  const hoy = hoyUY(), max = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const pagos = objetivo.map((r) => pagado(r.datos));
  if (pagos.some((x) => !x) && pagos.some((x) => x)) return derivar(ctx, 'Pide guardar: tiene pedidos pagos y otros sin pagar');
  const sinPagar = !pagos[0];
  const { data: cli } = await sb.from('clientas').select('datos').eq('id', ctx.clienta.id).single();
  if (sinPagar && !cli?.datos?.puedeGuardarSinPagar) return derivar(ctx, 'Pide guardar el pedido sin pagar' + (a?.hasta ? ' hasta el ' + a.hasta : '') + ' (no está autorizada a guardar sin pagar)');
  let hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(a?.hasta || '')) ? String(a.hasta) : max;
  if (hasta < hoy) hasta = max;
  if (sinPagar && hasta > max) return derivar(ctx, 'Pide guardar sin pagar hasta el ' + hasta + ' (más de 7 días)');
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

// ─── Definición de herramientas para la API de Claude ─────────────
export const HERRAMIENTAS = [
  { name: 'buscar_pedido', description: 'Trae el estado actual de la clienta que está escribiendo: pedidos abiertos, totales a transferir, datos de entrega guardados, nota y configuración. Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'marcar_pagado', description: 'Registra el pago de lo que vio en el comprobante. La herramienta calcula lo esperado y la diferencia; si no cierra, deriva sola a Yanaina.', input_schema: { type: 'object', properties: {
    cuenta: { type: 'string', description: 'Cuenta de Emma a la que se transfirió: BROU, Prex, Mi Dinero, OCA o Mercado Pago' },
    monto: { type: 'number', description: 'Monto que figura en el comprobante, en pesos' },
    fecha_comprobante: { type: 'string', description: 'Fecha del comprobante AAAA-MM-DD, si se lee' },
    destino_coincide: { type: 'boolean', description: 'false si el destino del comprobante no coincide con ninguna cuenta de las formas de pago de Emma' },
    nota: { type: 'string', description: 'Nota corta opcional (ejemplo: "transfirió $1.200")' } }, required: ['cuenta', 'monto', 'destino_coincide'] } },
  { name: 'guardar_entrega', description: 'Carga cómo recibe el pedido: retiro, cadeteria (Montevideo) o agencia.', input_schema: { type: 'object', properties: {
    tipo: { type: 'string', enum: ['retiro', 'cadeteria', 'agencia'] },
    direccion: { type: 'string', description: 'Cadetería: dirección' }, barrio: { type: 'string', description: 'Cadetería: barrio (tiene que estar en la lista de GrisalExpress)' },
    nota_cadete: { type: 'string', description: 'Cadetería: SOLO referencias para llegar (portón verde, apto 2, timbre) o el horario de entrega. Nada más.' }, nota_interna: { type: 'string', description: 'Nota para el equipo de Emma sobre este pedido (va junto con otra cosa, lo de Yharol, armar con otro pedido…). No la ve el cadete.' }, etiqueta: { type: 'string', description: 'Cadetería: nombre de la dirección si la clienta lo dice (casa, trabajo, mamá…)' }, con_cambio: { type: 'boolean', description: 'Cadetería: true si el cadete además lleva o retira un cambio (cobra un envío y medio)' },
    envio_transferido: { type: 'number', description: 'Cadetería: cuánto de los $250 ya transfirió (0 si lo paga al cadete, 250 si lo transfirió completo)' },
    agencia: { type: 'string' }, ciudad: { type: 'string' }, departamento: { type: 'string' }, ci: { type: 'string', description: 'C.I. de quien retira en la agencia' },
    nombre_retira: { type: 'string', description: 'Nombre completo de quien recibe o retira, si es distinto del nombre de la clienta' }, horario_retiro: { type: 'string', description: 'Retiro: en qué horario dice que pasa (ej. "mañana a las 18")' } }, required: ['tipo'] } },
  { name: 'vincular_pedido', description: 'La clienta escribe desde un número que no figura en ningún pedido pero dice quién es ("soy Ale, te pedí una remera", "confirmo el pedido 34", su usuario de TikTok). Busca en los lives de hoy y ayer el pedido sin teléfono que coincida y le pone este número.', input_schema: { type: 'object', properties: { num: { type: 'number', description: 'Número de pedido si lo dijo' }, nombre: { type: 'string', description: 'Nombre o usuario de TikTok tal como lo escribió' }, confirmar: { type: 'boolean', description: 'true si la clienta estaba confirmando el pedido' }, prenda: { type: 'string', description: 'Lo que dice que compró, si lo dijo ("conjunto chocolate", "jean")' } } } },
  { name: 'guardar_pedido', description: 'La clienta pide guardar su pedido (que no salga todavía, juntarlo con el próximo live, levantarlo más adelante). Si ya pagó, lo pasa a Guardado. Si no pagó, solo lo guarda si la ficha lo permite (hasta 7 días); si no, avisa a Yanaina.', input_schema: { type: 'object', properties: { hasta: { type: 'string', description: 'Fecha hasta la que lo guarda, AAAA-MM-DD, solo si la clienta dijo una' } } } },
  { name: 'confirmar_pedido', description: 'La clienta confirma su pedido del live ("sí", "confirmo mi pedido"). Marca confirmados sus pedidos abiertos del live más reciente (últimos 3 días). Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'pasar_a_yanaina', description: 'Deja la conversación para Yanaina, con el motivo en una línea. Mabel se calla en esa conversación por 12 horas o hasta que Yanaina la devuelva.', input_schema: { type: 'object', properties: { motivo: { type: 'string' }, en_silencio: { type: 'boolean', description: 'true = no se le avisa a la clienta (Yanaina lo ve en la bandeja). Usalo para pedidos anteriores a Mabel sin marcar como pagos y cuando el equipo ya habló con la clienta.' } }, required: ['motivo'] } },
  { name: 'actualizar_nota', description: 'Reescribe la nota de la clienta (máximo 3 líneas, solo hechos con fecha, sin opiniones ni datos sensibles). Llamala al cerrar una conversación en la que pasó algo útil para la próxima vez.', input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
];

export async function ejecutar(name: string, input: any, ctx: Ctx) {
  ctx.llamadas.push(name);
  switch (name) {
    case 'buscar_pedido': return await buscarPedido(ctx);
    case 'marcar_pagado': return await marcarPagado(ctx, input || {});
    case 'guardar_entrega': return await guardarEntrega(ctx, input || {});
    case 'confirmar_pedido': return await confirmarPedido(ctx);
    case 'vincular_pedido': return await vincularPedido(ctx, input || {});
    case 'guardar_pedido': return await guardarPedidoCli(ctx, input || {});
    case 'pasar_a_yanaina': return await pasarAYanaina(ctx, input?.motivo, !!input?.en_silencio);
    case 'actualizar_nota': return await actualizarNota(ctx, input?.texto);
    default: return { error: 'Herramienta desconocida' };
  }
}
// 5/11: horarios de retiro por fecha (cargados en la app, Config → Mabel). Siempre con la fecha real, nunca "hoy/mañana" sueltos.
export function horariosRetiroTexto(c: any) {
  const hoy = hoyUY(), dia = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  const hs = (Array.isArray(c.horariosRetiro) ? c.horariosRetiro : []).filter((x: any) => x?.fecha >= hoy).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)).slice(0, 14);
  if (!hs.length) return 'HORARIOS DE RETIRO: no hay ninguno cargado. No des horario: decile que escriba el día antes para coordinar.';
  return 'HORARIOS DE RETIRO CARGADOS (decí siempre el día con nombre y fecha): ' + hs.map((x: any) => (x.fecha === hoy ? 'HOY ' : '') + dia(x.fecha) + ': ' + (x.cerrado ? 'sin retiro' : 'de ' + x.desde + ' a ' + x.hasta + ' hs')).join('; ') + '. Para un día que no está en la lista no des horario: pedile que escriba el día antes para coordinar.';
}
