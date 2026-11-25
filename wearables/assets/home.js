/* Home page: prices in the film, the product chapters
   and the bundle builder. The film itself runs on cinema/cinema.js (not changed here).
   Scroll work is one rAF per frame and only touches transforms, opacity and classes.
   Product pictures are real photos inside their stage boxes. */
(function () {
  'use strict';
  const go = () => {
    const { $, $$, esc, fmt, load, fill, bezel, url, srcAttrs, cart, toast, S } = window.Shop;
    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) root.classList.add('static');
    /* chapters pin below the top band that holds the logo and the menu button */
    const navH = () => parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 80;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

    /* film scenes that wait for product photos: shown once none of their products has "photoPending" */
    function showReadyScenes(d) {
      $$('.cin [data-needs]').forEach(sc => {
        const ready = sc.dataset.needs.trim().split(/\s+/).every(slug => d.bySlug[slug] && !d.bySlug[slug].photoPending);
        if (ready && sc.hidden) { sc.hidden = false; dispatchEvent(new Event('resize')); }
      });
    }

    /* ---------- chapters ---------- */
    const chapters = [];
    const STAGE_SIZES = '(max-width: 760px) 90vw, (min-width: 3400px) 1300px, (min-width: 2400px) 900px, 45vw';
    function buildChapters(d) {
      $$('[data-chapter]').forEach(sec => {
        const list = d.products.filter(p => p.category === sec.dataset.chapter && !p.addon && !p.photoPending);
        if (!list.length) { sec.hidden = true; return; }
        sec.style.setProperty('--n', list.length);
        const stage = $('[data-stage]', sec), caps = $('[data-caps]', sec);
        stage.innerHTML = bezel(0) + list.map((p, i) =>
          `<img class="shot${i ? '' : ' is-on'}" ${srcAttrs(p, p.image, STAGE_SIZES)} alt="${esc(p.name)}" width="1000" height="1000" loading="lazy" decoding="async">`).join('');
        caps.innerHTML = list.map((p, i) => {
          const act = !p.inStock ? '<span class="soldout">Sold out</span>'
            : p.options ? `<a class="btn" href="${url(p)}">Choose ${esc(p.options.label.toLowerCase())}</a>`
            : `<button class="btn" type="button" data-add="${esc(p.slug)}">Add to cart</button>`;
          return `<div class="cap${i ? '' : ' is-on'}">
            <h3>${esc(p.name)}</h3><p class="cap__price price">${fmt(p.price)}</p>
            <p class="cap__desc">${esc(p.description)}</p>
            <div class="cap__actions">${act}<a class="link" href="${url(p)}">Details</a></div></div>`;
        }).join('') + (list.length > 1 ? `<ol class="dots" aria-hidden="true">${list.map((_, i) => `<li${i ? '' : ' class="is-on"'}></li>`).join('')}</ol>` : '');
        chapters.push({ sec, stage, n: list.length, imgs: $$('.shot', stage), caps: $$('.cap', caps), dots: $$('.dots li', caps), idx: 0 });
      });
      /* home rows show only products with a real photo; the shop page lists everything */
      $$('[data-row]').forEach(row => {
        const list = d.products.filter(p => p.category === row.dataset.row && !p.photoPending);
        fill(row, list);                               /* the cards are already in the HTML; redraw only if the data changed */
        if (!list.length && row.parentElement) row.parentElement.hidden = true;
      });
      $$('[data-from]').forEach(el => {
        const ps = d.products.filter(p => p.category === el.dataset.from && !p.addon).map(p => p.price);
        if (ps.length) el.textContent = fmt(Math.min(...ps));
      });
      /* category tiles: the first product in each category that has a real photo */
      $$('[data-tile]').forEach(el => {
        const p = d.products.find(x => x.category === el.dataset.tile && !x.photoPending && (el.dataset.tile !== 'watches' || x.slug === 'xiaomi-smart-band-10'))
          || d.products.find(x => x.category === el.dataset.tile && !x.photoPending);
        if (p) el.innerHTML = `<img class="shot" ${srcAttrs(p, p.image, '(max-width: 760px) 50vw, 30vw')} alt="" width="1000" height="1000" loading="lazy" decoding="async">`;
        else {                                        /* no photo yet in this category: a text tile, no empty plate */
          const c = d.cat[el.dataset.tile];
          el.outerHTML = `<span class="bento__line muted">${esc(c ? c.line : '')}</span>`;
        }
      });
      /* prices in the film come from products.json too */
      $$('[data-price]').forEach(el => { const p = d.bySlug[el.dataset.price]; if (p) el.textContent = fmt(p.price); });
    }

    /* ---------- one scroll loop ---------- */
    let queued = false;
    function frame() {
      queued = false;
      const vh = innerHeight, nh = navH(), frameH = vh - nh;

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
    function kick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

    /* ---------- bundle builder ---------- */
    function buildBundle(d) {
      const form = $('[data-bundle]'); if (!form) return;
      const ok = p => p.inStock;
      const expand = p => p.options ? p.options.values.map(v => ({ p, opt: v })) : [{ p, opt: '' }];
      const watches = d.products.filter(p => p.category === 'watches' && !p.addon && ok(p)).flatMap(expand);
      const cases = d.products.filter(p => p.category === 'cases' && ok(p)).flatMap(expand);
      const opt = (name, o, i, checked) => `<label class="opt">
          <input type="radio" name="${name}" value="${i}"${checked ? ' checked' : ''}>
          <span class="stage">${o.p.photoPending ? '' : `<img class="shot" src="${esc(o.p.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async">`}</span>
          <span class="opt__name">${esc(o.p.name)}${o.opt ? `, ${esc(o.opt)}` : ''}</span>
          <span class="price">${fmt(o.p.price)}</span></label>`;
      const none = (name, label) => `<label class="opt"><input type="radio" name="${name}" value="-1"><span class="opt__none" aria-hidden="true"></span><span class="opt__name">${label}</span><span></span></label>`;
      $('[data-opts="watch"]', form).innerHTML = watches.map((o, i) => opt('watch', o, i, i === 0)).join('');
      $('[data-opts="case"]', form).innerHTML = cases.map((o, i) => opt('case', o, i, i === 0)).join('') + none('case', 'No case');

      const pick = () => {
        const v = n => { const el = form.querySelector(`input[name="${n}"]:checked`); return el ? +el.value : -1; };
        return [watches[v('watch')], cases[v('case')]].filter(Boolean);
      };
      const render = () => {
        const items = pick();
        let total = items.reduce((s, o) => s + o.p.price, 0);
        const full = items.length === 2 && S.bundleDiscount > 0;
        if (full) total -= S.bundleDiscount;
        $('[data-lines]', form).innerHTML = items.map(o => `<li><span>${esc(o.p.name)}${o.opt ? `, ${esc(o.opt)}` : ''}</span><span class="price">${fmt(o.p.price)}</span></li>`).join('')
          + (full ? `<li class="save"><span>Bundle saving</span><span class="price">−${fmt(S.bundleDiscount)}</span></li>` : '');
        $('[data-total]', form).textContent = fmt(total);
      };
      form.addEventListener('change', render);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const items = pick(); if (!items.length) return;
        const id = items.length === 2 ? 'b' + Date.now().toString(36) : '';
        items.forEach(o => cart.add(o.p.slug, o.opt, 1, id));
        toast('Bundle added', 'View cart', 'cart.html');
      });
      render();
    }

    load().then(d => {
      try { showReadyScenes(d); } catch (e) { console.error(e); }
      try { buildChapters(d); } catch (e) { console.error(e); }
      try { buildBundle(d); } catch (e) { console.error(e); }
      kick();
    }).catch(e => {
      console.error(e);
      $$('[data-chapter]').forEach(s => { s.classList.add('no-pin'); });
    });

    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
    kick();
  };
  /* brand intro: start the Higgsfield light plate with the intro (phones get a small 720p file; skipped with
     Save-Data, reduced motion or a weak CPU, where the CSS beam stands in),
     then take the intro out of the page once it has lifted away, so it costs nothing while scrolling */
  (() => {
    const bi = document.querySelector('.brand-intro'); if (!bi) return;
    const v = bi.querySelector('.bi-plate'), root = document.documentElement;
    const skip = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 8) <= 4 ||
      !!(navigator.connection && navigator.connection.saveData);
    const small = matchMedia('(max-width: 760px)').matches;
    if (v && !skip) {
      const can = t => v.canPlayType(t);
      const f = can('video/webm; codecs="vp9"') ? v.dataset.srcWebm : v.dataset.srcMp4;
      v.src = small ? f.replace(/(\.\w+)$/, '-720$1') : f;
      v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      v.play().catch(() => {});
    }
    bi.addEventListener('animationend', e => { if (e.target === bi && !e.pseudoElement && /^bi-out/.test(e.animationName)) { bi.classList.add('done'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } } });
  })();
  if (window.Shop) go(); else document.addEventListener('DOMContentLoaded', go);
})();
