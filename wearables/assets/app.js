/* =========================================================
   Shared code for every page: header, footer, cart, product data.
   Settings come from config.js (window.STORE). Products from products.json.
   ========================================================= */
(function () {
  'use strict';
  const S = window.STORE || { name: 'NEXERA', whatsapp: '', shopify: {} };
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  /* card markup and small helpers live in assets/card.js (shared with tools/build-cards.js) */
  const { esc, fmt, url, srcAttrs, card, fill } = window.ShopCard;

  /* ---------- product data ---------- */
  let dataP = null;
  function load() {
    if (!dataP) {
      dataP = fetch('products.json', { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error('products.json ' + r.status); return r.json(); })
        .then(d => {
          d.bySlug = Object.fromEntries(d.products.map(p => [p.slug, p]));
          d.cat = Object.fromEntries(d.categories.map(c => [c.id, c]));
          return d;
        });
    }
    return dataP;
  }

  /* ---------- cart (kept on this device) ---------- */
  const KEY = 'cart', OLD = 'store-cart-v1';
  try {
    if (!localStorage.getItem(KEY) && localStorage.getItem(OLD)) localStorage.setItem(KEY, localStorage.getItem(OLD));
    localStorage.removeItem(OLD);
  } catch (e) { /* storage blocked */ }
  const cart = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } },
    set(items) {
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private mode: cart lives for this page only */ }
      memory = items; badge();
      window.dispatchEvent(new CustomEvent('cart:change'));   /* ui/nexera-ui.js updates the menu count on this */
    },
    items() { const i = cart.get(); return i.length || !memory ? i : memory; },
    add(slug, opt = '', qty = 1, bundle = '') {
      const items = cart.items();
      const hit = items.find(i => i.slug === slug && (i.opt || '') === opt && (i.bundle || '') === bundle);
      if (hit) hit.qty = Math.min(20, hit.qty + qty); else items.push({ slug, opt, qty, bundle });
      cart.set(items);
    },
    count() { return cart.items().reduce((n, i) => n + i.qty, 0); }
  };
  let memory = null;

  /* cart count on the three-line menu button */
  function badge() {
    const n = cart.count();
    $$('.nx-burger .nx-count').forEach(b => { b.textContent = n > 0 ? n : ''; });
  }

  /* ---------- WhatsApp ---------- */
  const waNumber = () => (S.whatsapp || '').replace(/\D/g, '');
  const waReady = () => /^\d{9,15}$/.test(waNumber()) && !/X/i.test(S.whatsapp || '');
  /* Until the real number is in config.js, links open WhatsApp's "choose a chat" screen */
  const waLink = text => (waReady() ? `https://wa.me/${waNumber()}` : 'https://wa.me/') + (text ? `?text=${encodeURIComponent(text)}` : '');

  /* ---------- small UI bits ---------- */
  const icons = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>'
  };

  /* the signature: a watch-bezel ring of 60 ticks, used only behind the home chapter stage photos */
  function bezel(hot = 0) {
    let t = '';
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0, a = i * 6;
      t += `<line x1="100" y1="${long ? 6 : 9}" x2="100" y2="${long ? 16 : 14}" transform="rotate(${a} 100 100)"${i === hot ? ' class="hot" stroke="currentColor" stroke-width="2"' : ''}/>`;
    }
    return `<svg class="bezel" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g stroke="currentColor" stroke-width="1" stroke-linecap="round">${t}</g><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" stroke-width=".6"/></svg>`;
  }

  /* a photo that has not been uploaded yet: hide the broken image, leave the empty plate */
  document.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('shot')) t.hidden = true;
  }, true);

  let toastT;
  function toast(msg, linkText, href) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = esc(msg) + (linkText ? ` <a href="${esc(href)}">${esc(linkText)}</a>` : '');
    el.classList.add('is-on'); clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('is-on'), 3200);
  }

  /* ---------- header and footer ---------- */
  /* header: the NEXERA logo, top left. Navigation is the three-line menu (ui/menu-snippet.html) in each page. */
  function header() {
    const el = $('#site-header'); if (!el) return;
    el.className = 'nx-head';
    el.innerHTML = `<a class="brand" href="index.html"><img src="assets/mark.svg" alt="" width="28" height="28" decoding="async"><span data-store>${esc(S.name)}</span></a>`;
    badge();
  }

  function footer() {
    const el = $('#site-footer'); if (!el) return;
    el.className = 'footer';
    el.innerHTML = `<div class="wrap">
      <p class="nx-wordmark" aria-hidden="true">${esc(S.name)}</p>
      <div class="footer__grid">
        <div class="footer__brand">
          <a class="brand" href="index.html"><img src="assets/mark.svg" alt="" width="28" height="28" decoding="async"><span data-store>${esc(S.name)}</span></a>
          <p>Fitness watches, smart rings and watch cases, delivered in South Africa.</p>
        </div>
        <div><h2>Shop</h2><ul>
          <li><a href="shop.html?c=watches">Watches</a></li><li><a href="shop.html?c=rings">Smart rings</a></li>
          <li><a href="shop.html?c=cases">Watch cases</a></li><li><a href="index.html#bundle">Build a bundle</a></li></ul></div>
        <div><h2>Help</h2><ul>
          <li><a href="help/">Help centre</a></li><li><a href="help/#delivery">Delivery</a></li><li><a href="help/#returns">Returns and refunds</a></li>
          <li><a href="help/#warranty">Warranty</a></li><li><a href="help/#ring-size">Ring size</a></li><li><a href="help/#contact">Contact</a></li>
          <li><a href="help/#privacy">Privacy</a></li><li><a href="help/#terms">Terms and legal</a></li></ul></div>
        <div><h2>Talk to us</h2><ul>
          <li><a href="${waLink('Hi ' + S.name + ', I have a question.')}" target="_blank" rel="noopener">WhatsApp</a></li>
          ${S.email ? `<li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : ''}</ul></div>
      </div>
      <div class="footer__fine">
        <p>Watches and rings sold here are for fitness and general wellness. They are not medical devices and do not diagnose or treat any condition.</p>
        <p>Product photos from Xiaomi, Colmi, Spovan and our suppliers.</p>
        <p>Xiaomi, Redmi, Colmi and Spovan are trademarks of their owners. <span data-store>${esc(S.name)}</span> is an independent shop and is not linked to these brands.</p>
        <p>Prices in rand, including VAT where it applies. Your cart stays on this device until you check out. Checkout and payment happen on Shopify.</p>
        <p>&copy; ${new Date().getFullYear()} <span data-store>${esc(S.name)}</span></p>
      </div>
    </div>`;
  }

  function names() {
    $$('[data-store]').forEach(e => { e.textContent = S.name; });
    /* settings text from config.js; [BRACKETED] values are owner placeholders and get a highlight */
    $$('[data-cfg]').forEach(e => {
      const v = S[e.dataset.cfg];
      if (v == null || v === '') return;
      e.textContent = v; e.classList.toggle('ph', /^\[.*\]$/.test(String(v)));
    });
    /* WhatsApp links: <a data-wa="message"> */
    $$('[data-wa]').forEach(a => {
      a.href = waLink(a.dataset.wa.replace(/^Hi,/, `Hi ${S.name},`));
      if (!a.querySelector('svg')) a.insertAdjacentHTML('afterbegin', icons.wa);
    });
    const t = document.body.dataset.title;
    document.title = t ? `${t} · ${S.name}` : `${S.name} · Fitness watches and smart rings in South Africa`;
  }

  /* any "Add to cart" button with data-add="slug" */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    e.preventDefault();
    load().then(d => {
      const p = d.bySlug[b.dataset.add]; if (!p || !p.inStock) return;
      cart.add(p.slug, b.dataset.opt || '');
      toast(`${p.name} added`, 'View cart', 'cart.html');
    });
  });

  function start() {
    try { header(); } catch (e) { console.error(e); }
    try { footer(); } catch (e) { console.error(e); }
    try { names(); } catch (e) { console.error(e); }
    /* a cart saved before a product was removed from the shop: drop that product quietly */
    load().then(d => { const it = cart.get(), keep = it.filter(i => d.bySlug[i.slug]); if (keep.length !== it.length) cart.set(keep); }).catch(() => {});
    /* menu labels like "from R599" follow products.json */
    load().then(d => $$('[data-from-label]').forEach(el => {
      const ps = d.products.filter(p => p.category === el.dataset.fromLabel && !p.addon).map(p => p.price);
      if (ps.length) el.textContent = `from ${fmt(Math.min(...ps))}`;
    })).catch(() => {});
    document.documentElement.classList.add('ready');
  }
  window.addEventListener('storage', badge);

  window.Shop = { S, $, $$, esc, fmt, load, cart, card, fill, bezel, url, srcAttrs, toast, icons, waLink, waReady, badge };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
