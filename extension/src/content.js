// Orchestrator — wires extract → analyze → ui. Loaded last.
(function () {
  const FBD = window.FBD;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Stepped so each progress message actually paints before the next blocking
  // step runs (the analysis is synchronous, so we yield with setTimeout).
  const scan = () => {
    FBD.ui.renderProgress("Reading the comments on this page…");
    setTimeout(() => {
      const comments = FBD.extract.scanComments();
      FBD.ui.renderProgress(`Analyzing ${comments.length} comments…`);
      setTimeout(() => {
        const result = FBD.analyze.run(comments);
        const coverage = {
          moreAvailable: FBD.extract.findLoadMoreButtons().length > 0,
        };
        FBD.ui.renderResults(result, coverage);
        FBD.ui.annotateFeed(result);
      }, 16);
    }, 16);
  };

  // The account-risk feature. Gated behind explicit confirm, throttled, capped.
  const loadMore = async () => {
    const ok = window.confirm(
      "This will repeatedly click 'view more comments' on your logged-in account. " +
        "Facebook may flag heavy automation, which can affect your account. Continue?"
    );
    if (!ok) return;

    const MAX_CLICKS = 15;
    for (let i = 0; i < MAX_CLICKS; i++) {
      const btn = FBD.extract.findLoadMoreButtons()[0];
      if (!btn) break;
      FBD.ui.renderProgress(`Loading more comments… (round ${i + 1} of up to ${MAX_CLICKS})`);
      btn.click();
      await sleep(1200 + Math.floor(Math.random() * 800)); // human-ish, throttled
    }
    scan();
  };

  FBD.ui.mount({ onScan: scan, onLoadMore: loadMore });
})();
