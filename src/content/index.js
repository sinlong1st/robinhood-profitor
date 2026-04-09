import { ROOT_ID } from "../shared/constants";
import { attachCheckboxes, updateSummary } from "./ui";

if (location.pathname.startsWith("/account/investing")) {
  async function refreshView() {
    await attachCheckboxes(refreshView);
    await updateSummary(refreshView);
  }

  let refreshTimer = null;

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshView().catch(console.error);
    }, 400);
  };

  const observer = new MutationObserver((mutations) => {
    const hasExternalChange = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) => {
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
    await refreshView();

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
}