import { STORAGE_KEY } from "../shared/constants";

export async function getIncludeMap() {
  const data = await chrome.storage.local.get({ [STORAGE_KEY]: {} });
  return data[STORAGE_KEY] || {};
}

export async function saveIncludeMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}