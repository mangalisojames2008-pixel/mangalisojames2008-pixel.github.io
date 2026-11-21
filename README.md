# NEXERA

The public website of NEXERA, a store for iPhone, AirPods, MacBook and Apple Watch. *Shop smarter. Live better.*

This repository holds only the published store and is served by GitHub Pages. It is plain HTML, CSS and JS with no build step.

- Store settings (WhatsApp number, email, address, currency) are in `CONFIG` at the top of `products.js`.
- Products and prices are in `PRODUCTS` in the same file. `price: null` shows "Price on request".
- Tapping a product opens the 3D showcase (`showcase/`). Real `.glb` models can be dropped into `models/` (see `models/README.md`).

To preview it on a computer, serve the folder (the 3D view does not work when the file is opened directly):

    npx serve .

Every change pushed to `main` updates the live site after a minute or two.
