import os, time, json
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/'
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/shots2'
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(nombre, cond, extra=''):
    RES.append((nombre, bool(cond), str(extra))); print(('✅' if cond else '❌'), nombre, extra, flush=True)

# Blindaje: el código real nunca se sube; el pasaje a números se hace solo en memoria (se marca como "ya sincronizado")
BLINDAJE = """() => {
  const orig = COL.config.lista;
  COL.config.lista = () => orig().filter(x => x.clave !== 'gestionAcceso');
  NUBE.listo = false;
  const n = migrarModelos();
  for (const col of ['modelos', 'stock', 'config']) for (const o of COL[col].lista()) { const f = COL[col].fila(o), id = f[pk(col)]; NUBE.ult[col].set(id, firma(col, f)); NUBE.filas[col].set(id, f); NUBE.out[col].delete(id); }
  NUBE.listo = true;
  window.__prints = 0; window.print = () => { window.__prints++; };
  return n;
}"""

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
    page.wait_for_selector('#lg-email, #lock', timeout=60000)
    if page.is_visible('#login'):
        page.fill('#lg-email', EMAIL); page.fill('#lg-pass', PASS); page.click('#lg-btn')
    assert esperar(page, "typeof NUBE !== 'undefined' && NUBE.listo", 150), 'no cargó la nube'
def sin_pendientes(page, t=40):
    return esperar(page, "pendientes() === 0 && !NUBE.subiendo", t)
def dialogo(d):
    if d.type == 'prompt': d.accept(d.default_value)
    else: d.accept()
