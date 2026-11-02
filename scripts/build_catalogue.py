"""Build the website's product data and HD photographs from a catalogue PDF.

    python3 scripts/build_catalogue.py path/to/catalogue.pdf            # full build
    python3 scripts/build_catalogue.py path/to/catalogue.pdf --report   # read only: what would change
    python3 scripts/build_catalogue.py path/to/catalogue.pdf --fast     # skip AI enlargement (preview)

How it works
  1. Every page is read for "spec cards": a product photograph with its printed text
     (model, cover size / neck fitting, weight, cap finish, collar finish).
  2. Cards are matched to products in catalogue/catalogue.json by model, size, weight,
     page title or special process. Unmatched models become new products automatically.
  3. Each photograph is cropped, separated from its dimension arrows, enlarged 4x with
     Real-ESRGAN (scripts/hd_photos.py, cached) and saved as 400 px and 800 px WebP.
  4. dist/products.js is written with catalogue products followed by the Alibaba store
     products from catalogue/store.json, and a report lists anything new or missing.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hd_photos as hp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
ASSETS = DIST / 'assets'
PHOTOS = ASSETS / 'p'
CONFIG = ROOT / 'catalogue' / 'catalogue.json'
STORE = ROOT / 'catalogue' / 'store.json'
REPORT = ROOT / 'catalogue' / 'last-build.json'

PROCESS = re.compile(r'brush|sandblast|hydrograph', re.I)
SIZE = re.compile(r'Cover\s*size\s*[:：]?\s*([\d.]+\s*[*×xX]\s*[\d.]+(?:\s*[*×xX]\s*[\d.]+)?)\s*/\s*(FEA\s*\d+)', re.I)
WEIGHT = re.compile(r'Weight\s*[:：]\s*([\d.]+)\s*g', re.I)
CAP = re.compile(r'^(.*?)\bCap\s*[:：]\s*(.+)$', re.I)
COLLAR = re.compile(r'Shoulder\s*Collar\s*[:：]\s*(.+)$', re.I)
TITLE = re.compile(r'^\s*([A-Z]{1,5}\d{2,3}[A-Z]?)\s*Magnetic\s+Cap\s+Assy', re.I)


def norm_size(s: str) -> str:
    return re.sub(r'\s*[*×xX]\s*', '*', s.strip())


def pretty_size(s: str) -> str:
    return s.replace('*', ' × ')


# ---------------------------------------------------------------- reading the PDF
def page_lines(page):
    out = []
    for block in page.get_text('dict')['blocks']:
        if block['type'] != 0:
            continue
        for line in block['lines']:
            text = ''.join(span['text'] for span in line['spans']).strip()
            if text:
                out.append({'text': re.sub(r'\s+', ' ', text), 'bbox': line['bbox']})
    return out


def page_title(lines):
    top = [l for l in lines if l['bbox'][1] < 80]
    return ' '.join(l['text'] for l in sorted(top, key=lambda l: l['bbox'][1]))


def read_cards(doc):
    cards = []
    for pno, page in enumerate(doc, start=1):
        lines = page_lines(page)
        title = page_title(lines)
        images = page.get_image_info(xrefs=True)
        for index, info in enumerate(images):
            x0, y0, x1, y1 = info['bbox']
            if info['width'] < 600 or (x1 - x0) > 400 or info['xref'] == 0:
                continue
            below = [l for l in lines if y1 - 8 <= l['bbox'][1] <= y1 + 130 and l['bbox'][0] < x1 + 40 and l['bbox'][2] > x0 - 40]
            if not below:
                continue
            # Text of neighbouring cards can sit in the same band: keep the column closest to the photo.
            columns = {}
            for l in below:
                key = round(l['bbox'][0] / 25)
                columns.setdefault(key, []).append(l)
            column = min(columns.values(), key=lambda c: abs(c[0]['bbox'][0] - x0))
            column.sort(key=lambda l: l['bbox'][1])
            card = {'page': pno, 'title': title, 'image': index, 'xref': info['xref']}
            for l in column:
                t = l['text']
                if (m := TITLE.match(t)) and 'model' not in card:
                    card['model'] = m.group(1).upper()
                elif (m := SIZE.search(t)):
                    card['size'], card['neck'] = norm_size(m.group(1)), m.group(2).replace(' ', '').upper()
                elif (m := WEIGHT.search(t)):
                    card['weight'] = f'{float(m.group(1)):g}g'
                elif (m := COLLAR.search(t)):
                    card['collar'] = m.group(1).strip()
                elif (m := CAP.match(t)):
                    card['material'], card['finish'] = m.group(1).strip(), m.group(2).strip()
            if 'model' in card and 'finish' in card:
                card['process'] = bool(PROCESS.search(card['finish']))
                cards.append(card)
    return cards


def source_image(doc, xref):
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha > 3 or pix.alpha:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return Image.frombytes('RGB', [pix.width, pix.height], pix.samples)


def page_image(doc, page, index):
    info = doc[page - 1].get_image_info(xrefs=True)
    return source_image(doc, info[index]['xref'])


# ---------------------------------------------------------------- finish names
def colour_name(im, metallic=False):
    """Name the dominant colour of an isolated product photograph."""
    import numpy as np
    a = np.asarray(im.convert('RGB')).reshape(-1, 3).astype(float)
    a = a[np.min(a, axis=1) < 235]
    if not len(a):
        return 'white'
    r, g, b = np.median(a, axis=0)
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / mx if mx else 0
    if mx < 75:
        return 'black'
    if sat < 0.12:
        if metallic:
            return 'silver'
        return 'white' if mx > 180 else 'silver' if mx > 135 else 'grey'
    if r >= g and r >= b:
        if g >= b and (g - b) / max(1, r - b) > 0.5:
            return 'gold'
        if sat > 0.45:
            return 'red'
        return 'coffee' if mx < 140 else 'rose'
    if b >= r and b >= g:
        return 'purple' if r > g else 'blue'
    return 'green'


def finish_label(card, photo, product):
    raw = re.sub(r'\s+', ' ', card['finish']).strip()
    names = product.get('finishNames', {})
    if raw in names:
        label = names[raw]
    else:
        f = re.sub(r'\bMatt\b', 'Matte', raw, flags=re.I)
        f = re.sub(r'\bCo(a)?ting\b', 'coating', f, flags=re.I)
        low = f.lower()
        if 'hardwood' in card.get('material', '').lower():
            label = f'{f.capitalize()} wood'
        elif low.startswith('coating'):
            label = f'{colour_name(photo).capitalize()} coating'
        elif 'brush' in low:
            label = f'Brushed {colour_name(photo, metallic=True)}'
        elif 'sandblast' in low:
            label = f'Sandblasted {colour_name(photo, metallic=True)}'
        elif 'hydrograph' in low:
            label = 'Hydrographics'
        else:
            label = f[:1].upper() + f[1:].lower()
    template = product.get('finishLabel')
    return template.format(model=card['model'], finish=label) if template else label


ORDER = ['glossy black', 'glossy gold', 'glossy silver', 'matte black', 'matte gold', 'matte silver']


def finish_rank(label):
    low = label.lower()
    if low in ORDER:
        return (0, ORDER.index(low))
    if low.startswith('glossy'):
        return (1, 0)
    if low.startswith('matte'):
        return (2, 0)
    if 'coating' in low:
        return (3, 0)
    return (4, 0)


# ---------------------------------------------------------------- matching
def matches(card, rule):
    if bool(rule.get('process', False)) != card['process']:
        return False
    if 'model' in rule and rule['model'].upper() != card.get('model'):
        return False
    if 'size' in rule and norm_size(rule['size']) != card.get('size'):
        return False
    if 'weight' in rule and rule['weight'].replace(' ', '') != card.get('weight'):
        return False
    if 'title' in rule and rule['title'].lower() not in card['title'].lower():
        return False
    if 'page' in rule and rule['page'] != card['page']:
        return False
    return True


def alibaba_url(item):
    # Alibaba's own pattern: the first six words of the listing title, then the product ID.
    slug = '-'.join(re.findall(r'[A-Za-z0-9]+', item['title'])[:6])
    return f"https://www.alibaba.com/product-detail/{slug}_{item['id']}.html"


# ---------------------------------------------------------------- photographs
def write_photo(im, hd=True):
    key = hp.content_hash(im)
    base = PHOTOS / key
    if not (base.parent / f'{key}-800.webp').exists():
        big = hp.enlarge(im) if hd and max(im.size) < 700 else im
        hp.save_sizes(big, base)
    return f'assets/p/{key}'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf', type=Path)
    ap.add_argument('--report', action='store_true', help='only report; write nothing')
    ap.add_argument('--fast', action='store_true', help='skip AI enlargement (Lanczos only)')
    args = ap.parse_args()
    if args.fast:
        hp._net = False

    cfg = json.loads(CONFIG.read_text())
    store = json.loads(STORE.read_text()) if STORE.exists() else {'products': []}
    doc = fitz.open(args.pdf)
    cards = read_cards(doc)
    print(f'{len(doc)} pages, {len(cards)} spec cards found')

    products, by_id, unmatched, ignored = [], {}, [], []
    for p in cfg['products']:
        entry = {k: v for k, v in p.items() if k not in ('match', 'crop', 'special', 'finishNames', 'finishLabel', 'default')}
        entry['_cfg'] = p
        entry['_cards'] = []
        products.append(entry)
        by_id[p['id']] = entry
    for card in cards:
        if any(matches(card, r) for r in cfg.get('ignore', [])):
            ignored.append(card)
            continue
        target = next((e for e in products if 'match' in e['_cfg'] and matches(card, e['_cfg']['match'])), None)
        if target is None:
            # A model this config has never seen: group it with others of the same model and size.
            pid = re.sub(r'[^a-z0-9]+', '-', f"{card['model']}-{card.get('size', '')}".lower()).strip('-')
            target = by_id.get(pid)
            if target is None:
                target = {'id': pid, 'model': card['model'], 'name': f"The {card['model']} cap", 'category': 'cylinder',
                          'description': f"A {pretty_size(card.get('size', ''))} mm magnetic cap assembly for {card.get('neck', 'FEA15')} fittings.",
                          '_cfg': {'id': pid, 'match': {'model': card['model'], 'size': card.get('size', '')}}, '_cards': [], '_new': True}
                products.append(target)
                by_id[pid] = target
            unmatched.append(card)
        target['_cards'].append(card)

    report = {'pages': len(doc), 'cards': len(cards), 'new_products': [], 'empty_products': [], 'ignored': len(ignored), 'products': {}}
    if args.report:
        for e in products:
            report['products'][e['id']] = len(e['_cards']) if 'special' not in e['_cfg'] else 'special'
            if e.get('_new'):
                report['new_products'].append(e['id'])
            elif not e['_cards'] and 'special' not in e['_cfg']:
                report['empty_products'].append(e['id'])
        print(json.dumps(report, indent=2))
        return

    PHOTOS.mkdir(parents=True, exist_ok=True)
    used = set()
    out = []
    for e in products:
        c = e['_cfg']
        if 'special' in c:
            s = c['special']
            im = page_image(doc, s['page'], s['image'])
            if s.get('box'):
                im = im.crop(tuple(s['box']))
            if s.get('isolate') == 'coloured':
                im = hp.photograph(im, (0, 0, im.width, im.height), coloured_background=True)
            path = write_photo(im)
            used.add(Path(path).name)
            item = {k: v for k, v in e.items() if not k.startswith('_')}
            item.update(images=[path], page=s['page'])
            out.append(item)
            print(f"  {e['id']:<16} special photograph")
            continue
        if not e['_cards']:
            report['empty_products'].append(e['id'])
            print(f"  ! {e['id']}: no matching cards in this PDF (left out)")
            continue
        variants, seen_photos, seen_labels = [], set(), set()
        for card in e['_cards']:
            src = source_image(doc, card['xref'])
            photo = hp.photograph(src, tuple(c['crop'])) if c.get('crop') else hp.auto_photograph(src)
            key = hp.content_hash(photo)
            label = finish_label(card, photo, c)
            if key in seen_photos or label in seen_labels:
                continue
            seen_photos.add(key); seen_labels.add(label)
            variants.append((finish_rank(label), len(variants), label, photo, card))
        variants.sort(key=lambda v: (v[0], v[1]))
        images = []
        for _, _, label, photo, card in variants:
            images.append(write_photo(photo))
            used.add(Path(images[-1]).name)
        first = variants[0][4]
        item = {
            'id': e['id'], 'model': e.get('model', first['model']), 'name': e['name'], 'category': e['category'],
            'material': e.get('material') or (first.get('material', 'Anodized').replace('Anodized', 'Anodized aluminium') if first.get('material') else 'Anodized aluminium'),
            'size': e.get('size') or pretty_size(first.get('size', '')), 'neck': e.get('neck') or first.get('neck', 'FEA15'),
            'weight': e.get('weight') or first.get('weight', '').replace('g', ' g'), 'page': first['page'],
        }
        for k in ('badge', 'description', 'note'):
            if e.get(k):
                item[k] = e[k]
        item['finishes'] = [v[2] for v in variants]
        item['images'] = images
        if c.get('default') in item['finishes']:
            item['defaultVariant'] = item['finishes'].index(c['default'])
        out.append(item)
        if e.get('_new'):
            report['new_products'].append(e['id'])
        print(f"  {e['id']:<16} {len(images):>2} finishes  p.{first['page']}" + ('  NEW' if e.get('_new') else ''))

    # Editorial photographs used by the hero, collection and fallbacks.
    for ed in cfg.get('editorial', []):
        im = page_image(doc, ed['page'], ed['image'])
        if ed.get('box'):
            im = hp.photograph(im, tuple(ed['box']))
        if ed.get('hd'):
            big = hp.enlarge(im)
            big.thumbnail((900, 900), Image.Resampling.LANCZOS)
            big.save(ASSETS / f"{ed['name']}.webp", 'WEBP', quality=90, method=6)
        else:
            im.thumbnail((2400, 1200), Image.Resampling.LANCZOS)
            im.save(ASSETS / f"{ed['name']}.webp", 'WEBP', quality=88, method=6)

    # Alibaba storefront products (images stay on Alibaba's CDN).
    for s in store.get('products', []):
        out.append({
            'id': f"store-{s['id']}", 'source': 'store', 'model': s.get('model') or s['name'], 'name': s['detail'],
            'category': s['category'], 'material': 'See listing', 'size': 'See listing', 'neck': s.get('neck', '—'),
            'weight': '—', 'price': f"US${s['price'].replace('-', '–')}", 'moq': int(s['moq']), 'badge': s.get('badge', 'ALIBABA STORE'),
            'url': alibaba_url(s), 'listing': s['title'],
            'finishes': [f'Photo {i + 1}' for i in range(len(s['images']))], 'images': s['images'],
        })

    # Remove photographs no product uses any more.
    for f in PHOTOS.glob('*.webp'):
        if f.name.rsplit('-', 1)[0] not in {Path(u).name for u in used}:
            f.unlink()
    for old in ('products.webp', 'sprite-map.json'):
        (ASSETS / old).unlink(missing_ok=True)

    shutil.copyfile(args.pdf, ASSETS / cfg['pdf'])
    data = {'source': cfg['source'], 'pdf': f"assets/{cfg['pdf']}", 'storefront': store.get('storefront'),
            'storeChecked': store.get('checked'), 'showPrices': store.get('showPrices', True), 'categories': cfg['categories'], 'products': out}
    js = ('/* Generated by scripts/build_catalogue.py from the catalogue PDF, catalogue/catalogue.json\n'
          '   and catalogue/store.json. Edit those files and rebuild instead of editing this one. */\n'
          f'window.JIALAN = {json.dumps(data, ensure_ascii=False, indent=1)};\n')
    (DIST / 'products.js').write_text(js)
    report['products'] = {p['id']: len(p['images']) for p in out}
    REPORT.write_text(json.dumps(report, indent=2))
    n_store = sum(1 for p in out if p.get('source') == 'store')
    print(f'\nWrote dist/products.js: {len(out) - n_store} catalogue + {n_store} store products')
    if report['new_products']:
        print('NEW products (add names/categories in catalogue/catalogue.json):', ', '.join(report['new_products']))
    if report['empty_products']:
        print('Products with no cards in this PDF:', ', '.join(report['empty_products']))


if __name__ == '__main__':
    main()
