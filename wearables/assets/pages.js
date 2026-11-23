/* Shop, product, cart, sizer, contact and delivery pages. Reads products.json and config.js. */
(function () {
  'use strict';
  const go = () => {
    const { S, $, $$, esc, fmt, load, cart, card, bezel, url, toast, waLink, waReady, reveals } = window.Shop;
    const page = document.body.dataset.page;
    const q = new URLSearchParams(location.search);
    const fail = el => { if (el) el.innerHTML = '<p class="muted">Products could not load. Check your connection and refresh, or order on WhatsApp.</p>'; };

    /* ring size rows, shared by product and sizer pages */
    const sizeRows = d => (d.ringSizes ? d.ringSizes.sizes : []).map(s =>
      `<tr><td>${esc(s.size)}</td><td>${s.mm.toFixed(1)} mm</td><td>${(Math.PI * s.mm).toFixed(1)} mm</td></tr>`).join('');
    const fillSizes = d => {
      $$('[data-sizes]').forEach(t => { t.innerHTML = sizeRows(d); });
      $$('[data-sizes-note]').forEach(n => { n.textContent = d.ringSizes ? d.ringSizes.note : ''; });
    };

    /* ================= shop ================= */
    if (page === 'shop') {
      const grid = $('[data-grid]'), count = $('[data-count]'), sortEl = $('[data-sort]');
      let cat = q.get('c') || '', sort = '';
      load().then(d => {
        if (cat && !d.cat[cat]) cat = '';
        const draw = () => {
          let list = d.products.filter(p => !cat || p.category === cat);
          if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
          if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
          list = [...list.filter(p => p.inStock), ...list.filter(p => !p.inStock)];
          grid.innerHTML = list.map(card).join('');
          count.textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
          $$('[data-c]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === cat)));
          const c = d.cat[cat];
          $('[data-shop-title]').textContent = c ? c.name : 'Shop';
          $('[data-shop-line]').textContent = c ? c.line : 'Every watch, smart ring and watch case we stock, in rand.';
          document.title = `${c ? c.name : 'Shop'} · ${S.name}`;
        };
        $('[data-filters]').addEventListener('click', e => {
          const b = e.target.closest('[data-c]'); if (!b) return;
          cat = b.dataset.c;
          history.replaceState(null, '', cat ? `?c=${cat}` : location.pathname);
          draw();
        });
        sortEl.addEventListener('change', () => { sort = sortEl.value; draw(); });
        draw();
      }).catch(() => fail(grid));
    }

    /* ================= product ================= */
    if (page === 'product') {
      load().then(d => {
        const p = d.bySlug[q.get('p')];
        if (!p) { $('[data-missing]').hidden = false; return; }
        const c = d.cat[p.category];
        document.title = `${p.name} · ${S.name}`;
        const md = document.querySelector('meta[name="description"]'); if (md) md.content = p.description;
        $('[data-crumbs]').innerHTML = `<a href="shop.html">Shop</a> <span aria-hidden="true">/</span> <a href="shop.html?c=${esc(p.category)}">${esc(c ? c.name : '')}</a>`;
        $('[data-pdp-stage]').innerHTML = bezel(0) + `<img class="shot" src="${esc(p.image)}" alt="${esc(p.name)}" width="1000" height="1000" fetchpriority="high" decoding="async">`;
        $('[data-pdp-name]').textContent = p.name;
        $('[data-pdp-price]').textContent = fmt(p.price);
        $('[data-pdp-desc]').textContent = p.description;
        $('[data-pdp-features]').innerHTML = (p.features || []).map(f => `<li>${esc(f)}</li>`).join('');
        $('[data-wellness]').hidden = !(p.category === 'rings' || (p.category === 'watches' && !p.addon));
        $('[data-ask]').href = waLink(`Hi ${S.name}, I have a question about the ${p.name} (${fmt(p.price)}).`);
        $('[data-ask]').insertAdjacentHTML('afterbegin', window.Shop.icons.wa);

        /* pictures: main photo (or colour photos), then the extra angles */
        const stageEl = $('[data-pdp-stage]');
        const show = (src, alt) => {
          const img = stageEl.querySelector('img.shot');
          img.src = src; img.alt = alt || p.name;
          $$('[data-thumb]').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.thumb === src)));
        };
        const pics = [...(p.colours ? p.colours.map(c => ({ image: c.image, label: c.name })) : [{ image: p.image, label: p.name }]), ...(p.gallery || [])];
        if (pics.length > 1) {
          $('[data-thumbs]').innerHTML = pics.map(g => `<button type="button" class="pdp__thumb stage" data-thumb="${esc(g.image)}" aria-pressed="${g.image === p.image}" aria-label="${esc(g.label)}"><img class="shot" src="${esc(g.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async"></button>`).join('');
          $('[data-thumbs]').addEventListener('click', e => { const t = e.target.closest('[data-thumb]'); if (t) show(t.dataset.thumb, `${p.name}, ${t.getAttribute('aria-label')}`); });
        }
        $('[data-img-note]').textContent = p.illustration ? `Illustration by ${S.name}. Product photo coming soon.` : p.photo ? `Photo: ${p.photo}.` : '';

        /* colour */
        let colour = '';
        if (p.colours && p.colours.length) {
          $('[data-colour-wrap]').hidden = false;
          const cc = $('[data-colour-chips]');
          cc.innerHTML = p.colours.map((c, i) => `<button class="chip" type="button" role="radio" aria-checked="${!i}" data-c="${esc(c.name)}" data-img="${esc(c.image)}">${esc(c.name)}</button>`).join('');
          colour = p.colours[0].name; $('[data-colour-name]').textContent = colour;
          cc.addEventListener('click', e => {
            const b = e.target.closest('[data-c]'); if (!b) return;
            colour = b.dataset.c; $('[data-colour-name]').textContent = colour;
            $$('[data-c]', cc).forEach(x => x.setAttribute('aria-checked', String(x === b)));
            show(b.dataset.img, `${p.name} in ${colour}`);
          });
        }

        /* at a glance */
        if (p.stats && p.stats.length) {
          const st = $('[data-stats]'); st.hidden = false;
          st.innerHTML = p.stats.map(x => `<li><span class="glance__v">${esc(x.value)}<small>${esc(x.unit)}</small></span><span class="glance__l">${esc(x.label)}</span></li>`).join('');
        }

        /* 3D view: three.js loads only now, on the first tap */
        let viewerP = null;
        const open3d = (inside, btn) => {
          const label = btn ? btn.textContent : '';
          if (btn) { btn.disabled = true; btn.textContent = 'Loading 3D…'; }
          viewerP = viewerP || import('./viewer3d.js');
          viewerP.then(m => m.open(p, { inside, storeName: S.name, opener: btn || document.activeElement }))
            .catch(err => { console.error(err); viewerP = null; toast('The 3D view could not start on this device.'); })
            .finally(() => { if (btn) { btn.disabled = false; btn.textContent = label; } });
        };
        $$('[data-3d]').forEach(b => b.addEventListener('click', () => open3d(b.dataset['3d'] === 'inside', b)));
        if (/^#(3d|inside)$/.test(location.hash)) open3d(location.hash === '#inside', $(location.hash === '#inside' ? '[data-3d="inside"]' : '[data-3d]'));

        /* options: ring size or slots */
        let opt = '', qty = 1;
        const err = $('[data-err]');
        if (p.options) {
          $('[data-opt-wrap]').hidden = false;
          $('[data-opt-label]').textContent = p.options.label;
          const chips = $('[data-opt-chips]');
          chips.setAttribute('aria-label', p.options.label);
          chips.innerHTML = p.options.values.map(v => `<button class="chip" type="button" role="radio" aria-checked="false" data-v="${esc(v)}">${esc(v)}</button>`).join('');
          chips.addEventListener('click', e => {
            const b = e.target.closest('[data-v]'); if (!b) return;
            opt = b.dataset.v; err.hidden = true;
            $$('[data-v]', chips).forEach(x => x.setAttribute('aria-checked', String(x === b)));
          });
          if (p.category === 'rings') $('[data-opt-help]').innerHTML = 'Not sure? See the <a class="link" href="#size-guide">size guide</a> or <a class="link" href="sizer.html">print the sizer</a>.';
        }
        if (p.category === 'rings') { $('[data-sizeguide]').hidden = false; fillSizes(d); }

        const qEl = $('[data-qty]');
        $$('[data-q]').forEach(b => b.addEventListener('click', () => { qty = Math.min(20, Math.max(1, qty + +b.dataset.q)); qEl.textContent = qty; }));

        const addBtn = $('[data-add-btn]');
        if (!p.inStock) { addBtn.disabled = true; addBtn.textContent = 'Sold out'; }
        $('[data-buy]').addEventListener('submit', e => {
          e.preventDefault();
          if (!p.inStock) return;
          if (p.options && !opt) { err.textContent = `Choose a ${p.options.label.toLowerCase()} first.`; err.hidden = false; $('[data-opt-chips] .chip').focus(); return; }
          const optLabel = opt && /^\d+$/.test(opt) ? `${p.options.label.toLowerCase()} ${opt}` : opt;
          const full = [colour, optLabel].filter(Boolean).join(', ');
          cart.add(p.slug, full, qty);
          toast(`${p.name}${full ? `, ${full}` : ''} added`, 'View cart', 'cart.html');
        });
        $('[data-pdp]').hidden = false;

        /* related: the add-on and a case for watches, other rings for rings, watches for cases */
        const rel = d.products.filter(x => x.slug !== p.slug && x.inStock && (
          p.category === 'watches' ? (x.addon || x.category === 'cases') :
          p.category === 'rings' ? (x.category === 'rings' || (x.category === 'watches' && !x.addon)) :
          x.category === 'watches' && !x.addon)).slice(0, 4);
        if (rel.length) { $('[data-related]').innerHTML = rel.map(card).join(''); $('[data-related-wrap]').hidden = false; }
      }).catch(() => { $('[data-missing]').hidden = false; });
    }

    /* ================= cart ================= */
    if (page === 'cart') {
      let data = null;
      /* "ring size 10" for numbers, "2 slots" as is */
      const optText = (p, i) => /^\d+$/.test(i.opt) && p.options ? `${p.options.label.toLowerCase()} ${i.opt}` : i.opt;
      const label = (p, i) => `${p.name}${i.opt ? `, ${optText(p, i)}` : ''}`;
      const lines = () => cart.items().filter(i => data.bySlug[i.slug]);
      /* bundle saving: only for bundles that still have a watch, a strap set and a case */
      const saving = () => {
        if (!(S.bundleDiscount > 0)) return 0;
        const groups = {};
        lines().forEach(i => { if (i.bundle) (groups[i.bundle] = groups[i.bundle] || new Set()).add(data.bySlug[i.slug].addon ? 'strap' : data.bySlug[i.slug].category); });
        return Object.values(groups).filter(g => g.has('watches') && g.has('strap') && g.has('cases')).length * S.bundleDiscount;
      };
      const totals = () => {
        const sub = lines().reduce((s, i) => s + data.bySlug[i.slug].price * i.qty, 0);
        const save = saving();
        const free = S.freeDeliveryFrom && sub - save >= S.freeDeliveryFrom;
        const del = S.deliveryFee == null ? null : (free ? 0 : S.deliveryFee);
        return { sub, save, del, total: sub - save + (del || 0) };
      };
      const draw = () => {
        const items = lines();
        $('[data-empty]').hidden = !!items.length;
        $('[data-cart]').hidden = !items.length;
        if (!items.length) return;
        $('[data-lines]').innerHTML = items.map((i, n) => {
          const p = data.bySlug[i.slug];
          return `<li class="line">
            <a class="stage line__img" href="${url(p)}" tabindex="-1" aria-hidden="true"><img class="shot" src="${esc(p.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async"></a>
            <div class="line__info">
              <a class="line__name" href="${url(p)}">${esc(p.name)}</a>
              ${i.opt ? `<span class="small muted">${esc(optText(p, i).replace(/^./, c => c.toUpperCase()))}</span>` : ''}
              ${i.bundle ? '<span class="small muted">Part of a bundle</span>' : ''}
              ${!p.inStock ? '<span class="soldout">Sold out, we will suggest another</span>' : ''}
              <div class="line__ctl">
                <div class="qty qty--sm" role="group" aria-label="Quantity of ${esc(p.name)}">
                  <button type="button" data-step="-1" data-n="${n}" aria-label="One less">−</button>
                  <output>${i.qty}</output>
                  <button type="button" data-step="1" data-n="${n}" aria-label="One more">+</button>
                </div>
                <button class="line__rm" type="button" data-rm="${n}">Remove</button>
              </div>
            </div>
            <span class="price line__price">${fmt(p.price * i.qty)}</span>
          </li>`;
        }).join('');
        const t = totals();
        $('[data-subtotal]').textContent = fmt(t.sub);
        $('[data-save-row]').hidden = !t.save;
        $('[data-save]').textContent = '−' + fmt(t.save);
        $('[data-delivery]').textContent = t.del == null ? 'Confirmed on WhatsApp' : t.del === 0 ? 'Free' : fmt(t.del);
        $('[data-total]').textContent = fmt(t.total) + (t.del == null ? ' + delivery' : '');
      };
      const change = (n, fn) => { const items = lines(); fn(items, n); cart.set(items.filter(i => i.qty > 0)); draw(); };
      $('[data-lines]').addEventListener('click', e => {
        const s = e.target.closest('[data-step]'), r = e.target.closest('[data-rm]');
        if (s) change(+s.dataset.n, (it, n) => { it[n].qty = Math.min(20, Math.max(0, it[n].qty + +s.dataset.step)); });
        if (r) change(+r.dataset.rm, (it, n) => { it[n].qty = 0; });
      });

      /* the WhatsApp order message */
      const message = f => {
        const t = totals();
        const rows = lines().map(i => { const p = data.bySlug[i.slug]; return `• ${i.qty} × ${label(p, i)}: ${fmt(p.price * i.qty)}`; });
        return [
          `Hi ${S.name}, I'd like to order:`, '', ...rows, '',
          `Subtotal: ${fmt(t.sub)}`,
          t.save ? `Bundle saving: −${fmt(t.save)}` : null,
          `Delivery: ${t.del == null ? 'please confirm' : t.del === 0 ? 'free' : fmt(t.del)}`,
          `Total: ${fmt(t.total)}${t.del == null ? ' + delivery' : ''}`, '',
          `Name: ${f.name}`, `Deliver to: ${f.area}`, f.note ? `Note: ${f.note}` : null
        ].filter(l => l !== null).join('\n');
      };
      const form = $('[data-checkout]'), err = $('[data-err]', form);
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (form.company.value) return;                       /* honeypot filled: a bot */
        const f = { name: form.name.value.trim(), area: form.area.value.trim(), note: form.note.value.trim() };
        if (f.name.length < 2) { err.textContent = 'Add your name so we know who the order is from.'; err.hidden = false; form.name.focus(); return; }
        if (f.area.length < 2) { err.textContent = 'Add your suburb and town so we can quote delivery.'; err.hidden = false; form.area.focus(); return; }
        err.hidden = true;
        window.open(waLink(message(f)), '_blank', 'noopener');
      });
      $('[data-owner-note]').hidden = waReady();

      /* PAYMENT SLOT: shows only when switched on in config.js */
      const pay = S.payments || {}, btns = [];
      if (typeof pay.yoco === 'string' && pay.yoco) btns.push(`<a class="btn btn--block" href="${esc(pay.yoco)}" target="_blank" rel="noopener">Pay by card with Yoco</a>`);
      if (pay.payfast) btns.push('<p class="small muted">PayFast button: add the form from NOTES.md here.</p>');
      if (btns.length) { $('[data-pay-buttons]').innerHTML = btns.join(''); $('[data-pay-slot]').hidden = false; }

      load().then(d => { data = d; draw(); }).catch(() => fail($('[data-lines]')));
      document.addEventListener('cart:change', () => data && draw());
      addEventListener('storage', () => data && draw());
    }

    /* ================= sizer ================= */
    if (page === 'sizer') {
      $('[data-print]').addEventListener('click', () => print());
      load().then(d => {
        fillSizes(d);
        const sizes = d.ringSizes.sizes;
        $('[data-circles]').innerHTML = sizes.map(s => {
          const box = s.mm + 4, c = box / 2;
          return `<figure class="circle"><svg width="${box}mm" height="${box}mm" viewBox="0 0 ${box} ${box}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${s.mm / 2}" fill="none" stroke="#000" stroke-width=".3"/><line x1="${c - 1.5}" y1="${c}" x2="${c + 1.5}" y2="${c}" stroke="#000" stroke-width=".2"/><line x1="${c}" y1="${c - 1.5}" x2="${c}" y2="${c + 1.5}" stroke="#000" stroke-width=".2"/></svg><figcaption>Size ${esc(s.size)}<br><span>${s.mm.toFixed(1)} mm</span></figcaption></figure>`;
        }).join('');
        /* strip: 0 to 80 mm, with the size marks at each circumference */
        const L = 80, H = 16;
        let ticks = '';
        for (let i = 0; i <= L; i++) {
          const h = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 1.6;
          ticks += `<line x1="${i + 2}" y1="${H}" x2="${i + 2}" y2="${H - h}" stroke="#000" stroke-width=".15"/>`;
          if (i % 10 === 0) ticks += `<text x="${i + 2}" y="${H - 5}" font-size="2.2" text-anchor="middle">${i}</text>`;
        }
        const marks = sizes.map((s, n) => {
          const x = Math.PI * s.mm + 2;
          return `<line x1="${x}" y1="0" x2="${x}" y2="6.5" stroke="#e8452c" stroke-width=".3"/><text x="${x}" y="${n % 2 ? 6 : 2.4}" dx=".6" font-size="2.3" font-weight="600">${esc(s.size)}</text>`;
        }).join('');
        $('[data-strip]').innerHTML = `<svg class="strip" width="${L + 4}mm" height="${H}mm" viewBox="0 0 ${L + 4} ${H}" role="img" aria-label="Paper strip with sizes 7 to 13 marked">
          <rect x=".1" y=".1" width="${L + 3.8}" height="${H - .2}" fill="none" stroke="#000" stroke-width=".2" stroke-dasharray="1 .8"/>
          <line x1="2" y1="0" x2="2" y2="${H}" stroke="#000" stroke-width=".3"/><text x="2.6" y="8.8" font-size="1.8">start</text>
          ${ticks}${marks}</svg><p class="small muted">Red marks: ring sizes. Grey numbers: millimetres. Cut along the dashed line.</p>`;
      }).catch(() => fail($('[data-circles]')));
    }

    /* ================= contact ================= */
    if (page === 'contact') {
      if (S.email) { const m = $('[data-mail]'); m.href = `mailto:${S.email}`; m.textContent = S.email; }
      $$('[data-show]').forEach(el => { el.hidden = !S[el.dataset.show]; });
      const form = $('[data-contact]'), err = $('[data-err]', form);
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (form.company.value) return;
        const name = form.name.value.trim(), msg = form.msg.value.trim();
        if (!msg) { err.textContent = 'Write a short message first.'; err.hidden = false; form.msg.focus(); return; }
        err.hidden = true;
        window.open(waLink(`Hi ${S.name}${name ? `, this is ${name}` : ''}.\n\n${msg}`), '_blank', 'noopener');
      });
    }

    /* ================= delivery ================= */
    if (page === 'delivery') {
      const el = $('[data-delivery-cost]');
      if (el && S.deliveryFee != null) el.textContent = `${fmt(S.deliveryFee)}${S.freeDeliveryFrom ? `, free on orders over ${fmt(S.freeDeliveryFrom)}` : ''}`;
    }

    reveals();
  };
  if (window.Shop) go(); else document.addEventListener('DOMContentLoaded', go);
})();
