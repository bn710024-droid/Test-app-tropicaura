"""
Test de bout en bout — application branchée sur la tour de contrôle.

Prérequis : la tour tourne (`npm run local` dans le dépôt de la tour → http://localhost:3000) et
l'application est servie avec EXPO_PUBLIC_CONTROL_TOWER_URL=http://localhost:3000
(`npx expo start --web`, ou un export web servi ailleurs).

    python scripts/test_tower_live.py [APP_URL] [TOWER_URL]

Scénario « catalogue » : prix modifié, produit masqué, emballage ajouté dans la tour → visibles
dans l'application en moins de 60 s, sans recharger la page. La tour est remise dans son état
initial à la fin. Scénario « commande » : commande passée dans l'application → reçue par la tour
→ statut changé dans la tour → affiché dans l'application.
Captures dans scripts/shots/.
"""
import json, re, sys, time, pathlib, urllib.request
from playwright.sync_api import sync_playwright

APP = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8082'
TOWER = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'
SHOTS = pathlib.Path(__file__).resolve().parent / 'shots'
SHOTS.mkdir(exist_ok=True)
RESULTS = []


def check(name, ok, extra=''):
    RESULTS.append((name, ok))
    print(('PASS' if ok else 'FAIL'), name, extra, flush=True)


def api(method, path, body=None):
    req = urllib.request.Request(TOWER + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b'null')


def product(pid):
    return next(p for p in api('GET', '/api/products') if p['id'] == pid)


def wait_for(page, fn, timeout_s):
    start = time.time()
    while time.time() - start < timeout_s:
        if fn():
            return time.time() - start
        page.wait_for_timeout(1000)
    return None


