// Scoop, the measuring cup who helps you resize a recipe. Scoop watches
// your pointer (or the field you are typing in on a phone), blinks, fills
// up or empties out with the size you pick, gives a tip for the step you
// are on when tapped, and throws sprinkles when every line is ticked off.
// Everything Scoop says goes through the bubble's live region, so screen
// readers hear it too.
(function () {
  "use strict";
  var btn = document.getElementById("scoop");
  var bubble = document.getElementById("scoop-bubble");
  var dock = document.getElementById("scoop-dock");
  var hide = document.getElementById("scoop-hide");
  var fill = btn && btn.querySelector(".s-fill");
  if (!btn) {
    window.Scoop = { context: function () {}, react: function () {}, say: function () {} };
    return;
  }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "sleepy", tipKey = "recipe";
  var flashing = false, flashTimer = null, bubbleTimer = null, tapTimes = [], tipIndex = {};

  var TIPS = {
    recipe: [
      "Hi, I'm Scoop! Paste the ingredients from any recipe, one per line.",
      "Write them the way the recipe does: 1 1/2 cups, 200 g, 2 eggs. I can read them.",
      "Recipe from the UK or Australia? Change \"Cups and spoons from\". Their cups are bigger."
    ],
    size: [
      "Pick how many people it should feed, or tap Times to double or halve it.",
      "Baking in a different pan? Tap Pan and I'll work out how much batter fits.",
      "Tap Grams to switch to weights. A kitchen scale is more exact than cups."
    ],
    result: [
      "Tap a line to tick it off when it goes in the bowl.",
      "Odd amounts get rounded to spoons you own, like ¼ cup + 1 tbsp.",
      "Copy share link sends the recipe at this size to someone else."
    ],
    odd: [
      "Part of an egg? Beat the egg in a cup, then spoon out what I say.",
      "Counts like onions are rounded to halves. A little more or less is fine in cooking."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(baseMood); }, ms || 1400);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "tip");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", function () { btn.classList.remove("hop", "tip"); });

  // The yellow inside the cup shows the size: a half batch is half full.
  function level(f) {
    if (!fill) return;
    var k = isFinite(f) && f > 0 ? Math.max(0.25, Math.min(1.9, Math.sqrt(f))) : 0.6;
    fill.style.transform = "scaleY(" + k.toFixed(3) + ")";
  }

  function context(c) {
    if (!c.ingredients) { tipKey = "recipe"; baseMood = "sleepy"; }
    else if (c.odd) { tipKey = "odd"; baseMood = "happy"; }
    else { tipKey = Math.abs(c.factor - 1) < 0.005 ? "size" : "result"; baseMood = "happy"; }
    level(c.factor);
    if (!flashing) setMood(baseMood);
  }

  function nextTip() {
    var list = TIPS[tipKey] || TIPS.result;
    var i = tipIndex[tipKey] || 0;
    tipIndex[tipKey] = (i + 1) % list.length;
    return list[i];
  }

  btn.addEventListener("click", function () {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      say("I'm back! Tap me any time for a tip.");
      play("hop");
      return;
    }
    var now = Date.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 1600; });
    tapTimes.push(now);
    if (tapTimes.length >= 5) {
      tapTimes = [];
      play("tip");
      flash("wow", 1200);
      sprinkles(14);
      say("Whoops, you tipped me over! Good thing it was only sprinkles.");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") flash("happy", 1600);
    say(nextTip());
  });

  hide.addEventListener("click", function () {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  function remember(tucked) {
    try { localStorage.setItem("batchwise.scoopTucked", tucked ? "1" : ""); } catch (e) {}
  }
  try { if (localStorage.getItem("batchwise.scoopTucked")) dock.classList.add("tucked"); } catch (e) {}

  // Eyes follow the pointer, a few pixels at most.
  var pupils = btn.querySelectorAll(".s-pupil");
  var target = null, frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    var r = btn.getBoundingClientRect();
    var cx = r.left + r.width * 0.43, cy = r.top + r.height * 0.45;
    var dx = target.x - cx, dy = target.y - cy;
    var d = Math.hypot(dx, dy) || 1;
    var reach = Math.min(1, d / 220);
    var x = (dx / d) * 3.4 * reach, y = (dy / d) * 3.8 * reach;
    pupils.forEach(function (p) { p.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)"; });
  }
  window.addEventListener("pointermove", function (ev) {
    target = { x: ev.clientX, y: ev.clientY };
    if (!frame) frame = requestAnimationFrame(look);
  }, { passive: true });
  document.addEventListener("focusin", function (ev) {
    var r = ev.target.getBoundingClientRect && ev.target.getBoundingClientRect();
    if (!r || ev.target === btn) return;
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (!frame) frame = requestAnimationFrame(look);
  });

  (function blink() {
    setTimeout(function () {
      if (baseMood !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(function () { btn.classList.remove("blink"); }, 140);
      }
      blink();
    }, 2600 + Math.random() * 3800);
  })();

  var COLORS = ["#c8553d", "#f4c95d", "#7bb8a4", "#e68aa5", "#6c8fd1"];
  function sprinkles(n) {
    if (still.matches) return;
    var r = btn.getBoundingClientRect();
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.className = "sprinkle";
      s.style.background = COLORS[i % COLORS.length];
      s.style.left = r.left + r.width * (0.25 + Math.random() * 0.4) + "px";
      s.style.top = r.top + r.height * 0.2 + "px";
      document.body.appendChild(s);
      var dx = -(40 + Math.random() * 160), dy = -(60 + Math.random() * 160), rot = Math.random() * 720 - 360;
      var a = s.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px," + dy + "px) rotate(" + rot / 2 + "deg)", opacity: 1, offset: 0.5 },
        { transform: "translate(" + dx + "px," + (dy + 220) + "px) rotate(" + rot + "deg)", opacity: 0 }
      ], { duration: 1300 + Math.random() * 600, easing: "ease-out" });
      a.onfinish = (function (node) { return function () { node.remove(); }; })(s);
    }
  }

  var factorTimer = null;
  function react(what, d) {
    d = d || {};
    switch (what) {
      case "hello":
        say("Hi, I'm Scoop! Paste a recipe and I'll make it any size you need.", 9000);
        break;
      case "opened":
        play("hop");
        flash("wow", 1000);
        say("Someone sent you this recipe at the size they picked. Tap each line as it goes in.", 9000);
        break;
      case "example":
        play("hop");
        say("Here's a batch of 48 cookies. I made it 18, for a smaller tin.");
        break;
      case "pasted":
        play("hop");
        say(d.count === 1 ? "Got 1 ingredient. Add the rest, one per line." : "Got " + d.count + " ingredients. Now pick the size you want.");
        break;
      case "system":
        say(d.s === "us" ? "US cups: 237 ml, and a tablespoon is 3 teaspoons."
          : d.s === "au" ? "Australian cups are 250 ml, and their tablespoon is 20 ml, a bit bigger."
          : "Cups are 250 ml here, a little more than a US cup.");
        break;
      case "mode":
        if (d.m === "pan") say("Pick the pan the recipe uses, then yours. I'll keep the batter just as deep.");
        break;
      case "factor":
        // Wait until the typing stops before saying anything.
        clearTimeout(factorTimer);
        factorTimer = setTimeout(function () {
          if (!isFinite(d.f) || d.f <= 0) return;
          if (d.f >= 3) { play("hop"); flash("wow", 1200); say("That's a big batch! Make sure your bowl is big enough."); }
          else if (d.f <= 0.34) { flash("wow", 1000); say("A tiny batch. Small amounts are easier to weigh than to scoop."); }
        }, 600);
        break;
      case "odd":
        flash("worried", 1600);
        say(d.what === "egg"
          ? "Part of an egg! Beat one egg in a cup and use what I say. The rest can go in an omelette."
          : "Some amounts don't come out even. I rounded them to what you can measure.", 9000);
        break;
      case "units":
        if (d.u === "grams") say("Grams it is. Liquids I don't know the weight of stay in ml.");
        else if (d.u === "cups") say("Cups and spoons. If the recipe was in grams, I turn the ones I know into cups.");
        break;
      case "tick":
        if (!d.on) break;
        play("hop");
        if (d.left === 0) {
          flash("party", 2000);
          sprinkles(18);
          say("Everything's in! Enjoy it.");
        } else if (d.left <= 2) {
          say("Nearly there, " + d.left + " to go.");
        }
        break;
      case "copied": play("hop"); say("Copied! Paste it in your notes or send it to whoever is shopping."); break;
      case "link": say("Anyone with the link sees this recipe at this size."); break;
      case "reset": baseMood = "sleepy"; setMood("sleepy"); say("Clean bowl. Paste the next recipe!"); break;
    }
  }

  window.Scoop = { react: react, context: context, say: say };
})();
