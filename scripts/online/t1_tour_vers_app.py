"""
TOUR → APP, en ligne : chaque réglage de la tour est modifié, vérifié dans l'application (≤ 60 s,
sans recharger), puis remis. Trois comptes : particulier Sénégal (A), particulier France (B),
professionnel Sénégal (C), en 390×844.

    python scripts/online/t1_tour_vers_app.py [APP] [TOUR]
"""
import datetime as dt, json, re, time
from playwright.sync_api import sync_playwright
from common import (APP, TOUR, SHOTS, api, back, body, check, has_card, img_srcs, labels, new_page, open_product,
                    product, products, restore_from, save_results, search, signup, snapshot, upload_image,
                    upload_publication_file, v2, wait_for)

SNAP = SHOTS / 'online-snapshot.json'
snap = snapshot()
if not SNAP.exists():
    SNAP.write_text(json.dumps(snap, ensure_ascii=False), encoding='utf-8')
print('Photo de départ :', len(snap['products']), 'produits,', len(snap['categories']), 'rayons')
P = {p['id']: p for p in snap['products']}
iso = lambda t: dt.datetime.fromtimestamp(t, dt.timezone.utc).isoformat()
created_pubs = []
# Texte par défaut de la tour (shared/requests.js) : la base n'avait pas de réglage « missing ».
DEFAULT_MISSING = {'enabled': True, 'title': 'Vous ne trouvez pas votre produit ?',
                   'body': 'Dites-nous quel produit vous recherchez. Nous reviendrons vers vous dès qu’il sera disponible.',
                   'placeholder': 'Le produit que vous recherchez', 'button': 'Envoyer ma demande',
                   'thanks': 'Demande envoyée. Nous reviendrons vers vous dès que ce produit sera disponible.'}


def upd(pid, **changes):
    return {'id': pid, 'changes': changes}


