(() => {
  const ROOT_ID = "rh-profit-helper-root";
  const STORAGE_KEY = "includeMap";

  if (!location.pathname.startsWith("/account/investing")) return;

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(n);
  }

  function parseMoney(text) {
    if (!text) return NaN;
    const match = text.replace(/,/g, "").match(/-?\$?\d+(\.\d+)?/);
    if (!match) return NaN;
    return Number(match[0].replace("$", ""));
  }

  function getRoot() {
    return document.getElementById(ROOT_ID);
  }

  function ensureRoot() {
    let root = getRoot();

    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.innerHTML = `
        <div class="rhph-card">
          <div class="rhph-header">Robinhood Profit Helper</div>
          <div class="rhph-body">
            <div class="rhph-row">
              <span class="rhph-label">Detected stocks</span>
              <span class="rhph-value" id="rhph-detected">0</span>
            </div>
            <div class="rhph-row">
              <span class="rhph-label">Included stocks</span>
              <span class="rhph-value" id="rhph-included">0</span>
            </div>
            <div class="rhph-row">
              <span class="rhph-label">Selected total return</span>
              <span class="rhph-value" id="rhph-total">—</span>
            </div>
            <div class="rhph-actions">
              <button class="rhph-btn" id="rhph-select-all" type="button">Select all</button>
              <button class="rhph-btn" id="rhph-clear-all" type="button">Clear all</button>
              <button class="rhph-btn" id="rhph-refresh" type="button">Refresh</button>
            </div>
          </div>
        </div>
      `;

      document.documentElement.appendChild(root);

      root.querySelector("#rhph-select-all").addEventListener("click", () => {
        bulkSet(true).catch(console.error);
      });

      root.querySelector("#rhph-clear-all").addEventListener("click", () => {
        bulkSet(false).catch(console.error);
      });

      root.querySelector("#rhph-refresh").addEventListener("click", () => {
        refresh().catch(console.error);
      });
    }

    return root;
  }

  function getStockRows() {
    return Array.from(document.querySelectorAll('a[href^="/stocks/"]')).filter((row) => {
      const href = row.getAttribute("href") || "";
      const text = row.innerText || "";

      return /^\/stocks\/[A-Z.\-]+$/i.test(href) && text.includes("$");
    });
  }

  function rowKey(row) {
    return row.getAttribute("href") || "";
  }

  function getRowData(row) {
    const href = row.getAttribute("href") || "";
    const ticker = href.split("/stocks/")[1] || "UNKNOWN";

    const textNodes = Array.from(row.querySelectorAll("span"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);

    const moneyValues = textNodes
      .map(parseMoney)
      .filter(Number.isFinite);

    // Expected order from the stock table:
    // Price, Average cost, Total return, Equity
    let totalReturn = NaN;
    if (moneyValues.length >= 4) {
      totalReturn = moneyValues[2];
    }

    // Negative rows show a down arrow in the HTML.
    const isDown = row.innerHTML.includes("1pvztri");
    if (isDown && Number.isFinite(totalReturn)) {
      totalReturn = -Math.abs(totalReturn);
    }

    return { ticker, totalReturn };
  }

  async function getIncludeMap() {
    const data = await chrome.storage.local.get({ [STORAGE_KEY]: {} });
    return data[STORAGE_KEY] || {};
  }

  async function saveIncludeMap(map) {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  }

  async function attachCheckboxes() {
    const rows = getStockRows();
    const includeMap = await getIncludeMap();

    for (const row of rows) {
      if (row.querySelector(".rhph-checkbox-wrap")) continue;

      const key = rowKey(row);

      const wrap = document.createElement("div");
      wrap.className = "rhph-checkbox-wrap";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "rhph-mini-checkbox";
      cb.checked = includeMap[key] !== false;
      cb.title = "Include/exclude from helper total";

      // Stop the parent stock link from hijacking the interaction.
      // Do not call preventDefault on the checkbox click itself,
      // otherwise the checkbox may not toggle.
      wrap.addEventListener(
        "pointerdown",
        (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        },
        true
      );

      wrap.addEventListener(
        "mousedown",
        (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        },
        true
      );

      wrap.addEventListener(
        "mouseup",
        (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        },
        true
      );

      wrap.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        },
        true
      );

      cb.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        },
        true
      );

      cb.addEventListener("change", async (e) => {
        e.stopPropagation();

        const map = await getIncludeMap();
        map[key] = cb.checked;
        await saveIncludeMap(map);
        await updateSummary();
      });

      wrap.appendChild(cb);

      row.style.position = "relative";
      row.prepend(wrap);
    }
  }

  async function updateSummary() {
    ensureRoot();

    const rows = getStockRows();
    const includeMap = await getIncludeMap();

    let detected = 0;
    let included = 0;
    let total = 0;

    for (const row of rows) {
      detected += 1;

      const key = rowKey(row);
      const isIncluded = includeMap[key] !== false;

      const cb = row.querySelector(".rhph-mini-checkbox");
      if (cb) {
        cb.checked = isIncluded;
      }

      if (isIncluded) {
        included += 1;

        const data = getRowData(row);
        if (Number.isFinite(data.totalReturn)) {
          total += data.totalReturn;
        }
      }
    }

    const detectedEl = document.getElementById("rhph-detected");
    const includedEl = document.getElementById("rhph-included");
    const totalEl = document.getElementById("rhph-total");

    if (detectedEl) detectedEl.textContent = String(detected);
    if (includedEl) includedEl.textContent = String(included);

    if (totalEl) {
      totalEl.textContent = money(total);
      totalEl.classList.remove("rhph-success", "rhph-danger");
      totalEl.classList.add(total >= 0 ? "rhph-success" : "rhph-danger");
    }
  }

  async function bulkSet(value) {
    const rows = getStockRows();
    const map = await getIncludeMap();

    for (const row of rows) {
      map[rowKey(row)] = value;

      const cb = row.querySelector(".rhph-mini-checkbox");
      if (cb) {
        cb.checked = value;
      }
    }

    await saveIncludeMap(map);
    await updateSummary();
  }

  async function refresh() {
    await attachCheckboxes();
    await updateSummary();
  }

  let refreshTimer = null;

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refresh().catch(console.error);
    }, 400);
  }

  const observer = new MutationObserver((mutations) => {
    const hasExternalChange = mutations.some((m) =>
      [...m.addedNodes].some((node) => {
        return (
          node.nodeType === 1 &&
          !node.closest?.(`#${ROOT_ID}`) &&
          !(node.id === ROOT_ID) &&
          !(node.classList?.contains("rhph-checkbox-wrap")) &&
          !(node.classList?.contains("rhph-mini-checkbox"))
        );
      })
    );

    if (hasExternalChange) {
      scheduleRefresh();
    }
  });

  async function init() {
    await refresh();

    observer.observe(document.body, {
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