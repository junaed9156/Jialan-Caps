# Jialan Caps & Closures

A responsive, buildless product catalogue for Jialan / Suzhou Maohan Metal Products Co., Ltd.

## Run

Serve `dist/` using any static HTTP server. For example:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. No installation or build is required. The website works on static hosts, including subdirectory deployments, because its asset paths are relative.

## Contents

- `dist/index.html` — website structure and contact information
- `dist/styles.css` — responsive layouts, motion and reduced-motion support
- `dist/products.js` — product specifications and catalogue page references
- `dist/app.js` — filtering, actual finish photographs, accessible dialogs, optional local shortlist persistence and WhatsApp enquiry drafts
- `dist/assets/` — photographs extracted from the supplied catalogue and the downloadable 41-page catalogue
- `scripts/extract_catalogue.py` — reproducible photograph extraction from the original catalogue

## Content sources

The primary source is the English Jialan catalogue dated 30 October 2026, supplied by the owner. All product photographs come from it. Each product’s specification button opens its corresponding PDF page. Some source headings conflict with labels inside photographs; those cases have explicit notes in product details.

The supplier storefront is https://maohan.m.en.alibaba.com/. Public supplier listings informed the packaging range and customisation language. The site does not reproduce third-party testimonials, ratings, unverified factory statistics or certification claims.

The contact number comes from the catalogue: WhatsApp +86 13812950775; WeChat 13812950775.

## Enquiries

Visitors can shortlist a specific product and finish. The enquiry form creates a WhatsApp draft for the supplier. The visitor reviews and sends it in WhatsApp. The site has no email-delivery backend and does not pretend that a form submission has been delivered. Contact form details are not stored. The shortlist is saved only in the visitor’s browser where available.

## Update

Edit product data in `dist/products.js` and marketing content in `dist/index.html`. To regenerate the photograph sprite from the original PDF, install PyMuPDF and Pillow and run:

```sh
python3 scripts/extract_catalogue.py /path/to/original-catalogue.pdf
```

The photograph sprite maps each finish to an actual source image. Update sprite coordinates with data changes. Preserve the project ID in `.openai/hosting.json` for future Sites deployments.
