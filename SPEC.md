# Bot/Troll Detector for Facebook — v1 Spec

*Working title: TBD. Status: draft v0.1 — 2026-06-14*

---

## Problem

Facebook comment sections and reaction counts are increasingly polluted by bots,
troll accounts, and (newly) AI-generated comment spam that passes every old
"how to spot a bot" checklist. There is **no tool a normal FB user can point at an
arbitrary post** to get a read on how much of the engagement looks inauthentic.
Meta does this internally; nothing exists for the person scrolling the feed.

## Who it's for

Any everyday Facebook user who wants a sanity check on a post they're looking at —
"are these comments real, or is this brigaded / botted / AI-spammed?" No login,
no account, no setup beyond installing the extension.

## Why a browser extension (the one viable shape)

"Usable by any FB user on any post" rules out the Graph API entirely — there is no
API that returns comments/reactions on arbitrary posts (Page Public Content Access
only covers Pages, needs heavy app review, and isn't granted to small apps). The
**only** way to see arbitrary post content is to read what's already rendered in
the user's own browser. So: a client-side browser extension.

**Bonus vs API:** the DOM exposes real, global profile links (not the API's
page-scoped throwaway IDs), so the same account is recognizable across posts —
which makes cross-post coordination detection possible later (v2).

## How it works (v1)

1. User is viewing any FB post. They click the extension.
2. Extension reads the comments/reactions **currently rendered** on the page.
3. By default it analyzes only what's naturally loaded (conservative). An explicit
   **"load everything (risky)"** button lets the user opt into auto-expanding the
   thread per scan — with a clear warning (see Risks).
4. All analysis runs **on-device**. Nothing leaves the user's machine.
5. Result: a summary score + flagged comment clusters with plain-English reasons.

## Detection signals (v1)

| Signal | What it catches | Strength |
|---|---|---|
| **Comment duplication / templating** | Copy-paste & near-duplicate comments across accounts | Strong |
| **AI-generated text** | LLM-written comment spam (heuristics now; optional small bundled local model later) | Medium, fresh angle |
| **Burst timing** | Many comments/reactions clustered in a tight time window | Medium |
| **Profile red-flags** | Default avatar, nonsense handles, no profile link, etc. | Weak (secondary) |

Output framing: **lead with clusters, not per-account verdicts.** Show
"these N comments look coordinated/inauthentic, here's why" — never a confident
"this person is a bot (73%)". Avoids false-positive harm and is more defensible.

## Architecture

- **100% client-side.** No backend, no accounts, no paid APIs → **$0 to run, $0 for users.**
- Content script reads the DOM (anchored on roles/aria/structure, *not* FB's
  randomized class names, which churn).
- Analysis is local computation: clustering, timing, heuristics. AI-text starts as
  heuristics; optional small in-browser model (ONNX/transformers.js) as an upgrade.
- The cost tradeoff is **power, not money** — small local models < cloud LLMs.
  Optional future "bring your own API key" power mode keeps cost off us.

## Scope

**v1**
- Single post, on-screen analysis
- The four signals above (AI-text = heuristics first)
- Conservative loading + per-scan opt-in for full load
- On-device only, zero cost

**v2 (later)**
- Cross-post / cross-session coordination: accumulate observed profiles locally and
  surface "this cluster keeps reappearing"
- Optional small bundled local model for AI-text
- Optional BYO-API-key power mode

**Explicitly NOT in scope**
- Any server/backend; any paid service; global "is this account a bot everywhere"
  oracle; reading posts the user can't already see.

## Risks (must design around)

1. **User account safety (highest).** Auto-expanding threads = automation on the
   user's logged-in account = Meta anti-automation flags → possible
   checkpoint/ban. Mitigation: conservative default, throttled, explicit per-scan
   opt-in with warning. This is real, hard-to-reverse harm to *our own users.*
2. **DOM fragility.** FB obfuscates markup and ships UI changes constantly. Selectors
   rot every few weeks → permanent maintenance cost. Anchor on stable semantics.
3. **Platform/legal.** Meta is litigious about scraping; web stores can pull
   extensions. Defensible posture = client-side, user-initiated, "only what the user
   already sees." Stay there.
4. **Privacy.** We process third-party comments. On-device only = strongest answer;
   keep it that way.
5. **False positives.** Wrongly tarring real people. Mitigation: cluster-level
   framing, conservative thresholds, always show the "why."

## Open questions (resolve before/early in build)

- Can we read the **reactor list** (who reacted) from the DOM reliably, or only
  aggregate counts? Determines whether reaction-based signals are viable. **Needs a
  live look at the rendered page**, not docs.
- Which browser(s) first? (Chrome has the biggest reach + most scraping-extension
  precedent; Firefox is more permissive on policy.)
- Heuristics-only AI-text for v1, or is the bundled model worth the download from day one?

## Success criteria (v1)

- Installs and runs on a real FB post with **zero setup and zero cost.**
- On an obviously-brigaded/botted post, surfaces the coordinated cluster with a
  reason a normal user understands.
- Does **not** get a careful user's account flagged under default (conservative) mode.
- Low enough false-positive rate that the output feels trustworthy, not alarmist.
