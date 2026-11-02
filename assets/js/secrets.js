/*
 * Secrets: hidden codes themed on the games I grew up with.
 * Type a code anywhere, or open the console (press ~, type "help", or tap the footer line).
 * Progress lives in localStorage on this browser only. Text and emoji only, no assets.
 * Add a secret: push to SECRETS (and to EFFECTS if it needs a new effect).
 */
(function () {
	"use strict";

	var KEY = "sx-found";
	var root = document.documentElement;
	var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

	var SECRETS = [
		{ id: "alliance", name: "For the Alliance", game: "World of Warcraft", codes: ["for the alliance"], konami: true,
			riddle: "Blue banners and a lion. Shout the battle cry, or enter the sacred 8-bit code.",
			extra: "The code: up up down down left right left right B A." },
		{ id: "horde", name: "For the Horde", game: "World of Warcraft", codes: ["for the horde"],
			riddle: "Orcs, trolls and tauren share one battle cry. Say it. The other faction is blue." },
		{ id: "rushb", name: "Rush B", game: "Counter-Strike 1.6", codes: ["rush b", "rushb"],
			riddle: "No stopping, no smoking, no mercy. Everyone buys an AK and goes to the second site." },
		{ id: "hesoyam", name: "HESOYAM", game: "GTA: San Andreas", codes: ["hesoyam"],
			riddle: "The most famous cheat in San Andreas. It heals CJ, gives him armour and $250,000." },
		{ id: "woah", name: "Woah!", game: "Crash Bandicoot", codes: ["woah", "whoa"],
			riddle: "What a certain orange marsupial yells when a crate goes boom or he grabs a Wumpa fruit." },
		{ id: "phat", name: "Party hat", game: "RuneScape", codes: ["phat", "party hat", "partyhat"],
			riddle: "The rarest holiday drop. Worn by the billionaires of every childhood. Four letters, one of them is a hat." },
		{ id: "leeroy", name: "Leeroy Jenkins", game: "World of Warcraft", codes: ["leeroy", "leeeeroy"],
			riddle: "Everybody was mid-plan. He ran in anyway. At least he had chicken." },
		{ id: "coffee", name: "Heals 3 hitpoints", game: "RuneScape", codes: [],
			riddle: "Not typed, poked. The fuel of this website sits at the bottom of every page. Keep poking it.",
			extra: "Poke the cup in the footer 4 times." }
	];

	function byId(id) { for (var i = 0; i < SECRETS.length; i++) if (SECRETS[i].id === id) return SECRETS[i]; return null; }

	// ---- progress -----------------------------------------------------------
	var found = [];
	try { found = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { found = []; }
	if (!Array.isArray(found)) found = [];
	function save() { try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) {} }
	function has(id) { return found.indexOf(id) !== -1; }

	// ---- tiny DOM helpers (text only, never innerHTML) -------------------------
	function mk(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	var toastEl, toastTimer;
	function toast(msg, ms) {
		if (!toastEl) { toastEl = mk("div"); toastEl.id = "sx-toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
		toastEl.textContent = msg;
		toastEl.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, ms || 3200);
	}

	function rain(emoji, n) {
		if (reduced) return;
		var box = mk("div", "sx-rain");
		box.setAttribute("aria-hidden", "true");
		for (var i = 0; i < n; i++) {
			var s = mk("span", null, emoji[i % emoji.length]);
			s.style.left = Math.random() * 98 + "%";
			s.style.fontSize = 18 + Math.random() * 22 + "px";
			s.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
			s.style.animationDelay = Math.random() * 0.8 + "s";
			s.style.setProperty("--rot", (Math.random() * 500 - 250).toFixed(0) + "deg");
			box.appendChild(s);
		}
		document.body.appendChild(box);
		setTimeout(function () { box.remove(); }, 4200);
	}
	function pulse(cls, ms) {
		if (reduced) return;
		root.classList.add(cls);
		setTimeout(function () { root.classList.remove(cls); }, ms);
	}
	function faction(name, other, msg) {
		root.classList.remove(other);
		root.classList.toggle(name);
		toast(root.classList.contains(name) ? msg : "Back to normal.");
	}

	var EFFECTS = {
		alliance: function () { faction("alliance", "horde", "⚔️ FOR THE ALLIANCE!"); },
		horde: function () { faction("horde", "alliance", "🔥 FOR THE HORDE! Lok'tar ogar!"); },
		rushb: function () { toast("RUSH B! No stop! 🏃💨"); pulse("sx-shake", 650); rain(["💣", "💨"], 18); },
		hesoyam: function () { toast("💵 $250,000. Health and armour restored."); rain(["💵", "💰"], 26); },
		woah: function () { toast("Woah! 🍑"); pulse("sx-spin", 950); rain(["🍑"], 16); },
		phat: function () { toast("A holiday drop! You will never be able to afford this. 🥳"); rain(["🥳", "🎉", "🎊"], 28); },
		leeroy: function () { toast("LEEEEEROOOOY JENKINS! 🍗"); pulse("sx-shake", 650); rain(["🍗"], 16); },
		coffee: function () { toast("You drink the coffee. It heals 3 hitpoints. ☕"); }
	};

	// Returns "new", "again" or null (unknown).
	function trigger(id) {
		var s = byId(id);
		if (!s) return null;
		var fresh = !has(id);
		if (fresh) { found.push(id); save(); }
		EFFECTS[id]();
		if (fresh) {
			setTimeout(function () {
				toast("🗝️ Secret found: " + s.name + " (" + found.length + "/" + SECRETS.length + ")");
				if (found.length === SECRETS.length) setTimeout(function () { toast("🏆 All " + SECRETS.length + " found. You have the max cape."); }, 3400);
			}, 1800);
		}
		updateHint();
		return fresh ? "new" : "again";
	}

	function matchCode(text) {
		for (var i = 0; i < SECRETS.length; i++)
			for (var j = 0; j < SECRETS[i].codes.length; j++)
				if (text === SECRETS[i].codes[j]) return SECRETS[i].id;
		return null;
	}

	// ---- footer ---------------------------------------------------------------
	var hintBtn;
	function updateHint() {
		if (!hintBtn) return;
		hintBtn.textContent = "🗝️ secrets " + found.length + "/" + SECRETS.length + " · " +
			(matchMedia("(hover: none)").matches ? "tap to open the console" : "press ~ to open the console");
	}
	function setupFooter() {
		var wrap = document.querySelector("footer .wrap");
		if (!wrap) return;
		var old = wrap.querySelector(".konami-hint");
		if (old) old.remove();
		var today = window.sxSeason && window.sxSeason.birthday();
		if (today) wrap.appendChild(mk("p", "sx-today", today));
		hintBtn = mk("button", "sx-hint");
		hintBtn.type = "button";
		hintBtn.addEventListener("click", function () { openConsole(); });
		wrap.appendChild(hintBtn);
		updateHint();

		// Coffee: poke the cup 4 times.
		var p = wrap.querySelector("p");
		if (p && p.textContent.indexOf("☕") !== -1) {
			var parts = p.textContent.split("☕");
			var cup = mk("span", "sx-coffee", "☕");
			cup.setAttribute("role", "button");
			cup.tabIndex = 0;
			cup.setAttribute("aria-label", "A cup of coffee");
			clear(p);
			p.appendChild(document.createTextNode(parts[0]));
			p.appendChild(cup);
			p.appendChild(document.createTextNode(parts.slice(1).join("☕")));
			var pokes = 0, pokeTimer;
			var poke = function () {
				pokes++;
				clearTimeout(pokeTimer);
				pokeTimer = setTimeout(function () { pokes = 0; }, 3000);
				if (pokes >= 4) { pokes = 0; trigger("coffee"); }
			};
			cup.addEventListener("click", poke);
			cup.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
		}
	}
	function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

	// ---- console ----------------------------------------------------------------
	var con, out, input, hintLevel = {};
	function print(text, cls) { out.appendChild(mk("div", cls || null, text)); out.scrollTop = out.scrollHeight; }
	function mask(code) { return code.replace(/[a-z0-9]/gi, "_").replace(/^_/, code.charAt(0)); }
	function maskAll(s) { return s.codes.length ? "Code: " + s.codes[0].split(" ").map(mask).join(" ") + " (" + s.codes[0].replace(/ /g, "").length + " letters)" : s.extra; }

	function listSecrets() {
		print("Secrets " + found.length + "/" + SECRETS.length + ". Type a code to try it, or hint <number> for more help.", "l-dim");
		SECRETS.forEach(function (s, i) {
			var n = "[" + (i + 1) + "] ";
			if (has(s.id)) { print(n + "✔ " + s.name + " — " + s.game, "l-ok"); return; }
			print(n + "??? " + s.riddle);
			var lv = hintLevel[s.id] || 0;
			if (lv >= 1) print("      game: " + s.game, "l-hot");
			if (lv >= 2) print("      " + maskAll(s) + (s.extra && s.codes.length ? " " + s.extra : ""), "l-hot");
		});
	}
	function giveHint(arg) {
		var n = parseInt(arg, 10), s = SECRETS[n - 1];
		if (!s) { print("Usage: hint <number>. See the numbers with: secrets", "l-dim"); return; }
		if (has(s.id)) { print("You already found that one.", "l-dim"); return; }
		hintLevel[s.id] = Math.min(2, (hintLevel[s.id] || 0) + 1);
		print(hintLevel[s.id] === 1 ? "Hint 1/2 — game: " + s.game : "Hint 2/2 — " + maskAll(s) + (s.extra && s.codes.length ? " " + s.extra : ""), "l-hot");
	}

	function run(raw) {
		var line = raw.trim().toLowerCase().replace(/\s+/g, " ");
		if (!line) return;
		print("> " + raw.trim(), "l-dim");
		var parts = line.split(" "), cmd = parts[0];
		if (cmd === "help") {
			print("Commands:\n  secrets        list the secrets and their riddles\n  hint <n>       a bigger hint for secret n\n  season [name]  preview a season: " + (window.sxSeason ? window.sxSeason.list().join(", ") : "") + ", auto, off\n  clear          clear this screen\n  exit           close the console (or press ~ / Esc)\nOr just type a code.");
		} else if (cmd === "secrets" || cmd === "list") { listSecrets();
		} else if (cmd === "hint") { giveHint(parts[1]);
		} else if (cmd === "clear") { clear(out);
		} else if (cmd === "exit" || cmd === "quit" || cmd === "close") { closeConsole();
		} else if (cmd === "season" && window.sxSeason) {
			var a = parts[1];
			if (!a) print("Seasons: " + window.sxSeason.list().join(", ") + ", auto, off", "l-dim");
			else if (a === "off") { window.sxSeason.off(); print("Season theme off.", "l-ok"); }
			else if (a === "auto" || window.sxSeason.list().indexOf(a) !== -1) { print("Season: " + window.sxSeason.set(a), "l-ok"); }
			else print("Unknown season: " + a, "l-dim");
		} else {
			var id = matchCode(line);
			if (id) { var r = trigger(id); print(r === "new" ? "Secret found: " + byId(id).name : "Already found. Again!", "l-ok"); }
			else print('Unknown command: "' + parts[0] + '"', "l-dim");
		}
	}

	function buildConsole() {
		con = mk("div"); con.id = "sx-console"; con.setAttribute("role", "dialog"); con.setAttribute("aria-label", "Secret console");
		out = mk("div", "out"); out.setAttribute("aria-live", "polite");
		var form = mk("form");
		var label = mk("label", null, "]"); label.setAttribute("for", "sx-input");
		input = mk("input"); input.id = "sx-input"; input.type = "text"; input.autocomplete = "off"; input.autocapitalize = "off"; input.spellcheck = false;
		input.setAttribute("enterkeyhint", "go");
		var x = mk("button", "x", "esc"); x.type = "button"; x.addEventListener("click", closeConsole);
		form.appendChild(label); form.appendChild(input); form.appendChild(x);
		form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); input.value = ""; });
		con.appendChild(out); con.appendChild(form);
		document.body.appendChild(con);
		print("eyther.dev console. There are " + SECRETS.length + " secrets on this site, themed on the games I grew up with.", "l-hot");
		print('Type "help" for commands, or "secrets" to see the riddles.', "l-dim");
	}
	var lastFocus = null;
	function openConsole() {
		if (!con) buildConsole();
		lastFocus = document.activeElement;
		con.classList.add("open");
		input.focus();
	}
	function closeConsole() {
		if (!con) return;
		con.classList.remove("open");
		input.blur();
		if (lastFocus && lastFocus.focus) lastFocus.focus();
	}
	function isOpen() { return con && con.classList.contains("open"); }

	// ---- keyboard ---------------------------------------------------------------
	var buf = "";
	var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"], kpos = 0;

	addEventListener("keydown", function (e) {
		var isTilde = e.code === "Backquote" || e.key === "`" || e.key === "~";
		if (isTilde && !e.ctrlKey && !e.metaKey && !e.altKey) {
			var t0 = e.target && e.target.tagName;
			if (isOpen()) { e.preventDefault(); closeConsole(); return; }
			if (t0 !== "INPUT" && t0 !== "TEXTAREA") { e.preventDefault(); openConsole(); return; }
		}
		if (e.key === "Escape" && isOpen()) { closeConsole(); return; }
		var tag = e.target && e.target.tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;

		// Konami
		var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		kpos = k === KONAMI[kpos] ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
		if (kpos === KONAMI.length) { kpos = 0; trigger("alliance"); return; }

		// Typed codes
		if (e.key.length === 1) {
			buf = (buf + e.key.toLowerCase()).slice(-24);
			if (buf.slice(-4) === "help") { buf = ""; openConsole(); return; }
			var id = null;
			for (var i = 0; i < SECRETS.length && !id; i++)
				for (var j = 0; j < SECRETS[i].codes.length; j++) {
					var c = SECRETS[i].codes[j];
					if (buf.slice(-c.length) === c) { id = SECRETS[i].id; break; }
				}
			if (id) { buf = ""; trigger(id); }
		}
	});

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupFooter);
	else setupFooter();
})();
