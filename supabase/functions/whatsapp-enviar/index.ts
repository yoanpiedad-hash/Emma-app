// whatsapp-enviar (4/11): la app manda plantillas aprobadas de Meta por la API (Dualhook).
// Solo miembros del equipo con sesión iniciada (verify_jwt + tabla miembros). Deja el mensaje en mabel_mensajes
// para que Mabel sepa qué se le mandó a la clienta.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
// Texto de cada plantilla (igual al aprobado en Meta) solo para el historial
const PLANTILLAS: Record<string, { n: number; texto: (v: string[]) => string }> = {
  emma_confirmacion: { n: 1, texto: (v) => `Hola ${v[0]}! De Emma Indumentaria 💛 Hiciste un pedido en el live, ¿me confirmás con un SÍ? Gracias!` },
  emma_recordatorio_1: { n: 3, texto: (v) => `Hola ${v[0]}! 💛 Este es un mensaje automático de Emma Indumentaria. Hoy es el último día para abonar tu pedido #${v[1]} por $${v[2]}. Si ya pagaste, ignorá este mensaje.` },
  emma_recordatorio_2: { n: 2, texto: (v) => `Hola ${v[0]}! Este es un mensaje automático de Emma Indumentaria. Tu pedido #${v[1]} era para abonar hasta ayer. Podés pagarlo hasta hoy a las 16:00; después se libera y no podemos volver a apartarte esas prendas.` },
  emma_total_2: { n: 6, texto: (v) => `¡Hola ${v[0]}! Te paso el detalle de tu pedido #${v[1]}: ${v[2]} · Total: $${v[3]} · Podés pagarlo hasta el ${v[4]} (mensaje del total con las formas de pago; Prex: ${v[5]})` },
};
// Recordatorios (5/11): además de lo que filtra la app, la función misma NO manda a los números del equipo (MABEL_EQUIPO)
// ni a clientas cuya conversación está con Yanaina ahora. Con accion:'revisar' devuelve qué saldría y qué no, SIN mandar nada.
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
    return j({ ok: true, revisar: true, res: its.map((it) => { const t = telKeyDe(it.tel), m = ex.get(t); return m ? { ref: it.ref, ok: false, skip: m, error: m === 'equipo' ? 'número del equipo' : 'Yanaina la está atendiendo' } : { ref: it.ref, ok: true }; }) });
  }
  const p = PLANTILLAS[body.plantilla];
  if (!p) return j({ ok: false, error: 'plantilla desconocida' }, 400);
  const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 120) : [];
  const res: any[] = [];
  const ex = CON_FILTRO.has(body.plantilla) ? await excluidos(A, items.map((it) => telKeyDe(it.tel)).filter((t) => t.length === 8)) : new Map<string, string>();
  for (const it of items) {
    const tk = telKeyDe(it.tel), vars = (it.vars || []).map((x: any) => String(x ?? '').replace(/\s*\n+\s*/g, ' · ').trim());
    if (ex.has(tk)) { res.push({ ref: it.ref, ok: false, skip: ex.get(tk), error: ex.get(tk) === 'equipo' ? 'número del equipo' : 'Yanaina la está atendiendo' }); continue; }
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
