/* SlipCheck slip reader: turns Betway slip text (copied, shared or read from a screenshot) into matches + legs
 * that bet-engine.js understands. Pure functions, no DOM, so it runs in the browser and in Node tests.
 * Output: { code, matches:[{key, home, away, kickoff}], legs:[{matchKey, market, odds, raw, ok, why}] } */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SlipImport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ODDS = /(?:^|[\s@x×(])(\d{1,3}[.,]\d{2})(?=$|[\s)])/g;          // 2.00, 1,85, @1.45 (two decimals = a price)
  const VS = /^(.{2,40}?)\s+(?:v|vs\.?|VS|V|versus|-|–|—)\s+(.{2,40}?)$/;
  const VS2 = /^(.{2,40}?)\s+(?:v|vs\.?|versus)\s+(.{2,80})$/i;
  const NOISE = /\b(stake|payout|potential|return|win(?:nings)?\s*boost|total odds|bet saver|place bet|booking code|bet id|balance|max(?:imum)? win|tax|bonus|cash ?out|remove all|multi ?bet|single|share|betslip|bet slip|odds changed|accept)\b/i;
  const DATE = /\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow|\d{1,2}[:h]\d{2}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|\d{4}[-/]\d{2}[-/]\d{2})\b/i;

  const clean = s => s.replace(/[|•·▶►✓✔︎✅❌⚽]/g, " ").replace(/\s+/g, " ").trim();
  const norm = s => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9+.\-\s]/g, " ").replace(/\s+/g, " ").trim();
  const STOP = new Set(["fc", "afc", "cf", "sc", "united", "city", "the", "de", "la", "club", "real", "sporting", "athletic"]);
  const words = s => norm(s).split(" ").filter(w => w.length >= 3 && !STOP.has(w));

  /** Does text s refer to team t? (full name, any distinctive word, or a 3+ letter prefix like "Sundowns" / "Chiefs"). */
  function mentions(s, t) {
    const a = norm(s), b = norm(t);
    if (!a || !b) return false;
    if (a.includes(b) || (b.includes(a) && a.length >= 4)) return true;
    return words(t).some(w => new RegExp("\\b" + w.replace(/[.+\-]/g, "\\$&")).test(a));
  }

  function findCode(text) {
    const m = text.match(/(?:booking|book(?:ing)?\s*a\s*bet|bet)?\s*code[:\s#-]*([A-Z0-9]{5,12})\b/i);
    return m ? m[1].toUpperCase() : null;
  }

  /** Market + selection text -> engine market id (or null with a reason). */
  function classify(marketText, selText, home, away) {
    const mk = norm(marketText || ""), sel = norm(selText || ""), both = (mk + " " + sel).trim();
    const isH = mentions(sel, home) || /^(1|home)$/.test(sel), isA = mentions(sel, away) || /^(2|away)$/.test(sel);
    const hasDraw = /\b(draw|x)\b/.test(sel);
    let m;
    if (/half|1st|2nd|first|second|corner|card|booking|player|scorer|shot|throw|offside|minute|interval|ht\s*\/\s*ft/.test(both))
      return { none: "This market (halves, players, corners, cards) isn't modelled yet" };

    // double chance
    if (/double chance/.test(mk) || /\bor\b/.test(sel) || /^(1x|x2|12)$/.test(sel)) {
      if (/^1x$/.test(sel) || (isH && hasDraw)) return "1x";
      if (/^x2$/.test(sel) || (isA && hasDraw)) return "x2";
      if (/^12$/.test(sel) || (isH && isA)) return "12";
    }
    // draw no bet
    if (/draw no bet|\bdnb\b/.test(both)) { if (isH) return "dnb-home"; if (isA) return "dnb-away"; }
    // both teams to score
    if (/both teams|btts|\bgg\b|\bng\b|goal\s*\/?\s*no goal/.test(both)) {
      if (/\b(yes|gg|goal)\b/.test(sel) && !/no goal/.test(sel)) return "btts-yes";
      if (/\b(no|ng)\b/.test(sel) || /no goal/.test(sel)) return "btts-no";
    }
    // clean sheet / win to nil
    if (/win to nil/.test(both)) { if (isH || /\bhome\b/.test(mk)) return "home-wtn"; if (isA || /\baway\b/.test(mk)) return "away-wtn"; }
    if (/clean sheet/.test(both) && !/\bno\b/.test(sel)) {
      if (mentions(mk, home) || isH) return "home-cs"; if (mentions(mk, away) || isA) return "away-cs";
    }
    // correct score
    if (/correct score|exact score/.test(mk) && (m = sel.match(/(\d)\s*[-:]\s*(\d)/))) return `cs-${m[1]}-${m[2]}`;
    // handicap (half lines only: a whole line can refund, which the engine doesn't model)
    if ((m = (sel || mk).match(/([+-]\d+(?:\.\d)?)\b/)) && (/handicap|spread|hcp|ah\b/.test(both) || isH || isA)) {
      const line = +m[1];
      if (Math.abs(line % 1) !== 0.5) return { none: `Handicap ${m[1]} has a refund line; only .5 lines are supported` };
      if (isH) return `hcp-home-${line > 0 ? "+" : ""}${line}`;
      if (isA) return `hcp-away-${line > 0 ? "+" : ""}${line}`;
    }
    // totals (match or team)
    if ((m = both.match(/\b(over|under|o|u)\s*\/?\s*(\d+(?:\.\d)?)\b/))) {
      const side = m[1][0] === "o" ? "over" : "under", line = +m[2];
      // "Over/Under 2.5" header + "Over" selection: take the side from the selection
      const sideSel = /\bunder\b/.test(sel) ? "under" : /\bover\b/.test(sel) ? "over" : side;
      const ln = (sel.match(/(\d+(?:\.\d)?)/) || [, line])[1];
      if (Math.abs(+ln % 1) !== 0.5) return { none: `Goal line ${ln} has a refund line; only .5 lines are supported` };
      const teamTotal = /team|total goals?\s*-|goals? by/.test(mk) || mentions(mk, home) !== mentions(mk, away) || isH !== isA;
      if (teamTotal && (mentions(mk, home) || isH)) return `home-${sideSel}-${ln}`;
      if (teamTotal && (mentions(mk, away) || isA)) return `away-${sideSel}-${ln}`;
      return `${sideSel}-${ln}`;
    }
    // 1X2 / match result (also when there is no market line at all)
    if (!mk || /1x2|1 x 2|match result|full ?time result|match winner|3 ?way|win ?draw ?win|result|ft\b/.test(mk)) {
      if (/^(draw|x|tie)$/.test(sel) || (/\b(draw|tie)$/.test(sel) && !/\bor\b|no bet/.test(sel))) return "draw";
      if (isH && !isA) return "home";
      if (isA && !isH) return "away";
    }
    return { none: "Couldn't recognise this market" };
  }

  /** Parse slip text. Works on Betway app/web slip copy, WhatsApp shares and OCR output.
   *  Slips come in two orders: match line first (shared text), or pick + market + price first with the match line
   *  underneath (the app's bet slip, as read from a screenshot). Both are tried; the one with more readable picks wins. */
  function parseSlip(text) {
    const code = findCode(text);
    const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
    const a = matchFirst(lines, code), b = pickFirst(lines, code);
    const okCount = r => r.legs.filter(l => l.ok).length;
    return okCount(b) > okCount(a) ? b : a;
  }

  /** "Home v Away" on its own line? Returns [home, away] or null. */
  function matchLine(textPart) {
    const vs = textPart.match(VS);
    if (!vs || !/[a-z]{2}/i.test(vs[1]) || !/[a-z]{2}/i.test(vs[2]) || /^\d/.test(vs[2]) || /\b(over|under)\b/i.test(textPart)) return null;
    return [clean(vs[1]), clean(vs[2].replace(DATE, " "))];
  }

  /** App layout: "Kaizer Chiefs" (pick), "1X2 2.00" (market + price), then "Kaizer Chiefs v Orlando Pirates". */
  function pickFirst(lines, code) {
    const matches = [], legs = [];
    let sel = "", mk = "", odds = null;
    for (const line of lines) {
      if (NOISE.test(line) && !VS.test(line)) { sel = mk = ""; odds = null; continue; }
      const o = [...line.matchAll(ODDS)].map(m => parseFloat(m[1].replace(",", "."))).filter(x => x > 1 && x < 1000);
      const textPart = clean(line.replace(ODDS, " ").replace(/@/g, " "));
      const ht = o.length ? null : matchLine(textPart);
      if (ht) {
        const [home, away] = ht, key = norm(home) + "|" + norm(away);
        const cur = matches.find(m => m.key === key) || (matches.push({ key, home, away, kickoff: "" }), matches[matches.length - 1]);
        if (odds) {
          let id = classify(mk, sel, home, away);
          if (id && id.none) { const alt = classify("", [mk, sel].join(" "), home, away); if (alt && !alt.none) id = alt; }
          const ok = typeof id === "string";
          legs.push({ matchKey: cur.key, market: ok ? id : null, odds, raw: [mk, sel].filter(Boolean).join(" · ") || line, ok, why: ok ? "" : id.none });
        }
        sel = mk = ""; odds = null; continue;
      }
      if (DATE.test(textPart) && !o.length && textPart.replace(DATE, "").trim().length < 8) continue;   // kick-off time
      if (textPart) { if (!sel) sel = textPart; else if (!mk) mk = textPart; }                            // pick first, then market
      if (o.length) odds = o[o.length - 1];
    }
    return { code, matches: matches.filter(m => legs.some(l => l.matchKey === m.key)), legs };
  }

  function matchFirst(lines, code) {
    const matches = [], legs = [];
    let cur = null, marketLine = "", lastText = "";

    const pushLeg = (sel, odds, raw) => {
      if (!cur) return;
      if (!sel && lastText) sel = lastText;
      let id = classify(marketLine, sel, cur.home, cur.away);
      if ((!id || id.none) && lastText && lastText !== sel) {               // selection on its own line above the price
        const alt = classify(marketLine, lastText, cur.home, cur.away); if (alt && !alt.none) id = alt;
      }
      if ((!id || id.none) && marketLine) {                                   // e.g. "Over 2.5" written as the market line
        const alt = classify("", marketLine + " " + sel, cur.home, cur.away); if (alt && !alt.none) id = alt;
      }
      const ok = typeof id === "string";
      legs.push({ matchKey: cur.key, market: ok ? id : null, odds, raw: [marketLine, sel].filter(Boolean).join(" · ") || raw, ok, why: ok ? "" : id.none });
      marketLine = ""; lastText = "";
    };

    for (const line of lines) {
      if (NOISE.test(line) && !VS.test(line)) continue;
      const odds = [...line.matchAll(ODDS)].map(m => parseFloat(m[1].replace(",", "."))).filter(o => o > 1 && o < 1000);
      const textPart = clean(line.replace(ODDS, " ").replace(/@/g, " "));
      let vs = textPart.match(VS2), selHere = "";
      if (vs && /^(over|under)$/i.test(vs[1].trim())) vs = null;
      if (vs) { const parts = vs[2].split(/\s+[-–—:]\s+/); vs = [vs[0], vs[1], parts[0]]; selHere = parts.slice(1).join(" "); }
      else vs = textPart.match(VS);
      if (vs && /[a-z]{2}/i.test(vs[1]) && /[a-z]{2}/i.test(vs[2]) && !/^\d/.test(vs[2]) && (selHere || !/\b(over|under)\b/i.test(textPart))) {
        const home = clean(vs[1]), away = clean(vs[2].replace(DATE, " "));
        const key = norm(home) + "|" + norm(away);
        cur = matches.find(m => m.key === key) || (matches.push({ key, home, away, kickoff: "" }), matches[matches.length - 1]);
        marketLine = ""; lastText = "";
        if (odds.length) pushLeg(selHere, odds[odds.length - 1], line);        // "Arsenal vs Chelsea - Arsenal @1.85" style
        else if (selHere) marketLine = selHere;
        continue;
      }
      if (cur && DATE.test(textPart) && !odds.length && textPart.replace(DATE, "").trim().length < 8) { cur.kickoff ||= textPart; continue; }
      if (odds.length) { pushLeg(textPart, odds[odds.length - 1], line); continue; }
      if (!cur) continue;
      // a text line: market header or a selection waiting for its price on the next line
      if (/1x2|result|winner|double chance|draw no bet|both teams|btts|total|over|under|handicap|correct score|clean sheet|to nil|goals|gg|ng/i.test(textPart) && !marketLine) marketLine = textPart;
      else lastText = textPart;
    }
    return { code, matches, legs };
  }

  return { parseSlip, classify, mentions, findCode };
});