def chg(page, sel, val):
    page.fill(sel, str(val)); page.dispatch_event(sel, 'change'); time.sleep(0.25)

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    ctxA = br.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    ctxB = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    logs = []
    A = ctxA.new_page(); B = ctxB.new_page()
    for nom, pg in (('A', A), ('B', B)):
        pg.on('console', lambda m, n=nom: logs.append(n + ' ' + m.type + ': ' + m.text))
        pg.on('pageerror', lambda e, n=nom: logs.append(n + ' PAGEERROR: ' + str(e)))
        pg.on('dialog', dialogo)

    # ── Entrar (A compu) ──
    login(A, BASE + 'gestion.html')
    real_stock = A.evaluate("DB.stock.length")
    mig = A.evaluate(BLINDAJE)
    ok('A: pasaje a números (solo en memoria de la prueba)', mig == real_stock and A.evaluate("DB.modelos.length") == real_stock, f'{mig} artículos')
    ok('A: el pasaje no dejó nada para subir', A.evaluate("pendientes()") == 0)
    alias = A.evaluate("DB.modelos.find(m => m.alias.length).alias[0]")
    numAlias = A.evaluate(f"DB.modelos.find(m => m.alias[0] === '{alias}').num")
    ok('A: números correlativos 1..N, código viejo guardado', A.evaluate("DB.modelos.map(m => m.num).sort((a,b)=>a-b).every((n,i)=>n===i+1)") and alias, f'{alias} → {numAlias}')
    A.evaluate("() => { DB.config.gestionAcceso = null; pintarLock(); }")
    A.fill('#lk-code', '4321'); A.fill('#lk-code2', '4321'); A.click('#lk-btn')
    ok('A: entra', esperar(A, "!document.getElementById('app').hidden", 20))
    acceso = A.evaluate("JSON.stringify(cfg('gestionAcceso'))")
    ok('A: las 6 compras viejas se leen en el formato nuevo (bloqueadas)', A.evaluate("COMPRAS.length === 6 && COMPRAS.every(c => c._bloqueada && c.lineas.length && c.estado === 'recibida')"))
    A.click('[data-t=stock]'); A.fill('#st-q', alias); time.sleep(0.4)
    ok('Stock: se encuentra por código viejo', f'antes {alias}' in A.inner_text('#st-lista'))
    A.fill('#st-q', ''); time.sleep(0.3)

    # ── 1. Pedido de importación (no toca stock) ──
    A.click('[data-t=imp]')
    A.fill('#ai-nombre', 'Prueba Claude etapa 2'); A.dispatch_event('#ai-nombre', 'input')
    for k, v in (('blue', 1500), ('uyu', 40), ('costo', 2000)): A.fill('#ai-' + k, str(v)); A.dispatch_event('#ai-' + k, 'input')
    A.fill('#ai-desc', 'Remera Prueba Claude'); A.fill('#ai-qty', '10'); A.fill('#ai-pimp', '8000'); A.fill('#ai-preal', '12000'); A.click('[data-act=addImp]')
    A.fill('#ai-desc', 'Short Prueba Claude'); A.fill('#ai-qty', '4'); A.fill('#ai-pimp', '7000'); A.fill('#ai-preal', '10000'); A.press('#ai-preal', 'Enter')
    ok('Pedido: 2 líneas en el borrador', A.evaluate("BOR.imp.lineas.length") == 2)
    ok('Pedido: costo aprox. (12000/1500×40 + 2000/14 = $463)', '$463' in A.inner_text('#ai-lista'), A.evaluate("Math.round(BOR.imp.lineas[0]._costo)"))
    ok('Pedido: PDF del importador se genera', A.evaluate("pdfImportador(Object.assign({tipo:'importacion'}, BOR.imp)).length") > 800)
    A.screenshot(path=f'{SHOTS}/A_pedido.png', full_page=True)
    st0 = A.evaluate("DB.stock.length"); mo0 = A.evaluate("DB.modelos.length")
    A.click('#ai-guardar')
    ok('Pedido guardado como 📤 Pedida', esperar(A, "COMPRAS.some(c => c.nombre === 'Prueba Claude etapa 2' && c.estado === 'pedida')", 10))
    ok('Pedido: NO tocó el stock', A.evaluate("DB.stock.length") == st0 and A.evaluate("DB.modelos.length") == mo0)
    ok('A: subido', sin_pendientes(A))
    cid = A.evaluate("COMPRAS.find(c => c.nombre === 'Prueba Claude etapa 2').id")

    # ── 2. Celu: recibe y abre en colores y talles ──
    login(B, BASE + 'gestion.html')
    B.evaluate(BLINDAJE)
    B.evaluate(f"() => {{ DB.config.gestionAcceso = {acceso}; pintarLock(); }}")
    B.fill('#lk-code', '4321'); B.click('#lk-btn')
    ok('B: entra y ve el pedido', esperar(B, f"!document.getElementById('app').hidden && compraById('{cid}') && compraById('{cid}').estado === 'pedida'", 25))
    B.click('[data-t=hist]'); time.sleep(0.3)
    B.click(f"[data-act=histSel][data-cid='{cid}']"); time.sleep(0.3)
    B.click(f"[data-act=rcAbrir][data-cid='{cid}']"); time.sleep(0.4)
    l1, l2 = B.evaluate(f"compraById('{cid}').lineas.map(l => l.lid)")
    k1 = B.evaluate(f"compraById('{cid}').lineas[0].modelos[0].k")
    ix = lambda k: f"{cid}-{k}"
    chg(B, f"#rn-{ix(k1)}", 'Remera Prueba Claude blanca')
    B.select_option(f"#rt-{ix(k1)}", 'letras'); time.sleep(0.3)
    for t, q in (('S', 2), ('M', 2), ('L', 1)): chg(B, f"#rq-{ix(k1)}-{t}", q)
    chg(B, f"#rp-{ix(k1)}", 690)
    B.click(f"[data-act=rcAddMo][data-lid='{l1}']"); time.sleep(0.3)
    k2 = B.evaluate(f"compraById('{cid}').lineas[0].modelos[1].k")
    chg(B, f"#rn-{ix(k2)}", 'Remera Prueba Claude negra')
    for t, q in (('S', 1), ('M', 2), ('L', 1)): chg(B, f"#rq-{ix(k2)}-{t}", q)
    k3 = B.evaluate(f"compraById('{cid}').lineas[1].modelos[0].k")
    chg(B, f"#rn-{ix(k3)}", 'Short Prueba Claude jean')
    B.select_option(f"#rc-{ix(k3)}", 'Short'); B.dispatch_event(f"#rc-{ix(k3)}", 'change')
    B.select_option(f"#rt-{ix(k3)}", 'numeros'); time.sleep(0.4)
    for t, q in (('38', 2), ('40', 1)): chg(B, f"#rq-{ix(k3)}-{t}", q)
    chg(B, f"#rp-{ix(k3)}", 590)
    t = B.evaluate(f"(() => {{ const t = calcCompra(compraById('{cid}'), true); return [t.recU, t.pedU, t.faltU, Math.round(t.faltUYU), Math.round(compraById('{cid}').lineas[0]._costo)]; }})()")
    ok('Recepción: 12 de 14, faltan 2 ($587), costo remera $536 (gasto + faltantes repartidos)', t == [12, 14, 2, 587, 536], t)
    ok('Recepción: el 2º color hereda precio', B.evaluate(f"compraById('{cid}').lineas[0].modelos[1].precioVenta") == 690)
    B.screenshot(path=f'{SHOTS}/B_recepcion.png', full_page=True)
    w = B.evaluate("document.documentElement.scrollWidth")
    ok('Recepción en el celu entra en el ancho', w <= 392, f'{w}px')
    ok('B: borrador de recepción subido (sigue Pedida)', sin_pendientes(B) and B.evaluate(f"compraById('{cid}').estado") == 'pedida')
    nmax = B.evaluate("proximoNum()")
    B.click(f"[data-act=rcOk][data-cid='{cid}']")
    ok('Recepción confirmada → Recibida', esperar(B, f"compraById('{cid}').estado === 'recibida'", 10))
    nums = B.evaluate(f"compraById('{cid}').lineas.flatMap(l => l.modelos.map(mo => modeloById(mo.mid).num))")
    ok('3 modelos nuevos con números seguidos', nums == [nmax, nmax + 1, nmax + 2], nums)
    vars_ = B.evaluate(f"variantesDe(modeloByNum({nmax}).id).map(s => s.codigo + ':' + s.stock)")
    ok('Talles con su código y stock (blanca)', vars_ == [f'{nmax}-S:2', f'{nmax}-M:2', f'{nmax}-L:1'], vars_)
    ok('Short con talles numéricos', B.evaluate(f"variantesDe(modeloByNum({nmax+2}).id).map(s => s.codigo + ':' + s.stock)") == [f'{nmax+2}-38:2', f'{nmax+2}-40:1'])
    ok('Ofrece las etiquetas (12)', esperar(B, "document.getElementById('mbox').dataset.tipo === 'etq'", 5) and B.evaluate("ETQ.reduce((n,e)=>n+e.qty,0)") == 12)
    B.screenshot(path=f'{SHOTS}/B_etiquetas_modal.png')
    B.click('[data-act=etqImprimir]'); time.sleep(0.5)
    ok('Imprime 12 etiquetas con QR "P"+código', B.evaluate("window.__prints") == 1 and B.evaluate("document.querySelectorAll('#print-area .pl').length") == 12 and B.evaluate(f"!!document.querySelector('#print-area [data-qr=\"P{nmax}-S\"]')"))
    B.evaluate("document.getElementById('print-area').style.cssText='display:block;background:#fff;padding:10px'")
    B.locator('#print-area').screenshot(path=f'{SHOTS}/etiquetas_50x30.png')
    B.evaluate("document.getElementById('print-area').style.cssText=''")
    B.click('[data-act=closeModal]')
    ok('B: subido', sin_pendientes(B))
    ok('Base: la compra viaja encriptada (sin precios a la vista)', B.evaluate(f"(() => {{ const r = NUBE.compras.find(x => x.id === '{cid}'); return r.v === 3 && !!r.priv && !JSON.stringify(r).includes('12000'); }})()"))

    # ── 3. Compu y Pedidos lo ven ──
    ok('A: ve la recepción y los modelos nuevos', esperar(A, f"compraById('{cid}') && compraById('{cid}').estado === 'recibida' && modeloByNum({nmax+2}) && variantesDe(modeloByNum({nmax+2}).id).length === 2", 25))
    P = ctxA.new_page(); P.on('pageerror', lambda e: logs.append('P PAGEERROR: ' + str(e)))
    P.goto(BASE)
    ok('Pedidos: ve los talles como artículos ("…blanca T.S", código con talle)', esperar(P, f"typeof NUBE !== 'undefined' && NUBE.listo && DB.stock.some(s => s.codigo === '{nmax}-S' && s.descripcion === 'Remera Prueba Claude blanca T.S' && s.precioVenta === 690 && s.stock === 2)", 150))
    ok('Pedidos: nada pendiente', P.evaluate("pendientes()") == 0)
    P.close()

    # ── 4. Faltantes: llegó después y reintegrado (A) ──
    A.click('[data-t=hist]'); time.sleep(0.3)
    if not A.is_visible(f"[data-act=delCompra][data-cid='{cid}']"): A.click(f"[data-act=histSel][data-cid='{cid}']"); time.sleep(0.3)
    A.screenshot(path=f'{SHOTS}/A_recibida.png', full_page=True)
    ok('Historial: chip de faltantes', '2 faltantes' in A.inner_text('#h-lista'))
    A.click(f"[data-act=lnLlego][data-lid='{l2}']"); time.sleep(0.3)
    A.select_option('#ll-t', '42'); A.fill('#ll-q', '1'); A.click('[data-act=llOk]'); time.sleep(0.5)
    ok('Llegó después: talle 42 creado con 1', A.evaluate(f"(variantesDe(modeloByNum({nmax+2}).id).find(s => s.talle === '42')||{{}}).stock") == 1)
    A.click('[data-act=closeModal]')
    A.click(f"[data-act=lnReint][data-lid='{l1}']"); time.sleep(0.4)
    t2 = A.evaluate(f"(() => {{ const t = calcCompra(compraById('{cid}')); return [t.faltU, Math.round(t.pctImp*10)/10, Math.round(t.pctReal*10)/10, Math.round(compraById('{cid}').lineas[0]._costo)]; }})()")
    ok('Reintegrado: 0 faltantes, % real = % gasto, costo vuelve a $474', t2[0] == 0 and t2[1] == t2[2] and t2[3] == 474, t2)
    ok('A: subido', sin_pendientes(A))

    # ── 5. Compra local con reposición (A) ──
    A.click('[data-t=local]')
    A.fill('#al-nombre', 'Prueba Claude local'); A.dispatch_event('#al-nombre', 'input')
    chg(A, '#al-nom', f'{nmax} · Remera Prueba Claude blanca')
    ok('Reposición detectada (mismo número)', A.evaluate("FORM.al.mid") == A.evaluate(f"modeloByNum({nmax}).id") and 'Reposición' in A.inner_text('#al-rep'))
    A.fill('#al-t-M', '3'); A.fill('#al-pcomp', '300'); A.click('[data-act=addLocal]'); time.sleep(0.3)
    chg(A, '#al-nom', 'Top Prueba Claude rojo')
    A.select_option('#al-tipo', 'unico'); A.dispatch_event('#al-tipo', 'change'); time.sleep(0.3)
    A.fill('#al-t-U', '2'); A.fill('#al-pcomp', '250'); A.fill('#al-pv', '590'); A.click('[data-act=addLocal]'); time.sleep(0.3)
    ok('Compra local: 2 prendas (1 reposición, 1 nueva)', A.evaluate("BOR.local.lineas.length") == 2 and 'reposición' in A.inner_text('#al-lista'))
    A.screenshot(path=f'{SHOTS}/A_local.png', full_page=True)
    A.click('#al-guardar'); time.sleep(0.8)
    ok('Reposición sumó al mismo número: M = 2 + 3', A.evaluate(f"variantesDe(modeloByNum({nmax}).id).find(s => s.talle === 'M').stock") == 5)
    ok('Top nuevo con número siguiente, talle único (código sin guion)', A.evaluate(f"(variantesDe((modeloByNum({nmax+3})||{{}}).id).map(s => s.codigo + ':' + s.stock)).join()") == f'{nmax+3}:2')
    ok('Ofrece etiquetas solo de lo nuevo (5)', A.evaluate("ETQ.reduce((n,e)=>n+e.qty,0)") == 5)
    A.click('[data-act=closeModal]')
    ok('A: subido', sin_pendientes(A))
    cloc = A.evaluate("COMPRAS.find(c => c.nombre === 'Prueba Claude local').id")

    # ── 6. Stock por modelo (A) ──
    A.click('[data-t=stock]'); A.fill('#st-q', 'prueba claude'); A.dispatch_event('#st-q', 'input'); time.sleep(0.4)
    mid = A.evaluate(f"modeloByNum({nmax}).id"); sS = A.evaluate(f"variantesDe('{mid}').find(s => s.talle === 'S').id")
    A.click(f"[data-act=stkAbrir][data-id='{mid}']"); time.sleep(0.3)
    A.click(f"[data-act=stkAj][data-id='{sS}'][data-d='-1']"); time.sleep(0.2); A.click(f"[data-act=stkAj][data-id='{sS}'][data-d='-1']"); time.sleep(0.3)
    ok('Se acabó un talle: aviso "se acabó: S"', 'se acabó: S' in A.inner_text('#st-lista'))
    A.fill(f"#sd-pv-{mid}", '750'); A.click(f"[data-act=stkGuardar][data-id='{mid}']"); time.sleep(0.5)
    ok('Cambio de precio pasa a todos los talles', A.evaluate(f"variantesDe('{mid}').every(s => s.precioVenta === 750)"))
    ok('Ofrece reimprimir etiquetas del modelo', A.evaluate("document.getElementById('mbox').dataset.tipo") == 'etq')
    A.click('[data-act=closeModal]')
    A.select_option(f"#sd-nt-{mid}", 'XL'); A.click(f"[data-act=stkTalle][data-id='{mid}']"); time.sleep(0.3)
    ok('Agregar talle XL (código con talle)', A.evaluate(f"!!variantesDe('{mid}').find(s => s.codigo === '{nmax}-XL')"))
    A.click(f"[data-act=etqVar][data-id='{sS}']"); time.sleep(0.3)
    ok('Etiqueta suelta de un talle', A.evaluate("document.querySelectorAll('#print-area .pl').length") == 1)
    A.screenshot(path=f'{SHOTS}/A_stock_modelo.png', full_page=True)
    # Alta de mercadería que ya tenía
    A.click('#st-alta summary'); time.sleep(0.2)
    chg(A, '#sa-nom', 'Vestido Prueba Claude verde')
    A.select_option('#sa-tipo', 'numeros'); A.dispatch_event('#sa-tipo', 'change'); time.sleep(0.3)
    A.fill('#sa-t-38', '1'); A.fill('#sa-pv', '990'); A.click('[data-act=stkAlta]'); time.sleep(0.5)
    ok('Alta: modelo nuevo con número siguiente', A.evaluate(f"(variantesDe((modeloByNum({nmax+4})||{{}}).id)[0]||{{}}).codigo") == f'{nmax+4}-38')
    A.click('[data-act=closeModal]')
    ok('A: subido', sin_pendientes(A))
    ok('B: ve todo en tiempo real', esperar(B, f"modeloByNum({nmax+4}) && variantesDe(modeloByNum({nmax}).id).find(s => s.talle === 'M').stock === 5 && modeloByNum({nmax}).precioVenta === 750", 25))

    # ── 7. Celu: todas las pestañas sin scroll lateral ──
    B.click('[data-act=closeModal]') if B.is_visible('#modal') else None
    for tb in ['imp', 'local', 'hist', 'stock', 'ventas', 'config']:
        B.click(f'[data-t={tb}]'); time.sleep(0.4)
        w = B.evaluate("document.documentElement.scrollWidth")
        ok(f'Celu: {tb} entra en el ancho', w <= 392, f'{w}px')
        B.screenshot(path=f'{SHOTS}/B_{tb}.png', full_page=True)
    B.click('[data-t=config]'); B.evaluate("window.__prints = 0"); B.select_option('#cf-rollo', 'a4'); B.dispatch_event('#cf-rollo', 'change')
    B.click('[data-act=etqProbar]'); time.sleep(0.3)
    ok('Config: formato A4 y etiqueta de prueba', B.evaluate("localStorage.getItem('emma_rollo_chico')") == 'a4' and B.evaluate("window.__prints") == 1)
    ok('A4: las etiquetas no se ven en pantalla', not B.is_visible('#print-area .pl'))

    # ── 8. Limpieza: eliminar compras (descontando stock) y liberar modelos de prueba ──
    A.click('[data-t=hist]'); time.sleep(0.3)
    for c in (cid, cloc):
        if not A.is_visible(f"[data-act=delCompra][data-cid='{c}']"): A.click(f"[data-act=histSel][data-cid='{c}']"); time.sleep(0.3)
        A.click(f"[data-act=delCompra][data-cid='{c}']"); time.sleep(0.4)
    ok('Compras de prueba eliminadas', A.evaluate(f"!compraById('{cid}') && !compraById('{cloc}') && COMPRAS.length === 6"))
    ok('Stock descontado (blanca M: 5 − 2 − 3 = 0)', A.evaluate(f"variantesDe('{mid}').find(s => s.talle === 'M').stock") == 0)
    A.evaluate("() => mutStock(() => DB.modelos.filter(m => /Prueba Claude/.test(m.nombre)).forEach(m => { m.activo = false; sincronizarVariantes(m); }))")
    ok('Modelos de prueba liberados', sin_pendientes(A) and A.evaluate("DB.modelos.filter(m => /Prueba Claude/.test(m.nombre) && m.activo !== false).length") == 0)
    errs = [l for l in logs if 'PAGEERROR' in l]
    ok('Sin errores de JavaScript', not errs, ' | '.join(errs[:4]))
    br.close()

print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
json.dump({'res': RES, 'nmax': None}, open(SHOTS + '/res.json', 'w'), ensure_ascii=False)
