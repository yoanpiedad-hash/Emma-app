#!/usr/bin/env python3
"""Banco de casos de Mabel (19/11).

Corre cada caso de casos.json contra la función de prueba (mabel-prueba) con el modo prueba
(header x-mabel-test). No sale ningún WhatsApp. Cada caso usa su propio número 099000NNN, que se
limpia antes y después.

Uso:  MABEL_TEST_KEY=... python3 correr.py [--url URL] [--solo S01,A01] [--tanda ya|D|todas]
Sale con código 1 si falla algún caso de la tanda pedida: si falla, no se publica.

23/11: por defecto corre contra la función de prueba de la BASE DE PRUEBA (emma-prueba). La clave es la de
mabel_ajustes de emma-prueba. Para correrlo contra la base real hay que pasar --real (y tener el ok de Yoan).
Un paso puede traer "comprobante": {"monto": 1090} → se arma al vuelo un comprobante con la fecha y hora de hoy.
"""
import argparse, base64, concurrent.futures as cf, datetime as dt, json, os, re, sys, time, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
URL_PRUEBA = 'https://ctrjlovufdssqgolwnjc.supabase.co/functions/v1/mabel-prueba'  # emma-prueba (base de prueba)
URL_REAL = 'https://ssipaovluukkypsbzboe.supabase.co/functions/v1/mabel-prueba'    # base real: solo con --real y ok de Yoan
REAL = 'ssipaovluukkypsbzboe'


def post(url, key, body, intentos=2):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-mabel-test': key})
    for i in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors='replace')
            if i + 1 == intentos: return {'error': f'HTTP {e.code}: {txt[:300]}'}
        except Exception as e:  # corte de red: un reintento
            if i + 1 == intentos: return {'error': str(e)[:300]}
        time.sleep(3)


def dias_viaje():
    hoy = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date()
    return [{'fecha': (hoy + dt.timedelta(days=i)).isoformat(), 'motivo': 'viaje'} for i in range(4)]


def poner(v, tel):
    """23/11 (pedido web): {M1} = modelo de prueba del caso (9 + últimas 3 cifras del número + k), {TEL} = número, __hoy_HHMM__ = hoy a esa hora."""
    if isinstance(v, str):
        hoy = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date().isoformat()
        v = re.sub(r'\{M(\d)\}', lambda m: '9' + tel[-3:] + m.group(1), v).replace('{TEL}', tel[-8:])
        v = re.sub(r'\{([A-Z]{1,3}):(\d)\}', lambda m: m.group(1) + tel[-3:] + m.group(2), v)  # {RP:4} = modelo con código de letras (7º valor del stock)
        v = re.sub(r'__fecha_\+(\d+)__', lambda m: (dt.date.fromisoformat(hoy) + dt.timedelta(days=int(m.group(1)))).isoformat(), v)  # hoy + N días (AAAA-MM-DD)
        return re.sub(r'__hoy_(\d\d)(\d\d)__', lambda m: f'{hoy}T{m.group(1)}:{m.group(2)}:00-03:00', v)
    if isinstance(v, list): return [poner(x, tel) for x in v]
    if isinstance(v, dict): return {k: poner(x, tel) for k, x in v.items()}
    return v


def comprobante_hoy(c, tel):
    """23/11: comprobante de prueba con la fecha y hora de ahora (los pedidos web se crean hoy: uno del 19/11 sería anterior al pedido)."""
    import io, tempfile
    sys.path.insert(0, AQUI)
    from hacer_comprobantes import hacer
    ahora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))) - dt.timedelta(minutes=int(tel[-2:]) % 50)  # otra hora por caso: dos casos en paralelo no chocan en el control de repetidos
    with tempfile.NamedTemporaryFile(suffix='.jpg') as f:
        hacer('', int(c['monto']), fecha=ahora.strftime('%d/%m/%Y %H:%M'), oper=str(c.get('oper') or (tel[-3:] + ahora.strftime('%H%M%S') + str(c['monto']))), ruta=f.name)
        return open(f.name, 'rb').read()


