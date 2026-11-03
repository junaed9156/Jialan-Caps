# Jialan Caps website — working notes

Static website for Jialan / Suzhou Maohan Metal Products Co., Ltd. Everything that is served lives in `dist/` (deployed as-is; `.openai/hosting.json` points at it). There is no server code.

```
dist/                     the website (commit everything here, including built files)
  index.html, styles.css  page and base styles
  scenes.css              styles for the 3D scenes, studio controls, HD photos, store items
  app.js                  collection, filters, product dialog, shortlist, WhatsApp enquiry, motion toggle
  products.js             GENERATED product data — never edit by hand
  js/                     GENERATED 3D bundle (from src/3d) — never edit by hand
  assets/p/               GENERATED HD product photos: <hash>-400.webp and <hash>-800.webp
  assets/*.webp           hero / editorial photos (generated) and the catalogue PDF
src/3d/                   three.js scenes: kit.js (shared), hero.js, anatomy.js, studio.js, main.js
catalogue/catalogue.json  editorial layer for PDF products (names, categories, match rules, crops)
catalogue/store.json      products from the Alibaba storefront (not in the PDF)
scripts/build_catalogue.py   PDF → products.js + HD photos (+ report)
scripts/hd_photos.py         crop, isolate and 4x Real-ESRGAN enlargement (cached)
```

## When the user gives a new catalogue PDF

1. Install tools once: `pip install --break-system-packages pymupdf pillow numpy scipy ncnn`
   (the Real-ESRGAN model downloads itself from GitHub on first use into `catalogue/.cache/`).
2. Put the PDF in its own scratch folder, then dry-run:
   `python3 scripts/build_catalogue.py /path/new.pdf --report`
   - `new_products`: models the config has never seen. They will still appear on the site with
     plain defaults; give them a real entry in `catalogue/catalogue.json` (copy an existing entry:
     `id`, `match` {model, size}, `name`, `category`, `description`, optional `badge`, `default`, `crop`).
   - `empty_products`: configured products with no cards in this PDF (discontinued, renamed,
     or the printed text changed). Ask the user before deleting them; they are left out of the site.
3. Entries with `special` (banners, collars, pumps, lipstick) point at a page number and image
   index. If pages moved, update `page`/`image` (find them with `page.get_image_info()` in PyMuPDF).
4. Build: `python3 scripts/build_catalogue.py /path/new.pdf`. Only new or changed photographs are
   enlarged (about 20 s each on CPU, cached by content hash). `--fast` skips enlargement for a preview.
   If a crop picks the wrong photo for a new model, add `crop: [x0, y0, x1, y1]` in the
   1000 × 1000 spec-image pixel space (look at the image) and rebuild.
5. Check: `npm run serve`, open http://localhost:8000, browse filters and a few product dialogs.
6. Commit `dist/`, `catalogue/` and any script changes; push to `main`.

How matching works: each spec card in the PDF is a photo plus printed lines — "WL100 Magnetic Cap
Assy", "Cover size：27.5*28.6/FEA15", "Weight：27g", "Anodized Cap：Glossy Black", "Shoulder Collar：…".
A card joins the first product whose `match` fields all agree (`model`, `size`, `weight`, `title` =
text in the page heading, `process: true` for brushed/sandblasted/hydrographic cards). Finish names
come from the printed cap finish ("Matt" → "Matte"; ambiguous "Coting/Brushed/Sandblasting" get the
detected colour). `finishNames` overrides a printed name, `default` picks the finish shown first.

## Updating Alibaba store products

`catalogue/store.json` lists curated storefront products (`id` = Alibaba product ID, `title` = listing
title, `price`, `moq`, `images` = keys on `https://sc04.alicdn.com/kf/<key>`). Images are shown
straight from Alibaba's CDN (`_480x480.jpg_.webp` / `_960x960.jpg_.webp` resizes; PNG keys use the
original). To refresh: open https://maohan.m.en.alibaba.com/productlist.html in a browser; each group
page embeds `module-data='…'` URL-encoded JSON whose product objects carry `subject`, `fobPriceWithoutUnit`,
`moq`, `id` and `imageUrlList[].original`. Update the JSON, write a short `name` and `detail`, rebuild.
Product links are generated in Alibaba's own form: first six title words + `_<id>.html`.

## 3D scenes

Source in `src/3d/`, bundled with esbuild: `npm install` once, then `npm run build:3d` (writes `dist/js/`).
- `kit.js`: renderer, studio lighting, finish materials (named like the catalogue), cap geometry
  built from catalogue dimensions in centimetres, glass bottle, decals, helpers.
- `hero.js`: hero composition; `anatomy.js`: scroll story (`#anatomy`); `studio.js`: configurator.
- `main.js` loads each scene lazily when its section nears the viewport, only if WebGL exists.
  The hero shares one assembly timeline across WebGL and the projected illustration. Without WebGL the studio and anatomy retain their catalogue photographs.
- Motion: the hero's "Pause motion" button and `prefers-reduced-motion` stop all animation
  (`body.motion-paused`, event `jialan:motion`).
- Visual checks: headless Chrome needs `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## Content rules

- Product facts come from the catalogue or the Alibaba listing; do not invent certifications,
  factory statistics or testimonials. Notes in `catalogue.json` explain catalogue inconsistencies.
- Contact: WhatsApp +86 13812950775, WeChat 13812950775 (from the catalogue). Enquiries open a
  WhatsApp draft; nothing is sent or stored by the site.
