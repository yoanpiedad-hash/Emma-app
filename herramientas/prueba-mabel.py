import os, time, json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/mabel'
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(n, c, x=''):
    RES.append((n, bool(c))); print(('✅' if c else '❌'), n, x if x != '' else '', flush=True)
NO_CFG = "['gestionAcceso', 'vipPct', 'vipGrupo', 'vipMensaje', 'packagingPedido', 'gastosLive', 'archivarDias', 'codigoCounter', 'novedadesHoy', 'diaOtrasAgencias', 'mpRecargo', 'guardarSinPagarDias']"
BLIND_P = """() => { const orig = COL.config.lista, NO = %s; COL.config.lista = () => orig().filter(x => !NO.includes(x.clave)); window.__wa = []; window.open = u => { window.__wa.push(decodeURIComponent(u)); return null; }; window.print = () => {}; }""" % NO_CFG
def esperar(page, js, t=30):
    fin = time.time() + t
    while time.time() < fin:
        try:
            if page.evaluate(js): return True
        except Exception: pass
        time.sleep(0.3)
    return False
def login(page, url):
    page.goto(url)
    if esperar(page, "(document.getElementById('login') && !document.getElementById('login').hidden) || (typeof NUBE !== 'undefined' && NUBE.listo)", 60) and page.is_visible('#login'):
        page.fill('#lg-email', EMAIL); page.fill('#lg-pass', PASS); page.click('#lg-btn')
    assert esperar(page, "typeof NUBE !== 'undefined' && NUBE.listo", 150)
