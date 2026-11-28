"""
PARTICULIERS — produits emballés, prix par zone (F CFA, €, $), en ligne, 390×844.

Un produit TEST (créé puis supprimé) avec 4 emballages TEST ; forfaits de transport réglés le
temps du test (remis à leur valeur d'avant). Comptes Sénégal, France, États-Unis :
carte du marché au prix par défaut dans la bonne devise ; fiche ouverte sur l'emballage par
défaut ; changement d'emballage (aperçu, prix, palier) ; « Sénégal TEST » vu au Sénégal
seulement ; « Sans euro TEST » invisible en France ; glisser la rangée d'emballages ne change pas
de produit ; panier, transport et commande dans une seule devise ; alerte « devise inversée »
dans la tour. Seuls les éléments TEST sont créés, puis supprimés.

    python scripts/online/t7_b2c.py [APP] [TOUR]
"""
import re, time
from playwright.sync_api import sync_playwright
from common import (SHOTS, TOUR, Journal, api, body, check, labels, new_page, open_product, save_results, search,
                    signup, wait_for)

PID = 'test-b2c'
NAME = 'Produit TEST B2C'
ACCOUNTS = {
    'SN': ('Sénégal', 'Sami Test B2C', '+221 77 000 00 51', 'XOF'),
    'FR': ('France', 'Fanny Test B2C', '+33 6 00 00 00 52', 'EUR'),
    'US': ('États-Unis', 'Ulysse Test B2C', '+1 202 555 0153', 'USD'),
}
PACKS = [
    {'label': 'Sachet TEST', 'qty': 200, 'unit': 'g', 'prices': {'XOF': 1500, 'EUR': 2.5, 'USD': 3}, 'step': 1, 'is_default': True},
    {'label': 'Pot TEST', 'qty': 500, 'unit': 'g', 'prices': {'XOF': 3000, 'EUR': 5, 'USD': 6}, 'step': 2, 'min': 2},
    {'label': 'Sénégal TEST', 'qty': 100, 'unit': 'g', 'prices': {'XOF': 900}, 'countries': {'mode': 'pays', 'list': ['SN']}},
    {'label': 'Sans euro TEST', 'qty': 1, 'unit': 'kg', 'prices': {'XOF': 5000, 'USD': 9}},
]
FEES = {'sn': {'XOF': 1000, 'EUR': 2, 'USD': 3}, 'ao': {'XOF': 2000}, 'af': {'XOF': 3000}, 'eu': {'EUR': 9}, 'na': {'USD': 12}, 'monde': {'USD': 15}}


def fmt(n, cur):
    if cur == 'XOF':
        return f"{round(n):,}".replace(',', ' ') + ' F CFA'
    whole, cents = f'{n:.2f}'.split('.')
    return f"{int(whole):,}".replace(',', ' ') + f",{cents} " + ('€' if cur == 'EUR' else '$')


def norm(text):
    return re.sub(r'\s', ' ', text or '')


def pager(page):
    el = page.get_by_label(re.compile(r'^Produit \d+ sur \d+'))
    return (el.first.get_attribute('aria-label') or '') if el.count() else ''


def touch_swipe(ctx, page, y, x0=340, x1=40):
    """Vrai glissement au doigt (événements tactiles du navigateur), de droite à gauche."""
    cdp = ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y}]})
    for i in range(1, 13):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / 12, 'y': y}]})
        page.wait_for_timeout(16)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.wait_for_timeout(1200)


def create_product():
    full = [{'available': True, 'countries': {'mode': 'zone', 'list': []}, 'is_default': False, 'step': 1, **k} for k in PACKS]
    body_ = {'id': PID, 'name': NAME, 'variety': '', 'category': 'transformes', 'origin': 'Sénégal',
             'description': 'Produit de test, supprimé à la fin.', 'photo_asset': 'baobab', 'photo_url': None, 'photo_ratio': 1,
             'tint': '#7AAA2C', 'months': list(range(1, 13)), 'available': True, 'archived': False, 'bio': False,
             'rating': 0, 'reviews': 0, 'is_example': False, 'wholesale': [], 'zone': {'mode': 'all', 'except': []},
             'retail': {'kind': 'emballe', 'active': True, 'price': None, 'unit': 'unit', 'unitLabel': 'la pièce',
                        'noun': ['pièce', 'pièces'], 'step': 1, 'min': None, 'max': None},
             'packagings': full}
    return api('POST', '/api/products', body_)


