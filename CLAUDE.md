# Jialan Caps website — working notes

Static website for Jialan / Suzhou Maohan Metal Products Co., Ltd. Everything that is served lives in `dist/` (deployed as-is; `.openai/hosting.json` points at it). There is no server code.

```
dist/                     the website (commit everything here, including built files)
  index.html, styles.css  page and base styles
  scenes.css              styles for the 3D scenes, studio controls, HD photos, store items
  app.js                  collection, filters, product dialog, shortlist, WhatsApp enquiry, motion toggle,
                          admin-product merge, hidden admin entrance (3 quick clicks on the header logo)
  lang-boot.js            tiny <head> script: language and hero loading state before first paint
  i18n.js                 English / 中文 (normal URL always English; explicit ?lang=zh); dictionary + patterns
  admin-products.js       WRITTEN BY THE ADMIN PAGE — products added on admin/ (do not edit by hand)
  admin/                  admin page: password login, add/delete products, change password;
                          uploads are auto-cropped and centred on white like the catalogue photos
  admin/key.json          GitHub token encrypted with the admin password (PBKDF2-SHA256 600k + AES-256-GCM)
  assets/admin/           photos uploaded on the admin page (<id>-<n>-400/800.webp)
  404.html, notfound.css  branded page-not-found (absolute / paths; site is served at https://www.mao-han.cn)
  countries.js            countries + calling codes for the enquiry phone field (from libphonenumber-js)
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
   Single-product photos are enlarged (AI blended 50/50 with Lanczos so metal looks real, not glossy),
   then `hd_photos.tidy` erases stray arrows/digits and centres the product on a white square at 80 %,
   so every colour of a model is framed alike. If a digit touching a product survives, add
   `"erase": {"<finish>": [[x0, y0, x1, y1]]}` (framed 1000 × 1000 coordinates) to that entry.
   After changing tidy, delete the affected `dist/assets/p/<key>-*.webp` and rebuild (enlargements are cached).
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

## Admin page and languages

- `admin/` (open it with three quick clicks on the header logo). First run: paste a fine-grained GitHub token
  (only this repo, Contents: read and write) and choose a password of 12+ characters; the page stores the
  token encrypted in `dist/admin/key.json`, locked by the ID and password together (an older password-only key is
  re-locked with the ID typed at the next login). Saving a product commits photos + `dist/admin-products.js` in one
  commit via the GitHub API; the Pages workflow publishes it in 1–2 minutes. Pull before working locally.
- Chinese: add new UI or product strings to the `ZH` map in `dist/i18n.js` (exact English text as key).
  Untranslated text stays English. Admin products carry their own `*_zh` fields.
- Security: CSP meta in index.html and admin/index.html (no inline scripts allowed — keep it that way),
  frame-busting in i18n.js/admin.js, all product text escaped or set with textContent.

## 3D scenes

Source in `src/3d/`, bundled with esbuild: `npm install` once, then `npm run build:3d` (writes `dist/js/`).
The build versions local CSS/JS URLs in `dist/index.html`; run it after changes to those assets too.
It also writes `<link rel="modulepreload">` hints (between `<!-- 3d-preload -->` markers) for the hero's chunks, so
the 3D code downloads alongside the page; chunk URLs stay unversioned because their names already carry a hash.
Run `npm test` for language, frame-budget and scene lifecycle regressions.
- `kit.js`: renderer, studio lighting, finish materials (named like the catalogue), cap geometry
  built from catalogue dimensions in centimetres, glass bottle, decals, helpers.
- `hero.js`: hero composition; `anatomy.js`: scroll story (`#anatomy`); `studio.js`: configurator.
- `main.js` starts the hero after first paint, without waiting for window.load. Lower scenes load near the viewport.
  The hero shows a small loading indicator until its first rendered frame, so the illustrated fallback cannot flash first.
  Unsupported WebGL, load errors or the eight-second startup deadline reveal the fallback; late initialisation cannot replace it.
  The hero shares one assembly timeline across WebGL and the projected illustration. Without WebGL the studio and anatomy retain their catalogue photographs.
- Motion: the hero's "Pause motion" button and `prefers-reduced-motion` stop all animation
  (`body.motion-paused`, event `jialan:motion`).
- Visual checks: headless Chrome needs `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## Content rules

- Product facts come from the catalogue or the Alibaba listing; do not invent certifications,
  factory statistics or testimonials. Notes in `catalogue.json` explain catalogue inconsistencies.
- Contact: WhatsApp +86 13812950775, WeChat 13812950775 (from the catalogue). Enquiries open a
  WhatsApp draft; nothing is sent or stored by the site.
