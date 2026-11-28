/* Product card markup, shared by the browser (assets/app.js) and the build script
   (tools/build-cards.js) that writes the cards into the HTML. One template, so the
   cards in the HTML and the cards drawn from products.json are identical. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* R1 199 style: space between thousands, no cents */
  const fmt = n => 'R' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const url = p => `product.html?p=${encodeURIComponent(p.slug)}`;

  /* Sharp photos on 1440p and 4K screens: a product's "hires" list (e.g. [960, 1440, 2160])
     means images/<name>-960.jpg and so on exist next to the photo. */
  function srcAttrs(p, src, sizes) {
    const ws = (p && p.hires) || [];
    if (!ws.length || !/\.jpg$/.test(src)) return `src="${esc(src)}"`;
    const set = ws.map(w => `${esc(src.replace(/\.jpg$/, `-${w}.jpg`))} ${w}w`).join(', ');
    return `src="${esc(src)}" srcset="${set}" sizes="${esc(sizes)}"`;
  }

  /* a short fingerprint of the product data: the page only redraws a card when it changed */
  function sig(p) {
    const s = JSON.stringify(p); let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function card(p) {
    const btn = !p.inStock
      ? '<span class="soldout">Sold out</span>'
      : p.options
        ? `<a class="btn btn--ghost card__add" href="${url(p)}">Choose ${esc(p.options.label.toLowerCase())}</a>`
        : `<button class="btn card__add" type="button" data-add="${esc(p.slug)}">Add to cart</button>`;
    return `<article class="card nx-card" data-cat="${esc(p.category)}" data-sig="${sig(p)}">
      <div class="stage stage--sq"><img class="shot" ${srcAttrs(p, p.image, '(max-width: 760px) 46vw, (min-width: 2400px) 560px, 24vw')} alt="${esc(p.name)}" width="1000" height="1000" loading="lazy" decoding="async"></div>
      <div class="card__body">
        <span class="nx-badge">NEXERA checked</span>
        <h3 class="card__name"><a href="${url(p)}">${esc(p.name)}</a></h3>
        ${p.label ? `<p class="tag">${esc(p.label)}</p>` : ''}
        <p class="card__line">${esc(p.description)}</p>
        <div class="card__foot"><span class="price">${fmt(p.price)}</span>${btn}</div>
      </div>
    </article>`;
  }

  /* fill a grid with cards, but leave it alone when the cards already match (no flash, no layout shift) */
  function fill(grid, list) {
    const want = list.map(sig).join(' ');
    const have = [...grid.querySelectorAll(':scope > .card')].map(c => c.dataset.sig).join(' ');
    if (want !== have) grid.innerHTML = list.map(card).join('');
  }

  /* Which Shopify variant a cart line is. The site's choices ("Gold, ring size 9", "2 slots") are matched to
     Shopify's option values in any order or wording ("9 / Gold", "Two Slots"). With no colour chosen (shop card,
     bundle) it is the colour in the product photo, the first one. Choices Shopify has no variant for come back as
     notes for the order line. Returns { id, notes } or null when nothing matches. */
  const norm = x => String(x).toLowerCase().replace(/^ring size /, '').replace(/\bone\b/g, '1').replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3').replace(/\bslots?\b/g, 'slot').trim();
  function variantFor(p, opt) {
    const sh = (p && p.shopify) || {}, vars = sh.variants || {}, keys = Object.keys(vars);
    const parts = String(opt || '').split(', ').filter(Boolean), want = parts.map(norm);
    if (!keys.length) return sh.variant ? { id: sh.variant, notes: parts } : null;
    const vals = k => k.split(' / ').map(norm);
    const exact = w => keys.find(k => { const ks = vals(k); return ks.every(v => w.includes(v)) && w.every(v => ks.includes(v)); });
    let k = exact(want);
    const cols = (p.colours || []).map(c => c.name);
    if (!k && cols.length && !parts.some(x => cols.includes(x))) k = exact([...want, norm(cols[0])]);
    if (!k) k = keys.find(kk => vals(kk).every(v => want.includes(v)));     /* Shopify varies by fewer choices than the site */
    if (!k) return null;
    const ks = vals(k);
    return { id: vars[k], notes: parts.filter(x => !ks.includes(norm(x))) };
  }

  const api = { esc, fmt, url, srcAttrs, sig, card, fill, variantFor };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ShopCard = api;
})(typeof window !== 'undefined' ? window : globalThis);