def signup(page, name, phone):
    page.goto(APP, timeout=90000)
    page.get_by_role('button', name='Créer mon compte').first.click(timeout=60000)
    page.get_by_role('radio', name=re.compile('^Particulier')).click()
    page.get_by_text('Vos informations').first.wait_for(timeout=10000)
    page.get_by_label('Votre nom').fill(name)
    page.get_by_label('Numéro de téléphone').fill(phone)
    page.get_by_role('button', name='Choisir votre pays').click()
    page.get_by_label('Rechercher un pays').fill('Sénégal')
    page.wait_for_timeout(300)
    page.get_by_role('radio', name=re.compile('^Sénégal')).first.click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_text('Choix de connexion').first.wait_for(timeout=10000)
    page.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_text('Recommandez Primeur').wait_for(timeout=10000)
    page.get_by_role('button', name=re.compile('^Entrer dans l')).click()
    page.get_by_text('Tout l’étal').wait_for(timeout=30000)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                              device_scale_factor=2, is_mobile=True,
                              geolocation={'latitude': 14.7167, 'longitude': -17.4677},
                              permissions=['geolocation'])
    page = ctx.new_page()
    catalog_calls = []
    page.on('request', lambda r: catalog_calls.append(time.time()) if '/api/catalog?v=2' in r.url else None)
    signup(page, 'Test Tour', '+221 77 222 33 44')
    check('app lit le catalogue de la tour (?v=2)', len(catalog_calls) >= 1)

    pomme = product('pomme')
    poire = product('poire')
    old_price = pomme['retail']['price']
    new_price = round(old_price + 0.9, 2)
    old_packs = pomme['packagings']
    price_txt = f"{new_price:.2f}".replace('.', ',')

    home = lambda: page.inner_text('body')
    check('avant : Poire visible', 'Poire' in home())
    check('avant : prix pomme d’origine', f"{old_price:.2f}".replace('.', ',') in home())
    page.screenshot(path=str(SHOTS / 'live-1-avant.png'))

    # ── Modifications dans la tour (mêmes routes que l'écran Produits)
    retail = dict(pomme['retail'], price=new_price)
    r = api('PUT', '/api/products', {'updates': [
        {'id': 'pomme', 'changes': {'retail': retail}, 'expected_updated_at': pomme['updated_at']},
        {'id': 'poire', 'changes': {'available': False}, 'expected_updated_at': poire['updated_at']},
    ]})
    check('tour : prix + masquage enregistrés', all(x.get('ok') for x in r['results']), json.dumps(r)[:200])
    cagette = {'id': 'cagette', 'label': 'Cagette', 'qty': 5, 'unit': 'kg', 'price': 14.5, 'step': 1,
               'audience': 'tous', 'available': True, 'description': 'Cagette bois de 5 kg'}
    api('PUT', '/api/products', {'id': 'pomme', 'packagings': old_packs + [cagette]})
    changed_at = time.time()
    v2 = api('GET', '/api/catalog?v=2')
    vp = next(p for p in v2['products'] if p['id'] == 'pomme')
    check('tour : ?v=2 publie le nouveau prix et l’emballage', vp['retail']['price'] == new_price
          and any(f['id'] == 'cagette' and f['grams'] == 5000 and f['price'] == 14.5 for f in vp['formats']))

    # ── L'application suit, sans recharger
    delay = wait_for(page, lambda: price_txt in home() and 'Poire' not in home(), 75)
    check('app : nouveau prix + produit masqué en ≤ 60 s sans recharger',
          delay is not None and delay <= 62, f'({delay and round(delay)} s)')
    page.screenshot(path=str(SHOTS / 'live-2-apres-accueil.png'))
    page.get_by_role('button', name=re.compile('^Pomme')).first.click()
    page.get_by_text('Choisissez votre format').wait_for(timeout=15000)
    cag = page.get_by_role('radio', name=re.compile('^Cagette'))
    check('app : emballage « Cagette » proposé sur la fiche', cag.count() == 1)
    initial = page.get_by_role('radio', name=re.compile('^Produit initial'))
    check('app : aucun emballage présélectionné', 'true' in (initial.first.get_attribute('aria-checked') or ''))
    cag.first.click()
    page.wait_for_timeout(900)
    check('app : prix de la cagette 14,50 €', page.get_by_text('14,50 €', exact=True).count() >= 1)
    shown = page.locator('body').inner_text().replace('\u00A0', ' ').replace('\u202F', ' ')
    check('app : contenu « 5 kg » sur la carte et la fiche, jamais « 5000 g »',
          '/ 5 kg' in shown and 'contient 5 kg' in shown and 'Contenu : 5 kg par cagette' in shown
          and '5000 g' not in shown, f'({[l for l in shown.splitlines() if "kg" in l][:4]})')
    page.screenshot(path=str(SHOTS / 'live-3-apres-fiche.png'))

    # ── Remise en état de la tour
    pomme2, poire2 = product('pomme'), product('poire')
    api('PUT', '/api/products', {'updates': [
        {'id': 'pomme', 'changes': {'retail': dict(pomme2['retail'], price=old_price)}},
        {'id': 'poire', 'changes': {'available': True}},
    ]})
    api('PUT', '/api/products', {'id': 'pomme', 'packagings': old_packs})
    check('tour remise en état', product('pomme')['retail']['price'] == old_price and product('poire')['available'])

    # ── Prix par pays : prix propre au Sénégal pour la pomme → le compte sénégalais le voit
    pomme3 = product('pomme')
    sn_price = round(pomme3['retail']['price'] + 0.55, 2)
    r = api('PUT', '/api/products', {'updates': [{'id': 'pomme', 'changes': {
        'retail': dict(pomme3['retail'], countryPrices=[{'countries': ['SN'], 'price': sn_price}])}}]})
    check('tour : prix Sénégal enregistré', all(x.get('ok') for x in r['results']), json.dumps(r)[:160])
    sn_txt = f"{sn_price:.2f}".replace('.', ',')
    delay = wait_for(page, lambda: sn_txt in home(), 75)
    check('app : compte Sénégal voit le prix Sénégal (countryPrices)', delay is not None, f'({delay and round(delay)} s)')
    v2p = next(p for p in api('GET', '/api/catalog?v=2')['products'] if p['id'] == 'pomme')
    check('tour : prix global inchangé, prix SN publié à part', v2p['retail']['price'] == pomme3['retail']['price']
          and v2p['retail'].get('countryPrices') == [{'countries': ['SN'], 'price': sn_price}])
    page.screenshot(path=str(SHOTS / 'live-5b-prix-pays.png'))
    api('PUT', '/api/products', {'updates': [{'id': 'pomme', 'changes': {'retail': dict(pomme3['retail'], countryPrices=[])}}]})

    # ── Annonce publiée dans la tour → bandeau d'accueil de l'application
    page.get_by_role('button', name='Retour').first.click()
    page.wait_for_timeout(600)
    ad = api('POST', '/api/publications', {'kind': 'annonce', 'published': True,
                                            'data': {'product_id': 'mangue', 'accent': 'du Sénégal', 'body': 'Annonce publiée par la tour'}})
    ad_id = (ad or {}).get('id')
    check('tour : annonce publiée', bool(ad_id), json.dumps(ad)[:160])
    delay = wait_for(page, lambda: 'Annonce publiée par la tour' in home(), 75)
    check('app : bandeau d’annonce affiché en ≤ 60 s', delay is not None and delay <= 62, f'({delay and round(delay)} s)')
    page.screenshot(path=str(SHOTS / 'live-6-annonce.png'))
    if ad_id:
        api('DELETE', '/api/publications', {'id': ad_id})
        delay = wait_for(page, lambda: 'Annonce publiée par la tour' not in home(), 75)
        check('app : bandeau retiré après suppression dans la tour', delay is not None)

    # ── Produit introuvable : recherche vide dans tout le catalogue → demande envoyée à la tour
    page.get_by_label('Rechercher un fruit ou un légume').fill('durian')
    page.wait_for_timeout(800)
    msg = api('GET', '/api/catalog?v=2')['productRequest']
    check('app : message « produit introuvable » de la tour affiché', page.get_by_text(msg['title']).count() >= 1)
    page.screenshot(path=str(SHOTS / 'live-7-introuvable.png'))
    page.get_by_role('button', name=msg['button']).click()
    page.wait_for_timeout(2500)
    check('app : confirmation affichée après envoi', page.get_by_text(msg['thanks'][:30]).count() >= 1)
    reqs = api('GET', '/api/orders?vue=introuvables')['requests']
    mine_req = [r for r in reqs if r.get('product', '').lower() == 'durian']
    check('tour : demande « durian » reçue dans Introuvables', len(mine_req) >= 1)
    for r in mine_req:
        api('DELETE', '/api/orders', {'requestId': r['id']})
    page.get_by_label('Rechercher un fruit ou un légume').fill('')
    page.wait_for_timeout(500)

    # ── Statistiques des publications : l'état complet est accepté par la tour
    r = api('POST', '/api/publications?public=reactions', {'account': {'id': 'test-compte-1', 'name': '', 'type': 'particulier'},
                                                            'views': [], 'likes': [], 'comments': []})
    check('tour : état des réactions accepté', bool(r and r.get('ok')))

    # ── Scénario « commande » : app → tour → statut changé dans la tour → app
    page.get_by_label('Rechercher un fruit ou un légume').fill('pomme')
    page.wait_for_timeout(500)
    page.get_by_role('button', name=re.compile('^Pomme Gala')).first.click()
    page.get_by_text('Dans le même rayon').wait_for(timeout=15000)
    page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click()
    page.wait_for_timeout(500)
    page.get_by_role('button', name='Ouvrir le panier').first.click()
    page.get_by_role('button', name=re.compile('^Commander')).click()
    page.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    page.get_by_role('radio', name='Valider pour moi').click()
    page.get_by_role('button', name=re.compile('Ajouter votre adresse')).click()
    page.get_by_label('Nom du destinataire').fill('Awa Diop Tour')
    page.get_by_role('button', name=re.compile('Pays')).click()
    page.get_by_label('Rechercher un pays').fill('Sénégal')
    page.wait_for_timeout(400)
    page.get_by_role('radio', name=re.compile('^Sénégal')).first.click()
    page.get_by_role('textbox', name='Adresse', exact=True).fill('12 Rue 10, Médina')
    page.get_by_role('textbox', name='Ville', exact=True).fill('Dakar')
    page.get_by_role('button', name=re.compile('Enregistrer l’adresse')).click()
    page.wait_for_timeout(900)
    page.get_by_role('button', name='Partager ma position pour le livreur').click()
    page.wait_for_timeout(3000)
    page.get_by_label('E-mail', exact=True).fill('awa@exemple.test')
    page.get_by_label('Téléphone ou WhatsApp').fill('+221 77 123 45 67')
    posted = []
    page.on('request', lambda r: posted.append(r.post_data or '') if r.method == 'POST' and '/api/orders' in r.url else None)
    page.get_by_role('button', name=re.compile('^Payer et confirmer')).click()
    page.wait_for_timeout(3000)
    check('app : commande envoyée à la tour (POST /api/orders)', any('"type":"commande"' in b for b in posted))
    page.get_by_role('button', name='Suivre ma commande').click()
    page.wait_for_timeout(1200)
    check('app : commande « En validation »', page.get_by_label(re.compile('^Suivi : En validation')).count() >= 1)

    orders = api('GET', '/api/orders')['orders']
    mine = [o for o in orders if o['customer'].get('name') == 'Awa Diop Tour']
    check('tour : commande reçue', len(mine) == 1, f'({len(mine)})')
    if mine:
        o = mine[0]
        check('tour : lignes, devise, position, paiement choisi', len(o['lines']) == 1 and o['lines'][0]['qty'] > 0
              and o.get('currency') == 'EUR' and o.get('location') is not None and o['status'] == 'attente')
        r = api('PUT', '/api/orders', {'id': o['id'], 'paid': True, 'via': 'wave'})
        check('tour : paiement pointé → confirmée', r.get('status') == 'confirmee')
        delay = wait_for(page, lambda: page.get_by_label(re.compile('^Suivi : Validée')).count() >= 1
                         and page.get_by_label(re.compile('^Suivi : En validation')).count() == 0, 75)
        check('app : statut « Validée » relu dans la tour en ≤ 60 s', delay is not None and delay <= 62,
              f'({delay and round(delay)} s)')
        page.screenshot(path=str(SHOTS / 'live-4-commande-validee.png'))
        first_at = o['location']['at']
        moved = lambda: next((x for x in api('GET', '/api/orders')['orders'] if x['id'] == o['id']), {}).get('location', {}).get('at') != first_at
        delay = wait_for(page, moved, 75)
        check('app : position du livreur rafraîchie pendant le suivi (sans nouvel accord)', delay is not None,
              f'({delay and round(delay)} s)')
        api('DELETE', '/api/orders', {'id': o['id']})

    # ── File locale : commande passée pendant une coupure → renvoyée dès que la tour répond
    cut = {'on': True}
    def offline(route):
        if cut['on'] and route.request.method == 'POST':
            route.abort()
        else:
            route.continue_()
    page.route('**/api/orders*', offline)
    page.get_by_role('tab', name=re.compile('Marché')).first.click()
    page.wait_for_timeout(600)
    page.get_by_label('Rechercher un fruit ou un légume').fill('poire')
    page.wait_for_timeout(500)
    page.get_by_role('button', name=re.compile('^Poire')).first.click()
    page.get_by_text('Dans le même rayon').wait_for(timeout=15000)
    page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click()
    page.wait_for_timeout(500)
    page.get_by_role('button', name='Ouvrir le panier').first.click()
    page.get_by_role('button', name=re.compile('^Commander')).click()
    page.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    page.get_by_role('radio', name='Valider pour moi').click()
    page.wait_for_timeout(400)
    if page.get_by_role('button', name='Partager ma position pour le livreur').count():
        page.get_by_role('button', name='Partager ma position pour le livreur').click()
        page.wait_for_timeout(2500)
    page.get_by_role('button', name=re.compile('^Payer et confirmer')).click()
    page.wait_for_timeout(3000)
    count_poire = lambda: len([x for x in api('GET', '/api/orders')['orders']
                               if x['customer'].get('name') == 'Awa Diop Tour' and any('Poire' in l['name'] for l in x['lines'])])
    check('coupure : commande gardée sur l’appareil (rien reçu par la tour)', count_poire() == 0)
    cut['on'] = False
    delay = wait_for(page, lambda: count_poire() == 1, 75)
    check('coupure : commande renvoyée automatiquement au retour du réseau (≤ 60 s)', delay is not None and delay <= 62,
          f'({delay and round(delay)} s)')
    page.unroute('**/api/orders*')
    for x in api('GET', '/api/orders')['orders']:
        if x['customer'].get('name') == 'Awa Diop Tour':
            api('DELETE', '/api/orders', {'id': x['id']})

    # ── Livraison GP : pays desservis réglés dans la tour → proposés à la validation (adresse France)
    logi = api('GET', '/api/orders')['logistics']
    api('PUT', '/api/orders', {'logistics': dict(logi, gpCountries=['FR'])})
    gp = api('GET', '/api/catalog?v=2')['delivery']['gp']
    check('tour : GP France publié dans delivery.gp', gp == [{'country': 'FR', 'options': [logi['gpDelivery'] == 'domicile' and 'domicile' or 'aéroport']}])
    ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    p3 = ctx3.new_page()
    p3.goto(APP, timeout=90000)
    p3.get_by_role('button', name='Créer mon compte').first.click(timeout=60000)
    p3.get_by_role('radio', name=re.compile('^Particulier')).click()
    p3.get_by_label('Votre nom').fill('Client Paris')
    p3.get_by_label('Numéro de téléphone').fill('+33 6 12 34 56 78')
    p3.get_by_role('button', name='Choisir votre pays').click()
    p3.get_by_label('Rechercher un pays').fill('France')
    p3.wait_for_timeout(300)
    p3.get_by_role('radio', name=re.compile('^France')).first.click()
    p3.get_by_role('button', name='Continuer').click()
    p3.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    p3.get_by_role('button', name='Continuer').click()
    p3.get_by_role('button', name=re.compile('^Entrer dans l')).click()
    p3.get_by_text('Tout l’étal').wait_for(timeout=30000)
    p3.get_by_label('Rechercher un fruit ou un légume').fill('pomme')
    p3.wait_for_timeout(500)
    p3.get_by_role('button', name=re.compile('^Pomme Gala')).first.click()
    p3.get_by_text('Dans le même rayon').wait_for(timeout=15000)
    p3.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click()
    p3.wait_for_timeout(500)
    p3.get_by_role('button', name='Ouvrir le panier').first.click()
    p3.get_by_role('button', name=re.compile('^Commander')).click()
    p3.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    p3.get_by_role('radio', name='Valider pour moi').click()
    p3.get_by_role('button', name=re.compile('Ajouter votre adresse')).click()
    p3.get_by_label('Nom du destinataire').fill('Client Paris')
    p3.get_by_role('button', name=re.compile('Pays')).click()
    p3.get_by_label('Rechercher un pays').fill('France')
    p3.wait_for_timeout(400)
    p3.get_by_role('radio', name=re.compile('^France')).first.click()
    p3.get_by_role('textbox', name='Adresse', exact=True).fill('10 rue de Rivoli')
    p3.get_by_role('textbox', name='Ville', exact=True).fill('Paris')
    p3.get_by_role('button', name=re.compile('Enregistrer l’adresse')).click()
    p3.wait_for_timeout(1200)
    check('app : validation France propose le GP configuré', p3.get_by_text(re.compile('Livraison via GP')).count() >= 1)
    p3.screenshot(path=str(SHOTS / 'live-8-gp-france.png'))
    ctx3.close()
    api('PUT', '/api/orders', {'logistics': dict(logi, gpCountries=[])})

    # ── Scénario « demande pro » : app → tour → étape changée dans la tour → app
    ctx2 = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    p2 = ctx2.new_page()
    p2.goto(APP, timeout=90000)
    p2.get_by_role('button', name='Créer mon compte').first.click(timeout=60000)
    p2.get_by_role('radio', name=re.compile('^Professionnel')).click()
    p2.get_by_text('Votre activité').first.wait_for(timeout=10000)
    p2.get_by_label('Votre nom').fill('Pro Tour Test')
    p2.get_by_label('Téléphone', exact=True).fill('+221 77 765 43 21')
    p2.get_by_role('button', name='Choisir votre pays').click()
    p2.get_by_label('Rechercher un pays').fill('Sénégal')
    p2.wait_for_timeout(300)
    p2.get_by_role('radio', name=re.compile('^Sénégal')).first.click()
    p2.get_by_role('button', name='Continuer').click()
    p2.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    p2.get_by_role('button', name='Continuer').click()
    p2.get_by_role('button', name=re.compile('^Entrer dans l')).click()
    p2.get_by_text('Catalogue professionnel').wait_for(timeout=30000)
    p2.get_by_label('Rechercher un fruit ou un légume').fill('mangue séchée')
    p2.wait_for_timeout(500)
    p2.get_by_role('button', name=re.compile('^Mangue séchée')).first.click()
    p2.get_by_text('Offre professionnelle').wait_for(timeout=15000)
    p2.get_by_role('button', name=re.compile('^Ajouter .* à la demande')).click()
    p2.wait_for_timeout(600)
    p2.get_by_role('button', name='Ouvrir ma demande en cours').first.click()
    p2.get_by_role('button', name='Finaliser la demande').click()
    p2.get_by_label('E-mail', exact=True).fill('pro@exemple.test')
    p2.get_by_role('textbox', name=re.compile('^Société')).fill('Société Test Tour')
    sent = []
    p2.on('request', lambda r: sent.append(r.post_data or '') if r.method == 'POST' and '/api/orders' in r.url else None)
    p2.get_by_role('button', name='Envoyer la demande').click()
    p2.wait_for_timeout(3000)
    check('app pro : demande envoyée à la tour', any('demande_professionnelle' in b for b in sent))
    pro = [o for o in api('GET', '/api/orders')['orders'] if o['customer'].get('company') == 'Société Test Tour']
    check('tour : demande pro reçue (étape « Intérêt reçu »)', len(pro) == 1 and pro[0].get('stage') == 'interet',
          f'({len(pro)})')
    if pro:
        r = api('PUT', '/api/orders', {'id': pro[0]['id'], 'stage': 'contrat'})
        check('tour : étape « Contrat conclu » → confirmée', r.get('status') == 'confirmee')
        tracked = api('GET', f"/api/orders?compte={pro[0]['customer']['account_id']}")['orders']
        check('tour : suivi pro publié avec l’étape en clair', tracked and tracked[0].get('stageLabel') == 'Contrat conclu')
        p2.goto(APP)  # retour à l'accueil (l'écran de succès est terminal)
        p2.get_by_text('Catalogue professionnel').wait_for(timeout=30000)
        p2.get_by_role('tab', name=re.compile('Commandes')).click()
        delay = wait_for(p2, lambda: 'Confirmée' in p2.inner_text('body'), 75)
        check('app pro : statut relu dans la tour (Confirmée)', delay is not None, f'({delay and round(delay)} s)')
        p2.screenshot(path=str(SHOTS / 'live-5-demande-pro.png'))
        api('DELETE', '/api/orders', {'id': pro[0]['id']})
    ctx2.close()

    browser.close()

failed = [n for n, ok in RESULTS if not ok]
print(f"\n{len(RESULTS)} vérifications, {len(failed)} échec(s).")
sys.exit(1 if failed else 0)
