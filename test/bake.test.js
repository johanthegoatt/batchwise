"use strict";
var test = require("node:test");
var assert = require("node:assert");
var B = require("../src/engine.js");

var R20 = { shape: "round", a: 20 };
var R23 = { shape: "round", a: 23 };
var S8 = { shape: "square", a: 8 };

test("same pan means about the same time", function () {
  var r = B.panBake(R20, R20, 30);
  assert.strictEqual(r.direction, "same");
  assert.strictEqual(r.estimate, 30);
  assert.strictEqual(r.deeper, false);
});

test("a wider pan is shallower and bakes faster", function () {
  var r = B.panBake(R20, R23, 30);
  assert.strictEqual(r.direction, "shorter");
  assert.strictEqual(r.deeper, false);
  assert.ok(r.estimate < 30);
  assert.ok(r.checkAt < 30);
});

test("a narrower pan is deeper and bakes longer", function () {
  var r = B.panBake(R23, R20, 30);
  assert.strictEqual(r.direction, "longer");
  assert.strictEqual(r.deeper, true);
  assert.ok(r.estimate > 30);
  // depth change here is modest, so not a "split it" case.
  assert.strictEqual(r.split, false);
});

test("a dramatic change flags splitting between pans", function () {
  // A small round into a big tray: very shallow, big depth change.
  var r = B.panBake({ shape: "round", a: 30 }, { shape: "rect", a: 9, b: 5 }, 40);
  assert.strictEqual(r.split, true);
  assert.ok(r.low > 0 && r.high >= r.low);
});

test("bad inputs return null, not NaN", function () {
  assert.strictEqual(B.panBake(R20, S8, 0), null);
  assert.strictEqual(B.panBake(null, R20, 30), null);
  assert.strictEqual(B.panBake(R20, R20, "not a number"), null);
});

test("the estimate band brackets the point estimate", function () {
  var r = B.panBake(R23, R20, 45);
  assert.ok(r.low <= r.estimate && r.estimate <= r.high);
});
