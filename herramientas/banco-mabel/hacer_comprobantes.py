"""Comprobantes falsos para el banco de casos (solo para probar a Mabel; nunca para usar afuera)."""
from PIL import Image, ImageDraw, ImageFont
import os
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def fnt(n):
    try: return ImageFont.truetype(F, n)
    except Exception: return ImageFont.load_default()
def hacer(nombre, monto, fecha='19/11/2026 18:42', destino='110726574-00001', titular='YOAN PIEDAD', banco='BROU', origen='MARIA PRUEBA BANCO', oper=None):
    im = Image.new('RGB', (720, 1100), 'white'); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 720, 140], fill=(0, 61, 130)); d.text((40, 45), f'{banco} · eBROU' if banco == 'BROU' else banco, fill='white', font=fnt(44))
    d.text((40, 190), 'Transferencia realizada', fill=(20, 20, 20), font=fnt(40))
    filas = [('Fecha', fecha), ('Importe', f'$ {monto:,}'.replace(',', '.')), ('Cuenta origen', '00123456-00001'), ('Titular origen', origen),
             ('Cuenta destino', destino), ('Titular destino', titular), ('Banco destino', banco), ('Concepto', 'Pedido'), ('N° de operación', oper or '8812' + str(monto))]
    y = 290
    for k, v in filas:
        d.text((40, y), k, fill=(110, 110, 110), font=fnt(26)); d.text((40, y + 34), v, fill=(10, 10, 10), font=fnt(32)); y += 88
    im.save(os.path.join(os.path.dirname(__file__), 'comprobantes', nombre), quality=88)
hacer('k500.jpg', 500)
hacer('k750.jpg', 750)
hacer('k300.jpg', 300)
hacer('k500_ajena.jpg', 500, destino='009988776-00002', titular='CARLOS GOMEZ')
hacer('k500_vieja.jpg', 500, fecha='10/10/2026 11:05')
hacer('k1500.jpg', 1500)
hacer('k500_prexvieja.jpg', 500, destino='Cuenta Prex 5521 0093', titular='TITULAR PRUEBA', banco='PREX')  # 26/11: Prex que ya no se usa (datos inventados)
hacer('k300_b.jpg', 300, fecha='19/11/2026 21:10', oper='5512300')  # 26/11: GA6 y GA7 (cada caso el suyo: si no, es el mismo comprobante)
hacer('k300_c.jpg', 300, fecha='19/11/2026 22:40', oper='6623300')
hacer('k500_prexyoan.jpg', 500, destino='Cuenta Prex 4417 2281', titular='YOAN PIEDAD', banco='PREX')
# 21/11 (4C pruebas 2, 4, 5): monto inflado, otra captura del mismo comprobante y pago de otra persona
hacer('k1000.jpg', 1000)
hacer('k500_otra.jpg', 500, fecha='19/11/2026 20:15', origen='LAURA HERMANA PRUEBA', oper='7731500')  # 23/11: otra hora y otro n° (si no, es el mismo comprobante que k500)
def captura(origen, nombre):  # misma transferencia, otro archivo (recorte y escala): otra huella
    d = os.path.join(os.path.dirname(__file__), 'comprobantes')
    im = Image.open(os.path.join(d, origen)); w, h = im.size
    im.crop((0, 120, w, h - 40)).resize((600, int((h - 160) * 600 / w))).save(os.path.join(d, nombre), quality=80)
captura('k500.jpg', 'k500_captura.jpg')
