/* NEXERA motion kit: smooth, Apple-style motion that sits ON TOP of the existing site.
 * Modules (each only runs if its markup exists):
 *   [data-seq]        scroll-scrubbed product turn (frames from a Higgsfield clip, drawn to <canvas>)
 *   [data-boot]       watch-screen boot-up intro on the hero product
 *   [data-ui-split]   watch-face UI that floats apart into layers on scroll
 *   [data-glow]       page-wide ambient glow that changes colour per section
 *   [data-swatches]   colour switcher that cross-fades the real product photo
 *   [data-roll]       odometer-style stat count-up
 *   [data-swap]       headline swap with motion blur
 *   [data-replay]     closing hero replay
 *   [data-rise]       cases rise into place ("A safe place for it at night")
 *   [data-promise]    "Real gear. Local delivery. No guesswork." words + delivery route drawn by scroll
 * Performance rules: one rAF loop, transform/opacity only, no per-frame layout reads, work stops off-screen,
 * reduced-motion respected, phones/low-power get lighter versions (html.nx-low, set by cinema.js or here). */
(function () {
  "use strict";
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOW = document.documentElement.classList.contains("nx-low") || matchMedia("(max-width: 760px)").matches ||
              (navigator.hardwareConcurrency || 8) <= 4 || !!navigator.connection?.saveData;
  document.documentElement.classList.toggle("nx-low", LOW);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- shared scroll loop: sections register a tick(progress) ---------- */
  const tracks = [];   // {el, top, h, tick, last}
  let vh = innerHeight, sy = scrollY, queued = false;
  function measure() {
    vh = innerHeight;
    for (const t of tracks) { const r = t.el.getBoundingClientRect(); t.top = r.top + scrollY; t.h = r.height; }
  }
  function frame() {
    queued = false; sy = window.nxLenis?.scroll ?? scrollY;
    for (const t of tracks) {
      const span = Math.max(1, t.h - vh), p = clamp((sy - t.top) / span, 0, 1);
      const vis = sy + vh > t.top && sy < t.top + t.h;
      if (!vis && t.last !== undefined) continue;            // off-screen: do nothing
      if (p !== t.last) { t.last = p; t.tick(p); }
    }
  }
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const track = (el, tick) => { tracks.push({ el, tick }); };
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => { measure(); kick(); });
  addEventListener("load", () => { measure(); kick(); });
  if (window.ResizeObserver) new ResizeObserver(() => { measure(); kick(); }).observe(document.body);

  /* ---------- 1. scroll-scrubbed product turn ---------- */
  function seq(sec) {
    const canvas = sec.querySelector("canvas"), ctx = canvas.getContext("2d", { alpha: true });
    const base = sec.dataset.seq, count = +sec.dataset.count || 120, ext = sec.dataset.ext || "webp";
    const step = LOW ? 2 : 1, size = LOW ? "960" : (innerWidth * Math.min(2, devicePixelRatio) > 1900 ? "1920" : "1440");
    const pad = n => String(n).padStart(3, "0");
    const url = i => `${base}${size}/${pad(i)}.${ext}`;
    const frames = new Array(count), idx = [];
    for (let i = 0; i < count; i += step) idx.push(i);
    let want = 0, drawn = -1;
    function fit() {
      const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); drawn = -1; draw();
    }
    function nearest(i) {                                    // closest loaded frame, so scrubbing never shows a gap
      for (let k = 0; k < count; k++) { if (frames[i - k]) return frames[i - k]; if (frames[i + k]) return frames[i + k]; }
      return null;
    }
    function draw() {
      const img = nearest(want); if (!img || drawn === want) return;
      const cw = canvas.width, ch = canvas.height, s = Math.min(cw / img.width, ch / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.clearRect(0, 0, cw, ch); ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h); drawn = want; sec.classList.add("seq-drawn");
    }
    async function load(i) {
      try {
        const res = await fetch(url(i)); const blob = await res.blob();
        frames[i] = window.createImageBitmap ? await createImageBitmap(blob) : await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.src = URL.createObjectURL(blob); });
        if (Math.abs(i - want) <= step * 2) draw();
      } catch (e) {}
    }
    // load order: first frame, then a coarse pass (every 8th), then fill in, 6 at a time
    const order = [0, ...idx.filter(i => i % 8 === 0 && i), ...idx.filter(i => i % 8 && i)];
    let started = false;
    async function start() {
      if (started) return; started = true;
      sec.classList.add("seq-loading");
      for (let k = 0; k < order.length; k += 6) await Promise.all(order.slice(k, k + 6).map(load));
      sec.classList.remove("seq-loading"); sec.classList.add("seq-ready");
    }
    new IntersectionObserver(es => es[0].isIntersecting && start(), { rootMargin: "150% 0px" }).observe(sec);
    addEventListener("resize", fit); fit();
    const cap = sec.querySelectorAll("[data-at]");               // captions that fade in at a progress point
    const [ra, rb] = (sec.dataset.range || "0.08-0.7").split("-").map(Number);   // hold first frame, play, then hold last frame for the stats
    track(sec, p => {
      const q = ease(clamp((p - ra) / (rb - ra)));
      want = Math.round(q * (count - 1) / step) * step; draw();
      sec.style.setProperty("--seq-p", p.toFixed(3));
      cap.forEach(c => { const [a, b] = c.dataset.at.split("-").map(Number); c.classList.toggle("on", p >= a && p <= b); });
    });
  }

  /* ---------- 2. watch-screen boot-up ---------- */
  function boot(el) {
    if (RM) return el.classList.add("booted");
    const go = () => requestAnimationFrame(() => el.classList.add("booted"));
    const img = el.querySelector("img");
    img && !img.complete ? img.addEventListener("load", go, { once: true }) : setTimeout(go, 150);
    const clock = el.querySelector("[data-clock]");
    if (clock) { const t = () => { const d = new Date(); clock.textContent = d.toTimeString().slice(0, 5); }; t(); setInterval(t, 15000); }
  }

  /* ---------- 3. watch-face UI floats apart ---------- */
  function split(sec) {
    const layers = $$("[data-depth]", sec), shot = sec.querySelector("[data-split-dim]");
    track(sec, p => {
      const t = ease(clamp((p - .15) / .6));                    // 15%–75% of the section
      layers.forEach(l => {
        const d = +l.dataset.depth, [dx, dy] = (l.dataset.dir || "0,0").split(",").map(Number);
        l.style.transform = `translate3d(${(dx * t * d * .15).toFixed(2)}vw, ${(dy * t * d * .15).toFixed(2)}vh, 0) scale(${(1 + t * d * .08).toFixed(3)})`;
        l.style.opacity = String(1 - clamp((p - .85) / .15));
      });
      if (shot) shot.style.opacity = String(1 - t * .65);
    });
  }

  /* ---------- 4. ambient glow per section ---------- */
  function glow() {
    const secs = $$("[data-glow]"); if (!secs.length) return;
    let layer = document.querySelector(".nx-ambient");
    if (!layer) { layer = document.createElement("div"); layer.className = "nx-ambient"; layer.setAttribute("aria-hidden", "true"); document.body.prepend(layer); }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) document.documentElement.style.setProperty("--nx-glow", e.target.dataset.glow);
    }), { rootMargin: "-45% 0px -45% 0px" });
    secs.forEach(s => io.observe(s));
  }

  /* ---------- 5. colour switcher ---------- */
  function swatches(box) {
    const stage = document.querySelector(box.dataset.swatches), btns = $$("[data-src]", box);
    if (!stage) return;
    btns.forEach(b => b.addEventListener("click", () => {
      if (b.classList.contains("on")) return;
      btns.forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      const old = stage.querySelector("img.cur"), next = new Image();
      next.alt = old?.alt || ""; next.className = "nx-swap-in"; next.decoding = "async";
      if (b.dataset.srcset) next.srcset = b.dataset.srcset; next.src = b.dataset.src;
      const show = () => { stage.append(next); requestAnimationFrame(() => { next.classList.add("cur"); old?.classList.replace("cur", "nx-swap-out"); });
                          setTimeout(() => old?.remove(), 700); };
      next.decode ? next.decode().then(show, show) : (next.onload = show);
      box.dispatchEvent(new CustomEvent("nx:colour", { bubbles: true, detail: { colour: b.dataset.colour } }));  // site's variant picker listens
    }));
  }

  /* ---------- 6. odometer count-up ---------- */
  function roll(el) {
    const to = el.dataset.roll, chars = [...to];
    el.setAttribute("aria-label", to); el.textContent = "";
    const cols = chars.map((c, i) => {
      const s = document.createElement("span");
      if (/\d/.test(c)) {
        s.className = "nxr-col"; s.innerHTML = `<span class="nxr-strip">${"0123456789".split("").map(n => `<i>${n}</i>`).join("")}</span>`;
        s.style.setProperty("--d", `${(chars.length - i) * 70}ms`); s.dataset.n = c;
      } else { s.className = "nxr-sep"; s.textContent = c; }
      s.setAttribute("aria-hidden", "true"); el.append(s); return s;
    });
    const run = () => cols.forEach(c => c.dataset.n && (c.firstChild.style.transform = `translate3d(0, ${-c.dataset.n * 10}%, 0)`));
    if (RM) return run();
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: .6 }).observe(el);
  }

  /* ---------- 7. headline swap with motion blur ---------- */
  function swapText(el) {
    const words = JSON.parse(el.dataset.swap); let i = 0;
    el.innerHTML = `<span class="nxs cur">${words[0]}</span>`;
    const next = () => {
      i = (i + 1) % words.length;
      const out = el.querySelector(".cur"), inn = document.createElement("span");
      inn.className = "nxs in"; inn.textContent = words[i]; el.append(inn);
      requestAnimationFrame(() => { out.classList.replace("cur", "out"); inn.classList.replace("in", "cur"); });
      setTimeout(() => out.remove(), 650);
    };
    if (el.dataset.swapOn === "scroll") {                       // swap at progress points of the parent section
      const sec = el.closest("[data-track]") || el.parentElement, n = words.length; let last = 0;
      track(sec, p => { const k = Math.min(n - 1, Math.floor(p * n)); while (last !== k) { next(); last = (last + 1) % n; } });
    } else if (!RM) {
      let timer; new IntersectionObserver(es => { clearInterval(timer); if (es[0].isIntersecting) timer = setInterval(next, +el.dataset.every || 2600); }).observe(el);
    }
  }

  /* ---------- 8. closing hero replay ---------- */
  function replay(sec) {
    new IntersectionObserver(es => sec.classList.toggle("play", es[0].isIntersecting), { threshold: .35 }).observe(sec);
  }

  /* ---------- 9. cases rise up (real photos, staggered, night mood) ---------- */
  function rise(sec) {
    const items = $$("[data-rise-item]", sec);
    items.forEach((it, i) => it.style.setProperty("--i", i));
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { sec.classList.add("risen"); o.disconnect(); } }, { threshold: .3 }).observe(sec);
    if (!RM && !LOW) track(sec, p => items.forEach((it, i) => it.style.translate = `0 ${((p - .5) * (i % 2 ? -40 : 30)).toFixed(1)}px`));
  }

  /* ---------- 10. promise: words reveal + delivery route draws in with scroll ---------- */
  function promise(sec) {
    const words = $$("[data-word]", sec), path = sec.querySelector("[data-route]"), stops = $$("[data-stop]", sec);
    let len = 0; if (path) { len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; }
    track(sec, p => {
      const t = clamp((p - .1) / .7);
      words.forEach((w, i) => w.classList.toggle("on", t > i / words.length));
      if (path) path.style.strokeDashoffset = (len * (1 - t)).toFixed(1);
      stops.forEach(s => s.classList.toggle("on", t >= +s.dataset.stop));
    });
  }

  function init() {
    $$("[data-seq]").forEach(seq); $$("[data-boot]").forEach(boot); $$("[data-ui-split]").forEach(split);
    glow(); $$("[data-swatches]").forEach(swatches); $$("[data-roll]").forEach(roll); $$("[data-swap]").forEach(swapText);
    $$("[data-replay]").forEach(replay); $$("[data-rise]").forEach(rise); $$("[data-promise]").forEach(promise); measure(); kick();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  window.NXMotion = { measure, kick };
})();
