"""
Outils communs des tests EN LIGNE (application + tour de contrôle déployées).

    APP  = adresse de l'application (ex. https://tropicaura-app.vercel.app)
    TOUR = adresse de la tour      (ex. https://tropicaura-tour.vercel.app)

Chaque test écrit ses résultats dans scripts/shots/online-<nom>.json : [{fonction, statut, détail}].
"""
import base64, json, pathlib, re, struct, sys, time, urllib.request, zlib

HERE = pathlib.Path(__file__).resolve().parent
SHOTS = HERE.parent / 'shots'
SHOTS.mkdir(exist_ok=True)

APP = (sys.argv[1] if len(sys.argv) > 1 else 'https://tropicaura-app.vercel.app').rstrip('/')
TOUR = (sys.argv[2] if len(sys.argv) > 2 else 'https://tropicaura-tour.vercel.app').rstrip('/')
RESULTS = []
CHANGEABLE = ['name', 'variety', 'category', 'origin', 'description', 'photo_asset', 'photo_url', 'photo_ratio',
              'tint', 'months', 'available', 'archived', 'bio', 'retail', 'wholesale', 'is_example']


def check(name, ok, detail=''):
    RESULTS.append({'fonction': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(('PASS' if ok else 'FAIL'), name, detail, flush=True)
    return ok


def save_results(tag):
    out = SHOTS / f'online-{tag}.json'
    out.write_text(json.dumps(RESULTS, ensure_ascii=False, indent=1), encoding='utf-8')
    ok = sum(1 for r in RESULTS if r['ok'])
    print(f'\n{ok}/{len(RESULTS)} vérifications réussies → {out}')


def api(method, path, body=None, timeout=60):
    req = urllib.request.Request(TOUR + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        try:
            return {'_status': e.code, **json.loads(e.read() or b'{}')}
        except Exception:  # noqa: BLE001
            return {'_status': e.code}


def put_bytes(url, data, content_type):
    req = urllib.request.Request(url, method='PUT', data=data, headers={'Content-Type': content_type})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status


def products():
    return api('GET', '/api/products')


def product(pid):
    return next(p for p in products() if p['id'] == pid)


def v2():
    return api('GET', '/api/catalog?v=2')


def png(color=(220, 60, 60), size=48):
    """Petite image PNG unie, sans dépendance (données de test)."""
    raw = b''.join(b'\x00' + bytes(color) * size for _ in range(size))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def upload_image(kind, slug, color=(220, 60, 60)):
    """Photo de produit, d'emballage ou de rayon, par la route de la tour."""
    r = api('POST', '/api/upload', {'fileBase64': base64.b64encode(png(color)).decode(), 'contentType': 'image/png',
                                    'kind': kind, 'id': slug})
    return (r or {}).get('url')


def upload_publication_file(kind, path_or_bytes, content_type):
    """Fichier d'une publication (vidéo, photo, image d'annonce) : URL signée de la tour, puis envoi."""
    data = path_or_bytes if isinstance(path_or_bytes, bytes) else pathlib.Path(path_or_bytes).read_bytes()
    r = api('POST', '/api/publications', {'action': 'upload-url', 'kind': kind, 'contentType': content_type})
    if not r or 'token' not in r:
        return None
    storage = r['url'].split('/storage/v1/')[0]
    put_bytes(f"{storage}/storage/v1/object/upload/sign/publications/{r['path']}?token={r['token']}", data, content_type)
    return r['url']


def wait_for(page, fn, timeout_s=75, step_ms=1000):
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            if fn():
                return time.time() - start
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(step_ms)
    return None


def body(page):
    return page.inner_text('body').replace(' ', ' ').replace(' ', ' ')


def labels(page, prefix=''):
    return [l for l in page.eval_on_selector_all('[aria-label]', 'els => els.map(e => e.getAttribute("aria-label"))')
            if l and l.startswith(prefix)]


def img_srcs(page):
    return page.eval_on_selector_all('img', 'els => els.map(e => e.currentSrc || e.src)')


def new_page(browser, width=390, height=844, geo=None):
    opts = {'viewport': {'width': width, 'height': height}}
    if width < 700:
        opts.update(has_touch=True, is_mobile=True)
    if geo:
        opts.update(geolocation=geo, permissions=['geolocation'])
    ctx = browser.new_context(**opts)
    page = ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)))
    page.on('console', lambda m: page.errors.append(m.text) if m.type == 'error' else None)
    return ctx, page


