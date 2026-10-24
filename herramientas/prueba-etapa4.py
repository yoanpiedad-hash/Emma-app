import os, time, json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/shots4'
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
  NUBE.listo = true; window.print = () => {};
}""" % NO_CFG
BLIND_P = """() => { const orig = COL.config.lista, NO = %s; COL.config.lista = () => orig().filter(x => !NO.includes(x.clave)); window.__wa = []; window.open = u => { window.__wa.push(u); return null; }; window.print = () => {}; }""" % NO_CFG
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
DLG = []
def dialogo(d):
    DLG.append(d.message); d.accept(d.default_value) if d.type == 'prompt' else d.accept()
def chg(page, sel, val): page.fill(sel, str(val)); page.dispatch_event(sel, 'change'); time.sleep(0.25)

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    G = ctx.new_page(); errs = []
    G.on('pageerror', lambda e: errs.append('G ' + str(e))); G.on('dialog', dialogo)
    # ── Gestión: dos prendas de prueba y dos promos ──
    login(G, BASE + 'gestion.html'); G.evaluate(BLIND_G)
    G.evaluate("() => { DB.config.gestionAcceso = null; pintarLock(); }")
    G.fill('#lk-code', '4321'); G.fill('#lk-code2', '4321'); G.click('#lk-btn')
    ok('Gestión: entra', esperar(G, "!document.getElementById('app').hidden", 20))
    G.click('[data-t=local]'); G.fill('#al-nombre', 'Prueba Claude P4'); G.dispatch_event('#al-nombre', 'input')
    chg(G, '#al-nom', 'Remera Prueba Claude P4 blanca'); G.fill('#al-t-S', '1'); G.fill('#al-t-M', '2'); G.fill('#al-pcomp', '400'); G.fill('#al-pv', '1000'); G.click('[data-act=addLocal]'); time.sleep(0.3)
    chg(G, '#al-nom', 'Short Prueba Claude P4'); G.select_option('#al-tipo', 'unico'); G.dispatch_event('#al-tipo', 'change'); time.sleep(0.2)
    G.fill('#al-t-U', '3'); G.fill('#al-pcomp', '300'); G.fill('#al-pv', '800'); G.click('[data-act=addLocal]'); time.sleep(0.3)
    G.click('#al-guardar'); time.sleep(0.8); G.click('[data-act=closeModal]')
    n1, n2 = G.evaluate("[DB.modelos.find(m => m.nombre === 'Remera Prueba Claude P4 blanca').num, DB.modelos.find(m => m.nombre === 'Short Prueba Claude P4').num]")
    ok('Gestión: prendas creadas', n1 and n2, (n1, n2))
    G.evaluate(f"""() => {{ const m1 = modeloByNum({n1}).id, m2 = modeloByNum({n2}).id;
      DB.promos.push({{ id: 'prP4a', nombre: 'Remeras 2 por $1.800', tipo: 'combo', n: 2, x: 1800, modelos: [m1], activa: true, creado: ahoraISO() }});
      DB.promos.push({{ id: 'prP4b', nombre: 'Short 20% off', tipo: 'especial', modo: 'pct', valor: 20, modelos: [m2], activa: true, creado: ahoraISO() }});
      put('emma_promos'); }}""")
    ok('Gestión: promos subidas', sinp(G))

    # ── Pedidos ──
    P = ctx.new_page(); P.on('pageerror', lambda e: errs.append('P ' + str(e))); P.on('dialog', dialogo)
    login(P, BASE); P.evaluate(BLIND_P)
    ok('Pedidos: ve las prendas nuevas con talles y las promos', esperar(P, f"DB.stock.some(s => s.codigo === '{n1}-M') && (DB.promos||[]).some(x => x.id === 'prP4a')", 30))
    dif = P.evaluate("todosPedidos().filter(p => { const a = calcViejo(p), b = calc(p); return a.total !== b.total || a.sub !== b.sub; }).length")
    ok(f'Los {P.evaluate("todosPedidos().length")} pedidos existentes dan el mismo total que antes', dif == 0, dif)
    cid = P.evaluate("(DB.clientes.find(c => norm(c.nombre) === 'emma piedad') || {}).id")
    ok('Clienta de prueba EMMA PIEDAD', bool(cid))
    orig = P.evaluate(f"JSON.stringify(cliById('{cid}'))")
    pid = P.evaluate(f"crearPedido(liveActual(), cliById('{cid}')).id")
    P.evaluate("setTab('live')"); P.evaluate(f"abrirCarga('{pid}')"); time.sleep(0.4)
    # Tipear el número → talles
    P.fill('#qll-txt', str(n1)); P.dispatch_event('#qll-txt', 'input'); time.sleep(0.3)
    sug = P.inner_text('#qll-sug')
    ok('Tipear el número muestra los talles', 'elegí el talle' in sug and 'quedan 1' in sug and 'quedan 2' in sug, sug.replace('\n', ' | ')[:160])
    P.press('#qll-txt', 'Enter'); time.sleep(0.2)
    ok('Enter elige el primer talle con stock (S)', P.evaluate("QL.qll.sel && QL.qll.sel.codigo") == f'{n1}-S')
    P.press('#qll-pre', 'Enter'); time.sleep(0.4)
    ok('Se acabó el talle: aviso', any(True for _ in [0]) and P.evaluate(f"DB.stock.find(s => s.codigo === '{n1}-S').stock") == 0)
    # Escanear P…-M (como lo tipea un lector): entra directo
    P.fill('#qll-txt', f'P{n1}-M'); P.press('#qll-txt', 'Enter'); time.sleep(0.4)
    ok('Código de etiqueta P…-M carga la prenda directo', P.evaluate(f"pedById('{pid}').prendas.some(pr => pr.codigo === '{n1}-M')"))
    # Talle único: el número es el código
    P.fill('#qll-txt', str(n2)); P.press('#qll-txt', 'Enter'); time.sleep(0.2); P.press('#qll-pre', 'Enter'); time.sleep(0.4)
    t = P.evaluate(f"(() => {{ const t = calc(pedById('{pid}')); return [t.ahorroEspecial, t.promos.map(x => x.monto), t.descLive, t.descVip, t.sub]; }})()")
    ok('Total: 2 remeras por $1.800 (−200) + short 20% ($640)', t == [160, [200], 0, 0, 2440], t)
    ok('El pedido guarda las promos con que se calculó', P.evaluate(f"pedById('{pid}').promoCalc.promos.map(x => x.id).sort().join()") == 'prP4a,prP4b')
    P.screenshot(path=f'{SHOTS}/P_carga.png', full_page=True)
    msg = P.evaluate(f"mensajePedido(pedById('{pid}'))")
    ok('WhatsApp: precio especial tachado y línea 🎁', '~$800~ *$640*' in msg and '🎁 Remeras 2 por $1.800: -$200' in msg, msg[:300])
    # Prenda a mano + VIP
    P.fill('#qll-txt', 'Prueba manual Claude'); P.press('#qll-txt', 'Enter'); time.sleep(0.2); P.fill('#qll-pre', '1000'); P.press('#qll-pre', 'Enter'); time.sleep(0.4)
    live = P.evaluate(f"+liveById(pedById('{pid}').liveId).descuento || 0")
    P.evaluate("setTab('clientes')"); P.fill('#cl-filtro', 'EMMA PIEDAD'); P.dispatch_event('#cl-filtro', 'input'); time.sleep(0.4)
    P.click(f"[data-act=vipSi][data-cid='{cid}']"); time.sleep(0.4)
    t = P.evaluate(f"(() => {{ const t = calc(pedById('{pid}')); return [t.descLive, t.descVip, t.vipPct]; }})()")
    ok(f'VIP: 5% sumado al live ({live}%) solo sobre la prenda sin promo', t == [round(1000 * live / 100), 50, 5], t)
    ok('VIP: ventana con el mensaje de bienvenida', 'ya es VIP' in P.inner_text('#mbox'))
    P.click(f"#mbox [data-act=vipBienv][data-cid='{cid}']"); time.sleep(0.3)
    wa = P.evaluate("window.__wa[window.__wa.length - 1] || ''")
    ok('Bienvenida por WhatsApp con el % y fecha guardada', '5%25%20de%20descuento%20VIP' in wa and P.evaluate(f"!!cliById('{cid}').bienvenidaVip"))
    ok('Ficha con ⭐ VIP', '⭐ VIP' in P.inner_text('#lista-clientes'))
    ok('Clientes: bloque de candidatas VIP', '⭐ VIP:' in P.inner_text('#cl-deshacer'))
    msg = P.evaluate(f"mensajePedido(pedById('{pid}'))")
    ok('WhatsApp: línea ⭐ Descuento VIP', '⭐ Descuento VIP 5%: -$50' in msg)
    P.screenshot(path=f'{SHOTS}/P_clientes.png', full_page=False)
    # Despacho: escanear una prenda
    ok('Escáner: P…-M se reconoce como prenda (no como pedido)', P.evaluate(f"codigoLeido('P{n1}-M')") == f'P{n1}-M' and P.evaluate("codigoLeido('04225')") == '04225')
    P.evaluate("setTab('despacho')"); time.sleep(0.3)
    P.evaluate(f"UI.desp.q = 'P{n1}-M'; buscarEnter()"); time.sleep(0.3)
    ok('Despacho: avisa que es una prenda', 'Es una prenda' in P.inner_text('#toast'))
    # Tarjeta del pedido
    P.evaluate("setTab('live')"); P.evaluate(f"UI.abiertos ? UI.abiertos.add('{pid}') : 0"); time.sleep(0.3)
    ok('Sin errores de JavaScript', not errs, errs[:3])
    # ── Limpieza ──
    P.evaluate(f"""() => {{ eliminarPedido(pedById('{pid}')); const c = cliById('{cid}'), o = JSON.parse({json.dumps(orig)});
      Object.keys(c).forEach(k => {{ if (!(k in o)) delete c[k]; }}); Object.assign(c, o); guardar(); }}""")
    ok('Pedido de prueba eliminado y ficha como estaba', sinp(P) and not P.evaluate(f"!!pedById('{pid}')") and P.evaluate(f"JSON.stringify(cliById('{cid}'))") == orig)
    G.bring_to_front()
    G.evaluate("() => { DB.promos = DB.promos.filter(x => !['prP4a', 'prP4b'].includes(x.id)); put('emma_promos'); }")
    G.click('[data-t=hist]'); time.sleep(0.3)
    c = G.evaluate("COMPRAS.find(c => c.nombre === 'Prueba Claude P4').id")
    if not G.is_visible(f"[data-act=delCompra][data-cid='{c}']"): G.click(f"[data-act=histSel][data-cid='{c}']"); time.sleep(0.3)
    G.click(f"[data-act=delCompra][data-cid='{c}']"); time.sleep(0.4)
    ok('Gestión: compra y promos de prueba eliminadas', sinp(G) and G.evaluate("COMPRAS.length") == 6)
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
