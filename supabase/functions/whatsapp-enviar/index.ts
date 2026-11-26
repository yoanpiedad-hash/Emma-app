// whatsapp-enviar (4/11): la app manda plantillas aprobadas de Meta por la API (Dualhook).
// Solo miembros del equipo con sesión iniciada (verify_jwt + tabla miembros). Deja el mensaje en mabel_mensajes
// para que Mabel sepa qué se le mandó a la clienta.
// v6 (24/11): emma_total_3 (total sin Prex, 5 variables). Si la app pide emma_total_2, se manda emma_total_3 sin la variable de Prex
// (la Prex de Lilian ya no recibe transferencias; la app vieja todavía pide la 2).
// v8 (26/11): los recordatorios no salen a quien ya mandó comprobante (skip 'pago').
// v7 (25/11): accion 'texto' (chat de la pestaña Mabel): texto libre dentro de las 24 h, queda como eco del equipo y toma la conversación.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
// Texto de cada plantilla (igual al aprobado en Meta) solo para el historial
const PLANTILLAS: Record<string, { n: number; texto: (v: string[]) => string }> = {
  emma_confirmacion: { n: 1, texto: (v) => `Hola ${v[0]}! De Emma Indumentaria 💛 Hiciste un pedido en el live, ¿me confirmás con un SÍ? Gracias!` },
  emma_recordatorio_1: { n: 3, texto: (v) => `Hola ${v[0]}! 💛 Este es un mensaje automático de Emma Indumentaria. Hoy es el último día para abonar tu pedido #${v[1]} por $${v[2]}. Si ya pagaste, ignorá este mensaje.` },
  emma_recordatorio_2: { n: 2, texto: (v) => `Hola ${v[0]}! Este es un mensaje automático de Emma Indumentaria. Tu pedido #${v[1]} era para abonar hasta ayer. Podés pagarlo hasta hoy a las 16:00; después se libera y no podemos volver a apartarte esas prendas.` },
  emma_total_3: { n: 5, texto: (v) => `¡Hola ${v[0]}! Te paso el detalle de tu pedido #${v[1]}: ${v[2]} · Total: $${v[3]} · Podés pagarlo hasta el ${v[4]} (mensaje del total con las formas de pago: BROU, OCA, Mi Dinero, Mercado Pago; sin Prex)` },
};
// Recordatorios (5/11): además de lo que filtra la app, la función misma NO manda a los números del equipo (MABEL_EQUIPO)
// ni a clientas cuya conversación está con Yanaina ahora. Con accion:'revisar' devuelve qué saldría y qué no, SIN mandar nada.
const SKIP_TXT: Record<string, string> = { equipo: 'número del equipo', yanaina: 'Yanaina la está atendiendo', pago: 'ya mandó comprobante (en revisión)' };
const CON_FILTRO = new Set(['emma_recordatorio_1', 'emma_recordatorio_2']);
async function excluidos(A: Record<string, string>, tks: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const equipo = new Set(String(A.MABEL_EQUIPO || '').split(',').map((x) => telKeyDe(x)).filter(Boolean));
  tks.forEach((t) => { if (equipo.has(t)) out.set(t, 'equipo'); });
  const resto = tks.filter((t) => !out.has(t));
  if (resto.length) {
    const { data: cv } = await sb.from('conversaciones').select('id,datos').in('id', resto).eq('borrado', false);
    const ahora = new Date().toISOString();
    (cv || []).forEach((c: any) => { if (c.datos?.estado === 'yanaina' && (!c.datos.hasta || c.datos.hasta > ahora)) out.set(String(c.id), 'yanaina'); });
  }
  // v8 (26/11, caso #24): tampoco a quien ya mandó comprobante: pendiente de pago abierto en la bandeja, o una foto/PDF de la clienta
  // después del último total (o en los últimos 3 días si no figura el total).
  const resto2 = tks.filter((t) => !out.has(t));
  if (resto2.length) {
    const hace = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
    const [{ data: dv }, { data: tot }, { data: med }] = await Promise.all([
      sb.from('derivados').select('datos').in('datos->>telKey', resto2).eq('borrado', false).limit(1000),
      sb.from('mabel_mensajes').select('tel_key,creado').in('tel_key', resto2).eq('direccion', 'out').or('texto.ilike.%detalle de tu pedido%,texto.ilike.%total de tus pedidos%').gte('creado', hace(10)).limit(3000),
      sb.from('mabel_mensajes').select('tel_key,creado').in('tel_key', resto2).eq('direccion', 'in').in('tipo', ['image', 'document']).gte('creado', hace(10)).limit(3000),
    ]);
    (dv || []).forEach((r: any) => { const d = r.datos || {}; if (!d.resuelto && (d.categoria === 'pago' || (Array.isArray(d.motivos) && d.motivos.some((m: any) => m?.categoria === 'pago')))) out.set(String(d.telKey), 'pago'); });
    const ultTot = new Map<string, string>();
    (tot || []).forEach((m: any) => { const t = new Date(m.creado).toISOString(); if ((ultTot.get(m.tel_key) || '') < t) ultTot.set(m.tel_key, t); });
    (med || []).forEach((m: any) => { const t = new Date(m.creado).toISOString(); if (!out.has(m.tel_key) && t > (ultTot.get(m.tel_key) || hace(3))) out.set(String(m.tel_key), 'pago'); });
  }
  return out;
}
const telKeyDe = (t: string) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('598') ? d.slice(3).replace(/^0/, '') : d.replace(/^0/, ''); };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return j({});
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return j({ ok: false, error: 'sin sesión' }, 401);
  const { data: m } = await sb.from('miembros').select('user_id').eq('user_id', u.user.id).maybeSingle();
  if (!m) return j({ ok: false, error: 'no es del equipo' }, 403);
  const { data: aj } = await sb.from('mabel_ajustes').select('clave,valor');
  const A = Object.fromEntries((aj || []).map((r: any) => [r.clave, String(r.valor || '')]));
  const body = await req.json().catch(() => ({}));
  if (body.accion === 'revisar') {
    const its: any[] = Array.isArray(body.items) ? body.items.slice(0, 300) : [];
    const ex = await excluidos(A, its.map((it) => telKeyDe(it.tel)).filter((t) => t.length === 8));
    return j({ ok: true, revisar: true, res: its.map((it) => { const t = telKeyDe(it.tel), m = ex.get(t); return m ? { ref: it.ref, ok: false, skip: m, error: SKIP_TXT[m] || m } : { ref: it.ref, ok: true }; }) });
  }
  // 25/11 (chat de la pestaña Mabel): mandar un texto libre desde la app. Solo dentro de las 24 h desde el último mensaje de la clienta
  // (regla de Meta: después solo plantillas). Queda como eco del equipo (media.por) y la conversación pasa al equipo, igual que
  // cuando Yanaina contesta desde el celular: Mabel no se mete por 1 h desde el último mensaje.
  if (body.accion === 'texto') {
    const tk = telKeyDe(body.tel), texto = String(body.texto ?? '').trim().slice(0, 4000);
    if (tk.length !== 8 || !texto) return j({ ok: false, error: 'faltan el teléfono o el texto' }, 400);
    const { data: ui } = await sb.from('mabel_mensajes').select('creado').eq('tel_key', tk).eq('direccion', 'in').not('tipo', 'in', '(edit,revoke,system,ephemeral,reaction)').order('creado', { ascending: false }).limit(1);
    const ultimo = ui?.[0]?.creado ? new Date(ui[0].creado).getTime() : 0;
    if (!ultimo || Date.now() - ultimo > 24 * 3600e3) return j({ ok: false, ventana: false, error: 'Pasaron 24 h: solo se puede mandar una plantilla' });
    const r = await fetch(`${A.WHATSAPP_API_BASE || 'https://api.dualhook.com/v25.0'}/${A.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: '598' + tk, type: 'text', text: { body: texto, preview_url: false } }),
    });
    const jr = await r.json().catch(() => ({}));
    const wamid = jr?.messages?.[0]?.id;
    if (!r.ok || !wamid) return j({ ok: false, error: jr?.error?.message || ('HTTP ' + r.status) });
    const ahora = new Date(), hasta = new Date(ahora.getTime() + 3600e3).toISOString();
    await sb.from('mabel_mensajes').insert({ id: wamid, tel_key: tk, wa_id: '598' + tk, direccion: 'echo', tipo: 'text', texto, media: { por: u.user.id, email: u.user.email || '', desde: 'app' }, procesado: true });
    const { data: ex } = await sb.from('conversaciones').select('datos').eq('id', tk).maybeSingle();
    const vigente = ex?.datos?.estado === 'yanaina' && ex.datos.hasta > ahora.toISOString();
    const { data: cl } = await sb.from('clientas').select('id,datos').eq('tel_key', tk).eq('borrado', false).limit(1);
    const datos: any = vigente ? { ...ex!.datos, hasta } : { ...(ex?.datos || {}), id: tk, tel: ex?.datos?.tel || cl?.[0]?.datos?.tel || '0' + tk, clienteId: ex?.datos?.clienteId || cl?.[0]?.id || null, estado: 'yanaina', motivo: 'Contestó una persona del equipo desde la app', desde: ahora.toISOString(), hasta };
    delete datos.espera; delete datos.devuelta; delete datos.notaDevuelta;
    await sb.from('conversaciones').upsert({ id: tk, datos, borrado: false, actualizado: ahora.toISOString() }, { onConflict: 'id' });
    return j({ ok: true, id: wamid, hasta });
  }
  if (body.plantilla === 'emma_total_2') {
    body.plantilla = 'emma_total_3';
    if (Array.isArray(body.items)) body.items = body.items.map((it: any) => ({ ...it, vars: Array.isArray(it.vars) ? it.vars.slice(0, 5) : it.vars }));
  }
  const p = PLANTILLAS[body.plantilla];
  if (!p) return j({ ok: false, error: 'plantilla desconocida' }, 400);
  const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 120) : [];
  const res: any[] = [];
  const ex = CON_FILTRO.has(body.plantilla) ? await excluidos(A, items.map((it) => telKeyDe(it.tel)).filter((t) => t.length === 8)) : new Map<string, string>();
  for (const it of items) {
    const tk = telKeyDe(it.tel), vars = (it.vars || []).map((x: any) => String(x ?? '').replace(/\s*\n+\s*/g, ' · ').trim());
    if (ex.has(tk)) { res.push({ ref: it.ref, ok: false, skip: ex.get(tk), error: SKIP_TXT[ex.get(tk)!] || ex.get(tk) }); continue; }
    if (tk.length !== 8 || vars.length !== p.n || vars.some((x: string) => !x)) { res.push({ ref: it.ref, ok: false, error: 'faltan datos o teléfono' }); continue; }
    const r = await fetch(`${A.WHATSAPP_API_BASE || 'https://api.dualhook.com/v25.0'}/${A.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: '598' + tk, type: 'template', template: { name: body.plantilla, language: { code: 'es' }, components: [{ type: 'body', parameters: vars.map((t: string) => ({ type: 'text', text: t })) }] } }),
    });
    const jr = await r.json().catch(() => ({}));
    const wamid = jr?.messages?.[0]?.id;
    if (!r.ok || !wamid) { res.push({ ref: it.ref, ok: false, error: jr?.error?.message || ('HTTP ' + r.status) }); continue; }
    await sb.from('mabel_mensajes').insert({ id: wamid, tel_key: tk, wa_id: '598' + tk, direccion: 'out', tipo: 'plantilla', texto: p.texto(vars), media: { plantilla: body.plantilla, por: u.user.id }, procesado: true });
    res.push({ ref: it.ref, ok: true, id: wamid });
  }
  return j({ ok: true, res });
});