def signup(page, kind, name, phone, country):
    """Inscription dans l'application en ligne (compte local à l'appareil, données de test)."""
    page.goto(APP, timeout=120000)
    page.get_by_role('button', name='Créer mon compte').first.click(timeout=90000)
    page.get_by_role('radio', name=re.compile('^' + ('Professionnel' if kind == 'pro' else 'Particulier'))).click()
    page.get_by_text('Votre activité' if kind == 'pro' else 'Vos informations').first.wait_for(timeout=10000)
    page.get_by_label('Votre nom').fill(name)
    if kind == 'pro':
        page.get_by_label('Téléphone', exact=True).fill(phone)
    else:
        page.get_by_label('Numéro de téléphone').fill(phone)
    page.get_by_role('button', name='Choisir votre pays').click()
    page.get_by_label('Rechercher un pays').fill(country)
    page.wait_for_timeout(300)
    page.get_by_role('radio', name=re.compile('^' + country)).first.click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_text('Choix de connexion').first.wait_for(timeout=10000)
    page.get_by_role('radio', name=re.compile('^Numéro de téléphone')).click()
    page.get_by_role('button', name='Continuer').click()
    page.get_by_role('button', name=re.compile('^Entrer dans l')).click(timeout=15000)
    page.get_by_text('Catalogue professionnel' if kind == 'pro' else 'Tout l’étal').first.wait_for(timeout=60000)


def search(page, text):
    box = page.get_by_label('Rechercher un fruit ou un légume')
    box.fill(text)
    page.wait_for_timeout(700)


def has_card(page, prefix):
    return any(l.startswith(prefix) for l in labels(page))


def open_product(page, query, name_re):
    """Ouvre la fiche d'un produit depuis l'accueil (recherche puis toucher la carte)."""
    search(page, query)
    page.get_by_role('button', name=re.compile(name_re)).first.click(timeout=15000)
    page.get_by_role('button', name='Retour').first.wait_for(timeout=15000)
    page.wait_for_timeout(900)


def back(page):
    page.get_by_role('button', name='Retour').first.click()
    page.wait_for_timeout(700)


def restore_from(snapshot):
    """Remet chaque produit, rayon et réglage modifié dans l'état de la photo prise avant le test."""
    now = {p['id']: p for p in products()}
    for p in snapshot['products']:
        cur = now.get(p['id'])
        if not cur:
            continue
        same = all(cur.get(k) == p.get(k) for k in CHANGEABLE) and cur['packagings'] == p['packagings'] \
            and cur['zone'] == p['zone']
        if same:
            continue
        body_ = {'id': p['id'], **{k: p[k] for k in CHANGEABLE if k in p}, 'packagings': p['packagings'], 'zone': p['zone']}
        r = api('PUT', '/api/products', body_)
        if '_status' in (r or {}):
            print('  restauration impossible', p['id'], r)
    cats_now = {c['id']: c for c in api('GET', '/api/categories')}
    for c in snapshot['categories']:
        cur = cats_now.get(c['id'])
        if cur and any(cur.get(k) != c.get(k) for k in ('label', 'image_url', 'illustration_product', 'pro_visible')):
            api('PUT', '/api/categories', {'id': c['id'], 'label': c['label'], 'image_url': c['image_url'],
                                           'illustration_product': c['illustration_product'], 'pro_visible': c['pro_visible']})
    order = [c['id'] for c in sorted(snapshot['categories'], key=lambda c: c['sort_order'])]
    if [c['id'] for c in sorted(api('GET', '/api/categories'), key=lambda c: c['sort_order'])] != order:
        api('PUT', '/api/categories', {'order': order})
    settings = api('GET', '/api/settings')
    for key in ('rules', 'filters'):
        if snapshot['settings'].get(key) is not None and settings.get(key) != snapshot['settings'][key]:
            api('PUT', '/api/settings', {'key': key, 'value': snapshot['settings'][key]})


def snapshot():
    return {'products': products(), 'categories': api('GET', '/api/categories'), 'settings': api('GET', '/api/settings')}
