# Embedding the Instant Check

Copy the snippet from **Dashboard → Share & embed**. One line, works on WordPress, Squarespace, Wix, Webflow and GoHighLevel:

```html
<script src="https://YOUR-APP/embed.js" data-broker="harborline" data-lo="maya" async></script>
```

| Attribute | Meaning |
|---|---|
| `data-broker` | Broker slug (required) |
| `data-lo` | Loan officer slug. Leads are owned by this LO and the footer shows their NMLS ID. Omit for the broker's primary LO. |
| `data-height` | Initial height in px (optional; the iframe auto-resizes) |

The script inserts a responsive iframe (`/b/<slug>/embed/check`) and forwards the host page's `utm_*` parameters and URL as the referrer, so leads show where they came from.

**Direct links** work too: `https://YOUR-APP/b/harborline/check?lo=maya&utm_source=instagram`. Prefill is supported (`price=425000&rent=3100&state=TX`) for "run the numbers on this deal" posts.

**No JavaScript?** The page still calculates via a plain GET form.

## Troubleshooting
- Blank space: a site's Content Security Policy may block iframes. Allow `frame-src https://YOUR-APP`.
- Wrong LO on leads: check `data-lo` matches the LO's slug in Settings → Team.
- Suspended account or module turned off: the embed shows a short "unavailable" message instead of the calculator.
