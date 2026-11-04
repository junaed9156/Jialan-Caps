"""HD product photographs from the catalogue PDF.

Crops a product photograph out of a catalogue specification image, isolates the
product from dimension arrows and labels, and enlarges it 4x with Real-ESRGAN
(ncnn, CPU). Enlarged results are cached by the crop's content hash, so a
rebuild with a new catalogue only processes photographs that changed.

The Real-ESRGAN model is downloaded once from the official GitHub release into
catalogue/.cache/. Without the `ncnn` Python package the script falls back to
high-quality Lanczos resampling and says so.
"""
from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'catalogue' / '.cache'
SR_CACHE = CACHE / 'sr'
MODEL_DIR = CACHE / 'realesrgan'
MODEL_ZIP = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip'


def _isolate(a, threshold, coloured_background, strong, focus=None):
    if coloured_background:
        corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]], dtype=float)
        background = np.median(corners, axis=0)
        mask = np.sqrt(np.sum((a.astype(float) - background) ** 2, axis=2)) > 37
    else:
        mask = np.min(a, axis=2) < threshold
    # A wider opening cuts the thin dimension lines and labels that touch the photo.
    core = ndimage.binary_opening(mask, structure=np.ones((7, 7) if strong else (3, 3)))
    labels, count = ndimage.label(core)
    if not count:
        return None
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    if focus is not None:
        # Prefer the object inside the configured box over a neighbouring photo.
        y0, y1, x0, x1 = focus
        inside = np.bincount(labels[y0:y1, x0:x1].ravel(), minlength=len(sizes))
        inside[0] = 0
        if inside.max() > 200:
            sizes = inside
    if sizes.max() < 200:
        return None
    component = labels == sizes.argmax()
    if strong:
        component = ndimage.binary_dilation(component, iterations=4) & ndimage.binary_dilation(mask)
    return ndimage.binary_fill_holes(ndimage.binary_dilation(component))


def _hull(mask: np.ndarray) -> np.ndarray:
    """Filled convex hull of a boolean mask."""
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    ys, xs = np.where(mask)
    if len(xs) < 3:
        return mask
    pts = np.column_stack([xs, ys])
    try:
        hull = ConvexHull(pts)
    except Exception:
        return mask
    poly = [tuple(map(float, pts[i])) for i in hull.vertices]
    img = Image.new('L', (mask.shape[1], mask.shape[0]), 0)
    ImageDraw.Draw(img).polygon(poly, fill=255)
    return np.asarray(img) > 0


def photograph(im: Image.Image, box=None, threshold=244, coloured_background=False, margin=0) -> Image.Image:
    """Isolate the main connected photographic object inside `box`.

    Keeps the source photograph's own pixels and whitens separate dimension
    arrows and text around it. Nothing about the product is generated.
    With `margin`, the box is widened, and widened again on any side where the
    product still touches the edge, so a badly placed box cannot clip it.
    """
    box = box or (0, 0, im.width, im.height)
    if not margin:
        a = np.asarray(im.crop(box))
        component = _isolate(a, threshold, coloured_background, False)
    else:
        grown = [max(0, box[0] - margin), max(0, box[1] - margin), min(im.width, box[2] + margin), min(im.height, box[3] + margin)]
        for _ in range(8):
            a = np.asarray(im.crop(tuple(grown)))
            focus = (box[1] - grown[1], box[3] - grown[1], box[0] - grown[0], box[2] - grown[0])
            component = _isolate(a, threshold, coloured_background, True, focus)
            if component is None:
                break
            ys, xs = np.where(component)
            edges = [xs.min() <= 2 and grown[0] > 0, ys.min() <= 2 and grown[1] > 0,
                     xs.max() >= a.shape[1] - 3 and grown[2] < im.width, ys.max() >= a.shape[0] - 3 and grown[3] < im.height]
            if not any(edges):
                break
            step = 40
            grown = [max(0, grown[0] - step * edges[0]), max(0, grown[1] - step * edges[1]),
                     min(im.width, grown[2] + step * edges[2]), min(im.height, grown[3] + step * edges[3])]
    if component is None:
        return im.crop(box)
    ys, xs = np.where(component)
    out = np.full_like(a, 255)
    # Keep everything inside the product's outline (convex hull): white and silver caps have
    # highlights as light as the background, which would otherwise be cut away.
    # Only when real (non-white) product pixels were dropped, so unchanged photos stay cached.
    keep = component
    hull = _hull(component)
    dropped = hull & ~component & (a.min(axis=2) < 250)
    if dropped.sum() > 0.005 * component.sum():
        keep = hull | component
    out[keep] = a[keep]
    h, w = a.shape[:2]
    return Image.fromarray(out).crop((max(0, int(xs.min()) - 3), max(0, int(ys.min()) - 3),
                                      min(w, int(xs.max()) + 4), min(h, int(ys.max()) + 4)))


