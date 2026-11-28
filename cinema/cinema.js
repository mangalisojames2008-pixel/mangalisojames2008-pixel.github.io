/* NEXERA cinema engine v3: scroll-scrubbed keyframes, counters, glow colour per scene.
   Vanilla JS, no libraries. Built for 60fps on mid-range phones:
   - positions are cached (no layout reads while scrolling)
   - only transform + opacity animate on product photos (no per-frame filters on images)
   - styles are written only when they change
   - one source of smoothing: Lenis if present, otherwise a light built-in ease

   Usage on any element inside a .scene:
     data-k="0:o0 y8 b14 | .2:o1 y0 b0 | .8:o1 | 1:o0 y-10 b16"
       stops are scene progress 0..1; props: o=opacity x=vw y=vh s=scale r=deg b=blur(px, text only)
     data-count="0,18" data-at=".15,.55"   counts 0 → 18 between progress .15 and .55
   On the .scene: data-glow="#ff5a1f"
*/
(() => {
  const cin = document.querySelector(".cin");
  if (!cin) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // phones and low-power devices skip blur entirely: it is the most expensive effect
  const LOW = matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4 || !!navigator.connection?.saveData;
  if (LOW) document.documentElement.classList.add("nx-low");

  const DEF = { o: 1, x: 0, y: 0, s: 1, r: 0, b: 0 };
  const ease = t => t * t * (3 - 2 * t);

  const parse = str => {
    let prev = { ...DEF };
    return str.split("|").map(seg => {
      const [at, rest = ""] = seg.split(":");
      const v = { ...prev };
      rest.trim().split(/\s+/).filter(Boolean).forEach(tok => { v[tok[0]] = parseFloat(tok.slice(1)); });
      prev = v;
      return { at: parseFloat(at), v };
    }).sort((a, b) => a.at - b.at);
  };
  const out = { ...DEF };
  const sample = (stops, p) => {
    if (p <= stops[0].at) return stops[0].v;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      if (p <= b.at) {
        const t = ease((p - a.at) / (b.at - a.at || 1));
        for (const k in DEF) out[k] = a.v[k] + (b.v[k] - a.v[k]) * t;
        return out;
      }
    }
    return stops[stops.length - 1].v;
  };
  const fmt = (v, dec) => v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const scenes = [...cin.querySelectorAll(".scene")].map(el => ({
    el, cur: 0, tgt: 0, start: 0, span: 1, top: 0, bottom: 0,
    glow: el.dataset.glow,
    keys: [...el.querySelectorAll("[data-k]")].map(n => ({
      n, stops: parse(n.dataset.k),
      // blur only on text blocks, never on photos or glows, and never on low-power devices
      blur: !LOW && n.tagName !== "IMG" && !n.classList.contains("prod-glow"),
      t: "", o: "", f: ""
    })),
    counts: [...el.querySelectorAll("[data-count]")].map(n => {
      const [from, to] = n.dataset.count.split(",").map(Number);
      const [a, b] = (n.dataset.at || "0,1").split(",").map(Number);
      return { n, from, to, a, b, dec: +(n.dataset.dec || 0), label: n.querySelector("small")?.outerHTML || "", last: "" };
    })
  }));

  // cache each scene's position once; refresh only on resize / layout change
  function cache() {
    const y = scrollY, vh = innerHeight;
    for (const sc of scenes) {
      const r = sc.el.getBoundingClientRect();
      sc.start = r.top + y; sc.span = Math.max(1, r.height - vh); sc.h = r.height;
    }
  }

  function render(sc, p) {
    for (const k of sc.keys) {
      const v = sample(k.stops, p);
      const t = `translate3d(${v.x.toFixed(2)}vw,${v.y.toFixed(2)}vh,0) scale(${v.s.toFixed(3)}) rotate(${v.r.toFixed(1)}deg)`;
      const o = v.o.toFixed(3);
      const f = k.blur && v.b > 0.3 ? `blur(${Math.min(v.b, 10).toFixed(1)}px)` : "";
      const st = k.n.style;
      if (t !== k.t) { st.transform = t; k.t = t; }
      if (o !== k.o) { st.opacity = o; k.o = o; }
      if (f !== k.f) { st.filter = f; k.f = f; }
    }
    for (const c of sc.counts) {
      const t = ease(Math.min(1, Math.max(0, (p - c.a) / (c.b - c.a))));
      const s = fmt(c.from + (c.to - c.from) * t, c.dec);
      if (s !== c.last) { c.n.innerHTML = s + c.label; c.last = s; }
    }
  }

  let last = performance.now(), running = false, glowNow = "";
  function frame(now = performance.now(), snap = false) {
    const dt = Math.min(64, now - last); last = now;
    // Lenis already smooths the scroll, so don't smooth twice (double smoothing feels laggy)
    const k = snap || window.nxLenis ? 1 : 1 - Math.pow(1 - 0.22, dt / 16.67);
    const y = scrollY, vh = innerHeight;
    let active = null, best = -1, moving = false;
    for (const sc of scenes) {
      const top = sc.start - y, bottom = top + sc.h;
      sc.tgt = Math.min(1, Math.max(0, -top / sc.span));
      const vis = Math.min(bottom, vh) - Math.max(top, 0);
      if (vis > best) { best = vis; active = sc; }
      const d = sc.tgt - sc.cur;
      sc.cur = Math.abs(d) < 0.0005 ? sc.tgt : sc.cur + d * k;
      if (sc.cur !== sc.tgt) moving = true;
      const on = bottom > -vh * 0.2 && top < vh * 1.2;
      if (on !== sc.on) { sc.el.style.visibility = on ? "" : "hidden"; sc.on = on; } // off-screen scenes cost nothing
      if (on) render(sc, sc.cur);
    }
    if (active?.glow && active.glow !== glowNow) { cin.style.setProperty("--glow", active.glow); glowNow = active.glow; }
    running = moving;
    if (moving) requestAnimationFrame(frame);
  }
  const kick = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };

  if (reduce) {
    scenes.forEach(sc => sc.counts.forEach(c => (c.n.innerHTML = fmt(c.to, c.dec) + c.label)));
    cin.classList.add("is-in");
    return;
  }

  cache();
  addEventListener("scroll", kick, { passive: true });
  let rz; addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { cache(); frame(performance.now(), true); }); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { cache(); kick(); }).observe(cin);
  addEventListener("load", () => { cache(); frame(performance.now(), true); });

  const hero = cin.querySelector(".scene .prod");
  let started = false;
  const start = () => { if (started) return; started = true; cache(); frame(performance.now(), true); requestAnimationFrame(() => cin.classList.add("is-in")); };
  if (hero && !hero.complete) { hero.addEventListener("load", start, { once: true }); hero.addEventListener("error", start, { once: true }); setTimeout(start, 1500); }
  else start();
  // image fallbacks (hi-res -> cut-out -> photo on a light plate) are inline onerror handlers in the HTML
})();
