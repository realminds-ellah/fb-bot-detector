// UI layer — injects a launcher and a results panel, and annotates the feed.
// Written for non-technical, potentially-vulnerable users: plain language, a clear
// protective summary, in-context badges, and a self-defence guide.
// All comment-derived strings use textContent (never innerHTML) — untrusted input.
(function () {
  const FBD = (window.FBD = window.FBD || {});

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  // Plain-language category definitions, shared by the panel and the feed badges.
  const CATS = {
    clusters: {
      title: "Copy-paste comments",
      icon: "📋",
      blurb:
        "The same (or nearly the same) comment posted by different accounts — a classic sign of a bot or paid campaign trying to make an opinion look popular.",
    },
    ai: {
      title: "Sounds AI-written",
      icon: "🤖",
      blurb:
        "Comments with the polished, generic style of AI text rather than a real person.",
    },
    troll: {
      title: "Hostile / trolling",
      icon: "😠",
      blurb:
        "Insulting, aggressive, or attacking comments meant to provoke or intimidate.",
    },
    spam: {
      title: "Spam / scams",
      icon: "📢",
      blurb: "Promotions, links, money-making pitches, or scam bait.",
    },
    account: {
      title: "Suspicious accounts",
      icon: "⚠️",
      blurb:
        "Account names with odd patterns (lots of digits, all caps). Limited — only the name and profile link are visible.",
    },
  };

  const SUMMARY = {
    low: {
      head: "✅ Looks genuine",
      msg: "These read like a mix of real, varied opinions. No signs of an organized push.",
    },
    medium: {
      head: "⚠️ Read with caution",
      msg: "Some comments here look fake, automated, or hostile. Don’t take the comment section at face value.",
    },
    high: {
      head: "🚨 Likely manipulated",
      msg: "Strong signs that comments here are coordinated, fake, or designed to provoke. Volume can be manufactured — don’t assume this reflects what real people think.",
    },
  };

  const TIPS = [
    "If the same point is repeated by many accounts, that’s volume — not proof it’s true or popular.",
    "Hostile replies are often designed to make you feel outnumbered or foolish for your view. That’s a tactic, not a verdict.",
    "Polished, generic comments may be AI-written. Real people include personal, specific details.",
    "Check a profile before trusting it: brand-new account, no photo, or an odd name with digits = be skeptical.",
    "Take a breath before reacting. Manufactured outrage is the goal — slowing down is your best defence.",
  ];

  let panel, body, handlers = {};

  const mount = (h) => {
    handlers = h || {};
    if (document.getElementById("fbd-launcher")) return;

    const launcher = el("button", "fbd-launcher", "🛡️ Check comments");
    launcher.id = "fbd-launcher";
    launcher.addEventListener("click", () => {
      panel.classList.add("fbd-open");
      handlers.onScan?.();
    });
    document.body.appendChild(launcher);

    panel = el("div", "fbd-panel");
    panel.id = "fbd-panel";
    const header = el("div", "fbd-header");
    header.appendChild(el("span", "fbd-title", "🛡️ Comment Check"));
    const close = el("button", "fbd-close", "✕");
    close.addEventListener("click", () => {
      panel.classList.remove("fbd-open");
      clearAnnotations();
    });
    header.appendChild(close);
    panel.appendChild(header);

    body = el("div", "fbd-body");
    panel.appendChild(body);
    document.body.appendChild(panel);
  };

  const section = (title, blurb) => {
    const s = el("div", "fbd-section");
    s.appendChild(el("h3", "fbd-h3", title));
    if (blurb) s.appendChild(el("p", "fbd-blurb", blurb));
    body.appendChild(s);
    return s;
  };

  const flagCard = (parent, header, quote, reasons) => {
    const card = el("div", "fbd-card");
    card.appendChild(el("div", "fbd-card-h", header));
    if (quote) card.appendChild(el("div", "fbd-quote", `“${quote}”`));
    if (reasons && reasons.length)
      card.appendChild(el("div", "fbd-why", "Why: " + reasons.join(", ")));
    parent.appendChild(card);
  };

  const renderLoading = () => {
    body.replaceChildren();
    body.appendChild(el("p", "fbd-muted", "Checking the comments on this page…"));
  };

  const renderResults = (r, coverage) => {
    body.replaceChildren();

    // Coverage guard: never claim "organic" if we barely read anything.
    if (!r.analyzed) {
      const b = el("div", "fbd-banner fbd-info");
      b.appendChild(el("strong", null, "🔍 No comments found to check"));
      b.appendChild(
        el("div", "fbd-muted",
          "Open a specific post and scroll down to its comments, then tap “Check comments” again.")
      );
      body.appendChild(b);
      return;
    }

    const s = SUMMARY[r.level];
    const banner = el("div", `fbd-banner fbd-${r.level}`);
    banner.appendChild(el("strong", null, s.head));
    banner.appendChild(el("div", "fbd-bannermsg", s.msg));
    banner.appendChild(el("div", "fbd-muted", `${r.analyzed} comments checked`));
    body.appendChild(banner);

    if (r.analyzed < 4) {
      body.appendChild(
        el("div", "fbd-note",
          "Only a few comments were visible, so this is a limited check. Scroll down to load more for a fuller picture.")
      );
    }

    const renderCat = (key, items, empty, headerFn) => {
      const sec = section(`${CATS[key].icon} ${CATS[key].title} (${items.length})`, CATS[key].blurb);
      if (!items.length) sec.appendChild(el("p", "fbd-muted", empty));
      else items.slice(0, 8).forEach((it) => headerFn(sec, it));
    };

    renderCat("clusters", r.clusters, "None found — comments look varied.", (sec, cl) =>
      flagCard(sec, `${cl.size} comments from ${cl.distinctAuthors} accounts`, cl.sampleText,
        ["same/near-identical text from multiple accounts"]));
    renderCat("ai", r.aiFlags, "None stood out.", (sec, f) =>
      flagCard(sec, `${f.author || "Unknown"} · ${f.score}% AI-ish`, f.text, f.reasons));
    renderCat("troll", r.trollFlags, "Nothing hostile detected.", (sec, f) =>
      flagCard(sec, `${f.author || "Unknown"} · ${f.score}% hostile`, f.text, f.reasons));
    renderCat("spam", r.spamFlags, "No spam/scam comments.", (sec, f) =>
      flagCard(sec, `${f.author || "Unknown"} · ${f.score}% spammy`, f.text, f.reasons));
    renderCat("account", r.accountFlags, "No obvious account red-flags.", (sec, a) =>
      flagCard(sec, a.author || "Unknown", null, a.flags));

    if (r.bursts.length) {
      const b = section("⏱️ Posted in a rush", "Lots of comments in the same short window — can indicate a coordinated push.");
      r.bursts.slice(0, 5).forEach((bu) =>
        b.appendChild(el("div", "fbd-card", `${bu.count} comments around “${bu.window}” (approx)`)));
    }

    // Self-defence guide — empower the reader.
    const tips = el("details", "fbd-tips");
    tips.appendChild(el("summary", null, "🧠 How to spot manipulation yourself"));
    const ul = el("ul");
    TIPS.forEach((t) => ul.appendChild(el("li", null, t)));
    tips.appendChild(ul);
    body.appendChild(tips);

    // Coverage + the gated risky loader.
    const cov = el("div", "fbd-section");
    if (coverage.moreAvailable)
      cov.appendChild(el("p", "fbd-muted", "More comments aren’t loaded yet. Scroll to load more, then check again."));
    const loadBtn = el("button", "fbd-risky", "⚠ Load all comments (advanced)");
    loadBtn.addEventListener("click", () => handlers.onLoadMore?.());
    cov.appendChild(loadBtn);
    cov.appendChild(
      el("p", "fbd-fine",
        "This clicks through the thread on your logged-in account; Facebook may flag heavy automation. Use sparingly.")
    );
    body.appendChild(cov);
  };

  // ---- in-feed annotation: a badge on each flagged comment, where you read it ----
  let annotated = [];
  const annotateFeed = (r) => {
    clearAnnotations();
    const map = new Map();
    const add = (c, key) => {
      if (!c || !c.el) return;
      if (!map.has(c.el)) map.set(c.el, new Set());
      map.get(c.el).add(key);
    };
    r.clusters.forEach((cl) => cl.comments.forEach((c) => add(c, "clusters")));
    r.aiFlags.forEach((f) => add(f.c, "ai"));
    r.trollFlags.forEach((f) => add(f.c, "troll"));
    r.spamFlags.forEach((f) => add(f.c, "spam"));

    for (const [elm, keys] of map) {
      elm.classList.add("fbd-flagged");
      const ks = [...keys];
      const badge = el("span", "fbd-badge", ks.map((k) => CATS[k].icon).join(" "));
      badge.title =
        ks.map((k) => CATS[k].title).join(" · ") +
        " — flagged by Comment Check";
      elm.appendChild(badge);
      annotated.push({ elm, badge });
    }
  };
  const clearAnnotations = () => {
    annotated.forEach(({ elm, badge }) => {
      elm.classList.remove("fbd-flagged");
      badge.remove();
    });
    annotated = [];
  };

  FBD.ui = { mount, renderLoading, renderResults, annotateFeed, clearAnnotations };
})();
