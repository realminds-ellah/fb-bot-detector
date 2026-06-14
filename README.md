# fb-bot-detector

A browser extension that flags likely bot / troll / AI-generated activity in the
comments and reactions of a Facebook post — analyzed entirely on-device, at zero
cost to the user. See [`SPEC.md`](./SPEC.md) for the full product spec.

> **Status:** Phase 0 — reconnaissance probe. The real extension is not built yet.

## Why an extension (not an API)

There is no Facebook API that returns comments/reactions on arbitrary posts. The
only way to let *any* user scan *any* post is to read what's already rendered in
their own browser. Details and tradeoffs are in `SPEC.md`.

## Phase 0 — the probe

`probe/` is a throwaway dev tool. Its only job is to report **what data is actually
extractable from a live Facebook post's DOM**, so we design the real extension
against reality. It is read-only — it never clicks, scrolls, or expands anything.

### Run it

1. Go to `chrome://extensions`, enable **Developer mode** (top right).
2. **Load unpacked** → select the `probe/` folder.
3. Open any Facebook post in a tab.
4. Click the extension icon → **Scan this page**.
5. Read the `capabilities` block in the output (and the full object in the popup's
   DevTools console).

### The key question it answers

`capabilities.reactorListReadable` tells us whether individual reactor identities
are obtainable. To test it: on the post, **click the reaction count to open the
reactions dialog**, then Scan again. If reactor profiles show up, reaction-based
signals are viable; if not, comment signals carry v1.

## Phase 1 (later)

A real `extension/` built on the probe's extraction core: duplication + burst +
AI-text heuristics, cluster-level output, conservative comment loading. Tracked in
`SPEC.md`.