def published():
    for _ in range(12):
        doc = api('GET', '/api/catalog?v=2')
        p = next((x for x in doc['products'] if x['id'] == PID), None)
        zones = {z['id']: z['fees'] for z in (doc.get('transport') or {}).get('zones', [])}
        if p and p.get('b2c') == 'emballe' and len(p.get('formats', [])) == 4 and (zones.get('sn') or {}).get('XOF') == 1000:
            time.sleep(12)  # cache de la tour (s-maxage 5 s + 5 s) : l'application lit la version à jour
            return p
        time.sleep(2)
    return None


def checkout_texts(page, country):
    """Panier → Commander → « pour moi » → adresse dans le pays du compte ; texte de la validation."""
    page.get_by_role('button', name='Ouvrir le panier').first.click()
    page.get_by_role('button', name=re.compile('^Commander')).click()
    page.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    page.get_by_role('radio', name='Valider pour moi').click()
    if page.get_by_role('button', name=re.compile('Ajouter votre adresse')).count():
        page.get_by_role('button', name=re.compile('Ajouter votre adresse')).click()
        page.get_by_label('Nom du destinataire').fill('Client TEST B2C')
        page.get_by_role('button', name=re.compile('Pays')).click()
        page.get_by_label('Rechercher un pays').fill(country)
        page.wait_for_timeout(400)
        page.get_by_role('radio', name=re.compile('^' + country)).first.click()
        page.get_by_role('textbox', name='Adresse', exact=True).fill('1 rue du Test')
        page.get_by_role('textbox', name='Ville', exact=True).fill('Ville Test')
        page.get_by_role('button', name=re.compile('Enregistrer l’adresse')).click()
        page.wait_for_timeout(1200)
    return norm(body(page))