def sinp(page): return esperar(page, "pendientes() === 0 && !NUBE.subiendo", 40)
PROMPT = {'v': None}
def dlg(d):
    if d.type == 'prompt': d.accept(PROMPT['v'] if PROMPT['v'] is not None else d.default_value)
    else: d.accept()

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    P = br.new_context(viewport={'width': 1280, 'height': 900}).new_page(); errs = []
    P.on('pageerror', lambda e: errs.append(str(e))); P.on('dialog', dlg)
    login(P, BASE); P.evaluate(BLIND_P)
    ok('Pedidos carga con mabel.js', P.evaluate("typeof estadoPago === 'function' && Array.isArray(DB.cobros) && Array.isArray(DB.conversaciones)"))
    dif = P.evaluate("todosPedidos().filter(p => { const a = calcViejo(p), b = calc(p); return a.total !== b.total; }).length")
    ok('Pedidos existentes: mismos totales', dif == 0)
    # Config
    P.evaluate("setTab('config')"); time.sleep(0.4)
    P.fill('#mb-nov', 'Hoy retiro de 16 a 20 hs'); P.dispatch_event('#mb-nov', 'change'); time.sleep(0.3)
    ok('Config: novedades de hoy con vencimiento', P.evaluate("novedadesVigentes() && novedadesVigentes().texto === 'Hoy retiro de 16 a 20 hs' && novedadesVigentes().vence === hoyISO()"))
    P.fill('#mb-vence', '2026-01-01'); P.dispatch_event('#mb-vence', 'change'); time.sleep(0.3)
    ok('Config: vencida → Mabel no la usa', P.evaluate("novedadesVigentes() === null") and 'vencida' in P.inner_text('#cf-mabel'))
    ok('Config: día de otras agencias = viernes por defecto, MP 10%', P.input_value('#mb-dia') == 'viernes' and P.input_value('#mb-mp') == '10')
    P.screenshot(path=f'{SHOTS}/config.png', full_page=False)
    # Pedidos fantasma
    cid = P.evaluate("(DB.clientes.find(c => norm(c.nombre) === 'emma piedad') || {}).id")
    orig = P.evaluate(f"JSON.stringify(cliById('{cid}'))")
    mk = lambda precio: P.evaluate(f"(() => {{ const p = crearPedido(liveActual(), cliById('{cid}')); agregarPrenda(p, {{ stockId: null, codigo: null, nombre: 'Prueba Claude M', precioLista: {precio}, precio: {precio}, qty: 1 }}); return p.id; }})()")
    p1, p2, p3 = mk(1000), mk(500), mk(800)
    tot1 = P.evaluate(f"calc(pedById('{p1}')).total")
    # Mercado Pago
    g = P.evaluate(f"(() => {{ const gs = registrarPagos([pedById('{p3}')], {{ cuenta: 'Mercado Pago' }}, false, null); const g = gs[gs.length-1]; return {{ medio: g.medio, rec: g.recargo, esp: g.esperado, monto: g.monto, aj: g.ajuste }}; }})()")
    t3 = P.evaluate(f"calc(pedById('{p3}')).total")
    ok('Mercado Pago: total + 10% esperado, medio y recargo', g == {'medio': 'mercadopago', 'rec': round(t3 * 0.1), 'esp': t3 + round(t3 * 0.1), 'monto': t3 + round(t3 * 0.1), 'aj': 0}, g)
    P.evaluate(f"anularPago(pedById('{p3}').pago.id); savePagos(); guardar()")
    # Transferencia con diferencia y nota (como lo haría Mabel)
    g = P.evaluate(f"(() => {{ const gs = registrarPagos([pedById('{p3}')], {{ cuenta: 'BROU', transf: {t3 + 10}, origen: 'mabel', nota: 'transfirió $10 de más' }}, false, null); const g = gs[gs.length-1]; return [g.medio, g.esperado, g.ajuste, g.monto, g.nota, g.origen]; }})()")
    ok('Transferencia de Mabel: esperado, diferencia +10 y nota', g == ['transferencia', t3, 10, t3 + 10, 'transfirió $10 de más', 'mabel'], g)
    P.evaluate(f"anularPago(pedById('{p3}').pago.id); savePagos(); guardar()")
    # Paga al retirar
    P.evaluate(f"(() => {{ const p = pedById('{p3}'); p.entrega = 'retiro'; p.pagaAlRetirar = true; saveLives(); }})()")
    ok('Retiro con pago al retirar: sin recordatorio', P.evaluate(f"estadoPago(pedById('{p3}')) === 'al_retirar' && !recibeRecordatorio(pedById('{p3}'))"))
    ok('Pedido común sin pagar: con recordatorio', P.evaluate(f"estadoPago(pedById('{p1}')) === 'pendiente' && recibeRecordatorio(pedById('{p1}'))"))
    ok('envio_pago y cobra_cadete salen de lo que ya existía', P.evaluate(f"(() => {{ const p = pedById('{p1}'); p.cobroEnvio = 'monto'; p.cobroMonto = 150; const r = [envioPagoDe(p), cobroEnvioDe(p)]; p.cobroEnvio = null; p.cobroMonto = 0; return r.join(); }})()") == 'parcial,150')
    # Ficha: nota y guardar sin pagar
    P.evaluate("setTab('clientes')"); P.fill('#cl-filtro', 'EMMA PIEDAD'); P.dispatch_event('#cl-filtro', 'input'); time.sleep(0.4)
    PROMPT['v'] = '24/10: prefiere cadetería.'; P.click(f"[data-act=mbNota][data-cid='{cid}']"); time.sleep(0.3); PROMPT['v'] = None
    ok('Ficha: nota de Mabel', P.evaluate(f"cliById('{cid}').notaMabel") == '24/10: prefiere cadetería.' and 'prefiere cadetería' in P.inner_text('#lista-clientes'))
    P.click(f"[data-act=mbGsp][data-cid='{cid}']"); time.sleep(0.3)
    ok('Ficha: "puede guardar sin pagar"', P.evaluate(f"cliById('{cid}').puedeGuardarSinPagar === true") and 'guarda sin pagar' in P.inner_text('#lista-clientes'))
    P.screenshot(path=f'{SHOTS}/ficha.png', full_page=False)
    # Guardado sin pagar
    P.evaluate(f"setEstado(pedById('{p1}'), 'guardado'); setEstado(pedById('{p2}'), 'guardado'); saveLives()")
    ok('Al guardar: queda "guardado sin pagar" con fecha límite', P.evaluate(f"estadoPago(pedById('{p1}')) === 'guardado_sin_pagar' && pedById('{p1}').guardadoSinPagar.hasta === sumarDias(hoyISO(), 30)"))
    ok('Guardado sin pagar: sin recordatorio', P.evaluate(f"!recibeRecordatorio(pedById('{p1}'))"))
    P.evaluate(f"pedById('{p1}').guardadoSinPagar.hasta = hoyISO(); pedById('{p2}').guardadoSinPagar.hasta = hoyISO(); saveLives(); render()"); time.sleep(0.3)
    ok('Día límite: aviso al equipo arriba y ⏰ en Guardados', 'Vence hoy el guardado sin pagar' in P.inner_text('#avisos-mabel') and '⏰' in P.inner_text('#bdg-guard'))
    P.evaluate("setTab('guardados')"); time.sleep(0.3)
    txt = P.inner_text('#lista-guardados')
    ok('Guardados: tarjeta de guardados sin pagar, sin los avisos de 30 días', 'guardados sin pagar' in txt.lower() and not P.evaluate(f"!!document.querySelector('#lista-guardados .gd [data-id=\"{p1}\"]')"))
    P.click(f"[data-act=gspMas][data-cid='{cid}']"); time.sleep(0.3)
    ok('+7 días extiende el plazo', P.evaluate(f"pedById('{p1}').guardadoSinPagar.hasta === sumarDias(hoyISO(), 7) && pedById('{p2}').guardadoSinPagar.hasta === sumarDias(hoyISO(), 7)") and not P.evaluate("gspVencidos().length"))
    P.screenshot(path=f'{SHOTS}/guardados.png', full_page=False)
    # Cobro agrupado
    P.click(f"#lista-guardados [data-act=cobroArmar][data-cid='{cid}']"); time.sleep(0.3)
    P.uncheck(f"#mbox [data-id='{p3}']"); P.dispatch_event(f"#mbox [data-id='{p3}']", 'change'); time.sleep(0.2)
    P.check('#mbox [data-chg=cobroEnv]'); P.dispatch_event('#mbox [data-chg=cobroEnv]', 'change'); time.sleep(0.2)
    P.click('[data-act=cobroCrear]'); time.sleep(0.4)
    tot2 = P.evaluate(f"calc(pedById('{p2}')).total")
    k = P.evaluate("DB.cobros.find(k => k.estado === 'abierto' && k.pedidos.length === 2)")
    ok('Cobro agrupado: 2 pedidos + un solo envío', k and k['total'] == tot1 + tot2 + 250 and k['envio'] == 250, k and k['total'])
    P.click(f"[data-act=cobroWA][data-id='{k['id']}']"); time.sleep(0.3)
    ok('Mensaje del cobro con el total', any(f'*Total: ' in u and 'Envío por cadetería' in u for u in P.evaluate("window.__wa")))
    P.click(f"[data-act=cobroPagar][data-id='{k['id']}']"); time.sleep(0.3); P.click("#mbox [data-act=cobroCuenta][data-c='BROU']"); time.sleep(0.5)
    r = P.evaluate(f"(() => {{ const k = DB.cobros.find(x => x.id === '{k['id']}'); const gs = DB.pagos.filter(g => g.cobroId === k.id); return [k.estado, pagado(pedById('{p1}')), pagado(pedById('{p2}')), gs.length, gs.reduce((s,g)=>s+g.monto,0), gs.reduce((s,g)=>s+(g.envio||0),0)]; }})()")
    ok('Un pago marca pagados los dos, con el envío', r == ['pagado', True, True, 2, tot1 + tot2 + 250, 250], r)
    ok('Subido a la nube', sinp(P))
    # Conversaciones
    P.evaluate(f"(() => {{ DB.conversaciones.push({{ id: 'conv_prueba_claude', tel: cliById('{cid}').tel, clienteId: '{cid}', estado: 'yanaina', motivo: 'Transfirió de menos (faltan $200)', desde: ahoraISO(), hasta: new Date(Date.now() + 12 * 3600e3).toISOString() }}); saveConvs(); render(); }})()"); time.sleep(0.3)
    ok('Conversación para Yanaina: aviso arriba', '1 conversación de Mabel' in P.inner_text('#avisos-mabel'))
    P.evaluate("setTab('clientes')"); time.sleep(0.3)
    ok('Clientes: tarjeta con motivo y botón Devolver', 'faltan $200' in P.inner_text('#cl-deshacer'))
    P.screenshot(path=f'{SHOTS}/conversaciones.png', full_page=False)
    P.click("[data-act=convDevolver][data-id='conv_prueba_claude']"); time.sleep(0.3)
    ok('↩️ Devolver a Mabel', P.evaluate("DB.conversaciones.find(v => v.id === 'conv_prueba_claude').estado") == 'agente' and not P.evaluate("convActivas().length"))
    ok('Sin errores de JavaScript', not errs, errs[:3])
    # Limpieza
    P.evaluate(f"""() => {{
      for (const id of ['{p1}', '{p2}', '{p3}']) {{ const p = pedById(id); if (p && p.pago) for (const g of DB.pagos.filter(g => g.pedidoId === id)) anularPago(g.id); }}
      savePagos();
      for (const id of ['{p1}', '{p2}', '{p3}']) {{ const p = pedById(id); if (p) eliminarPedido(p); }}
      DB.cobros = DB.cobros.filter(k => k.id !== '{k['id']}'); saveCobros();
      DB.conversaciones = DB.conversaciones.filter(v => v.id !== 'conv_prueba_claude'); saveConvs();
      const c = cliById('{cid}'), o = JSON.parse({json.dumps(orig)}); Object.keys(c).forEach(k => {{ if (!(k in o)) delete c[k]; }}); Object.assign(c, o); guardar(); }}""")
    ok('Limpieza', sinp(P) and P.evaluate(f"JSON.stringify(cliById('{cid}'))") == orig and not P.evaluate(f"!!pedById('{p1}')"))
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
