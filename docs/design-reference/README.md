# Design reference

Static renders of the approved mockups: 3 themes x 5 surfaces = 15 HTML files.

```
maison/    check.html  scenario.html  email.html  snapshot-pdf.html  money-list.html
terminal/  (same five files)
atelier/   (same five files)
```

| File | Intended viewport |
|---|---|
| check.html | 390 px phone, single column |
| scenario.html | 390 px phone, single column |
| email.html | 640 px canvas (build the real email at 600 px max) |
| snapshot-pdf.html | 816 x 1056 CSS px = US Letter at 96 dpi (612 x 792 pt) |
| money-list.html | desktop 1280 px and up, fluid; stacks below ~900 px |

Default accent per theme: maison #7D5E22, terminal #5FE3B3, atelier #2233E6.

How to use:
- Open in a browser with internet access (fonts load from Google Fonts), or screenshot with Playwright at the viewports above.
- These are visual references, not production code. Do not copy the markup. Take tokens, spacing, structure and copy tone, and implement them through `src/design/` as described in `docs/DESIGN.md`.
- Placeholders: the QR code is a fake pattern, the listing photo is a gray box, the logo is a monogram. All people, companies, NMLS numbers and addresses are fictional.
- Figures: see `docs/DESIGN.md` section 11. The engine (`lib/dscr`) is the source of truth for every number.
