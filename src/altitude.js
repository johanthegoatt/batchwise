// The high-altitude card. Put in how high up you are and read back the usual
// starting adjustments for baking: a little less leavening and sugar, a little
// more liquid, and a hotter oven. All the figures come from the engine; this
// only reads the boxes and writes the answer.
(function () {
  "use strict";
  var B = window.Batchwise;
  var val = document.getElementById("alt-value");
  var unit = document.getElementById("alt-unit");
  var out = document.getElementById("alt-out");
  if (!B || !val || !out) return;

  var TSP = { 0.125: "⅛", 0.25: "¼", 0.375: "⅜", 0.5: "½" };
  function tsp(n) { return TSP[n] || String(n); }

  // "1–2 tbsp", "up to 1 tbsp", "¼ tsp" from a [lo, hi] range.
  function range(r, unitWord, frac) {
    var lo = r[0], hi = r[1];
    var f = frac ? tsp : String;
    if (lo === hi) return f(hi) + " " + unitWord;
    if (lo === 0) return "up to " + f(hi) + " " + unitWord;
    return f(lo) + "–" + f(hi) + " " + unitWord;
  }

  function render() {
    var a = B.altitude({ value: val.value, unit: unit.value });
    if (!a) {
      out.innerHTML = val.value.trim() ? '<p class="oven-none">That is not a height I can read. Try a number like 5000.</p>' : "";
      return;
    }
    if (!a.change) {
      out.innerHTML = '<p class="oven-note">At ' + a.feet.toLocaleString() + " ft the air is near enough sea level. Bake the recipe as written.</p>";
      return;
    }
    out.innerHTML =
      '<div class="oven-row"><span>Band</span><b>' + a.band + "</b></div>" +
      '<div class="oven-row"><span>Baking powder/soda</span><b>' + range(a.bakingPowderPerTsp, "tsp less per tsp", true) + "</b></div>" +
      '<div class="oven-row"><span>Sugar</span><b>' + range(a.sugarPerCup, "tbsp less per cup") + "</b></div>" +
      '<div class="oven-row"><span>Liquid</span><b>' + range(a.liquidPerCup, "tbsp more per cup") + "</b></div>" +
      '<div class="oven-row"><span>Oven</span><b>' + range(a.ovenF, "°F hotter") + " (" + range(a.ovenC, "°C") + ")</b></div>" +
      '<p class="oven-note">Starting points, not a rule. Change one thing at a time and see how it bakes.</p>';
  }

  [val, unit].forEach(function (e) {
    e.addEventListener("input", render);
    e.addEventListener("change", render);
  });
  render();
})();
