"""
CHAQUE BOUTON, en ligne : sur chaque écran de l'application et de la tour, en 390×844 et 1440×900,
clique chaque élément interactif visible (bouton, onglet, choix), relève l'effet (l'écran change,
une fenêtre s'ouvre, un message apparaît) et les erreurs console / page / réseau.

Ne clique pas ce qui détruit, publie ou paie (supprimer, publier, payer, envoyer, se déconnecter…) :
ces actions sont testées par t1 et t2 avec remise en état. La tour est remise dans son état de départ
à la fin (photo prise au début).

    python scripts/online/t3_boutons.py [APP] [TOUR]
"""
import hashlib, json, re
from playwright.sync_api import sync_playwright
from common import APP, SHOTS, TOUR, check, restore_from, save_results, signup, snapshot

DANGER = re.compile(r'supprim|effac|archiv|retir|déconnect|vider|réinitialis|annul|rembours|publi|envoy|import|restaur|'
                    r'payer|pointer|valider|confirmer|marquer|passer à|enregistr|ajouter au panier|à la demande|commander|'
                    r'finaliser|dupliquer|créer|masquer|désactiv|activer|téléverser|choisir un fichier|copier|partager|'
                    r'whatsapp|appeler|e-mail|mail|ouvrir dans|télécharger|se connecter|me connecter|google', re.I)
IGNORED = ('favicon', '/_expo/static', 'ws://', 'Download the React DevTools')
REPORT = []


def watch(page, where):
    page.found = []
    add = lambda kind, text: None if any(x in text for x in IGNORED) else page.found.append((kind, text[:200]))
    page.on('console', lambda m: add('console', m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: add('page', str(e)))
    page.on('requestfailed', lambda r: add('réseau', f'{r.method} {r.url} {r.failure}') if 'vercel-insights' not in r.url else None)
    page.on('response', lambda r: add('http', f'{r.status} {r.url}') if r.status >= 400 else None)


def state(page):
    txt = page.inner_text('body')
    return page.url, hashlib.md5(txt.encode()).hexdigest(), len(page.query_selector_all('[role=dialog], [aria-modal=true]'))


def targets(page):
    """Éléments interactifs visibles : (rôle, nom accessible), dédoublonnés."""
    seen, out = set(), []
    for role in ('button', 'tab', 'radio', 'link', 'switch', 'checkbox'):
        loc = page.get_by_role(role)
        for i in range(min(loc.count(), 80)):
            el = loc.nth(i)
            try:
                if not el.is_visible():
                    continue
                name = (el.get_attribute('aria-label') or el.inner_text(timeout=500) or '').strip().split('\n')[0][:60]
            except Exception:  # noqa: BLE001
                continue
            if not name or (role, name) in seen:
                continue
            seen.add((role, name))
            out.append((role, name))
    return out


def crawl(page, where, screen, reset):
    """Clique chaque cible de l'écran ; `reset()` ramène sur l'écran avant chaque clic."""
    reset()
    base = state(page)
    items = targets(page)
    cards = [t for t in items if '€' in t[1] or 'prix à' in t[1]]
    items = [t for t in items if t not in cards[2:]][:45]  # cartes produit : deux suffisent
    clicked = effects = 0
    for role, name in items:
        if DANGER.search(name):
            continue
        try:
            if state(page) != base:
                reset()
                base = state(page)
            before = state(page)
            n_err = len(page.found)
            page.get_by_role(role, name=name, exact=True).first.click(timeout=4000)
            page.wait_for_timeout(700)
            after = state(page)
            clicked += 1
            changed = after != before
            effects += changed
            errs = page.found[n_err:]
            REPORT.append({'où': where, 'écran': screen, 'élément': f'{role} « {name} »', 'effet': changed, 'erreurs': errs})
            page.keyboard.press('Escape')
        except Exception as e:  # noqa: BLE001
            REPORT.append({'où': where, 'écran': screen, 'élément': f'{role} « {name} »', 'effet': None,
                           'erreurs': [('clic impossible', str(e).split('\n')[0][:150])]})
    return clicked, effects


def app_screens(page, pro):
    home = lambda: (page.goto(APP, timeout=120000), page.wait_for_timeout(2500))
    tab = lambda name: (home(), page.get_by_role('tab', name=re.compile(name)).first.click(), page.wait_for_timeout(1200))
    product = lambda q, n: (home(), page.get_by_label('Rechercher un fruit ou un légume').fill(q), page.wait_for_timeout(700),
                            page.get_by_role('button', name=re.compile(n)).first.click(), page.wait_for_timeout(1500))
    screens = {'Accueil': home, 'Favoris': lambda: tab('Favoris'), 'Panier': lambda: tab('Panier|Demande'),
               'Commandes': lambda: tab('Commandes'), 'Profil': lambda: tab('Profil'),
               'Fiche produit': (lambda: product('mangue séchée', '^Mangue séchée')) if pro else (lambda: product('baobab', '^Poudre de Baobab'))}
    return screens


def run():
    snap = snapshot()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for w, h in ((390, 844), (1440, 900)):
            for kind in ('particulier', 'pro'):
                opts = {'viewport': {'width': w, 'height': h}}
                if w < 700:
                    opts.update(has_touch=True, is_mobile=True)
                ctx = browser.new_context(**opts)
                page = ctx.new_page()
                watch(page, f'app {kind} {w}×{h}')
                signup(page, kind, f'Boutons {kind}', '+221 77 000 00 31' if kind == 'pro' else '+221 77 000 00 32', 'Sénégal')
                for screen, reset in app_screens(page, kind == 'pro').items():
                    c, e = crawl(page, f'app {kind} {w}×{h}', screen, reset)
                    print(f'app {kind} {w}×{h} · {screen} : {c} cliqués, {e} avec effet', flush=True)
                ctx.close()
            ctx = browser.new_context(viewport={'width': w, 'height': h}, **({'has_touch': True, 'is_mobile': True} if w < 700 else {}))
            page = ctx.new_page()
            watch(page, f'tour {w}×{h}')
            for route in ('', 'produits', 'produits/poire', 'produits/nouveau', 'prix', 'rayons', 'introuvables', 'publications',
                          'reglages', 'commandes', 'commandes/clients', 'commandes/statistiques', 'commandes/statuts', 'commandes/livraison'):
                reset = lambda r=route: (page.goto(f'{TOUR}/#/{r}', timeout=90000), page.wait_for_timeout(2200))
                c, e = crawl(page, f'tour {w}×{h}', route or 'accueil', reset)
                print(f'tour {w}×{h} · {route or "accueil"} : {c} cliqués, {e} avec effet', flush=True)
            ctx.close()
        browser.close()
    restore_from(snap)
    (SHOTS / 'online-t3-boutons.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1), encoding='utf-8')
    errs = [r for r in REPORT if r['erreurs']]
    silent = [r for r in REPORT if r['effet'] is False]
    check('boutons cliqués sans erreur console / page / réseau', not errs, f'{len(REPORT)} clics, {len(errs)} avec erreur')
    check('boutons avec un effet visible', not silent, f'{len(silent)} sans effet visible (liste dans online-t3-boutons.json)')
    for r in errs[:40]:
        print('ERREUR', r['où'], '·', r['écran'], '·', r['élément'], '→', r['erreurs'][:2])


run()
save_results('t3')
