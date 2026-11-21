/* =========================================================
   NEXERA | Shop smarter. Live better.
   Plain JavaScript, no build step.
   Store settings and products live in products.js.
   The 3D studio (studio.js + three.js) loads only when someone opens a product.
   ========================================================= */

const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp01 = v => Math.max(0, Math.min(1, v));
const EASE = 'cubic-bezier(.16, 1, .3, 1)';

/* =========================================================
   PRODUCT PICTURES
   Rendered by tools/render.html into assets/products/<art>-<colour>.webp.
   To use your own photos, save them over these files with the same names.
   ========================================================= */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const picOf = (p, c) => `assets/products/${p.art}-${slug(p.colours[c][0])}.webp`;
const altOf = (p, c) => `${p.name} in ${p.colours[c][0]}`;
const preloaded = new Set();
function preload(src) {
  if (preloaded.has(src)) return;
  preloaded.add(src);
  const i = new Image(); i.decoding = 'async'; i.src = src;
}
const preloadAll = p => p.colours.forEach((_, c) => preload(picOf(p, c)));

/* Swap the picture inside a frame with a soft crossfade */
function swapPic(frame, src, alt) {
  const old = $('img.pic.is-on', frame) || $('img.pic', frame);
  if (old && old.getAttribute('src') === src) return;
  const next = new Image();
  next.className = 'pic'; next.alt = alt; next.decoding = 'async'; next.src = src;
  const show = () => {
    frame.appendChild(next);
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-on')));
    if (old) { old.classList.remove('is-on'); old.classList.add('is-out'); setTimeout(() => old.remove(), 700); }
  };
  (next.decode ? next.decode() : Promise.resolve()).then(show, show);
}

/* =========================================================
   STORAGE (per visitor, safe if blocked)
   ========================================================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: bag lasts for this visit only */ } }
};

/* =========================================================
   PRICES
   ========================================================= */
const money = (n) => {
  try { return new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency, maximumFractionDigits: 0 }).format(n); }
  catch { return 'R ' + Math.round(n).toLocaleString(); }
};
function priceOf(p, opt) {
  if (p.price == null) return null;
  if (typeof p.price === 'number') return p.price;
  return p.price[opt] ?? null;
}
function priceHTML(p, opt) {
  const v = priceOf(p, opt);
  return v == null ? 'Price on request<small>Confirmed when you order</small>' : `${money(v)}<small>${esc(opt || '')}</small>`;
}

/* =========================================================
   STATE
   ========================================================= */
const state = {
  filter: 'all',
  pick: {},                       // id -> { colour index, option index }
  bag: store.get('nexera-bag-v1', [])
};
state.bag = Array.isArray(state.bag) ? state.bag.filter(i => byId[i.id]) : [];
const pickOf = (id) => (state.pick[id] = state.pick[id] || { c: (byId[id] && byId[id].start) || 0, o: 0 });

/* =========================================================
   SMOOTH SCROLL (Lenis). Touch keeps the phone's own scrolling.
   ========================================================= */
