# Robinhood Profit Helper (MVP)

This is a starter Chrome extension for Robinhood pages.

## What it does

### 1) Position-detail page
Tries to estimate:
- shares
- average cost
- current price
- gross proceeds
- gross P/L
- adjusted P/L if sold now

### 2) List / portfolio page
Tries to:
- detect visible holding rows
- add a checkbox to each row
- include/exclude rows from a total estimate

## Important note

This is **heuristic-based**.
Robinhood's page structure can change, so you may need to refine selectors and parsing logic inside `content.js`.

## How to load it

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder

## Where to customize next

### Better row detection
Edit:
- `looksLikeHoldingRow`
- `findCandidateRows`
- `estimateRowPnl`

### Better detail-page extraction
Edit:
- `inferPositionDetail`

### Add today's profit mode
You can add:
- today's change * shares
- compare against previous close if present on page

### Add export or notes
Use:
- `chrome.storage.local`
- CSV generation in the content script or popup

## Suggested next steps

1. Lock onto your exact Robinhood DOM by inspecting one page you use most.
2. Replace the broad heuristics with stable selectors.
3. Add a setting for:
   - include/exclude all
   - save profiles
   - show only selected tickers
4. Add a compact table in the floating panel with each checked ticker and its estimated P/L.
