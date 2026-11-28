/* NEXERA help centre behaviour. Self-contained: no globals except reading window.NXH. */
(() => {
  const C = window.NXH || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. fill every [data-cfg] from policy-config.js; highlight anything still in [BRACKETS] */
  $$("[data-cfg]").forEach(el => {
    const v = C[el.dataset.cfg];
    if (v == null) return;
    el.textContent = v;
    el.classList.toggle("nxh-todo", /^\[.*\]$/.test(String(v).trim()));
  });
  const digits = String(C.whatsapp || "").replace(/\D/g, "");
  if ($("#nxh-wa")) $("#nxh-wa").href = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  if ($("#nxh-mail") && C.email && !/^\[/.test(C.email)) $("#nxh-mail").href = `mailto:${C.email}`;

  /* 2. reveal sections + highlight the current tab */
  const secs = $$(".nxh-sec"), tabs = $$(".nxh-tabs a");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) e.target.classList.add("in");
  }), { threshold: .08 });
  secs.forEach(s => (reduce ? s.classList.add("in") : io.observe(s)));
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    tabs.forEach(t => t.classList.toggle("on", t.getAttribute("href") === "#" + e.target.id));
    const on = tabs.find(t => t.classList.contains("on"));
    on && on.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
  }), { rootMargin: "-40% 0px -55% 0px" });
  secs.forEach(s => spy.observe(s));

  /* deep links from the store footer (e.g. help/#warranty) open the right section and its first answer */
  const openHash = () => {
    const s = location.hash && document.getElementById(location.hash.slice(1));
    if (s && s.classList.contains("nxh-sec")) { s.classList.add("in"); const d = s.querySelector("details"); if (d) d.open = true; }
  };
  addEventListener("hashchange", openHash); openHash();

  /* 3. search: filters sections and answers, opens matches */
  const q = $("#nxh-q"), empty = $("#nxh-empty");
  q && q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    let shown = 0;
    secs.forEach(s => {
      if (!term) { s.hidden = false; s.querySelectorAll("details").forEach(d => (d.hidden = false)); shown++; return; }
      const secHit = (s.dataset.key || "").includes(term) || s.querySelector("h2").textContent.toLowerCase().includes(term);
      let any = secHit;
      s.querySelectorAll("details").forEach(d => {
        const hit = d.textContent.toLowerCase().includes(term);
        d.hidden = !(hit || secHit); if (hit) d.open = true; any = any || hit;
      });
      s.hidden = !any; if (any) { shown++; s.classList.add("in"); }
    });
    empty.hidden = shown > 0;
  });

  /* 4. ring size tools: inside diameter in mm of the Colmi R10 / R12 sizes we sell (same as products.json "ringSizes") */
  const SIZES = [[7, 17.9], [8, 18.3], [9, 19.1], [10, 20.0], [11, 20.8], [12, 21.6], [13, 22.4]];
  const rows = $$("#nxh-sizes tr");
  const nearest = d => SIZES.reduce((b, s) => (Math.abs(s[1] - d) < Math.abs(b[1] - d) ? s : b));
  const describe = d => {
    if (d < SIZES[0][1] - 0.6) return { txt: "Smaller than size 7. Message us and we'll check what's available.", size: null };
    if (d > SIZES[SIZES.length - 1][1] + 0.6) return { txt: "Larger than size 13. Message us and we'll check what's available.", size: null };
    const s = nearest(d), between = SIZES.find(x => x[1] > d && x[1] - d < 0.4 && x !== s);
    return { txt: `Size ${s[0]} (about ${d.toFixed(1)} mm inside)` + (between ? `. You're close to size ${between[0]}, so message us before ordering.` : ""), size: s[0] };
  };
  const mark = size => rows.forEach(r => r.classList.toggle("hit", +r.cells[0].textContent === size));

  const circ = $("#nxh-circ"), circOut = $("#nxh-circ-out");
  circ && circ.addEventListener("input", () => {
    const c = parseFloat(circ.value);
    if (!(c > 30 && c < 90)) { circOut.textContent = "Enter the length in millimetres, e.g. 59."; mark(null); return; }
    const r = describe(c / Math.PI); circOut.textContent = r.txt; mark(r.size);
  });

  // on-screen sizer: calibrate px-per-mm with a bank card (85.6 mm wide), then match a ring's inside edge
  const cal = $("#nxh-cal"), box = $("#nxh-cardbox"), ring = $("#nxh-ring"), ringC = $("#nxh-ringc"), ringOut = $("#nxh-ring-out");
  const saved = (() => { try { return +localStorage.getItem("nxh-cal"); } catch { return 0; } })();
  if (cal && saved) cal.value = saved;
  const drawRing = () => {
    if (!cal) return;
    const pxPerMm = cal.value / 85.6, d = parseFloat(ring.value);
    box.style.setProperty("--cw", cal.value + "px");
    ringC.style.setProperty("--rd", (d * pxPerMm).toFixed(1) + "px");
    const r = describe(d); ringOut.textContent = r.txt; mark(r.size);
  };
  cal && cal.addEventListener("input", () => { try { localStorage.setItem("nxh-cal", cal.value); } catch {} drawRing(); });
  ring && ring.addEventListener("input", drawRing);
  drawRing();

  /* 5. printable paper sizer: a strip with size marks at each circumference */
  const strip = $("#nxh-strip");
  if (strip) {
    // the slit sits 3 mm from the left; each mark sits exactly one finger circumference further along
    strip.innerHTML = '<span class="slit"></span>' + SIZES.map(([n, d]) => {
      const x = 3 + d * Math.PI;                   // 57–73 mm along a 90 mm strip
      return `<i style="left:${x.toFixed(1)}mm;height:6mm"></i><em style="left:${x.toFixed(1)}mm">${n}</em>`;
    }).join("");
  }
  const pb = $("#nxh-print");
  pb && pb.addEventListener("click", () => {
    document.body.classList.add("print-sizer");
    const done = () => { document.body.classList.remove("print-sizer"); removeEventListener("afterprint", done); };
    addEventListener("afterprint", done); window.print(); setTimeout(done, 1500);
  });
})();
