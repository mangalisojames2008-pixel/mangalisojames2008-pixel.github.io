const E = require("./bet-engine.js");
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const near = (a, b, t) => Math.abs(a - b) <= t;

// 1. grid sums to 1
const g = E.scoreGrid(1.6, 1.1);
let s = 0; g.forEach(r => r.forEach(p => (s += p)));
assert(near(s, 1, 1e-9), "score grid sums to 1");

// 2. 1X2 partition
const ph = E.evalOnGrid(g, ["home"]).win, pd = E.evalOnGrid(g, ["draw"]).win, pa = E.evalOnGrid(g, ["away"]).win;
assert(near(ph + pd + pa, 1, 1e-9), "home+draw+away = 1");
assert(near(E.evalOnGrid(g, ["1x"]).win, ph + pd, 1e-9), "1X = home + draw");
assert(near(E.evalOnGrid(g, ["over-2.5"]).win + E.evalOnGrid(g, ["under-2.5"]).win, 1, 1e-9), "over+under 2.5 = 1");
assert(near(E.evalOnGrid(g, ["hcp-home--1.5"]).win + E.evalOnGrid(g, ["hcp-away-+1.5"]).win, 1, 1e-9), "handicaps complement");

// 3. devig
const d = E.devig([2.0, 3.4, 3.8]);
assert(near(d.probs.reduce((a, b) => a + b), 1, 1e-9) && d.margin > 0, `devig margin ${(d.margin * 100).toFixed(1)}%`);

// 4. fit from odds reproduces the market
const lam = E.lambdasFromOdds({ home: 2.0, draw: 3.4, away: 3.8, over25: 1.9, under25: 1.9 });
const g2 = E.scoreGrid(lam.home, lam.away);
const fair = E.devig([2.0, 3.4, 3.8]).probs;
assert(near(E.evalOnGrid(g2, ["home"]).win, fair[0], 0.015), `fitted home ${E.evalOnGrid(g2, ["home"]).win.toFixed(3)} vs fair ${fair[0].toFixed(3)} (λ ${lam.home}/${lam.away})`);
assert(near(E.evalOnGrid(g2, ["over-2.5"]).win, 0.5, 0.02), "fitted over 2.5 ≈ 50%");

// 5. correlation: same-game home win + over 2.5 is not the product of the two
const j = E.evalOnGrid(g2, ["home", "over-2.5"]).win;
const prod = E.evalOnGrid(g2, ["home"]).win * E.evalOnGrid(g2, ["over-2.5"]).win;
assert(j > prod, `same-game correlation handled: joint ${j.toFixed(3)} > product ${prod.toFixed(3)}`);

// 6. full slip example
const res = E.analyseSlip({
  matches: [
    { id: "m1", name: "Chiefs v Pirates", lambdas: lam },
    { id: "m2", name: "Sundowns v Stellies", lambdas: E.lambdasFromOdds({ home: 1.45, draw: 4.2, away: 7.0, over25: 1.8, under25: 2.0 }) },
  ],
  legs: [
    { match: "m1", market: "home", odds: 2.0 },
    { match: "m1", market: "over-2.5", odds: 1.9 },
    { match: "m2", market: "home", odds: 1.45 },
    { match: "m2", market: "btts-yes", odds: 2.1 },
  ],
});
console.log("\nLEGS"); res.legs.forEach(l => console.log(` ${l.label.padEnd(22)} odds ${l.odds}  P=${(l.prob*100).toFixed(1)}%  implied ${(l.implied*100).toFixed(1)}%  EV ${(l.ev*100).toFixed(1)}%`));
console.log(`SLIP  P=${(res.slip.prob*100).toFixed(2)}% (1 in ${res.slip.oneIn})  odds ${res.slip.totalOdds.toFixed(2)}  EV ${(res.slip.ev*100).toFixed(1)}%  sameGame=${res.slip.sameGame}`);
console.log("DROP ONE LEG"); res.drops.forEach(d => console.log(`  without ${d.drop}: P=${(d.prob*100).toFixed(1)}% odds ${d.totalOdds.toFixed(2)}`));
console.log("ALTERNATIVES for leg 1"); res.alternatives[0].options.forEach(o => console.log(`  ${o.label.padEnd(24)} P=${(o.prob*100).toFixed(1)}%${o.push?" (+"+(o.push*100).toFixed(1)+"% refund)":""}  needs odds ≥ ${o.minOddsForValue.toFixed(2)}`));
assert(res.slip.prob > 0 && res.slip.prob < 0.2, "4-leg slip probability is small and positive");

// 7. form-based lambdas
const f = E.lambdasFromForm({ homeScored: 2.0, homeConceded: 0.8, awayScored: 1.0, awayConceded: 1.6 });
assert(f.home > f.away, `form lambdas ${f.home}/${f.away}`);

// 8. DNB push handled
const dnb = E.evalOnGrid(g2, ["dnb-home"]);
assert(near(dnb.push, E.evalOnGrid(g2, ["draw"]).win, 1e-9), "draw no bet refunds on draw");
