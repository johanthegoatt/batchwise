// The yeast-swap card. Put in an amount and the two yeast types, and read back
// the weight to use, with a note on whether the new kind needs dissolving
// first. All the ratios come from the engine; this only reads the boxes and
// writes the answer.
(function () {
  "use strict";
  var B = window.Batchwise;
  var val = document.getElementById("yeast-value");
  var from = document.getElementById("yeast-from");
  var to = document.getElementById("yeast-to");
  var out = document.getElementById("yeast-out");
  if (!B || !val || !out) return;

  function gramsText(g) {
    // A tidy gram figure: no trailing ".00", but keep a useful decimal.
    var r = Math.round(g * 10) / 10;
    return (Math.round(r) === r ? String(Math.round(r)) : r.toFixed(1)) + " g";
  }

  function render() {
    if (val.value.trim() === "") { out.innerHTML = ""; return; }
    var r = B.yeastConvert(val.value, from.value, to.value);
    if (!r) {
      out.innerHTML = '<p class="oven-none">Put in an amount in grams, like 7.</p>';
      return;
    }
    if (r.from === r.to) {
      out.innerHTML = '<p class="oven-note">Same type, so it stays ' + gramsText(r.grams) + ". " + r.note + "</p>";
      return;
    }
    out.innerHTML =
      '<div class="oven-row"><span>' + r.toLabel + '</span><b>' + gramsText(r.grams) + "</b></div>" +
      '<p class="oven-note">' + r.note + "</p>";
  }

  [val, from, to].forEach(function (e) {
    e.addEventListener("input", render);
    e.addEventListener("change", render);
  });
  render();
})();
