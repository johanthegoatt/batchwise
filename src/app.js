// Batchwise page: wires the form to the engine, keeps the last recipe in
// localStorage, and tells Scoop what is going on.
(function () {
  "use strict";
  var B = window.Batchwise, S = window.Scoop;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "batchwise.v1";

  // Pans in inches. Metric names are the sizes sold in the UK and Europe.
  var PANS = [
    ["r8", "8 inch round", { shape: "round", a: 8 }],
    ["r9", "9 inch round", { shape: "round", a: 9 }],
    ["r10", "10 inch round", { shape: "round", a: 10 }],
    ["r20", "20 cm round", { shape: "round", a: 20 / 2.54 }],
    ["r23", "23 cm round", { shape: "round", a: 23 / 2.54 }],
    ["s8", "8 inch square", { shape: "square", a: 8 }],
    ["s9", "9 inch square", { shape: "square", a: 9 }],
    ["s20", "20 cm square", { shape: "square", a: 20 / 2.54 }],
    ["x139", "13 × 9 inch tray", { shape: "rect", a: 13, b: 9 }],
    ["x117", "11 × 7 inch tray", { shape: "rect", a: 11, b: 7 }],
    ["x3323", "33 × 23 cm tray", { shape: "rect", a: 33 / 2.54, b: 23 / 2.54 }],
    ["l95", "9 × 5 inch loaf", { shape: "rect", a: 9, b: 5 }],
    ["l854", "8½ × 4½ inch loaf", { shape: "rect", a: 8.5, b: 4.5 }],
    ["other", "Other size…", null]
  ];

  var EXAMPLE = {
    t: "Chocolate chip cookies",
    r: "2 1/4 cups all-purpose flour\n1 tsp baking soda\n1 tsp salt\n1 cup (2 sticks) butter, softened\n3/4 cup granulated sugar\n3/4 cup packed brown sugar\n1 tsp vanilla extract\n2 large eggs\n2 cups chocolate chips",
    from: 48, to: 18
  };

  var state = {
    t: "", r: "", s: "us", m: "serves", from: 4, to: 6, f: 2,
    pf: "r8", pt: "r9", po: { from: { shape: "round", a: 8, b: 8, u: "in" }, to: { shape: "round", a: 9, b: 9, u: "in" } },
    u: "as", done: {}
  };

  function load() {
    var hash = location.hash.slice(1), shared = hash && B.decodeShare(hash);
    if (shared) { Object.assign(state, shared, { done: {} }); return "shared"; }
    try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) Object.assign(state, saved); } catch (e) {}
    return state.r ? "saved" : "new";
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ------------------------------------------------------------- factor

  function panOf(side) {
    var id = side === "from" ? state.pf : state.pt;
    if (id !== "other") return PANS.filter(function (p) { return p[0] === id; })[0][2];
    var o = state.po[side], k = o.u === "cm" ? 1 / 2.54 : 1;
    return { shape: o.shape, a: +o.a * k, b: +o.b * k };
  }

  function factor() {
    if (state.m === "serves") return state.from > 0 && state.to > 0 ? state.to / state.from : NaN;
    if (state.m === "times") return +state.f;
    return B.panFactor(panOf("from"), panOf("to"));
  }

  function factorText(f) {
    if (!isFinite(f) || f <= 0) return "";
    var r = Math.round(f * 100) / 100;
    if (Math.abs(f - 1) < 0.005) return "Same amounts as the recipe.";
    return "Everything × " + r + (f < 1 ? " (about " + Math.round(f * 100) + "% of the recipe)" : "");
  }

  // ------------------------------------------------------------- render

  var lastOdd = 0, lastCount = 0;

  function render(reason) {
    var f = factor();
    $("factor").textContent = factorText(f);
    var rows = isFinite(f) && f > 0 ? B.scale(state.r, f, { system: state.s, units: state.u, showGrams: state.u === "as" }) : [];
    var items = rows.filter(function (r) { return r.kind !== "blank"; });
    var list = $("list");
    list.textContent = "";
    var odd = 0, count = 0;
    rows.forEach(function (r, i) {
      if (r.kind === "blank") return;
      var li = document.createElement("li");
      if (r.kind === "heading") { li.className = "head"; li.textContent = r.raw.trim(); list.appendChild(li); return; }
      if (r.kind === "text") { li.className = "note"; li.textContent = r.raw.trim(); list.appendChild(li); return; }
      count++;
      if (r.odd) odd++;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "row" + (state.done[i] ? " done" : "");
      b.setAttribute("aria-pressed", state.done[i] ? "true" : "false");
      b.dataset.i = i;
      var box = document.createElement("span"); box.className = "box"; box.textContent = state.done[i] ? "✓" : ""; box.setAttribute("aria-hidden", "true");
      var amt = document.createElement("span"); amt.className = "amt"; amt.textContent = r.amount;
      var what = document.createElement("span"); what.className = "what"; what.textContent = r.name;
      if (r.note) {
        var sm = document.createElement("small");
        sm.textContent = r.note;
        if (r.odd) sm.className = "odd";
        what.appendChild(sm);
      }
      b.append(box, amt, what);
      li.appendChild(b);
      list.appendChild(li);
    });
    var any = items.length > 0;
    $("result-empty").hidden = any;
    $("result-actions").hidden = !any;
    $("result-hint").hidden = !any;

    S.context({ ingredients: count, factor: f, odd: odd, units: state.u });
    if (reason === "size" && odd > lastOdd) S.react("odd", { what: oddWhat(rows) });
    lastOdd = odd;
    if (reason === "paste" && count && count !== lastCount) S.react("pasted", { count: count });
    lastCount = count;
    save();
    return rows;
  }

  function oddWhat(rows) {
    var r = rows.filter(function (x) { return x.odd; })[0];
    return r ? (r.kind === "egg" ? "egg" : r.name) : "";
  }

  // ------------------------------------------------------------- inputs

  function setMode(m) {
    state.m = m;
    document.querySelectorAll(".mode").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.mode === m)); });
    document.querySelectorAll(".pane").forEach(function (p) { p.hidden = p.dataset.pane !== m; });
    syncChips();
  }

  function syncChips() {
    document.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(Math.abs(+c.dataset.f - state.f) < 0.001)); });
  }

  function buildPan(side) {
    var box = $("pan-" + side);
    box.textContent = "";
    var sel = document.createElement("select");
    sel.className = "wide";
    sel.setAttribute("aria-label", side === "from" ? "The recipe's pan" : "Your pan");
    PANS.forEach(function (p) {
      var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o);
    });
    sel.value = side === "from" ? state.pf : state.pt;
    box.appendChild(sel);
    var o = state.po[side];
    if (sel.value === "other") {
      var shape = document.createElement("select");
      shape.setAttribute("aria-label", "Shape");
      [["round", "Round"], ["square", "Square"], ["rect", "Rectangle"]].forEach(function (s) {
        var op = document.createElement("option"); op.value = s[0]; op.textContent = s[1]; shape.appendChild(op);
      });
      shape.value = o.shape;
      var unit = document.createElement("select");
      unit.setAttribute("aria-label", "Inches or centimetres");
      [["in", "inches"], ["cm", "cm"]].forEach(function (s) {
        var op = document.createElement("option"); op.value = s[0]; op.textContent = s[1]; unit.appendChild(op);
      });
      unit.value = o.u;
      var a = num(o.a, o.shape === "round" ? "Across" : o.shape === "square" ? "Side" : "Long side");
      box.append(shape, unit, a);
      if (o.shape === "rect") box.appendChild(num(o.b, "Short side", "b"));
      shape.addEventListener("change", function () { o.shape = shape.value; buildPan(side); render("size"); });
      unit.addEventListener("change", function () { o.u = unit.value; render("size"); });
    }
    sel.addEventListener("change", function () {
      if (side === "from") state.pf = sel.value; else state.pt = sel.value;
      buildPan(side);
      render("size");
      panHint();
    });

    function num(v, label, key) {
      var wrap = document.createElement("label");
      wrap.className = "size" + (o.shape === "rect" ? "" : " wide");
      var input = document.createElement("input");
      input.type = "number"; input.min = "1"; input.max = "100"; input.step = "0.5"; input.value = v; input.inputMode = "decimal";
      input.setAttribute("aria-label", label);
      input.addEventListener("input", function () { o[key || "a"] = input.value; render("size"); });
      wrap.append(input);
      return wrap;
    }
  }

  function panHint() {
    var f = factor();
    $("pan-hint").textContent = state.m === "pan" && isFinite(f)
      ? "This keeps the batter the same depth. A different pan bakes at a different speed, so start checking it a few minutes early."
      : "";
  }

  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function shareState() {
    return { t: state.t, r: state.r, s: state.s, m: state.m, from: state.from, to: state.to, f: state.f, pf: state.pf, pt: state.pt, po: state.po, u: state.u };
  }

  function fillInputs() {
    $("title").value = state.t;
    $("recipe").value = state.r;
    $("system").value = state.s;
    $("from-serves").value = state.from;
    $("to-serves").value = state.to;
    $("times").value = state.f;
    document.querySelector('input[name="units"][value="' + state.u + '"]').checked = true;
    setMode(state.m);
    buildPan("from");
    buildPan("to");
    panHint();
  }

  // Wire up
  var how = load();
  fillInputs();

  var pasteTimer = null;
  $("recipe").addEventListener("input", function () {
    state.r = $("recipe").value;
    state.done = {};
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(function () { render("paste"); }, 250);
  });
  $("title").addEventListener("input", function () { state.t = $("title").value; save(); });
  $("system").addEventListener("change", function () {
    state.s = $("system").value;
    render("system");
    S.react("system", { s: state.s });
  });
  $("try-example").addEventListener("click", function () {
    Object.assign(state, { t: EXAMPLE.t, r: EXAMPLE.r, m: "serves", from: EXAMPLE.from, to: EXAMPLE.to, done: {} });
    fillInputs();
    render("paste");
    S.react("example");
  });

  document.querySelectorAll(".mode").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.mode); render("size"); panHint(); S.react("mode", { m: state.m }); });
  });
  ["from-serves", "to-serves"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      state.from = +$("from-serves").value; state.to = +$("to-serves").value;
      render("size");
      S.react("factor", { f: factor() });
    });
  });
  $("times").addEventListener("input", function () { state.f = +$("times").value; syncChips(); render("size"); S.react("factor", { f: factor() }); });
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      state.f = +c.dataset.f; $("times").value = Math.round(state.f * 100) / 100; syncChips(); render("size");
      S.react("factor", { f: state.f });
    });
  });
  document.querySelectorAll('input[name="units"]').forEach(function (r) {
    r.addEventListener("change", function () { state.u = r.value; render("units"); S.react("units", { u: state.u }); });
  });

  $("list").addEventListener("click", function (ev) {
    var b = ev.target.closest(".row");
    if (!b) return;
    var i = b.dataset.i;
    if (state.done[i]) delete state.done[i]; else state.done[i] = 1;
    var rows = render("tick");
    var total = rows.filter(function (r) { return r.amount; }).length;
    var done = Object.keys(state.done).length;
    S.react("tick", { on: !!state.done[i], left: total - done });
    var again = $("list").querySelector('[data-i="' + i + '"]');
    if (again) again.focus();
  });

  $("copy-list").addEventListener("click", function () {
    var f = factor();
    var rows = B.scale(state.r, f, { system: state.s, units: state.u });
    var title = (state.t || "Recipe") + " (× " + Math.round(f * 100) / 100 + ")";
    copy(B.toText(rows, title)).then(function () { toast("List copied"); S.react("copied"); });
  });
  $("copy-link").addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#" + B.encodeShare(shareState());
    copy(url).then(function () { toast("Link copied"); S.react("link"); });
  });
  $("print").addEventListener("click", function () { window.print(); });
  $("start-over").addEventListener("click", function () {
    if (state.r && !confirm("Clear this recipe and start again?")) return;
    Object.assign(state, { t: "", r: "", done: {} });
    history.replaceState(null, "", location.pathname);
    fillInputs();
    render();
    S.react("reset");
    $("recipe").focus();
  });

  render();
  if (how === "shared") S.react("opened");
  else if (how === "new") S.react("hello");
})();
