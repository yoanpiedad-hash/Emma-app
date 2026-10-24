import os, time, json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/shots5'
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(n, c, x=''):
    RES.append((n, bool(c))); print(('✅' if c else '❌'), n, x, flush=True)
NO_CFG = "['gestionAcceso', 'vipPct', 'vipGrupo', 'vipMensaje', 'packagingPedido', 'gastosLive', 'archivarDias', 'codigoCounter']"
BLIND_G = """() => {
  const orig = COL.config.lista, NO = %s;
  COL.config.lista = () => orig().filter(x => !NO.includes(x.clave));
  NUBE.listo = false; migrarModelos();
  for (const col of ['modelos', 'stock', 'config']) for (const o of COL[col].lista()) { const f = COL[col].fila(o), id = f[pk(col)]; NUBE.ult[col].set(id, firma(col, f)); NUBE.filas[col].set(id, f); NUBE.out[col].delete(id); }
  NUBE.listo = true;
}""" % NO_CFG
BLIND_P = """() => { const orig = COL.config.lista, NO = %s; COL.config.lista = () => orig().filter(x => !NO.includes(x.clave)); window.open = () => null; window.print = () => {}; }""" % NO_CFG
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

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    mov = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errs = []
    G = ctx.new_page(); G.on('pageerror', lambda e: errs.append('G ' + str(e))); G.on('dialog', lambda d: d.accept())
    login(G, BASE + 'gestion.html'); G.evaluate(BLIND_G)
    G.evaluate("() => { DB.config.gestionAcceso = null; pintarLock(); }")
    G.fill('#lk-code', '4321'); G.fill('#lk-code2', '4321'); G.click('#lk-btn')
    ok('Gestión: entra', esperar(G, "!document.getElementById('app').hidden", 20))
    G.click('[data-t=ventas]'); time.sleep(0.6)
    # Consistencia en todos los lives reales: vendido = cobrado + por cobrar + salió sin pago + guardado
    malos = G.evaluate("(() => { const c = mapaCostos(), PM = pagosPorPedido(); return DB.lives.filter(l => { const r = resumenLive(l, c, PM); return Math.abs(r.vendido - (r.cobrado + r.porCobrar + r.sinPago + r.guardado)) > 1; }).map(l => l.nombre); })()")
    ok(f'Todos los lives ({G.evaluate("DB.lives.length")}): vendido = cobrado + por cobrar + sin pago + guardado', not malos, malos[:3])
    lid = G.evaluate("UI.vt.live")
    antes = G.evaluate(f"(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()); return {{ cob: r.cobrado, n: r.nCob, por: r.porCobrar, brou: r.cuentas.get('BROU') || 0, ret: r.salidas.retiro, arm: r.paraArmar }}; }})()")
    print('antes', antes)
    G.screenshot(path=f'{SHOTS}/G_ventas_antes.png', full_page=False)
    # Pedidos: pedido fantasma, pago y salida
    P = ctx.new_page(); P.on('pageerror', lambda e: errs.append('P ' + str(e))); P.on('dialog', lambda d: d.accept())
    login(P, BASE); P.evaluate(BLIND_P)
    cid = P.evaluate("(DB.clientes.find(c => norm(c.nombre) === 'emma piedad') || {}).id")
    orig = P.evaluate(f"JSON.stringify(cliById('{cid}'))")
    pid = P.evaluate(f"""(() => {{ const p = crearPedido(liveById('{lid}'), cliById('{cid}')); agregarPrenda(p, {{ stockId: null, codigo: null, nombre: 'Prueba Claude E5', precioLista: 1000, precio: 1000, qty: 1 }}); return p.id; }})()""")
    tot = P.evaluate(f"calc(pedById('{pid}')).total")
    ok('Pedido fantasma creado', bool(pid) and sinp(P), tot)
    ok('Gestión: aparece por cobrar', esperar(G, f"resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()).porCobrar === {antes['por']} + {tot}", 25))
    P.evaluate(f"registrarPagos([pedById('{pid}')], {{ cuenta: 'BROU' }}, false, null)")
    ok('Pago BROU marcado', sinp(P))
    ok('Gestión: pasa a cobrado, BROU suma y queda "para armar"', esperar(G, f"(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()); return r.cobrado === {antes['cob']} + {tot} && (r.cuentas.get('BROU')||0) === {antes['brou']} + {tot} && r.paraArmar === {antes['arm']} + 1; }})()", 25))
    kid = P.evaluate(f"crearPaquete(cliById('{cid}'), [pedById('{pid}')], 'retiro', {{}}, []).id")
    P.evaluate("savePaquetes(); guardar()")
    ok('Salida retiro', sinp(P))
    ok('Gestión: retiro +1 y ya no está para armar', esperar(G, f"(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()); return r.salidas.retiro === {antes['ret']} + 1 && r.paraArmar === {antes['arm']}; }})()", 25))
    G.evaluate("render()"); time.sleep(0.4)
    txt = G.inner_text('#v-cont')
    ok('Pantalla: cobros por cuenta, salidas y ganancia real', 'BROU' in txt and 'Retiro' in txt and 'Ganancia real' in txt and 'Total transferido' in txt)
    G.screenshot(path=f'{SHOTS}/G_ventas.png', full_page=True)
    # Salió sin pago confirmado
    P.evaluate(f"deshacerPaquete('{kid}')"); P.evaluate(f"anularPago(pedById('{pid}').pago.id); savePagos(); guardar()")
    kid2 = P.evaluate(f"(() => {{ const k = crearPaquete(cliById('{cid}'), [pedById('{pid}')], 'agencia', {{}}, ['{pid}']); savePaquetes(); guardar(); return k.id; }})()")
    ok('Pedido despachado sin pago', sinp(P))
    ok('Gestión: "Salió sin pago confirmado"', esperar(G, f"(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()); return r.nSinPago >= 1 && r.cobrado === {antes['cob']}; }})()", 25))
    G.evaluate("render()"); time.sleep(0.3)
    ok('Pantalla: tile de sin pago', 'sin pago confirmado' in G.inner_text('#v-cont').lower())
    # Celu
    M = mov.new_page(); M.on('pageerror', lambda e: errs.append('M ' + str(e)))
    login(M, BASE + 'gestion.html'); M.evaluate(BLIND_G); M.evaluate(f"() => {{ DB.config.gestionAcceso = {G.evaluate('JSON.stringify(cfg(\"gestionAcceso\"))')}; pintarLock(); }}")
    M.fill('#lk-code', '4321'); M.click('#lk-btn'); esperar(M, "!document.getElementById('app').hidden", 20)
    M.click('[data-t=ventas]'); time.sleep(0.6)
    ok('Celu: Ventas entra en el ancho', M.evaluate("document.documentElement.scrollWidth") <= 392)
    M.screenshot(path=f'{SHOTS}/M_ventas.png', full_page=False)
    # Limpieza
    P.evaluate(f"""() => {{ deshacerPaquete('{kid2}'); const p = pedById('{pid}'); if (p.pago) anularPago(p.pago.id); savePagos(); savePaquetes();
      eliminarPedido(pedById('{pid}')); const c = cliById('{cid}'), o = JSON.parse({json.dumps(orig)}); Object.keys(c).forEach(k => {{ if (!(k in o)) delete c[k]; }}); Object.assign(c, o); guardar(); }}""")
    ok('Limpieza: pedido, pago y paquetes de prueba fuera', sinp(P) and not P.evaluate(f"!!pedById('{pid}')") and not P.evaluate(f"(DB.pagos||[]).some(g => g.pedidoId === '{pid}')") and not P.evaluate(f"(DB.paquetes||[]).some(k => k.pedidos.includes('{pid}'))"))
    ok('Gestión vuelve a los números de antes', esperar(G, f"(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos()); return r.cobrado === {antes['cob']} && r.porCobrar === {antes['por']} && r.salidas.retiro === {antes['ret']}; }})()", 25))
    ok('Sin errores de JavaScript', not errs, errs[:3])
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
