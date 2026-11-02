/*
 * Sharpener: reads progress.json and renders the scoreboard.
 * Used by /sharpener/ (full page, #sharpener-page) and by the homepage card (#sharpener-card).
 * No build step, no dependencies. Data is only ever written with textContent.
 *
 * progress.json:
 *   topics:   [{ id, name, short }]
 *   sessions: [{ date: "YYYY-MM-DD", type: "decision"|"lab"|"kata", topic: <topic id>,
 *                confidence: 1-5 (rated before the answer was revealed),
 *                result: "right"|"partly"|"missed", note?: "one public-safe line" }]
 */
(function () {
	"use strict";

	var DAY = 864e5;
	var BASE = { decision: 10, lab: 30, kata: 30 };
	var FACTOR = { right: 1, partly: 0.6, missed: 0.3 };
	var ACCURACY = { right: 1, partly: 0.5, missed: 0 };
	var LEVELS = [
		{ min: 0, title: "Recruit" },
		{ min: 60, title: "Squire" },
		{ min: 180, title: "Knight" },
		{ min: 400, title: "Champion" },
		{ min: 800, title: "Paladin" }
	];
	var TYPE_LABEL = { decision: "Decision", lab: "Lab", kata: "Kata" };
	var RESULT_LABEL = { right: "Right", partly: "Partly", missed: "Missed" };
	var DOW = ["M", "T", "W", "T", "F", "S", "S"];
	var SKILL_XP_PER_LEVEL = 20; // a skill reaches level 5 at 100 XP
	var RUSTY_AFTER_DAYS = 14;

	function mk(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}
	function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
	function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

	// "YYYY-MM-DD" -> UTC midnight in ms, so date maths ignores time zones and DST.
	function parseDay(s) {
		var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
		return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
	}
	function todayUtc() {
		var n = new Date();
		return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
	}
	function mondayOf(ms) { return ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY; }
	function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
	function fmtShort(ms) {
		return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
	}

	function compute(data) {
		var today = todayUtc();
		var topics = Array.isArray(data.topics) ? data.topics : [];
		var byId = {};
		topics.forEach(function (t) { byId[t.id] = { xp: 0, last: NaN, count: 0 }; });

		var sessions = (Array.isArray(data.sessions) ? data.sessions : [])
			.map(function (s) { return { raw: s, day: parseDay(s.date) }; })
			.filter(function (s) { return !isNaN(s.day) && BASE[s.raw.type] && FACTOR[s.raw.result] != null; })
			.sort(function (a, b) { return a.day - b.day; });

		var totalXp = 0, confSum = 0, accSum = 0, calN = 0, perDay = {};
		sessions.forEach(function (s) {
			var r = s.raw;
			s.xp = BASE[r.type] * FACTOR[r.result];
			totalXp += s.xp;
			var t = byId[r.topic];
			if (t) {
				t.xp += s.xp;
				t.count++;
				if (isNaN(t.last) || s.day > t.last) t.last = s.day;
			}
			var c = Number(r.confidence);
			if (c >= 1 && c <= 5) {
				confSum += (c - 1) / 4;
				accSum += ACCURACY[r.result];
				calN++;
			}
			var key = iso(s.day);
			perDay[key] = (perDay[key] || 0) + 1;
		});

		var li = 0;
		for (var i = 0; i < LEVELS.length; i++) if (totalXp >= LEVELS[i].min) li = i;
		var next = LEVELS[li + 1] || null;
		var level = {
			title: LEVELS[li].title,
			next: next ? next.title : null,
			toNext: next ? next.min - totalXp : 0,
			pct: next ? Math.min(100, ((totalXp - LEVELS[li].min) / (next.min - LEVELS[li].min)) * 100) : 100
		};

		var monday = mondayOf(today);
		var week = [];
		for (var d = 0; d < 7; d++) {
			var ms = monday + d * DAY;
			week.push({ ms: ms, n: perDay[iso(ms)] || 0, today: ms === today });
		}
		var weekHits = week.slice(0, 5).filter(function (x) { return x.n > 0; }).length;

		var cal = { n: calN };
		if (calN >= 5) {
			cal.conf = confSum / calN;
			cal.acc = accSum / calN;
			var gap = cal.conf - cal.acc;
			cal.verdict = Math.abs(gap) < 0.1 ? "Well calibrated" : gap > 0 ? "Overconfident" : "Underconfident";
		}

		var skills = topics.map(function (t) {
			var s = byId[t.id];
			return {
				id: t.id,
				name: t.name,
				short: t.short || t.name,
				level: Math.min(5, s.xp / SKILL_XP_PER_LEVEL),
				count: s.count,
				ago: isNaN(s.last) ? null : Math.round((today - s.last) / DAY)
			};
		});

		return { sessions: sessions, totalXp: totalXp, level: level, week: week, weekHits: weekHits,
			cal: cal, skills: skills, perDay: perDay, today: today, monday: monday };
	}

	// ---- shared pieces ----------------------------------------------------

	function levelBlock(st) {
		var frag = document.createDocumentFragment();
		var head = mk("div", "sh-level");
		head.appendChild(mk("b", null, st.level.title));
		head.appendChild(mk("span", null, Math.round(st.totalXp) + " XP · " + plural(st.sessions.length, "session", "sessions")));
		frag.appendChild(head);

		var bar = mk("div", "sh-bar");
		bar.setAttribute("role", "img");
		bar.setAttribute("aria-label", st.level.next ? "Progress towards " + st.level.next : "Top level reached");
		var fill = document.createElement("i");
		bar.appendChild(fill);
		frag.appendChild(bar);
		requestAnimationFrame(function () { fill.style.width = st.level.pct + "%"; });

		frag.appendChild(mk("p", "sh-note mono", st.level.next
			? Math.ceil(st.level.toNext) + " XP to " + st.level.next
			: "Top level reached."));
		return frag;
	}

	function weekRow(st) {
		var row = mk("div", "sh-week");
		row.setAttribute("role", "img");
		row.setAttribute("aria-label", "This week: " + st.weekHits + " of 5 weekdays practised");
		st.week.slice(0, 5).forEach(function (d, i) {
			row.appendChild(mk("span", "sh-day" + (d.n ? " hit" : "") + (d.today ? " today" : ""), DOW[i]));
		});
		return row;
	}

	function calLine(st) {
		return st.cal.verdict
			? "Calibration: " + st.cal.verdict.toLowerCase()
			: "Calibration unlocks after 5 rated sessions";
	}

	// ---- homepage card -----------------------------------------------------

	function renderCard(root, st) {
		clear(root);
		root.appendChild(levelBlock(st));
		root.appendChild(mk("p", "sh-label", "This week · " + st.weekHits + " of 5"));
		root.appendChild(weekRow(st));
		root.appendChild(mk("p", "sh-note mono", calLine(st)));
	}

	// ---- full page ---------------------------------------------------------

	function svg(tag, attrs) {
		var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	}

	function radar(skills) {
		var W = 440, H = 320, CX = W / 2, CY = H / 2, R = 100, n = skills.length;
		var root = svg("svg", { viewBox: "0 0 " + W + " " + H, "class": "sh-radar", role: "img",
			"aria-label": "Skill radar: " + skills.map(function (s) { return s.short + " " + s.level.toFixed(1) + " of 5"; }).join(", ") });
		function pt(i, r) {
			var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
			return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
		}
		function pts(rFn) {
			return skills.map(function (s, i) { var p = pt(i, rFn(s)); return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
		}
		for (var k = 1; k <= 5; k++) {
			root.appendChild(svg("polygon", { "class": "ring", points: pts(function () { return (R * k) / 5; }) }));
		}
		skills.forEach(function (s, i) {
			var p = pt(i, R);
			root.appendChild(svg("line", { "class": "axis", x1: CX, y1: CY, x2: p[0].toFixed(1), y2: p[1].toFixed(1) }));
		});
		root.appendChild(svg("polygon", { "class": "shape", points: pts(function (s) { return (R * s.level) / 5; }) }));
		skills.forEach(function (s, i) {
			var d = pt(i, (R * s.level) / 5);
			root.appendChild(svg("circle", { "class": "dot", cx: d[0].toFixed(1), cy: d[1].toFixed(1), r: 3.5 }));
			var l = pt(i, R + 14);
			var anchor = l[0] < CX - 8 ? "end" : l[0] > CX + 8 ? "start" : "middle";
			var t = svg("text", { x: l[0].toFixed(1), y: l[1].toFixed(1), "text-anchor": anchor, "dominant-baseline": "middle" });
			t.textContent = s.short;
			root.appendChild(t);
		});
		return root;
	}

	function skillList(skills) {
		var ul = mk("ul", "sh-skills");
		skills.forEach(function (s) {
			var li = mk("li", "sh-skill");
			li.appendChild(mk("span", "name", s.name));
			li.appendChild(mk("span", "lv", "Lv " + s.level.toFixed(1)));
			var bar = mk("div", "sh-bar");
			var fill = document.createElement("i");
			bar.appendChild(fill);
			li.appendChild(bar);
			requestAnimationFrame(function () { fill.style.width = (s.level / 5) * 100 + "%"; });
			var rusty = s.ago != null && s.ago > RUSTY_AFTER_DAYS;
			var meta = mk("span", "meta", s.ago == null
				? "Not practised yet"
				: plural(s.count, "session", "sessions") + " · last " + (s.ago === 0 ? "today" : plural(s.ago, "day", "days") + " ago"));
			if (rusty) {
				meta.appendChild(document.createTextNode(" · "));
				meta.appendChild(mk("span", "rusty", "getting rusty"));
			}
			li.appendChild(meta);
			ul.appendChild(li);
		});
		return ul;
	}

	function heat(st) {
		var activeDays = Object.keys(st.perDay).length;
		var wrap = mk("div", "sh-heat");
		wrap.setAttribute("role", "img");
		wrap.setAttribute("aria-label", "Activity over the last 12 weeks: " + plural(activeDays, "active day", "active days"));
		var labels = mk("div", "sh-heat-days");
		DOW.forEach(function (d) { labels.appendChild(mk("span", null, d)); });
		wrap.appendChild(labels);
		for (var w = 11; w >= 0; w--) {
			var col = mk("div", "sh-heat-col");
			var mon = st.monday - w * 7 * DAY;
			for (var d = 0; d < 7; d++) {
				var ms = mon + d * DAY;
				var n = st.perDay[iso(ms)] || 0;
				var cell = mk("i", "sh-cell l" + Math.min(n, 3) + (ms > st.today ? " future" : ""));
				cell.title = fmtShort(ms) + ": " + plural(n, "session", "sessions");
				col.appendChild(cell);
			}
			wrap.appendChild(col);
		}
		return wrap;
	}

	function calRow(label, value) {
		var row = mk("div", "sh-cal-row");
		row.appendChild(mk("span", null, label));
		var bar = mk("div", "sh-bar");
		var fill = document.createElement("i");
		bar.appendChild(fill);
		row.appendChild(bar);
		row.appendChild(mk("span", "v", Math.round(value * 100) + "%"));
		requestAnimationFrame(function () { fill.style.width = value * 100 + "%"; });
		return row;
	}

	function calibration(root, st) {
		clear(root);
		if (st.cal.n < 5) {
			root.appendChild(mk("p", "sh-empty", "Unlocks after 5 sessions with a confidence rating (" + st.cal.n + " so far)."));
		} else {
			root.appendChild(mk("p", "sh-verdict", st.cal.verdict));
			root.appendChild(calRow("How sure I said I was", st.cal.conf));
			root.appendChild(calRow("How often I was right", st.cal.acc));
		}
		root.appendChild(mk("p", "sh-note", "Before I see any answer I rate my confidence from 1 to 5. If those two bars match over time, my gut can be trusted. If not, that's worth knowing."));
	}

	function sessionLog(root, st) {
		clear(root);
		if (!st.sessions.length) {
			root.appendChild(mk("p", "sh-empty", "Nothing logged yet. The first session is always the hardest, check back soon."));
			return;
		}
		var names = {};
		st.skills.forEach(function (s) { names[s.id] = s.name; });
		var ul = mk("ul", "sh-log");
		st.sessions.slice().reverse().slice(0, 12).forEach(function (s) {
			var r = s.raw;
			var li = mk("li", "sh-entry r-" + r.result);
			li.appendChild(mk("span", "d", fmtShort(s.day)));
			li.appendChild(mk("span", "t", TYPE_LABEL[r.type]));
			li.appendChild(mk("span", "topic", names[r.topic] || r.topic || ""));
			var c = Number(r.confidence);
			if (c >= 1 && c <= 5) {
				var dots = mk("span", "conf", "●".repeat(c) + "○".repeat(5 - c));
				dots.setAttribute("role", "img");
				dots.setAttribute("aria-label", "Confidence " + c + " of 5");
				li.appendChild(dots);
			} else {
				li.appendChild(mk("span", "conf", ""));
			}
			li.appendChild(mk("span", "res", RESULT_LABEL[r.result]));
			if (r.note) li.appendChild(mk("span", "note", String(r.note)));
			ul.appendChild(li);
		});
		root.appendChild(ul);
	}

	function renderPage(st) {
		var $ = function (id) { return document.getElementById(id); };
		var el;
		if ((el = $("sh-level"))) { clear(el); el.appendChild(levelBlock(st)); }
		if ((el = $("sh-week"))) {
			clear(el);
			el.appendChild(mk("p", "sh-label", "This week · " + st.weekHits + " of 5"));
			el.appendChild(weekRow(st));
			el.appendChild(mk("p", "sh-note", "Weekdays I showed up. Misses don't reset anything, the aim is 4 of 5."));
		}
		if ((el = $("sh-radar")) && st.skills.length >= 3) { clear(el); el.appendChild(radar(st.skills)); }
		if ((el = $("sh-skills"))) { clear(el); el.appendChild(skillList(st.skills)); }
		if ((el = $("sh-heat"))) { clear(el); el.appendChild(heat(st)); }
		if ((el = $("sh-cal"))) calibration(el, st);
		if ((el = $("sh-log"))) sessionLog(el, st);
	}

	// ---- boot --------------------------------------------------------------

	function init() {
		var card = document.getElementById("sharpener-card");
		var page = document.getElementById("sharpener-page");
		var host = card || page;
		if (!host || !window.fetch) return;
		fetch(host.getAttribute("data-src") || "progress.json", { cache: "no-cache" })
			.then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
			.then(function (data) {
				var st = compute(data);
				if (card) renderCard(card, st);
				if (page) renderPage(st);
			})
			.catch(function () {
				var msg = "Couldn't load the scoreboard right now.";
				if (card) { clear(card); card.appendChild(mk("p", "sh-note", msg)); }
				if (page) {
					var l = document.getElementById("sh-log");
					if (l) { clear(l); l.appendChild(mk("p", "sh-empty", msg)); }
				}
			});
	}
	init();
})();
