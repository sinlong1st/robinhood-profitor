const taxRateEl = document.getElementById("taxRate");
const slippageEl = document.getElementById("slippage");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");

async function load() {
  const data = await chrome.storage.local.get({
    taxRatePercent: 0,
    slippagePerTrade: 0
  });

  taxRateEl.value = data.taxRatePercent || "";
  slippageEl.value = data.slippagePerTrade || "";
}

saveBtn.addEventListener("click", async () => {
  const taxRatePercent = Number(taxRateEl.value || 0);
  const slippagePerTrade = Number(slippageEl.value || 0);

  await chrome.storage.local.set({
    taxRatePercent,
    slippagePerTrade
  });

  statusEl.textContent = "Saved.";

  setTimeout(() => {
    statusEl.textContent = "";
  }, 1200);
});

load();