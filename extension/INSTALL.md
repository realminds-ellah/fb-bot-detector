# Installing & using the browser extension — step by step

This is the full walkthrough for loading the Bot/Troll Detector extension into your
browser and using it on a real Facebook post. No coding required.

> Works in **Chrome, Edge, Brave, and Opera** (all Chromium browsers). The steps
> below say "Chrome" but are identical in the others — just open the matching
> extensions page (`edge://extensions`, `brave://extensions`, etc.).

---

## Part 1 — Get the files onto your computer

You need the project folder on your machine. Pick whichever is easier:

**Option A — Download a ZIP (no tools needed)**
1. Go to the repo: <https://github.com/realminds-ellah/fb-bot-detector>
2. Click the green **`< > Code`** button → **Download ZIP**.
3. Find the downloaded `fb-bot-detector-main.zip` (usually in **Downloads**) and
   **double-click to unzip** it.
4. You now have a folder `fb-bot-detector-main` containing an `extension` folder.
   Remember where it is.

**Option B — Clone with git (if you have git)**
```bash
git clone https://github.com/realminds-ellah/fb-bot-detector.git
```

---

## Part 2 — Load the extension into Chrome (one time)

1. Open Chrome.
2. In the address bar, type **`chrome://extensions`** and press **Enter**.
3. Turn on **Developer mode** — the toggle switch in the **top-right** corner.
   (New buttons appear after you do this.)
4. Click **Load unpacked** (top-left).
5. A file picker opens. Navigate into the project and select the **`extension`**
   folder, then click **Select / Open**.
   - ⚠️ Choose the **`extension`** folder itself — **not** the outer
     `fb-bot-detector` folder, and **not** the `probe` folder.
   - The right folder is the one that directly contains `manifest.json`.
6. You should now see a card titled **"Bot/Troll Detector for Facebook"**. Done.

---

## Part 3 — Use it on Facebook

1. Go to **facebook.com** and open any **post that has comments**.
2. Look at the **bottom-right** of the page — a blue **🔍 Check comments** button.
3. Click it. A panel slides in from the right with:
   - **A summary banner** — "mostly organic" / "some suspicious activity" /
     "strong signs of coordination".
   - **Coordinated clusters** — repeated or templated comments posted by multiple
     accounts (the strongest signal).
   - **AI-looking comments** — comments that read as AI-generated.
   - **Timing bursts** — lots of comments clustered in a short window.
4. Flagged comments also get an **orange outline** in the feed itself.

### Loading more comments
By default it only looks at comments already on screen (this is the safe mode).
To analyze the whole thread, scroll down to load more comments naturally, then
click **🔍 Check comments** again.

The panel also has a **⚠ Load all comments (risky)** button. It auto-clicks
through "view more comments" for you — but that's automation on *your* logged-in
account, and Facebook may flag heavy automation. **Use it sparingly**, and only on
posts where you really need the full picture.

---

## Troubleshooting

| What you see | Fix |
| --- | --- |
| No blue button on Facebook | The page may have loaded before the extension. **Refresh the Facebook tab** (F5 / ⌘R) and look bottom-right again. |
| "0 comments analyzed" | The extension couldn't read the comments from the page layout. Tell the maintainer — the fix lives in `extension/src/extract.js`. |
| Red error text on `chrome://extensions` | Click **Errors** / **Details** on the card and send the message to the maintainer. |
| Button works but nothing happens on click | Make sure you're on an actual **post page** with visible comments (not the home feed). |

---

## Updating to a newer version

When the code changes:
1. Get the latest files (download the ZIP again and replace the folder, or
   `git pull` if you cloned).
2. Go to **`chrome://extensions`**.
3. On the extension's card, click the **🔄 reload** (circular arrow) icon.
4. Refresh your Facebook tab.

---

## Removing it

`chrome://extensions` → find the card → **Remove**. That's it — nothing else is
installed anywhere, and nothing ran on any server.
