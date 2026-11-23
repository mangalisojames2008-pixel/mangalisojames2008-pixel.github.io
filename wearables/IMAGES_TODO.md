# Product photos still needed

The site only shows real product photos. These seven could not be downloaded here, so their cards show a plain plate and the tag "Photo coming soon". Upload each one from your phone (GitHub app: open the `wearables/images/` folder, **Add file**, **Upload files**) with exactly the filename below.

| Product | Where to save the photo from | Upload as |
| --- | --- | --- |
| Colmi P71 smartwatch | Colmi's own site no longer lists the P71. Use your supplier's listing, or the Colmi photos on this listing: https://galaxus.nl/en/s1/product/colmi-smartwatch-p71-black-4550-mm-sports-watches-smartwatches-37518306 | `images/colmi-p71.jpg` |
| Spovan PR3 outdoor sports watch | Spovan's own page (it would not load from my side; try it on your phone): https://www.spovan.com/products-detail-152951. Otherwise your supplier's listing, or https://www.newegg.com/p/3EG-000R-005K7 | `images/spovan-pr3.jpg` |
| Colmi R12 smart ring | Colmi's own site no longer lists the R12. Use your supplier's listing, or the Colmi photos on this listing: https://www.galaxus.de/en/s1/product/colmi-smartring-r12-183mm-8-black-8-black-smart-rings-62433541 | `images/colmi-r12.jpg` |
| Woven nylon strap + case set | Your supplier's listing (a generic product, no maker page) | `images/woven-nylon-strap-case-set.jpg` |
| PU leather travel watch case | Your supplier's listing | `images/pu-leather-travel-watch-case.jpg` |
| Glass-top wooden display box | Your supplier's listing | `images/glass-top-wooden-display-box.jpg` |
| Aluminium watch case (1–3 slots) | Your supplier's listing | `images/aluminium-watch-case.jpg` |

Best photo: the product from the front, on a white or see-through background, at least 1000 px wide. No text or watermarks on it. On a phone, open the listing, tap and hold the main photo, then **Save image** (use the largest version: tap the photo first so it opens full size).

## After you upload

1. In `products.json`, delete the line `"photoPending": true,` from that product. The photo then shows on the shop, product page, cart and bundle builder.
2. The home film then shows its extra scenes by itself: **Outdoor** appears once the Spovan PR3 no longer has `photoPending`, and **Cases** once none of the three cases has it. Until a cut-out exists, the film shows the photo on a light plate.
3. Then ask Claude to make the transparent cut-out (`images/cut/<name>.png`) and the sharp 960 / 1440 / 2160 px versions for 1440p and 4K screens.