let lenis = null;
function initSmoothScroll() {
  if (reduceMotion.matches || typeof Lenis === 'undefined') return;
  try {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  } catch { lenis = null; }
}
const navOffset = () => -(($('.nav')?.offsetHeight || 64) + 8);
function scrollToTarget(target) {
  const el = typeof target === 'string' ? (target === '#top' ? null : $(target)) : target;
  if (lenis) { lenis.scrollTo(el || 0, { offset: el ? navOffset() : 0, duration: 1.4 }); return; }
  if (!el) { window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); return; }
  const y = el.getBoundingClientRect().top + window.scrollY + navOffset();
  window.scrollTo({ top: y, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}
const lockScroll = on => {
  document.body.classList.toggle('is-locked', on);
  if (lenis) on ? lenis.stop() : lenis.start();
};

/* =========================================================
   FAMILIES
   ========================================================= */
const FAMILY_PIC = { iphone: ['iphone-18-pro', 0], airpods: ['airpods-pro-3', 0], mac: ['macbook-air-13', 0], watch: ['watch-series-12', 2] };
const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderFamilies() {
  $('#families').innerHTML = Object.entries(FAMILIES).map(([key, f], i) => {
    const count = PRODUCTS.filter(p => p.family === key).length;
    const [id, c] = FAMILY_PIC[key], p = byId[id];
    return `<a class="fam reveal" href="#shop" data-filter-link="${key}" style="--d:${i * 90}ms">
      <div class="fam__art"><img src="${picOf(p, c)}" alt="${esc(altOf(p, c))}" loading="lazy" decoding="async"></div>
      <h3>${f.name}</h3>
      <p>${f.line}</p>
      <div class="fam__foot"><span class="fam__count">${count} models</span><span class="fam__go">${arrow}</span></div>
    </a>`;
  }).join('');
}

/* =========================================================
   SHOP GRID
   ========================================================= */
const view3d = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

function cardHTML(p) {
  const pk = pickOf(p.id);
  const colour = p.colours[pk.c];
  const opt = p.option ? p.option.values[pk.o] : '';
  const swatches = p.colours.map(([n, hex], i) =>
    `<button type="button" class="swatch" role="radio" aria-checked="${i === pk.c}" aria-label="${esc(n)}" title="${esc(n)}" data-c="${i}" style="--sw:${hex}"></button>`).join('');
  const chips = p.option ? `<div class="opt"><span class="opt__label">${esc(p.option.label)}</span>
      <div class="chips" role="radiogroup" aria-label="${esc(p.option.label)}">${p.option.values.map((v, i) =>
        `<button type="button" class="chip" role="radio" aria-checked="${i === pk.o}" data-o="${i}">${esc(v)}</button>`).join('')}</div></div>` : '';
  return `<article class="card" id="p-${p.id}" data-id="${p.id}" data-family="${p.family}">
    <button type="button" class="card__art" data-view aria-label="View ${esc(p.name)} in 3D">
      <span class="card__frame"><img class="pic is-on" src="${picOf(p, pk.c)}" alt="${esc(altOf(p, pk.c))}" loading="lazy" decoding="async"></span>
      ${p.isNew ? '<span class="badge">New</span>' : ''}
      <span class="card__view">${view3d}<span>View in 3D</span></span>
    </button>
    <div class="card__body">
      <p class="label">${FAMILIES[p.family].name}</p>
      <h3><button type="button" class="card__name" data-view>${esc(p.name)}</button></h3>
      <p class="card__tag">${esc(p.tag)}</p>
      <ul class="card__facts">${p.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="opt"><span class="opt__label">Colour · <b data-colour-name>${esc(colour[0])}</b></span>
        <div class="swatches" role="radiogroup" aria-label="Colour">${swatches}</div></div>
      ${chips}
      <div class="card__foot">
        <span class="price" data-price>${priceHTML(p, opt)}</span>
        <button type="button" class="btn btn--dark btn--sm add" data-add>Add to bag</button>
      </div>
    </div>
  </article>`;
}

function renderGrid() {
  $('#grid').innerHTML = PRODUCTS.map(cardHTML).join('');
  applyFilter(state.filter, false);
}

/* Filter with FLIP: cards that stay glide to their new place, new ones rise in */
function applyFilter(f, animate = true) {
  state.filter = f;
  $$('#filters button').forEach(b => {
    const on = b.dataset.filter === f;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on);
  });
  const cards = $$('#grid .card');
  const doAnim = animate && !reduceMotion.matches && 'animate' in Element.prototype;
  const first = new Map();
  if (doAnim) cards.forEach(c => { if (!c.hidden) first.set(c, c.getBoundingClientRect()); });
  cards.forEach(c => { c.hidden = !(f === 'all' || c.dataset.family === f); });
  if (!doAnim) return;
  let i = 0;
  cards.forEach(c => {
    if (c.hidden) return;
    const last = c.getBoundingClientRect(), was = first.get(c);
    if (was) {
      const dx = was.left - last.left, dy = was.top - last.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 750, easing: EASE });
    } else {
      c.animate([{ opacity: 0, transform: 'translateY(34px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: Math.min(i++, 8) * 55, easing: EASE, fill: 'backwards' });
    }
  });
}

function onCardClick(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  const p = byId[card.dataset.id];
  const pk = pickOf(p.id);
  const sw = e.target.closest('.swatch');
  const chip = e.target.closest('.chip');
  if (sw) {
    pk.c = +sw.dataset.c;
    swapPic($('.card__frame', card), picOf(p, pk.c), altOf(p, pk.c));
    $$('.swatch', card).forEach(b => b.setAttribute('aria-checked', b === sw));
    $('[data-colour-name]', card).textContent = p.colours[pk.c][0];
  } else if (chip) {
    pk.o = +chip.dataset.o;
    $$('.chip', card).forEach(b => b.setAttribute('aria-checked', b === chip));
    $('[data-price]', card).innerHTML = priceHTML(p, p.option.values[pk.o]);
  } else if (e.target.closest('[data-add]')) {
    const btn = e.target.closest('[data-add]');
    addToBag(p.id, pk.c, pk.o);
    flashAdded(btn);
  } else if (e.target.closest('[data-view]')) {
    openView(p.id, $('.card__frame img.is-on', card) || $('.card__frame img', card));
  }
}
function flashAdded(btn, label = 'Add to bag') {
  btn.classList.add('is-added');
  btn.textContent = 'Added';
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.classList.remove('is-added'); btn.textContent = label; }, 1400);
}

/* Arrow keys move between radio buttons in a group */
function radioKeys(e) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  const r = e.target.closest('[role="radio"]');
  if (!r) return;
  const group = [...r.parentElement.querySelectorAll('[role="radio"]')];
  const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
  const next = group[(group.indexOf(r) + dir + group.length) % group.length];
  e.preventDefault();
  next.focus();
  next.click();
}

