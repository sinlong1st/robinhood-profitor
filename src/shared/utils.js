export function money(n) {
  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(n);
}

export function parseMoney(text) {
  if (!text) return NaN;

  const match = text.replace(/,/g, "").match(/-?\$?\d+(\.\d+)?/);
  if (!match) return NaN;

  return Number(match[0].replace("$", ""));
}