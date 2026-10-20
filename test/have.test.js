"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../src/engine.js");

function line(s) { return B.parseLine(s); }

test("scale to grams of flour I have (volume recipe, weight on hand)", () => {
  // Recipe wants 2 cups flour (= 240 g). I have 300 g. Factor should be 1.25.
  const f = B.factorFromHave(line("2 cups flour"), 300, "g", "us");
  assert.ok(Math.abs(f - 1.25) < 0.01, "got " + f);
});

test("scale to weight when recipe is already in grams", () => {
  const f = B.factorFromHave(line("200 g sugar"), 100, "g", "us");
  assert.ok(Math.abs(f - 0.5) < 1e-9, "got " + f);
});

test("scale by a count of eggs", () => {
  const f = B.factorFromHave(line("2 eggs"), 3, "", "us");
  assert.ok(Math.abs(f - 1.5) < 1e-9, "got " + f);
});

test("volume on hand against a volume recipe", () => {
  const f = B.factorFromHave(line("1 cup milk"), 2, "cups", "us");
  assert.ok(Math.abs(f - 2) < 1e-9, "got " + f);
});

test("a count against a weight can't be compared", () => {
  // Recipe is "3 lemons" (count); I say I have 200 g. Nothing to match on.
  assert.equal(B.factorFromHave(line("3 lemons"), 200, "g", "us"), null);
});

test("applying the factor rescales the whole recipe", () => {
  const f = B.factorFromHave(line("2 cups flour"), 300, "g", "us");
  const rows = B.scale("2 cups flour\n1 cup sugar", f, { system: "us", units: "grams" });
  // Flour should now read ~300 g.
  assert.match(rows[0].amount, /300 g/);
});
