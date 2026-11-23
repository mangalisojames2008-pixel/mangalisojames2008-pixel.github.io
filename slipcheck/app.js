/* SlipCheck UI: wires the inputs to bet-engine.js and plays the result animations. */
(() => {
  const E = window.BetEngine;
  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pct = (p, d = 1) => (p * 100).toFixed(d);
  const money = n => (n < 0 ? "−R" : "R") + Math.abs(n).toFixed(0);

  const MARKETS = [
    ["Result", ["home", "draw", "away"]],
    ["Double chance", ["1x", "x2", "12"]],
    ["Draw no bet", ["dnb-home", "dnb-away"]],
    ["Goals", ["over-0.5", "over-1.5", "over-2.5", "over-3.5", "over-4.5", "under-0.5", "under-1.5", "under-2.5", "under-3.5", "under-4.5"]],
    ["Team goals", ["home-over-0.5", "home-over-1.5", "home-over-2.5", "away-over-0.5", "away-over-1.5", "away-over-2.5", "home-under-1.5", "away-under-1.5"]],
    ["Both teams to score", ["btts-yes", "btts-no"]],
    ["Handicap", ["hcp-home--1.5", "hcp-home-+1.5", "hcp-away--1.5", "hcp-away-+1.5"]],
    ["Clean sheet / to nil", ["home-cs", "away-cs", "home-wtn", "away-wtn"]],
    ["Correct score", ["cs-1-0", "cs-2-0", "cs-2-1", "cs-1-1", "cs-0-0", "cs-0-1", "cs-1-2", "cs-0-2", "cs-3-1", "cs-2-2"]],
  ];
  let uid = 0;

  /* ---------- scroll reveals + hero ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); } }), { threshold: .15 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  const hg = $(".hero-gauge");
  requestAnimationFrame(() => { hg.classList.add("shown"); countUp(hg.querySelector(".tick"), 7.5, 1, 1600); });

  function countUp(el, to, dec = 0, ms = 1200) {
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- matches ---------- */
  const matchList = $("#matchList"), legList = $("#legList");
  function addMatch(v = {}) {
    const n = $("#tMatch").content.firstElementChild.cloneNode(true);
    n.dataset.id = "m" + (++uid);
    for (const k of ["home", "away", "o1", "ox", "o2", "oo", "ou"]) if (v[k] != null) n.querySelector(`[name=${k}]`).value = v[k];
    n.querySelector(".x").onclick = () => removeCard(n, refreshMatchOptions);
    let t; n.addEventListener("input", () => { refreshMatchOptions(); clearTimeout(t); t = setTimeout(() => updateXg(n), 250); });
    matchList.append(n); updateXg(n); refreshMatchOptions();
    return n;
  }
  const num = (n, k) => parseFloat(String(n.querySelector(`[name=${k}]`).value).replace(",", "."));
  function readMatch(n) {
    const o = { home: num(n, "o1"), draw: num(n, "ox"), away: num(n, "o2"), over25: num(n, "oo"), under25: num(n, "ou") };
    if (!(o.home > 1 && o.draw > 1 && o.away > 1)) return null;
    if (!(o.over25 > 1 && o.under25 > 1)) { delete o.over25; delete o.under25; }
    return o;
  }
  const label = n => `${n.querySelector("[name=home]").value || "Home"} v ${n.querySelector("[name=away]").value || "Away"}`;
  const xgCache = new Map();
  function updateXg(n) {
    const o = readMatch(n), box = n.querySelector(".xg");
    if (!o) { box.textContent = ""; xgCache.delete(n.dataset.id); return; }
    const key = JSON.stringify(o);
    if (xgCache.get(n.dataset.id)?.key !== key) xgCache.set(n.dataset.id, { key, l: E.lambdasFromOdds(o), m: E.devig([o.home, o.draw, o.away]).margin });
    const c = xgCache.get(n.dataset.id);
    box.textContent = `Expected goals ${c.l.home.toFixed(2)} – ${c.l.away.toFixed(2)} · bookmaker keeps ${pct(c.m)}%`;
  }

  /* ---------- legs ---------- */
  function addLeg(v = {}) {
    const n = $("#tLeg").content.firstElementChild.cloneNode(true);
    const mk = n.querySelector("[name=market]");
    MARKETS.forEach(([g, ids]) => { const og = document.createElement("optgroup"); og.label = g;
      ids.forEach(id => og.append(new Option(E.market(id).label, id))); mk.append(og); });
    if (v.market) mk.value = v.market;
    if (v.odds) n.querySelector("[name=odds]").value = v.odds;
    n.querySelector(".x").onclick = () => removeCard(n);
    legList.append(n); refreshMatchOptions(v.match);
    return n;
  }
  function refreshMatchOptions(setFor) {
    const ms = [...matchList.children];
    legList.querySelectorAll("[name=match]").forEach((sel, i, all) => {
      const cur = sel.value;
      sel.innerHTML = ""; ms.forEach(m => sel.append(new Option(label(m), m.dataset.id)));
      sel.value = (setFor && i === all.length - 1) ? setFor : (cur || ms[0]?.dataset.id || "");
    });
  }
  function removeCard(n, after) {
    n.classList.add("out");
    n.addEventListener("animationend", () => { n.remove(); after?.(); }, { once: true });
    if (reduce) { n.remove(); after?.(); }
  }

  /* ---------- analyse ---------- */
  $("#analyse").onclick = () => {
    const btn = $("#analyse"), err = $("#err"); err.textContent = "";
    document.querySelectorAll(".in.bad").forEach(i => i.classList.remove("bad"));
    const matches = [];
    for (const n of matchList.children) {
      const o = readMatch(n);
      if (!o) { n.querySelectorAll("[name=o1],[name=ox],[name=o2]").forEach(i => i.classList.add("bad")); err.textContent = "Every match needs its 1, X and 2 odds."; return; }
      matches.push({ id: n.dataset.id, name: label(n), lambdas: (xgCache.get(n.dataset.id) || {}).l || E.lambdasFromOdds(o) });
    }
    const legs = [];
    for (const n of legList.children) {
      const odds = num(n, "odds");
      if (!(odds > 1)) { n.querySelector("[name=odds]").classList.add("bad"); err.textContent = "Every selection needs odds above 1."; return; }
      legs.push({ match: n.querySelector("[name=match]").value, market: n.querySelector("[name=market]").value, odds });
    }
    if (!legs.length) { err.textContent = "Add at least one selection."; return; }

    btn.classList.add("busy"); btn.disabled = true;
    setTimeout(() => {                       // short "calculating" beat so the result lands with intent
      const res = E.analyseSlip({ matches, legs });
      btn.classList.remove("busy"); btn.disabled = false;
      render(res, matches);
    }, reduce ? 0 : 650);
  };

  function verdict(ev) { return ev > 0.02 ? ["value", "VALUE"] : ev > -0.04 ? ["fair", "FAIR"] : ["over", "OVERPRICED"]; }

  function render(res, matches) {
    const sec = $("#analysis");
    sec.hidden = false; sec.classList.remove("show"); void sec.offsetWidth; sec.classList.add("show");
    sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

    const s = res.slip;
    // gauge colour follows the chance: green likely, amber coin-flip, red long shot
    const fill = $("#slipFill");
    fill.style.stroke = s.prob >= .5 ? "var(--win)" : s.prob >= .2 ? "var(--fair)" : "var(--bad)";
    const g = fill.closest(".gauge"); g.classList.remove("on"); fill.style.setProperty("--p", Math.max(s.prob, .004));
    setTimeout(() => { g.classList.add("on"); countUp($("#slipPct"), s.prob * 100, s.prob < .1 ? 1 : 0, 1500); }, 250);
    $("#oneIn").textContent = `1 in ${s.oneIn.toLocaleString()}`;
    $("#totOdds").textContent = s.totalOdds.toFixed(2);
    $("#evR").textContent = money(100 * (1 + s.ev)) + (s.ev < 0 ? " back on average" : " back on average");

    // plain-English summary
    const weakest = [...res.legs].sort((a, b) => a.prob - b.prob)[0];
    const best = res.drops[0];
    let sum = `This slip lands about 1 in ${s.oneIn} times. `;
    if (best) sum += `Your weakest leg is ${weakest.label} (${pct(weakest.prob, 0)}%). Dropping ${best.drop.split(" (")[0]} takes you to ${pct(best.prob, 0)}%.`;
    if (s.sameGame) sum += " Selections on the same match were calculated together.";
    $("#summary").textContent = sum;

    // legs
    $("#legRows").innerHTML = res.legs.map((l, i) => {
      const [cls, txt] = verdict(l.ev), m = matches.find(x => x.id === l.match);
      return `<div class="r" style="--d:${i * .09}s"><div class="r-top"><div><b>${l.label}</b><small>${m.name} · odds ${l.odds.toFixed(2)}</small></div><span class="badge ${cls}">${txt}</span></div>
        <div class="lbl"><span>Our estimate</span><em>${pct(l.prob)}%</em></div><div class="bar"><i class="us" style="--w:${pct(l.prob)}%"></i></div>
        <div class="lbl"><span>Bookmaker's price</span><em>${pct(l.implied)}%</em></div><div class="bar"><i class="bk" style="--w:${pct(l.implied)}%"></i></div></div>`;
    }).join("");

    // drops
    $("#dropRows").innerHTML = res.drops.length ? res.drops.map((d, i) =>
      `<div class="r" style="--d:${i * .08}s"><div class="r-top"><div><b>Without ${d.drop}</b><small>odds ${d.totalOdds.toFixed(2)}</small></div><span class="badge fair">${pct(d.prob, 1)}%</span></div>
       <div class="bar"><i class="us" style="--w:${Math.max(pct(d.prob), 1)}%"></i></div></div>`).join("")
      : `<div class="r on"><small>Add a second selection to compare.</small></div>`;

    // alternatives
    $("#altRows").innerHTML = res.alternatives.map(a => `<div class="alt"><h4>Instead of ${a.for}</h4><div class="chips">${
      a.options.length ? a.options.map((o, i) => `<div class="chip" style="--d:${i * .06}s"><b>${o.label}</b><span>${pct(o.prob, 0)}%${o.push ? ` + ${pct(o.push, 0)}% refund` : ""} · worth it at ${o.minOddsForValue.toFixed(2)}+</span></div>`).join("")
      : `<div class="chip on"><span>No safer version on this market.</span></div>`}</div></div>`).join("");

    // stagger rows and chips in as they scroll into view
    const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("on"); ro.unobserve(e.target); } }), { threshold: .2 });
    sec.querySelectorAll(".r, .chip").forEach(el => (reduce ? el.classList.add("on") : ro.observe(el)));
  }

  /* ---------- example + start ---------- */
  function example() {
    matchList.innerHTML = ""; legList.innerHTML = "";
    const a = addMatch({ home: "Chiefs", away: "Pirates", o1: "2.00", ox: "3.40", o2: "3.80", oo: "1.90", ou: "1.90" });
    const b = addMatch({ home: "Sundowns", away: "Stellies", o1: "1.45", ox: "4.20", o2: "7.00", oo: "1.80", ou: "2.00" });
    addLeg({ match: a.dataset.id, market: "home", odds: "2.00" });
    addLeg({ match: a.dataset.id, market: "over-2.5", odds: "1.90" });
    addLeg({ match: b.dataset.id, market: "home", odds: "1.45" });
    addLeg({ match: b.dataset.id, market: "btts-yes", odds: "2.10" });
  }
  $("#loadExample").onclick = () => { example(); $("#slip").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  $("#addMatch").onclick = () => addMatch();
  $("#addLeg").onclick = () => { if (!matchList.children.length) addMatch(); addLeg(); };
  addMatch(); addLeg();
  if (location.hash === "#demo") { example(); setTimeout(() => $("#analyse").click(), 100); }
})();
