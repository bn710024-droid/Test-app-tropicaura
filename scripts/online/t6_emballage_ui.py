"""
TOUR (interface, comme un humain) → ?v=2 → APP : un emballage complet créé à la main sur la Mangue.

1. Fiche « Mangue » dans la tour (1440×900) : « Ajouter un emballage », nom « Sachet TEST »,
   photo, description, contenu 500 g, prix 4,50 €, palier/min/max, réglage Sénégal (prix propre
   3,90 €), puis « Enregistrer » : le message affiché est relevé.
2. Erreur de validation provoquée (minimum qui n'est pas un multiple du palier) : elle doit être
   VISIBLE (message + champ en erreur), et rien n'est enregistré.
3. ?v=2 publie l'emballage ; l'application (390×844, compte Sénégal) le propose avec son prix.
4. L'emballage TEST est retiré par l'interface ; seul lui est touché.

    python scripts/online/t6_emballage_ui.py [APP] [TOUR]
"""
import pathlib, re, time
from playwright.sync_api import sync_playwright
from common import APP, SHOTS, TOUR, api, body, products, check, new_page, open_product, save_results, signup, wait_for

PID = 'mangue'
LABEL = 'Sachet TEST'
PHOTO = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'formats' / 'sachet.png'
APOS = '’'


def toast_text(page, wait=2500):
    """Messages affichés (toasts) : texte des zones de statut et d'alerte."""
    page.wait_for_timeout(wait)
    return ' | '.join(t.strip() for t in page.eval_on_selector_all(
        '[role="status"], [role="alert"], [aria-live]', 'els => els.map(e => e.innerText)') if t.strip())


def v2_formats():
    for _ in range(10):
        doc = api('GET', '/api/catalog?v=2')
        p = next((x for x in doc['products'] if x['id'] == PID), None)
        yield p
        time.sleep(2)


def open_fiche(browser):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    page.goto(f'{TOUR}/#/produits/{PID}', timeout=90000)
    page.get_by_role('button', name='Enregistrer', exact=True).last.wait_for(timeout=60000)
    page.wait_for_timeout(1500)
    return ctx, page


