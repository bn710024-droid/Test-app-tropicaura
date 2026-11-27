"""
Captures des nouveautés du 27/11 (soir), en ligne, pour le rapport : réglages « Moyens de paiement » et
« Transport des particuliers » de la tour ; annonce « toucher l'image » (image seule) et publication
photo dans l'application. Les publications créées pour la capture sont supprimées à la fin.

    python scripts/online/captures_nouveautes.py <DOSSIER> [APP] [TOUR]
"""
import pathlib, re, sys

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
sys.argv = [sys.argv[0], *sys.argv[2:]]
from playwright.sync_api import sync_playwright  # noqa: E402
from common import APP, TOUR, api, body, check, save_results, signup, upload_publication_file, wait_for  # noqa: E402

ASSETS = pathlib.Path(__file__).resolve().parents[2] / 'assets'
created = []


def publish(kind, data):
    r = api('POST', '/api/publications', {'kind': kind, 'published': True, 'data': data})
    pid = (r or {}).get('id')
    if pid:
        created.append(pid)
    check(f'tour : {kind} de capture publiée', bool(pid), (r or {}).get('error', ''))
    return pid


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    try:
        # ── Tour : les deux blocs de Réglages
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f'{TOUR}/#/reglages', timeout=90000)
        page.locator('#paiements').wait_for(timeout=60000)
        page.wait_for_timeout(1500)
        for block, name in (('#paiements', '22-tour-reglages-paiements.png'), ('#transport', '23-tour-reglages-transport.png')):
            page.locator(block).scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            page.locator(block).screenshot(path=str(OUT / name))
            check(f'capture {name}', (OUT / name).exists())
        ctx.close()

        # ── Données de capture : annonce « toucher » (poire) et publication de 2 photos
        banner = upload_publication_file('annonce', ASSETS / 'campaigns' / 'melon.webp', 'image/webp')
        publish('annonce', {'image_url': banner, 'link': 'tap', 'product_id': 'melon', 'body': ''})
        pics = [upload_publication_file('photo', ASSETS / 'produce' / f, 'image/webp') for f in ('mangue.webp', 'ananas.webp')]
        publish('photos', {'images': [{'url': u, 'width': 1080, 'height': 1080} for u in pics if u],
                           'description': 'Arrivage de la semaine : mangues et ananas du Sénégal.'})

        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        page = ctx.new_page()
        signup(page, 'particulier', 'Capture Rapport', '+221 77 000 00 71', 'Sénégal')
        d = wait_for(page, lambda: any(banner in (s or '') for s in page.eval_on_selector_all('img', 'e => e.map(i => i.currentSrc || i.src)')), 75)
        check('app : annonce « toucher » affichée (image seule)', d is not None)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / '24-app-annonce-toucher.png'))
        check('app : aucun bouton sur l’annonce « toucher »', 'Voir le melon' not in body(page))

        page.get_by_role('tab', name=re.compile('Favoris')).first.click()
        page.wait_for_timeout(1200)
        page.get_by_role('button', name=re.compile('^Découvrir')).first.click()
        d = wait_for(page, lambda: page.get_by_role('button', name=re.compile('^Photos')).count() > 0, 75)
        check('app : choix « Photos » dans Découvrir', d is not None)
        page.get_by_role('button', name=re.compile('^Photos')).first.click()
        page.wait_for_timeout(3000)
        page.screenshot(path=str(OUT / '25-app-publication-photo.png'))
        check('app : description de la publication affichée', 'Arrivage de la semaine' in body(page))
        ctx.close()
    finally:
        for pid in created:
            api('DELETE', '/api/publications', {'id': pid})
        left = [p['id'] for p in api('GET', '/api/publications') if p['id'] in created]
        check('nettoyage : publications de capture supprimées', not left, left)
        browser.close()

save_results('captures-nouveautes')