/* Cards lean gently towards the pointer */
function initTilt() {
  if (!finePointer.matches || reduceMotion.matches) return;
  const grid = $('#grid');
  grid.addEventListener('pointermove', e => {
    const art = e.target.closest('.card__art');
    if (!art) return;
    const r = art.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    art.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
    art.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
    art.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    art.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  grid.addEventListener('pointerout', e => {
    const art = e.target.closest('.card__art');
    if (art && !art.contains(e.relatedTarget)) { art.style.setProperty('--rx', '0deg'); art.style.setProperty('--ry', '0deg'); }
  });
  grid.addEventListener('pointerover', e => {
    const card = e.target.closest('.card');
    if (card) preloadAll(byId[card.dataset.id]);
  });
}

/* =========================================================
   SPOTLIGHT
   ========================================================= */
function renderSpotlight() {
  const p = byId[CONFIG.spotlight] || PRODUCTS[0];
  const frame = $('#spotArt');
  const pk = pickOf(p.id);
  frame.innerHTML = `<img class="pic is-on" src="${picOf(p, pk.c)}" alt="${esc(altOf(p, pk.c))}" loading="lazy" decoding="async">`;
  $('#spotLabel').textContent = p.isNew ? 'In the spotlight · New' : 'In the spotlight';
  $('#spotTitle').textContent = p.name;
  $('#spotLede').textContent = p.tag;
  const facts = p.id === 'iphone-duo'
    ? [['7.6″', 'inner folding display'], ['5.4″', 'outer display'], ['5.2 mm', 'thin when open'], ['A20 Pro', 'chip inside']]
    : p.facts.slice(0, 4).map(f => [f.split(' ')[0], f.split(' ').slice(1).join(' ')]);
  $('#spotFacts').innerHTML = facts.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join('');
  const sw = $('#spotSwatches');
  sw.innerHTML = p.colours.map(([n, hex], i) =>
    `<button type="button" class="swatch" role="radio" aria-checked="${i === pk.c}" aria-label="${esc(n)}" title="${esc(n)}" data-c="${i}" style="--sw:${hex}"></button>`).join('') +
    `<span class="spotlight__swatch-name" id="spotName">${esc(p.colours[pk.c][0])}</span>`;
  p.colours.forEach((_, c) => preload(picOf(p, c)));
  sw.addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    pk.c = +b.dataset.c;
    swapPic(frame, picOf(p, pk.c), altOf(p, pk.c));
    $$('.swatch', sw).forEach(x => x.setAttribute('aria-checked', x === b));
    $('#spotName').textContent = p.colours[pk.c][0];
    const card = $(`#p-${p.id}`);
    if (card) { swapPic($('.card__frame', card), picOf(p, pk.c), altOf(p, pk.c)); $$('.swatch', card).forEach(x => x.setAttribute('aria-checked', +x.dataset.c === pk.c)); $('[data-colour-name]', card).textContent = p.colours[pk.c][0]; }
  });
  const go = $('#spotCta');
  go.textContent = p.id === 'iphone-duo' ? 'Watch it unfold in 3D' : `See ${p.name} in 3D`;
  go.addEventListener('click', e => { e.preventDefault(); openView(p.id, $('img.is-on', frame) || $('img', frame)); });
}

/* =========================================================
   COMPARE
   ========================================================= */
const cmp = { family: 'iphone' };
function fillCompareSelects() {
  const list = PRODUCTS.filter(p => p.family === cmp.family);
  const opts = list.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#cmpA').innerHTML = opts;
  $('#cmpB').innerHTML = opts;
  $('#cmpA').value = list[0].id;
  $('#cmpB').value = (list[1] || list[0]).id;
  renderCompare();
}
function renderCompare() {
  const a = byId[$('#cmpA').value], b = byId[$('#cmpB').value];
  const keys = [...new Set([...Object.keys(a.specs), ...Object.keys(b.specs)])];
  const head = (p) => { const c = pickOf(p.id).c; return `<dd><button type="button" class="cmp__pic" data-cmp-view="${p.id}" aria-label="View ${esc(p.name)} in 3D"><img src="${picOf(p, c)}" alt="${esc(altOf(p, c))}" loading="lazy" decoding="async"></button><strong>${esc(p.name)}</strong>
      <button type="button" class="btn btn--line btn--sm" data-cmp-add="${p.id}">Add to bag</button></dd>`; };
  const dots = (p) => `<div class="cmp__dots">${p.colours.map(([n, h]) => `<i style="--sw:${h}" title="${esc(n)}"></i>`).join('')}</div>`;
  const rows = keys.map(k => {
    const va = a.specs[k] ?? 'Not listed', vb = b.specs[k] ?? 'Not listed';
    return `<div class="cmp__row ${va !== vb && a !== b ? 'is-diff' : ''}"><dt>${esc(k)}</dt><dd>${esc(va)}</dd><dd>${esc(vb)}</dd></div>`;
  }).join('');
  const colourRow = `<div class="cmp__row ${a.colours.length !== b.colours.length && a !== b ? 'is-diff' : ''}"><dt>Colours</dt>
      <dd>${a.colours.length} ${dots(a)}</dd><dd>${b.colours.length} ${dots(b)}</dd></div>`;
  const table = $('#cmpTable');
  table.innerHTML = `<dl class="cmp"><div class="cmp__row cmp__head"><dt>Model</dt>${head(a)}${head(b)}</div>${rows}${colourRow}</dl>`;
  if (!reduceMotion.matches && table.animate) table.animate([{ opacity: 0.4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE });
}
function initCompare() {
  $('#cmpFamily').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    cmp.family = b.dataset.family;
    $$('#cmpFamily button').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); });
    fillCompareSelects();
  });
  $('#cmpA').addEventListener('change', renderCompare);
  $('#cmpB').addEventListener('change', renderCompare);
  $('#cmpTable').addEventListener('click', e => {
    const add = e.target.closest('[data-cmp-add]');
    if (add) { const pk = pickOf(add.dataset.cmpAdd); addToBag(add.dataset.cmpAdd, pk.c, pk.o); flashAdded(add); return; }
    const v = e.target.closest('[data-cmp-view]');
    if (v) openView(v.dataset.cmpView, $('img', v));
  });
  fillCompareSelects();
}

