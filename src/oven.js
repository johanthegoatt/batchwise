// The oven-temperature card. A small, self-contained helper: put in the heat
// a recipe gives, say what unit it is and which oven it was written for, and
// read it back for a normal oven and a fan oven, in °C, °F and gas mark. All
// the maths lives in the engine; this only reads the boxes and writes the
// answer.
(function () {
  "use strict";
  var B = window.Batchwise;
  var val = document.getElementById("oven-value");
  var unit = document.getElementById("oven-unit");
  var type = document.getElementById("oven-type");
  var out = document.getElementById("oven-out");
  if (!B || !val || !out) return;

  function render() {
    var o = B.oven({ value: val.value, unit: unit.value, type: type.value });
    if (!o) {
      out.innerHTML = val.value.trim() ? '<p class="oven-none">That is not a heat I can read. Try a number like 180.</p>' : "";
      return;
    }
    var gas = o.conventional.gasText ? "gas mark " + o.conventional.gasText : "no gas mark close";
    out.innerHTML =
      '<div class="oven-row"><span>Normal oven</span><b>' + o.conventional.c + "°C · " + o.conventional.f + "°F · " + gas + "</b></div>" +
      '<div class="oven-row"><span>Fan oven</span><b>' + o.fan.c + "°C · " + o.fan.f + "°F</b></div>" +
      '<p class="oven-note">' + o.note + "</p>";
  }

  [val, unit, type].forEach(function (e) {
    e.addEventListener("input", render);
    e.addEventListener("change", render);
  });
  render();
})();