def tidy(im: Image.Image, fill=0.80, size=1000, threshold=236) -> Image.Image:
    """Frame a single-product photograph the same way every time.

    Stray marks left from the specification image (arrow heads, dimension lines, digits) are whitened:
    any dark mark outside the product's outline (its convex hull) goes, however close it sits. The
    product's own pixels, including faint edges of white or silver caps, stay as photographed. The
    product is then centred on a white square with an even margin, so switching between colours of
    one model keeps the same size and position.
    """
    a = np.asarray(im.convert('RGB'))
    dark = a.min(axis=2) < threshold
    labels, n = ndimage.label(dark)
    if not n:
        return im
    sizes = ndimage.sum(dark, labels, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    body = labels == main
    for i, area in enumerate(sizes, start=1):        # other large parts (e.g. a separate collar) stay
        if i != main and area > 0.12 * sizes[main - 1]:
            body |= labels == i
    # Thin dimension lines attached to the product would stretch its outline out to the printed
    # digits, so the outline is taken from the body with thin lines opened away.
    core = ndimage.binary_opening(body, structure=np.ones((15, 15)))
    if core.sum() < 0.5 * body.sum():
        core = body
    # Row by row, the product spans from its leftmost to its rightmost body pixel; digits beside it
    # fall outside that span. Rows without body (thin rims, dome tips) use the body's convex outline.
    h, w = core.shape
    has = core.any(axis=1)
    left = np.where(has, core.argmax(axis=1), 0)
    right = np.where(has, w - 1 - core[:, ::-1].argmax(axis=1), -1)
    cols = np.arange(w)[None, :]
    band = has[:, None] & (cols >= (left - 4)[:, None]) & (cols <= (right + 4)[:, None])
    outline = np.where(has[:, None], band, ndimage.binary_dilation(_hull(body), iterations=3))
    stray = ndimage.binary_dilation(dark & ~outline, iterations=2) & ~outline
    out = a.copy()
    out[stray] = 255
    near = outline
    # Final pass: small dark pieces separated from the product by background (digit fragments a few
    # pixels from its edge) are erased; anything within the product's own row span stays.
    d2 = ndimage.binary_opening(out.min(axis=2) < 200, structure=np.ones((3, 3)))   # break 1–2 px bridges
    lab2, n2 = ndimage.label(d2)
    if n2 > 1:
        sz2 = ndimage.sum(d2, lab2, range(1, n2 + 1))
        # The product's span comes from its whole non-white silhouette (white caps included).
        lit = ndimage.binary_opening(out.min(axis=2) < 246, structure=np.ones((3, 3)))
        lab3, n3 = ndimage.label(lit)
        sz3 = ndimage.sum(lit, lab3, range(1, n3 + 1))
        main2 = lab3 == (int(np.argmax(sz3)) + 1)
        # Metal and dark caps have a solid dark body; measuring against it ignores the faint grey
        # pixels that can join a digit to the outline. White and pale-wood caps keep the outline.
        dark_body = lab2 == (int(np.argmax(sz2)) + 1)
        if dark_body.sum() > 0.6 * main2.sum():
            main2 = dark_body
        has2 = main2.any(axis=1)
        l2 = np.where(has2, main2.argmax(axis=1), 0)
        r2 = np.where(has2, w - 1 - main2[:, ::-1].argmax(axis=1), -1)
        within = has2[:, None] & (cols >= (l2 - 1)[:, None]) & (cols <= (r2 + 1)[:, None])
        touches = ndimage.maximum(within, lab2, range(1, n2 + 1))
        small = sz2 < 0.02 * sz2.max()
        drop = [i + 1 for i in range(n2) if small[i] and not touches[i]]
        if drop:
            out[ndimage.binary_dilation(np.isin(lab2, drop), iterations=4) & ~main2] = 255
        # A digit fragment touching the side makes a short bump in an otherwise smooth edge. For metal
        # and dark caps (solid dark body) each row's edge is compared with the median edge nearby.
        if main2 is dark_body:
            rows2 = np.where(has2)[0]
            if len(rows2) > 80:
                win = 61
                l_ok = ndimage.median_filter(l2[rows2], size=win, mode='nearest') - 3
                r_ok = ndimage.median_filter(r2[rows2], size=win, mode='nearest') + 3
                bump = np.zeros_like(d2)
                bump[rows2] = (cols < l_ok[:, None]) | (cols > r_ok[:, None])
                # Only the middle of the height: the top and bottom of a cap curve quickly.
                n_rows = len(rows2)
                bump[:rows2[int(n_rows * 0.18)]] = False
                bump[rows2[int(n_rows * 0.85)]:] = False
                out[ndimage.binary_dilation(bump & (out.min(axis=2) < 200), iterations=3) & bump] = 255
    # Frame by everything left that is not pure background (white caps have few dark pixels).
    ys, xs = np.where(near | (out.min(axis=2) < 250))
    pad = 6
    box = (max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad), min(a.shape[1], int(xs.max()) + pad), min(a.shape[0], int(ys.max()) + pad))
    obj = Image.fromarray(out).crop(box)
    scale = size * fill / max(obj.width, obj.height)
    obj = obj.resize((max(1, round(obj.width * scale)), max(1, round(obj.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (size, size), (255, 255, 255))
    canvas.paste(obj, ((size - obj.width) // 2, (size - obj.height) // 2))
    return canvas


def auto_photograph(im: Image.Image) -> Image.Image:
    """Find the product photograph in a specification image with no configured box.

    Specification images show a title, dimension arrows and two or three photos.
    The largest solid, photo-like component below the title is chosen.
    """
    a = np.asarray(im.convert('RGB'))
    h, w = a.shape[:2]
    top = int(h * 0.16)  # skip the printed title
    region = a[top:]
    mask = np.min(region, axis=2) < 240
    mask = ndimage.binary_opening(mask, structure=np.ones((5, 5)))
    labels, count = ndimage.label(mask)
    if not count:
        return im
    best, best_score = None, 0
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if bh < h * 0.12 or bw < w * 0.08:
            continue
        filled = ndimage.binary_fill_holes(labels[sl] == i)
        solidity = filled.mean()
        score = filled.sum() * solidity
        if solidity > 0.45 and score > best_score:
            best, best_score = sl, score
    if best is None:
        return photograph(im)
    y0, y1 = best[0].start + top, best[0].stop + top
    x0, x1 = best[1].start, best[1].stop
    pad = 12
    return photograph(im, (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))


def content_hash(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'PNG')
    return hashlib.sha1(buf.getvalue()).hexdigest()[:16]


_net = None


def _model():
    global _net
    if _net is not None:
        return _net
    try:
        import ncnn  # type: ignore
    except ImportError:
        print('  ! ncnn is not installed: using Lanczos enlargement (pip install ncnn for HD)', file=sys.stderr)
        _net = False
        return _net
    param = MODEL_DIR / 'realesrgan-x4plus.param'
    if not param.exists():
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        print('  downloading the Real-ESRGAN model (one time, ~45 MB)…', file=sys.stderr)
        data = urllib.request.urlopen(MODEL_ZIP, timeout=300).read()
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for name in z.namelist():
                if name.endswith(('realesrgan-x4plus.param', 'realesrgan-x4plus.bin')):
                    (MODEL_DIR / Path(name).name).write_bytes(z.read(name))
    net = ncnn.Net()
    net.opt.use_vulkan_compute = False
    net.opt.num_threads = 4
    net.load_param(str(MODEL_DIR / 'realesrgan-x4plus.param'))
    net.load_model(str(MODEL_DIR / 'realesrgan-x4plus.bin'))
    _net = (ncnn, net)
    return _net


def natural_enlarge(im: Image.Image, ai_share=0.5) -> Image.Image:
    """4x enlargement that keeps the photograph's real look.

    The AI result alone makes metal look glossier and smoother than the real product, so it is
    mixed with a plain Lanczos enlargement of the same photo: sharp edges, real surface and colour.
    """
    ai = enlarge(im)
    plain = im.convert('RGB').resize(ai.size, Image.Resampling.LANCZOS)
    return Image.blend(plain, ai, ai_share)


def enlarge(im: Image.Image) -> Image.Image:
    """Return the photograph at 4x size, from the cache when available."""
    key = content_hash(im)
    cached = SR_CACHE / f'{key}.png'
    if cached.exists():
        return Image.open(cached).convert('RGB')
    model = _model()
    rgb = im.convert('RGB')
    if not model:
        big = rgb.resize((rgb.width * 4, rgb.height * 4), Image.Resampling.LANCZOS)
        return big.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    ncnn, net = model
    # Pad with white so the network sees context at the borders, then remove it.
    pad = 8
    canvas = Image.new('RGB', (rgb.width + pad * 2, rgb.height + pad * 2), 'white')
    canvas.paste(rgb, (pad, pad))
    a = np.asarray(canvas).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    out = np.zeros((h * 4, w * 4, 3), dtype=np.float32)
    # Tiles keep memory low (a whole 350 px photo needs ~6 GB in one pass).
    tile, overlap = 96, 12
    for y0 in range(0, h, tile):
        for x0 in range(0, w, tile):
            y1, x1 = min(h, y0 + tile), min(w, x0 + tile)
            ty0, tx0 = max(0, y0 - overlap), max(0, x0 - overlap)
            ty1, tx1 = min(h, y1 + overlap), min(w, x1 + overlap)
            patch = np.ascontiguousarray(a[ty0:ty1, tx0:tx1].transpose(2, 0, 1))
            ex = net.create_extractor()
            ex.input('data', ncnn.Mat(patch))
            _, res = ex.extract('output')
            res = np.array(res).transpose(1, 2, 0)
            del ex
            oy, ox = (y0 - ty0) * 4, (x0 - tx0) * 4
            out[y0 * 4:y1 * 4, x0 * 4:x1 * 4] = res[oy:oy + (y1 - y0) * 4, ox:ox + (x1 - x0) * 4]
    o = np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8)
    big = Image.fromarray(o).crop((pad * 4, pad * 4, pad * 4 + rgb.width * 4, pad * 4 + rgb.height * 4))
    # Keep pure white backgrounds pure white after enlargement.
    b = np.asarray(big).copy()
    b[np.min(b, axis=2) > 250] = 255
    big = Image.fromarray(b)
    SR_CACHE.mkdir(parents=True, exist_ok=True)
    big.save(cached)
    return big


def save_sizes(big: Image.Image, base: Path, sizes=(400, 800), quality=88) -> list[Path]:
    """Write `<base>-<size>.webp` files fitted inside size×size squares."""
    base.parent.mkdir(parents=True, exist_ok=True)
    written = []
    for size in sizes:
        im = big.copy()
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
        path = base.parent / f'{base.name}-{size}.webp'
        im.save(path, 'WEBP', quality=quality, method=6)
        written.append(path)
    return written
