const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../src/engine.js");

const line = (text, f, opts) => B.scale(text, f, opts)[0];

test("reads the amounts recipes are written with", () => {
  assert.equal(B.toNumber("1/2"), 0.5);
  assert.equal(B.toNumber("1 1/2"), 1.5);
  assert.equal(B.toNumber("1½"), 1.5);
  assert.equal(B.toNumber("¾"), 0.75);
  assert.equal(B.toNumber("1,5"), 1.5);
  const p = B.parseLine("2-3 tbsp milk");
  assert.deepEqual([p.qty, p.max, p.unit, p.name], [2, 3, "tbsp", "milk"]);
  assert.equal(B.parseLine("1 T honey").unit, "tbsp");
  assert.equal(B.parseLine("1 t salt").unit, "tsp");
  assert.equal(B.parseLine("- 200g caster sugar").unit, "g");
  assert.equal(B.parseLine("salt to taste").kind, "text");
  assert.equal(B.parseLine("For the icing:").kind, "heading");
});

test("writes scaled volumes as cups and spoons you own", () => {
  assert.equal(line("2 1/4 cups flour", 1.5).amount, "3⅓ cups + 1 tbsp");
  assert.equal(line("3/4 cup sugar", 1.5).amount, "1 cup + 2 tbsp");
  assert.equal(line("3/4 cup sugar", 0.5).amount, "⅓ cup + 1 tbsp");
  assert.equal(line("1 tsp baking soda", 0.5).amount, "½ tsp");
  assert.equal(line("1 tbsp honey", 1.5).amount, "1 tbsp + 1½ tsp");
  assert.equal(line("1 tsp salt", 3).amount, "1 tbsp");
  assert.equal(line("2 tbsp oil", 2).amount, "¼ cup");
  assert.equal(line("1 cup milk", 1 / 3).amount, "⅓ cup");
  assert.equal(line("2-3 tbsp milk", 1).amount, "2 to 3 tbsp");
});

test("Australian tablespoons hold four teaspoons", () => {
  // 1 AU tbsp = 20 ml. Half of one is 10 ml, which is 2 teaspoons.
  assert.equal(line("1 tbsp sugar", 0.5, { system: "au" }).amount, "2 tsp");
  assert.equal(line("1 tbsp sugar", 0.5, { system: "us" }).amount, "1½ tsp");
});

test("converts to grams with King Arthur's chart", () => {
  const g = { units: "grams" };
  assert.equal(line("1 cup all-purpose flour", 1, g).amount, "120 g");
  assert.equal(line("1 cup packed brown sugar", 1, g).amount, "215 g");
  assert.equal(line("1 cup sugar", 1, g).amount, "200 g");
  assert.equal(line("1 tbsp honey", 1, g).amount, "21 g");
  // Unknown weight per cup falls back to ml rather than guessing.
  assert.equal(line("1 tsp vanilla extract", 1, g).amount, "5 ml");
  assert.equal(line("1 cup almond flour", 1, g).amount, "235 ml");
  // Kosher salt brands differ by almost 2x, so no single weight.
  assert.equal(B.density("kosher salt"), null);
});

test("converts weights to cups when the ingredient is known", () => {
  assert.equal(line("200g caster sugar", 1, { units: "cups" }).amount, "1 cup");
  assert.equal(line("240 g flour", 1, { units: "cups" }).amount, "2 cups");
  assert.equal(line("500 g potatoes", 1, { units: "cups" }).amount, "500 g");
  assert.equal(line("1 1/2 lb potatoes", 1).amount, "1 lb 8 oz");
});

test("eggs: whole eggs, or how much of a beaten one", () => {
  assert.equal(line("2 large eggs", 0.5).line, "1 large egg");
  assert.equal(line("1 egg", 3).line, "3 eggs");
  const third = line("2 large eggs", 1 / 3);
  assert.equal(third.amount, "⅔");
  assert.match(third.note, /beat 1 egg and use 2 tbsp \(33 g\)/);
  const yolks = line("3 egg yolks", 1.5);
  assert.equal(yolks.line, "4½ egg yolks");
  assert.match(yolks.note, /use 4, then beat 1 more/);
});

test("counts, cans and sticks of butter", () => {
  assert.equal(line("1 (14 oz) can tomatoes", 2).line, "2 (14 oz) cans tomatoes");
  assert.equal(line("2 cloves garlic", 1.5).line, "3 cloves garlic");
  assert.equal(line("1 stick butter", 1.5).line, "1 stick + 4 tbsp butter");
  assert.equal(line("1 stick butter", 1.5, { units: "grams" }).line, "170 g butter");
  // The "(2 sticks)" restates the cup amount and would be wrong scaled.
  assert.equal(line("1 cup (2 sticks) butter, softened", 0.5).line, "½ cup butter, softened");
});

test("pan swap scales by floor area", () => {
  const r8 = { shape: "round", a: 8 }, r9 = { shape: "round", a: 9 };
  assert.equal(B.panFactor(r8, r9).toFixed(3), "1.266");
  // America's Test Kitchen rounds 9-inch round to 13x9 to 1.8x: 117 / 63.6.
  assert.equal(B.panFactor(r9, { shape: "rect", a: 13, b: 9 }).toFixed(2), "1.84");
  assert.equal(B.panFactor({ shape: "square", a: 8 }, { shape: "rect", a: 13, b: 9 }).toFixed(2), "1.83");
  // A 9-inch round and an 8-inch square hold nearly the same batter.
  assert.ok(Math.abs(B.panFactor(r9, { shape: "square", a: 8 }) - 1) < 0.01);
});

test("plain text copy and share links", () => {
  const rows = B.scale("Cake:\n2 cups flour\n2 eggs\n\nsalt to taste", 0.5);
  assert.equal(B.toText(rows, "Cake (½ batch)"), "Cake (½ batch)\n\nCake:\n- 1 cup flour\n- 1 egg\n\nsalt to taste");
  const s = { t: "Crème brûlée", r: "2 cups cream", f: 1.5 };
  assert.deepEqual(B.decodeShare(B.encodeShare(s)), s);
  assert.equal(B.decodeShare("not base64!!"), null);
});
