/* NEXERA free-delivery progress bar. Call NXFree.render(cartTotalInRand) whenever the cart changes.
 * Mount points: any element with [data-free-delivery] (cart page, cart drawer, mini-cart). */
(function () {
  "use strict";
  const THRESHOLD = 1200;                                   // keep in sync with Shopify free-shipping minimum
  const fmt = n => "R" + Math.ceil(n).toLocaleString("en-ZA").replace(/,/g, " ");

  function message(total) {
    if (total <= 0) return { text: `Free delivery on orders over ${fmt(THRESHOLD)}`, pct: 0, done: false };
    const left = THRESHOLD - total;
    if (left <= 0) return { text: "You've got free delivery", pct: 100, done: true };
    return { text: `You're ${fmt(left)} away from free delivery`, pct: Math.min(99, Math.round((total / THRESHOLD) * 100)), done: false };
  }

  function render(total) {
    const m = message(+total || 0);
    document.querySelectorAll("[data-free-delivery]").forEach(el => {
      if (!el.firstChild) el.innerHTML = '<p class="nxfd-text" aria-live="polite"></p><div class="nxfd-track"><i class="nxfd-fill"></i></div>';
      const was = el.classList.contains("is-done");
      el.querySelector(".nxfd-text").textContent = m.text;
      el.querySelector(".nxfd-fill").style.width = m.pct + "%";
      el.classList.toggle("is-done", m.done);
      if (m.done && !was) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
    });
  }

  window.NXFree = { THRESHOLD, message, render };
  if (typeof module === "object") module.exports = window.NXFree;
})();
