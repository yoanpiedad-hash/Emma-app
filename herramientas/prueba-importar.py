import os, time, json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
SCR = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad'
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(n, c, x=''):
    RES.append((n, bool(c))); print(('✅' if c else '❌'), n, x if x != '' else '', flush=True)
NO_CFG = "['codigoCounter', 'liveActualId']"
BLIND_P = """() => { const orig = COL.config.lista, NO = %s; COL.config.lista = () => orig().filter(x => !NO.includes(x.clave)); window.open = () => null; }""" % NO_CFG
def esperar(page, js, t=30):
    fin = time.time() + t
    while time.time() < fin:
        try:
            if page.evaluate(js): return True
        except Exception: pass
        time.sleep(0.3)
    return False
def sinp(page): return esperar(page, "pendientes() === 0 && !NUBE.subiendo", 40)
with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    P = br.new_context(viewport={'width': 1280, 'height': 900}).new_page(); errs = []
    P.on('pageerror', lambda e: errs.append(str(e))); P.on('dialog', lambda d: d.accept())
    P.goto(BASE)
    if esperar(P, "(document.getElementById('login') && !document.getElementById('login').hidden) || (typeof NUBE !== 'undefined' && NUBE.listo)", 60) and P.is_visible('#login'):
        P.fill('#lg-email', EMAIL); P.fill('#lg-pass', PASS); P.click('#lg-btn')
    assert esperar(P, "typeof NUBE !== 'undefined' && NUBE.listo", 150)
    P.evaluate(BLIND_P)
    cid = P.evaluate("(DB.clientes.find(c => norm(c.nombre) === 'emma piedad') || {}).id")
    orig = P.evaluate(f"JSON.stringify(cliById('{cid}'))")
    actual0 = P.evaluate("cfg('liveActualId')")
    P.evaluate(f"cliById('{cid}').notaMabel = 'nota que solo está en la nube'")
    # Backup "de la app vieja": un live nuevo con 2 pedidos (EMMA PIEDAD con dirección cambiada + una clienta nueva)
    bk = P.evaluate(f"""(() => {{
      const e = JSON.parse(JSON.stringify(cliById('{cid}'))); delete e.notaMabel; e.direccion = 'Calle Prueba Claude 123';
      const n = {{ id: 'cPruebaClaudeImp', nombre: 'Prueba Claude clienta', tel: '099000111', telKey: '99000111', alias: [], saldoFavor: 0, historialViejo: [], ultimoUso: ahoraISO(), creado: ahoraISO() }};
      const ped = (id, num, cliId, precio) => ({{ id, codigo: String(90000 + num), num, liveId: 'lPruebaClaudeImp', clienteId: cliId, prendas: [{{ stockId: null, codigo: null, nombre: 'Prueba Claude import', precioLista: precio, precio, qty: 1 }}], descuento: null, saldoAplicado: 0, estado: 'pendiente', entrega: 'sin_definir', cobroEnvio: null, fechas: {{ creado: hoyISO() }}, avisos: [], notas: '' }});
      return {{ app: 'emma', tipo: 'backup-completo', version: 1, fecha: ahoraISO(), datos: {{
        emma_lives: [{{ id: 'lPruebaClaudeImp', nombre: 'Prueba Claude import', fecha: hoyISO(), descuento: 10, fechaPago: 'mañana', pedidoCounter: 2, pedidos: [ped('pPCimp1', 1, '{cid}', 1000), ped('pPCimp2', 2, 'cPruebaClaudeImp', 500)] }}],
        emma_clientes: [e, n], emma_stock: [{{ id: 'sNoSeImporta', codigo: 'X', stock: 99 }}] }} }};
    }})()""")
    path = f'{SCR}/backup_prueba.json'; json.dump(bk, open(path, 'w'))
    stock0 = P.evaluate("DB.stock.length")
    P.evaluate("setTab('config')"); time.sleep(0.4)
    ok('Config: tarjeta "Traer un live de la app vieja"', P.is_visible('#cf-implive'))
    P.set_input_files('#il-file', path); time.sleep(0.6)
    ok('Lista el live con 2 nuevos', '2 nuevos' in P.inner_text('#il-res'))
    P.click('[data-act=ilImportar]'); time.sleep(0.6)
    ok('Resultado: 2 pedidos, 1 clienta nueva, 1 actualizada', '2 pedidos traídos' in P.inner_text('#il-res') and '1 clientas nuevas' in P.inner_text('#il-res'), P.inner_text('#il-res'))
    ok('Live y pedidos en la nube, live actual', P.evaluate("liveById('lPruebaClaudeImp').pedidos.length === 2 && cfg('liveActualId') === 'lPruebaClaudeImp'"))
    ok('Clienta existente: dirección nueva y conserva la nota de Mabel', P.evaluate(f"cliById('{cid}').direccion === 'Calle Prueba Claude 123' && cliById('{cid}').notaMabel === 'nota que solo está en la nube'"))
    ok('No toca el stock', P.evaluate("DB.stock.length") == stock0 and not P.evaluate("DB.stock.some(s => s.id === 'sNoSeImporta')"))
    ok('Total con el 10% del live', P.evaluate("calc(pedById('pPCimp1')).total") == 900)
    ok('Mensaje de total listo', '*Total: $900*' in P.evaluate("mensajePedido(pedById('pPCimp1'))"))
    ok('Subido', sinp(P))
    # Marcar un pago en la nube y volver a importar: no se pisa
    P.evaluate("registrarPagos([pedById('pPCimp1')], { cuenta: 'BROU' }, false, null)")
    P.set_input_files('#il-file', path); time.sleep(0.6)
    ok('Re-importar: el live figura "ya está en la nube"', 'ya está en la nube' in P.inner_text('#il-res'))
    ok('El pago de la nube sigue', P.evaluate("!!pedById('pPCimp1').pago"))
    ok('Sin errores de JavaScript', not errs, errs[:3])
    # Limpieza
    P.evaluate(f"""() => {{ const p = pedById('pPCimp1'); if (p.pago) anularPago(p.pago.id); savePagos();
      for (const id of ['pPCimp1', 'pPCimp2']) {{ const x = pedById(id); if (x) eliminarPedido(x); }}
      DB.lives = DB.lives.filter(l => l.id !== 'lPruebaClaudeImp'); DB.clientes = DB.clientes.filter(c => c.id !== 'cPruebaClaudeImp');
      const c = cliById('{cid}'), o = JSON.parse({json.dumps(orig)}); Object.keys(c).forEach(k => {{ if (!(k in o)) delete c[k]; }}); Object.assign(c, o);
      DB.config.liveActualId = {json.dumps(actual0)}; guardar(); }}""")
    ok('Limpieza', sinp(P) and P.evaluate(f"JSON.stringify(cliById('{cid}'))") == orig)
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
