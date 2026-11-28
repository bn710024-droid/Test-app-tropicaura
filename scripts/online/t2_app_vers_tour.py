"""
APP → TOUR puis TOUR → APP (statuts), en ligne, en 390×844 :
inscriptions particulier et pro ; commande Sénégal (position) et France (GP) ; demandes pro avion
et bateau ; produit introuvable ; vue, J'aime et commentaire d'une vidéo. Chaque commande et chaque
demande passe par toutes les étapes dans la tour, avec contrôle de l'affichage client ; annulation
testée. Tout ce qui a été créé est supprimé à la fin.

    python scripts/online/t2_app_vers_tour.py [APP] [TOUR]
"""
import pathlib, re, time
from playwright.sync_api import sync_playwright
from common import (APP, SHOTS, TOUR, Journal, api, products, body, check, img_srcs, labels, new_page, open_product, png, save_results, search,
                    signup, upload_publication_file, wait_for)

VIDEO = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'videos' / 'commander.mp4'
NAMES = {'A': 'Awa Test Commande', 'B': 'Bruno Test France', 'C': 'Pro Test Demandes', 'D': 'Dina Test Panier'}
PACK_TEST = 'Sachet TEST panier'
created = {'pubs': [], 'requests': []}


def orders_of(name):
    return [o for o in api('GET', '/api/orders')['orders'] if o['customer'].get('name') == name]


def tracked(page, label, timeout=75):
    return wait_for(page, lambda: any(l.startswith(f'Suivi : {label}') for l in labels(page, 'Suivi')), timeout)


def place_order(page, query, name_re, country, address, city, recipient, email, phone, share_position):
    open_product(page, query, name_re)
    page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click()
    page.wait_for_timeout(600)
    page.get_by_role('button', name='Ouvrir le panier').first.click()
    page.get_by_role('button', name=re.compile('^Commander')).click()
    page.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    page.get_by_role('radio', name='Valider pour moi').click()
    if page.get_by_role('button', name=re.compile('Ajouter votre adresse')).count():
        page.get_by_role('button', name=re.compile('Ajouter votre adresse')).click()
        page.get_by_label('Nom du destinataire').fill(recipient)
        page.get_by_role('button', name=re.compile('Pays')).click()
        page.get_by_label('Rechercher un pays').fill(country)
        page.wait_for_timeout(400)
        page.get_by_role('radio', name=re.compile('^' + country)).first.click()
        page.get_by_role('textbox', name='Adresse', exact=True).fill(address)
        page.get_by_role('textbox', name='Ville', exact=True).fill(city)
        page.get_by_role('button', name=re.compile('Enregistrer l’adresse')).click()
        page.wait_for_timeout(1200)
    pays = labels(page, '')
    methods = [m for m in ('Orange Money', 'Wave', 'Virement bancaire', 'Carte bancaire') if any(l.startswith(m) for l in pays)]
    if share_position and page.get_by_role('button', name='Partager ma position pour le livreur').count():
        page.get_by_role('button', name='Partager ma position pour le livreur').click()
        page.wait_for_timeout(3000)
    if page.get_by_label('E-mail', exact=True).count():
        page.get_by_label('E-mail', exact=True).fill(email)
    if page.get_by_label('Téléphone ou WhatsApp').count():
        page.get_by_label('Téléphone ou WhatsApp').fill(phone)
    text = body(page)
    page.get_by_role('button', name=re.compile('^Payer et confirmer')).click()
    page.wait_for_timeout(3500)
    # Sénégal, pour soi, avec transport : le premier appui demande la position, le second envoie.
    if page.get_by_role('button', name=re.compile('^Payer et confirmer')).count():
        page.get_by_role('button', name=re.compile('^Payer et confirmer')).click()
        page.wait_for_timeout(3500)
    return methods, text


def go_orders(page):
    page.goto(APP, timeout=120000)
    page.wait_for_timeout(2500)
    page.get_by_role('tab', name=re.compile('Commandes')).first.click()
    page.wait_for_timeout(1500)


def carts_of(name):
    return [c for c in api('GET', '/api/orders?vue=paniers').get('carts', []) if c['account'].get('name') == name]