def run():
    J = Journal()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            r = J.setting('transport', FEES)
            check('tour : forfaits de transport par devise (le temps du test)', 'value' in (r or {}), str(r)[:60])
            r = create_product()
            check('tour : produit TEST emballé créé (4 emballages TEST)', (r or {}).get('id') == PID, (r or {}).get('error', ''))
            p = published()
            check('?v=2 : produit emballé et forfaits par devise publiés', bool(p), '')

            for code, (country, name, phone, cur) in ACCOUNTS.items():
                ctx, A = new_page(browser)
                signup(A, 'particulier', name, phone, country)
                search(A, 'TEST B2C')
                card = next((l for l in labels(A) if l.startswith(NAME)), '')
                want = fmt({'XOF': 1500, 'EUR': 2.5, 'USD': 3}[cur], cur)
                check(f'{code} : carte du marché au prix par défaut, en {cur} ({want})', want in norm(card), card[:90])
                open_product(A, 'TEST B2C', '^' + NAME)
                b = body(A)
                check(f'{code} : fiche ouverte sur l’emballage par défaut (Sachet TEST), sans « Produit initial »',
                      A.get_by_role('radio', name=re.compile('^Sachet TEST')).get_attribute('aria-checked') == 'true' and 'Produit initial' not in b, '')
                seen = {k['label']: A.get_by_role('radio', name=re.compile('^' + k['label'])).count() > 0 for k in PACKS}
                check(f'{code} : « Sénégal TEST » vu seulement au Sénégal', seen['Sénégal TEST'] == (code == 'SN'), seen)
                check(f'{code} : « Sans euro TEST » invisible en France seulement', seen['Sans euro TEST'] == (code != 'FR'), seen)

                # Rangée d'emballages amenée au-dessus du bandeau « ajouter », puis glissée au doigt,
                # à la souris et à la molette horizontale : le produit ne change pas.
                before = pager(A)
                A.mouse.move(195, 400)
                A.mouse.wheel(0, 250)
                A.wait_for_timeout(800)
                row = A.get_by_role('radiogroup', name=re.compile('^Formats disponibles')).first
                box = row.bounding_box()
                y = box['y'] + box['height'] / 2
                hit = A.evaluate("([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role=radiogroup]')", [box['x'] + box['width'] / 2, y])
                touch_swipe(ctx, A, y)
                A.mouse.move(box['x'] + box['width'] / 2, y)
                A.mouse.wheel(300, 0)
                A.wait_for_timeout(1200)
                # Souris en dernier : relâchée sur un autre emballage, elle le choisit (la page remonte).
                A.mouse.move(box['x'] + box['width'] - 20, y)
                A.mouse.down()
                A.mouse.move(box['x'] + 20, y, steps=12)
                A.mouse.up()
                A.wait_for_timeout(1200)
                after = pager(A)
                check(f'{code} : glisser la rangée d’emballages (doigt, souris, molette) ne change pas de produit',
                      hit and NAME in body(A) and before == after, f'rangée visible={hit} · {before[:14]} → {after[:14]}')

                # Changer d'emballage : prix et palier mis à jour (Pot TEST : minimum 2)
                A.get_by_role('radio', name=re.compile('^Pot TEST')).first.click()
                A.wait_for_timeout(1500)
                add = A.get_by_role('button', name=re.compile('^Ajouter .* au panier')).last.get_attribute('aria-label') or ''
                pot = fmt({'XOF': 3000, 'EUR': 5, 'USD': 6}[cur] * 2, cur)
                check(f'{code} : Pot TEST choisi → palier 2, total {pot}', pot in norm(add) and 'Ajouter 2 ' in norm(add), add[:100])
                A.get_by_role('radio', name=re.compile('^Sachet TEST')).first.click()
                A.wait_for_timeout(800)
                A.get_by_role('button', name=re.compile('^Ajouter .* au panier')).last.click()
                A.wait_for_timeout(800)
                A.get_by_role('button', name='Retour').first.click()
                A.wait_for_timeout(600)

                # Panier, transport, commande : une seule devise
                t = checkout_texts(A, country)
                fee = fmt(FEES[{'SN': 'sn', 'FR': 'eu', 'US': 'na'}[code]][cur], cur)
                total = fmt({'XOF': 1500, 'EUR': 2.5, 'USD': 3}[cur] + FEES[{'SN': 'sn', 'FR': 'eu', 'US': 'na'}[code]][cur], cur)
                check(f'{code} : transport dans la bonne devise ({fee})', fee in t, '')
                check(f'{code} : total dans une seule devise ({total})', total in t and 'À confirmer' not in t, '')
                A.screenshot(path=str(SHOTS / f'online-t7-{code}.png'))
                if A.get_by_label('E-mail', exact=True).count():
                    A.get_by_label('E-mail', exact=True).fill('test-b2c@exemple.test')
                for _ in range(2):  # Sénégal : le premier appui demande la position
                    if A.get_by_role('button', name=re.compile('^Payer et confirmer')).count():
                        A.get_by_role('button', name=re.compile('^Payer et confirmer')).click()
                        A.wait_for_timeout(3500)
                o = None
                for _ in range(10):
                    o = next((x for x in api('GET', '/api/orders')['orders'] if x['customer'].get('name') == 'Client TEST B2C' and x.get('currency') == cur), None)
                    if o:
                        break
                    time.sleep(2)
                check(f'{code} : commande reçue par la tour en {cur}', bool(o), '')
                ctx.close()

            # Tour : alerte « devise inversée » (rien n'est enregistré)
            tctx = browser.new_context(viewport={'width': 1440, 'height': 900})
            T = tctx.new_page()
            T.goto(f'{TOUR}/#/produits/{PID}', timeout=90000)
            T.get_by_role('button', name='Enregistrer', exact=True).last.wait_for(timeout=60000)
            T.wait_for_timeout(1200)
            T.get_by_role('button', name=re.compile('^Modifier l’emballage Sachet TEST')).first.click()
            T.wait_for_timeout(800)
            T.get_by_label(re.compile('^Afrique de l’Ouest — F CFA')).first.fill('3')
            T.keyboard.press('Tab')
            T.wait_for_timeout(600)
            check('tour : alerte « prix dans la mauvaise devise » visible', 'semble très bas' in body(T), '')
            T.screenshot(path=str(SHOTS / 'online-t7-alerte.png'))
            tctx.close()
        finally:
            J.undo()
            for o in api('GET', '/api/orders')['orders']:
                if o['customer'].get('name') in ('Client TEST B2C',) or 'Test B2C' in (o['customer'].get('name') or ''):
                    api('DELETE', '/api/orders', {'id': o['id']})
            for c in api('GET', '/api/orders?vue=paniers').get('carts', []):
                if 'Test B2C' in (c['account'].get('name') or ''):
                    api('DELETE', '/api/orders', {'cartId': c['id']})
            api('DELETE', '/api/products', {'id': PID})
            left = [x['id'] for x in api('GET', '/api/products') if x['id'] == PID]
            check('nettoyage : produit TEST, commandes et paniers TEST supprimés, transport remis', not left, left)
            browser.close()
    save_results('t7')


if __name__ == '__main__':
    run()
