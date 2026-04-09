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
    const cleaned = text.replace(/,/g, "").match(/-?\$?\d+(\.\d+)?/);
    if (!cleaned) return NaN;
    return Number(cleaned[0].replace("$", ""));
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
              <button class="rhph-btn" id="rhph-select-all">Select all</button>
              <button class="rhph-btn" id="rhph-clear-all">Clear all</button>
              <button class="rhph-btn" id="rhph-refresh">Refresh</button>
            </div>
          </div>
        </div>
      `;
      document.documentElement.appendChild(root);

      root.querySelector("#rhph-select-all").addEventListener("click", () => bulkSet(true));
      root.querySelector("#rhph-clear-all").addEventListener("click", () => bulkSet(false));
      root.querySelector("#rhph-refresh").addEventListener("click", refresh);
    }
    return root;
  }

  function getStockRows() {
    return Array.from(document.querySelectorAll('a[href^="/stocks/"]'))
      .filter(a => {
        const text = a.innerText || "";
        return (
          text.includes("$") &&
          text.trim().length > 0 &&
          a.querySelector('span[class*="gic1rUwO9ldk9zzcggr7uA"]') || // symbol cell if present
          /\/stocks\/[A-Z.]+$/i.test(a.getAttribute("href") || "")
        );
      });
  }

  function getRowData(row) {
    const href = row.getAttribute("href") || "";
    const ticker = href.split("/stocks/")[1] || "UNKNOWN";

    // Dựa theo HTML ông gửi:
    // cells đang ra thứ tự: Name, Symbol, Shares, Price, Average cost, Total return, Equity
    const textNodes = Array.from(row.querySelectorAll("span"))
      .map(el => (el.textContent || "").trim())
      .filter(Boolean);

    const moneyValues = textNodes
      .map(parseMoney)
      .filter(Number.isFinite);

    // Thường stock row có 4 số tiền: Price, Avg cost, Total return, Equity
    // Lấy money thứ 3 làm Total return
    let totalReturn = NaN;
    if (moneyValues.length >= 4) {
      totalReturn = moneyValues[2];
    }

    // detect negative by down-arrow icon
    const isDown = row.innerHTML.includes("1pvztri");
    if (isDown && Number.isFinite(totalReturn)) {
      totalReturn = -Math.abs(totalReturn);
    }

    return {
      ticker,
      totalReturn
    };
  }

  async function getIncludeMap() {
    const data = await chrome.storage.local.get({ [STORAGE_KEY]: {} });
    return data[STORAGE_KEY] || {};
  }

  async function saveIncludeMap(map) {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  }

  function rowKey(row) {
    return row.getAttribute("href") || row.innerText.trim();
  }

  async function attachCheckboxes() {
    const rows = getStockRows();
    const includeMap = await getIncludeMap();

    for (const row of rows) {
      if (row.querySelector(".rhph-mini-checkbox")) continue;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "rhph-mini-checkbox";

      const key = rowKey(row);
      cb.checked = includeMap[key] !== false;

      cb.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const map = await getIncludeMap();
        map[key] = cb.checked;
        await saveIncludeMap(map);
        updateSummary();
      });

      row.style.position = "relative";
      cb.style.marginRight = "8px";

      const firstCell = row.querySelector("div, span");
      if (firstCell) {
        firstCell.prepend(cb);
      } else {
        row.prepend(cb);
      }
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

      if (isIncluded) {
        included += 1;
        const data = getRowData(row);
        if (Number.isFinite(data.totalReturn)) {
          total += data.totalReturn;
        }
      }
    }

    document.getElementById("rhph-detected").textContent = String(detected);
    document.getElementById("rhph-included").textContent = String(included);

    const totalEl = document.getElementById("rhph-total");
    totalEl.textContent = money(total);
    totalEl.classList.remove("rhph-success", "rhph-danger");
    totalEl.classList.add(total >= 0 ? "rhph-success" : "rhph-danger");
  }

  async function bulkSet(value) {
    const rows = getStockRows();
    const map = await getIncludeMap();

    for (const row of rows) {
      map[rowKey(row)] = value;
      const cb = row.querySelector(".rhph-mini-checkbox");
      if (cb) cb.checked = value;
    }

    await saveIncludeMap(map);
    updateSummary();
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
    }, 500);
  }

  const observer = new MutationObserver((mutations) => {
    // bỏ qua mutation do chính extension tạo ra
    const hasExternalChange = mutations.some(m => {
      return [...m.addedNodes].some(node => {
        return (
          node.nodeType === 1 &&
          !node.closest?.(`#${ROOT_ID}`) &&
          !(node.id === ROOT_ID) &&
          !(node.classList?.contains("rhph-mini-checkbox"))
        );
      });
    });

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