/* =========================================================
   BAG
   ========================================================= */
function saveBag() { store.set('nexera-bag-v1', state.bag); }
function itemLine(i) {
  const p = byId[i.id];
  const parts = [p.colours[i.c]?.[0], p.option ? p.option.values[i.o] : null].filter(Boolean);
  return { p, meta: parts.join(', ') };
}
function addToBag(id, c, o) {
  const found = state.bag.find(i => i.id === id && i.c === c && i.o === o);
  if (found) found.q += 1; else state.bag.push({ id, c, o, q: 1 });
  saveBag();
  renderBag();
  const count = $('#bagCount');
  count.classList.remove('is-bump'); void count.offsetWidth; count.classList.add('is-bump');
  toast(`${byId[id].name} added to your bag`);
}
function renderBag() {
  const n = state.bag.reduce((s, i) => s + i.q, 0);
  $('#bagCount').textContent = n;
  $('#bagOpen').setAttribute('aria-label', `Bag, ${n} item${n === 1 ? '' : 's'}`);
  $('#bagEmpty').hidden = n > 0;
  $('#bagFoot').hidden = n === 0;
  $('#bagList').innerHTML = state.bag.map((i, idx) => {
    const { p, meta } = itemLine(i);
    const v = priceOf(p, p.option ? p.option.values[i.o] : null);
    return `<li class="bag__item" data-idx="${idx}">
      <div class="bag__thumb"><img src="${picOf(p, i.c)}" alt="" loading="lazy" decoding="async"></div>
      <div><h3>${esc(p.name)}</h3><p class="bag__meta">${esc(meta)}</p><p class="bag__meta">${v == null ? 'Price on request' : money(v * i.q)}</p></div>
      <div class="bag__side">
        <div class="qty"><button type="button" data-q="-1" aria-label="One less ${esc(p.name)}">−</button><span aria-live="polite">${i.q}</span><button type="button" data-q="1" aria-label="One more ${esc(p.name)}">+</button></div>
        <button type="button" class="remove" data-remove>Remove</button>
      </div>
    </li>`;
  }).join('');
  const prices = state.bag.map(i => { const p = byId[i.id]; const v = priceOf(p, p.option ? p.option.values[i.o] : null); return v == null ? null : v * i.q; });
  $('#bagTotal').textContent = prices.length && prices.every(v => v != null) ? money(prices.reduce((a, b) => a + b, 0)) : 'Price on request';

  const wa = $('#sendWa'), mail = $('#sendMail');
  wa.hidden = !CONFIG.whatsapp;
  mail.hidden = !CONFIG.email;
  const emailIsMain = !!CONFIG.email && !CONFIG.whatsapp;
  mail.classList.toggle('btn--dark', emailIsMain);
  mail.classList.toggle('btn--line', !emailIsMain);
  $('#bagNote').textContent = (CONFIG.whatsapp || CONFIG.email)
    ? 'Nothing is paid here. NEXERA replies to confirm price and stock.'
    : 'Online ordering opens soon. For now, tap Copy list to save your choices.';
}
function orderText() {
  const lines = state.bag.map((i, n) => { const { p, meta } = itemLine(i); return `${n + 1}. ${p.name}${meta ? ', ' + meta : ''} (x${i.q})`; });
  return `Hi NEXERA, I would like to order:\n\n${lines.join('\n')}\n\nPlease confirm the price and stock. Thank you.`;
}

