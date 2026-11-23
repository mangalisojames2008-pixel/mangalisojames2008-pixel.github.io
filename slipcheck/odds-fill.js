/* Optional: fill each imported match's full 1X2 + over/under 2.5 prices from The Odds API (the-odds-api.com, free key).
 * A booking code only carries the prices you picked; the engine needs the whole 1X2 market to estimate goals properly.
 * Prefers Betway's own prices when the feed has them, otherwise the median across bookmakers. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./slip-import.js"));
  else root.OddsFill = factory(root.SlipImport);
})(typeof self !== "undefined" ? self : this, function (SI) {
  "use strict";
  const BASE = "https://api.the-odds-api.com/v4";
  const median = a => { const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length ? (s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2) : null; };

  async function getJSON(url, fetchFn) {
    const r = await fetchFn(url);
    if (r.status === 401) throw new Error("The odds key was rejected. Check it under Sharper results in step 01.");
    if (r.status === 429) throw new Error("The free odds allowance is used up for now.");
    if (!r.ok) throw new Error("Odds feed error " + r.status);
    return r.json();
  }

  /** wanted: [{home, away}] -> same order: {o1, ox, o2, oo, ou, book} or null when not found. */
  async function fill(apiKey, wanted, fetchFn = (u) => fetch(u)) {
    const k = encodeURIComponent(apiKey);
    const sports = (await getJSON(`${BASE}/sports?apiKey=${k}`, fetchFn)).filter(s => s.group === "Soccer" && s.active && !s.has_outrights);
    // event lists don't use up the allowance: scan leagues in small batches until every match is found
    const found = wanted.map(() => null);
    for (let i = 0; i < sports.length && found.some(f => !f); i += 8) {
      const lists = await Promise.all(sports.slice(i, i + 8).map(s =>
        getJSON(`${BASE}/sports/${s.key}/events?apiKey=${k}`, fetchFn).then(ev => ev.map(e => ({ ...e, sport: s.key }))).catch(() => [])));
      const events = lists.flat();
      wanted.forEach((w, j) => {
        if (found[j]) return;
        const e = events.find(e => SI.mentions(e.home_team, w.home) && SI.mentions(e.away_team, w.away))
               || events.find(e => SI.mentions(w.home, e.home_team) && SI.mentions(w.away, e.away_team));
        if (e) found[j] = e;
      });
    }
    // prices: about 2 credits per match (two markets, one region)
    return Promise.all(found.map(async e => {
      if (!e) return null;
      const d = await getJSON(`${BASE}/sports/${e.sport}/events/${e.id}/odds?apiKey=${k}&regions=uk&markets=h2h,totals&oddsFormat=decimal`, fetchFn);
      const books = d.bookmakers || [];
      const use = books.filter(b => /betway/i.test(b.key)).length ? books.filter(b => /betway/i.test(b.key)) : books;
      const pick = (mkey, test) => median(use.flatMap(b => (b.markets || []).filter(m => m.key === mkey).flatMap(m => m.outcomes.filter(test).map(o => o.price))));
      const out = {
        o1: pick("h2h", o => o.name === d.home_team), ox: pick("h2h", o => o.name === "Draw"), o2: pick("h2h", o => o.name === d.away_team),
        oo: pick("totals", o => o.name === "Over" && o.point === 2.5), ou: pick("totals", o => o.name === "Under" && o.point === 2.5),
        book: use === books ? `median of ${books.length} bookmakers` : "Betway", kickoff: e.commence_time
      };
      return out.o1 && out.ox && out.o2 ? out : null;
    }));
  }
  return { fill };
});
