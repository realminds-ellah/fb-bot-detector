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

## Phase 1 — the extension

`extension/` is the real tool. 100% on-device, no backend, no cost.

- `src/extract.js` — the only file that touches FB's DOM (the patch point)
- `src/analyze.js` — pure analysis: duplication clusters, AI-text heuristics, burst timing, profile flags
- `src/ui.js` — injected launcher + results panel; highlights flagged comments in-page
- `src/content.js` — orchestrator
- `styles/panel.css`

### Run it

**📖 Full beginner-friendly walkthrough: [`extension/INSTALL.md`](./extension/INSTALL.md)**

Quick version:
1. `chrome://extensions` → **Developer mode** on.
2. **Load unpacked** → select the `extension/` folder (the one with `manifest.json`).
3. Open a Facebook post → click the **🔍 Check comments** button (bottom-right).

By default it analyzes only comments already loaded on the page (safe). The panel's
**"Load all comments (risky)"** button auto-clicks through the thread on your
logged-in account — Meta may flag heavy automation, so it's gated behind a confirm.

### Test the logic without a browser

`node` can exercise the pure analysis layer (see commit history / `analyze.js`).

### Known limitation

Extraction selectors are best-effort against FB's obfuscated DOM and will need
updating when FB ships UI changes. If a field comes back empty on a real post,
`src/extract.js` is the one place to fix.