const OUTSIDE = ['main', 'header', 'footer'];
let lastFocus = null;
function openBag() {
  lastFocus = document.activeElement;
  const bag = $('#bag'), scrim = $('#scrim');
  scrim.hidden = false;
  requestAnimationFrame(() => { scrim.classList.add('is-on'); bag.classList.add('is-open'); });
  bag.setAttribute('aria-hidden', 'false');
  $('#bagOpen').setAttribute('aria-expanded', 'true');
  OUTSIDE.forEach(s => { $(s).inert = true; });
  lockScroll(true);
  setTimeout(() => $('#bagClose').focus(), 60);
}
function closeBag() {
  const bag = $('#bag'), scrim = $('#scrim');
  if (!bag.classList.contains('is-open')) return;
  bag.classList.remove('is-open');
  scrim.classList.remove('is-on');
  bag.setAttribute('aria-hidden', 'true');
  $('#bagOpen').setAttribute('aria-expanded', 'false');
  OUTSIDE.forEach(s => { $(s).inert = false; });
  lockScroll(false);
  setTimeout(() => { scrim.hidden = true; }, 400);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
function initBag() {
  $('#bagOpen').addEventListener('click', openBag);
  $$('[data-open-bag]').forEach(b => b.addEventListener('click', openBag));
  $('#bagClose').addEventListener('click', closeBag);
  $('#scrim').addEventListener('click', closeBag);
  $$('[data-close-bag]').forEach(b => b.addEventListener('click', closeBag));
  $('#bagList').addEventListener('click', e => {
    const li = e.target.closest('.bag__item');
    if (!li) return;
    const idx = +li.dataset.idx;
    const q = e.target.closest('[data-q]');
    if (q) {
      state.bag[idx].q += +q.dataset.q;
      if (state.bag[idx].q < 1) state.bag.splice(idx, 1);
    } else if (e.target.closest('[data-remove]')) {
      state.bag.splice(idx, 1);
    } else return;
    saveBag(); renderBag();
    if (!state.bag.length) $('#bagClose').focus();
  });
  $('#sendWa').addEventListener('click', () => {
    if (!CONFIG.whatsapp) return toast('WhatsApp ordering opens soon. Copy your list for now.');
    window.open(`https://wa.me/${CONFIG.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(orderText())}`, '_blank', 'noopener');
  });
  $('#sendMail').addEventListener('click', () => {
    if (!CONFIG.email) return toast('Email ordering opens soon. Copy your list for now.');
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Order from the NEXERA website')}&body=${encodeURIComponent(orderText())}`;
  });
  $('#copyList').addEventListener('click', async () => {
    const text = orderText();
    try { await navigator.clipboard.writeText(text); toast('Your list is copied'); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Your list is copied'); } catch { toast('Copy did not work on this device'); }
      ta.remove();
    }
  });
  renderBag();
}

/* =========================================================
   PRODUCT VIEW: the live 3D display
   ========================================================= */
/* The 3D showcase (showcase/showcase.js, three.js and GSAP) is only downloaded when a product view opens.
   The still picture shows until it is ready. */
let studioPromise = null;
function warmStudio() {
  if (!studioPromise) studioPromise = import('./showcase/showcase.js').catch(err => { console.warn('NEXERA: the 3D view could not load.', err); return null; });
  return studioPromise;
}
const pv = { el: null, sc: null, product: null, opener: null, token: 0, closeT: 0, allow3d: false };
const SLOW_3D = 12000;   // ms: after this the view stops waiting and keeps the picture
const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
const setPanelHeight = () => { const panel = $('#pvPanel'); panel.style.setProperty('--ph', panel.clientHeight + 'px'); };
const viewEls = () => ({
  root: pv.el, panel: $('#pvPanel'), layer: $('#pvLayer'), glow: $('#pvGlow'), word: $('#pvWord'), lines: $('#pvLines'), labels: $('#pvLabels'),
  stage: $('#pvStage'), info: $('#pvInfo'), story: $('#pvStory'), tools: $('#pvTools'), views: $('#pvViews'),
  inside: $('#pvInside'), lid: $('#pvLid'), replay: $('#pvReplay'), part: $('#pvPart'), partClose: $('#pvPartClose'), cue: $('#pvCue')
});
const viewHooks = () => ({
  families: FAMILIES, products: PRODUCTS,
  pickColour: i => selectColour(i),
  add: btn => { const p = pv.product, pk = pickOf(p.id); addToBag(p.id, pk.c, pk.o); flashAdded(btn); },
  price: () => { const p = pv.product, pk = pickOf(p.id); return priceHTML(p, p.option ? p.option.values[pk.o] : ''); }
});

function fillView(p) {
  const pk = pickOf(p.id);
  $('#pvFamily').textContent = FAMILIES[p.family].name + (p.isNew ? ' · New' : '');
  $('#pvName').textContent = p.name;
  $('#pvTag').textContent = p.tag;
  $('#pvFacts').innerHTML = p.facts.map((f, i) => `<li style="--d:${600 + i * 120}ms">${esc(f)}</li>`).join('');
  $('#pvColour').textContent = p.colours[pk.c][0];
  $('#pvSwatches').innerHTML = p.colours.map(([n, hex], i) =>
    `<button type="button" class="swatch" role="radio" aria-checked="${i === pk.c}" aria-label="${esc(n)}" title="${esc(n)}" data-c="${i}" style="--sw:${hex}"></button>`).join('');
  const wrap = $('#pvOptWrap');
  wrap.hidden = !p.option;
  if (p.option) {
    $('#pvOptLabel').textContent = p.option.label;
    $('#pvChips').setAttribute('aria-label', p.option.label);
    $('#pvChips').innerHTML = p.option.values.map((v, i) => `<button type="button" class="chip" role="radio" aria-checked="${i === pk.o}" data-o="${i}">${esc(v)}</button>`).join('');
  }
  $('#pvPrice').innerHTML = priceHTML(p, p.option ? p.option.values[pk.o] : '');
  const still = $('#pvStill');
  still.src = picOf(p, pk.c); still.alt = altOf(p, pk.c);
}

async function openView(id, fromImg) {
  const p = byId[id];
  const el = pv.el;
  clearTimeout(pv.closeT);
  pv.sc?.close();
  pv.product = p; pv.opener = document.activeElement; pv.token++;
  const token = pv.token;
  fillView(p);
  el.hidden = false;
  el.classList.remove('is-3d', 'is-static', 'is-closing', 'can-load-3d');
  if (!reduceMotion.matches) el.classList.add('is-sc-wait');   // the entrance reveals the text; with reduced motion it simply shows
  $('#pvPanel').scrollTop = 0;
  setPanelHeight();
  OUTSIDE.forEach(s => { $(s).inert = true; });
  lockScroll(true);
  requestAnimationFrame(() => el.classList.add('is-open'));
  setTimeout(() => $('#pvClose').focus({ preventScroll: true }), 80);

  // the picture flies from where it was tapped into the stage
  const still = $('#pvStill');
  if (fromImg && fromImg.getBoundingClientRect && !reduceMotion.matches && still.animate) {
    const a = fromImg.getBoundingClientRect();
    await new Promise(r => requestAnimationFrame(r));
    const b = still.getBoundingClientRect();
    if (a.width && b.width) {
      const s = a.width / b.width;
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      still.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], { duration: 760, easing: EASE });
    }
  }

  // on data saver or a very slow connection, keep the picture and offer the 3D view instead of downloading it
  if (saveData() && !pv.allow3d) { staticView(); el.classList.add('can-load-3d'); return; }
  const slow = setTimeout(() => { if (token === pv.token && !el.classList.contains('is-3d')) staticView(); }, SLOW_3D);
  const mod = await warmStudio();
  clearTimeout(slow);
  if (token !== pv.token || el.hidden) return;
  if (!mod) { staticView(); return; }
  el.classList.remove('is-static');   // it arrived after all
  try {
    if (!pv.sc) pv.sc = new mod.Showcase(viewEls(), viewHooks());
    await pv.sc.open(p, pickOf(p.id), { reduced: reduceMotion.matches });
  } catch (err) {
    console.warn('NEXERA: the 3D view could not start.', err);
    try { pv.sc?.close(); } catch { /* already closed */ }
    if (token === pv.token) staticView();
  }
}
/* Without 3D (no WebGL, or the files failed to load): the still picture stays. */
function staticView() { pv.el.classList.remove('is-sc-wait', 'is-3d'); pv.el.classList.add('is-static'); }

