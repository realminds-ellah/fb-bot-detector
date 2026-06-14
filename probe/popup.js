// Injects content.js into the active Facebook tab and shows what it found.
// Injecting on demand (rather than a persistent content script) means we always
// scan the current DOM and never need the page reloaded after install.
document.getElementById("scan").addEventListener("click", async () => {
  const out = document.getElementById("out");
  out.textContent = "Scanning…";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!/^https:\/\/([a-z]+\.)?facebook\.com\//.test(tab?.url || "")) {
      out.textContent = "Open a facebook.com post in the active tab first.";
      return;
    }

    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const data = res?.result;
    console.log("[FB Probe] result:", data); // full object in the page-action console
    out.textContent = data
      ? JSON.stringify(data, null, 2)
      : "No result returned.";
  } catch (e) {
    out.textContent =
      "Error: " + e.message + "\nTry reloading the Facebook tab, then re-scan.";
  }
});
