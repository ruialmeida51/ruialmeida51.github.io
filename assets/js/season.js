/*
 * Seasonal themes, picked from the visitor's own date.
 * Add or change a season in SEASONS (month and day are 1-based, ranges are inclusive).
 * Preview any of them with ?season=halloween (or christmas), and ?season=off to disable.
 * Runs in <head> so the theme is set before first paint.
 */
(function () {
	"use strict";
	var SEASONS = [
		{ id: "halloween", from: [10, 20], to: [11, 2], decor: ["🎃", "🦇", "👻"], brand: "🎃" },
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
		var old = document.querySelector(".sx-decor");
		if (old) old.remove();
		if (!s) { root.removeAttribute("data-season"); return; }
		root.setAttribute("data-season", s.id);
		if (matchMedia("(prefers-reduced-motion: reduce)").matches || !document.body) return;
		var box = document.createElement("div");
		box.className = "sx-decor";
		box.setAttribute("aria-hidden", "true");
		for (var i = 0; i < 10; i++) {
			var e = document.createElement("span");
			e.textContent = s.decor[i % s.decor.length];
			e.style.left = (6 + i * 9.5) + "%";
			e.style.animationDelay = (-i * 1.7) + "s";
			e.style.animationDuration = (14 + (i % 4) * 4) + "s";
			e.style.fontSize = (14 + (i % 3) * 6) + "px";
			box.appendChild(e);
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
