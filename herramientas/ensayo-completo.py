"""Ensayo completo (etapa 6): un live simulado de punta a punta contra la base real, con blindaje y limpieza.
Gestión: importación pedida → recibida con talles y un faltante, compra local, promo. Pedidos: live de ensayo con 10%,
pedidos con talles / escaneo / promo / VIP, mensajes, pagos, despacho, un liberado. Gestión: Ventas y ganancia real.
"""
import os, time, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('EMMA_BASE', 'http://localhost:8765/')
SHOTS = '/tmp/claude-0/-home-claude/e040babe-3438-5a5e-bc1b-4e81f9b9f8d2/scratchpad/ensayo'
os.makedirs(SHOTS, exist_ok=True)
EMAIL, PASS = 'prueba.claude@example.com', 'PruebaDespacho-2210'
RES = []
def ok(n, c, x=''):
    RES.append((n, bool(c))); print(('✅' if c else '❌'), n, x if x != '' else '', flush=True)
NO_CFG = "['gestionAcceso', 'vipPct', 'vipGrupo', 'vipMensaje', 'packagingPedido', 'gastosLive', 'archivarDias', 'codigoCounter', 'liveActualId', 'modelosV1']"
BLIND_G = """() => {
  const orig = COL.config.lista, NO = %s;
  COL.config.lista = () => orig().filter(x => !NO.includes(x.clave));
  NUBE.listo = false; migrarModelos();
  for (const col of ['modelos', 'stock', 'config']) for (const o of COL[col].lista()) { const f = COL[col].fila(o), id = f[pk(col)]; NUBE.ult[col].set(id, firma(col, f)); NUBE.filas[col].set(id, f); NUBE.out[col].delete(id); }
  NUBE.listo = true; window.print = () => { window.__prints = (window.__prints || 0) + 1; };
}""" % NO_CFG
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
def dlg(d): d.accept(d.default_value) if d.type == 'prompt' else d.accept()
def chg(page, sel, val): page.fill(sel, str(val)); page.dispatch_event(sel, 'change'); time.sleep(0.25)
def cargar(P, txt, precio=None):
    P.fill('#qll-txt', txt); P.dispatch_event('#qll-txt', 'input'); time.sleep(0.2); P.press('#qll-txt', 'Enter'); time.sleep(0.25)
    if P.evaluate("!!QL.qll.sel"):
        if precio is not None: P.fill('#qll-pre', str(precio))
        P.press('#qll-pre', 'Enter'); time.sleep(0.3)