def run():
    before = next((p for p in products() if p['id'] == PID), None)
    check('départ : la Mangue n’a aucun emballage', before is not None and not before.get('packagings'), (before or {}).get('packagings'))
    if not before or before.get('packagings'):
        return
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            # ── 1. Emballage complet, saisi à la main
            ctx, page = open_fiche(browser)
            page.get_by_role('button', name='Ajouter un emballage').first.click()
            page.wait_for_timeout(800)
            pack = page.locator('div[data-ouvert="true"][id^="emballage-"]').first
            page.get_by_label(f'Nom de l{APOS}emballage', exact=True).fill(LABEL)
            page.set_input_files(f'input[type="file"][aria-label="Photo de l{APOS}emballage"]', str(PHOTO))
            page.wait_for_timeout(4000)
            page.get_by_label(f'Description de l{APOS}emballage').fill('Sachet refermable TEST, à retirer après le contrôle.')
            page.get_by_label('Quantité contenue').fill('500')
            page.get_by_role('radiogroup', name=f'Unité du contenu de l{APOS}emballage 1').get_by_role('radio', name='g', exact=True).click()
            page.get_by_label(re.compile(f'^Prix de l{APOS}emballage entier(?! dans)')).first.fill('4,50')
            pack.get_by_label('Palier', exact=True).fill('1')
            pack.get_by_label('Minimum', exact=True).fill('1')
            pack.get_by_label('Maximum', exact=True).fill('10')
            page.get_by_role('button', name='Régler cet emballage pour un pays').click()
            page.wait_for_timeout(500)
            page.get_by_role('button', name=re.compile('Sénégal$')).first.click()
            page.get_by_role('radio', name='Prix propre').first.click()
            page.get_by_label(f'Prix de l{APOS}emballage entier dans ces pays').fill('3,90')
            page.screenshot(path=str(SHOTS / 'online-t6-saisie.png'), full_page=False)
            page.get_by_role('button', name='Enregistrer', exact=True).last.click()
            msg = toast_text(page, 4000)
            check('tour : « Enregistrer » affiche un message de réussite', 'enregistrée' in msg, msg[:160])
            page.screenshot(path=str(SHOTS / 'online-t6-enregistre.png'))

            # ── 2. Erreur de validation : visible, jamais silencieuse
            # L'emballage enregistré est rouvert (« Modifier »), comme le ferait l'équipe.
            configure = page.get_by_role('button', name='Configurer les emballages')
            if configure.count():
                configure.first.click()
                page.wait_for_timeout(600)
            page.get_by_role('button', name=f'Modifier l{APOS}emballage {LABEL}').first.click()
            page.wait_for_timeout(600)
            pack = page.locator('div[data-ouvert="true"][id^="emballage-"]').first
            pack.get_by_label('Palier', exact=True).fill('2')
            pack.get_by_label('Minimum', exact=True).fill('3')
            page.keyboard.press('Tab')
            page.get_by_role('button', name='Enregistrer', exact=True).last.click()
            msg = toast_text(page, 700)
            invalid = page.locator('[aria-invalid="true"]:visible, [data-invalid="true"]:visible').count()
            shown_error = 'multiple du palier' in body(page)
            check('tour : erreur de validation annoncée (message à l’écran)', 'corriger' in msg, msg[:160])
            check('tour : champ en erreur visible, avec son explication', invalid >= 1 and shown_error, f'{invalid} champ(s) ; explication {shown_error}')
            page.screenshot(path=str(SHOTS / 'online-t6-erreur.png'))
            ctx.close()  # quitte sans enregistrer
            still = next((p for p in products() if p['id'] == PID), {})
            pk = (still.get('packagings') or [{}])[0]
            check('tour : la saisie invalide n’a rien enregistré', pk.get('step') == 1 and pk.get('min') == 1, pk)

            # ── 3. ?v=2 puis application
            fmt = None
            for p in v2_formats():
                fmt = next((f for f in (p or {}).get('formats', []) if f['label'] == LABEL), None)
                if fmt:
                    break
            check('?v=2 : emballage publié', bool(fmt), (p or {}).get('formats'))
            if fmt:
                sn = (fmt.get('settings') or [{}])[0]
                check('?v=2 : contenu, prix, palier/min/max, description, photo',
                      fmt['grams'] == 500 and fmt['price'] == 4.5 and fmt['min'] == 1 and fmt.get('max') == 10
                      and 'TEST' in fmt.get('description', '') and 'url' in (fmt.get('photo') or {}), fmt)
                check('?v=2 : réglage Sénégal (prix propre 3,90)', sn.get('countries') == ['SN'] and sn.get('price') == 3.9, sn)
            ctxA, A = new_page(browser)
            signup(A, 'particulier', 'Test Emballage', '+221 77 000 00 91', 'Sénégal')
            d = wait_for(A, lambda: (open_product(A, 'mangue', '^Mangue Kent') or True) and LABEL in body(A), 80, 2000)
            check('app : emballage proposé sur la fiche (≤ 60 s)', d is not None, '')
            if d is not None:
                A.get_by_text(LABEL).first.click()
                A.wait_for_timeout(1200)
                b = body(A)
                check('app : prix du Sénégal (3,90 €) et contenu (500 g)', '3,90' in b and '500' in b, '')
                check('app : description de l’emballage affichée', 'Sachet refermable TEST' in b)
                A.screenshot(path=str(SHOTS / 'online-t6-app.png'))
            ctxA.close()
        finally:
            # ── 4. Retrait de l'emballage TEST, par l'interface ; rien d'autre n'est touché
            now = next((p for p in products() if p['id'] == PID), {})
            if any(k.get('label') == LABEL for k in now.get('packagings') or []):
                ctx, page = open_fiche(browser)
                page.get_by_role('button', name=re.compile('Configurer les emballages')).first.click()
                page.wait_for_timeout(600)
                # Ligne repliée : « Retirer l’emballage Sachet TEST » ; ouverte : « Retirer l’emballage 1 ».
                by_name = page.get_by_role('button', name=f'Retirer l{APOS}emballage {LABEL}')
                if by_name.count():
                    by_name.first.click()
                else:
                    labels_ = [k.get('label') for k in now.get('packagings')]
                    page.get_by_role('button', name=f'Retirer l{APOS}emballage {labels_.index(LABEL) + 1}').click()
                page.get_by_role('button', name='Enregistrer', exact=True).last.click()
                msg = toast_text(page, 4000)
                check('nettoyage : emballage TEST retiré par l’interface', 'enregistrée' in msg, msg[:120])
                ctx.close()
            after = next((p for p in products() if p['id'] == PID), {})
            check('nettoyage : la Mangue revient sans emballage, le reste de sa fiche inchangé',
                  not after.get('packagings') and all(after.get(k) == before.get(k) for k in ('name', 'retail', 'wholesale', 'available', 'category')), '')
            browser.close()
    save_results('t6')


if __name__ == '__main__':
    run()
