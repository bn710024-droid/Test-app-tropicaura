"""
Chasse aux erreurs, deuxième passe : les INTERACTIONS (boutons, formulaires, enregistrements).
Relève erreurs console, erreurs de page, requêtes en échec ; capture chaque étape.

    python scripts/hunt_interactions.py [APP_URL] [TOWER_URL]
"""
import re, sys, json, pathlib
from playwright.sync_api import sync_playwright

APP = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8082'
TOWER = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'
SHOTS = pathlib.Path(__file__).resolve().parent / 'shots'
SHOTS.mkdir(exist_ok=True)
FOUND = []
IGNORED = ('favicon', 'hot-update', 'ws://', 'symbolicate', 'blocker on a POP navigation')


def watch(page, where):
    state = {'screen': where}

    def add(kind, text):
        if any(x in text for x in IGNORED):
            return
        FOUND.append({'where': where, 'screen': state['screen'], 'kind': kind, 'text': text[:400]})

    page.on('console', lambda m: add('console.' + m.type, m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: add('pageerror', str(e)))
    page.on('requestfailed', lambda r: add('requestfailed', f'{r.method} {r.url} — {r.failure}'))
    page.on('response', lambda r: add('http', f'{r.status} {r.request.method} {r.url}') if r.status >= 400 else None)
    return state


def step(page, state, name, fn, wait=800):
    state['screen'] = name
    try:
        fn()
        page.wait_for_timeout(wait)
        page.screenshot(path=str(SHOTS / f'act-{name}.png'))
    except Exception as err:  # noqa: BLE001
        FOUND.append({'where': 'parcours', 'screen': name, 'kind': 'étape impossible', 'text': str(err).split('\n')[0][:300]})


def signup(page, name, country, phone):
    page.goto(APP, timeout=90000)
    page.get_by_role('button', name='Créer mon compte').first.click(timeout=60000)
    page.get_by_role('radio', name=re.compile('^Particulier')).click()
    page.get_by_label('Votre nom').fill(name)
    page.get_by_label('Numéro de téléphone').fill(phone)
    page.get_by_role('button', name='Choisir votre pays').click()
    page.get_by_label('Rechercher un pays').fill(country)
    page.wait_for_timeout(300)
    page.get_by_role('radio', name=re.compile('^' + country)).first.click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_role('button', name=re.compile('^Entrer dans l')).click()
    page.get_by_text('Tout l’étal').wait_for(timeout=30000)


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ───────── Application (mobile)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True,
                              geolocation={'latitude': 14.7167, 'longitude': -17.4677}, permissions=['geolocation'])
    page = ctx.new_page()
    st = watch(page, 'app')
    step(page, st, 'app-inscription', lambda: signup(page, 'Awa Interactions', 'Sénégal', '+221 77 444 55 66'))
    step(page, st, 'app-favori', lambda: page.get_by_role('button', name=re.compile('favoris', re.I)).first.click())
    step(page, st, 'app-favoris', lambda: page.get_by_role('tab', name=re.compile('Favoris')).first.click())
    step(page, st, 'app-decouvrir', lambda: page.get_by_role('button', name=re.compile('^Découvrir')).first.click(), 1500)
    step(page, st, 'app-profil', lambda: page.get_by_role('tab', name=re.compile('Profil')).first.click())
    step(page, st, 'app-profil-modifier', lambda: page.get_by_role('button', name=re.compile('^Modifier')).first.click())
    step(page, st, 'app-profil-fermer', lambda: page.keyboard.press('Escape'))
    step(page, st, 'app-adresse', lambda: page.get_by_role('button', name=re.compile('^Ajouter')).first.click())
    step(page, st, 'app-adresse-fermer', lambda: page.keyboard.press('Escape'))
    step(page, st, 'app-credits', lambda: page.get_by_text('Crédits photo et licences').first.click(), 1200)
    step(page, st, 'app-credits-retour', lambda: page.get_by_role('button', name=re.compile('^(Retour|Fermer)')).first.click())
    step(page, st, 'app-marche', lambda: page.get_by_role('tab', name=re.compile('Marché')).first.click())
    step(page, st, 'app-ajout-carte', lambda: page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).first.click())
    step(page, st, 'app-panier', lambda: page.get_by_role('tab', name=re.compile('Panier')).first.click())
    step(page, st, 'app-panier-plus', lambda: page.get_by_role('button', name=re.compile('Augmenter')).first.click())
    step(page, st, 'app-commander', lambda: page.get_by_role('button', name=re.compile('^Commander')).click())
    step(page, st, 'app-pour-un-proche', lambda: page.get_by_role('radio', name='Valider pour un proche').click())
    step(page, st, 'app-payer-vide', lambda: page.get_by_role('button', name=re.compile('^Payer et confirmer')).click(), 1200)
    step(page, st, 'app-fermer-commande', lambda: page.get_by_role('button', name=re.compile('^(Fermer|Retour)')).first.click())
    step(page, st, 'app-deconnexion', lambda: (page.get_by_role('tab', name=re.compile('Profil')).first.click(),
                                               page.wait_for_timeout(600),
                                               page.get_by_role('button', name=re.compile('Se déconnecter')).first.click()), 1500)
    step(page, st, 'app-reconnexion', lambda: (page.get_by_role('button', name=re.compile('J’ai déjà un compte')).first.click(),
                                               page.wait_for_timeout(600),
                                               page.get_by_label(re.compile('(E-mail ou numéro|Numéro|Identifiant)', re.I)).first.fill('+221 77 444 55 66'),
                                               page.get_by_role('button', name=re.compile('^(Se connecter|Continuer|Entrer)')).first.click()), 2000)
    ctx.close()

    # ───────── Tour (1440×900)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    st = watch(page, 'tour')
    step(page, st, 'tour-fiche', lambda: page.goto(f'{TOWER}/#/produits/poire'), 3000)
    step(page, st, 'tour-fiche-agrandir', lambda: page.get_by_role('button', name=re.compile('^Agrandir')).first.click(), 1200)
    step(page, st, 'tour-fiche-termine', lambda: page.get_by_role('button', name=re.compile('^Terminé')).first.click())
    step(page, st, 'tour-fiche-enregistrer', lambda: page.get_by_role('button', name='Enregistrer et quitter').first.click(), 2500)
    step(page, st, 'tour-rayons', lambda: page.goto(f'{TOWER}/#/rayons'), 2500)
    step(page, st, 'tour-rayon-ouvrir', lambda: page.get_by_role('button', name=re.compile('Agrumes')).first.click(), 1200)
    step(page, st, 'tour-rayon-fermer', lambda: page.keyboard.press('Escape'))
    step(page, st, 'tour-annonces', lambda: (page.goto(f'{TOWER}/#/publications'), page.wait_for_timeout(2000),
                                             page.get_by_role('tab', name=re.compile('Annonces')).first.click()), 1500)
    step(page, st, 'tour-annonce-nouvelle', lambda: page.get_by_role('button', name=re.compile('(Nouvelle annonce|Créer une annonce|Ajouter)')).first.click(), 1500)
    step(page, st, 'tour-annonce-fermer', lambda: page.keyboard.press('Escape'))
    step(page, st, 'tour-reglages-verifier', lambda: (page.goto(f'{TOWER}/#/reglages'), page.wait_for_timeout(2000),
                                                      page.get_by_role('button', name='Vérifier le document publié').click()), 2500)
    step(page, st, 'tour-livraison', lambda: page.goto(f'{TOWER}/#/commandes/livraison'), 2500)
    step(page, st, 'tour-livraison-pays', lambda: (page.get_by_placeholder('Ajouter un pays : France, Belgique…').first.fill('Bel'),), 800)
    step(page, st, 'tour-prix', lambda: page.goto(f'{TOWER}/#/prix'), 2500)
    step(page, st, 'tour-prix-pros', lambda: page.get_by_role('tab', name=re.compile('Professionnels')).first.click(), 1200)
    step(page, st, 'tour-introuvables', lambda: page.goto(f'{TOWER}/#/introuvables'), 2500)
    step(page, st, 'tour-introuvables-message', lambda: page.get_by_role('button', name='Modifier').first.click(), 1200)
    ctx.close()
    browser.close()

out = SHOTS / 'hunt-interactions.json'
out.write_text(json.dumps(FOUND, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'{len(FOUND)} relevés')
for f in FOUND:
    print(f"[{f['kind']}] {f['screen']} — {f['text'][:220]}")
