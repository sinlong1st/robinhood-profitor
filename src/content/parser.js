import { parseMoney } from "../shared/utils";

export function getStockRows() {
  return Array.from(document.querySelectorAll('a[href^="/stocks/"]')).filter((row) => {
    const href = row.getAttribute("href") || "";
    const text = row.innerText || "";

    return /^\/stocks\/[A-Z.\-]+$/i.test(href) && text.includes("$");
  });
}

export function rowKey(row) {
  return row.getAttribute("href") || "";
}

export function getColumnIndexMap() {
  const header = Array.from(document.querySelectorAll("header")).find((el) => {
    const text = el.innerText || "";
    return (
      text.includes("Name") &&
      text.includes("Symbol") &&
      text.includes("Shares") &&
      text.includes("Price") &&
      text.includes("Average cost") &&
      text.includes("Total return") &&
      text.includes("Equity")
    );
  });

  if (!header) {
    console.log("RH helper: header not found");
    return null;
  }

  const cellNodes = Array.from(header.children).filter(
    (el) => (el.innerText || "").trim().length > 0
  );

  const labels = cellNodes.map((el) => {
    const text = (el.innerText || "")
      .replace(/\s+/g, " ")
      .trim();
    return text;
  });

  const indexMap = {
    Name: labels.findIndex((t) => t === "Name"),
    Symbol: labels.findIndex((t) => t === "Symbol"),
    Shares: labels.findIndex((t) => t === "Shares"),
    Price: labels.findIndex((t) => t === "Price"),
    "Average cost": labels.findIndex((t) => t === "Average cost"),
    "Total return": labels.findIndex((t) => t === "Total return"),
    Equity: labels.findIndex((t) => t === "Equity")
  };

  console.log("RH helper header labels:", labels);
  console.log("RH helper column map:", indexMap);

  return indexMap;
}

export function getRowData(row, columnMap) {
  const href = row.getAttribute("href") || "";
  const ticker = href.split("/stocks/")[1] || "UNKNOWN";

  const rowContainer = row.querySelector(".SOx4C3KwX4BlWxltBd5l-A--");
  if (!rowContainer) {
    console.log("RH helper: row container not found for", ticker);
    return { ticker, totalReturn: NaN };
  }

  const cells = Array.from(rowContainer.children).filter(
    (el) => (el.innerText || "").trim().length > 0
  );

  const totalReturnIndex = columnMap?.["Total return"];
  let totalReturn = NaN;

  if (
    Number.isInteger(totalReturnIndex) &&
    totalReturnIndex >= 0 &&
    cells[totalReturnIndex]
  ) {
    const rawText = (cells[totalReturnIndex].innerText || "").trim();
    totalReturn = parseMoney(rawText);

    console.log("RH helper row:", {
      ticker,
      totalReturnIndex,
      rawText,
      parsed: totalReturn
    });
  } else {
    console.log("RH helper: total return cell missing", {
      ticker,
      totalReturnIndex,
      cellCount: cells.length
    });
  }

  const isDown = row.innerHTML.includes("1pvztri");
  if (isDown && Number.isFinite(totalReturn)) {
    totalReturn = -Math.abs(totalReturn);
  }

  return { ticker, totalReturn };
}