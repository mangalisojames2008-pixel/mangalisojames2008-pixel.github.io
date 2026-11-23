/* SlipCheck UI: wires the inputs to bet-engine.js and plays the result animations. */
(() => {
  const E = window.BetEngine;
  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pct = (p, d = 1) => (p * 100).toFixed(d);
  const money = n => (n < 0 ? "−R" : "R") + Math.abs(n).toFixed(0);
  const rand = n => "R" + Math.round(Math.abs(n)).toLocaleString("en-ZA");
  const signed = n => (Math.round(n) < 0 ? "−" : Math.round(n) > 0 ? "+" : "") + rand(n);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  function countTo(el, to, fmt, ms = 1200) {
    if (reduce) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- matches ---------- */
  const matchList = $("#matchList"), legList = $("#legList");
  function addMatch(v = {}) {
    const n = $("#tMatch").content.firstElementChild.cloneNode(true);
    n.dataset.id = "m" + (++uid);
    for (const k of ["home", "away", "o1", "ox", "o2", "oo", "ou"]) if (v[k] != null) n.querySelector(`[name=${k}]`).value = v[k];
    n.querySelector(".x").onclick = () => removeCard(n, refreshMatchOptions);
    const w = n.querySelector("[name=w]"), out = n.querySelector(".trust output");
    let t; n.addEventListener("input", e => {
      if (e.target === w) out.textContent = `${w.value}% odds · ${100 - w.value}% form`;
      refreshMatchOptions(); clearTimeout(t);
      if (e.target.closest(".form") && xgCache.has(n.dataset.id)) updateXg(n, true);   // odds fit is cached, so this is instant
      else t = setTimeout(() => updateXg(n, true), 250);
    });
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
  // optional team form: all four averages needed, then blended with the odds-based estimate by the slider weight
  function readForm(n) {
    const v = ["hs", "hc", "as", "ac"].map(k => num(n, k));
    if (!v.every(x => x >= 0 && x < 15)) return null;
    return { homeScored: v[0], homeConceded: v[1], awayScored: v[2], awayConceded: v[3] };
  }
  function updateXg(n, flash) {
    const o = readMatch(n), box = n.querySelector(".xg");
    if (!o) { box.textContent = ""; xgCache.delete(n.dataset.id); return; }
    const key = JSON.stringify(o);
    if (xgCache.get(n.dataset.id)?.key !== key) xgCache.set(n.dataset.id, { key, l: E.lambdasFromOdds(o), m: E.devig([o.home, o.draw, o.away]).margin });
    const c = xgCache.get(n.dataset.id), f = readForm(n), w = +n.querySelector("[name=w]").value / 100;
    c.form = f ? E.lambdasFromForm(f) : null;
    c.use = c.form ? E.blend(c.l, c.form, w) : c.l;
    c.w = w;
    box.innerHTML = `Expected goals ${c.use.home.toFixed(2)} – ${c.use.away.toFixed(2)} · bookmaker keeps ${pct(c.m)}%` + (c.form
      ? `<small>odds say ${c.l.home.toFixed(2)} – ${c.l.away.toFixed(2)} · form says ${c.form.home.toFixed(2)} – ${c.form.away.toFixed(2)} · blended ${Math.round(w * 100)}/${Math.round((1 - w) * 100)}</small>` : "");
    if (flash && !reduce) { box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash"); }
  }

  /* ---------- legs ---------- */
  function addLeg(v = {}) {
    const n = $("#tLeg").content.firstElementChild.cloneNode(true);
    const mk = n.querySelector("[name=market]");
    MARKETS.forEach(([g, ids]) => { const og = document.createElement("optgroup"); og.label = g;
      ids.forEach(id => og.append(new Option(E.market(id).label, id))); mk.append(og); });
    if (v.market) { if (![...mk.options].some(o => o.value === v.market)) mk.append(new Option(E.market(v.market).label, v.market)); mk.value = v.market; }
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
  let autoDemo = false;
  $("#analyse").onclick = () => {
    const btn = $("#analyse"), err = $("#err"); err.textContent = "";
    document.querySelectorAll(".in.bad").forEach(i => i.classList.remove("bad"));
    const matches = [];
    const legs = [];
    for (const n of legList.children) {
      const odds = num(n, "odds");
      if (!(odds > 1)) { n.querySelector("[name=odds]").classList.add("bad"); err.textContent = "Every selection needs odds above 1."; return; }
      legs.push({ match: n.querySelector("[name=match]").value, market: n.querySelector("[name=market]").value, odds });
    }
    if (!legs.length) { err.textContent = "Add at least one selection."; return; }
    // matches without full 1X2 prices (typical for an imported slip) get a rough estimate from their own legs
    const rough = [], margins = {};
    for (const n of matchList.children) {
      const o = readMatch(n), own = legs.filter(l => l.match === n.dataset.id);
      if (o) { if (!xgCache.has(n.dataset.id)) updateXg(n); const c = xgCache.get(n.dataset.id); margins[n.dataset.id] = c.m;
               matches.push({ id: n.dataset.id, name: label(n), lambdas: c.use }); continue; }
      if (!own.length) continue;
      rough.push(label(n));
      const f = readForm(n), est = E.lambdasFromLegs(own);
      matches.push({ id: n.dataset.id, name: label(n), lambdas: f ? E.blend(est, E.lambdasFromForm(f), +n.querySelector("[name=w]").value / 100) : est });
    }

    btn.classList.add("busy"); btn.disabled = true;
    setTimeout(() => {                       // short "calculating" beat so the result lands with intent
      const res = E.analyseSlip({ matches, legs });
      btn.classList.remove("busy"); btn.disabled = false;
      render(res, matches, rough);
      suggest({ matches, legs, margins });
      const saved = autoDemo ? null : saveSlip(res, matches);
      $("#savedNote").textContent = saved ? "Saved to your track record →" : "Example only, not saved";
      autoDemo = false;
    }, reduce ? 0 : 650);
  };

  function verdict(ev) { return ev > 0.02 ? ["value", "VALUE"] : ev > -0.04 ? ["fair", "FAIR"] : ["over", "OVERPRICED"]; }

  function render(res, matches, rough = []) {
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
    const wm = matches.find(x => x.id === weakest.match);
    shareText = `${res.legs.length}-leg slip · about 1 in ${s.oneIn.toLocaleString()} · weakest leg: ${weakest.label}${wm ? ` (${wm.name})` : ""}, ${pct(weakest.prob, 0)}%`;

    // legs
    $("#legRows").innerHTML = res.legs.map((l, i) => {
      const [cls, txt] = verdict(l.ev), m = matches.find(x => x.id === l.match);
      return `<div class="r" style="--d:${i * .09}s"><div class="r-top"><div><b>${l.label}</b><small>${esc(m.name)} · odds ${l.odds.toFixed(2)}</small></div><span class="badge ${cls}">${txt}</span></div>
        <div class="lbl"><span>Our estimate</span><em>${pct(l.prob)}%</em></div><div class="bar"><i class="us" style="--w:${pct(l.prob)}%"></i></div>
        <div class="lbl"><span>Bookmaker's price</span><em>${pct(l.implied)}%</em></div><div class="bar"><i class="bk" style="--w:${pct(l.implied)}%"></i></div></div>`;
    }).join("");

    // drops
    $("#dropRows").innerHTML = res.drops.length ? res.drops.map((d, i) =>
      `<div class="r" style="--d:${i * .08}s"><div class="r-top"><div><b>Without ${esc(d.drop)}</b><small>odds ${d.totalOdds.toFixed(2)}</small></div><span class="badge fair">${pct(d.prob, 1)}%</span></div>
       <div class="bar"><i class="us" style="--w:${Math.max(pct(d.prob), 1)}%"></i></div></div>`).join("")
      : `<div class="r on"><small>Add a second selection to compare.</small></div>`;

    // alternatives
    $("#altRows").innerHTML = res.alternatives.map(a => `<div class="alt"><h4>Instead of ${esc(a.for)}</h4><div class="chips">${
      a.options.length ? a.options.map((o, i) => `<div class="chip" style="--d:${i * .06}s"><b>${o.label}</b><span>${pct(o.prob, 0)}%${o.push ? ` + ${pct(o.push, 0)}% refund` : ""} · worth it at ${o.minOddsForValue.toFixed(2)}+</span></div>`).join("")
      : `<div class="chip on"><span>No safer version on this market.</span></div>`}</div></div>`).join("");

    // rough-estimate note
    const rn = $("#roughNote"); rn.hidden = !rough.length;
    rn.textContent = rough.length ? `Rough estimate for ${rough.join(", ")}: the slip only had your picked prices. Add the 1, X and 2 odds in step 02 (or a free odds key in step 01) for a sharper number.` : "";

    $("#sugRows").innerHTML = `<div class="r on"><small>Working out suggested slips…</small></div>`; $("#upRows").innerHTML = "";

    // stagger rows and chips in as they scroll into view
    const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("on"); ro.unobserve(e.target); } }), { threshold: .2 });
    sec.querySelectorAll(".r, .chip, .sug").forEach(el => (reduce ? el.classList.add("on") : ro.observe(el)));
  }

  /* ---------- suggested slips: worked out in a background worker (falls back to the page) ---------- */
  let worker = null, sugId = 0;
  try { worker = new Worker("sug-worker.js"); worker.onerror = () => { worker = null; }; } catch { worker = null; }
  function suggest(args) {
    const id = ++sugId;
    const local = () => setTimeout(() => { if (id === sugId) renderSug(E.suggestSlips(args)); }, 30);
    if (!worker) return local();
    const w = worker, t = setTimeout(() => { w.onmessage = null; local(); }, 4000);   // a stuck worker never blocks the result
    w.onmessage = e => { if (e.data.id !== id) return; clearTimeout(t); e.data.error ? local() : renderSug(e.data.sug); };
    w.postMessage({ id, args: JSON.parse(JSON.stringify(args)) });
  }
  function renderSug(sug) {
    // suggested slips: safer, bigger, value
    const g2 = sug, card = (cls, title, s, body) => `<div class="sug ${cls}"><div class="sug-top"><span class="tag">${title}</span><b>${pct(s.prob, s.prob < .1 ? 1 : 0)}%</b></div>
      <div class="bar"><i class="us" style="--w:${Math.max(pct(s.prob), 1)}%"></i></div><p class="sug-odds">Odds about ${s.totalOdds.toFixed(2)} · lands 1 in ${s.oneIn}</p>${body}</div>`;
    const swaps = c => `<ul>${c.map(x => `<li><s>${esc(x.leg)}</s> → <b>${esc(x.to)}</b> <em>~${x.estOdds.toFixed(2)} est.</em></li>`).join("")}</ul>`;
    $("#sugRows").innerHTML = [
      g2.safer && card("safe", "SAFER", g2.safer, swaps(g2.safer.changes)),
      g2.bigger && card("big", "BIGGER ODDS", g2.bigger, swaps(g2.bigger.changes)),
      g2.value && card("val", "VALUE ONLY", g2.value, `<ul>${g2.value.removed.map(r => `<li>Remove <b>${esc(r)}</b>: priced worse than a normal margin</li>`).join("")}</ul>`)
    ].filter(Boolean).join("") || `<div class="r on"><small>Your slip is already as lean as these rebuilds get.</small></div>`;
    $("#sugRows").insertAdjacentHTML("beforeend", `<p class="fine">~ prices are estimates of what a bookmaker would charge. Check the real price in Betway before you change anything.</p>`);

    // bigger-odds upgrades per leg
    $("#upRows").innerHTML = g2.upgrades.map(a => `<div class="alt"><h4>Instead of ${esc(a.for)}</h4><div class="chips">${
      a.options.length ? a.options.map((o, i) => `<div class="chip up" style="--d:${i * .06}s"><b>${o.label}</b><span>${pct(o.prob, 0)}% · ~${o.estOdds.toFixed(2)} est.</span></div>`).join("")
      : `<div class="chip on"><span>No bigger version of this pick.</span></div>`}</div></div>`).join("");

    const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("on"); ro.unobserve(e.target); } }), { threshold: .2 });
    document.querySelectorAll("#sugRows .sug, #sugRows .r, #upRows .chip").forEach(el => (reduce ? el.classList.add("on") : ro.observe(el)));
  }

  /* ---------- import: booking code, screenshot, pasted text ---------- */
  const SI = window.SlipImport, ie = $("#impErr");
  let parsed = null;
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => { x.classList.toggle("on", x === t); x.setAttribute("aria-selected", x === t); });
    document.querySelectorAll(".pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t.dataset.tab));
  });
  const tab = name => document.querySelector(`.tab[data-tab=${name}]`).click();

  function showReview(r, source) {
    ie.textContent = "";
    if (!r.legs.length) { ie.textContent = "Couldn't find any matches with prices. Make sure every leg and its odds are in the picture or text."; return; }
    parsed = r;
    const ok = r.legs.filter(l => l.ok).length;
    $("#reviewMeta").textContent = `${r.matches.length} match${r.matches.length > 1 ? "es" : ""} · ${ok} of ${r.legs.length} picks readable · from ${source}`;
    $("#reviewRows").innerHTML = r.matches.map((m, i) => `<div class="r on" style="--d:${i * .06}s"><div class="r-top"><div><b>${esc(m.home)} v ${esc(m.away)}</b>${m.kickoff ? `<small>${esc(m.kickoff)}</small>` : ""}</div></div>${
      r.legs.filter(l => l.matchKey === m.key).map(l => `<div class="pick ${l.ok ? "" : "no"}"><span>${l.ok ? E.market(l.market).label : esc(l.raw || "Unknown pick")}</span><em>${l.odds.toFixed(2)}</em>${l.ok ? "" : `<small>${esc(l.why)} · left out</small>`}</div>`).join("")}</div>`).join("");
    const rv = $("#review"); rv.hidden = false; rv.classList.remove("show"); void rv.offsetWidth; rv.classList.add("show");
    $("#reviewGo").disabled = !ok;
    rv.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  $("#pasteGo").onclick = () => {
    const t = $("#pasteIn").value.trim();
    if (!t) { ie.textContent = "Paste your slip text first."; return; }
    const r = SI.parseSlip(t);
    if (!r.legs.length && r.code) { $("#codeIn").value = r.code; tab("code"); $("#codeGo").click(); return; }
    showReview(r, "pasted text");
  };

  // booking code: a site can't read Betway codes directly, so use your own endpoint if you set one, else guide to a screenshot
  $("#codeGo").onclick = async () => {
    const code = $("#codeIn").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    ie.textContent = "";
    if (code.length < 5) { ie.textContent = "That code looks too short. Copy it exactly from the share message."; return; }
    $("#codeIn").value = code;
    const url = window.SLIP_PROVIDER?.url;
    if (url) {
      const b = $("#codeGo"); b.disabled = true; b.textContent = "Loading…";
      try {
        const r = await fetch(url + (url.includes("?") ? "&" : "?") + "code=" + encodeURIComponent(code));
        if (!r.ok) throw new Error(r.status);
        const body = await r.text();
        let txt = body; try { const j = JSON.parse(body); txt = j.text || (j.legs || []).map(l => `${l.home} v ${l.away}\n${l.market || ""}\n${l.selection || ""} ${(+l.odds).toFixed(2)}`).join("\n"); } catch {}
        b.disabled = false; b.textContent = "Load code";
        return showReview(SI.parseSlip(txt), "booking code " + code);
      } catch { b.disabled = false; b.textContent = "Load code"; ie.textContent = "Couldn't load that code automatically. Use the 3 steps below instead."; }
    }
    $("#codeHow").hidden = false; $("#codeHow").classList.add("show");
  };
  $("#codeIn").addEventListener("keydown", e => { if (e.key === "Enter") $("#codeGo").click(); });
  $("#codeOpen").onclick = async () => {
    try { await navigator.clipboard.writeText($("#codeIn").value.trim()); $("#codeOpen").textContent = "Copied ✓ opening…"; } catch {}
    window.open("https://www.betway.co.za/sport/soccer", "_blank", "noopener");
    setTimeout(() => tab("shot"), 600);
  };

  // screenshots: on-device text recognition (Tesseract.js, loaded only when needed)
  let tessP = null;
  const loadTess = () => tessP ||= new Promise((ok, no) => {
    if (window.Tesseract) return ok(window.Tesseract);
    const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    sc.onload = () => ok(window.Tesseract); sc.onerror = () => { tessP = null; no(new Error("load")); }; document.head.append(sc);
  });
  async function readShots(files) {
    const bar = $("#ocrBar"), drop = $("#drop"); ie.textContent = "";
    drop.classList.add("busy"); bar.style.setProperty("--w", ".04");
    try {
      const T = await loadTess(); let text = "";
      const w = await T.createWorker("eng", 1, { logger: m => m.status === "recognizing text" && bar.style.setProperty("--w", Math.max(.04, m.progress)) });
      for (const f of files) text += (await w.recognize(f)).data.text + "\n";
      await w.terminate();
      showReview(SI.parseSlip(text), files.length > 1 ? `${files.length} screenshots` : "screenshot");
    } catch { ie.textContent = "Couldn't read the screenshot here. Paste the slip text instead, or check your connection (the reader downloads once)."; }
    drop.classList.remove("busy"); bar.style.setProperty("--w", "0");
  }
  $("#shotIn").onchange = e => e.target.files.length && readShots([...e.target.files]);
  const dz = $("#drop");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", e => { const f = [...e.dataTransfer.files].filter(x => x.type.startsWith("image/")); if (f.length) readShots(f); });
  document.addEventListener("paste", e => {          // paste a screenshot or text anywhere on the page
    if (e.target.closest?.("input, textarea")) return;
    const img = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
    if (img.length) { tab("shot"); readShots(img); }
  });

  // optional odds key
  const OKEY = "slipcheck-odds-key";
  try { $("#keyIn").value = localStorage.getItem(OKEY) || ""; } catch {}
  $("#keySave").onclick = () => { try { localStorage.setItem(OKEY, $("#keyIn").value.trim()); } catch {} $("#keySave").textContent = "Saved ✓"; };

  // review -> fill the match and slip cards, fetch full prices if we can, then analyse
  $("#reviewGo").onclick = async () => {
    if (!parsed) return;
    const b = $("#reviewGo"); b.classList.add("busy"); b.disabled = true;
    matchList.innerHTML = ""; legList.innerHTML = ""; xgCache.clear();
    const used = parsed.matches.filter(m => parsed.legs.some(l => l.ok && l.matchKey === m.key));
    const cards = used.map(m => addMatch({ home: m.home, away: m.away }));
    let key = ""; try { key = localStorage.getItem(OKEY) || ""; } catch {}
    if (key && window.OddsFill) {
      try {
        const got = await window.OddsFill.fill(key, used);
        got.forEach((g, i) => { if (!g) return; const n = cards[i];
          [["o1", g.o1], ["ox", g.ox], ["o2", g.o2], ["oo", g.oo], ["ou", g.ou]].forEach(([k, v]) => v && (n.querySelector(`[name=${k}]`).value = v.toFixed(2)));
          n.querySelector(".xg").dataset.src = g.book; updateXg(n); });
      } catch (e2) { ie.textContent = e2.message + " Using a rough estimate instead."; }
    }
    parsed.legs.filter(l => l.ok).forEach(l => addLeg({ match: cards[used.findIndex(m => m.key === l.matchKey)].dataset.id, market: l.market, odds: l.odds.toFixed(2) }));
    b.classList.remove("busy"); b.disabled = false;
    $("#analyse").click();
  };

  /* ---------- share: copy a short summary ---------- */
  let shareText = "";
  $("#share").onclick = async () => {
    const b = $("#share").firstElementChild, text = `${shareText}. Estimate from SlipCheck, not a prediction. 18+`;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text }); ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select(); try { ok = document.execCommand("copy"); } catch {} ta.remove();
    }
    b.textContent = ok ? "Copied ✓" : "Couldn't copy"; b.classList.toggle("ok", ok); $("#shareMsg").textContent = ok ? "Summary copied: " + text : "";
    clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = "Copy summary"; b.classList.remove("ok"); }, 2200);
  };

  /* ---------- storage (this device only) ---------- */
  const KEY = "slipcheck.slips", LKEY = "slipcheck.limit";
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let slips = load(KEY, []); if (!Array.isArray(slips)) slips = [];
  let limit = load(LKEY, null);
  const persist = () => { store(KEY, slips); renderTrack(); };

  function saveSlip(res, matches) {
    const legs = res.legs.map(l => ({ label: l.label, match: (matches.find(m => m.id === l.match) || {}).name || "", odds: l.odds, prob: l.prob, implied: l.implied, res: null }));
    const sig = JSON.stringify(legs.map(l => [l.match, l.label, l.odds]));
    const same = slips.find(x => x.sig === sig && x.legs.every(l => !l.res));     // re-analysing the same slip updates it
    if (same) { same.legs = legs; same.prob = res.slip.prob; same.oneIn = res.slip.oneIn; }
    else slips.unshift({ id: Date.now().toString(36), t: Date.now(), sig, stake: null, legs, prob: res.slip.prob, oneIn: res.slip.oneIn, totalOdds: res.slip.totalOdds });
    persist(); return true;
  }
  // a slip loses if any leg loses; void legs count at odds 1; all void = stake back
  function outcome(s) {
    const r = s.legs.map(l => l.res);
    if (r.includes("lost")) return { state: "lost", ret: 0 };
    if (r.some(x => !x)) return { state: "pending" };
    if (r.every(x => x === "void")) return { state: "void", ret: 1 };
    return { state: "won", ret: s.legs.reduce((m, l) => m * (l.res === "won" ? l.odds : 1), 1) };
  }

  /* ---------- track record ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const chartIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.dataset.seen = "1"; e.target.classList.add("on"); } }), { threshold: .3 });
  function replay(el) {   // play the grow-in again after the data changes, if the chart has already been seen
    if (reduce) { el.classList.add("on"); return; }
    if (el.dataset.seen) { el.classList.remove("on"); void el.getBoundingClientRect(); requestAnimationFrame(() => el.classList.add("on")); }
  }
  function tipOn(chart, html, x, y) {
    const tip = chart.querySelector(".tip"); tip.innerHTML = html; chart.classList.add("hov");
    const w = chart.clientWidth, tw = tip.offsetWidth;
    tip.style.transform = `translate(${Math.min(Math.max(x - tw / 2, 0), w - tw)}px, ${Math.max(y - tip.offsetHeight - 12, -8)}px)`;
  }

  function renderTrack() {
    const marked = slips.flatMap(s => s.legs).filter(l => l.res === "won" || l.res === "lost");
    $("#menuCount").textContent = slips.length ? `${slips.length} slip${slips.length > 1 ? "s" : ""}` : "";

    // KPIs
    $("#kLegs").textContent = marked.length;
    const hit = marked.filter(l => l.res === "won").length;
    $("#kLegsSub").textContent = marked.length ? `${hit} landed, ${marked.length - hit} lost` : "Won or lost";
    if (marked.length) {
      const brier = marked.reduce((a, l) => a + (l.prob - (l.res === "won")) ** 2, 0) / marked.length;
      const bk = marked.reduce((a, l) => a + (Math.min(l.implied, 1) - (l.res === "won")) ** 2, 0) / marked.length;
      countTo($("#kBrier"), brier, v => v.toFixed(3), 900);
      $("#kBrierSub").textContent = `Bookmaker's prices score ${bk.toFixed(3)} on the same legs. 0 is perfect, always saying 50% scores 0.25. Lower is better.`;
    } else { $("#kBrier").textContent = "–"; $("#kBrierSub").textContent = "0 is perfect. Always saying 50% scores 0.25. Lower is better."; }

    // profit / loss over settled slips that have a stake, in the order they were settled
    const settled = slips.filter(s => s.stake > 0 && s.settledAt && outcome(s).state !== "pending").sort((a, b) => a.settledAt - b.settledAt);
    let run = 0; const pts = settled.map(s => { const o = outcome(s), d = s.stake * (o.ret - 1); run += d; return { s, d, run }; });
    countTo($("#kPL"), run, signed, 900);
    $("#kPLSub").textContent = settled.length ? `${settled.length} settled slip${settled.length > 1 ? "s" : ""} with a stake` : "Settled slips with a stake";

    drawCal(marked); drawPL(pts); drawLog(); checkLimit();
  }

  // charts are drawn at their real width (1 SVG unit = 1 px), so labels stay readable on a phone
  const cw = el => Math.round(Math.max(280, Math.min(1000, el.clientWidth || 600)));
  let lastW = 0, rz;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { const w = cw($("#calChart")); if (w !== lastW) { lastW = w; renderTrack(); } }, 200); });
  function drawCal(legs) {
    const el = $("#calChart"), W = cw(el), H = W < 480 ? 240 : 260, L = 40, R = 8, T = 22, B = 44, pw = W - L - R, ph = H - T - B;
    const bins = [0, 1, 2, 3, 4].map(i => ({ lo: i * 20, hi: i * 20 + 20, n: 0, won: 0, p: 0 }));
    legs.forEach(l => { const b = bins[Math.min(4, Math.floor(l.prob * 5))]; b.n++; b.p += l.prob; if (l.res === "won") b.won++; });
    const y = v => T + ph * (1 - v), bw = pw / 5, gap = W < 480 ? 8 : 14;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: for each band of our estimate, the bar shows how often those legs landed."><g class="grid">`;
    for (const v of [0, .25, .5, .75, 1]) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`;
    svg += `</g>`;
    bins.forEach((b, i) => {
      const x = L + i * bw + gap / 2, w = bw - gap, cx = x + w / 2, d = `--d:${i * .12}s`;
      if (b.n) {
        const rate = b.won / b.n, avg = b.p / b.n, top = y(rate), h = Math.max(T + ph - top, 0), r = Math.min(4, h);
        if (h > 0) svg += `<path class="cal-bar" style="${d}" d="M${x} ${T + ph}V${top + r}q0 -${r} ${r} -${r}H${x + w - r}q${r} 0 ${r} ${r}V${T + ph}Z"/>`;
        svg += `<line class="cal-mark" style="${d}" x1="${x - 4}" x2="${x + w + 4}" y1="${y(avg)}" y2="${y(avg)}"/>`;
        svg += `<text class="val cal-lab" style="${d}" x="${cx}" y="${Math.min(top, y(avg)) - 8}" text-anchor="middle">${Math.round(rate * 100)}%</text>`;
      }
      svg += `<text class="ax" x="${cx}" y="${H - B + 18}" text-anchor="middle">${b.lo}–${b.hi}%</text><text class="ax" x="${cx}" y="${H - B + 34}" text-anchor="middle" opacity=".7">${b.n} leg${b.n === 1 ? "" : "s"}</text>`;
      b.cx = cx; b.ty = b.n ? Math.min(y(b.won / b.n), y(b.p / b.n)) - 20 : T + ph / 2;
      svg += `<rect class="hit" data-i="${i}" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph + 40}"/>`;
    });
    if (!legs.length) svg += `<text class="empty" x="${L + pw / 2}" y="${T + ph / 2}" text-anchor="middle">${W < 480 ? "Mark legs Won or Lost to fill this in." : "Mark a few legs Won or Lost after the games and this fills in."}</text>`;
    el.innerHTML = svg + `</svg><div class="tip"></div>`;
    el.querySelectorAll(".hit").forEach(h => {
      const b = bins[h.dataset.i];
      const show = () => { const k = W / el.clientWidth;
        tipOn(el, b.n ? `${b.lo}–${b.hi}% estimates<small>${b.n} legs · landed ${b.won} (${Math.round(b.won / b.n * 100)}%) · we said ${Math.round(b.p / b.n * 100)}% on average</small>` : `${b.lo}–${b.hi}% estimates<small>no legs marked yet</small>`,
          b.cx / k, b.ty / k); };
      h.addEventListener("pointerenter", show); h.addEventListener("pointerleave", () => el.classList.remove("hov"));
    });
    $("#calTable").innerHTML = `<table><tr><th>Our estimate</th><th>Legs</th><th>Landed</th><th>Avg estimate</th></tr>${bins.map(b =>
      `<tr><td>${b.lo}–${b.hi}%</td><td>${b.n}</td><td>${b.n ? Math.round(b.won / b.n * 100) + "%" : "–"}</td><td>${b.n ? Math.round(b.p / b.n * 100) + "%" : "–"}</td></tr>`).join("")}</table>`;
    replay(el);
  }

  function drawPL(pts) {
    const el = $("#plChart"), W = cw(el), H = W < 480 ? 200 : 240, L = 56, R = 14, T = 18, B = 30, pw = W - L - R, ph = H - T - B;
    const vals = [0, ...pts.map(p => p.run)], lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 100;
    const y = v => T + ph * (1 - (v - lo + span * .08) / (span * 1.16)), x = i => L + (pts.length ? pw * i / pts.length : 0);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running profit and loss: ${pts.length ? signed(pts[pts.length - 1].run) + " after " + pts.length + " settled slips" : "no settled slips yet"}."><g class="grid">`;
    const ticks = [...new Set([lo, (lo + hi) / 2, hi].map(v => Math.round(v)))];
    ticks.forEach(v => svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${signed(v)}</text>`);
    svg += `</g><line class="pl-zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    if (pts.length) {
      const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
      svg += `<path class="pl-line" pathLength="1" d="${d}"/>`;
      pts.forEach((p, i) => svg += `<circle class="pl-dot" style="--d:${(1.4 * (i + 1) / pts.length).toFixed(2)}s" cx="${x(i + 1)}" cy="${y(p.run)}" r="4"/>`);
      svg += `<text class="ax" x="${L}" y="${H - 8}">start</text><text class="ax" x="${W - R}" y="${H - 8}" text-anchor="end">slip ${pts.length}</text>`;
      svg += `<line class="cross" y1="${T}" y2="${T + ph}"/>`;
    } else svg += `<text class="empty" x="${L + pw / 2}" y="${T + ph / 2 - 10}" text-anchor="middle">Enter a stake and mark the legs.</text><text class="empty" x="${L + pw / 2}" y="${T + ph / 2 + 12}" text-anchor="middle">Your running total shows here.</text>`;
    el.innerHTML = svg + `</svg><div class="tip"></div>`;
    if (pts.length) {
      const sv = el.querySelector("svg"), cross = el.querySelector(".cross");
      sv.addEventListener("pointermove", e => {
        const r = sv.getBoundingClientRect(), k = W / r.width, mx = (e.clientX - r.left) * k;
        const i = Math.min(pts.length, Math.max(1, Math.round((mx - L) / (pw / pts.length)))), p = pts[i - 1];
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i));
        tipOn(el, `${signed(p.run)} running<small>slip ${i} · ${new Date(p.s.t).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} · ${signed(p.d)}</small>`, x(i) / k, y(p.run) / k);
      });
      sv.addEventListener("pointerleave", () => el.classList.remove("hov"));
    }
    replay(el);
  }

  function drawLog() {
    const box = $("#slipLog");
    if (!slips.length) { box.innerHTML = `<div class="r on empty-log">No slips yet. Analyse a slip above and it's saved here.</div>`; return; }
    const LBL = { pending: "PENDING", won: "LANDED", lost: "LOST", void: "REFUNDED" };
    box.innerHTML = slips.map((s, si) => {
      const o = outcome(s), when = new Date(s.t).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
      const pl = s.stake > 0 && o.state !== "pending" ? ` · ${signed(s.stake * (o.ret - 1))}` : "";
      return `<article class="r on slip-c" data-i="${si}"><div class="meta"><div class="r-top" style="margin:0"><div><b>${s.legs.length}-leg slip · about 1 in ${s.oneIn.toLocaleString()}</b><small>${when} · odds ${s.totalOdds.toFixed(2)} · our estimate ${pct(s.prob)}%</small></div></div>
        <span class="st ${o.state}">${LBL[o.state]}${pl}</span></div>
        <label class="stake">Stake R <input class="in" name="stake" inputmode="decimal" value="${s.stake ?? ""}" placeholder="0" aria-label="Stake in rand"></label>
        ${s.legs.map((l, li) => `<div class="lg"><div><b>${esc(l.label)}</b><small>${esc(l.match)} · odds ${l.odds.toFixed(2)} · we said ${pct(l.prob, 0)}%</small></div>
          <div class="seg" role="group" aria-label="Result for ${esc(l.label)}">${["won", "lost", "void"].map(v => `<button type="button" data-l="${li}" data-v="${v}" aria-pressed="${l.res === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div>`).join("")}
        <button class="x" type="button" data-del aria-label="Delete this slip">×</button></article>`;
    }).join("");
  }
  $("#slipLog").addEventListener("click", e => {
    const card = e.target.closest(".slip-c"); if (!card) return;
    const s = slips[card.dataset.i];
    if (e.target.closest("[data-del]")) { if (confirm("Delete this slip from your track record?")) { slips.splice(card.dataset.i, 1); persist(); } return; }
    const b = e.target.closest(".seg button"); if (!b) return;
    const leg = s.legs[b.dataset.l]; leg.res = leg.res === b.dataset.v ? null : b.dataset.v;    // tap again to clear
    const st = outcome(s).state;
    if (st !== "pending" && !s.settledAt) s.settledAt = Date.now(); if (st === "pending") delete s.settledAt;
    const y = scrollY; persist(); scrollTo(0, y);
    $(`.slip-c[data-i="${card.dataset.i}"] [data-l="${b.dataset.l}"][data-v="${b.dataset.v}"]`)?.focus({ preventScroll: true });
  });
  $("#slipLog").addEventListener("change", e => {
    if (e.target.name !== "stake") return;
    const s = slips[e.target.closest(".slip-c").dataset.i], v = parseFloat(String(e.target.value).replace(",", "."));
    s.stake = v > 0 ? Math.round(v * 100) / 100 : null; persist();
  });

  /* ---------- monthly spending limit ---------- */
  function monthStakes() {
    const now = new Date();
    return slips.filter(s => { const d = new Date(s.t); return s.stake > 0 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
                .reduce((a, s) => a + s.stake, 0);
  }
  function checkLimit() {
    const spent = monthStakes(), over = limit > 0 && spent > limit;
    $("#limitInfo").textContent = limit > 0 ? `Tracked stakes this month: ${rand(spent)} of your ${rand(limit)} limit.` : "Set a limit and we'll let you know when the stakes you track this month go past it.";
    document.querySelectorAll("[data-limit]").forEach(slot => {
      if (!over) { slot.hidden = true; slot.innerHTML = ""; slot.dataset.v = ""; return; }
      const v = `${spent}|${limit}`; if (slot.dataset.v === v) return; slot.dataset.v = v;    // no re-animating on every redraw
      slot.hidden = false;
      slot.innerHTML = `<div class="limit" role="status"><b>You've tracked ${rand(spent)} in stakes this month, past the ${rand(limit)} limit you set.</b>
        <p>This might be a good moment to take a break. Free 24/7 help: National Responsible Gambling Programme <a href="tel:0800006008">0800 006 008</a> · WhatsApp HELP to <a href="https://wa.me/27766750710">076 675 0710</a></p></div>`;
    });
  }
  const li = $("#limit"); if (limit > 0) li.value = limit;
  li.addEventListener("input", () => { const v = parseFloat(li.value.replace(/[^\d.,]/g, "").replace(",", ".")); limit = v > 0 ? v : null; store(LKEY, limit); checkLimit(); });
  $("#clearAll").onclick = () => { if (slips.length && confirm("Delete every saved slip on this device?")) { slips = []; persist(); } };

  /* ---------- menu ---------- */
  const burger = $(".burger"), menu = $("#menu");
  menu.querySelectorAll("nav a").forEach((a, i) => a.style.setProperty("--i", i));
  const setMenu = open => {
    burger.setAttribute("aria-expanded", open); burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("open", open); menu.toggleAttribute("inert", !open);
    document.documentElement.classList.toggle("menu-open", open);
    if (open) setTimeout(() => menu.querySelector("nav a")?.focus({ preventScroll: true }), 300);
  };
  burger.onclick = () => setMenu(burger.getAttribute("aria-expanded") !== "true");
  menu.addEventListener("click", e => { if (e.target.closest("nav a")) setMenu(false); });
  addEventListener("keydown", e => { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); burger.focus(); } });

  /* ---------- how it works diagram (real numbers from the engine) ---------- */
  const g = E.scoreGrid(1.56, 1.10), gmax = g[1][1] > g[1][0] ? g[1][1] : g[1][0];
  $("#gridViz").innerHTML = [3, 2, 1, 0].flatMap(a => [0, 1, 2, 3].map(h => `<i style="--o:${Math.max(.08, g[h][a] / gmax).toFixed(2)};--k:${h + (3 - a) * 4}" title="${h}-${a}: ${pct(g[h][a])}%"></i>`)).join("");
  const flow = $("#flow"), mini = flow.querySelector(".gauge");
  new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { flow.classList.add("shown"); mini.classList.add("on"); o.disconnect(); } }), { threshold: .25 }).observe(flow);

  ["#calChart", "#plChart"].forEach(s => chartIO.observe($(s)));
  renderTrack();

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
  if (location.hash === "#demo") { example(); autoDemo = true; setTimeout(() => $("#analyse").click(), 100); }
})();
