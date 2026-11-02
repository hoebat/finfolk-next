# Social sharing previews

The default Open Graph and Twitter images are screenshots of the real landing page in **Acid Club**, the site's default theme. Salt Paper captures are available as quieter alternatives. Existing visitor theme preferences are respected by the site; crawlers always receive the public Acid Club sharing cards.

The eight PNGs live in `js/finfolk-next/site/web-main/src/og-{home,discover,people,logbook}-{acid-club,salt-paper}-v1.png`. Each is 1200 × 630 and captures public landing walkthroughs, never member data.

Regenerate after changing the landing design:

```sh
node scripts/capture_social_previews.mjs
OG_THEME=navy-light node scripts/capture_social_previews.mjs
```

The capture script uses Chromium, the actual page styles and illustrations, reduced motion, and a fixed public walkthrough step. It does not add artwork or overlays. No image-generation prompt is used for these final assets.

`backend/social-metadata.mjs` selects the homepage, Discover, People or Logbook card using fixed public metadata. The build writes default metadata into the HTML; the frontend Worker selects the relevant card for application query routes without reflecting tokens, private IDs or search terms. Image URLs are absolute HTTPS URLs so crawlers can fetch them without running JavaScript.
