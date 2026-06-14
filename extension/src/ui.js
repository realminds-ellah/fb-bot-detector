// UI layer — injects a launcher button and a results panel into the page.
// All comment-derived strings are rendered with textContent (never innerHTML),
// since comment text is untrusted third-party content.
(function () {
  const FBD = (window.FBD = window.FBD || {});

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  let panel, body, handlers = {};

  const mount = (h) => {
    handlers = h || {};
    if (document.getElementById("fbd-launcher")) return;

    const launcher = el("button", "fbd-launcher", "🔍 Check comments");
    launcher.id = "fbd-launcher";
    launcher.addEventListener("click", () => {
      panel.classList.add("fbd-open");
      handlers.onScan?.();
    });
    document.body.appendChild(launcher);

    panel = el("div", "fbd-panel");
    panel.id = "fbd-panel";
    const header = el("div", "fbd-header");
    header.appendChild(el("span", "fbd-title", "Bot / Troll Check"));
    const close = el("button", "fbd-close", "✕");
    close.addEventListener("click", () => {
      panel.classList.remove("fbd-open");
      clearHighlights();
    });
    header.appendChild(close);
    panel.appendChild(header);

    body = el("div", "fbd-body");
    panel.appendChild(body);
    document.body.appendChild(panel);
  };

  const section = (title) => {
    const s = el("div", "fbd-section");
    s.appendChild(el("h3", "fbd-h3", title));
    body.appendChild(s);
    return s;
  };

  const renderLoading = () => {
    body.replaceChildren();
    body.appendChild(el("p", "fbd-muted", "Analyzing visible comments…"));
  };

  // one flagged-comment card: header + quote + the reasons that fired
  const flagCard = (parent, header, quote, reasons) => {
    const card = el("div", "fbd-card");
    card.appendChild(el("div", "fbd-card-h", header));
    if (quote) card.appendChild(el("div", "fbd-quote", `“${quote}”`));
    if (reasons && reasons.length)
      card.appendChild(el("div", "fbd-why", "Why: " + reasons.join(", ")));
    parent.appendChild(card);
  };

  const renderResults = (r, coverage) => {
    body.replaceChildren();

    // Summary banner
    const banner = el("div", `fbd-banner fbd-${r.level}`);
    banner.appendChild(
      el("strong", null, { low: "Looks mostly organic", medium: "Some suspicious activity", high: "Strong signs of coordination" }[r.level])
    );
    banner.appendChild(el("div", "fbd-muted", `${r.analyzed} comments analyzed`));
    body.appendChild(banner);

    // Coordination clusters — the headline finding
    const cs = section(`Coordinated clusters (${r.clusters.length})`);
    if (!r.clusters.length) {
      cs.appendChild(el("p", "fbd-muted", "No repeated/templated comments across accounts."));
    } else {
      r.clusters.slice(0, 8).forEach((cl) =>
        flagCard(
          cs,
          `${cl.size} comments · ${cl.distinctAuthors} accounts`,
          cl.sampleText,
          ["same/near-identical text posted by multiple accounts"]
        )
      );
    }

    // AI-generated-looking comments
    const ai = section(`AI-looking comments (${r.aiFlags.length})`);
    if (!r.aiFlags.length) ai.appendChild(el("p", "fbd-muted", "None stood out."));
    else
      r.aiFlags.slice(0, 8).forEach((f) =>
        flagCard(ai, `${f.author || "Unknown"} · ${f.score}% AI-ish`, f.text, f.reasons)
      );

    // Troll / hostile comments
    const tr = section(`Troll / hostile (${r.trollFlags.length})`);
    if (!r.trollFlags.length) tr.appendChild(el("p", "fbd-muted", "Nothing hostile detected."));
    else
      r.trollFlags.slice(0, 8).forEach((f) =>
        flagCard(tr, `${f.author || "Unknown"} · ${f.score}% hostile`, f.text, f.reasons)
      );

    // Spam / bot-like comments
    const sp = section(`Spam / bot-like (${r.spamFlags.length})`);
    if (!r.spamFlags.length) sp.appendChild(el("p", "fbd-muted", "No spammy/promotional comments."));
    else
      r.spamFlags.slice(0, 8).forEach((f) =>
        flagCard(sp, `${f.author || "Unknown"} · ${f.score}% spammy`, f.text, f.reasons)
      );

    // Account red-flags (the quick win — now actually shown)
    const af = section(`Account red-flags (${r.accountFlags.length})`);
    if (!r.accountFlags.length)
      af.appendChild(el("p", "fbd-muted", "No obvious account red-flags."));
    else
      r.accountFlags.slice(0, 8).forEach((a) =>
        flagCard(af, a.author || "Unknown", null, a.flags)
      );
    af.appendChild(
      el("p", "fbd-fine", "Limited: only the name + profile link are visible without opening each profile.")
    );

    // Burst timing (honest about coarseness)
    if (r.bursts.length) {
      const b = section("Timing bursts");
      r.bursts.slice(0, 5).forEach((bu) =>
        b.appendChild(el("div", "fbd-card", `${bu.count} comments around “${bu.window}” (approx — FB timestamps are coarse)`))
      );
    }

    // Coverage note — never pretend we saw everything
    const cov = section("Coverage");
    cov.appendChild(
      el("p", "fbd-muted",
        coverage.moreAvailable
          ? "More comments are not loaded. Scroll to load more, or use the risky full-load below."
          : "Analyzed all currently-loaded comments."
      )
    );
    const loadBtn = el("button", "fbd-risky", "⚠ Load all comments (risky)");
    loadBtn.addEventListener("click", () => handlers.onLoadMore?.());
    cov.appendChild(loadBtn);
    cov.appendChild(
      el("p", "fbd-fine", "Auto-loading clicks through the thread on your logged-in account — Facebook may flag heavy automation. Use sparingly.")
    );
  };

  // ---- in-page highlighting of flagged comments ----
  let highlighted = [];
  const highlight = (comments) => {
    clearHighlights();
    comments.forEach((c) => {
      if (c.el) {
        c.el.classList.add("fbd-flagged");
        highlighted.push(c.el);
      }
    });
  };
  const clearHighlights = () => {
    highlighted.forEach((e) => e.classList.remove("fbd-flagged"));
    highlighted = [];
  };

  FBD.ui = { mount, renderLoading, renderResults, highlight, clearHighlights };
})();
