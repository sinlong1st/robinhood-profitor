import { ROOT_ID } from "../shared/constants";
import { money } from "../shared/utils";
import { getIncludeMap, saveIncludeMap } from "./storage";
import { getStockRows, rowKey, getColumnIndexMap, getRowData } from "./parser";

export function getRoot() {
  return document.getElementById(ROOT_ID);
}

export function ensureRoot(refreshHandler) {
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
      bulkSet(true, refreshHandler).catch(console.error);
    });

    root.querySelector("#rhph-clear-all").addEventListener("click", () => {
      bulkSet(false, refreshHandler).catch(console.error);
    });

    root.querySelector("#rhph-refresh").addEventListener("click", () => {
      refreshHandler().catch(console.error);
    });
  }

  return root;
}

export async function attachCheckboxes(refreshHandler) {
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
      await updateSummary(refreshHandler);
    });

    wrap.appendChild(cb);

    row.style.position = "relative";
    row.prepend(wrap);
  }
}

export async function updateSummary(refreshHandler) {
  ensureRoot(refreshHandler);

  const rows = getStockRows();
  const includeMap = await getIncludeMap();
  const columnMap = getColumnIndexMap();

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

      const data = getRowData(row, columnMap);
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
    totalEl.textContent = Number.isFinite(total) ? money(total) : "—";
    totalEl.classList.remove("rhph-success", "rhph-danger");
    totalEl.classList.add(total >= 0 ? "rhph-success" : "rhph-danger");
  }
}

export async function bulkSet(value, refreshHandler) {
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
  await updateSummary(refreshHandler);
}