/* One colour choice, kept in step everywhere: the view, the story swatches, the 3D product and the card. */
function selectColour(i) {
  const p = pv.product, pk = pickOf(p.id);
  pk.c = i;
  $$('#pvSwatches .swatch').forEach(x => x.setAttribute('aria-checked', String(+x.dataset.c === i)));
  $('#pvColour').textContent = p.colours[i][0];
  $('#pvStill').src = picOf(p, i);
  pv.sc?.setColour(i);
  const card = $(`#p-${p.id}`);
  if (card) {
    swapPic($('.card__frame', card), picOf(p, i), altOf(p, i));
    $$('.swatch', card).forEach(x => x.setAttribute('aria-checked', +x.dataset.c === i));
    $('[data-colour-name]', card).textContent = p.colours[i][0];
  }
}

function closeView() {
  const el = pv.el;
  if (el.hidden || el.classList.contains('is-closing')) return;
  pv.token++;
  el.classList.add('is-closing');
  el.classList.remove('is-open');
  OUTSIDE.forEach(s => { $(s).inert = false; });
  lockScroll(false);
  clearTimeout(pv.closeT);
  pv.closeT = setTimeout(() => {
    pv.sc?.close();
    el.hidden = true;
    el.classList.remove('is-closing', 'is-3d', 'is-static', 'is-sc-wait');
  }, 520);
  const back = pv.opener;
  if (back && document.contains(back)) back.focus({ preventScroll: true });
}

function initView() {
  pv.el = $('#pv');
  $('#pvClose').addEventListener('click', closeView);
  $('#pvBackdrop').addEventListener('click', closeView);
  // Replay, Look inside, the angle buttons and dragging are handled by the showcase.
  $('#pvSwatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (b) selectColour(+b.dataset.c);
  });
  $('#pvChips').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const p = pv.product, pk = pickOf(p.id);
    pk.o = +b.dataset.o;
    $$('#pvChips .chip').forEach(x => x.setAttribute('aria-checked', x === b));
    $('#pvPrice').innerHTML = priceHTML(p, p.option.values[pk.o]);
    const card = $(`#p-${p.id}`);
    if (card) { $$('.chip', card).forEach(x => x.setAttribute('aria-checked', +x.dataset.o === pk.o)); $('[data-price]', card).innerHTML = priceHTML(p, p.option.values[pk.o]); }
    pv.sc?.setOption();
  });
  $('#pvAdd').addEventListener('click', e => { const p = pv.product, pk = pickOf(p.id); addToBag(p.id, pk.c, pk.o); flashAdded(e.currentTarget); });
  $('#pvLoad3d').addEventListener('click', () => { pv.allow3d = true; openView(pv.product.id); });
  window.addEventListener('resize', () => { if (!pv.el.hidden) setPanelHeight(); });
}

/* =========================================================
   TOAST
   ========================================================= */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 2600);
}

/* =========================================================
   CONTACT (footer): shows only what has been filled in
   ========================================================= */
