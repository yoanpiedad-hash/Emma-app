import os, time, json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/shots3'
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(n, c, x=''):
    RES.append((n, bool(c))); print(('✅' if c else '❌'), n, x, flush=True)
# Nunca se suben: el código real ni los ajustes de config que toca la prueba; el pasaje a números solo en memoria
BLINDAJE = """() => {
  const orig = COL.config.lista, NO = ['gestionAcceso', 'vipPct', 'vipGrupo', 'vipMensaje', 'packagingPedido', 'gastosLive', 'archivarDias'];
  COL.config.lista = () => orig().filter(x => !NO.includes(x.clave));
  NUBE.listo = false; migrarModelos();
  for (const col of ['modelos', 'stock', 'config']) for (const o of COL[col].lista()) { const f = COL[col].fila(o), id = f[pk(col)]; NUBE.ult[col].set(id, firma(col, f)); NUBE.filas[col].set(id, f); NUBE.out[col].delete(id); }
  NUBE.listo = true; window.print = () => {};
}"""
def esperar(page, js, t=30):
    fin = time.time() + t
    while time.time() < fin:
        try:
            if page.evaluate(js): return True
        except Exception: pass
        time.sleep(0.3)
    return False
def login(page):
    page.goto(BASE + 'gestion.html'); page.wait_for_selector('#lg-email, #lock', timeout=60000)
    if page.is_visible('#login'): page.fill('#lg-email', EMAIL); page.fill('#lg-pass', PASS); page.click('#lg-btn')
    assert esperar(page, "typeof NUBE !== 'undefined' && NUBE.listo", 150)
def sinp(page): return esperar(page, "pendientes() === 0 && !NUBE.subiendo", 40)
DLG = []
def dialogo(d):
    DLG.append(d.message)
    d.accept(d.default_value) if d.type == 'prompt' else d.accept()
