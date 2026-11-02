# Jialan Caps & Closures

Product website for Jialan / Suzhou Maohan Metal Products Co., Ltd: perfume caps, collars, pumps, bottles and cosmetic closures, with real-time 3D.

Live website: https://jialan-caps.expert-siren-8808.chatgpt.site

## What is on the site

- **3D hero** — a glass bottle with perfume receives its gold WL100 cap with a magnetic snap; caps float around it over flowing silk. Click a floating cap to open it in the studio.
- **"Built to click" scroll story** — scrolling lifts the cap, separates cap, pump, collar and bottle with labelled dimensions, tours the finishes and laser-engraves a logo.
- **3D studio** — eight cap families built to catalogue dimensions, 13 finishes plus hardwood, collar colour, a live logo preview (laser, gold foil, white or black print), lift and bottle views, and "Enquire about this design".
- **Collection** — 37 catalogue products with every finish as an HD photograph (4x AI-enlarged from the PDF), plus 59 products from the Alibaba store (bottles, sets, closures, collars, store caps) with listing price and minimum order.
- Shortlist and WhatsApp enquiry drafts; nothing is sent or stored by the site.

The 3D scenes load only on devices with WebGL and respect "Pause motion" and reduced-motion settings. Without WebGL the catalogue photographs are shown instead.

## Run locally

```sh
python3 -m http.server 8000 --directory dist   # or: npm run serve
```

Open http://localhost:8000. `dist/` is the complete website; asset paths are relative, so it works in a subdirectory too.

## Update from a new catalogue PDF

```sh
pip install --break-system-packages pymupdf pillow numpy scipy ncnn
python3 scripts/build_catalogue.py new-catalogue.pdf --report   # what is new or missing
python3 scripts/build_catalogue.py new-catalogue.pdf            # rebuild data + HD photos
```

The script reads every specification card (photo, model, size, neck, weight, finishes) from the PDF, matches it to `catalogue/catalogue.json`, enlarges new photos with Real-ESRGAN, and writes `dist/products.js`. New models appear automatically; give them names and categories in `catalogue/catalogue.json`. Store products live in `catalogue/store.json`. Full steps: `CLAUDE.md`.

> নতুন PDF পেলে: PDF-টা Claude-কে দিয়ে বলুন "এই নতুন catalogue দিয়ে website update করো"। Claude `CLAUDE.md` অনুযায়ী নতুন product যোগ করবে, ছবি HD করবে আর GitHub-এ push করবে।

## Edit the 3D scenes

```sh
npm install
npm run build:3d      # bundles src/3d/*.js into dist/js/
```

## Content sources

The English Jialan catalogue dated 30 October 2026 (supplied by the owner) is the source for catalogue products; each product links to its PDF page, and notes explain where the PDF contradicts itself. Store products, prices and minimum orders come from https://maohan.m.en.alibaba.com/ (checked 2 November 2026) and link to their listings; set `"showPrices": false` in `catalogue/store.json` to hide prices. The site does not show testimonials, ratings, certifications or factory statistics.

Contact (from the catalogue): WhatsApp +86 13812950775; WeChat 13812950775. Preserve the project ID in `.openai/hosting.json` for future Sites deployments.
