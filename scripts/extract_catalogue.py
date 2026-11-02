"""Extract the supplied Jialan catalogue's product photographs for the static site.

Run: python3 scripts/extract_catalogue.py /path/to/original-catalogue.pdf
Requires PyMuPDF and Pillow. Product data is maintained in dist/products.js.
"""
from pathlib import Path
import sys
import fitz
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
doc = fitz.open(sys.argv[1])

def source(xref):
    pix = fitz.Pixmap(doc, xref)
    if pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return Image.frombytes('RGB', [pix.width, pix.height], pix.samples)

def photograph(im, box=None, threshold=244, coloured_background=False):
    """Isolate the main connected photographic object from a technical figure.

    This retains the source photograph while excluding separate dimension arrows
    and text around it. No product geometry or finish is generated or recoloured.
    """
    im = im.crop(box or (40,245,725,710))
    a = np.asarray(im)
    if coloured_background:
        corners=np.array([a[0,0],a[0,-1],a[-1,0],a[-1,-1]],dtype=float)
        background=np.median(corners,axis=0)
        mask=np.sqrt(np.sum((a.astype(float)-background)**2,axis=2))>37
    else:
        mask = np.min(a,axis=2) < threshold
    mask=ndimage.binary_opening(mask,structure=np.ones((3,3)))
    labels, count = ndimage.label(mask)
    sizes = np.bincount(labels.ravel());sizes[0]=0
    if not count or sizes.max()<200:
        return im
    component = labels == sizes.argmax()
    component = ndimage.binary_fill_holes(ndimage.binary_dilation(component))
    ys,xs=np.where(component)
    out=np.full_like(a,255)
    out[component]=a[component]
    return Image.fromarray(out).crop((max(0,int(xs.min())-3),max(0,int(ys.min())-3),min(im.width,int(xs.max())+4),min(im.height,int(ys.max())+4)))

# Photographic areas only; the unmodified specification sheets remain in the PDF.
groups = [
    ('wl100', [76,79,78,77,80,81,82,84,85,83], (435,320,715,670)),
    ('wll100', [88,91,90,89,92,93,94,95,96,97], (435,300,715,680)),
    ('wls100', [100,101,102], (435,300,715,680)),
    ('wl50', [121,116,117,114,118,120,115,119,122,123], (435,300,715,680)),
    ('ky100', [129,131,138,130,133,134,136,137,132,135], (435,300,715,680)),
    ('ky100s', [141,142], (200,315,515,690)),
    ('ky100z', [144,143], (125,320,410,690)),
    ('ky60', [147,150,149,148,152,153,155,156,154,151], (435,300,715,680)),
    ('ky32', [167,169,170], (435,300,715,680)),
    ('ky32-rolled', [159,160,162,163,164,161], (435,300,715,680)),
    ('ky28', [176,175,179,180,178,181,182,177], (435,300,715,680)),
    ('jl30', [191,192,193,189,190,188], (100,345,340,675)),
    ('jl30-short', [200,196,199,198,197], (100,345,340,675)),
    ('jl30s', [209,211,210,207,206,208], (100,330,345,675)),
    ('jl35', [221,222,220,218,217,219], (95,325,355,675)),
    ('jl52-round', [228,231,229], (95,320,360,690)),
    ('jlf52', [233,232,230], (95,320,365,690)),
    ('jlq36', [241,243,240,244,245,246,242,247], (75,330,390,630)),
    ('jlw37', [250,251,253,254,252,255], (75,310,390,650)),
    ('jlg29', [270,271,272], (95,315,360,675)),
    ('jlm31', [287,288,289], (100,305,350,600)),
    ('jlq40', [290,291,292], (75,335,370,635)),
    ('jlm36', [293], (80,310,365,650)),
    ('jlm42', [294], (80,310,365,650)),
    ('jl30-rolled', [105,108], (100,345,340,675)),
    ('jl30s-rolled', [106,109], (100,345,340,675)),
    ('wl100-rolled', [107,110], (435,300,715,680)),
    ('finishes', [279,276,283,277,278,280,281,282,284], (435,300,715,680)),
]

# A single sprite keeps the complete set of real finish photographs fast to load.
CELL, COLS = 360, 10
count = sum(len(refs) for _,refs,_ in groups) + 9
rows = (count + COLS - 1) // COLS
atlas = Image.new('RGB', (CELL * COLS, CELL * rows), 'white')
mapping = {}
index = 0
for key, refs, box in groups:
    mapping[key] = []
    for xref in refs:
        im = photograph(source(xref))
        im.thumbnail((300,300), Image.Resampling.LANCZOS)
        tile = Image.new('RGB', (CELL,CELL), 'white')
        tile.paste(im, ((CELL-im.width)//2, (CELL-im.height)//2))
        atlas.paste(tile, ((index % COLS)*CELL,(index // COLS)*CELL))
        mapping[key].append(index)
        index += 1

specials = [
    ('jlq32',258,(1225,145,1345,277)),
    ('jlc33',261,(1190,78,1387,271)),
    ('jlf33',264,(646,190,885,390)),
    ('collars',315,(150,350,1600,1250)),
    ('jl30-collars',325,(50,220,750,650)),
    ('square-collars',332,(70,240,720,650)),
    ('pumps',345,(10,10,340,340)),
    ('cosmetic-caps',307,(80,180,1190,1030)),
    ('lipstick',309,(10,30,1250,1240)),
]
for key,xref,box in specials:
    im = source(xref).crop(box)
    if key in ('jlq32','jlc33','jlf33'):
        im = photograph(im,(0,0,im.width,im.height),coloured_background=True)
    im.thumbnail((300,300), Image.Resampling.LANCZOS)
    tile = Image.new('RGB',(CELL,CELL),'white')
    tile.paste(im,((CELL-im.width)//2,(CELL-im.height)//2))
    atlas.paste(tile,((index % COLS)*CELL,(index // COLS)*CELL))
    mapping[key]=[index]
    index+=1

atlas.save(OUT/'products.webp', quality=88, method=6)

# Standalone photographs are used for the hero and editorial compositions.
for name,xref,box in [
    ('hero-black',76,(430,315,720,675)),
    ('hero-gold',79,(430,315,720,675)),
    ('hero-sphere',241,(70,325,395,635)),
    ('wood',287,(95,300,355,610)),
]:
    photograph(source(xref),box).save(OUT/(name+'.webp'), quality=93, method=6)
for name,xref in [('collection',31),('sculptural',258),('custom',297),('accessories',34)]:
    im=source(xref);im.thumbnail((1600,900),Image.Resampling.LANCZOS)
    im.save(OUT/(name+'.webp'),quality=88,method=6)

import json
(OUT/'sprite-map.json').write_text(json.dumps({'columns':COLS,'rows':rows,'images':mapping},indent=2))
print(json.dumps({'products':len(mapping),'photographs':index,'sprite_rows':rows,'sprite_bytes':(OUT/'products.webp').stat().st_size}))
