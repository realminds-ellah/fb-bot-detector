// FB Engagement Probe — injected on demand via chrome.scripting.executeScript.
// Read-only reconnaissance: it inspects whatever is already rendered and reports
// what is extractable. It does NOT click, scroll, or expand anything.
// The IIFE's return value is what executeScript hands back to the popup.
(() => {
  const text = (el) => (el?.textContent || "").trim();

  // A link is a "profile" link if it points at a person, not a post/photo/group/etc.
  const isProfileLink = (href) =>
    !!href &&
    /facebook\.com\/(profile\.php\?id=\d+|[A-Za-z0-9.\-]+)/.test(href) &&
    !/\/(posts|photo|photos|videos|video|groups|watch|events|reel|story\.php|permalink\.php|sharer|hashtag)/.test(
      href
    );

  // Normalise a profile href to a stable identity key (strip tracking query/hash).
  const cleanProfile = (href) => {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === "/profile.php" && u.searchParams.get("id")) {
        return `${u.origin}/profile.php?id=${u.searchParams.get("id")}`;
      }
      return `${u.origin}${u.pathname}`;
    } catch {
      return href;
    }
  };

  const articles = [...document.querySelectorAll('[role="article"]')];

  // FB comments are role="article" with an aria-label like "Comment by <name> ...".
  const commentEls = articles.filter((a) =>
    /^comment by/i.test(a.getAttribute("aria-label") || "")
  );

  const commentSamples = commentEls.slice(0, 5).map((c, index) => {
    const aria = c.getAttribute("aria-label") || "";
    const authorName =
      aria
        .replace(/^comment by\s*/i, "")
        .split(/\s{2,}|,/)[0]
        .trim() || null;

    const hrefs = [...c.querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href")
    );
    const profileHref = hrefs.find(isProfileLink) || null;

    // Comment body = the longest dir="auto" text block inside the comment.
    const commentText =
      [...c.querySelectorAll('div[dir="auto"], span[dir="auto"]')]
        .map(text)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || null;

    // Timestamp = a link whose text looks like relative time ("3h", "5 min", "2:14").
    const tsLink = [...c.querySelectorAll("a")].find((a) =>
      /^\d+\s*(m|h|d|w|y)\b|min|hr|ago|\b\d{1,2}:\d{2}\b/i.test(text(a))
    );

    return {
      index,
      authorName,
      authorProfileLink: profileHref ? cleanProfile(profileHref) : null,
      commentText: commentText ? commentText.slice(0, 200) : null,
      timestampText: tsLink ? text(tsLink) : null,
    };
  });

  // Reaction summary indicators, e.g. aria-label "123 reactions" / "Like: 50 people".
  const reactionSamples = [...document.querySelectorAll("[aria-label]")]
    .map((el) => el.getAttribute("aria-label"))
    .filter((l) => /\d[\d,]*\s+(reaction|like)/i.test(l || ""))
    .slice(0, 5);

  // The open question: are individual reactor identities readable?
  // Only possible once the user has manually opened the reactions dialog.
  const dialog = document.querySelector('[role="dialog"]');
  let reactorSamples = [];
  if (dialog) {
    reactorSamples = [...dialog.querySelectorAll("a[href]")]
      .map((a) => ({ name: text(a), link: a.getAttribute("href") }))
      .filter((x) => x.name && isProfileLink(x.link))
      .slice(0, 10)
      .map((x) => ({ name: x.name, link: cleanProfile(x.link) }));
  }

  const capabilities = {
    commentsReadable: commentEls.length > 0,
    authorNameReadable: commentSamples.some((s) => s.authorName),
    authorProfileLinkReadable: commentSamples.some((s) => s.authorProfileLink),
    commentTextReadable: commentSamples.some((s) => s.commentText),
    timestampReadable: commentSamples.some((s) => s.timestampText),
    reactionCountsReadable: reactionSamples.length > 0,
    reactorListReadable: reactorSamples.length
      ? `YES — ${reactorSamples.length}+ reactor profiles readable from the open dialog`
      : "UNKNOWN — open the post's reactions dialog (click the reaction count), then re-scan",
  };

  return {
    url: location.href,
    scannedAt: new Date().toISOString(),
    counts: {
      roleArticleTotal: articles.length,
      commentCandidates: commentEls.length,
      reactionIndicators: reactionSamples.length,
      reactorsInOpenDialog: reactorSamples.length,
    },
    capabilities,
    reactionSamples,
    reactorSamples,
    commentSamples,
  };
})();
