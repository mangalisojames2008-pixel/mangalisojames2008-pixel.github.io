/* NEXERA cinema engine: scroll-scrubbed keyframes, counters, glow colour per scene.
   Vanilla JS, no libraries.

   Usage on any element inside a .scene:
     data-k="0:o0 y8 b14 | .2:o1 y0 b0 | .8:o1 | 1:o0 y-10 b16"
       stops are scene progress 0..1; props: o=opacity x=vw y=vh s=scale r=deg b=blur(px)
       a prop not set at a stop keeps its previous value
     data-count="0,18" data-at=".15,.55"   number counts from 0 to 18 between progress .15 and .55
   On the .scene: data-glow="#ff5a1f"  (ambient + product glow colour while this scene is on screen)
*/
(() => {
  const cin = document.querySelector(".cin");
  if (!cin) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  const sample = (stops, p) => {
    if (p <= stops[0].at) return stops[0].v;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      if (p <= b.at) {
        const t = ease((p - a.at) / (b.at - a.at || 1));
        const out = {};
        for (const k in DEF) out[k] = a.v[k] + (b.v[k] - a.v[k]) * t;
        return out;
      }
    }
    return stops[stops.length - 1].v;
  };

  const scenes = [...cin.querySelectorAll(".scene")].map(el => ({
    el,
    glow: el.dataset.glow,
    keys: [...el.querySelectorAll("[data-k]")].map(n => ({ n, stops: parse(n.dataset.k), ghost: n.classList.contains("ghost") })),
    counts: [...el.querySelectorAll("[data-count]")].map(n => {
      const [from, to] = n.dataset.count.split(",").map(Number);
      const [a, b] = (n.dataset.at || "0,1").split(",").map(Number);
      const dec = +(n.dataset.dec || 0);
      return { n, from, to, a, b, dec, label: n.querySelector("small")?.outerHTML || "" };
    })
  }));

  const fmt = (v, dec) => v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  function frame() {
    const vh = innerHeight;
    let active = null, best = -1;
    for (const sc of scenes) {
      const r = sc.el.getBoundingClientRect();
      const span = r.height - vh;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      const vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (vis > best) { best = vis; active = sc; }
      if (r.bottom < -vh || r.top > 2 * vh) continue; // off screen: skip work
      for (const k of sc.keys) {
        const v = sample(k.stops, p);
        const st = k.n.style;
        st.opacity = v.o.toFixed(3);
        st.transform = `translate(${v.x}vw, ${v.y}vh) scale(${v.s}) rotate(${v.r}deg)`;
        st.filter = v.b > 0.05 ? `blur(${v.b.toFixed(1)}px)` : "";
        if (k.ghost) st.textShadow = v.b > 0.5 ? `0 ${(v.b * 1.4).toFixed(1)}px ${v.b.toFixed(1)}px rgba(200,190,255,.45)` : "";
      }
      for (const c of sc.counts) {
        const t = ease(Math.min(1, Math.max(0, (p - c.a) / (c.b - c.a))));
        c.n.innerHTML = fmt(c.from + (c.to - c.from) * t, c.dec) + c.label;
      }
    }
    if (active?.glow && cin.style.getPropertyValue("--glow") !== active.glow) cin.style.setProperty("--glow", active.glow);
  }

  if (reduce) {
    scenes.forEach(sc => sc.counts.forEach(c => (c.n.innerHTML = fmt(c.to, c.dec) + c.label)));
    cin.classList.add("is-in");
    return;
  }

  let queued = false;
  const tick = () => { queued = false; frame(); };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener("resize", frame);

  // intro: wait for the hero photo, then play the load-in
  const hero = cin.querySelector(".scene .prod");
  const start = () => { frame(); requestAnimationFrame(() => cin.classList.add("is-in")); };
  if (hero && !hero.complete) { hero.addEventListener("load", start, { once: true }); hero.addEventListener("error", start, { once: true }); setTimeout(start, 1500); }
  else start();

  // image fallbacks (hi-res -> cut-out -> photo on a light plate) are inline onerror handlers in the HTML,
  // so they also work if an image fails before this script runs.
})();
