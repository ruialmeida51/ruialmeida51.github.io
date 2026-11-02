/*
 * Seasonal themes, picked from the visitor's own date.
 * Add or change a season in SEASONS (month and day are 1-based, ranges are inclusive).
 * Preview any of them with ?season=halloween (or christmas), and ?season=off to disable.
 * Runs in <head> so the theme is set before first paint.
 */
(function () {
	"use strict";
	var SEASONS = [
		{ id: "halloween", from: [10, 20], to: [11, 2], decor: ["👻", "🦇", "🎃"], brand: "🎃" },
		{ id: "christmas", from: [12, 18], to: [12, 31], decor: ["❄️", "❄️", "🎄"], brand: "🎄" }
	];
	// Shown in the footer on the day itself.
	var BIRTHDAYS = [
		{ m: 1, d: 4, y: 2001, text: "RuneScape launched" },
		{ m: 9, d: 9, y: 1996, text: "Crash Bandicoot came out (North America)" },
		{ m: 10, d: 26, y: 2004, text: "GTA: San Andreas came out (North America)" },
		{ m: 11, d: 23, y: 2004, text: "World of Warcraft launched (North America)" }
	];

	function within(now, s) {
		var k = (now.getMonth() + 1) * 100 + now.getDate();
		var a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
		return a <= b ? k >= a && k <= b : k >= a || k <= b;
	}
	function find(id) {
		for (var i = 0; i < SEASONS.length; i++) if (SEASONS[i].id === id) return SEASONS[i];
		return null;
	}
	function pick() {
		var q = null;
		try { q = new URLSearchParams(location.search).get("season"); } catch (e) {}
		if (q === "off") return null;
		if (q && find(q)) return find(q);
		var now = new Date();
		for (var i = 0; i < SEASONS.length; i++) if (within(now, SEASONS[i])) return SEASONS[i];
		return null;
	}

	var root = document.documentElement;
	var season = pick();

	function apply(s) {
		if (window.sxScroll) { removeEventListener("scroll", window.sxScroll); removeEventListener("resize", window.sxScroll); window.sxScroll = null; }
		var old = document.querySelector(".sx-decor");
		if (old) old.remove();
		if (!s) { root.removeAttribute("data-season"); return; }
		root.setAttribute("data-season", s.id);
		if (!document.body) return;
		var box = document.createElement("div");
		box.className = "sx-decor";
		box.setAttribute("aria-hidden", "true");
		// Quiet parallax: faint emoji that drift at different speeds as you scroll.
		// With reduced motion they simply stay put.
		var n = innerWidth < 720 ? 5 : 9, items = [];
		for (var i = 0; i < n; i++) {
			var e = document.createElement("span");
			e.textContent = s.decor[i % s.decor.length];
			var depth = 0.04 + ((i * 37) % 10) / 10 * 0.22;   // 0.04 .. 0.26
			e.style.left = ((i * 41 + 7) % 92) + "%";
			e.style.fontSize = (22 + depth * 90) + "px";      // deeper (faster) ones are bigger
			box.appendChild(e);
			items.push({ el: e, depth: depth, base: ((i * 53 + 11) % 100) / 100 });
		}
		var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, ticking = false;
		function place() {
			ticking = false;
			var h = innerHeight + 120, y = reduced ? 0 : scrollY;
			for (var k = 0; k < items.length; k++) {
				var it = items[k];
				var pos = ((it.base * h - y * it.depth) % h + h) % h - 60;
				it.el.style.transform = "translate3d(0," + pos.toFixed(1) + "px,0)";
			}
		}
		place();
		if (!reduced) {
			window.sxScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(place); } };
			addEventListener("scroll", window.sxScroll, { passive: true });
			addEventListener("resize", window.sxScroll);
		}
		document.body.appendChild(box);
	}

	apply(season);
	document.addEventListener("DOMContentLoaded", function () { apply(season); });

	// Used by the console: season <name> | auto | off
	window.sxSeason = {
		list: function () { return SEASONS.map(function (s) { return s.id; }); },
		set: function (id) { apply(id === "auto" ? pick() : find(id)); return id === "auto" ? (pick() && pick().id) || "none" : id; },
		off: function () { apply(null); },
		birthday: function () {
			var n = new Date();
			for (var i = 0; i < BIRTHDAYS.length; i++) {
				var b = BIRTHDAYS[i];
				if (b.m === n.getMonth() + 1 && b.d === n.getDate()) return "🎂 On this day in " + b.y + ": " + b.text + ".";
			}
			return null;
		}
	};
})();
