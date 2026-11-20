"""Comprobantes falsos para el banco de casos (solo para probar a Mabel; nunca para usar afuera)."""
from PIL import Image, ImageDraw, ImageFont
import os
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def fnt(n):
    try: return ImageFont.truetype(F, n)
    except Exception: return ImageFont.load_default()
def hacer(nombre, monto, fecha='19/11/2026 18:42', destino='110726574-00001', titular='YOAN PIEDAD', banco='BROU', origen='MARIA PRUEBA BANCO'):
    im = Image.new('RGB', (720, 1100), 'white'); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 720, 140], fill=(0, 61, 130)); d.text((40, 45), f'{banco} · eBROU' if banco == 'BROU' else banco, fill='white', font=fnt(44))
    d.text((40, 190), 'Transferencia realizada', fill=(20, 20, 20), font=fnt(40))
    filas = [('Fecha', fecha), ('Importe', f'$ {monto:,}'.replace(',', '.')), ('Cuenta origen', '00123456-00001'), ('Titular origen', origen),
             ('Cuenta destino', destino), ('Titular destino', titular), ('Banco destino', banco), ('Concepto', 'Pedido'), ('N° de operación', '8812' + str(monto))]
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
hacer('k500_prexyoan.jpg', 500, destino='Cuenta Prex 4417 2281', titular='YOAN PIEDAD', banco='PREX')
