// Analysis layer — pure functions over the comment objects from extract.js.
// No DOM access here, so this is the part that's easy to reason about and tune.
//
// It judges along several axes, each transparent (every flag carries the
// "reasons" that fired):
//   - coordination clusters  (cross-comment: near-duplicate text from many accounts)
//   - AI-generated text       (per-comment: statistical/stylistic features)
//   - troll / hostile         (per-comment: insults, shouting, attacks)
//   - spam / bot              (per-comment: promo phrasing, links, junk names)
//   - account red-flags       (per-comment: what little the name/link reveal)
//   - timing bursts           (thread-level)
//
// It leads with COORDINATION, not per-account "bot" verdicts — coordination is
// the strongest, hardest-to-fake signal.
(function () {
  const FBD = (window.FBD = window.FBD || {});

  // ---- tunable thresholds ----
  const NEAR_DUP_JACCARD = 0.8; // token overlap to count two comments as the same template
  const BURST_MIN = 5; // comments sharing a coarse time bucket to flag a burst
  const AI_FLAG = 0.55;
  const TROLL_FLAG = 0.5;
  const SPAM_FLAG = 0.5;

  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const tokens = (s) => new Set(normalize(s).split(" ").filter(Boolean));

  const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  };

  // ---- shared lexicons (regex; cheap and on-device) ----
  const SLANG =
    /\b(lol|lmao|lmfao|omg|idk|tbh|imo|imho|ngl|fr|smh|bruh|bro|yall|gonna|wanna|gotta|kinda|dunno|nah|yep|nope|ur|ya|cuz|wtf|af|deadass|lowkey|highkey|fam)\b/i;
  const FORMAL =
    /\b(moreover|furthermore|in addition|additionally|however|therefore|thus|consequently|nevertheless|nonetheless|that being said|in conclusion|to summarize|on the other hand|it is (important|worth) (to note|noting))\b/i;
  const CLICHE =
    /\b(in today'?s (digital |fast-paced )?world|delve into|navigate the|tapestry|testament to|ever[- ]evolving|the landscape of|plays? a (crucial|vital|pivotal|key|significant) role|game[- ]changer|when it comes to|at the end of the day|it'?s worth noting|a myriad of|underscores?|paradigm|holistic|leverage|seamless|cutting[- ]edge)\b/i;
  const PRAISE =
    /\b(great (post|article|content|read)|amazing|awesome|wonderful|excellent|fantastic|incredible|so (true|inspiring)|well said|thanks? (for|so much for) sharing|very (informative|insightful)|love this|nicely (put|said)|spot on)\b/i;
  const CONTRACTION = /\b\w+['’](t|s|re|ll|ve|m|d)\b/i;
  const FIRST_PERSON = /\b(i|i'?m|i'?ve|my|me|mine|we|our)\b/i;
  const INSULT =
    /\b(idiot|idiots|stupid|dumb|moron|morons|imbecile|clown|clowns|loser|losers|pathetic|trash|garbage|disgrace|disgusting|shut up|get a life|nobody cares|cry more|cope|seethe|snowflake|sheep|sheeple|libtard|brainwashed|braindead|delusional)\b/i;
  const PROFAN = /\b(damn|crap|bs|bullshit|asshole|bastard|piss off)\b/i;
  const SPAM =
    /\b(dm me|message me|check (my|out my) (profile|bio|page|link)|click (the |this )?link|link in bio|visit my|follow me|make \$?\d|earn \$?\d|work from home|invest(ment)? now|crypto|bitcoin|btc|forex|trading signals|giveaway|you'?re? (a )?winner|claim your|limited (time )?offer|act now|whatsapp|telegram me)\b/i;
  const PICTO = /\p{Extended_Pictographic}/gu;

  // ---- signal: coordination clusters (the strongest) ----
  const findClusters = (comments) => {
    const items = comments
      .filter((c) => normalize(c.text).length >= 8)
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

  // ---- signal: timing bursts (coarse — relative timestamps limit precision) ----
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

  // ---- per-comment scorers: each returns {score 0..1, reasons[]} ----
  const aiScore = (s) => {
    s = s || "";
    const reasons = [];
    if (normalize(s).length < 20) return { score: 0, reasons };
    let score = 0;
    if (CLICHE.test(s)) (score += 0.3), reasons.push("AI cliché phrasing");
    if (FORMAL.test(s)) (score += 0.2), reasons.push("formal connectors");
    if (PRAISE.test(s)) (score += 0.15), reasons.push("generic praise");
    if (!CONTRACTION.test(s) && s.length > 60)
      (score += 0.2), reasons.push("no contractions (formal register)");
    if (s.length > 90 && !FIRST_PERSON.test(s))
      (score += 0.15), reasons.push("impersonal / no first-person");
    if (
      s.length > 80 &&
      /^[A-Z].*[.!?]$/.test(s.trim()) &&
      !/[A-Z]{4,}/.test(s) &&
      !/[!?]{2,}/.test(s)
    )
      (score += 0.15), reasons.push("polished mechanics");
    if (s.length > 40 && (/^\s*\p{Extended_Pictographic}/u.test(s) || /\p{Extended_Pictographic}\s*$/u.test(s)))
      (score += 0.1), reasons.push("emoji-framed prose");
    // human signals pull the score down
    if (SLANG.test(s)) (score -= 0.5), reasons.push("casual slang (reads human)");
    if (/(.)\1{2,}/.test(normalize(s)))
      (score -= 0.2), reasons.push("elongated spelling (reads human)");
    return { score: Math.max(0, Math.min(1, score)), reasons };
  };

  const trollScore = (s) => {
    s = s || "";
    const reasons = [];
    if (!s.trim()) return { score: 0, reasons };
    let score = 0;
    if (INSULT.test(s)) (score += 0.6), reasons.push("insults / name-calling");
    if (PROFAN.test(s)) (score += 0.2), reasons.push("profanity");
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    const caps = (s.match(/[A-Z]/g) || []).length;
    if (letters >= 8 && caps / letters > 0.7)
      (score += 0.3), reasons.push("ALL-CAPS shouting");
    if (/[!?]{3,}/.test(s)) (score += 0.15), reasons.push("aggressive punctuation");
    if (/\byou('?re| are)?\b[^.?!]*\b(idiot|stupid|dumb|clown|loser|wrong|joke|pathetic)\b/i.test(s))
      (score += 0.25), reasons.push("direct personal attack");
    return { score: Math.max(0, Math.min(1, score)), reasons };
  };

  const spamScore = (s, c) => {
    s = s || "";
    const reasons = [];
    let score = 0;
    if (SPAM.test(s)) (score += 0.6), reasons.push("promotional / spam phrasing");
    if (/(https?:\/\/|www\.)\S+/i.test(s)) (score += 0.3), reasons.push("contains link");
    if ((s.match(PICTO) || []).length >= 5) (score += 0.2), reasons.push("emoji spam");
    if (c?.authorName && /\d{4,}/.test(c.authorName))
      (score += 0.2), reasons.push("many digits in name");
    return { score: Math.max(0, Math.min(1, score)), reasons };
  };

  const accountFlags = (c) => {
    const flags = [];
    if (!c.authorProfileLink) flags.push("no profile link");
    if (c.authorName && /\d{4,}/.test(c.authorName)) flags.push("digits in name");
    if (c.authorName && /^[A-Z][A-Z\s]{5,}$/.test(c.authorName)) flags.push("all-caps name");
    if (c.authorName && /(.)\1{3,}/i.test(c.authorName)) flags.push("repeated chars in name");
    return flags;
  };

  const run = (comments) => {
    const clusters = findClusters(comments);
    const bursts = findBursts(comments);

    const aiFlags = [];
    const trollFlags = [];
    const spamFlags = [];
    const acctFlags = [];

    const pack = (c, r) => ({
      c,
      author: c.authorName,
      text: (c.text || "").slice(0, 160),
      score: Math.round(r.score * 100),
      reasons: r.reasons,
    });

    for (const c of comments) {
      const ai = aiScore(c.text);
      if (ai.score >= AI_FLAG) aiFlags.push(pack(c, ai));
      const tr = trollScore(c.text);
      if (tr.score >= TROLL_FLAG) trollFlags.push(pack(c, tr));
      const sp = spamScore(c.text, c);
      if (sp.score >= SPAM_FLAG) spamFlags.push(pack(c, sp));
      const fl = accountFlags(c);
      if (fl.length) acctFlags.push({ c, author: c.authorName, flags: fl });
    }

    const clustered = new Set(clusters.flatMap((cl) => cl.comments));
    const flagged = new Set([
      ...clustered,
      ...aiFlags.map((x) => x.c),
      ...trollFlags.map((x) => x.c),
      ...spamFlags.map((x) => x.c),
    ]);

    const analyzed = comments.length;
    const coordShare = analyzed ? clustered.size / analyzed : 0;
    const flaggedRatio = analyzed ? flagged.size / analyzed : 0;

    let level = "low";
    if (
      clusters.length >= 1 ||
      aiFlags.length ||
      trollFlags.length ||
      spamFlags.length
    ) {
      if (flaggedRatio >= 0.15 || coordShare >= 0.15) level = "medium";
    }
    if (
      coordShare >= 0.3 ||
      clusters.some((cl) => cl.distinctAuthors >= 5) ||
      (clusters.length >= 2 && bursts.length >= 1) ||
      flaggedRatio >= 0.4
    )
      level = "high";

    return {
      level,
      analyzed,
      clusters,
      bursts,
      aiFlags,
      trollFlags,
      spamFlags,
      accountFlags: acctFlags,
      flaggedComments: [...flagged],
    };
  };

  FBD.analyze = { run, aiScore, trollScore, spamScore, accountFlags, normalize, jaccard };
})();
