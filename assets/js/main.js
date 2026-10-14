(function () {
	var root = document.documentElement;
	var now = window.NOW || {};

	// Theme: stored choice > system preference. Storage may be blocked, so guard it.
	function stored() { try { return localStorage.getItem("theme"); } catch (e) { return null; } }
	function store(v) { try { localStorage.setItem("theme", v); } catch (e) {} }

	var toggle = document.getElementById("theme-toggle");
	function applyTheme(t) {
		root.setAttribute("data-theme", t);
		if (toggle) toggle.setAttribute("aria-pressed", t === "light" ? "true" : "false");
	}
	applyTheme(stored() || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
	if (toggle) toggle.addEventListener("click", function () {
		var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
		applyTheme(next);
		store(next);
	});

	// "Currently" strip.
	document.querySelectorAll("[data-now]").forEach(function (el) {
		var v = now[el.getAttribute("data-now")];
		if (v) el.textContent = v;
	});

	// Years of experience, so it never goes stale.
	document.querySelectorAll("[data-years-since]").forEach(function (el) {
		el.textContent = new Date().getFullYear() - Number(el.getAttribute("data-years-since"));
	});

	// Duration of the current role, so it never goes stale.
	document.querySelectorAll("[data-duration]").forEach(function (el) {
		var parts = el.getAttribute("data-duration").split("-"), d = new Date();
		var total = (d.getFullYear() - Number(parts[0])) * 12 + (d.getMonth() + 1 - Number(parts[1])) + 1;
		var y = Math.floor(total / 12), mo = total % 12, out = [];
		if (y) out.push(y + (y === 1 ? " yr" : " yrs"));
		if (mo || !y) out.push(mo + (mo === 1 ? " mo" : " mos"));
		el.textContent = out.join(" ");
	});

	// WoW Forever countdown: ticks every second.
	var cd = document.getElementById("wow-countdown");
	if (cd) {
		var target = now.wowForever ? Date.parse(now.wowForever) : NaN;
		var units = { d: cd.querySelector("[data-u=d]"), h: cd.querySelector("[data-u=h]"), m: cd.querySelector("[data-u=m]"), s: cd.querySelector("[data-u=s]") };
		var note = document.getElementById("wow-note");
		var pad = function (n) { return n < 10 ? "0" + n : String(n); };
		var tick = function () {
			var ms = target - Date.now();
			if (ms <= 0) {
				cd.hidden = true;
				if (note) note.textContent = "It's live. FOR THE ALLIANCE! \u2694\uFE0F";
				return true;
			}
			units.d.textContent = Math.floor(ms / 864e5);
			units.h.textContent = pad(Math.floor(ms / 36e5) % 24);
			units.m.textContent = pad(Math.floor(ms / 6e4) % 60);
			units.s.textContent = pad(Math.floor(ms / 1e3) % 60);
			return false;
		};
		if (isNaN(target)) {
			cd.hidden = true;
			if (note) note.textContent = "release: soon\u2122";
		} else if (!tick()) {
			var timer = setInterval(function () { if (tick()) clearInterval(timer); }, 1000);
		}
	}

	// Reveal on scroll (content stays visible without JS or with reduced motion).
	var items = document.querySelectorAll(".reveal");
	if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
		root.classList.add("js-reveal");
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) {
				if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
			});
		}, { threshold: 0.12 });
		items.forEach(function (el) { io.observe(el); });
	}

	// Konami code: for the Alliance.
	var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], pos = 0;
	addEventListener("keydown", function (e) {
		pos = e.keyCode === seq[pos] ? pos + 1 : (e.keyCode === seq[0] ? 1 : 0);
		if (pos === seq.length) {
			pos = 0;
			root.classList.toggle("alliance");
			var t = document.getElementById("toast");
			if (t) {
				t.textContent = root.classList.contains("alliance") ? "⚔️ FOR THE ALLIANCE!" : "Back to gold.";
				t.classList.add("show");
				setTimeout(function () { t.classList.remove("show"); }, 2400);
			}
		}
	});
})();
