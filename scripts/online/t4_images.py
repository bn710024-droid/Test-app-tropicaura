"""
IMAGES, en ligne : 0 image en 404, 0 image vide, sur les pages de la tour (liste, fiche, prix, rayons,
aperçu client, publications) et de l'application (accueil, fiche, rayons). Captures dans <DOSSIER>.

    python scripts/online/t4_images.py <DOSSIER> <préfixe> [APP] [TOUR]
"""
import json, pathlib, sys

OUT = pathlib.Path(sys.argv[1])
TAG = sys.argv[2] if len(sys.argv) > 2 else 'apres'
APP = (sys.argv[3] if len(sys.argv) > 3 else 'https://tropicaura-app.vercel.app').rstrip('/')
TOUR = (sys.argv[4] if len(sys.argv) > 4 else 'https://tropicaura-tour.vercel.app').rstrip('/')
OUT.mkdir(parents=True, exist_ok=True)
sys.argv = [sys.argv[0], APP, TOUR]
from playwright.sync_api import sync_playwright  # noqa: E402
from common import check, open_product, save_results, signup  # noqa: E402

# Une image « vide » : chargée sans contenu, ou zone d'image sans source (« Sans photo »).
BROKEN = """() => {
  const imgs = [...document.querySelectorAll('img')].filter(i => i.getBoundingClientRect().width > 0);
  const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src);
  const empty = [...document.querySelectorAll('span, div, p')].filter(e => [...e.children].every(c => c.tagName === 'BR')
    && (e.textContent || '').replace(/\\s+/g, '').toLowerCase() === 'sansphoto' && e.getBoundingClientRect().width > 0).length;
  return { total: imgs.length, broken, empty };
}"""


def scan(page, name, url=None, wait=3500):
    bad = []
    page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.request.resource_type == 'image' and r.status >= 400 else None)
    if url:
        page.goto(url, timeout=90000)
    page.wait_for_timeout(wait)
    page.mouse.wheel(0, 1500)
    page.wait_for_timeout(1200)
    page.mouse.wheel(0, -3000)
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / f'{TAG}-{name}.png'))
    r = page.evaluate(BROKEN)
    check(f'{name} : 0 image en 404', not bad, bad[:3])
    check(f'{name} : 0 image vide (ni cassée, ni « sans photo »)', not r['broken'] and r['empty'] == 0,
          f"{r['total']} images ; cassées {r['broken'][:2]} ; « sans photo » ×{r['empty']}")


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    for name, route in (('tour-produits', 'produits'), ('tour-fiche-mangue-sechee', 'produits/mangue-sechee'),
                        ('tour-fiche-pomme', 'produits/pomme'), ('tour-prix', 'prix'), ('tour-rayons', 'rayons'),
                        ('tour-accueil', ''), ('tour-publications', 'publications')):
        p = ctx.new_page()
        scan(p, name, f'{TOUR}/#/{route}')
        p.close()
    ctx.close()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
    page = ctx.new_page()
    bad = []
    page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.request.resource_type == 'image' and r.status >= 400 else None)
    signup(page, 'particulier', 'Test Images', '+221 77 000 00 61', 'Sénégal')
    scan(page, 'app-accueil')
    open_product(page, 'baobab', '^Poudre de Baobab')
    scan(page, 'app-fiche-baobab', wait=1500)
    fmt = [x for x in page.eval_on_selector_all('img', 'els => els.map(e => e.currentSrc || e.src)') if '/formats/' in x]
    check('app : photos des emballages affichées (sachet, pot du baobab)', len(fmt) >= 2, fmt[:2])
    check('app : 0 image en 404 pendant tout le parcours', not bad, bad[:3])
    ctx.close()
    browser.close()

save_results(f't4-{TAG}')