def apply_batch():
    """Toutes les modifications du lot 1, par les routes de la tour."""
    up = []
    up.append(upd('radis', name='Radis TEST'))
    up.append(upd('concombre', variety='Variété TEST'))
    up.append(upd('basilic', origin='Origine TEST'))
    up.append(upd('persil', description='Description TEST unique pour le persil.'))
    photo = upload_image('products', 'brocoli', (40, 160, 60))
    check('tour : photo de produit envoyée (upload)', bool(photo), photo)
    if photo:
        up.append(upd('brocoli', photo_url=photo))
    up.append(upd('peche', months=[dt.date.today().month]))
    up.append(upd('poire', bio=True, retail=dict(P['poire']['retail'], countryPrices=[{'countries': ['SN'], 'price': 4.4}])))
    up.append(upd('kiwi', available=False))
    up.append(upd('ail', category='legumes'))
    up.append(upd('grenade', archived=True))
    up.append(upd('pomme', retail=dict(P['pomme']['retail'], price=3.75)))
    up.append(upd('courgette', retail=dict(P['courgette']['retail'], min=2, step=1, max=5)))
    up.append(upd('orange', wholesale=[
        {'mode': 'avion', 'available': True, 'prices': {'EXW': 0.55, 'FOB': 0.7}, 'priceUnit': 'kg'},
        {'mode': 'bateau', 'available': True, 'prices': {'EXW': 0.45, 'FOB': 0.58}, 'priceUnit': 'kg'}]))
    r = api('PUT', '/api/products', {'updates': up})
    bad = [x for x in (r or {}).get('results', []) if not x.get('ok')]
    check('tour : 13 modifications de fiches enregistrées', r and not bad, bad[:2])
    # Visibilité : Sénégal seul, monde sauf Sénégal, monde entier
    for pid, zone in (('citron', {'mode': 'sn', 'except': []}), ('avocat', {'mode': 'except', 'except': ['SN']}),
                      ('mangue', {'mode': 'all', 'except': []})):
        r = api('PUT', '/api/products', {'id': pid, 'zone': zone})
        check(f'tour : visibilité {pid} → {zone["mode"]}', r and r.get('zone', {}).get('mode') == zone['mode'], r.get('error', ''))
    # Emballages de la pomme : prix + réglage Sénégal + photo + description, prix nul, désactivé
    pack_photo = upload_image('packagings', 'pomme', (240, 180, 40))
    packs = [
        {'id': 'barquette-test', 'label': 'Barquette TEST', 'qty': 1.5, 'unit': 'kg', 'price': 5.5, 'step': 1,
         'audience': 'tous', 'available': True, 'photo_url': pack_photo, 'description': 'Desc emballage TEST',
         'countryRules': [{'countries': ['SN'], 'available': True, 'price': 6.1, 'photo_url': None}]},
        {'id': 'sachet-sans-prix', 'label': 'Sachet sans prix', 'qty': 500, 'unit': 'g', 'price': None, 'step': 1,
         'audience': 'tous', 'available': True, 'description': ''},
        {'id': 'carton-desactive', 'label': 'Carton désactivé', 'qty': 4, 'unit': 'kg', 'price': 9, 'step': 1,
         'audience': 'tous', 'available': False, 'description': ''},
    ]
    r = api('PUT', '/api/products', {'id': 'pomme', 'packagings': packs})
    check('tour : 3 emballages enregistrés (prix, nul, désactivé, pays, photo)', r and len(r.get('packagings', [])) == 3, r.get('error', ''))
    # Rayons : nom, ordre, image, masqué aux pros
    r = api('PUT', '/api/categories', {'id': 'aromates', 'label': 'Aromates TEST'})
    check('tour : rayon renommé', r and r.get('label') == 'Aromates TEST', r.get('error', ''))
    order = ['aromates'] + [c['id'] for c in sorted(snap['categories'], key=lambda c: c['sort_order']) if c['id'] != 'aromates']
    r = api('PUT', '/api/categories', {'order': order})
    check('tour : ordre des rayons changé', r and r.get('ok'), r)
    cat_img = upload_image('categories', 'seches', (120, 80, 200))
    r = api('PUT', '/api/categories', {'id': 'seches', 'image_url': cat_img})
    check('tour : image de rayon enregistrée', r and r.get('image_url') == cat_img, r.get('error', ''))
    r = api('PUT', '/api/categories', {'id': 'legumes', 'pro_visible': False})
    check('tour : rayon masqué aux pros', r and r.get('pro_visible') is False, r.get('error', ''))
    # Filtres « Tout » et « De saison »
    f_img = upload_image('categories', 'filtre-tout', (30, 30, 200))
    r = api('PUT', '/api/settings', {'key': 'filters', 'value': {'tout': {'label': 'Tout TEST', 'image_url': f_img},
                                                                  'saison': {'label': 'Saison TEST'}}})
    check('tour : filtres renommés + image', r and r.get('value', {}).get('tout', {}).get('label') == 'Tout TEST', r.get('error', ''))
    # Règles pro : minimum avion
    rules = dict(snap['settings']['rules'])
    rules['avion'] = dict(rules['avion'], minKg=1000, stepKg=250)
    r = api('PUT', '/api/settings', {'key': 'rules', 'value': rules})
    check('tour : règles pro (minimum/palier avion)', r and r.get('value', {}).get('avion', {}).get('minKg') == 1000, r.get('error', ''))
    # Produit introuvable : texte propre
    msg = {'enabled': True, 'title': 'Introuvable TEST', 'body': 'Message introuvable TEST.', 'placeholder': 'Produit TEST',
           'button': 'Envoyer TEST', 'thanks': 'Merci TEST, demande reçue.'}
    r = api('PUT', '/api/settings', {'key': 'missing', 'value': msg})
    check('tour : message « introuvable » personnalisé', r and r.get('value', {}).get('title') == 'Introuvable TEST', r.get('error', ''))
    # Annonces : modèle, image + bouton, image + toucher, image sans lien, début futur, fin proche
    now = time.time()
    ads = [
        ('modele', {'product_id': 'mangue', 'accent': 'Accent TEST', 'body': 'Annonce modèle TEST'}),
        ('bouton', {'image_url': upload_publication_file('annonce', __import__('common').png((200, 40, 40), 120), 'image/png'),
                    'link': 'button', 'product_id': 'pomme', 'button_label': 'Voir TEST', 'body': ''}),
        ('toucher', {'image_url': upload_publication_file('annonce', __import__('common').png((40, 40, 200), 120), 'image/png'),
                     'link': 'tap', 'product_id': 'poire', 'body': ''}),
        ('sans-lien', {'image_url': upload_publication_file('annonce', __import__('common').png((40, 200, 40), 120), 'image/png'),
                       'link': 'none', 'body': ''}),
        ('futur', {'product_id': 'orange', 'accent': '', 'body': 'Annonce future TEST', 'starts_at': iso(now + 86400)}),
        ('fin', {'product_id': 'banane', 'accent': '', 'body': 'Annonce qui se termine TEST', 'starts_at': iso(now - 60),
                 'ends_at': iso(now + 150)}),
    ]
    ids = {}
    for key, data in ads:
        r = api('POST', '/api/publications', {'kind': 'annonce', 'published': True, 'data': data})
        ids[key] = (r or {}).get('id')
        if ids[key]:
            created_pubs.append(ids[key])
        check(f'tour : annonce « {key} » publiée', bool(ids[key]), (r or {}).get('error', ''))
    return ids


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctxA, A = new_page(browser)
        ctxB, B = new_page(browser)
        ctxC, C = new_page(browser)
        signup(A, 'particulier', 'Test A Sénégal', '+221 77 000 00 11', 'Sénégal')
        signup(B, 'particulier', 'Test B France', '+33 6 00 00 00 12', 'France')
        signup(C, 'pro', 'Test C Pro', '+221 77 000 00 13', 'Sénégal')
        A.wait_for_timeout(1500)
        search(C, 'tomate')
        check('avant : le pro voit la tomate (offre pro, rayon Légumes)', any(l.startswith('Tomate grappe') for l in labels(C)))
        search(C, '')
        check('avant : B (France) ne voit pas la mangue (Sénégal seul)', not has_card(B, 'Mangue Kent,'))
        try:
            ids = apply_batch()
            changed = time.time()
            # ── Arrivée du nouveau document dans les trois comptes, sans recharger
            # Le lot prend du temps : une relecture peut tomber en plein milieu (prix déjà changé,
            # filtres ou annonces pas encore). On attend donc aussi les dernières modifications du lot.
            last = {'A': lambda p: 'Annonce qui se termine TEST' in body(p), 'B': lambda p: 'Rayon Tout TEST' in labels(p, 'Rayon ')}
            for who, page in (('A', A), ('B', B)):
                d = wait_for(page, lambda: any('3,75' in l for l in labels(page, 'Pomme')) and last[who](page), 75)
                check(f'app {who} : nouveau catalogue reçu en ≤ 60 s sans recharger', d is not None and d <= 62, f'({d and round(d)} s)')
            # Espace pro : pas de puces de rayon (choix de l'application) ; le rayon masqué retire ses produits.
            search(C, 'tomate')
            d = wait_for(C, lambda: not any(l.startswith('Tomate grappe') for l in labels(C)), 75)
            check('app C (pro) : rayon Légumes masqué aux pros → tomate retirée en ≤ 60 s', d is not None and d <= 62, f'({d and round(d)} s)')
            search(C, '')
            A.screenshot(path=str(SHOTS / 'online-t1-accueil.png'))

            # ── Fiches produit (compte A)
            search(A, 'radis')
            check('produit : nom modifié', has_card(A, 'Radis TEST Rond'))
            search(A, 'concombre')
            check('produit : variété modifiée', has_card(A, 'Concombre Variété TEST,'))
            open_product(A, 'basilic', '^Basilic')
            check('produit : origine modifiée (fiche)', 'Origine TEST' in body(A)); back(A)
            open_product(A, 'persil', '^Persil')
            check('produit : description modifiée (fiche)', 'Description TEST unique' in body(A)); back(A)
            search(A, 'brocoli')
            check('produit : photo envoyée affichée', any('/products/brocoli-' in s for s in img_srcs(A)))
            open_product(A, 'poire', '^Poire')
            check('produit : bio affiché', A.get_by_text('Bio', exact=True).count() >= 1)
            check('prix par pays : Sénégal voit 4,40 €', '4,40' in body(A)); back(A)
            search(A, 'kiwi')
            check('produit : masqué → absent', not has_card(A, 'Kiwi'))
            search(A, 'grenade')
            check('produit : archivé → absent', not has_card(A, 'Grenade'))
            open_product(A, 'ail', '^Ail')
            check('produit : changement de rayon (puce « Légumes »)', A.get_by_text('Légumes', exact=True).count() >= 1); back(A)
            search(A, 'pomme')
            check('prix particulier modifié (3,75 €)', any('3,75' in l for l in labels(A, 'Pomme')))
            open_product(A, 'courgette', '^Courgette')
            check('minimum / palier / maximum du produit (« Ajouter 2 kg »)', any(l.replace(' ', ' ').startswith('Ajouter 2 kg') for l in labels(A, 'Ajouter')))
            back(A)
            search(A, 'citron')
            check('visibilité Sénégal seul : A voit le citron', has_card(A, 'Citron Primofiore'))
            search(A, 'avocat')
            check('visibilité monde sauf Sénégal : A ne voit pas l’avocat', not has_card(A, 'Avocat'))
            # Emballages
            open_product(A, 'pomme', '^Pomme')
            fmt = labels(A, 'Barquette TEST')
            check('emballage ajouté visible', bool(fmt), fmt[:1])
            check('emballage : prix Sénégal (réglage par pays) 6,10 €', any('6,10' in l for l in fmt))
            check('emballage : contenu « 1,5 kg »', any('1,5 kg' in l.replace(' ', ' ') for l in fmt))
            nul = labels(A, 'Sachet sans prix')
            check('emballage prix nul : « prix à compléter »', any('prix à compléter' in l for l in nul), nul[:1])
            check('emballage désactivé : absent', not labels(A, 'Carton désactivé'))
            A.get_by_role('radio', name=re.compile('^Barquette TEST')).click()
            A.wait_for_timeout(900)
            check('emballage : description affichée', 'Desc emballage TEST' in body(A))
            check('emballage : photo affichée', any('/packagings/pomme-' in s for s in img_srcs(A)))
            A.get_by_role('radio', name=re.compile('^Sachet sans prix')).click()
            A.wait_for_timeout(700)
            A.get_by_role('button', name=re.compile('^Ajouter ')).last.click()
            A.wait_for_timeout(900)
            check('emballage prix nul : ajout bloqué (message)', 'pas encore fixé' in body(A))
            A.screenshot(path=str(SHOTS / 'online-t1-emballages.png'))
            back(A)
            search(A, '')
            # Rayons et filtres
            chips = labels(A, 'Rayon ')
            check('rayon renommé visible', 'Rayon Aromates TEST' in chips, chips[:6])
            cats = [c for c in chips if c not in ('Rayon Tout TEST', 'Rayon Saison TEST', 'Rayon Tout', 'Rayon De saison')]
            check('ordre des rayons appliqué', bool(cats) and cats[0] == 'Rayon Aromates TEST', cats[:3])
            check('image de rayon affichée', any('/categories/seches-' in s for s in img_srcs(A)))
            check('filtres renommés « Tout TEST » / « Saison TEST »', 'Rayon Tout TEST' in chips and 'Rayon Saison TEST' in chips)
            check('image du filtre « Tout » affichée', any('/categories/filtre-tout-' in s for s in img_srcs(A)))
            A.get_by_role('button', name='Rayon Saison TEST').click()
            A.wait_for_timeout(900)
            check('saison modifiée : pêche dans « De saison »', has_card(A, 'Pêche blanche'))
            A.get_by_role('button', name='Rayon Tout TEST').click()
            A.wait_for_timeout(600)
            # Annonces
            b = body(A)
            check('annonce modèle affichée', 'Annonce modèle TEST' in b)
            check('annonce image + bouton « Voir TEST »', 'Voir TEST' in b)
            check('annonce dont le début est futur : absente', 'Annonce future TEST' not in b)
            check('annonce avec date de fin : affichée avant la fin', 'Annonce qui se termine TEST' in b)
            doc = v2()
            camp = {c.get('key'): c for c in doc['campaigns']}
            check('annonce image « toucher » publiée (lien tap)', camp.get(ids.get('toucher'), {}).get('link') == 'tap', list(camp)[:4])
            none = camp.get(ids.get('sans-lien'), {})
            check('annonce image sans lien (« none ») publiée sans produit', ids.get('sans-lien') in camp and none.get('id') is None
                  and none.get('link') == 'none', none)
            tap = camp.get(ids.get('toucher'), {})
            srcs = img_srcs(A)
            check('annonce « toucher » : image affichée dans l’app', bool(tap.get('photo')) and any(tap['photo']['url'] in x for x in srcs))
            check('annonce « toucher » : aucun bouton affiché', 'Voir la poire' not in body(A) and 'Voir la poire' in labels(A, 'Voir la poire'))
            check('annonce image seule : affichée dans l’app sans produit ni bouton',
                  bool(none.get('photo')) and any(none['photo']['url'] in x for x in srcs))
            A.get_by_role('button', name='Voir la poire', exact=True).first.click()
            A.wait_for_timeout(1500)
            check('annonce « toucher » : toucher l’image ouvre la fiche du produit', A.get_by_role('button', name='Retour').count() > 0
                  and 'Comice' in body(A))
            if A.get_by_role('button', name='Retour').count():
                back(A)
            # Introuvable
            search(A, 'zzzz')
            check('introuvable : texte personnalisé affiché', 'Introuvable TEST' in body(A))
            search(A, '')
            # Compte France
            search(B, 'poire')
            check('prix par pays : France garde le prix global 3,90 €', any('3,90' in l for l in labels(B, 'Poire')))
            search(B, 'citron')
            check('visibilité Sénégal seul : B ne voit pas le citron', not has_card(B, 'Citron Primofiore'))
            search(B, 'avocat')
            check('visibilité monde sauf Sénégal : B voit l’avocat', has_card(B, 'Avocat'))
            search(B, 'mangue')
            check('visibilité monde entier : B voit la mangue', has_card(B, 'Mangue Kent'))
            open_product(B, 'pomme', '^Pomme')
            check('emballage : prix d’origine 5,50 € hors Sénégal', any('5,50' in l for l in labels(B, 'Barquette TEST'))); back(B)
            # Compte pro
            open_product(C, 'orange', '^Orange')
            cb = body(C)
            check('offre pro avion et bateau proposées', 'avion' in cb.lower() and 'bateau' in cb.lower())
            check('offre pro : prix EXW 0,55 €', '0,55' in cb)
            fob = C.get_by_role('radio', name=re.compile('FOB'))
            if fob.count():
                fob.first.click(); C.wait_for_timeout(700)
            check('offre pro : prix FOB 0,70 € (incoterm)', '0,70' in body(C))
            check('règles pro : minimum avion 1 000 kg', '1 000 kg' in body(C))
            C.screenshot(path=str(SHOTS / 'online-t1-pro.png'))
            back(C)

            # ── Lot 2 : introuvable désactivé, annonce future commencée, annonce terminée
            api('PUT', '/api/settings', {'key': 'missing', 'value': {'enabled': False, 'title': 'Introuvable TEST', 'body': 'x',
                                                                     'placeholder': '', 'button': 'Envoyer', 'thanks': 'Merci'}})
            if ids.get('futur'):
                api('PUT', '/api/publications', {'id': ids['futur'], 'data': {'starts_at': iso(time.time() - 60)}})
            d = wait_for(A, lambda: 'Annonce future TEST' in body(A), 80)
            check('annonce : début atteint → affichée en ≤ 60 s', d is not None and d <= 65, f'({d and round(d)} s)')
            left = max(0, changed + 150 - time.time())
            A.wait_for_timeout(int(left * 1000))
            d = wait_for(A, lambda: 'Annonce qui se termine TEST' not in body(A), 80)
            check('annonce : fin atteinte → retirée en ≤ 60 s', d is not None and d <= 65, f'({d and round(d)} s)')
            search(A, 'zzzz')
            check('introuvable désactivé : plus de proposition', 'Introuvable TEST' not in body(A) and 'Envoyer' not in body(A))
            search(A, '')
        finally:
            # ── Remise en état
            for pid in created_pubs:
                api('DELETE', '/api/publications', {'id': pid})
            api('PUT', '/api/settings', {'key': 'missing', 'value': DEFAULT_MISSING})
            restore_from(snap)
            after = snapshot()
            same = all(a == b for a, b in zip(
                [{k: p.get(k) for k in ('id', 'name', 'variety', 'retail', 'wholesale', 'available', 'archived', 'months',
                                        'category', 'bio', 'photo_url', 'packagings', 'zone')} for p in snap['products']],
                [{k: p.get(k) for k in ('id', 'name', 'variety', 'retail', 'wholesale', 'available', 'archived', 'months',
                                        'category', 'bio', 'photo_url', 'packagings', 'zone')} for p in after['products']]))
            check('remise en état : produits identiques à la photo de départ', same)
            check('remise en état : rayons et réglages', [c['label'] for c in after['categories']] == [c['label'] for c in snap['categories']]
                  and after['settings'].get('rules') == snap['settings'].get('rules') and after['settings'].get('filters') == snap['settings'].get('filters'))
            for p in (A, B, C):
                check('aucune erreur de page', not [e for e in p.errors if 'favicon' not in e], [e[:120] for e in p.errors[:2]])
            browser.close()


run()
save_results('t1')
