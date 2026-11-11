# Jialan Caps website — working notes

Static website for Jialan / Suzhou Maohan Metal Products Co., Ltd. Everything that is served lives in `dist/` (deployed as-is; `.openai/hosting.json` points at it). There is no server code.

```
dist/                     the website (commit everything here, including built files)
  index.html, styles.css  page and base styles
  site.css               GENERATED stylesheet, also embedded in index.html; edit source CSS then build
  site.js                GENERATED application bundle; edit lang-boot.js, countries.js, i18n.js or app.js
  translations-*.js      GENERATED Chinese dictionary, downloaded only on explicit Chinese visits
  zh.html                GENERATED Chinese page (/zh): index.html pre-translated at build time, so it never flashes English
  scenes.css              styles for the 3D scenes, studio controls, HD photos, store items
  app.js                  collection, filters, product dialog, shortlist, WhatsApp enquiry, motion toggle,
                          admin-product merge, hidden admin entrance (3 quick clicks on the header logo)
  lang-boot.js            language boot code bundled in the deferred site.js (never hide the hero)
  i18n.js                 English / 中文 (/ is English, /zh is Chinese; an old ?lang=zh link moves to /zh); dictionary + patterns
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

## Client product photographs (photo mode, Nov 2026)

`catalogue/photos.json` + `catalogue/photos/` hold the client's own product photos (from 茂涵图片.rar and a separate
JLC33 photo). While photos.json exists the build writes ONLY the products it lists, in its order, each with these photos
saved uncropped at their original 800 px size (no cleaning/enlargement; class `is-photo`, shown with object-fit: contain
in square boxes). Facts (name, size, neck, weight, page) still come from the PDF + catalogue.json. Finish labels follow the
client's Chinese file names (`finish_zh`), with Chinese in i18n.js. Alibaba store items are hidden (`includeStore: false`).
Notes: the client's files say JLQ37, but the catalogue page is JLW37 (used). Unnamed photos were matched to catalogue
models: knurling → JLG29, brushed pink & sandblasted gold → JL30, hydrographics → WL100 & JL30, coating → WL100.
Rebuild: `python3 scripts/build_catalogue.py <pdf> --skip-editorial` (editorial/hero images unchanged). Empty category
filters are hidden automatically.

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
The build combines styles.css, studio.css, scenes.css and atelier.css into site.css and embeds
it in index.html. It also bundles the application as site.js and extracts the Chinese dictionary
from i18n.js into a hashed translations file. Keep products.js and admin-products.js separate;
the admin publishes those feeds directly. All generated artifacts must be committed.
Preload only the bootstrap's tiny static dependencies, never the full three.js engine or
below-fold scenes. Pages now builds and tests on each deployment so source edits and admin
changes cannot ship stale bundles or asset versions.
Run `npm test` for payload, language, frame-budget and scene lifecycle regressions.
- `kit.js`: renderer, studio lighting, finish materials (named like the catalogue), cap geometry
  built from catalogue dimensions in centimetres, glass bottle, decals, helpers.
- `context.js`: retains the WebGL capability-check canvas for the first scene; all 3D scene canvases use createCanvas().
- `hero.js`: hero composition; `anatomy.js`: scroll story (`#anatomy`); `studio.js`: configurator.
- Hero first paint: `assets/hero-poster-wide.webp` / `-tall.webp` are photographs of the 3D scene's own first
  frame (pose 0, bottle with the red mark), shown as the stage background and kept as the no-WebGL fallback. The
  drawn SVG plate (lettering on the bottle) is never shown. `sequence.js` holds the clock at pose 0 until the scene
  draws, so the poster and live scene match. After changing hero.js, kit.js or sequence.js, rebuild and run
  `node scripts/hero-poster.mjs` (instructions in the file) to reshoot both posters.
- Chinese copy uses 您 (business register) and 茂涵 for the brand in running text; the legal company name stays in
  English (no verified Chinese registration name). Chinese pages are set in semibold/bold (atelier.css, end).
- `main.js` starts the hero after first paint when visible. Studio/anatomy initialise near
  the viewport or on explicit navigation/intent, independently of other pending shaders.
  The hero poster and product photos remain visible during downloads. The hero keeps its
  poster if WebGL fails or exceeds its eight-second startup deadline.
  Studio's hidden bottle shaders warm after its first cap frame. Scenes stop off screen.
- Motion: the hero's "Pause motion" button and `prefers-reduced-motion` stop all animation
  (`body.motion-paused`, event `jialan:motion`).
- Visual checks: headless Chrome needs `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## Content rules

- Product facts come from the catalogue or the Alibaba listing; do not invent certifications,
  factory statistics or testimonials. Notes in `catalogue.json` explain catalogue inconsistencies.
- Contact: WhatsApp +86 13812950775, WeChat 13812950775 (from the catalogue). Enquiries open a
  WhatsApp draft; nothing is sent or stored by the site.
