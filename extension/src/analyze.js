// Analysis layer — pure functions over the comment objects from extract.js.
// No DOM access here, so this is the part that's easy to reason about and tune.
// Output leads with COORDINATION CLUSTERS, not per-account "bot" verdicts.
(function () {
  const FBD = (window.FBD = window.FBD || {});

  // ---- tunable thresholds (kept together so they're easy to adjust) ----
  const NEAR_DUP_JACCARD = 0.8; // token overlap to count two comments as "same template"
  const BURST_MIN = 5; // comments sharing a coarse time bucket to flag a burst
  const AI_FLAG_SCORE = 0.5; // per-comment AI-likelihood to flag

  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation & emoji
      .replace(/\s+/g, " ")
      .trim();

  const tokens = (s) => new Set(normalize(s).split(" ").filter(Boolean));

  const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  };

  // ---- signal 1: duplication / templating across DIFFERENT accounts ----
  // The strongest signal. Same/near-same text from 2+ distinct authors = coordination.
  const findClusters = (comments) => {
    const items = comments
      .filter((c) => normalize(c.text).length >= 8) // ignore trivially short text
      .map((c) => ({ c, tok: tokens(c.text) }));

    const used = new Array(items.length).fill(false);
    const clusters = [];

    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const members = [items[i]];
      used[i] = true;
      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        if (jaccard(items[i].tok, items[j].tok) >= NEAR_DUP_JACCARD) {
          members.push(items[j]);
          used[j] = true;
        }
      }
      const authors = new Set(
        members.map((m) => m.c.authorKey || m.c.authorName).filter(Boolean)
      );
      // Coordination requires repetition across MORE THAN ONE account.
      if (members.length >= 2 && authors.size >= 2) {
        clusters.push({
          size: members.length,
          distinctAuthors: authors.size,
          sampleText: members[0].c.text.slice(0, 160),
          comments: members.map((m) => m.c),
        });
      }
    }
    return clusters.sort((a, b) => b.size - a.size);
  };

  // ---- signal 2: AI-generated text heuristics (free, on-device, weak-ish) ----
  const AI_PATTERNS = [
    /\b(great|amazing|awesome|wonderful|excellent|fantastic|insightful|so true|well said|thanks for sharing|very informative)\b/i,
    /\b(moreover|furthermore|in addition|therefore|consequently|it'?s important to note|in conclusion|that being said)\b/i,
    /\b(in today'?s (digital |fast-paced )?world|delve into|navigate the|tapestry|testament to|plays a (crucial|vital|pivotal) role|game[- ]changer|ever[- ]evolving|landscape)\b/i,
  ];
  const aiScore = (textStr) => {
    const s = textStr || "";
    if (normalize(s).length < 20) return 0;
    let hits = AI_PATTERNS.reduce((n, re) => n + (re.test(s) ? 1 : 0), 0);
    // bonus: long, no first-person, tidy punctuation reads "essay-like"
    if (s.length > 120 && !/\b(i|i'm|i've|my|me)\b/i.test(s) && /[.!?]\s/.test(s))
      hits += 1;
    return Math.min(1, hits / (AI_PATTERNS.length + 1));
  };

  // ---- signal 3: burst timing (coarse — relative timestamps limit precision) ----
  const findBursts = (comments) => {
    const buckets = {};
    for (const c of comments) {
      if (!c.timestampText) continue;
      (buckets[c.timestampText] ||= []).push(c);
    }
    return Object.entries(buckets)
      .filter(([, arr]) => arr.length >= BURST_MIN)
      .map(([window, arr]) => ({ window, count: arr.length }))
      .sort((a, b) => b.count - a.count);
  };

  // ---- signal 4: per-account red flags (secondary, intentionally weak) ----
  const profileFlags = (c) => {
    const flags = [];
    if (!c.authorProfileLink) flags.push("no profile link");
    if (c.authorName && /^[A-Z\s]{6,}$/.test(c.authorName))
      flags.push("all-caps name");
    return flags;
  };

  const run = (comments) => {
    const clusters = findClusters(comments);
    const bursts = findBursts(comments);

    const aiFlags = comments
      .map((c) => ({ c, score: aiScore(c.text) }))
      .filter((x) => x.score >= AI_FLAG_SCORE);

    const clusteredComments = new Set(
      clusters.flatMap((cl) => cl.comments)
    );

    // Overall suspicion: driven mostly by coordination, lightly by AI/burst.
    let level = "low";
    const coordShare = comments.length
      ? clusteredComments.size / comments.length
      : 0;
    if (clusters.length >= 1 && (coordShare >= 0.15 || clusters[0]?.size >= 4))
      level = "medium";
    if (
      coordShare >= 0.3 ||
      clusters.some((cl) => cl.distinctAuthors >= 5) ||
      (clusters.length >= 2 && bursts.length >= 1)
    )
      level = "high";

    return {
      level,
      analyzed: comments.length,
      clusters,
      bursts,
      aiFlags: aiFlags.map((x) => ({
        text: x.c.text.slice(0, 160),
        author: x.c.authorName,
        score: Math.round(x.score * 100),
        c: x.c,
      })),
      profileFlags: comments
        .map((c) => ({ c, flags: profileFlags(c) }))
        .filter((x) => x.flags.length),
      flaggedComments: [
        ...clusteredComments,
        ...aiFlags.map((x) => x.c),
      ],
    };
  };

  FBD.analyze = { run, aiScore, normalize, jaccard };
})();