function renderContact() {
  const rows = [];
  if (CONFIG.whatsapp) rows.push(`<a href="https://wa.me/${CONFIG.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (CONFIG.phone) rows.push(`<a href="tel:${esc(CONFIG.phone.replace(/\s/g, ''))}">${esc(CONFIG.phone)}</a>`);
  if (CONFIG.email) rows.push(`<a href="mailto:${esc(CONFIG.email)}">${esc(CONFIG.email)}</a>`);
  if (CONFIG.instagram) rows.push(`<a href="${esc(CONFIG.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
  if (CONFIG.address) rows.push(`<p>${esc(CONFIG.address)}</p>`);
  if (CONFIG.hours) rows.push(`<p>${esc(CONFIG.hours)}</p>`);
  $('#contact').innerHTML = rows.length
    ? `<h3>Get in touch</h3>${rows.join('')}`
    : `<h3>Shop</h3><a href="#shop">Browse the range</a><a href="#order">How ordering works</a><button type="button" class="btn btn--ghost btn--sm" data-open-bag style="margin-top:8px">Open your bag</button>`;
  $$('[data-open-bag]', $('#contact')).forEach(b => b.addEventListener('click', openBag));
}

/* Page text names only the ways of ordering that are switched on */
function renderChannels() {
  const ways = [CONFIG.whatsapp && 'on WhatsApp', CONFIG.email && 'by email'].filter(Boolean);
  const buttons = [CONFIG.whatsapp && '<strong>Send on WhatsApp</strong>', CONFIG.email && '<strong>Send by email</strong>'].filter(Boolean);
  if (!ways.length) return;
  $$('[data-channels]').forEach(el => { el.textContent = ways.join(' or '); });
  $$('[data-send-buttons]').forEach(el => { el.innerHTML = buttons.join(' or '); });
}

/* =========================================================
   NAV
   ========================================================= */
function initNav() {
  const nav = $('.nav');
  const btn = $('#menuBtn');
  btn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open);
  });
  $$('#navMenu a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }));

  // in-page links glide instead of jumping
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-filter-link]');
    if (link) applyFilter(link.dataset.filterLink);
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute('href');
    if (href.length < 2 && href !== '#') return;
    if (href !== '#top' && !$(href)) return;
    e.preventDefault();
    if (pv.el && !pv.el.hidden) closeView();
    if ($('#bag').classList.contains('is-open')) closeBag();
    scrollToTarget(href);
  });
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) applyFilter(b.dataset.filter);
  });

  const lightSections = $$('.families, .shop, .compare, .faq');
  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > 40);
    const probe = 32;
    const light = lightSections.some(s => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
    nav.classList.toggle('is-light', light);
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* =========================================================
   REVEAL ON SCROLL: headings rise word by word, blocks ease in
   ========================================================= */
function splitWords(h) {
  if ([...h.children].some(c => c.tagName !== 'BR')) return;
  const parts = h.innerHTML.split(/(<br\s*\/?>)/i);
  let i = 0;
  h.innerHTML = parts.map(part => /^<br/i.test(part) ? part : part.split(/(\s+)/).map(w => (w.trim() ? `<span class="w"><span style="--i:${i++}">${w}</span></span>` : w)).join('')).join('');
  h.classList.add('split');
}
function initReveal() {
  $$('.section__head h2, .shop__head h2, .spotlight h2').forEach(splitWords);
  const els = $$('.reveal, .split');
  if (!('IntersectionObserver' in window) || reduceMotion.matches) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  els.forEach(e => io.observe(e));
}

/* Gentle depth: a few elements drift as you scroll past */
function initParallax() {
  if (reduceMotion.matches) return;
  const items = $$('[data-parallax]').map(el => ({ el, k: parseFloat(el.dataset.parallax) || 0.1 }));
  if (!items.length) return;
  let ticking = false;
  const run = () => {
    ticking = false;
    const vh = window.innerHeight;
    items.forEach(({ el, k }) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const mid = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0, ${(mid * k * -100).toFixed(2)}px, 0)`;
    });
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  run();
}

/* =========================================================
   MARQUEE: drifts on its own, speeds up and turns with your scroll
   ========================================================= */
function initMarquee() {
  const track = $('#marquee');
  track.innerHTML += track.innerHTML + track.innerHTML;
  if (reduceMotion.matches) return;
  let x = 0, dir = -1, boost = 0, lastY = window.scrollY, last = performance.now(), visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(track);
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastY; lastY = window.scrollY;
    if (dy) dir = dy > 0 ? -1 : 1;
    boost = Math.min(boost + Math.abs(dy) * 0.6, 900);
  }, { passive: true });
  const tick = (t) => {
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (visible) {
      const third = track.scrollWidth / 3;
      x += dir * (50 + boost) * dt;
      if (x <= -third) x += third;
      if (x > 0) x -= third;
      track.style.transform = `translate3d(${x}px,0,0)`;
    }
    boost *= Math.pow(0.02, dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* =========================================================
   HERO SCROLL STORY
   The four devices orbit in around the NEXERA mark, then settle
   beside the motto. Scroll sets a target; the scene eases towards it.
   ========================================================= */
const HERO_PIC = { mac: 'assets/hero/mac.webp', phone: 'assets/hero/phone.webp', watch: 'assets/hero/watch.webp', pods: 'assets/hero/pods.webp' };
const HERO_ALT = { mac: 'MacBook Air', phone: 'iPhone', watch: 'Apple Watch', pods: 'AirPods Pro' };

/* Final resting places, as fractions of the stage (x of width, y of height, from the centre). */
const LAYOUT = {
  wide: { center: [0.25, 0.02], mac: [0.27, -0.08, 0], phone: [0.1, 0.1, -5], watch: [0.43, 0.12, 6], pods: [0.29, 0.24, 0] },
  tall: { center: [0, 0.26], mac: [0.06, 0.19, 0], phone: [-0.28, 0.27, -5], watch: [0.33, 0.28, 6], pods: [0.05, 0.37, 0] }
};
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);

function initHero() {
  const hero = $('#hero');
  const devs = $$('.dev', hero);
  devs.forEach(d => { d.innerHTML = `<div class="dev__in"><img src="${HERO_PIC[d.dataset.dev]}" alt="${HERO_ALT[d.dataset.dev]}" decoding="async"></div>`; });
  const mark = $('.hero__mark', hero), word = $('.hero__word', hero);
  const floor = $('.hero__floor', hero);
  const glows = $$('.hero__glow i', hero);
  const steps = { label: $('.hero__copy .label', hero), l1: $('.line[data-step="1"]', hero), l2: $('.line[data-step="2"]', hero), more: $('.hero__more', hero) };
  const bar = $('#heroProgress');
  const hint = $('.scroll-hint', hero);
  const tallMQ = window.matchMedia('(max-width: 900px) and (orientation: portrait), (max-width: 640px)');

  let W = 0, H = 0, Wc = 0, layout = LAYOUT.wide, cur = 0, target = 0, running = false, last = 0;
  const measure = () => {
    const s = $('.hero__stage', hero);
    W = s.clientWidth; H = s.clientHeight;
    layout = tallMQ.matches ? LAYOUT.tall : LAYOUT.wide;
    Wc = tallMQ.matches ? W : Math.min(W, 1240);   // on wide screens, compose inside the page width
  };

  function render(p) {
    const a = clamp01(p / 0.28);
    mark.style.transform = `scale(${1 - 0.55 * easeInOut(a)}) rotate(${-25 * a}deg)`;
    mark.style.opacity = 1 - easeOut(clamp01((p - 0.06) / 0.22));
    word.style.opacity = 1 - clamp01(p / 0.14);
    word.style.letterSpacing = `${0.6 + 0.9 * a}em`;

    steps.label.classList.toggle('is-in', p > 0.18);
    steps.l1.classList.toggle('is-in', p > 0.2);
    steps.l2.classList.toggle('is-in', p > 0.42);
    steps.more.classList.toggle('is-in', p > 0.62);
    hint.style.opacity = 1 - clamp01((p - 0.8) / 0.15);

    const t = easeInOut(clamp01((p - 0.08) / 0.62));
    const [cx1, cy1] = layout.center;
    const cx = cx1 * t * Wc, cy = cy1 * t * H;
    const theta = (-140 * (1 - t)) * Math.PI / 180;
    const k = 1 + 1.4 * (1 - t);
    devs.forEach((d, i) => {
      const [fx, fy, fr] = layout[d.dataset.dev];
      const dx = (fx - cx1) * Wc, dy = (fy - cy1) * H;
      const rx = (dx * Math.cos(theta) - dy * Math.sin(theta)) * k;
      const ry = (dx * Math.sin(theta) + dy * Math.cos(theta)) * k;
      const lift = clamp01((p - 0.7) / 0.3) * H * 0.014 * (i % 2 ? -1 : 1);
      const s = 0.45 + 0.55 * t;
      const r = fr + (1 - t) * (i % 2 ? 50 : -50);
      d.style.opacity = easeOut(clamp01((p - 0.1) / 0.18));
      d.style.transform = `translate(-50%,-50%) translate3d(${(cx + rx).toFixed(1)}px,${(cy + ry + lift).toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    });
    floor.style.opacity = clamp01((p - 0.5) / 0.25);
    floor.style.transform = `translate3d(${(cx1 * Wc).toFixed(1)}px, ${(layout.pods[1] * H + H * 0.07).toFixed(1)}px, 0)`;
    glows.forEach((g, i) => { g.style.transform = `translate3d(${(Math.sin(p * 3 + i * 2) * 6).toFixed(2)}vmax, ${(-p * 10 + i * 2).toFixed(2)}vmax, 0)`; });
    bar.style.transform = `scaleX(${p.toFixed(3)})`;
  }

  const progress = () => {
    const r = hero.getBoundingClientRect();
    const total = hero.offsetHeight - H;
    return total > 0 ? clamp01(-r.top / total) : 1;
  };
  const step = now => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    cur += (target - cur) * (1 - Math.pow(0.0008, dt));
    if (Math.abs(target - cur) < 0.0004) cur = target;
    render(cur);
    if (cur !== target) requestAnimationFrame(step); else running = false;
  };
  const kick = () => { target = progress(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); } };

  const start = () => {
    measure();
    if (reduceMotion.matches) { render(1); window.removeEventListener('scroll', kick); return; }
    window.addEventListener('scroll', kick, { passive: true });
    cur = target = progress();
    render(cur);
  };
  window.addEventListener('resize', () => { measure(); render(reduceMotion.matches ? 1 : cur); });
  reduceMotion.addEventListener?.('change', start);
  start();

  // A soft light that follows the pointer on desktop
  if (finePointer.matches && !reduceMotion.matches) {
    const g = glows[0];
    hero.addEventListener('pointermove', e => {
      const x = (e.clientX / W - 0.5) * 16, y = (e.clientY / H - 0.5) * 16;
      g.style.translate = `${x.toFixed(1)}vmax ${y.toFixed(1)}vmax`;
    });
  }
}

/* =========================================================
   START
   ========================================================= */
function init() {
  const steps = [
    () => { $('#year').textContent = new Date().getFullYear(); },
    initSmoothScroll, renderFamilies, renderSpotlight, renderGrid, initCompare, initBag, initView,
    renderContact, renderChannels, initNav, initHero, initMarquee, initReveal, initParallax, initTilt,
    () => {
      $('#grid').addEventListener('click', onCardClick);
      document.addEventListener('keydown', radioKeys);
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (pv.el && !pv.el.hidden) closeView(); else closeBag();
      });
    }
  ];
  // each part starts on its own, so one problem cannot leave the page empty
  let ok = true;
  for (const step of steps) {
    try { step(); } catch (err) { ok = false; console.warn('NEXERA: part of the page could not start.', err); }
  }
  if (!ok) document.documentElement.classList.remove('js');   // show everything plainly rather than half-animated
  window.NEXERA_READY = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
