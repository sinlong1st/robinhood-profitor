(() => {
  const ROOT_ID = "rh-profit-helper-root";
  const STORAGE_KEY_INCLUDE_MAP = "includeMap";

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(n);
  }

  function percent(n) {
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(2)}%`;
  }

  function parseMoney(text) {
    if (!text) return NaN;
    const cleaned = text.replace(/,/g, "").match(/-?\$?\d+(\.\d+)?/g);
    if (!cleaned || !cleaned.length) return NaN;
    const raw = cleaned[0].replace("$", "");
    return Number(raw);
  }

  function parseAllMoney(text) {
    if (!text) return [];
    const matches = text.replace(/,/g, "").match(/-?\$?\d+(\.\d+)?/g) || [];
    return matches.map(v => Number(v.replace("$", ""))).filter(Number.isFinite);
  }

  function parseShares(text) {
    if (!text) return NaN;
    const patterns = [
      /([\d,.]+)\s+shares?/i,
      /quantity\s*[:\-]?\s*([\d,.]+)/i,
      /position\s*[:\-]?\s*([\d,.]+)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return Number(m[1].replace(/,/g, ""));
    }
    return NaN;
  }

  function getPageText() {
    return document.body ? document.body.innerText || "" : "";
  }

  function inferPositionDetail() {
    const text = getPageText();
    const shares = parseShares(text);

    let avgCost = NaN;
    let currentPrice = NaN;

    const avgCostMatch =
      text.match(/average cost\s*[:\-]?\s*(\$?[\d,.]+(?:\.\d+)?)/i) ||
      text.match(/avg(?:erage)?\s+cost\s*[:\-]?\s*(\$?[\d,.]+(?:\.\d+)?)/i);

    if (avgCostMatch) {
      avgCost = Number(avgCostMatch[1].replace(/\$/g, "").replace(/,/g, ""));
    }

    const priceCandidates = Array.from(document.querySelectorAll("h1, h2, h3, span, div"))
      .map(el => (el.textContent || "").trim())
      .filter(Boolean)
      .flatMap(parseAllMoney)
      .filter(n => n > 0);

    if (priceCandidates.length) {
      currentPrice = priceCandidates[0];
    }

    if (!Number.isFinite(currentPrice)) {
      const textMonies = parseAllMoney(text).filter(n => n > 0);
      currentPrice = textMonies.length ? textMonies[0] : NaN;
    }

    if (!Number.isFinite(shares) || !Number.isFinite(avgCost) || !Number.isFinite(currentPrice)) {
      return null;
    }

    return { shares, avgCost, currentPrice };
  }

  function rowSignature(row) {
    const txt = (row.innerText || "").replace(/\s+/g, " ").trim().slice(0, 180);
    return `${location.pathname}::${txt}`;
  }

  function looksLikeHoldingRow(el) {
    const txt = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (!txt) return false;

    const moneyCount = parseAllMoney(txt).length;
    const hasTickerish = /\b[A-Z]{1,5}\b/.test(txt);
    const hasPercent = /-?\d+(\.\d+)?%/.test(txt);

    return (hasTickerish && moneyCount >= 1) || (moneyCount >= 2 && hasPercent);
  }

  function findCandidateRows() {
    const candidates = Array.from(document.querySelectorAll("a, div, li, tr"))
      .filter(el => el.offsetParent !== null)
      .filter(looksLikeHoldingRow);

    const seen = new Set();
    return candidates.filter(el => {
      const sig = rowSignature(el);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    }).slice(0, 200);
  }

  async function getSettings() {
    const data = await chrome.storage.local.get({
      taxRatePercent: 0,
      slippagePerTrade: 0,
      includeMap: {}
    });
    return data;
  }

  async function setInclude(signature, included) {
    const data = await chrome.storage.local.get({ includeMap: {} });
    data.includeMap[signature] = included;
    await chrome.storage.local.set({ includeMap: data.includeMap });
  }

  function estimateRowPnl(row) {
    const txt = (row.innerText || "").replace(/\s+/g, " ").trim();

    const moneyValues = parseAllMoney(txt);
    const percentMatch = txt.match(/(-?\d+(?:\.\d+)?)%/);
    const tickerMatch = txt.match(/\b([A-Z]{1,5})\b/);

    let pnl = NaN;

    // Heuristic:
    // If a row has at least 2 monetary values, often one of them is a return/P&L.
    // Prefer the last non-trivial value as the row P&L estimate.
    if (moneyValues.length >= 2) {
      pnl = moneyValues[moneyValues.length - 1];
    }

    return {
      ticker: tickerMatch ? tickerMatch[1] : "—",
      estimatedPnl: pnl,
      estimatedPercent: percentMatch ? Number(percentMatch[1]) : NaN
    };
  }

  function computePositionSummary(position, settings) {
    const grossProceeds = position.shares * position.currentPrice;
    const grossPnl = (position.currentPrice - position.avgCost) * position.shares;

    let estimatedTax = 0;
    if (grossPnl > 0 && settings.taxRatePercent > 0) {
      estimatedTax = grossPnl * (settings.taxRatePercent / 100);
    }

    const adjustedPnl = grossPnl - estimatedTax - (settings.slippagePerTrade || 0);
    const pnlPct = position.avgCost > 0
      ? ((position.currentPrice - position.avgCost) / position.avgCost) * 100
      : NaN;

    return {
      grossProceeds,
      grossPnl,
      estimatedTax,
      adjustedPnl,
      pnlPct
    };
  }

  async function computeListSummary(settings) {
    const rows = findCandidateRows();
    const includeMap = settings.includeMap || {};

    const items = rows.map(row => {
      const sig = rowSignature(row);
      const included = includeMap[sig] !== false;
      const info = estimateRowPnl(row);
      return { row, sig, included, ...info };
    });

    const selected = items.filter(i => i.included);
    const totalPnl = selected.reduce((sum, i) => sum + (Number.isFinite(i.estimatedPnl) ? i.estimatedPnl : 0), 0);

    return {
      itemCount: items.length,
      selectedCount: selected.length,
      totalPnl,
      items
    };
  }

  function removeRoot() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
  }

  function attachCheckboxes(items) {
    items.forEach(item => {
      if (item.row.querySelector(".rhph-mini-checkbox")) return;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.included;
      cb.className = "rhph-mini-checkbox";
      cb.title = "Include/exclude from helper total";

      cb.addEventListener("click", async (e) => {
        e.stopPropagation();
        await setInclude(item.sig, cb.checked);
        render().catch(console.error);
      });

      const firstTextHost = Array.from(item.row.querySelectorAll("span, div, p, td"))
        .find(el => (el.textContent || "").trim());

      if (firstTextHost) {
        firstTextHost.prepend(cb);
      } else {
        item.row.prepend(cb);
      }
    });
  }

  function createRoot(innerHtml) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = innerHtml;
    document.documentElement.appendChild(root);
  }

  async function render() {
    removeRoot();
    const settings = await getSettings();
    const position = inferPositionDetail();

    if (position) {
      const summary = computePositionSummary(position, settings);
      createRoot(`
        <div class="rhph-card">
          <div class="rhph-header">Robinhood Profit Helper</div>
          <div class="rhph-body">
            <div class="rhph-row"><span class="rhph-label">Shares</span><span class="rhph-value">${position.shares}</span></div>
            <div class="rhph-row"><span class="rhph-label">Avg cost</span><span class="rhph-value">${money(position.avgCost)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Current price</span><span class="rhph-value">${money(position.currentPrice)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Gross proceeds</span><span class="rhph-value">${money(summary.grossProceeds)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Gross P/L</span><span class="rhph-value ${summary.grossPnl >= 0 ? "rhph-success" : "rhph-danger"}">${money(summary.grossPnl)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Est. tax</span><span class="rhph-value">${money(summary.estimatedTax)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Adj. P/L if sold now</span><span class="rhph-value ${summary.adjustedPnl >= 0 ? "rhph-success" : "rhph-danger"}">${money(summary.adjustedPnl)}</span></div>
            <div class="rhph-row"><span class="rhph-label">Return %</span><span class="rhph-value">${percent(summary.pnlPct)}</span></div>
            <div class="rhph-badge">MVP mode: current position page</div>
            <div class="rhph-muted" style="margin-top:8px;">If any number looks wrong, tweak the selectors/heuristics in content.js.</div>
          </div>
        </div>
      `);
      return;
    }

    const listSummary = await computeListSummary(settings);
    attachCheckboxes(listSummary.items);

    createRoot(`
      <div class="rhph-card">
        <div class="rhph-header">Robinhood Profit Helper</div>
        <div class="rhph-body">
          <div class="rhph-row"><span class="rhph-label">Detected rows</span><span class="rhph-value">${listSummary.itemCount}</span></div>
          <div class="rhph-row"><span class="rhph-label">Included rows</span><span class="rhph-value">${listSummary.selectedCount}</span></div>
          <div class="rhph-row"><span class="rhph-label">Selected est. total P/L</span><span class="rhph-value ${listSummary.totalPnl >= 0 ? "rhph-success" : "rhph-danger"}">${money(listSummary.totalPnl)}</span></div>
          <div class="rhph-badge">List mode: use the checkboxes next to each row</div>
          <div class="rhph-muted" style="margin-top:8px;">This mode estimates row P/L from visible text on the page, so it is only as accurate as the page labels it can detect.</div>
          <div class="rhph-actions">
            <button class="rhph-btn" id="rhph-refresh-btn">Refresh</button>
          </div>
        </div>
      </div>
    `);

    const btn = document.getElementById("rhph-refresh-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        render().catch(console.error);
      });
    }
  }

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render().catch(console.error), 300);
  }

  const observer = new MutationObserver(() => {
    scheduleRender();
  });

  function init() {
    render().catch(console.error);
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
