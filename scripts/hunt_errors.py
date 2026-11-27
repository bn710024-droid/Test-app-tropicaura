"""
Chasse aux erreurs — parcourt les écrans de l'application (390×844 et 1440×900) et de la tour
(1440×900) et relève : erreurs console, erreurs de page, requêtes en échec (réseau ou HTTP ≥ 400).
Une capture par écran dans scripts/shots/hunt-*.png pour la revue visuelle.

    python scripts/hunt_errors.py [APP_URL] [TOWER_URL]
"""
import re, sys, json, pathlib
from playwright.sync_api import sync_playwright

APP = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8082'
TOWER = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'
SHOTS = pathlib.Path(__file__).resolve().parent / 'shots'
SHOTS.mkdir(exist_ok=True)
FOUND = []
IGNORED = ('favicon', 'hot-update', '/_expo/', 'ws://', 'symbolicate')


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


def shot(page, state, name):
    state['screen'] = name
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / f'hunt-{name}.png'))


def step(page, state, name, fn):
    state['screen'] = name
    try:
        fn()
        shot(page, state, name)
    except Exception as err:  # noqa: BLE001 — on relève tout, on continue
        FOUND.append({'where': 'parcours', 'screen': name, 'kind': 'étape impossible', 'text': str(err).split('\n')[0][:300]})


def signup(page, kind, country='Sénégal', name='Chasse Test'):
    page.goto(APP)
    page.get_by_role('button', name='Créer mon compte').first.click(timeout=60000)
    page.get_by_role('radio', name=re.compile('^' + kind)).click()
    page.wait_for_timeout(500)
    page.get_by_label('Votre nom').fill(name)
    page.get_by_label(re.compile('^(Numéro de téléphone|Téléphone)$')).first.fill('+221 77 300 40 50')
    page.get_by_role('button', name='Choisir votre pays').click()
    page.get_by_label('Rechercher un pays').fill(country)
    page.wait_for_timeout(300)
    page.get_by_role('radio', name=re.compile('^' + country)).first.click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_role('button', name=re.compile('^Entrer dans l')).click()
    page.wait_for_timeout(2500)


def tab(page, label):
    page.get_by_role('tab', name=re.compile(label)).first.click()
    page.wait_for_timeout(900)


def retail_tour(page, state, size):
    step(page, state, f'{size}-accueil', lambda: signup(page, 'Particulier'))
    for shelf in ['Séchés', 'Agrumes', 'De saison', 'Tout']:
        step(page, state, f'{size}-rayon-{shelf}', lambda s=shelf: page.get_by_role('button', name=f'Rayon {s}').first.click())
    step(page, state, f'{size}-recherche-vide', lambda: page.get_by_label('Rechercher un fruit ou un légume').fill('durian'))
    step(page, state, f'{size}-recherche', lambda: page.get_by_label('Rechercher un fruit ou un légume').fill('mangue'))
    step(page, state, f'{size}-fiche', lambda: page.get_by_role('button', name=re.compile('^Mangue séchée')).first.click())
    step(page, state, f'{size}-fiche-emballage', lambda: page.get_by_role('radio', name=re.compile('^Pot')).first.click())
    step(page, state, f'{size}-ajout', lambda: page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click())
    step(page, state, f'{size}-panier', lambda: page.get_by_role('button', name='Ouvrir le panier').first.click())
    step(page, state, f'{size}-validation', lambda: page.get_by_role('button', name=re.compile('^Commander')).click())
    step(page, state, f'{size}-retour', lambda: page.get_by_role('button', name=re.compile('^(Retour|Fermer)')).first.click())
    for t in ['Favoris', 'Commandes', 'Profil', 'Marché']:
        step(page, state, f'{size}-onglet-{t}', lambda t=t: tab(page, t))


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for size, vp, mobile in [('mobile', {'width': 390, 'height': 844}, True), ('desktop', {'width': 1440, 'height': 900}, False)]:
        ctx = browser.new_context(viewport=vp, has_touch=mobile, is_mobile=mobile,
                                  geolocation={'latitude': 14.7167, 'longitude': -17.4677}, permissions=['geolocation'])
        page = ctx.new_page()
        state = watch(page, f'app {size}')
        retail_tour(page, state, size)
        ctx.close()

    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    state = watch(page, 'app pro')
    step(page, state, 'pro-accueil', lambda: signup(page, 'Professionnel', name='Chasse Pro'))
    step(page, state, 'pro-fiche', lambda: (page.get_by_label('Rechercher un fruit ou un légume').fill('ananas'),
                                             page.wait_for_timeout(400),
                                             page.get_by_role('button', name=re.compile('^Ananas séché')).first.click()))
    step(page, state, 'pro-ajout', lambda: page.get_by_role('button', name=re.compile('^Ajouter .* à la demande')).click())
    step(page, state, 'pro-demande', lambda: page.get_by_role('button', name='Ouvrir ma demande en cours').first.click())
    step(page, state, 'pro-finaliser', lambda: page.get_by_role('button', name='Finaliser la demande').click())
    ctx.close()

    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    state = watch(page, 'tour')
    routes = ['', 'produits', 'produits/mangue-sechee', 'prix', 'rayons', 'introuvables', 'publications', 'reglages',
              'commandes', 'commandes/clients', 'commandes/statistiques', 'commandes/statuts', 'commandes/livraison']
    for r in routes:
        name = 'tour-' + (r.replace('/', '-') or 'accueil')
        step(page, state, name, lambda r=r: (page.goto(f'{TOWER}/#/{r}'), page.wait_for_timeout(2500)))
    ctx.close()
    browser.close()

out = pathlib.Path(__file__).resolve().parent / 'shots' / 'hunt.json'
out.write_text(json.dumps(FOUND, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'{len(FOUND)} relevés')
seen = {}
for f in FOUND:
    key = (f['kind'], re.sub(r'\d+', '#', f['text'])[:160])
    seen.setdefault(key, []).append(f['screen'])
for (kind, text), screens in sorted(seen.items(), key=lambda x: -len(x[1])):
    print(f'[{kind}] x{len(screens)} ({screens[0]}…) {text}')
