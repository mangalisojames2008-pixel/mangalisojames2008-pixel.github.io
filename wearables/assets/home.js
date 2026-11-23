/* Home page: the scroll story (hero, statement, chapters) and the bundle builder.
   Plain JS. Scroll work is one rAF per frame and only touches transforms,
   opacity and classes. Product pictures stay inside their stage boxes. */
(function () {
  'use strict';
  const go = () => {
    const { $, $$, esc, fmt, load, card, bezel, url, cart, toast, reveals, S } = window.Shop;
    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) root.classList.add('static');
    const navH = () => ($('.nav') || { offsetHeight: 56 }).offsetHeight;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

    /* ---------- statement: split into words ---------- */
    const st = $('[data-statement]');
    let words = [];
    if (st) {
      st.setAttribute('aria-label', st.textContent.trim());
      st.innerHTML = st.textContent.trim().split(/\s+/).map(w => `<span class="w" aria-hidden="true">${esc(w)}</span>`).join(' ');
      words = $$('.w', st);
    }

    /* ---------- hero ---------- */
    const hero = $('.hero'), heroText = $('.hero__text'), heroStage = $('[data-hero-stage]');
    if (heroStage) heroStage.insertAdjacentHTML('afterbegin', bezel(0));

    /* ---------- chapters ---------- */
    const chapters = [];
    function buildChapters(d) {
      $$('[data-chapter]').forEach(sec => {
        const list = d.products.filter(p => p.category === sec.dataset.chapter && !p.addon);
        if (!list.length) { sec.hidden = true; return; }
        sec.style.setProperty('--n', list.length);
        const stage = $('[data-stage]', sec), caps = $('[data-caps]', sec);
        stage.innerHTML = bezel(0) + list.map((p, i) =>
          `<img class="shot${i ? '' : ' is-on'}" src="${esc(p.image)}" alt="${esc(p.name)}" width="1000" height="1000" loading="lazy" decoding="async">`).join('');
        caps.innerHTML = list.map((p, i) => {
          const act = !p.inStock ? '<span class="soldout">Sold out</span>'
            : p.options ? `<a class="btn" href="${url(p)}">Choose ${esc(p.options.label.toLowerCase())}</a>`
            : `<button class="btn" type="button" data-add="${esc(p.slug)}">Add to cart</button>`;
          return `<div class="cap${i ? '' : ' is-on'}">
            <h3>${esc(p.name)}</h3><p class="cap__price price">${fmt(p.price)}</p>
            <p class="cap__desc">${esc(p.description)}</p>
            <div class="cap__actions">${act}<a class="link" href="${url(p)}">Details</a><a class="link" href="${url(p)}#inside">Look inside in 3D</a></div></div>`;
        }).join('') + (list.length > 1 ? `<ol class="dots" aria-hidden="true">${list.map((_, i) => `<li${i ? '' : ' class="is-on"'}></li>`).join('')}</ol>` : '');
        chapters.push({ sec, stage, n: list.length, imgs: $$('.shot', stage), caps: $$('.cap', caps), dots: $$('.dots li', caps), idx: 0 });
      });
      $$('[data-row]').forEach(row => {
        row.innerHTML = d.products.filter(p => p.category === row.dataset.row).map(card).join('');
      });
      $$('[data-from]').forEach(el => {
        const ps = d.products.filter(p => p.category === el.dataset.from && !p.addon).map(p => p.price);
        if (ps.length) el.textContent = fmt(Math.min(...ps));
      });
    }

    const darks = $$('.ink-band, .section--ink, .footer');

    /* ---------- one scroll loop ---------- */
    let queued = false;
    function frame() {
      queued = false;
      const vh = innerHeight, nh = navH(), frameH = vh - nh;

      if (hero && !reduce) {
        const r = hero.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          const p = clamp((nh - r.top) / Math.max(1, r.height - frameH));
          heroStage.style.setProperty('--hs', (1 + p * 0.1).toFixed(3));
          heroStage.style.setProperty('--hr', (p * 90).toFixed(1) + 'deg');
          heroText.style.transform = `translateY(${(-p * 40).toFixed(1)}px)`;
          heroText.style.opacity = (1 - clamp((p - 0.5) / 0.5)).toFixed(3);
        }
      }

      if (words.length) {
        const r = st.getBoundingClientRect();
        const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35));
        const on = Math.round(p * words.length);
        words.forEach((w, i) => w.classList.toggle('on', reduce || i < on));
      }

      /* the nav turns dark over dark sections */
      const nav = $('.nav');
      if (nav) nav.classList.toggle('is-dark', darks.some(el => { const r = el.getBoundingClientRect(); return r.top <= nh / 2 && r.bottom > nh / 2; }));

      for (const c of chapters) {
        const r = c.sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const span = r.height - frameH;
        if (span < 40) continue;                         /* not pinned (short screen): leave the first product */
        const p = clamp((nh - r.top) / span);
        const idx = Math.min(c.n - 1, Math.floor(p * c.n));
        c.stage.style.setProperty('--cr', (p * 180).toFixed(1) + 'deg');
        if (idx !== c.idx) {
          c.idx = idx;
          c.imgs.forEach((im, i) => im.classList.toggle('is-on', i === idx));
          c.caps.forEach((cp, i) => { cp.classList.toggle('is-on', i === idx); cp.inert = i !== idx; });
          c.dots.forEach((dt, i) => dt.classList.toggle('is-on', i === idx));
        }
      }
    }
    const kick = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

    /* ---------- bundle builder ---------- */
    function buildBundle(d) {
      const form = $('[data-bundle]'); if (!form) return;
      const ok = p => p.inStock;
      const expand = p => p.options ? p.options.values.map(v => ({ p, opt: v })) : [{ p, opt: '' }];
      const watches = d.products.filter(p => p.category === 'watches' && !p.addon && ok(p)).flatMap(expand);
      const straps = d.products.filter(p => p.addon && ok(p)).flatMap(expand);
      const cases = d.products.filter(p => p.category === 'cases' && ok(p)).flatMap(expand);
      const opt = (name, o, i, checked) => `<label class="opt">
          <input type="radio" name="${name}" value="${i}"${checked ? ' checked' : ''}>
          <span class="stage"><img class="shot" src="${esc(o.p.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async"></span>
          <span class="opt__name">${esc(o.p.name)}${o.opt ? `, ${esc(o.opt)}` : ''}</span>
          <span class="price">${fmt(o.p.price)}</span></label>`;
      const none = (name, label) => `<label class="opt"><input type="radio" name="${name}" value="-1"><span class="opt__none" aria-hidden="true"></span><span class="opt__name">${label}</span><span></span></label>`;
      $('[data-opts="watch"]', form).innerHTML = watches.map((o, i) => opt('watch', o, i, i === 0)).join('');
      $('[data-opts="strap"]', form).innerHTML = straps.map((o, i) => opt('strap', o, i, i === 0)).join('') + none('strap', 'No strap set');
      $('[data-opts="case"]', form).innerHTML = cases.map((o, i) => opt('case', o, i, i === 0)).join('') + none('case', 'No case');

      const pick = () => {
        const v = n => { const el = form.querySelector(`input[name="${n}"]:checked`); return el ? +el.value : -1; };
        return [watches[v('watch')], straps[v('strap')], cases[v('case')]].filter(Boolean);
      };
      const render = () => {
        const items = pick();
        let total = items.reduce((s, o) => s + o.p.price, 0);
        const full = items.length === 3 && S.bundleDiscount > 0;
        if (full) total -= S.bundleDiscount;
        $('[data-lines]', form).innerHTML = items.map(o => `<li><span>${esc(o.p.name)}${o.opt ? `, ${esc(o.opt)}` : ''}</span><span class="price">${fmt(o.p.price)}</span></li>`).join('')
          + (full ? `<li class="save"><span>Bundle saving</span><span class="price">−${fmt(S.bundleDiscount)}</span></li>` : '');
        $('[data-total]', form).textContent = fmt(total);
      };
      form.addEventListener('change', render);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const items = pick(); if (!items.length) return;
        const id = items.length === 3 ? 'b' + Date.now().toString(36) : '';
        items.forEach(o => cart.add(o.p.slug, o.opt, 1, id));
        toast('Bundle added', 'View cart', 'cart.html');
      });
      render();
    }

    load().then(d => {
      try { buildChapters(d); } catch (e) { console.error(e); }
      try { buildBundle(d); } catch (e) { console.error(e); }
      reveals();
      kick();
    }).catch(e => {
      console.error(e);
      $$('[data-chapter]').forEach(s => { s.classList.add('no-pin'); });
    });

    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
    kick();
  };
  if (window.Shop) go(); else document.addEventListener('DOMContentLoaded', go);
})();