def correr_caso(c, tel, url, key, ausente):
    post(url, key, {'tel': tel, 'solo_limpiar': True, 'limpiar': True})
    pasos, ultimo = [], None
    try:
        for p in c['pasos']:
            cfg = {'mabelAusente': None, 'diasSinSalida': []}
            cfg.update({k: (dias_viaje() if v == '__viaje__' else poner(v, tel)) for k, v in (p.get('cfg') or {}).items()})
            body = {'tel': tel, 'texto': poner(p.get('texto', ''), tel), 'detalle': True, 'cfg': cfg}
            if p.get('ausente'): body['ausente'] = ausente; cfg.pop('mabelAusente', None)
            for k in ('previo', 'conv', 'imagen_base64', 'mime'):
                if k in p: body[k] = p[k]
            if p.get('imagen'):
                body['imagen_base64'] = base64.b64encode(open(os.path.join(AQUI, 'comprobantes', p['imagen']), 'rb').read()).decode(); body['mime'] = 'image/jpeg'
            if p.get('comprobante'):
                body['imagen_base64'] = base64.b64encode(comprobante_hoy(p['comprobante'], tel)).decode(); body['mime'] = 'image/jpeg'
            if c.get('fixture') and p is c['pasos'][0]: body['fixture'] = poner(c['fixture'], tel)
            r = post(url, key, body); pasos.append(r); ultimo = r
    finally:
        post(url, key, {'tel': tel, 'solo_limpiar': True, 'limpiar': True})
    return revisar(c, ultimo or {}, pasos)


def revisar(c, r, pasos):
    e, fallas = c.get('espera', {}), []
    if r.get('error') and not r.get('respuesta'): fallas.append('error: ' + str(r['error'])[:160])
    txt = r.get('respuesta') or ''
    if 'envia' in e:
        if e['envia'] and not txt: fallas.append('no mandó mensaje (' + str(r.get('motivo')) + ')')
        if not e['envia'] and txt: fallas.append('mandó mensaje y tenía que callar')
    for pat in e.get('contiene', []):
        if txt and not re.search(pat, txt, re.I): fallas.append(f'falta /{pat}/')
    for pat in e.get('no_contiene', []):
        if txt and re.search(pat, txt): fallas.append(f'no debía decir /{pat}/')
    herr = json.dumps([x.get('registro') for x in pasos], ensure_ascii=False)
    for h in e.get('herramienta', []):
        if h not in herr: fallas.append('no usó ' + h)
    for h in e.get('no_herramienta', []):
        if f'"{h}"' in herr or f"'{h}'" in herr or f'{h}(' in herr: fallas.append('usó ' + h)
    if 'derivado' in e:
        hay = bool(r.get('derivados'))
        if e['derivado'] and not hay: fallas.append('no dejó pendiente para Yanaina')
        if not e['derivado'] and hay: fallas.append('dejó pendiente para Yanaina y no tenía')
    return {'id': c['id'], 'nombre': c['nombre'], 'tanda': c.get('tanda', 'ya'), 'ok': not fallas, 'fallas': fallas,
            'respuesta': txt or None, 'motivo': r.get('motivo'), 'silencio': r.get('silencio'),
            'derivados': [d.get('ultimo') or d.get('motivo') for d in (r.get('derivados') or [])]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=''); ap.add_argument('--solo', default=''); ap.add_argument('--tanda', default='todas')
    ap.add_argument('--real', action='store_true', help='correr contra la base REAL (solo con ok de Yoan)')
    a = ap.parse_args()
    if not a.url: a.url = URL_REAL if a.real else URL_PRUEBA
    if REAL in a.url and not a.real: sys.exit('Esa URL es de la base REAL: hace falta --real (y el ok de Yoan).')
    print('Corriendo contra', 'la BASE REAL' if REAL in a.url else 'emma-prueba (base de prueba)', '·', a.url)
    key = os.environ.get('MABEL_TEST_KEY') or sys.exit('Falta MABEL_TEST_KEY')
    banco = json.load(open(os.path.join(AQUI, 'casos.json')))
    casos = [c for c in banco['casos'] if (not a.solo or c['id'] in a.solo.split(',')) and (a.tanda == 'todas' or c.get('tanda', 'ya') == a.tanda)]
    with cf.ThreadPoolExecutor(4) as ex:
        res = list(ex.map(lambda ic: correr_caso(ic[1], '099000%03d' % (100 + ic[0]), a.url, key, banco['ausente']), enumerate(casos)))
    if any(c.get('fixture') for c in casos): post(a.url, key, {'tel': '099000999', 'solo_limpiar': True, 'limpiar': True, 'borrar_live_banco': True})
    for x in res:
        print(('✅' if x['ok'] else '❌'), x['id'], f"[{x['tanda']}]", x['nombre'])
        for f in x['fallas']: print('     ·', f)
        print('     →', (x['respuesta'] or f"(no mandó: {x['motivo']})").replace('\n', ' ')[:220])
    ok = sum(x['ok'] for x in res)
    print(f'\n{ok}/{len(res)} bien')
    sello = dt.datetime.now().strftime('%Y%m%d-%H%M')
    os.makedirs(os.path.join(AQUI, 'resultados'), exist_ok=True)
    json.dump(res, open(os.path.join(AQUI, 'resultados', sello + '.json'), 'w'), ensure_ascii=False, indent=1)
    sys.exit(0 if all(x['ok'] for x in res if x['tanda'] == 'ya' or a.tanda != 'ya') else 1)


if __name__ == '__main__':
    main()