with sync_playwright() as p:
    br = p.chromium.launch(proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '192.0.2.2,localhost,127.0.0.1'})
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    errs = []
    G = ctx.new_page(); G.on('pageerror', lambda e: errs.append('G ' + str(e))); G.on('dialog', dlg)
    login(G, BASE + 'gestion.html'); G.evaluate(BLIND_G)
    G.evaluate("() => { DB.config.gestionAcceso = null; pintarLock(); }")
    G.fill('#lk-code', '4321'); G.fill('#lk-code2', '4321'); G.click('#lk-btn')
    ok('1. Gestión abre (candado)', esperar(G, "!document.getElementById('app').hidden", 20))

    # ── 2. Importación: pedido → recepción con talles y un faltante ──
    G.click('[data-t=imp]'); G.fill('#ai-nombre', 'Prueba Claude ensayo imp'); G.dispatch_event('#ai-nombre', 'input')
    for k, v in (('blue', 1500), ('uyu', 40), ('costo', 1200)): G.fill('#ai-' + k, str(v)); G.dispatch_event('#ai-' + k, 'input')
    G.fill('#ai-desc', 'Remera Prueba Claude E'); G.fill('#ai-qty', '6'); G.fill('#ai-pimp', '9000'); G.fill('#ai-preal', '15000'); G.click('[data-act=addImp]'); time.sleep(0.3)
    G.click('#ai-guardar'); time.sleep(0.8)
    cimp = G.evaluate("COMPRAS.find(c => c.nombre === 'Prueba Claude ensayo imp').id")
    G.click(f"[data-act=rcAbrir][data-cid='{cimp}']"); time.sleep(0.4)
    k = G.evaluate(f"compraById('{cimp}').lineas[0].modelos[0].k")
    ix = f"{cimp}-{k}"
    chg(G, f"#rn-{ix}", 'Remera Prueba Claude E blanca')
    for t, q in (('S', 2), ('M', 2), ('L', 1)): chg(G, f"#rq-{ix}-{t}", q)
    chg(G, f"#rp-{ix}", 1290)
    G.click(f"[data-act=rcOk][data-cid='{cimp}']"); time.sleep(0.8)
    ok('2. Importación recibida: 5 de 6, 1 faltante', G.evaluate(f"compraById('{cimp}').estado") == 'recibida' and G.evaluate(f"calcCompra(compraById('{cimp}')).faltU") == 1)
    G.click('#mbox [data-act=closeModal]')
    nR = G.evaluate("DB.modelos.find(m => m.nombre === 'Remera Prueba Claude E blanca').num")
    costoR = G.evaluate(f"Math.round(compraById('{cimp}').lineas[0]._costo)")
    ok('   costo con gasto + faltante repartido (15000/1500×40 = 400 + (1200+400)/5 = 720)', costoR == 720, costoR)

    # ── 3. Compra local + promo ──
    G.click('[data-t=local]'); G.fill('#al-nombre', 'Prueba Claude ensayo local'); G.dispatch_event('#al-nombre', 'input')
    chg(G, '#al-nom', 'Short Prueba Claude E'); G.select_option('#al-cat', 'Short'); G.select_option('#al-tipo', 'unico'); G.dispatch_event('#al-tipo', 'change'); time.sleep(0.2)
    G.fill('#al-t-U', '4'); G.fill('#al-pcomp', '350'); G.fill('#al-pv', '890'); G.click('[data-act=addLocal]'); time.sleep(0.3)
    G.click('#al-guardar'); time.sleep(0.8); G.click('#mbox [data-act=closeModal]')
    nS = G.evaluate("DB.modelos.find(m => m.nombre === 'Short Prueba Claude E').num")
    G.click('[data-t=promos]'); G.click('[data-act=promoNueva]'); time.sleep(0.3)
    G.select_option('#mbox [data-f=tipo]', 'combo'); G.dispatch_event('#mbox [data-f=tipo]', 'change'); time.sleep(0.3)
    chg(G, '#mbox [data-f=nombre]', 'Shorts 2 por $1.500'); chg(G, '#mbox [data-f=x]', 1500)
    G.fill('#pf-mod', f'P{nS}'); G.click('[data-act=pfAddMod]'); time.sleep(0.3)
    G.click('[data-act=pfGuardar]'); time.sleep(0.4)
    ok('3. Compra local y promo "Shorts 2 por $1.500"', nS and G.evaluate("DB.promos.some(p => p.nombre === 'Shorts 2 por $1.500')") and sinp(G), (nR, nS))

    # ── 4. Pedidos: live de ensayo ──
    P = ctx.new_page(); P.on('pageerror', lambda e: errs.append('P ' + str(e))); P.on('dialog', dlg)
    login(P, BASE); P.evaluate(BLIND_P)
    ok('4. Pedidos ve talles y promo', esperar(P, f"DB.stock.some(s => s.codigo === '{nR}-M') && (DB.promos||[]).some(x => x.nombre === 'Shorts 2 por $1.500')", 30))
    lid = P.evaluate("""(() => { const l = { id: uid('l'), nombre: 'Prueba Claude ensayo', fecha: hoyISO(), descuento: 10, fechaPago: 'mañana', pedidos: [], pedidoCounter: 0 }; DB.lives.push(l); DB.config.liveActualId = l.id; guardar(); return l.id; })()""")
    cid = P.evaluate("(DB.clientes.find(c => norm(c.nombre) === 'emma piedad') || {}).id")
    orig = P.evaluate(f"JSON.stringify(cliById('{cid}'))")
    P.evaluate("setTab('live')"); time.sleep(0.3)
    # Pedido A: 1 remera M (tipeando el número) + 2 shorts (promo)
    pa = P.evaluate(f"crearPedido(liveById('{lid}'), cliById('{cid}')).id"); P.evaluate(f"abrirCarga('{pa}')"); time.sleep(0.3)
    P.fill('#qll-txt', str(nR)); P.dispatch_event('#qll-txt', 'input'); time.sleep(0.2)
    P.press('#qll-txt', 'ArrowDown'); P.press('#qll-txt', 'Enter'); time.sleep(0.2); P.press('#qll-pre', 'Enter'); time.sleep(0.3)
    cargar(P, str(nS)); cargar(P, str(nS))
    ta = P.evaluate(f"(() => {{ const t = calc(pedById('{pa}')); return [pedById('{pa}').prendas.map(x => x.codigo + 'x' + x.qty).join(), t.promos.map(x => x.monto), t.descLive, t.total]; }})()")
    ok('5. Pedido A: remera M + 2 shorts → promo −280, 10% live solo a la remera (−129), total $2.661', ta == [f'{nR}-Mx1,{nS}x2', [280], 129, 2661], ta)
    # Pedido B: escaneo P…-S + prenda manual
    pb = P.evaluate(f"crearPedido(liveById('{lid}'), cliById('{cid}')).id"); P.evaluate(f"abrirCarga('{pb}')"); time.sleep(0.3)
    P.fill('#qll-txt', f'P{nR}-S'); P.press('#qll-txt', 'Enter'); time.sleep(0.4)
    cargar(P, 'Collar ensayo', 300)
    # Pedido C: remera L (después se libera)
    pc = P.evaluate(f"crearPedido(liveById('{lid}'), cliById('{cid}')).id"); P.evaluate(f"abrirCarga('{pc}')"); time.sleep(0.3)
    P.fill('#qll-txt', f'{nR}-L'); P.press('#qll-txt', 'Enter'); time.sleep(0.2); P.press('#qll-pre', 'Enter'); time.sleep(0.3)
    ok('6. Pedidos B (escaneo + manual) y C cargados', P.evaluate(f"pedById('{pb}').prendas.length === 2 && pedById('{pc}').prendas.length === 1"))
    ok('   stock: S 2−1, M 2−1, L 1−1, shorts 4−2', P.evaluate(f"['S','M','L'].map(t => DB.stock.find(s => s.codigo === '{nR}-' + t).stock).join() + '|' + DB.stock.find(s => s.codigo === '{nS}').stock") == '1,1,0|2')
    # VIP
    P.evaluate("setTab('clientes')"); P.fill('#cl-filtro', 'EMMA PIEDAD'); P.dispatch_event('#cl-filtro', 'input'); time.sleep(0.4)
    P.click(f"[data-act=vipSi][data-cid='{cid}']"); time.sleep(0.4)
    P.click(f"#mbox [data-act=vipBienv][data-cid='{cid}']"); time.sleep(0.3)
    tb = P.evaluate(f"(() => {{ const t = calc(pedById('{pb}')); return [t.descLive, t.descVip, t.total]; }})()")
    ok('7. VIP: pedido B (1290 + 300) → live −159 y VIP −80 → $1.351', tb == [159, 80, 1351], tb)
    ok('   bienvenida VIP enviada', any('Comunidad VIP' in u for u in P.evaluate("window.__wa")))
    msg = P.evaluate(f"mensajePedido(pedById('{pa}'))")
    ok('8. WhatsApp del pedido A: promo, live y VIP', '🎁 Shorts 2 por $1.500: -$280' in msg and '🎉 Descuento live 10%' in msg and '⭐ Descuento VIP 5%' in msg and '*Total: $2.596*' in msg, msg[:400])
    # Pagos y despacho
    P.evaluate(f"registrarPagos([pedById('{pa}')], {{ cuenta: 'BROU' }}, false, null)")
    P.evaluate(f"registrarPagos([pedById('{pb}')], {{ cuenta: 'Prex' }}, false, null)")
    P.evaluate(f"(() => {{ crearPaquete(cliById('{cid}'), [pedById('{pa}')], 'retiro', {{}}, []); savePaquetes(); guardar(); }})()")
    P.evaluate(f"setEstado(pedById('{pc}'), 'liberado'); guardar()")
    ok('9. Pagos (BROU, Prex), retiro del A, C liberado (la L vuelve al stock)', sinp(P) and P.evaluate(f"DB.stock.find(s => s.codigo === '{nR}-L').stock") == 1)
    # ── Gestión: Ventas del live de ensayo ──
    ok('10. Gestión recibe todo', esperar(G, f"DB.lives.some(l => l.id === '{lid}') && DB.lives.find(l => l.id === '{lid}').pedidos.length === 3", 30))
    G.evaluate(f"UI.vt.live = '{lid}'; setTab('ventas')"); time.sleep(0.6)
    r = G.evaluate(f"""(() => {{ const r = resumenLive(DB.lives.find(l => l.id === '{lid}'), mapaCostos());
      return {{ vend: r.vendido, cob: r.cobrado, nCob: r.nCob, lib: r.nLib, brou: r.cuentas.get('BROU'), prex: r.cuentas.get('Prex'), ret: r.salidas.retiro, arm: r.paraArmar, dP: r.dPromo, dV: r.dVip, dL: r.dLive, costo: Math.round(r.costo), gan: Math.round(r.ventaConCosto - r.costo) }}; }})()""")
    ok('11. Ventas: vendido = cobrado = A + B; 1 liberado', r['vend'] == 2596 + 1351 and r['cob'] == r['vend'] and r['nCob'] == 2 and r['lib'] == 1, r)
    ok('    cobros por cuenta BROU $2.596 · Prex $1.351, 1 retiro, 1 para armar', r['brou'] == 2596 and r['prex'] == 1351 and r['ret'] == 1 and r['arm'] == 1)
    ok('    descuentos: promo 280, VIP 65+80, live 129+159', r['dP'] == 280 and r['dV'] == 145 and r['dL'] == 288, (r['dP'], r['dV'], r['dL']))
    ok('    costo de lo vendido: 2 remeras × 720 + 2 shorts × 350 = 2.140', r['costo'] == 2140, r['costo'])
    G.fill('#vg-desc', 'Ayudante ensayo'); G.fill('#vg-monto', '500'); G.click('[data-act=gastoAdd]'); time.sleep(0.4)
    txt = G.inner_text('#v-cont')
    ok('12. Ganancia real con packaging 2×$30 y gasto extra', 'Ganancia real' in txt and '−$60' in txt and 'Ayudante ensayo' in txt)
    G.screenshot(path=f'{SHOTS}/ventas_ensayo.png', full_page=False)
    ok('Sin errores de JavaScript', not errs, errs[:3])

    # ── Limpieza ──
    P.evaluate(f"""() => {{
      const ps = liveById('{lid}').pedidos.slice();
      for (const k of (DB.paquetes || []).filter(k => ps.some(p => k.pedidos.includes(p.id)))) deshacerPaquete(k.id);
      for (const p of ps) if (p.pago) anularPago(p.pago.id);
      savePagos(); savePaquetes();
      for (const p of liveById('{lid}').pedidos.slice()) eliminarPedido(p);
      DB.lives = DB.lives.filter(l => l.id !== '{lid}');
      const c = cliById('{cid}'), o = JSON.parse({json.dumps(orig)}); Object.keys(c).forEach(k => {{ if (!(k in o)) delete c[k]; }}); Object.assign(c, o);
      guardar(); }}""")
    ok('Limpieza Pedidos', sinp(P) and not P.evaluate(f"DB.lives.some(l => l.id === '{lid}')") and P.evaluate(f"JSON.stringify(cliById('{cid}'))") == orig)
    G.evaluate("() => { DB.promos = DB.promos.filter(x => x.nombre !== 'Shorts 2 por $1.500'); put('emma_promos'); }")
    G.click('[data-t=hist]'); time.sleep(0.3)
    for nom in ('Prueba Claude ensayo imp', 'Prueba Claude ensayo local'):
        c = G.evaluate(f"(COMPRAS.find(c => c.nombre === '{nom}')||{{}}).id")
        if not c: continue
        if not G.is_visible(f"[data-act=delCompra][data-cid='{c}']"): G.click(f"[data-act=histSel][data-cid='{c}']"); time.sleep(0.3)
        G.click(f"[data-act=delCompra][data-cid='{c}']"); time.sleep(0.4)
    ok('Limpieza Gestión', sinp(G) and G.evaluate("COMPRAS.length") == 6)
    br.close()
print('\nRESUMEN:', sum(1 for r in RES if r[1]), 'de', len(RES), 'OK')
