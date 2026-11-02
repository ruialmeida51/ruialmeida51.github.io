/*
 * Answer desk: private page. Magic-link login, today's question, my answer, the review.
 * Talks to the "hans" Supabase project with the public (publishable) key. What the key can do
 * is decided by row-level security: only a linked login can read questions and its own answers,
 * and can insert an unreviewed answer. Reviews are written by the owner's scheduled reviewer.
 */
(function () {
	"use strict";

	var HANS_URL = "https://fotbvouyrrwuoyinrryw.supabase.co";
	var HANS_KEY = "sb_publishable_RXiIRWiyUSG887AJvP5XxQ_y4seOvRe";
	var body = document.getElementById("an-body");
	if (!body) return;

	function mk(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}
	function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
	function show(el) { clear(body); body.appendChild(el); }

	if (!window.supabase || !window.supabase.createClient) {
		show(mk("p", "gr-empty", "Connection lost. Please wait - attempting to reestablish. (The login library didn't load.)"));
		return;
	}
	var sb = window.supabase.createClient(HANS_URL, HANS_KEY, {
		auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
	});

	// ---- signed out ----------------------------------------------------------

	function loginCard(note) {
		var box = mk("div", "card an-card");
		box.appendChild(mk("h2", null, "Want to answer?"));
		box.appendChild(mk("p", "gr-note", "Only I can. Type your email and I'll send a sign-in link, no password."));
		var form = mk("form", "an-form");
		var input = mk("input");
		input.type = "email"; input.required = true; input.autocomplete = "email";
		input.placeholder = "you@example.com"; input.setAttribute("aria-label", "Email");
		var btn = mk("button", "btn primary", "Send link");
		btn.type = "submit";
		var msg = mk("p", "gr-note an-msg", note || "");
		msg.setAttribute("role", "status");
		form.appendChild(input); form.appendChild(btn);
		form.addEventListener("submit", function (ev) {
			ev.preventDefault();
			btn.disabled = true; msg.textContent = "Sending…";
			sb.auth.signInWithOtp({
				email: input.value.trim(),
				options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false }
			}).then(function (r) {
				btn.disabled = false;
				// Same answer whether or not the address is known, so this page doesn't reveal who has an account.
				msg.textContent = r.error && r.error.status === 429
					? "Too many tries. Give it a few minutes."
					: "If that address has an account, a link is on its way. Open it on this device.";
			});
		});
		box.appendChild(form); box.appendChild(msg);
		return box;
	}

	// ---- signed in -----------------------------------------------------------

	function dateLabel(d) {
		var p = String(d).split("-");
		return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString(undefined,
			{ weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
	}

	function badge(result) {
		var map = { right: "Right", partly: "Partly", missed: "Missed" };
		return mk("span", "an-badge an-" + result, map[result] || result);
	}

	function answerForm(q, onDone) {
		var form = mk("form", "an-form an-answer");
		var ta = mk("textarea");
		ta.required = true; ta.maxLength = 8000; ta.rows = 7;
		ta.setAttribute("aria-label", "Your answer");
		ta.placeholder = "From my head. No AI, no lookups.";
		var conf = mk("fieldset", "an-conf");
		conf.appendChild(mk("legend", null, "How sure are you, before you look anything up?"));
		for (var i = 1; i <= 5; i++) {
			var lab = mk("label");
			var r = mk("input"); r.type = "radio"; r.name = "conf"; r.value = String(i); r.required = true;
			lab.appendChild(r); lab.appendChild(document.createTextNode(" " + i));
			conf.appendChild(lab);
		}
		var btn = mk("button", "btn primary", "Submit answer");
		btn.type = "submit";
		var msg = mk("p", "gr-note an-msg", "");
		msg.setAttribute("role", "status");
		form.appendChild(ta); form.appendChild(conf); form.appendChild(btn); form.appendChild(msg);
		form.addEventListener("submit", function (ev) {
			ev.preventDefault();
			var picked = form.querySelector("input[name=conf]:checked");
			btn.disabled = true; msg.textContent = "Sending…";
			sb.from("answers").insert({
				question_id: q.id, body: ta.value.trim(), confidence: picked ? +picked.value : null
			}).then(function (r) {
				if (r.error) {
					btn.disabled = false;
					msg.textContent = r.error.code === "23505"
						? "You already answered this one."
						: "That didn't go through. Your text is still here, try again.";
					return;
				}
				onDone();
			});
		});
		return form;
	}

	function questionCard(q, a, signedIn, onDone) {
		var card = mk("article", "card an-card");
		var head = mk("div", "an-head");
		head.appendChild(mk("span", "an-kind", q.kind.toUpperCase() + " · " + q.topic));
		head.appendChild(mk("span", "gr-note", dateLabel(q.date)));
		card.appendChild(head);
		card.appendChild(mk("h2", null, q.title));
		card.appendChild(mk("div", "an-text", q.body));
		if (!signedIn) {
			// Public view: the question only.
		} else if (!a) {
			card.appendChild(answerForm(q, onDone));
		} else {
			var mine = mk("div", "an-mine");
			mine.appendChild(mk("h3", null, "My answer" + (a.confidence ? " (sure: " + a.confidence + "/5)" : "")));
			mine.appendChild(mk("div", "an-text", a.body));
			card.appendChild(mine);
			var rv = mk("div", "an-review");
			if (a.reviewed_at) {
				var h = mk("h3", null, "Review ");
				if (a.result) h.appendChild(badge(a.result));
				rv.appendChild(h);
				rv.appendChild(mk("div", "an-text", a.review || ""));
			} else {
				rv.appendChild(mk("p", "gr-note", "Waiting for the review. Answers are reviewed once a day, just after 12:00 on weekdays. Miss it and it waits for the next day."));
			}
			card.appendChild(rv);
		}
		return card;
	}

	function renderDesk(signedIn) {
		var qReq = sb.from("questions").select("id,date,kind,topic,title,body")
			.order("date", { ascending: false }).order("id", { ascending: false }).limit(20);
		var jobs = signedIn
			? [qReq, sb.rpc("my_handle"), sb.from("answers").select("question_id,body,confidence,submitted_at,review,result,reviewed_at")]
			: [qReq];
		Promise.all(jobs).then(function (res) {
			var failed = res.some(function (r) { return r.error; });
			if (failed) {
				show(mk("p", "gr-empty", "Connection lost. Please wait - attempting to reestablish. (Couldn't load the desk.)"));
				return;
			}
			var qs = res[0].data || [];
			var handle = signedIn ? res[1].data : null;
			var as = signedIn ? (res[2].data || []) : [];
			var wrap = mk("div", "an-wrap");

			if (signedIn) {
				var top = mk("p", "gr-note an-top");
				top.appendChild(document.createTextNode(handle ? "Signed in as " + handle + ". " : "Signed in. "));
				var out = mk("button", "btn", "Sign out");
				out.type = "button";
				out.addEventListener("click", function () { sb.auth.signOut().then(function () { renderDesk(false); }); });
				top.appendChild(out);
				wrap.appendChild(top);
				if (!handle) {
					wrap.appendChild(mk("p", "gr-empty", "This login isn't linked to a profile, so it can't answer anything."));
					signedIn = false;
				}
			} else {
				wrap.appendChild(loginCard());
			}
			if (!qs.length) {
				wrap.appendChild(mk("p", "gr-empty", "Hans: Hello. What are you doing here? No questions yet. They arrive with the morning session."));
				show(wrap); return;
			}
			var byQ = {};
			as.forEach(function (a) { byQ[a.question_id] = a; });
			qs.forEach(function (q) { wrap.appendChild(questionCard(q, byQ[q.id], signedIn, function () { renderDesk(true); })); });
			show(wrap);
		});
	}

	// ---- boot ----------------------------------------------------------------

	sb.auth.onAuthStateChange(function (event, session) {
		if (event === "SIGNED_OUT") renderDesk(false);
		if (event === "SIGNED_IN" && session) {
			// Drop the one-time tokens from the address bar.
			if (location.hash || location.search) history.replaceState(null, "", location.pathname);
		}
	});
	sb.auth.getSession().then(function (r) {
		renderDesk(!!(r.data && r.data.session));
	});
})();
