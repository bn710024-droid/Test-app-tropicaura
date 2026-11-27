"""
TOUR → APP, en ligne, en 390×844 : forfait transport des particuliers.

Réglages › Transport dans la tour (Sénégal à 7,50 €) → publié dans ?v=2 → affiché à la validation
de commande ; puis forfaits retirés dans la tour → l'application reprend son barème (6,00 €) sans
être rechargée (≤ 60 s). Aucune commande n'est envoyée ; le réglage est retiré à la fin.

    python scripts/online/t5_transport.py [APP] [TOUR]
"""
import re, time
from playwright.sync_api import sync_playwright
from common import SHOTS, api, body, check, new_page, open_product, save_results, signup, wait_for

FEES = {'sn': 7.5, 'ao': 24, 'af': 36, 'eu': 48, 'na': 62, 'monde': 78}


def published(want_sn):
    """Relit ?v=2 (cache de 5 s) jusqu'à 20 s : forfait Sénégal publié, ou aucun si `want_sn` est None."""
    zones = None
    for _ in range(10):
        doc = api('GET', '/api/catalog?v=2')
        zones = {z['id']: z['fee'] for z in (doc.get('transport') or {}).get('zones', [])} or None
        if (zones or {}).get('sn') == want_sn if want_sn is not None else zones is None:
            return True, zones
        time.sleep(2)
    return False, zones


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            r = api('PUT', '/api/settings', {'key': 'transport', 'value': {**FEES, 'eu': -1}})
            check('tour : forfait négatif refusé', (r or {}).get('_status') == 400, r)
            r = api('PUT', '/api/settings', {'key': 'transport', 'value': FEES})
            check('tour : forfaits de transport enregistrés (réglage transport)', (r or {}).get('value', {}).get('sn') == 7.5, r)
            ok, zones = published(7.5)
            check('tour : ?v=2 publie transport.zones (Sénégal 7,5 €)', ok, zones)

            # Application ouverte après le réglage : elle lit le catalogue à jour.
            ctx, page = new_page(browser)
            signup(page, 'particulier', 'Test Transport', '+221 77 000 00 31', 'Sénégal')
            open_product(page, 'pomme', '^Pomme Gala')
            page.get_by_role('button', name=re.compile('^Ajouter .* au panier')).click()
            page.wait_for_timeout(600)
            page.get_by_role('button', name='Ouvrir le panier').first.click()
            page.get_by_role('button', name=re.compile('^Commander')).click()
            page.get_by_role('heading', name='Votre commande').wait_for(timeout=15000)
            page.get_by_role('radio', name='Valider pour moi').click()
            page.get_by_role('button', name=re.compile('Ajouter votre adresse')).click()
            page.get_by_label('Nom du destinataire').fill('Test Transport')
            page.get_by_role('button', name=re.compile('Pays')).click()
            page.get_by_label('Rechercher un pays').fill('Sénégal')
            page.wait_for_timeout(400)
            page.get_by_role('radio', name=re.compile('^Sénégal')).first.click()
            page.get_by_role('textbox', name='Adresse', exact=True).fill('12 Rue 10, Médina')
            page.get_by_role('textbox', name='Ville', exact=True).fill('Dakar')
            page.get_by_role('button', name=re.compile('Enregistrer l’adresse')).click()
            page.wait_for_timeout(1200)
            shown = '7,50 €' in body(page)
            check('app : forfait de la tour affiché à la validation (7,50 €)', shown, '' if shown else 'absent')
            page.screenshot(path=str(SHOTS / 'online-t5-transport-tour.png'))

            r = api('PUT', '/api/settings', {'key': 'transport', 'value': None})
            check('tour : forfaits retirés (réglage supprimé)', (r or {}).get('value', 'x') is None, r)
            ok, zones = published(None)
            check('tour : ?v=2 ne publie plus transport', ok, zones)
            d = wait_for(page, lambda: '6,00 €' in body(page) and '7,50 €' not in body(page), 80)
            check('app : barème de l’application repris sans recharger (≤ 60 s)', d is not None and d <= 62, f'({d and round(d)} s)')
            page.screenshot(path=str(SHOTS / 'online-t5-transport-bareme.png'))
            errors = [e for e in page.errors if 'favicon' not in e]
            check('app : aucune erreur dans la console', not errors, errors[:3])
            ctx.close()
        finally:
            api('PUT', '/api/settings', {'key': 'transport', 'value': None})
            browser.close()
    save_results('t5')


if __name__ == '__main__':
    run()