def cart_wait(fn, timeout=45):
    """Relit les paniers (toutes les 3 s) jusqu'à ce que `fn(panier ou None)` soit vrai ; délai ou None."""
    start = time.time()
    while time.time() - start < timeout:
        found = carts_of(NAMES['D'])
        if fn(found[0] if found else None):
            return time.time() - start
        time.sleep(3)
    return None


def fmt(amount_, currency):
    if currency == 'XOF':
        return f"{round(amount_):,}".replace(',', ' ') + ' F CFA'
    whole, cents = f'{amount_:.2f}'.split('.')
    return f"{int(whole):,}".replace(',', ' ') + f',{cents} €'


def add_to_cart(page, query, name_re, pack=None):
    open_product(page, query, name_re)
    if pack:
        page.get_by_text(pack).first.click()
        page.wait_for_timeout(800)
    page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).last.click()
    page.wait_for_timeout(700)
    page.get_by_role('button', name='Retour').first.click()
    page.wait_for_timeout(600)


def cart_checks(browser):
    """Paniers en cours : 2 produits + 1 emballage en F CFA, quantité, vidage, commande, secret, relance."""
    # Emballage TEST au prix du Sénégal en francs CFA, ajouté à la Mangue puis retiré (lui seul).
    m = next(x for x in products() if x['id'] == 'mangue')
    pack = {'label': PACK_TEST, 'qty': 500, 'unit': 'g', 'price': 4.5, 'step': 1, 'min': None, 'max': None,
            'audience': 'tous', 'available': True, 'photo_url': None, 'description': '',
            'countryRules': [{'countries': ['SN'], 'available': True, 'own': True, 'price': 2500, 'currency': 'XOF',
                              'ownPhoto': False, 'photo_url': None}]}
    r = api('PUT', '/api/products', {'id': 'mangue', 'packagings': (m.get('packagings') or []) + [pack]})
    pack_id = next((k['id'] for k in (r or {}).get('packagings', []) if k['label'] == PACK_TEST), None)
    check('tour : emballage TEST au prix du Sénégal en francs CFA', bool(pack_id), (r or {}).get('error', ''))
    for _ in range(10):  # cache du catalogue (5 s)
        doc = api('GET', '/api/catalog?v=2')
        f = next((f for x in doc['products'] if x['id'] == 'mangue' for f in x.get('formats', []) if f['id'] == pack_id), None)
        if f:
            break
        time.sleep(2)
    check('?v=2 : réglage Sénégal en XOF publié', bool(f) and (f.get('settings') or [{}])[0].get('currency') == 'XOF', f)

    ctx, D = new_page(browser)
    try:
        signup(D, 'particulier', NAMES['D'], '+221 77 000 00 41', 'Sénégal', email='dina@exemple.test')
        D.wait_for_timeout(2000)  # catalogue lu après la publication de l'emballage TEST
        add_to_cart(D, 'pomme', '^Pomme')
        add_to_cart(D, 'poire', '^Poire')
        add_to_cart(D, 'mangue', '^Mangue Kent', PACK_TEST)
        want = {'pomme', 'poire', f'mangue:{pack_id}'}
        d = cart_wait(lambda c: c and {l['line_id'] for l in c['lines']} == want)
        check('panier : 2 produits + 1 emballage visibles dans la tour (≤ 40 s)', d is not None and d <= 42, f'({d and round(d)} s)')
        c = (carts_of(NAMES['D']) or [None])[0]
        if c:
            ml = next(l for l in c['lines'] if l['line_id'] == f'mangue:{pack_id}')
            check('panier : emballage au prix du Sénégal, en F CFA (2 500)', ml['currency'] == 'XOF' and ml['unit_price'] == 2500, ml)
            cur = sorted(t['currency'] for t in c['totals'])
            check('panier : un total par devise (€ et F CFA), jamais additionnés', cur == ['EUR', 'XOF'], c['totals'])
            check('panier : statut « actif », secret jamais renvoyé', c['status'] == 'actif' and 'secret' not in c['account'], c['status'])
            D.get_by_role('tab', name=re.compile('Panier')).first.click()
            D.wait_for_timeout(1500)
            b = body(D)
            shown = [fmt(t['amount'], t['currency']) for t in c['totals']]
            check('panier : totaux de la tour = totaux affichés dans l’app', all(x in b for x in shown), shown)
            check('app : ligne « visible par notre équipe » sous le titre du panier', 'Votre panier est visible par notre équipe' in b)
            D.screenshot(path=str(SHOTS / 'online-t2-panier-app.png'))

            # Quantité modifiée → mise à jour
            before = next(l['qty'] for l in c['lines'] if l['line_id'] == 'pomme')
            D.get_by_label('Augmenter la quantité').first.click()
            d = cart_wait(lambda x: x and next((l['qty'] for l in x['lines'] if l['line_id'] == 'pomme'), before) > before)
            check('panier : quantité modifiée → mise à jour dans la tour (≤ 40 s)', d is not None and d <= 42, f'({d and round(d)} s)')

            # Relance : WhatsApp / Appeler / E-mail pré-remplis
            tctx = browser.new_context(viewport={'width': 1440, 'height': 900})
            T = tctx.new_page()
            T.goto(f"{TOUR}/#/commandes/paniers?panier={c['id']}", timeout=90000)
            T.get_by_text(f"Panier de {NAMES['D']}").first.wait_for(timeout=60000)
            T.wait_for_timeout(1000)
            hrefs = T.eval_on_selector_all('a', 'e => e.map(a => a.href)')
            wa = next((h for h in hrefs if 'wa.me/' in h), '')
            tel = next((h for h in hrefs if h.startswith('tel:')), '')
            mail = next((h for h in hrefs if h.startswith('mailto:')), '')
            check('relance : WhatsApp au bon numéro, message pré-rempli', 'wa.me/221770000041' in wa and 'Bonjour%20Dina' in wa and 'panier' in wa, wa[:120])
            check('relance : Appeler (tel:)', tel == 'tel:+221770000041', tel)
            check('relance : E-mail pré-rempli', mail.startswith('mailto:dina@exemple.test') and 'body=' in mail, mail[:90])
            T.screenshot(path=str(SHOTS / 'online-t2-panier-tour.png'))
            tctx.close()

            # Panier vidé → il disparaît de la tour
            for _ in range(12):
                if not D.get_by_label('Retirer du panier').count() and not D.get_by_label('Diminuer la quantité').count():
                    break
                btn = D.get_by_label('Retirer du panier')
                (btn if btn.count() else D.get_by_label('Diminuer la quantité')).first.click()
                D.wait_for_timeout(500)
            d = cart_wait(lambda x: x is None)
            check('panier vidé → il disparaît de la tour (≤ 40 s)', d is not None and d <= 42, f'({d and round(d)} s)')

            # Panier puis commande → « Commandé » et commande liée
            place_order(D, 'pomme', '^Pomme', 'Sénégal', '5 Rue 12, Plateau', 'Dakar', NAMES['D'],
                        'dina@exemple.test', '+221 77 000 00 41', False)
            mine = orders_of(NAMES['D'])
            d = cart_wait(lambda x: x and x['status'] == 'commande' and x['order'] and mine and x['order']['number'] == mine[0]['number'])
            check('panier puis commande → statut « Commandé » et commande liée (≤ 40 s)', d is not None and d <= 42,
                  f"({d and round(d)} s ; commandes : {[o['number'] for o in mine]})")

            # Envoi refusé sans secret valide
            body_ = {'type': 'panier', 'version': 1, 'account': {'id': c['id'], 'name': 'Intrus'}, 'lines': [], 'updatedAt': ''}
            r1 = api('POST', '/api/orders', body_)
            r2 = api('POST', '/api/orders', {**body_, 'account': {'id': c['id'], 'secret': 'f' * 64, 'name': 'Intrus'}})
            check('panier : envoi sans secret refusé (401)', (r1 or {}).get('_status') == 401, r1)
            check('panier : envoi avec un autre secret refusé (403)', (r2 or {}).get('_status') == 403, r2)
            still = carts_of(NAMES['D'])
            check('panier : rien de modifié par les envois refusés', bool(still) and still[0]['status'] == 'commande', [x['status'] for x in still])
    finally:
        ctx.close()
        # Retrait de l'emballage TEST : seuls les emballages TEST sont enlevés, le reste de la fiche ne bouge pas.
        now = next(x for x in products() if x['id'] == 'mangue')
        keep = [k for k in (now.get('packagings') or []) if k['label'] != PACK_TEST]
        if len(keep) != len(now.get('packagings') or []):
            api('PUT', '/api/products', {'id': 'mangue', 'packagings': keep})
        check('nettoyage : emballage TEST retiré de la Mangue',
              not any(k['label'] == PACK_TEST for k in next(x for x in products() if x['id'] == 'mangue').get('packagings') or []))


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctxA, A = new_page(browser, geo={'latitude': 14.7167, 'longitude': -17.4677})
        ctxB, B = new_page(browser)
        ctxC, C = new_page(browser)
        J = Journal()
        try:
            polls = []
            def on_poll(r):
                if '/api/orders?compte=' not in r.url:
                    return
                try:
                    st = [x.get('status') for x in r.json().get('orders', [])]
                except Exception:  # noqa: BLE001
                    st = []
                polls.append((time.time(), r.status, st))
            A.on('response', on_poll)
            A.on('requestfailed', lambda r: polls.append((time.time(), 'échec', [])) if '/api/orders?compte=' in r.url else None)
            signup(A, 'particulier', NAMES['A'], '+221 77 000 00 21', 'Sénégal')
            check('inscription particulier (Sénégal)', 'Tout l’étal' in body(A))
            signup(C, 'pro', NAMES['C'], '+221 77 000 00 23', 'Sénégal')
            check('inscription professionnel', 'Catalogue professionnel' in body(C))
            logi = api('GET', '/api/orders')['logistics']

            # ── Moyens de paiement : « Virement » désactivé dans la tour → absent de l'application
            # Réglages touchés par le test : remis à leur valeur d'avant, et seulement s'ils n'ont pas changé.
            r = J.setting('payments', {'orange_money': True, 'wave': True, 'virement': False, 'carte': True})
            check('tour : moyen de paiement désactivé (réglage payments)', (r or {}).get('value', {}).get('virement') is False, r)
            # Le catalogue est servi avec un cache de 5 s : on relit jusqu'à 20 s.
            pays = []
            for _ in range(10):
                pays = [x['id'] for x in api('GET', '/api/catalog?v=2')['payments']]
                if pays == ['orange_money', 'wave', 'carte']:
                    break
                time.sleep(2)
            check('tour : ?v=2 ne publie que les moyens activés', pays == ['orange_money', 'wave', 'carte'], pays)
            r = J.setting('payments', {'orange_money': False, 'wave': False, 'virement': False, 'carte': False})
            check('tour : impossible de tout désactiver', (r or {}).get('_status') == 400, r)
            A.wait_for_timeout(50000)  # une relecture du catalogue (45 s)

            # ── Commande Sénégal avec position
            methods, text = place_order(A, 'pomme', '^Pomme', 'Sénégal', '12 Rue 10, Médina', 'Dakar', NAMES['A'],
                                        'awa@exemple.test', '+221 77 000 00 21', True)
            check('moyens de paiement : seuls les 3 activés proposés (sans virement)', methods == ['Orange Money', 'Wave', 'Carte bancaire'], methods)
            J.undo('setting', 'payments')
            mine = orders_of(NAMES['A'])
            check('commande Sénégal reçue par la tour', len(mine) == 1, f'({len(mine)})')
            o = mine[0] if mine else None
            check('commande Sénégal : position du client reçue', bool(o and o.get('location')))
            A.get_by_role('button', name='Suivre ma commande').click()
            A.wait_for_timeout(1500)
            check('suivi client : « En validation »', tracked(A, 'En validation', 10) is not None)
            if o:
                steps = [({'paid': True, 'via': 'wave'}, 'Validée'), ({'status': 'preparation'}, 'En préparation'),
                         ({'status': 'expediee'}, 'Livreur en route'), ({'status': 'livree'}, 'Livrée')]
                for change, label in steps:
                    r = api('PUT', '/api/orders', {'id': o['id'], **change})
                    t0 = time.time()
                    d = tracked(A, label)
                    seen = [f'+{round(t - t0)} s {code} {st}' for t, code, st in polls if t >= t0 - 1]
                    check(f'statut commande → « {label} » affiché chez le client (≤ 60 s)', d is not None and d <= 62,
                          f'({d and round(d)} s ; tour : {r.get("status", r.get("error"))} ; relectures : {seen[:4]})')
                A.screenshot(path=str(SHOTS / 'online-t2-livree.png'))
            # ── Annulation
            A.goto(APP, timeout=120000)
            A.get_by_text('Tout l’étal').first.wait_for(timeout=60000)
            place_order(A, 'poire', '^Poire', 'Sénégal', '', '', NAMES['A'], 'awa@exemple.test', '+221 77 000 00 21', False)
            second = [x for x in orders_of(NAMES['A']) if not o or x['id'] != o['id']]
            check('deuxième commande reçue', len(second) == 1)
            if second:
                A.get_by_role('button', name='Suivre ma commande').click()
                A.wait_for_timeout(1200)
                r = api('PUT', '/api/orders', {'id': second[0]['id'], 'status': 'annulee'})
                # Commande annulée : la carte masque les étapes et affiche le badge « Annulée ».
                d = wait_for(A, lambda: 'Annulée' in body(A), 75)
                check('annulation dans la tour → « Annulée » chez le client', d is not None and d <= 62, f'({d and round(d)} s)')

            # ── Commande France avec GP
            # La France est AJOUTÉE aux pays du GP (ceux déjà réglés par le propriétaire restent).
            J.logistics(dict(logi, gpCountries=sorted(set(logi['gpCountries']) | {'FR'})))
            signup(B, 'particulier', NAMES['B'], '+33 6 00 00 00 22', 'France')
            B.wait_for_timeout(1500)
            _, text = place_order(B, 'pomme', '^Pomme', 'France', '10 rue de Rivoli', 'Paris', NAMES['B'],
                                  'bruno@exemple.test', '+33 6 00 00 00 22', False)
            check('France : livraison GP proposée', 'GP' in text)
            fr = orders_of(NAMES['B'])
            check('commande France reçue par la tour', len(fr) == 1 and fr[0].get('country') == 'FR', fr[0].get('country') if fr else '')
            if fr:
                B.get_by_role('button', name='Suivre ma commande').click()
                B.wait_for_timeout(1200)
                for change, label in (({'paid': True, 'via': 'carte'}, 'Validée'), ({'status': 'expediee'}, 'Expédiée')):
                    api('PUT', '/api/orders', {'id': fr[0]['id'], **change})
                    d = tracked(B, label)
                    check(f'France : « {label} » affiché', d is not None and d <= 62, f'({d and round(d)} s)')
            J.undo('logistics')

            # ── Demandes pro : avion puis bateau
            reqs = {}
            for mode, query, name_re in (('avion', 'mangue séchée', '^Mangue séchée'), ('bateau', 'ananas séché', '^Ananas séché')):
                C.goto(APP, timeout=120000)
                C.get_by_text('Catalogue professionnel').first.wait_for(timeout=60000)
                open_product(C, query, name_re)
                radio = C.get_by_role('radio', name=re.compile(f'par {mode}', re.I))
                # Une seule offre : le choix du transport est affiché mais désactivé (déjà sélectionné).
                if radio.count() and radio.first.get_attribute('aria-disabled') != 'true':
                    radio.first.click(); C.wait_for_timeout(500)
                C.get_by_role('button', name=re.compile('^Ajouter .* à la demande, ')).last.click()
                C.wait_for_timeout(700)
                C.get_by_role('button', name='Ouvrir ma demande en cours').first.click()
                C.get_by_role('button', name='Finaliser la demande').click()
                C.get_by_label('E-mail', exact=True).fill('pro@exemple.test')
                C.get_by_role('textbox', name=re.compile('^Société')).fill(f'Société Test {mode}')
                C.get_by_role('button', name='Envoyer la demande').click()
                C.wait_for_timeout(3500)
                got = [x for x in api('GET', '/api/orders')['orders'] if x['customer'].get('company') == f'Société Test {mode}']
                reqs[mode] = got[0] if got else None
                ok = bool(got) and any((l.get('mode') == mode) for l in got[0]['lines'])
                check(f'demande pro {mode} reçue par la tour (mode {mode})', ok, [l.get('mode') for l in got[0]['lines']] if got else '')
            go_orders(C)
            a = reqs.get('avion')
            if a:
                d = wait_for(C, lambda: 'Intérêt reçu' in body(C), 75)
                check('demande pro → étape « interet » : client voit « Intérêt reçu »', d is not None and d <= 62, f'({d and round(d)} s)')
                for stage, label in (('contacte', 'Contacté'), ('discussion', 'En discussion'),
                                     ('contrat', 'Confirmée'), ('preparation', 'En préparation'),
                                     ('livraison', 'Expédiée'), ('livree', 'Livrée')):
                    r = api('PUT', '/api/orders', {'id': a['id'], 'stage': stage})
                    d = wait_for(C, lambda: label in body(C), 75)
                    check(f'demande pro → étape « {stage} » : client voit « {label} »', d is not None and d <= 62,
                          f'({d and round(d)} s ; tour : {r.get("status", r.get("error"))})')
            b = reqs.get('bateau')
            if b:
                api('PUT', '/api/orders', {'id': b['id'], 'stage': 'annulee'})
                d = wait_for(C, lambda: 'Annulée' in body(C), 75)
                check('demande pro « Sans suite » → « Annulée » chez le client', d is not None and d <= 62, f'({d and round(d)} s)')
            C.screenshot(path=str(SHOTS / 'online-t2-pro.png'))

            # ── Produit introuvable
            A.goto(APP, timeout=120000)
            A.get_by_text('Tout l’étal').first.wait_for(timeout=60000)
            search(A, 'durian test')
            msg = api('GET', '/api/catalog?v=2')['productRequest']
            if A.get_by_role('button', name=msg['button']).count():
                A.get_by_role('button', name=msg['button']).click()
                A.wait_for_timeout(3000)
            found = [r for r in api('GET', '/api/orders?vue=introuvables')['requests'] if 'durian' in r.get('product', '').lower()]
            created['requests'] = [r['id'] for r in found]
            check('produit introuvable reçu par la tour', bool(found))
            search(A, '')

            # ── Vidéo : vue, J'aime, commentaire
            url = upload_publication_file('video', VIDEO, 'video/mp4')
            r = api('POST', '/api/publications', {'kind': 'video', 'published': True,
                                                  'data': {'title': 'Vidéo TEST', 'description': 'Description vidéo TEST',
                                                           'videoUrl': url, 'durationSec': 8}})
            vid = (r or {}).get('id')
            if vid:
                created['pubs'].append(vid)
            check('tour : vidéo publiée (upload)', bool(vid), (r or {}).get('error', ''))
            # Sans recharger : l'application relit les vidéos comme le catalogue.
            A.get_by_role('tab', name=re.compile('Favoris')).first.click()
            A.wait_for_timeout(900)
            A.get_by_role('button', name=re.compile('^Découvrir')).first.click()
            d = wait_for(A, lambda: any(url and url in (v or '') for v in A.eval_on_selector_all('video', 'els => els.map(e => e.currentSrc || e.src)')), 80)
            check('app : vidéo publiée dans la tour affichée dans Découvrir (≤ 60 s, sans recharger)', d is not None and d <= 62,
                  f'({d and round(d)} s)')
            A.wait_for_timeout(3000)
            like = A.get_by_role('button', name=re.compile('J’aime'))
            if like.count():
                like.first.click(); A.wait_for_timeout(800)
            comment_btn = A.get_by_role('button', name=re.compile('ommentaire'))
            if comment_btn.count():
                comment_btn.first.click(); A.wait_for_timeout(800)
            if A.get_by_label('Votre commentaire').count():
                A.get_by_label('Votre commentaire').fill('Commentaire TEST')
                A.get_by_label('Envoyer le commentaire').click()
            stats = lambda: next((p.get('stats', {}) for p in api('GET', '/api/publications') if p['id'] == vid), {})
            d = wait_for(A, lambda: (s := stats()).get('views', 0) >= 1 and s.get('likes', 0) >= 1 and s.get('comments', 0) >= 1, 40, 2000)
            check('tour : vue + J’aime + commentaire reçus', d is not None, stats())
            A.screenshot(path=str(SHOTS / 'online-t2-video.png'))
            # La fenêtre des commentaires de la vidéo est encore ouverte : on la ferme.
            A.keyboard.press('Escape')
            A.wait_for_timeout(800)

            # ── Publication photo : 2 photos, description, vue, J'aime, commentaire
            pics = [upload_publication_file('photo', png((200, 120, 40), 160), 'image/png'),
                    upload_publication_file('photo', png((40, 120, 200), 160), 'image/png')]
            r = api('POST', '/api/publications', {'kind': 'photos', 'published': True, 'data': {
                'images': [{'url': u, 'width': 160, 'height': 160} for u in pics if u], 'description': 'Publication photo TEST'}})
            pid = (r or {}).get('id')
            if pid:
                created['pubs'].append(pid)
            check('tour : publication photo (2 photos) publiée', bool(pid), (r or {}).get('error', ''))
            d = wait_for(A, lambda: A.get_by_role('button', name=re.compile('^Photos')).count() > 0, 80)
            check('app : choix « Photos » apparu dans Découvrir (≤ 60 s, sans recharger)', d is not None and d <= 62, f'({d and round(d)} s)')
            if d is not None:
                A.get_by_role('button', name=re.compile('^Photos')).first.click()
                A.wait_for_timeout(2500)
                shown = [u for u in pics if u and any(u in src for src in img_srcs(A))]
                check('app : les 2 photos de la publication affichées', len(shown) == 2, len(shown))
                check('app : description affichée sous les photos', 'Publication photo TEST' in body(A))
                A.get_by_role('button', name='J’aime cette publication').first.click()
                A.wait_for_timeout(600)
                A.get_by_role('button', name='Commenter cette publication').first.click()
                A.wait_for_timeout(700)
                A.get_by_label('Votre commentaire').fill('Commentaire photo TEST')
                A.get_by_label('Envoyer le commentaire').click()
                A.screenshot(path=str(SHOTS / 'online-t2-photos.png'))
                pstats = lambda: next((p.get('stats', {}) for p in api('GET', '/api/publications') if p['id'] == pid), {})
                d = wait_for(A, lambda: (x := pstats()).get('views', 0) >= 1 and x.get('likes', 0) >= 1 and x.get('comments', 0) >= 1, 40, 2000)
                check('tour : vue + J’aime + commentaire de la publication photo reçus', d is not None, pstats())

            # ── Paniers en cours (app → tour)
            cart_checks(browser)
        finally:
            J.undo()
            # ── Nettoyage : commandes, demandes, introuvables, publications, J'aime/commentaires de test
            for o in api('GET', '/api/orders')['orders']:
                if o['customer'].get('name') in NAMES.values() or str(o['customer'].get('company', '')).startswith('Société Test'):
                    api('DELETE', '/api/orders', {'id': o['id']})
            for r in api('GET', '/api/orders?vue=introuvables')['requests']:
                if 'durian' in r.get('product', '').lower():
                    api('DELETE', '/api/orders', {'requestId': r['id']})
            for pid in created['pubs']:
                api('DELETE', '/api/publications', {'id': pid})
            # Paniers des comptes de test (et d'eux seuls).
            for c in api('GET', '/api/orders?vue=paniers').get('carts', []):
                if c['account'].get('name') in NAMES.values():
                    api('DELETE', '/api/orders', {'cartId': c['id']})
            check('nettoyage : paniers de test supprimés',
                  not [c for c in api('GET', '/api/orders?vue=paniers').get('carts', []) if c['account'].get('name') in NAMES.values()])
            left = [o for o in api('GET', '/api/orders')['orders'] if o['customer'].get('name') in NAMES.values()
                    or str(o['customer'].get('company', '')).startswith('Société Test')]
            check('nettoyage : commandes et demandes de test supprimées', not left, len(left))
            for p in (A, B, C):
                errs = [e for e in p.errors if 'favicon' not in e]
                check('aucune erreur de page', not errs, [e[:120] for e in errs[:2]])
            browser.close()


if __name__ == '__main__':
    run()
    save_results('t2')
