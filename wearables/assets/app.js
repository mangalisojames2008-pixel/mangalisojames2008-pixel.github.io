/* =========================================================
   Shared code for every page: header, footer, cart, product data.
   Settings come from config.js (window.STORE). Products from products.json.
   ========================================================= */
(function () {
  'use strict';
  const S = window.STORE || { name: 'NEXERA', whatsapp: '', payments: {} };
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* R1 199 style: space between thousands, no cents */
  const fmt = n => 'R' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
  const KEY = 'store-cart-v1';
  const cart = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } },
    set(items) {
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private mode: cart lives for this page only */ }
      memory = items; badge();
      document.dispatchEvent(new CustomEvent('cart:change'));
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

  function badge() {
    const n = cart.count();
    $$('.nav__count').forEach(b => { b.textContent = n; b.hidden = !n; });
    $$('.nav__cart').forEach(a => a.setAttribute('aria-label', n ? `Cart, ${n} item${n > 1 ? 's' : ''}` : 'Cart, empty'));
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

  /* the signature: a watch-bezel ring of 60 ticks behind each product */
  function bezel(hot = 0) {
    let t = '';
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0, a = i * 6;
      t += `<line x1="100" y1="${long ? 6 : 9}" x2="100" y2="${long ? 16 : 14}" transform="rotate(${a} 100 100)"${i === hot ? ' class="hot" stroke="currentColor" stroke-width="2"' : ''}/>`;
    }
    return `<svg class="bezel" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g stroke="currentColor" stroke-width="1" stroke-linecap="round">${t}</g><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" stroke-width=".6"/></svg>`;
  }

  const url = p => `product.html?p=${encodeURIComponent(p.slug)}`;

  function card(p) {
    const needsChoice = !!p.options;
    const btn = !p.inStock
      ? '<span class="soldout">Sold out</span>'
      : needsChoice
        ? `<a class="btn btn--ghost card__add" href="${url(p)}">Choose ${esc(p.options.label.toLowerCase())}</a>`
        : `<button class="btn card__add" type="button" data-add="${esc(p.slug)}">Add to cart</button>`;
    return `<article class="card">
      <div class="stage stage--sq">${bezel()}<img class="shot" src="${esc(p.image)}" alt="${esc(p.name)}" width="1000" height="1000" loading="lazy" decoding="async"></div>
      <div class="card__body">
        <h3 class="card__name"><a href="${url(p)}">${esc(p.name)}</a></h3>
        <p class="card__line">${esc(p.description)}</p>
        <div class="card__foot"><span class="price">${fmt(p.price)}</span>${btn}</div>
      </div>
    </article>`;
  }

  let toastT;
  function toast(msg, linkText, href) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = esc(msg) + (linkText ? ` <a href="${esc(href)}">${esc(linkText)}</a>` : '');
    el.classList.add('is-on'); clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('is-on'), 3200);
  }

  /* ---------- header and footer ---------- */
  function header() {
    const el = $('#site-header'); if (!el) return;
    const here = location.pathname.split('/').pop() || 'index.html';
    const c = new URLSearchParams(location.search).get('c');
    const links = [
      ['shop.html?c=watches', 'Watches', here === 'shop.html' && c === 'watches'],
      ['shop.html?c=rings', 'Smart rings', here === 'shop.html' && c === 'rings'],
      ['shop.html?c=cases', 'Watch cases', here === 'shop.html' && c === 'cases'],
      ['index.html#bundle', 'Bundles', false],
      ['delivery.html', 'Delivery', here === 'delivery.html'],
      ['contact.html', 'Contact', here === 'contact.html']
    ];
    const li = links.map(([h, t, on]) => `<li><a href="${h}"${on ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
    el.className = 'nav';
    el.innerHTML = `<div class="nav__in">
      <a class="brand" href="index.html"><img src="assets/mark.svg" alt="" width="28" height="28"><span data-store>${esc(S.name)}</span></a>
      <ul class="nav__links">${li}</ul>
      <a class="nav__cart" href="cart.html" aria-label="Cart">${icons.cart}<span class="nav__count" hidden>0</span></a>
      <button class="nav__menu" type="button" aria-expanded="false" aria-controls="navPanel" aria-label="Menu">${icons.menu}</button>
    </div>
    <nav class="nav__panel" id="navPanel" aria-label="Menu" hidden>${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="shop.html">All products</a></nav>`;
    const btn = $('.nav__menu', el), panel = $('#navPanel', el);
    btn.addEventListener('click', () => {
      const open = panel.hidden; panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open)); btn.innerHTML = open ? icons.close : icons.menu;
    });
    panel.addEventListener('click', e => { if (e.target.closest('a')) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.innerHTML = icons.menu; } });
    badge();
  }

  function footer() {
    const el = $('#site-footer'); if (!el) return;
    el.className = 'footer';
    el.innerHTML = `<div class="wrap">
      <div class="footer__grid">
        <div class="footer__brand">
          <a class="brand" href="index.html"><img src="assets/mark.svg" alt="" width="28" height="28"><span data-store>${esc(S.name)}</span></a>
          <p>Fitness watches, smart rings and watch cases, delivered in South Africa. Order on WhatsApp.</p>
        </div>
        <div><h2>Shop</h2><ul>
          <li><a href="shop.html?c=watches">Watches</a></li><li><a href="shop.html?c=rings">Smart rings</a></li>
          <li><a href="shop.html?c=cases">Watch cases</a></li><li><a href="index.html#bundle">Build a bundle</a></li></ul></div>
        <div><h2>Help</h2><ul>
          <li><a href="delivery.html">Delivery and returns</a></li><li><a href="warranty.html">Warranty</a></li>
          <li><a href="sizer.html">Ring sizer</a></li><li><a href="contact.html">Contact</a></li></ul></div>
        <div><h2>Talk to us</h2><ul>
          <li><a href="${waLink('Hi ' + S.name + ', I have a question.')}" target="_blank" rel="noopener">WhatsApp</a></li>
          ${S.email ? `<li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : ''}</ul></div>
      </div>
      <div class="footer__fine">
        <p>Watches and rings sold here are for fitness and general wellness. They are not medical devices and do not diagnose or treat any condition.</p>
        <p>Xiaomi, Redmi, Colmi and Spovan are trademarks of their owners. <span data-store>${esc(S.name)}</span> is an independent shop and is not linked to these brands.</p>
        <p>Prices in rand, including VAT where it applies. Your cart stays on this device. Details you type at checkout go only into the WhatsApp message you send.</p>
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

  /* fade-and-rise once, when a block scrolls into view */
  function reveals(root = document) {
    const els = $$('.reveal:not(.is-in)', root);
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
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
    try { reveals(); } catch (e) { console.error(e); }
    document.documentElement.classList.add('ready');
  }
  window.addEventListener('storage', badge);

  window.Shop = { S, $, $$, esc, fmt, load, cart, card, bezel, url, toast, icons, waLink, waReady, reveals, badge };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
