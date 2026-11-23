/* Outcome-probability engine (football). No dependencies. Works in the browser and in Node.
 *
 * How it estimates:
 *  1. Expected goals for each team (lambda) come from either
 *     a) the bookmaker's own odds (1X2 + over/under 2.5), with the margin removed: usually the most accurate input, or
 *     b) team form numbers (average goals scored/conceded), or a blend of both.
 *  2. A Poisson score grid (with a Dixon-Coles low-score correction) gives the chance of every scoreline 0-0 ... 10-10.
 *  3. Any selection is a rule on the scoreline, so its probability is the sum of the grid cells where it wins.
 *     Several selections on the SAME match are evaluated together on the grid, so correlation is handled
 *     (e.g. "Home win" + "Over 2.5" is not just multiplied).
 *  4. Value: expected return per R1 staked = P(win) x odds. Above 1 means the price is better than our estimate.
 *
 * Honest limits: this is a statistical estimate, not a forecast of what will happen. It knows nothing about injuries,
 * line-ups, motivation or weather unless you adjust the inputs. Bookmakers build a margin into every price, so most
 * bets have negative expected value.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BetEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MAXG = 10;
  const fact = [1]; for (let i = 1; i <= MAXG; i++) fact[i] = fact[i - 1] * i;
  const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / fact[k];

  /** Score grid: grid[h][a] = P(home h goals, away a goals). rho < 0 slightly boosts 0-0 and 1-1 (Dixon-Coles). */
  function scoreGrid(lh, la, rho = -0.05) {
    const g = [];
    let total = 0;
    for (let h = 0; h <= MAXG; h++) {
      g[h] = [];
      for (let a = 0; a <= MAXG; a++) {
        let p = pois(h, lh) * pois(a, la);
        if (h === 0 && a === 0) p *= 1 - lh * la * rho;
        else if (h === 0 && a === 1) p *= 1 + lh * rho;
        else if (h === 1 && a === 0) p *= 1 + la * rho;
        else if (h === 1 && a === 1) p *= 1 - rho;
        g[h][a] = Math.max(p, 0); total += g[h][a];
      }
    }
    for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) g[h][a] /= total;
    return g;
  }

  /** Remove the bookmaker margin from a full market (all outcomes' odds). Returns fair probabilities + the margin. */
  function devig(oddsList) {
    const inv = oddsList.map(o => 1 / o);
    const book = inv.reduce((s, x) => s + x, 0);
    return { probs: inv.map(x => x / book), margin: book - 1 };
  }

  /* ---------- selections: each is a rule on a scoreline (h, a) ---------- */
  // result: 1 = win, 0 = lose, 0.5 = half refund (not used), "push" = stake returned
  const MARKETS = {
    "home":        { label: "Home win",            f: (h, a) => h > a },
    "draw":        { label: "Draw",                f: (h, a) => h === a },
    "away":        { label: "Away win",            f: (h, a) => a > h },
    "1x":          { label: "Double chance 1X",    f: (h, a) => h >= a },
    "x2":          { label: "Double chance X2",    f: (h, a) => a >= h },
    "12":          { label: "Double chance 12",    f: (h, a) => h !== a },
    "dnb-home":    { label: "Draw no bet: Home",   f: (h, a) => h > a, push: (h, a) => h === a },
    "dnb-away":    { label: "Draw no bet: Away",   f: (h, a) => a > h, push: (h, a) => h === a },
    "btts-yes":    { label: "Both teams to score", f: (h, a) => h > 0 && a > 0 },
    "btts-no":     { label: "BTTS: No",            f: (h, a) => !(h > 0 && a > 0) },
    "home-cs":     { label: "Home clean sheet",    f: (h, a) => a === 0 },
    "away-cs":     { label: "Away clean sheet",    f: (h, a) => h === 0 },
    "home-wtn":    { label: "Home win to nil",     f: (h, a) => h > a && a === 0 },
    "away-wtn":    { label: "Away win to nil",     f: (h, a) => a > h && h === 0 },
  };
  // parametrised markets: over-2.5, under-1.5, home-over-0.5, away-under-1.5, hcp-home--1.5, hcp-away-+1.5, cs-2-1
  function market(id) {
    if (MARKETS[id]) return MARKETS[id];
    let m;
    if ((m = id.match(/^(over|under)-(\d+\.5)$/))) {
      const line = +m[2], over = m[1] === "over";
      return { label: `${over ? "Over" : "Under"} ${line} goals`, f: (h, a) => over ? h + a > line : h + a < line };
    }
    if ((m = id.match(/^(home|away)-(over|under)-(\d+\.5)$/))) {
      const line = +m[3], over = m[2] === "over", home = m[1] === "home";
      return { label: `${home ? "Home" : "Away"} ${over ? "over" : "under"} ${line} goals`,
               f: (h, a) => { const g = home ? h : a; return over ? g > line : g < line; } };
    }
    if ((m = id.match(/^hcp-(home|away)-([+-]?\d+\.5)$/))) {
      const line = +m[2], home = m[1] === "home";
      return { label: `${home ? "Home" : "Away"} ${line > 0 ? "+" : ""}${line} handicap`,
               f: (h, a) => home ? h + line > a : a + line > h };
    }
    if ((m = id.match(/^cs-(\d+)-(\d+)$/))) {
      const H = +m[1], A = +m[2];
      return { label: `Correct score ${H}-${A}`, f: (h, a) => h === H && a === A };
    }
    throw new Error("Unknown market: " + id);
  }

  /** P(win), P(push) for one or more selections on the same match (all must win). */
  function evalOnGrid(grid, ids) {
    const ms = ids.map(market);
    let win = 0, push = 0;
    for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) {
      const p = grid[h][a];
      let allWin = true, anyPush = false;
      for (const m of ms) {
        if (m.push && m.push(h, a)) { anyPush = true; continue; }
        if (!m.f(h, a)) { allWin = false; break; }
      }
      if (!allWin) continue;
      if (anyPush) push += p; else win += p;
    }
    return { win, push };
  }

  /* ---------- expected goals (lambdas) ---------- */
  /** Fit home/away expected goals so the model matches the bookmaker's fair 1X2 and over/under 2.5 probabilities. */
  function lambdasFromOdds({ home, draw, away, over25, under25 }, rho = -0.05) {
    const x = devig([home, draw, away]).probs;
    const ou = over25 && under25 ? devig([over25, under25]).probs[0] : null;
    const err = (lh, la) => {
      const g = scoreGrid(lh, la, rho);
      const ph = evalOnGrid(g, ["home"]).win, pd = evalOnGrid(g, ["draw"]).win;
      let e = (ph - x[0]) ** 2 + (pd - x[1]) ** 2;
      if (ou !== null) e += (evalOnGrid(g, ["over-2.5"]).win - ou) ** 2;
      return e;
    };
    // coarse search, then refine around the best point (fast enough to run as you type on a phone)
    let best = null;
    for (let lh = 0.2; lh <= 4.0; lh += 0.1) for (let la = 0.2; la <= 3.6; la += 0.1) {
      const e = err(lh, la); if (!best || e < best.err) best = { lh, la, err: e };
    }
    for (const step of [0.02, 0.005]) {
      const c = { ...best };
      for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
        const lh = c.lh + i * step, la = c.la + j * step;
        if (lh < 0.05 || la < 0.05) continue;
        const e = err(lh, la); if (e < best.err) best = { lh, la, err: e };
      }
    }
    return { home: +best.lh.toFixed(2), away: +best.la.toFixed(2), fitError: best.err };
  }

  /** Expected goals from form. Use home-only / away-only averages when you have them (last 6-10 games is plenty). */
  function lambdasFromForm({ homeScored, homeConceded, awayScored, awayConceded, leagueHomeAvg = 1.5, leagueAwayAvg = 1.2 }) {
    const homeAtt = homeScored / leagueHomeAvg, awayDef = awayConceded / leagueHomeAvg;
    const awayAtt = awayScored / leagueAwayAvg, homeDef = homeConceded / leagueAwayAvg;
    return { home: +(homeAtt * awayDef * leagueHomeAvg).toFixed(2), away: +(awayAtt * homeDef * leagueAwayAvg).toFixed(2) };
  }

  /** Blend: weight 0..1 on the odds-based estimate (default 0.7, because the market already prices most news). */
  const blend = (a, b, w = 0.7) => ({ home: +(a.home * w + b.home * (1 - w)).toFixed(2), away: +(a.away * w + b.away * (1 - w)).toFixed(2) });

  /* ---------- analysis ---------- */
  /**
   * analyseSlip({ matches: [{ id, name, lambdas:{home,away}, rho? }], legs: [{ match, market, odds }] })
   * Legs on the same match are combined on that match's grid. Different matches are treated as independent.
   */
  function analyseSlip({ matches, legs }) {
    const grids = {};
    for (const m of matches) grids[m.id] = scoreGrid(m.lambdas.home, m.lambdas.away, m.rho ?? -0.05);

    const legOut = legs.map(l => {
      const { win, push } = evalOnGrid(grids[l.match], [l.market]);
      const pDecided = win + (1 - win - push);
      const ev = win * l.odds + push - 1;            // expected profit per R1
      return { ...l, label: market(l.market).label, prob: win, push,
               implied: 1 / l.odds, fairOdds: win > 0 ? 1 / (win / (pDecided || 1)) : Infinity,
               ev, value: ev > 0 };
    });

    // whole slip: same-match legs evaluated together (correlation), matches multiplied (independence)
    const byMatch = {};
    legs.forEach(l => (byMatch[l.match] ||= []).push(l.market));
    let pAll = 1, sameGame = false;
    for (const [mid, ids] of Object.entries(byMatch)) {
      if (ids.length > 1) sameGame = true;
      const r = evalOnGrid(grids[mid], ids);
      pAll *= r.win + r.push;                         // treat a push leg as "still alive" (stake carried at odds 1)
    }
    const totalOdds = legs.reduce((s, l) => s * l.odds, 1);
    const slip = { prob: pAll, totalOdds, ev: pAll * totalOdds - 1, sameGame,
                   oneIn: pAll > 0 ? Math.round(1 / pAll) : Infinity };

    // what if you dropped each leg?
    const drops = legs.map((l, i) => {
      if (legs.length < 2) return null;
      const rest = legs.filter((_, j) => j !== i);
      const r = analyseSlip({ matches, legs: rest }).slip;
      return { drop: legOut[i].label + " (" + nameOf(matches, l.match) + ")", prob: r.prob, totalOdds: r.totalOdds, ev: r.ev };
    }).filter(Boolean).sort((a, b) => b.prob - a.prob);

    // safer or better alternatives on the same match for each leg
    const alternatives = legs.map(l => ({
      for: legOut.find(x => x === legOut[legs.indexOf(l)]).label + " (" + nameOf(matches, l.match) + ")",
      options: alternativesFor(grids[l.match], l.market)
    }));

    return { legs: legOut, slip, drops, alternatives };
  }
  const nameOf = (ms, id) => (ms.find(m => m.id === id) || {}).name || id;

  /** Safer versions of a pick on the same match: options that still win in (almost) every scoreline where the
   *  original wins, plus more. Ranked by probability, with the minimum odds you'd need for value. */
  function alternativesFor(grid, currentId) {
    const pool = ["home","draw","away","1x","x2","12","dnb-home","dnb-away","btts-yes","btts-no",
                  "over-0.5","over-1.5","over-2.5","over-3.5","under-1.5","under-2.5","under-3.5","under-4.5",
                  "home-over-0.5","home-over-1.5","away-over-0.5","away-over-1.5",
                  "hcp-home-+1.5","hcp-away-+1.5","hcp-home--1.5","hcp-away--1.5","home-cs","away-cs"];
    const cur = evalOnGrid(grid, [currentId]).win;
    return pool.filter(id => id !== currentId).map(id => {
      const { win, push } = evalOnGrid(grid, [id]);
      return { market: id, label: market(id).label, prob: win, push, minOddsForValue: win > 0 ? (1 - push) / win : Infinity };
    }).filter(o => {
      if (!(o.prob + o.push > cur && o.prob < 0.97)) return false;   // "draw no bet" counts the refund as not losing
      const both = evalOnGrid(grid, [currentId, o.market]);
      return (both.win + both.push) / (cur || 1) >= 0.95;      // covers your original pick
    }).sort((a, b) => (a.prob + a.push) - (b.prob + b.push)).slice(0, 5);   // closest step up first
  }

  /* ---------- imported slips: rough estimates when the match's 1X2 odds are unknown ---------- */
  /** Rough expected goals from the slip's own legs only (a booking code carries the picked prices, not the full market).
   *  Fits the legs' de-margined prices, pulled gently towards an average match (2.6 goals, small home edge). */
  function lambdasFromLegs(legs, margin = 0.06) {
    const targets = legs.map(l => ({ id: l.market, p: Math.min(0.97, 1 / (l.odds * (1 + margin / 2))) }));
    const err = (lh, la) => {
      const g = scoreGrid(lh, la);
      let e = 0.02 * ((lh + la) - 2.6) ** 2 + 0.01 * ((lh - la) - 0.3) ** 2;
      for (const t of targets) { const r = evalOnGrid(g, [t.id]); e += (r.win / (1 - r.push || 1) - t.p) ** 2; }
      return e;
    };
    let best = null;
    for (let lh = 0.3; lh <= 3.6; lh += 0.1) for (let la = 0.3; la <= 3.2; la += 0.1) {
      const e = err(lh, la); if (!best || e < best.e) best = { lh, la, e };
    }
    return { home: +best.lh.toFixed(2), away: +best.la.toFixed(2), rough: true };
  }

  /** What a bookmaker would roughly charge for a market: fair odds shaved by its margin. Always label it an estimate. */
  const estOdds = (win, push, margin = 0.06) => win > 0 ? +(((1 - push) / win) / (1 + margin)).toFixed(2) : Infinity;

  /** Bigger-odds versions of a pick: markets that only win inside your pick's winning scorelines (so riskier), best chance first. */
  function upgradesFor(grid, currentId, margin = 0.06) {
    const pool = ["home","away","dnb-home","dnb-away","over-1.5","over-2.5","over-3.5","under-0.5","under-1.5","under-2.5",
                  "btts-yes","btts-no","home-over-1.5","away-over-1.5","home-over-2.5","away-over-2.5",
                  "hcp-home--1.5","hcp-away--1.5","home-wtn","away-wtn","home-cs","away-cs"];
    const cur = evalOnGrid(grid, [currentId]);
    return pool.filter(id => id !== currentId).map(id => {
      const { win, push } = evalOnGrid(grid, [id]);
      return { market: id, label: market(id).label, prob: win, push, estOdds: estOdds(win, push, margin) };
    }).filter(o => {
      if (!(o.prob > 0.05 && o.prob + o.push < cur.win + cur.push - 0.03)) return false;
      const both = evalOnGrid(grid, [currentId, o.market]);
      return both.win + both.push >= (o.prob + o.push) * 0.98;          // wins only where your pick wins
    }).sort((a, b) => b.prob - a.prob).slice(0, 3);
  }

  /** Whole-slip suggestions: a safer slip, a bigger-odds slip and a value slip (overpriced legs removed). */
  function suggestSlips({ matches, legs, margins = {} }) {
    const grids = {}; for (const m of matches) grids[m.id] = scoreGrid(m.lambdas.home, m.lambdas.away, m.rho ?? -0.05);
    const name = id => nameOf(matches, id);
    const base = analyseSlip({ matches, legs });
    const build = swaps => {
      const nl = legs.map((l, i) => swaps[i] ? { ...l, market: swaps[i].market, odds: swaps[i].estOdds } : l);
      return { ...analyseSlip({ matches, legs: nl }).slip, changes: swaps.map((s, i) => s && { leg: base.legs[i].label + " (" + name(legs[i].match) + ")", to: s.label, estOdds: s.estOdds }).filter(Boolean) };
    };
    // safer: each leg to its safest cover that still pays at least 1.20
    const safer = build(legs.map(l => {
      const m = margins[l.match] ?? 0.06;
      const opts = alternativesFor(grids[l.match], l.market).map(o => ({ ...o, estOdds: estOdds(o.prob, o.push, m) })).filter(o => o.estOdds >= 1.2);
      return opts.sort((a, b) => (b.prob + b.push) - (a.prob + a.push))[0] || null;
    }));
    // bigger: upgrade the single leg that is most likely to survive the upgrade
    const ups = legs.map(l => upgradesFor(grids[l.match], l.market, margins[l.match] ?? 0.06)[0] || null);
    const pick = ups.reduce((bi, u, i) => u && (bi < 0 || u.prob > ups[bi].prob) ? i : bi, -1);
    const bigger = pick < 0 ? null : build(legs.map((_, i) => i === pick ? ups[i] : null));
    // value: keep only legs the model does not call overpriced
    const keep = legs.filter((_, i) => base.legs[i].ev > -0.08);   // worse than a normal bookmaker margin
    const value = keep.length && keep.length < legs.length
      ? { ...analyseSlip({ matches, legs: keep }).slip, removed: base.legs.filter(l => l.ev <= -0.08).map(l => l.label + " (" + name(l.match) + ")") } : null;
    return { safer: safer.changes.length ? safer : null, bigger, value,
             upgrades: legs.map((l, i) => ({ for: base.legs[i].label + " (" + name(l.match) + ")", options: upgradesFor(grids[l.match], l.market, margins[l.match] ?? 0.06) })) };
  }

  return { scoreGrid, devig, market, evalOnGrid, lambdasFromOdds, lambdasFromForm, blend, analyseSlip, alternativesFor,
           lambdasFromLegs, estOdds, upgradesFor, suggestSlips };
});
