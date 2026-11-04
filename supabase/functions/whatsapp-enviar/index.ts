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
  const p = PLANTILLAS[body.plantilla];
  if (!p) return j({ ok: false, error: 'plantilla desconocida' }, 400);
  const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 120) : [];
  const res: any[] = [];
  for (const it of items) {
    const tk = telKeyDe(it.tel), vars = (it.vars || []).map((x: any) => String(x ?? '').replace(/\s*\n+\s*/g, ' · ').trim());
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
