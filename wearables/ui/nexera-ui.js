/* NEXERA site UI: smooth scroll (Lenis), three-line menu, scroll reveals. Include on every page:
   <script src="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js" defer></script>
   <script src="ui/nexera-ui.js" defer></script>                                              */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOW = matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4 || !!navigator.connection?.saveData;
  if (LOW) document.documentElement.classList.add("nx-low");
  // every image: decode off the main thread
  document.querySelectorAll("img:not([decoding])").forEach(i => (i.decoding = "async"));

  // ---------- smooth scrolling ----------
  let lenis = null;
  if (!reduce && window.Lenis) {
    // touch scrolling stays native (phones already scroll smoothly; smoothing touch adds lag)
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // in-page links glide instead of jumping
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href").length < 2) return;
      const el = document.querySelector(a.getAttribute("href"));
      if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -20, duration: 1.2 }); }
    });
  }
  window.nxLenis = lenis;

  // ---------- menu ----------
  const btn = document.querySelector(".nx-burger");
  const menu = document.getElementById("nx-menu");
  if (btn && menu) {
    menu.querySelectorAll("nav a").forEach((a, i) => a.style.setProperty("--i", i));
    const set = open => {
      btn.setAttribute("aria-expanded", open);
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("open", open);
      menu.toggleAttribute("inert", !open);
      document.documentElement.classList.toggle("nx-lock", open);
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open) setTimeout(() => menu.querySelector("nav a")?.focus({ preventScroll: true }), 350);
      else btn.focus({ preventScroll: true });
    };
    menu.setAttribute("inert", "");
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", e => { if (e.key === "Escape" && menu.classList.contains("open")) set(false); });
  }

  // cart count on the menu button (reads the cart the shop already stores, if any)
  const count = document.querySelector(".nx-burger .nx-count");
  const updateCount = () => {
    if (!count) return;
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const n = Array.isArray(cart) ? cart.reduce((s, i) => s + (i.qty || 1), 0) : 0;
      count.textContent = n > 0 ? n : "";
    } catch { count.textContent = ""; }
  };
  updateCount(); addEventListener("storage", updateCount); addEventListener("cart:change", updateCount);

  // ---------- reveals ----------
  const els = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("in-view")); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) {
      const el = en.target; el.classList.add("in-view"); io.unobserve(el);
      setTimeout(() => el.classList.add("done"), 1400);   // free the GPU layer once it has played
    }
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  els.forEach(el => io.observe(el));
  // grids: stagger children automatically
  document.querySelectorAll("[data-stagger]").forEach(grid =>
    [...grid.children].forEach((c, i) => { c.classList.add("reveal"); c.style.setProperty("--rd", `${Math.min(i, 8) * 70}ms`); io.observe(c); }));
})();
