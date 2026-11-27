"""
Captures pour le rapport (lecture seule : aucune commande envoyée, rien de modifié dans la tour).

    python scripts/online/captures_rapport.py <DOSSIER> [APP] [TOUR]
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1])
APP = (sys.argv[2] if len(sys.argv) > 2 else 'https://tropicaura-app.vercel.app').rstrip('/')
TOUR = (sys.argv[3] if len(sys.argv) > 3 else 'https://tropicaura-tour.vercel.app').rstrip('/')
OUT.mkdir(parents=True, exist_ok=True)
sys.argv = [sys.argv[0], APP, TOUR]
from common import open_product, signup  # noqa: E402


def shot(page, name, wait=1500):
    page.wait_for_timeout(wait)
    page.screenshot(path=str(OUT / f'{name}.png'))
    print('capture', name, flush=True)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    # Application, particulier Sénégal, téléphone
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
    p = ctx.new_page()
    signup(p, 'particulier', 'Capture Rapport', '+221 77 000 00 51', 'Sénégal')
    shot(p, '01-app-accueil', 3000)
    open_product(p, 'mangue séchée', '^Mangue séchée')
    shot(p, '02-app-fiche-emballages')
    p.get_by_role('radio', name=re.compile('^Sachet')).first.click()
    shot(p, '03-app-emballage-choisi', 1200)
    p.get_by_role('button', name=re.compile('^Ajouter ')).last.click()
    p.wait_for_timeout(800)
    p.get_by_role('button', name='Ouvrir le panier').first.click()
    shot(p, '04-app-panier')
    p.get_by_role('button', name=re.compile('^Commander')).click()
    p.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
    p.get_by_role('radio', name='Valider pour moi').click()
    p.mouse.wheel(0, 900)
    shot(p, '05-app-validation-paiements')
    p.goto(APP, timeout=120000)
    p.get_by_text('Tout l’étal').first.wait_for(timeout=60000)
    p.get_by_role('tab', name=re.compile('Profil')).first.click()
    p.wait_for_timeout(800)
    p.get_by_text('Tour de contrôle', exact=True).first.scroll_into_view_if_needed()
    shot(p, '06-app-profil-tour-reliee')
    ctx.close()
    # Application, professionnel
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
    p = ctx.new_page()
    signup(p, 'pro', 'Capture Pro', '+221 77 000 00 52', 'Sénégal')
    open_product(p, 'mangue séchée', '^Mangue séchée')
    shot(p, '07-app-pro-offre-avion')
    ctx.close()
    # Application, ordinateur
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    p = ctx.new_page()
    signup(p, 'particulier', 'Capture Bureau', '+221 77 000 00 53', 'Sénégal')
    shot(p, '08-app-ordinateur-accueil', 3000)
    ctx.close()
    # Tour de contrôle, ordinateur
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    p = ctx.new_page()
    for name, route in (('09-tour-accueil', ''), ('10-tour-produits', 'produits'), ('11-tour-fiche-produit', 'produits/mangue-sechee'),
                        ('12-tour-prix', 'prix'), ('13-tour-rayons', 'rayons'), ('14-tour-commandes-livraison', 'commandes/livraison'),
                        ('15-tour-publications', 'publications'), ('16-tour-reglages', 'reglages')):
        p.goto(f'{TOUR}/#/{route}', timeout=90000)
        shot(p, name, 3500)
    ctx.close()
    browser.close()