def chg(page, sel, val): page.fill(sel, str(val)); page.dispatch_event(sel, 'change'); time.sleep(0.25)

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    A = br.new_context(viewport={'width': 1280, 'height': 900}).new_page()
    B = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page()
    errs = []
    for pg in (A, B): pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', dialogo)
    login(A); A.evaluate(BLINDAJE)
    A.evaluate("() => { DB.config.gestionAcceso = null; pintarLock(); }")
    A.fill('#lk-code', '4321'); A.fill('#lk-code2', '4321'); A.click('#lk-btn')
    ok('A: entra', esperar(A, "!document.getElementById('app').hidden", 20))
    acceso = A.evaluate("JSON.stringify(cfg('gestionAcceso'))")
    # Dos shorts con costo (compra local: $500, venta $990)
    A.click('[data-t=local]'); A.fill('#al-nombre', 'Prueba Claude promos'); A.dispatch_event('#al-nombre', 'input')
    for nom in ('Short Prueba Claude azul', 'Short Prueba Claude rosa'):
        chg(A, '#al-nom', nom); A.select_option('#al-cat', 'Short')
        A.fill('#al-t-S', '2'); A.fill('#al-t-M', '2'); A.fill('#al-pcomp', '500'); A.fill('#al-pv', '990'); A.click('[data-act=addLocal]'); time.sleep(0.3)
    A.click('#al-guardar'); time.sleep(0.8); A.click('[data-act=closeModal]')
    m1, m2 = A.evaluate("[modeloByNum(1).id, modeloByNum(2).id]")
    ok('Prendas de prueba 1 y 2 creadas', A.evaluate("modeloByNum(2).nombre") == 'Short Prueba Claude rosa' and sinp(A))
    # Combo 2 por $1.200 → aviso de mínimo (600 por unidad < 714)
    A.click('[data-t=promos]'); A.click('[data-act=promoNueva]'); time.sleep(0.3)
    A.select_option('#mbox [data-f=tipo]', 'combo'); A.dispatch_event('#mbox [data-f=tipo]', 'change'); time.sleep(0.3)
    chg(A, '#mbox [data-f=x]', 1200)
    A.fill('#pf-mod', '1 · Short Prueba Claude azul'); A.click('[data-act=pfAddMod]'); time.sleep(0.2)
    A.fill('#pf-mod', 'Short Prueba Claude rosa'); A.press('#pf-mod', 'Enter'); time.sleep(0.2)
    ok('Promo: 2 prendas elegidas (por número y por nombre)', A.evaluate("PF.modelos.length") == 2)
    ok('Código de etiqueta P1-S encuentra la prenda 1', A.evaluate("(buscarModelo('P1-S')||{}).num") == 1)
    A.screenshot(path=f'{SHOTS}/A_promo_form.png')
    DLG.clear(); A.click('[data-act=pfGuardar]'); time.sleep(0.4)
    ok('Aviso: queda debajo del mínimo', any('mínimo' in d for d in DLG), DLG[-1:] )
    ok('Promo guardada y subida', A.evaluate("DB.promos.length") >= 1 and sinp(A))
    pid = A.evaluate("DB.promos.find(p => p.tipo === 'combo' && p.modelos.includes(modeloByNum(1).id)).id")
    ok('Nombre automático', A.evaluate(f"DB.promos.find(p => p.id === '{pid}').nombre") == 'Combo N por $X 2 por $1.200')
    # Especial 50% sobre la azul → aviso de pérdida + superposición
    A.click('[data-act=promoNueva]'); time.sleep(0.3)
    chg(A, '#mbox [data-f=nombre]', 'Liquidación azul'); chg(A, '#mbox [data-f=valor]', 50)
    A.fill('#pf-mod', '1'); A.click('[data-act=pfAddMod]'); time.sleep(0.2)
    DLG.clear(); A.click('[data-act=pfGuardar]'); time.sleep(0.4)
    ok('Aviso: una sola promo por prenda', any('una sola promo' in d for d in DLG))
    ok('Aviso: perdés plata (495 < costo 500)', any('PERDÉS' in d for d in DLG))
    # Cálculo del pedido con las promos guardadas
    r = A.evaluate(f"""(() => {{ const v = s => variantesDe(s)[0].id; const r = calcularPedido({{ prendas: [ {{ stockId: v('{m1}'), precio: 990, precioLista: 990, qty: 1 }}, {{ stockId: v('{m2}'), precio: 990, precioLista: 990, qty: 2 }} ] }},
      {{ promos: DB.promos, modeloDe: id => (stockById(id)||{{}}).modeloId, liveId: 'x', hoy: hoyISO(), livePct: 10, vipPct: 5 }}); return [r.ahorroEspecial, r.promos.map(x => x.monto), r.descLive, r.descVip, r.total]; }})()""")
    ok('Pedido: azul a mitad (−495), 2 rosas por $1.200 (−780), sin descuento del live', r == [495, [780], 0, 0, 1695], r)
    A.click(f"[data-act=promoAct][data-id='{pid}']"); time.sleep(0.3)
    ok('Pausar promo', A.evaluate(f"DB.promos.find(p => p.id === '{pid}').activa") is False and 'Pausada' in A.inner_text('#pr-lista'))
    A.screenshot(path=f'{SHOTS}/A_promos.png', full_page=True)
    # B ve las promos en tiempo real
    login(B); B.evaluate(BLINDAJE); B.evaluate(f"() => {{ DB.config.gestionAcceso = {acceso}; pintarLock(); }}")
    B.fill('#lk-code', '4321'); B.click('#lk-btn')
    ok('B (celu) ve las promos', esperar(B, "!document.getElementById('app').hidden && DB.promos.filter(p => /Prueba|Liquidación|Combo/.test(p.nombre)).length >= 2", 25))
    B.click('[data-t=promos]'); time.sleep(0.4)
    ok('Celu: Promos entra en el ancho', B.evaluate("document.documentElement.scrollWidth") <= 392)
    B.screenshot(path=f'{SHOTS}/B_promos.png', full_page=True)
    # VIP
    A.click('#vp-card summary'); time.sleep(0.2)
    chg(A, '#vp-pct', 7); chg(A, '#vp-link', 'https://chat.whatsapp.com/PRUEBA')
    prev = A.inner_text('#vp-prev')
    ok('VIP: % y link en el mensaje', '7% de descuento VIP' in prev and 'chat.whatsapp.com/PRUEBA' in prev and prev.startswith('María'))
    A.fill('#vp-msg', 'Hola {nombre}\nTenés {descuento}%'); A.dispatch_event('#vp-msg', 'change'); time.sleep(0.3)
    ok('VIP: mensaje editable', A.inner_text('#vp-prev').startswith('Hola María\nTenés 7%'))
    A.click('[data-act=vipReset]'); time.sleep(0.3)
    ok('VIP: volver al original', A.inner_text('#vp-prev').startswith('María, ¿cómo estás?'))
    # Otros colores: modelos de la misma línea
    A.evaluate("""(() => { const c = { id: 'kPRUEBAcol', tipo: 'local', estado: 'recibida', nombre: 'x', fecha: hoyISO(), lineas: [{ lid: 'l1', descripcion: 'x', qty: 2, modelos: [{ k: 'a', mid: modeloByNum(1).id, talles: {} }, { k: 'b', mid: modeloByNum(2).id, talles: {} }] }] }; COMPRAS.push(c); })()""")
    A.click('[data-t=promos]'); A.click('[data-act=promoNueva]'); time.sleep(0.3)
    A.fill('#pf-mod', 'P1-M'); DLG.clear(); A.click('[data-act=pfAddMod]'); time.sleep(0.3)
    ok('Al sumar el 1 pregunta por los otros colores y los suma', any('otros colores' in d for d in DLG) and A.evaluate("PF.modelos.length") == 2)
    A.evaluate("COMPRAS = COMPRAS.filter(c => c.id !== 'kPRUEBAcol')"); A.click('#mbox [data-act=closeModal]')
    # Ganancia real del live
    html = A.evaluate("gananciaLiveHTML({ id: 'Lx' }, { ventaConCosto: 10000, costo: 6000, nCob: 10, sinCosto: 0 })")
    ok('Ganancia: 4.000 − packaging 10×30 = 3.700', '$4.000' in html and '−$300' in html and '$3.700' in html)
    A.click('[data-t=ventas]'); time.sleep(0.5)
    lid = A.evaluate("UI.vt.live")
    A.fill('#vg-desc', 'Ayudante'); A.fill('#vg-monto', '1500'); A.click('[data-act=gastoAdd]'); time.sleep(0.4)
    A.fill('#vg-desc', 'Uber'); A.fill('#vg-monto', '300'); A.press('#vg-monto', 'Enter'); time.sleep(0.4)
    ok('Gastos extras del live sumados', A.evaluate(f"gastosDe('{lid}').reduce((s,x)=>s+x.monto,0)") == 1800 and 'Ayudante' in A.inner_text('#v-cont'))
    chg(A, '#vt-pack', 35)
    ok('Packaging editable', A.evaluate("packPedido()") == 35)
    A.screenshot(path=f'{SHOTS}/A_ventas.png', full_page=True)
    ok('Balance mensual con ganancia real', 'ganancia real*' in A.inner_text('#v-cont').lower())
    B.screenshot(path=f'{SHOTS}/B_antes_ventas.png')
    if B.is_visible('#modal.on'): print('MODAL B:', B.inner_text('#mbox')[:300]); B.click('#mbox [data-act=closeModal]')
    B.click('[data-t=ventas]'); time.sleep(0.5)
    ok('Celu: Ventas entra en el ancho', B.evaluate("document.documentElement.scrollWidth") <= 392)
    B.screenshot(path=f'{SHOTS}/B_ventas.png', full_page=True)
    # Limpieza
    A.click('[data-t=promos]'); time.sleep(0.3)
    for i in A.evaluate("DB.promos.filter(p => p.modelos.some(m => /Prueba Claude/.test((modeloById(m)||{}).nombre))).map(p => p.id)"):
        A.click(f"[data-act=promoDel][data-id='{i}']"); time.sleep(0.3)
    ok('Promos de prueba borradas', A.evaluate("DB.promos.filter(p => p.modelos.some(m => /Prueba Claude/.test((modeloById(m)||{}).nombre))).length") == 0 and sinp(A))
    A.click('[data-t=hist]'); time.sleep(0.3)
    c = A.evaluate("COMPRAS.find(c => c.nombre === 'Prueba Claude promos').id")
    if not A.is_visible(f"[data-act=delCompra][data-cid='{c}']"): A.click(f"[data-act=histSel][data-cid='{c}']"); time.sleep(0.3)
    A.click(f"[data-act=delCompra][data-cid='{c}']"); time.sleep(0.4)
    ok('Compra de prueba eliminada', sinp(A) and A.evaluate("COMPRAS.length") == 6)
    ok('Config real sin tocar (nada pendiente de config)', A.evaluate("NUBE.out.config.size") == 0)
    ok('Sin errores de JavaScript', not errs, errs[:3])
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
