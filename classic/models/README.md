# Real 3D models (.glb) for the product view

Today every product in the 3D view is built in code (`studio.js` for the outside, `showcase/` for the inside parts).
You can swap in a real model for any product, one part at a time. Parts the file does not include keep the built-in version.

## 1. Start from a template

1. Serve the site folder: `npx serve nexera`
2. Open `http://localhost:3000/tools/export.html` and click the product, for example `watch.glb`.
3. The file has every part named and placed in the resting pose the 3D view uses.

## 2. Replace the shapes in a 3D app

Open the template in Blender (File, Import, glTF 2.0), and for each part:

- Keep the **node name** exactly (for example `battery`). Put your meshes inside that node.
- Keep the node where it is. Units, scale and orientation must stay as in the template: Y is up, the front (screen or face) looks along +Z.
- Name the coloured material **`body`** so the colour swatches recolour it. Name a screen material **`screen`** to keep the animated lock screen (keep the template's UVs on it).
- Delete any part you do not want to replace. It will keep the built-in version.

Export as **glTF Binary (.glb)**.

## 3. Put the file here and switch it on

Save it in this folder (`nexera/models/`) with the name from the table, then set it in that product's settings file:

```js
// nexera/showcase/products/watch.js
models: { watch: { url: 'models/watch.glb' }, ultra: null },
```

Optional fine-tuning if your file is off: `{ url: 'models/watch.glb', scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] }`.

| Product | Kind | File name | Settings file |
| --- | --- | --- | --- |
| Watch Series 12, SE 3 | `watch` | `watch.glb` | `showcase/products/watch.js` |
| Watch Ultra 4 | `ultra` | `watch-ultra.glb` | `showcase/products/watch.js` |
| iPhone 18 Pro, 18 Pro Max | `pro` | `phone-pro.glb` | `showcase/products/phone.js` |
| iPhone Air | `air` | `phone-air.glb` | `showcase/products/phone.js` |
| iPhone 17 | `dual` | `phone-dual.glb` | `showcase/products/phone.js` |
| iPhone 17e | `e` | `phone-e.glb` | `showcase/products/phone.js` |
| iPhone Duo | `duo` | `phone-duo.glb` | `showcase/products/phone.js` |
| MacBook Air 13 and 15 | `mac-air` | `laptop-air.glb` | `showcase/products/mac.js` |
| MacBook Pro 14 and 16 | `mac-pro` | `laptop-pro.glb` | `showcase/products/mac.js` |
| AirPods Pro 3 | `pods-pro` | `earbuds-pro.glb` | `showcase/products/pods.js` |
| AirPods 5 | `pods` | `earbuds.glb` | `showcase/products/pods.js` |
| AirPods Max 2 | `max` | `headphones.glb` | `showcase/products/pods.js` |

## Part names

These are the node names the view looks for. "Look inside" moves each one, in this order.

**Watch:** `cover-glass`, `display`, `main-board`, `battery`, `haptic-motor`, `speaker-mic`, `crown-assembly` (also `crown`, `side-button`), `sensor-array`, `back-glass`, `case-shell` (also `action-button` on Ultra), `band-top`, `band-bottom`

**Phone:** `cover-glass`, `display`, `frame`, `logic-board`, `battery`, `camera-module`, `lens-1`, `lens-2`, `lens-3`, `speakers-haptic`, `charging-coil`, `back-glass`
**Foldable (Duo):** the same, without `charging-coil` and `lens-3`, plus `hinge` and `cover-display`

**Laptop:** `lid` (the hinge, keep its pivot), `keyboard-deck` (also `keyboard`), `logic-board`, `battery`, `fans` (Pro) or `cooling` (Air), `speakers`, `trackpad`, `bottom-case`

**Earbuds:** inside the right earbud (`bud-right`): `ear-tip` (Pro only), `driver` (also `grille`), `audio-board`, `battery`, `microphones` (also `mic-cap`), `sensors`, `antenna`, `outer-shell` (also `bud-shell`, `stem`).
Also replaceable, but not opened up: `case`, `lid` (the case lid, keep its pivot), `case-led`, `bud-left`.

**Headphones (Max):** `cushion-right`, `max-driver`, `max-board`, `max-battery`, `cup-right` (also `controls`), `headband` (also `canopy`). Also replaceable: `cushion-left`, `cup-left`.

Parts that move in the animations (`lid`, the earbud `lid`, `bud-left`) keep their motion: the view keeps the moving pivot and puts your shapes inside it.

## Checking it worked

Open the product in the site. The browser console shows `NEXERA showcase: N parts loaded from models/....glb`.
If the file cannot load, the view falls back to the built-in model and says why in the console.
