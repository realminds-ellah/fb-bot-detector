// Extraction layer — the ONLY code that touches Facebook's DOM.
// Everything downstream (analyze, ui) consumes plain objects from here, so when
// FB changes its markup this is the single file to patch.
(function () {
  const FBD = (window.FBD = window.FBD || {});

  const text = (el) => (el?.textContent || "").trim();

  const isProfileLink = (href) =>
    !!href &&
    /facebook\.com\/(profile\.php\?id=\d+|[A-Za-z0-9.\-]+)/.test(href) &&
    !/\/(posts|photo|photos|videos|video|groups|watch|events|reel|story\.php|permalink\.php|sharer|hashtag)/.test(
      href
    );

  // Stable identity key for an account (vanity path or numeric id).
  const profileKey = (href) => {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === "/profile.php" && u.searchParams.get("id")) {
        return "id:" + u.searchParams.get("id");
      }
      return "path:" + u.pathname.replace(/\/+$/, "");
    } catch {
      return null;
    }
  };

  // Best-effort parse of FB's coarse relative timestamps into an epoch (ms).
  // Returns null when unparseable. Precision is low by nature — callers must
  // treat the result as approximate.
  const parseRelativeTime = (s, now) => {
    if (!s) return null;
    const t = s.trim().toLowerCase();
    if (/just now|^now$/.test(t)) return now;
    const m = t.match(/^(\d+)\s*(m|min|mins|h|hr|hrs|d|w|y)\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2][0];
      const ms = { m: 6e4, h: 36e5, d: 864e5, w: 6048e5, y: 31536e6 }[unit];
      return ms ? now - n * ms : null;
    }
    if (/yesterday/.test(t)) return now - 864e5;
    return null;
  };

  // Find comment containers, with fallbacks for FB layout/locale variation.
  const findCommentEls = () => {
    const articles = [...document.querySelectorAll('[role="article"]')];
    // Primary: aria-label like "Comment by <name>" / "Reply by <name>".
    let els = articles.filter((a) =>
      /^(comment|reply) by/i.test(a.getAttribute("aria-label") || "")
    );
    // Fallback 1: any article whose label merely mentions comment/reply.
    if (!els.length)
      els = articles.filter((a) =>
        /\b(comment|reply)\b/i.test(a.getAttribute("aria-label") || "")
      );
    // Fallback 2: any element explicitly labelled as a comment, regardless of role.
    if (!els.length)
      els = [
        ...document.querySelectorAll(
          '[aria-label^="Comment by" i],[aria-label^="Reply by" i]'
        ),
      ];
    return els;
  };

  // Pull the comments currently rendered on the page. Read-only; never clicks.
  const scanComments = (limit = 500) => {
    const now = Date.now();
    const els = findCommentEls();
    console.debug(`[Comment Check] comment containers found: ${els.length}`);

    return els.slice(0, limit).map((el, index) => {
      const aria = el.getAttribute("aria-label") || "";
      const authorName =
        aria
          .replace(/^(comment|reply) by\s*/i, "")
          .split(/\s{2,}|,/)[0]
          .trim() || null;

      const hrefs = [...el.querySelectorAll("a[href]")].map((a) =>
        a.getAttribute("href")
      );
      const profileHref = hrefs.find(isProfileLink) || null;

      const body =
        [...el.querySelectorAll('div[dir="auto"], span[dir="auto"]')]
          .map(text)
          .filter(Boolean)
          .sort((a, b) => b.length - a.length)[0] || "";

      const tsEl = [...el.querySelectorAll("a")].find((a) =>
        /^\d+\s*(m|h|d|w|y)\b|min|hr|ago|\b\d{1,2}:\d{2}\b|just now|yesterday/i.test(
          text(a)
        )
      );
      const timestampText = tsEl ? text(tsEl) : null;

      return {
        index,
        el, // kept for in-page highlighting; never serialized
        authorName,
        authorKey: profileHref ? profileKey(profileHref) : null,
        authorProfileLink: profileHref || null,
        text: body,
        timestampText,
        timestampMs: parseRelativeTime(timestampText, now),
      };
    });
  };

  // Are there unloaded comments? (drives the honest "coverage" note in the UI)
  const findLoadMoreButtons = () =>
    [...document.querySelectorAll('[role="button"], span, div')].filter((el) =>
      /^view\s+(more|\d+|previous)\s+comments?$|^view\s+\d+\s+repl/i.test(
        text(el)
      )
    );

  FBD.extract = {
    scanComments,
    findLoadMoreButtons,
    parseRelativeTime,
    isProfileLink,
    profileKey,
  };
})();
