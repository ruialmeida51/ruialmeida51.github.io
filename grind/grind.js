/*
 * The Grind: reads progress.json and renders the scoreboard, RuneScape style (levels 1-99).
 * Used by /grind/ (full page, #grind-page) and by the homepage card (#grind-card).
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
	// Total level (sum of the skill levels) unlocks a title.
	var TITLES = [
		{ min: 0, title: "Recruit" },
		{ min: 21, title: "Squire" },
		{ min: 70, title: "Knight" },
		{ min: 140, title: "Champion" },
		{ min: 250, title: "Paladin" }
	];
	var MAX_LEVEL = 99;
	var CAPS = [10, 25, 50, 75, 99]; // radar scale steps
	var SEEN_KEY = "grind-levels";
	var TYPE_LABEL = { decision: "Decision", lab: "Lab", kata: "Kata" };
	var RESULT_LABEL = { right: "Right", partly: "Partly", missed: "Missed" };
	var DOW = ["M", "T", "W", "T", "F", "S", "S"];
	var RUSTY_AFTER_DAYS = 14;

	// XP needed for level L is (L-1)^2 / 4, so early levels fly by and 99 takes 2401 XP.
	function xpFor(l) { return ((l - 1) * (l - 1)) / 4; }
	function levelOf(xp) { return Math.min(MAX_LEVEL, Math.floor(1 + 2 * Math.sqrt(Math.max(0, xp)))); }
	function progressIn(xp) {
		var l = levelOf(xp);
		if (l >= MAX_LEVEL) return { level: l, pct: 100, toNext: 0 };
		var lo = xpFor(l), hi = xpFor(l + 1);
		return { level: l, pct: ((xp - lo) / (hi - lo)) * 100, toNext: hi - xp };
	}

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
			var p = progressIn(s.xp);
			return {
				id: t.id,
				name: t.name,
				short: t.short || t.name,
				xp: s.xp,
				level: p.level,
				pct: p.pct,
				count: s.count,
				ago: isNaN(s.last) ? null : Math.round((today - s.last) / DAY)
			};
		});

		var totalLevel = skills.reduce(function (a, s) { return a + s.level; }, 0);
		var maxTotal = skills.length * MAX_LEVEL;
		var ti = 0;
		for (var i = 0; i < TITLES.length; i++) if (totalLevel >= TITLES[i].min) ti = i;
		var nextT = TITLES[ti + 1] || null;
		var level = {
			title: TITLES[ti].title,
			total: totalLevel,
			max: maxTotal,
			next: nextT ? nextT.title : null,
			toNext: nextT ? nextT.min - totalLevel : 0,
			pct: nextT ? Math.min(100, ((totalLevel - TITLES[ti].min) / (nextT.min - TITLES[ti].min)) * 100) : 100
		};

		return { sessions: sessions, totalXp: totalXp, level: level, week: week, weekHits: weekHits,
			cal: cal, skills: skills, perDay: perDay, today: today, monday: monday };
	}

	// ---- shared pieces ----------------------------------------------------

	function levelBlock(st) {
		var frag = document.createDocumentFragment();
		var head = mk("div", "gr-level");
		head.appendChild(mk("b", null, st.level.title));
		head.appendChild(mk("span", null, "Total level " + st.level.total + " / " + st.level.max + " · " +
			Math.round(st.totalXp) + " XP · " + plural(st.sessions.length, "session", "sessions")));
		frag.appendChild(head);

		var bar = mk("div", "gr-bar");
		bar.setAttribute("role", "img");
		bar.setAttribute("aria-label", st.level.next ? "Progress towards " + st.level.next : "Top title reached");
		var fill = document.createElement("i");
		bar.appendChild(fill);
		frag.appendChild(bar);
		requestAnimationFrame(function () { fill.style.width = st.level.pct + "%"; });

		frag.appendChild(mk("p", "gr-note mono", st.level.next
			? st.level.toNext + " more total " + (st.level.toNext === 1 ? "level" : "levels") + " to " + st.level.next
			: "Top title reached."));
		return frag;
	}

	function weekRow(st) {
		var row = mk("div", "gr-week");
		row.setAttribute("role", "img");
		row.setAttribute("aria-label", "This week: " + st.weekHits + " of 5 weekdays practised");
		st.week.slice(0, 5).forEach(function (d, i) {
			row.appendChild(mk("span", "gr-day" + (d.n ? " hit" : "") + (d.today ? " today" : ""), DOW[i]));
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
		root.appendChild(mk("p", "gr-label", "This week · " + st.weekHits + " of 5"));
		root.appendChild(weekRow(st));
		root.appendChild(mk("p", "gr-note mono", calLine(st)));
	}

	// ---- full page ---------------------------------------------------------

	function svg(tag, attrs) {
		var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	}

	function radar(skills) {
		var top = Math.max.apply(null, skills.map(function (s) { return s.level; }));
		var cap = CAPS.filter(function (c) { return c >= top; })[0] || MAX_LEVEL;
		var W = 440, H = 320, CX = W / 2, CY = H / 2, R = 100, n = skills.length;
		var root = svg("svg", { viewBox: "0 0 " + W + " " + H, "class": "gr-radar", role: "img",
			"aria-label": "Skill radar: " + skills.map(function (s) { return s.short + " " + "level " + s.level; }).join(", ") + " (scale to " + cap + ")" });
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
		root.appendChild(svg("polygon", { "class": "shape", points: pts(function (s) { return (R * s.level) / cap; }) }));
		skills.forEach(function (s, i) {
			var d = pt(i, (R * s.level) / cap);
			root.appendChild(svg("circle", { "class": "dot", cx: d[0].toFixed(1), cy: d[1].toFixed(1), r: 3.5 }));
			var l = pt(i, R + 14);
			var anchor = l[0] < CX - 8 ? "end" : l[0] > CX + 8 ? "start" : "middle";
			var t = svg("text", { x: l[0].toFixed(1), y: l[1].toFixed(1), "text-anchor": anchor, "dominant-baseline": "middle" });
			t.textContent = s.short;
			root.appendChild(t);
		});
		var scale = svg("text", { x: CX + 4, y: CY - R - 3, "class": "scale" });
		scale.textContent = String(cap);
		root.appendChild(scale);
		return root;
	}

	function skillList(skills) {
		var ul = mk("ul", "gr-skills");
		skills.forEach(function (s) {
			var li = mk("li", "gr-skill");
			li.appendChild(mk("span", "name", s.name));
			li.appendChild(mk("span", "lv", "Level " + s.level));
			var bar = mk("div", "gr-bar");
			var fill = document.createElement("i");
			bar.appendChild(fill);
			li.appendChild(bar);
			requestAnimationFrame(function () { fill.style.width = s.pct + "%"; });
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
		var wrap = mk("div", "gr-heat");
		wrap.setAttribute("role", "img");
		wrap.setAttribute("aria-label", "Activity over the last 12 weeks: " + plural(activeDays, "active day", "active days"));
		var labels = mk("div", "gr-heat-days");
		DOW.forEach(function (d) { labels.appendChild(mk("span", null, d)); });
		wrap.appendChild(labels);
		for (var w = 11; w >= 0; w--) {
			var col = mk("div", "gr-heat-col");
			var mon = st.monday - w * 7 * DAY;
			for (var d = 0; d < 7; d++) {
				var ms = mon + d * DAY;
				var n = st.perDay[iso(ms)] || 0;
				var cell = mk("i", "gr-cell l" + Math.min(n, 3) + (ms > st.today ? " future" : ""));
				cell.title = fmtShort(ms) + ": " + plural(n, "session", "sessions");
				col.appendChild(cell);
			}
			wrap.appendChild(col);
		}
		return wrap;
	}

	function calRow(label, value) {
		var row = mk("div", "gr-cal-row");
		row.appendChild(mk("span", null, label));
		var bar = mk("div", "gr-bar");
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
			root.appendChild(mk("p", "gr-empty", "The game won't tell me how wrong I am until I've rated 5 sessions (" + st.cal.n + " so far)."));
		} else {
			root.appendChild(mk("p", "gr-verdict", st.cal.verdict));
			root.appendChild(calRow("How sure I said I was", st.cal.conf));
			root.appendChild(calRow("How often I was right", st.cal.acc));
		}
		root.appendChild(mk("p", "gr-note", "Before I see any answer I rate my confidence from 1 to 5. If those two bars match over time, my gut can be trusted. If not, that's worth knowing."));
	}

	function sessionLog(root, st) {
		clear(root);
		if (!st.sessions.length) {
			root.appendChild(mk("p", "gr-empty", "Hans: Hello. What are you doing here? Nothing logged yet. Go on, earn some XP."));
			return;
		}
		var names = {};
		st.skills.forEach(function (s) { names[s.id] = s.name; });
		var ul = mk("ul", "gr-log");
		st.sessions.slice().reverse().slice(0, 12).forEach(function (s) {
			var r = s.raw;
			var li = mk("li", "gr-entry r-" + r.result);
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
		if ((el = $("gr-level"))) { clear(el); el.appendChild(levelBlock(st)); }
		if ((el = $("gr-week"))) {
			clear(el);
			el.appendChild(mk("p", "gr-label", "This week · " + st.weekHits + " of 5"));
			el.appendChild(weekRow(st));
			el.appendChild(mk("p", "gr-note", "Weekdays I showed up. Misses don't reset anything, the aim is 4 of 5."));
		}
		if ((el = $("gr-radar")) && st.skills.length >= 3) { clear(el); el.appendChild(radar(st.skills)); }
		if ((el = $("gr-skills"))) { clear(el); el.appendChild(skillList(st.skills)); }
		if ((el = $("gr-heat"))) { clear(el); el.appendChild(heat(st)); }
		if ((el = $("gr-cal"))) calibration(el, st);
		if ((el = $("gr-log"))) sessionLog(el, st);
	}

	// ---- level-up toast (page only, remembers what this browser has already seen) ----

	function levelUps(st) {
		var seen = null, now = {};
		st.skills.forEach(function (s) { now[s.id] = s.level; });
		try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)); } catch (e) {}
		try { localStorage.setItem(SEEN_KEY, JSON.stringify(now)); } catch (e) {}
		if (!seen || typeof seen !== "object") return; // first visit: don't shout
		var ups = st.skills.filter(function (s) { return seen[s.id] != null && s.level > seen[s.id]; });
		if (!ups.length) return;
		var t = document.getElementById("toast");
		if (!t) return;
		var best = ups.sort(function (a, b) { return (b.level - seen[b.id]) - (a.level - seen[a.id]); })[0];
		t.textContent = "Congratulations, you just advanced a " + best.name + " level! You are now level " + best.level + ".";
		t.classList.add("show");
		setTimeout(function () { t.classList.remove("show"); }, 6000);
	}

	// ---- boot --------------------------------------------------------------

	// Public, read-only. Row-level security only allows SELECT on sessions; writes go through the owner's connector.
	var HANS_URL = "https://fotbvouyrrwuoyinrryw.supabase.co";
	var HANS_KEY = "sb_publishable_RXiIRWiyUSG887AJvP5XxQ_y4seOvRe";

	// ---- today's question (public) + the "answer" button, which only works for the owner ----

	function loadQuestion() {
		var host = document.getElementById("gr-question");
		if (!host || !window.fetch) return;
		fetch(HANS_URL + "/rest/v1/questions?select=date,kind,topic,title,body&order=date.desc,id.desc&limit=1",
			{ headers: { apikey: HANS_KEY } })
			.then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
			.then(function (rows) {
				clear(host);
				if (!rows.length) {
					host.appendChild(mk("p", "gr-empty", "Hans: Hello. What are you doing here? No quest today. Check back after the morning session."));
					return;
				}
				var q = rows[0];
				var card = mk("article", "card gr-q");
				card.appendChild(mk("p", "gr-q-kind", q.kind.toUpperCase() + " · " + q.topic));
				card.appendChild(mk("h3", null, q.title));
				card.appendChild(mk("div", "gr-q-text", q.body));

				// Cosmetic only: the real gate is the login plus row-level security in the database.
				var owner = false;
				try { owner = !!localStorage.getItem("sb-fotbvouyrrwuoyinrryw-auth-token"); } catch (e) {}
				var req = mk("div", "gr-q-req");
				req.appendChild(mk("p", "gr-q-reqtitle", "Quest requirements"));
				var list = mk("ul", "gr-q-reqlist");
				list.appendChild(mk("li", owner ? "met" : "unmet",
					(owner ? "✔ " : "✘ ") + "Complete the quest “Owner of eyther.dev”"));
				list.appendChild(mk("li", owner ? "met" : "unmet",
					(owner ? "✔ " : "✘ ") + "Skill: Being Rui, level 1 (" + (owner ? "1" : "0") + "/1)"));
				req.appendChild(list);
				req.appendChild(mk("p", "gr-note", owner
					? "Requirements met. Go on then."
					: "You do not meet the requirements to start this quest. You may still answer it in your head, but no XP will be awarded."));
				card.appendChild(req);

				var a = mk("a", "btn primary", owner ? "Click here to answer" : "Click here to answer (if you dare)");
				a.href = "answer/";
				card.appendChild(a);
				host.appendChild(card);
			})
			.catch(function () {
				clear(host);
				host.appendChild(mk("p", "gr-empty", "Connection lost. Please wait - attempting to reestablish. (The question didn't load.)"));
			});
	}

	function init() {
		var card = document.getElementById("grind-card");
		var page = document.getElementById("grind-page");
		var host = card || page;
		if (!host || !window.fetch) return;
		if (page) loadQuestion();
		var cfg = fetch(host.getAttribute("data-src") || "progress.json", { cache: "no-cache" })
			.then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
		// Sessions live in Supabase (public, read-only key). If it is down, fall back to progress.json.
		var live = fetch(HANS_URL + "/rest/v1/sessions?select=date,type,topic,confidence,result,note&order=date.asc,id.asc",
			{ headers: { apikey: HANS_KEY } })
			.then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
			.catch(function () { return null; });
		Promise.all([cfg, live])
			.then(function (res) {
				var data = res[0];
				if (Array.isArray(res[1])) data.sessions = res[1];
				return data;
			})
			.then(function (data) {
				var st = compute(data);
				if (card) renderCard(card, st);
				if (page) { renderPage(st); levelUps(st); }
			})
			.catch(function () {
				var msg = "Connection lost. Please wait - attempting to reestablish. (The scoreboard didn't load.)";
				if (card) { clear(card); card.appendChild(mk("p", "gr-note", msg)); }
				if (page) {
					var l = document.getElementById("gr-log");
					if (l) { clear(l); l.appendChild(mk("p", "gr-empty", msg)); }
				}
			});
	}
	init();
})();
