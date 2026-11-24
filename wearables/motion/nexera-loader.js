/* NEXERA loader: wordmark assembles letter by letter, a real progress bar (fonts + hero images), slogan fades in,
 * then the screen splits open. First visit ~1.6-2.4 s; later visits in the same session ~0.5 s. Never blocks longer than 3 s.
 * Markup (first thing in <body>): <div class="nx-loader" data-loader><div class="ld-inner"><div class="ld-word">NEXERA</div>
 *   <div class="ld-bar"><i></i></div><p class="ld-slogan">Shop smarter. Live better.</p></div></div> */
(function () {
  "use strict";
  const el = document.querySelector("[data-loader]"); if (!el) return;
  const word = el.querySelector(".ld-word"), bar = el.querySelector(".ld-bar");
  word.innerHTML = [...word.textContent.trim()].map((c, i) => `<span style="--i:${i}">${c}</span>`).join("");
  word.setAttribute("aria-label", "NEXERA");
  let seen = false; try { seen = sessionStorage.getItem("nx-seen") === "1"; sessionStorage.setItem("nx-seen", "1"); } catch (e) {}
  if (seen) el.classList.add("quick");
  const t0 = performance.now(), MIN = seen ? 450 : 1600, MAX = 3000;
  const tasks = [document.fonts ? document.fonts.ready : Promise.resolve(),
    ...[...document.querySelectorAll("img")].filter(i => !i.loading || i.loading === "eager").slice(0, 6)
      .map(i => i.complete ? Promise.resolve() : new Promise(ok => { i.addEventListener("load", ok, { once: true }); i.addEventListener("error", ok, { once: true }); }))];
  let done = 0; const set = () => bar.style.setProperty("--ld", (done / tasks.length).toFixed(2));
  tasks.forEach(p => p.then(() => { done++; set(); })); set();
  requestAnimationFrame(() => el.classList.add("ready"));
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; bar.style.setProperty("--ld", 1);
    setTimeout(() => { el.classList.add("out"); document.documentElement.classList.add("nx-loaded");
      setTimeout(() => el.remove(), 1100); }, Math.max(0, MIN - (performance.now() - t0)));
  };
  Promise.all(tasks).then(close); setTimeout(close, MAX);
})();
