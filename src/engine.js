// Batchwise engine: read a recipe's ingredient lines, scale them, and write
// the amounts back as things you can actually measure. No DOM in here, so
// the same file runs in the page and under `node --test`.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Batchwise = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------------------------------------------------------- units

  // Cup and spoon sizes differ by country. A US cup is 236.6 ml; the UK,
  // Canada, New Zealand and Australia use a 250 ml cup, and Australia also
  // uses a 20 ml tablespoon (4 teaspoons, not 3).
  var SYSTEMS = {
    us: { name: "US", tsp: 4.92892, tbsp: 14.7868, cup: 236.588 },
    metric: { name: "UK, Canada, NZ", tsp: 5, tbsp: 15, cup: 250 },
    au: { name: "Australia", tsp: 5, tbsp: 20, cup: 250 }
  };

  var VOLUME = {
    tsp: /^(teaspoons?|tsps?|t)$/,
    tbsp: /^(tablespoons?|tbsps?|tbs|tbl)$/,
    cup: /^(cups?|c)$/,
    ml: /^(ml|millilit(er|re)s?|mls)$/,
    l: /^(l|lit(er|re)s?)$/,
    dl: /^(dl|decilit(er|re)s?)$/,
    floz: /^(fl\.? ?oz|fluid ounces?)$/,
    pint: /^(pints?|pts?)$/,
    quart: /^(quarts?|qts?)$/
  };
  var WEIGHT = {
    g: /^(g|grams?|grammes?|gr)$/,
    kg: /^(kg|kilos?|kilograms?)$/,
    oz: /^(oz|ounces?)$/,
    lb: /^(lbs?|pounds?)$/
  };
  var GRAMS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
  var COUNTISH = /^(pinch(es)?|dash(es)?|cloves?|cans?|tins?|packets?|packs?|sticks?|slices?|bunch(es)?|sprigs?|handfuls?|pieces?|heads?|stalks?|sheets?|jars?|bags?|envelopes?)$/;

  function volumeMl(unit, sys) {
    var s = SYSTEMS[sys] || SYSTEMS.us;
    switch (unit) {
      case "tsp": return s.tsp;
      case "tbsp": return s.tbsp;
      case "cup": return s.cup;
      case "ml": return 1;
      case "l": return 1000;
      case "dl": return 100;
      case "floz": return sys === "us" ? 29.5735 : 28.4131;
      case "pint": return sys === "us" ? 473.176 : 568.261;
      case "quart": return sys === "us" ? 946.353 : 1136.52;
    }
    return null;
  }

  // ---------------------------------------------------------- ingredients

  // Grams in one US cup, from King Arthur Baking's ingredient weight chart
  // (kingarthurbaking.com/learn/ingredient-weight-chart). Rows the chart
  // gives for a tablespoon or half cup are multiplied up. Order matters:
  // the first match wins, so "brown sugar" sits above "sugar".
  var DENSITY = [
    [/\balmond flour\b/, 96, "almond flour"],
    [/\balmond meal\b/, 84, "almond meal"],
    [/\b(coconut|rice|oat|chickpea|gram|rye|buckwheat|cassava|tapioca|corn|spelt) flour\b/, null],
    [/\bwhole ?wheat flour\b|\bwholemeal flour\b/, 113, "whole wheat flour"],
    [/\bsemolina\b/, 163, "semolina"],
    [/\bflour\b/, 120, "flour"],
    [/\bbrown sugar\b/, 213, "brown sugar"],
    [/\b(powdered|confectioners'?|icing) sugar\b/, 113, "powdered sugar"],
    [/\bsugar\b/, 198, "sugar"],
    [/\bbaking powder\b/, 192, "baking powder"],
    [/\bbaking soda\b|\bbicarbonate of soda\b|\bbicarb\b/, 288, "baking soda"],
    [/\bkosher salt\b|\bflaky salt\b|\bsea salt flakes\b/, null],
    [/\bsalt\b/, 288, "table salt"],
    [/\bcornstarch\b|\bcornflour\b/, 112, "cornstarch"],
    [/\bcornmeal\b|\bpolenta\b/, 138, "cornmeal"],
    [/\bcocoa\b/, 84, "cocoa"],
    [/\bpeanut butter\b/, 270, "peanut butter"],
    [/\bcream cheese\b/, 227, "cream cheese"],
    [/\bbutter\b/, 227, "butter"],
    [/\bhoney\b/, 336, "honey"],
    [/\bmaple syrup\b/, 312, "maple syrup"],
    [/\bmolasses\b|\btreacle\b/, 340, "molasses"],
    [/\b(vegetable|canola|olive|sunflower|rapeseed|neutral|coconut)? ?oil\b/, 198, "oil"],
    [/\bsour cream\b/, 227, "sour cream"],
    [/\byog(h)?urt\b/, 227, "yogurt"],
    [/\b(heavy|double|single|whipping|light)? ?cream\b|\bhalf[- &]+half\b/, 227, "cream"],
    [/\bbuttermilk\b|\bmilk\b/, 227, "milk"],
    [/\bapple ?sauce\b/, 255, "applesauce"],
    [/\bwater\b/, 227, "water"],
    [/\b(rolled |old[- ]fashioned |quick )?oats\b/, 89, "oats"],
    [/\b(white |long[- ]grain |basmati |jasmine )?rice\b/, 198, "rice"],
    [/\bchocolate chips\b|\bchoc(olate)? chips\b/, 170, "chocolate chips"],
    [/\braisins\b|\bsultanas\b|\bcurrants\b/, 149, "raisins"],
    [/\b(?:chopped )?dates\b/, 149, "dates"],
    [/\b(?:desiccated|shredded|flaked|sweetened|unsweetened) coconut\b/, 85, "shredded coconut"],
    [/\bwalnuts\b|\bpecans\b/, 113, "chopped nuts"],
    [/\b(cheddar|mozzarella|jack|swiss|gruy[eè]re)\b.*\b(grated|shredded)\b|\b(grated|shredded)\b.*\bcheese\b/, 113, "grated cheese"]
  ];

  function density(name) {
    var n = String(name || "").toLowerCase();
    for (var i = 0; i < DENSITY.length; i++) {
      if (DENSITY[i][0].test(n)) return DENSITY[i][1] ? { gPerCup: DENSITY[i][1], label: DENSITY[i][2] } : null;
    }
    return null;
  }

  // One large egg is about 50 g out of the shell and about 3 tablespoons
  // beaten: 1 tablespoon of yolk and 2 of white (American Egg Board chart).
  var EGG = {
    whole: { g: 50, tbsp: 3, one: "egg", many: "eggs" },
    yolk: { g: 18, tbsp: 1, one: "egg yolk", many: "egg yolks" },
    white: { g: 32, tbsp: 2, one: "egg white", many: "egg whites" }
  };
  function eggKind(name, unit) {
    var n = String(name || "").toLowerCase();
    if (unit && unit !== "count") return null;
    if (/\byolks?\b/.test(n)) return "yolk";
    if (/\bwhites?\b/.test(n) && /\beggs?\b/.test(n)) return "white";
    if (/^(large |medium |small |extra[- ]large |free[- ]range |whole )*eggs?\b/.test(n.trim())) return "whole";
    return null;
  }

  // ------------------------------------------------------------- numbers

  var UNICODE = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
  var UNI = "½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞";

  // One amount: "2", "1.5", "1,5", "1/2", "1 1/2", "1½", "½".
  var NUM = "(?:\\d+\\s*[" + UNI + "]|\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?|[" + UNI + "])";
  var LEAD = new RegExp("^\\s*(?:[-*•]\\s*)?(" + NUM + ")(?:\\s*(?:-|–|to)\\s*(" + NUM + "))?\\s*(.*)$");

  function toNumber(s) {
    s = String(s).trim();
    var m;
    if ((m = s.match(new RegExp("^(\\d+)\\s*([" + UNI + "])$")))) return +m[1] + UNICODE[m[2]];
    if (UNICODE[s] !== undefined) return UNICODE[s];
    if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return m[2] > 0 ? m[1] / m[2] : NaN;
    return parseFloat(s.replace(",", "."));
  }

  // ---------------------------------------------------------------- parse

  // Unit word to unit key, or null. A bare "T" is a tablespoon and a bare
  // "t" a teaspoon, as old recipe cards write them; anything else is
  // matched case-insensitively.
  function unitOf(word) {
    var lower = word.toLowerCase(), k;
    if (word === "T") return "tbsp";
    for (k in VOLUME) if (VOLUME[k].test(lower)) return k;
    for (k in WEIGHT) if (WEIGHT[k].test(lower)) return k;
    return null;
  }

  // "1/2 cup + 2 tbsp sugar": a second amount of the same kind, which has
  // to scale with the first instead of riding along in the name.
  var PLUS = new RegExp("^\\+\\s*(" + NUM + ")\\s*(fl\\.? ?oz|fluid ounces?|[A-Za-z]+)\\.?(?=\\s|$|,)\\s*(?:of\\s+)?(.*)$");

  function parseLine(raw) {
    var line = String(raw || "").replace(/\s+$/, "");
    var out = { raw: line, qty: null, max: null, unit: null, kind: null, name: line.trim() };
    if (!line.trim()) { out.kind = "blank"; return out; }
    if (/:$/.test(line.trim()) && !/\d/.test(line)) { out.kind = "heading"; return out; }
    // Recipe sites write "1⁄2" with the fraction slash (U+2044), not "/".
    var text = line.replace(/[\u2044\u2215]/g, "/");
    // "juice of 1 lemon": the number sits after the words it scales.
    var of = text.match(/^\s*(?:[-*•]\s*)?((?:the\s+)?(?:juice|zest|zest and juice|juice and zest|seeds)\s+of\s+)(.*)$/i);
    var prefix = "";
    if (of) { prefix = of[1]; text = of[2]; }
    var m = text.match(LEAD);
    if (!m) { out.kind = "text"; return out; }
    out.prefix = prefix;
    out.qty = toNumber(m[1]);
    out.max = m[2] ? toNumber(m[2]) : null;
    if (!isFinite(out.qty) || out.qty <= 0) { out.qty = null; out.kind = "text"; return out; }
    var rest = m[3];
    var size = "";
    // "1 (14 oz) can tomatoes": the bracket is the size of each can.
    var sized = rest.match(/^(\([^)]*\))\s*([A-Za-z]+)\b\s*(.*)$/);
    if (sized && COUNTISH.test(sized[2].toLowerCase())) {
      size = sized[1] + " ";
      rest = sized[2] + " " + sized[3];
    }
    var unitMatch = rest.match(/^(fl\.? ?oz|fluid ounces?|[A-Za-z]+)\.?(?=\s|$|,)\s*(?:of\s+)?(.*)$/);
    var unit = null, name = rest;
    if (unitMatch) {
      var lower = unitMatch[1].toLowerCase();
      unit = unitOf(unitMatch[1]);
      if (!unit && COUNTISH.test(lower)) unit = /(ch|sh)es$/.test(lower) ? lower.slice(0, -2) : lower.replace(/s$/, "");
      if (unit) name = unitMatch[2];
    }
    out.unit = unit || "count";
    out.name = name.trim();
    out.size = size;
    if (VOLUME[out.unit]) out.kind = "volume";
    else if (WEIGHT[out.unit]) out.kind = "weight";
    else out.kind = eggKind(out.name, out.unit === "count" ? null : out.unit) ? "egg" : "count";
    // "1 cup (2 sticks) butter": the bracket says the same amount another
    // way, and it would be wrong once scaled, so it goes.
    if (out.kind === "volume" || out.kind === "weight") {
      var plus = out.max == null && out.name.match(PLUS);
      var plusUnit = plus && unitOf(plus[2]);
      if (plusUnit && (out.kind === "volume" ? VOLUME[plusUnit] : WEIGHT[plusUnit]) && toNumber(plus[1]) > 0) {
        out.plus = { qty: toNumber(plus[1]), unit: plusUnit };
        out.name = plus[3].trim();
      }
      out.name = out.name.replace(/^\([^)]*\)\s*/, "");
    }
    return out;
  }

  function parse(text) {
    return String(text || "").split(/\r?\n/).map(parseLine);
  }

  // -------------------------------------------------------------- scaling

  function panArea(p) {
    if (!p) return NaN;
    if (p.shape === "round") return Math.PI * Math.pow(p.a / 2, 2);
    if (p.shape === "square") return p.a * p.a;
    return p.a * p.b;
  }

  // Bake the same recipe in a different pan: scale by the ratio of the
  // floor areas so the batter stays the same depth.
  function panFactor(from, to) {
    var a = panArea(from), b = panArea(to);
    return a > 0 && b > 0 ? b / a : NaN;
  }

  // ---------------------------------------------------------- oven heat

  // Recipes name an oven heat in °C, °F or a gas mark, and for a conventional
  // oven or a fan (convection) one. A fan oven runs hotter for the same dial,
  // so the usual advice is to set it about 20°C (25°F) lower than a recipe
  // written for a conventional oven, or keep the heat and cut the time by
  // roughly a quarter. Gas marks follow the standard British chart.
  //   Sources: Hoover and AO oven guides (fan = conventional − 20°C),
  //   Baking Like a Chef (−25°F or −25% time; gas mark °F = mark*25 + 250).
  var FAN_DROP_C = 20;
  var GAS_C = { 0.25: 110, 0.5: 120, 1: 140, 2: 150, 3: 170, 4: 180, 5: 190, 6: 200, 7: 220, 8: 230, 9: 240 };

  function cToF(c) { return c * 9 / 5 + 32; }
  function fToC(f) { return (f - 32) * 5 / 9; }
  function round5(n) { return Math.round(n / 5) * 5; }

  function gasToC(mark) {
    if (GAS_C[mark] != null) return GAS_C[mark];
    // Between or beyond the chart, fall back to the °F formula.
    return fToC(mark * 25 + 250);
  }
  function cToGas(c) {
    var best = null, diff = Infinity;
    for (var k in GAS_C) {
      var d = Math.abs(GAS_C[k] - c);
      if (d < diff) { diff = d; best = parseFloat(k); }
    }
    // Only call it a gas mark if it is close to a real setting.
    return diff <= 10 ? best : null;
  }
  function gasText(mark) {
    if (mark == null) return null;
    return mark === 0.25 ? "¼" : mark === 0.5 ? "½" : String(mark);
  }

  // Convert one oven heat to all the others. `input.unit` is "c", "f" or
  // "gas"; `input.type` is "conventional" (the default) or "fan", saying what
  // the number in hand already is. Returns the conventional and fan settings
  // in every unit, plus a note about trading heat for time.
  function oven(input) {
    input = input || {};
    var unit = input.unit || "c";
    var type = input.type === "fan" ? "fan" : "conventional";
    var v = typeof input.value === "number" ? input.value : toNumber(String(input.value));
    if (!isFinite(v)) return null;

    var c = unit === "f" ? fToC(v) : unit === "gas" ? gasToC(v) : v;
    // Whatever was given, work out the conventional heat first.
    var convC = type === "fan" ? c + FAN_DROP_C : c;
    convC = round5(convC);
    var fanC = round5(convC - FAN_DROP_C);

    return {
      conventional: { c: convC, f: round5(cToF(convC)), gas: cToGas(convC), gasText: gasText(cToGas(convC)) },
      fan: { c: fanC, f: round5(cToF(fanC)) },
      note: "Or keep it at " + convC + "°C and take about a quarter off the time."
    };
  }

  // -------------------------------------------------------- friendly text

  var FRAC = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [1, ""]];

  function nice(x, steps) {
    // Round to the nearest "steps" fraction, written with a fraction glyph.
    steps = steps || FRAC;
    var whole = Math.floor(x + 1e-9), rest = x - whole, best = steps[0], diff = Infinity;
    for (var i = 0; i < steps.length; i++) {
      var d = Math.abs(rest - steps[i][0]);
      if (d < diff - 1e-9) { diff = d; best = steps[i]; }
    }
    if (best[0] === 1) { whole += 1; best = [0, ""]; }
    if (!whole && !best[1]) return "0";
    return (whole ? String(whole) : "") + best[1];
  }

  function plural(n, one, many) { return n > 1 + 1e-9 || n === 0 ? many : one; }

  var CUP_FRAC = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
  var CUP_GLYPH = { 0: "", 0.25: "¼", 0.3333: "⅓", 0.5: "½", 0.6667: "⅔", 0.75: "¾" };
  function cupText(n) {
    var w = Math.floor(n + 1e-9), f = Math.round((n - w) * 10000) / 10000;
    if (f >= 0.9999) { w += 1; f = 0; }
    return (w ? String(w) : "") + (CUP_GLYPH[f] || "");
  }

  // Write a volume in cups and spoons you own: cup fractions down to ¼
  // and ⅓, tablespoons, and teaspoons down to ⅛. What is left over after
  // the cup fraction goes on as whole tablespoons, so 0.3 cups reads as
  // "¼ cup + 1 tbsp", not "0.3 cups".
  function spoons(ml, sys) {
    var s = SYSTEMS[sys] || SYSTEMS.us;
    var tsp = ml / s.tsp, tbspT = s.tbsp / s.tsp, cupT = s.cup / s.tsp;
    if (tsp < tbspT - 1e-9) {
      var t = nice(tsp, [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 2, "½"], [3 / 4, "¾"], [1, ""]]);
      if (t === "0") t = "⅛";
      if (t === String(Math.round(tbspT))) return "1 tbsp";
      return t + " tsp";
    }
    if (tsp < cupT / 4 - tbspT / 2) {
      var tb = Math.floor(tsp / tbspT + 1e-9), rem = tsp - tb * tbspT;
      var rt = nice(rem, [[0, ""], [1 / 2, "½"], [1, ""]]);
      if (rt === String(Math.round(tbspT))) { tb += 1; rt = "0"; }
      if (tb * tbspT >= cupT / 4 - 1e-9) return "¼ cup";
      return tb + " tbsp" + (rt !== "0" ? " + " + rt + " tsp" : "");
    }
    var cups = tsp / cupT, w = Math.floor(cups + 1e-9), f = cups - w;
    // Nearest cup fraction, if it is within half a tablespoon.
    for (var i = 0; i < CUP_FRAC.length; i++) {
      if (Math.abs(f - CUP_FRAC[i]) * cupT <= tbspT / 2 + 1e-9) return cupText(w + CUP_FRAC[i]) + " " + plural(w + CUP_FRAC[i], "cup", "cups");
    }
    var lower = 0;
    for (var j = 0; j < CUP_FRAC.length; j++) if (CUP_FRAC[j] <= f) lower = CUP_FRAC[j];
    var extra = Math.round((f - lower) * cupT / tbspT);
    var base = w + lower;
    return (base ? cupText(base) + " " + plural(base, "cup", "cups") + " + " : "") + extra + " tbsp";
  }

  function roundTo(x, step) { return Math.round(x / step) * step; }

  function gramsText(g) {
    if (g >= 1000) return (roundTo(g, 10) / 1000).toFixed(2).replace(/\.?0+$/, "") + " kg";
    if (g >= 100) return roundTo(g, 5) + " g";
    if (g >= 10) return Math.round(g) + " g";
    var h = roundTo(g, 0.5);
    return (h || 0.5) + " g";
  }

  function mlText(ml) {
    if (ml >= 1000) return (roundTo(ml, 10) / 1000).toFixed(2).replace(/\.?0+$/, "") + " l";
    if (ml >= 100) return roundTo(ml, 5) + " ml";
    if (ml >= 10) return Math.round(ml) + " ml";
    return (roundTo(ml, 0.5) || 0.5) + " ml";
  }

  function ozText(g) {
    var oz = g / GRAMS.oz;
    if (oz >= 16) {
      var lb = Math.floor(oz / 16), rest = roundTo(oz - lb * 16, 0.5);
      if (rest >= 16) { lb += 1; rest = 0; }
      return lb + " lb" + (rest ? " " + rest + " oz" : "");
    }
    return nice(oz, [[0, ""], [1 / 4, "¼"], [1 / 2, "½"], [3 / 4, "¾"], [1, ""]]).replace(/^0$/, "¼") + " oz";
  }

  function countText(n) {
    // Counts round to halves: you can use half an onion, not 0.37 of one.
    var t = nice(n, [[0, ""], [1 / 4, "¼"], [1 / 2, "½"], [3 / 4, "¾"], [1, ""]]);
    return t === "0" ? "¼" : t;
  }

  // --------------------------------------------------------------- output

  // Scale one parsed line. `opts.units` is "as" (keep the recipe's units),
  // "cups" (cups and spoons) or "grams" (grams, or ml when the weight is
  // not known). `opts.system` is the cup size the recipe was written with.
  function scaleLine(p, factor, opts) {
    opts = opts || {};
    var sys = opts.system || "us", units = opts.units || "as";
    var res = { raw: p.raw, kind: p.kind, name: p.name, amount: "", note: "", grams: null, odd: false, prefix: p.prefix || "" };
    if (p.qty == null) { res.amount = ""; return res; }
    var q = p.qty * factor, q2 = p.max != null ? p.max * factor : null;
    var dens = density(p.name);

    if (p.kind === "volume") {
      var ml = q * volumeMl(p.unit, sys), ml2 = q2 != null ? q2 * volumeMl(p.unit, sys) : null;
      if (p.plus) ml += p.plus.qty * factor * volumeMl(p.plus.unit, sys);
      var gPerMl = dens ? dens.gPerCup / SYSTEMS.us.cup : null;
      if (gPerMl) res.grams = ml * gPerMl;
      if (units === "grams" && gPerMl) res.amount = range(gramsText(ml * gPerMl), ml2 != null && gramsText(ml2 * gPerMl));
      else if (units === "grams" || (units === "as" && /^(ml|l|dl)$/.test(p.unit))) res.amount = range(mlText(ml), ml2 != null && mlText(ml2));
      else res.amount = range(spoons(ml, sys), ml2 != null && spoons(ml2, sys));
      if (units !== "grams" && gPerMl && opts.showGrams) res.note = "about " + gramsText(ml * gPerMl);
      return res;
    }

    if (p.kind === "weight") {
      var g = q * GRAMS[p.unit], g2 = q2 != null ? q2 * GRAMS[p.unit] : null;
      if (p.plus) g += p.plus.qty * factor * GRAMS[p.plus.unit];
      res.grams = g;
      if (units === "cups" && dens) {
        var cupMl = g / (dens.gPerCup / SYSTEMS.us.cup);
        res.amount = range(spoons(cupMl, sys), g2 != null && spoons(g2 / (dens.gPerCup / SYSTEMS.us.cup), sys));
      } else if (units === "grams" || (units === "as" && /^(g|kg)$/.test(p.unit)) || units === "cups") {
        res.amount = range(gramsText(g), g2 != null && gramsText(g2));
      } else {
        res.amount = range(ozText(g), g2 != null && ozText(g2));
      }
      return res;
    }

    if (p.kind === "egg") {
      var kind = eggKind(p.name, null), e = EGG[kind];
      var whole = Math.floor(q + 0.15), part = q - whole;
      if (part < 0.15) part = 0;
      res.amount = part ? nice(q, [[0, ""], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [1, ""]]) : String(whole);
      res.name = eggNoun(p.name, q > 1 + 1e-9 ? 2 : 1);
      res.grams = q * e.g;
      if (part) {
        res.odd = true;
        var tb = part * e.tbsp;
        var bit = tb >= 0.85 ? nice(tb, [[0, ""], [1 / 2, "½"], [1, ""]]) + " tbsp" : nice(tb * 3, [[0, ""], [1 / 2, "½"], [1, ""]]) + " tsp";
        var grams = Math.round(part * e.g) + " g";
        res.note = whole
          ? "use " + whole + ", then beat 1 more and add " + bit + " (" + grams + ") of it"
          : "beat 1 " + e.one + " and use " + bit + " (" + grams + ") of it";
      }
      return res;
    }

    // Counts: onions, cans, cloves, pinches, sticks of butter.
    if (p.unit === "stick" && /\bbutter\b/i.test(p.name)) {
      var tbspN = Math.round(q * 8);
      res.grams = q * 113;
      if (units === "grams") { res.amount = gramsText(q * 113); res.unitDone = true; return res; }
      var sticks = Math.floor(tbspN / 8), extra = tbspN - sticks * 8;
      res.amount = (sticks ? sticks + " " + plural(sticks, "stick", "sticks") : "") + (sticks && extra ? " + " : "") + (extra ? extra + " tbsp" : "");
      res.unitDone = true;
      return res;
    }
    res.amount = range(countText(q), q2 != null && countText(q2));
    if (p.unit !== "count") res.amount += " " + (p.size || "") + (q > 1 + 1e-9 || (q2 || 0) > 1 ? pluralUnit(p.unit) : p.unit);
    if (Math.abs(q * 2 - Math.round(q * 2)) > 0.1 && p.unit === "count") res.odd = true;
    // Half a 14 oz can is easier to measure as 7 oz than to eyeball.
    var inner = q2 == null && Math.abs(q - Math.round(q)) > 0.05 && packageSize(p.size || p.name);
    if (inner) res.note = "about " + (inner.kind === "weight"
      ? (/^(g|kg)$/.test(inner.unit) || units === "grams" ? gramsText(q * inner.qty * GRAMS[inner.unit]) : ozText(q * inner.qty * GRAMS[inner.unit]))
      : (/^(ml|l|dl)$/.test(inner.unit) || units === "grams" ? mlText(q * inner.qty * volumeMl(inner.unit, sys)) : spoons(q * inner.qty * volumeMl(inner.unit, sys), sys)));
    return res;
  }

  // The "(14 oz)" in "1 (14 oz) can" or "1 can (14 oz)", as an amount.
  function packageSize(text) {
    var m = String(text || "").match(new RegExp("^\\s*\\((" + NUM + ")\\s*(fl\\.? ?oz|[A-Za-z]+)\\.?\\)"));
    var unit = m && unitOf(m[2]);
    if (!unit) return null;
    return { qty: toNumber(m[1]), unit: unit, kind: VOLUME[unit] ? "volume" : "weight" };
  }

  // "1 large eggs" reads wrong once the count changes.
  function eggNoun(name, n) {
    return n > 1 ? name.replace(/\b(egg|yolk|white)\b(?!.*\b(eggs?|yolks?|whites?)\b)/, "$1s") : name.replace(/\b(egg|yolk|white)s\b/, "$1");
  }

  function pluralUnit(u) {
    if (/(ch|sh)$/.test(u)) return u + "es";
    return u + "s";
  }

  // "2 tbsp to 3 tbsp" reads better as "2 to 3 tbsp".
  function range(a, b) {
    if (!b || b === a) return a;
    var ua = a.match(/^([^ ]+) ([a-z]+)$/), ub = b.match(/^([^ ]+) ([a-z]+)$/);
    if (ua && ub && ua[2] === ub[2]) return ua[1] + " to " + b;
    return a + " to " + b;
  }

  // Scale a whole recipe. Returns one row per input line, in order.
  function scale(text, factor, opts) {
    return parse(text).map(function (p) {
      var r = scaleLine(p, factor, opts);
      r.line = r.amount ? (r.prefix + r.amount + " " + r.name).trim() : r.raw.trim();
      return r;
    });
  }

  // A plain-text copy of the scaled list, for a note or a message.
  function toText(rows, title) {
    var lines = [];
    if (title) lines.push(title, "");
    rows.forEach(function (r) {
      if (r.kind === "blank") { lines.push(""); return; }
      lines.push((r.kind === "heading" || r.kind === "text" ? "" : "- ") + r.line + (r.note ? " (" + r.note + ")" : ""));
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // ------------------------------------------------------------ share link

  // The recipe goes in the URL fragment, which browsers never send to a
  // server. UTF-8 safe base64, with URL-safe characters.
  function encodeShare(state) {
    var json = JSON.stringify(state);
    var b64 = typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeShare(s) {
    try {
      var b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
      var json = typeof atob === "function"
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, "base64").toString("utf8");
      var o = JSON.parse(json);
      return o && typeof o === "object" ? o : null;
    } catch (e) { return null; }
  }

  return {
    SYSTEMS: SYSTEMS,
    parse: parse,
    parseLine: parseLine,
    toNumber: toNumber,
    density: density,
    panArea: panArea,
    panFactor: panFactor,
    oven: oven,
    gasToC: gasToC,
    cToGas: cToGas,
    spoons: spoons,
    gramsText: gramsText,
    scaleLine: scaleLine,
    scale: scale,
    toText: toText,
    encodeShare: encodeShare,
    decodeShare: decodeShare
  };
});
