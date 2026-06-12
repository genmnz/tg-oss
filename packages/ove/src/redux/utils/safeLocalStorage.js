// Safe, lazy access to localStorage so the editor's redux layer can be imported
// and run outside a browser (SSR, node, headless test harnesses) without
// throwing "window is not defined" at module-evaluation time.
//
// When no real storage is available we transparently fall back to an in-memory
// store so reducer behavior stays consistent.

const memory = {};

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (
      typeof global !== "undefined" &&
      global.localStorage
    ) {
      return global.localStorage;
    }
  } catch (e) {
    // Accessing localStorage can throw in sandboxed/privacy contexts.
  }
  return null;
}

export function getStoredValue(key) {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch (e) {
      /* fall through to memory */
    }
  }
  return key in memory ? memory[key] : null;
}

export function setStoredValue(key, value) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch (e) {
      /* fall through to memory */
    }
  }
  memory[key] = value;
}
