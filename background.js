// pinnedMap: { [tabId: string]: fixedUrl } - runtime map for quick lookups
// persistedEntries: [{ lastUrl, fixedUrl }] - persisted in chrome.storage.local
// On browser restart, tab IDs change. persistedEntries allows restoring
// fixed URLs by matching each pinned tab's current URL to a lastUrl entry.

// --- Runtime pinnedMap (session-scoped, fast access) ---

async function getPinnedMap() {
  const { pinnedMap = {} } = await chrome.storage.session.get('pinnedMap');
  return pinnedMap;
}

async function setPinnedMap(map) {
  await chrome.storage.session.set({ pinnedMap: map });
}

// --- Persisted entries (survives browser restart via local storage) ---

async function getPersistedEntries() {
  const { persistedEntries = [] } = await chrome.storage.local.get('persistedEntries');
  return persistedEntries;
}

async function setPersistedEntries(entries) {
  await chrome.storage.local.set({ persistedEntries: entries });
}

async function syncPersistedEntries(pinnedMap) {
  const tabIds = Object.keys(pinnedMap);
  if (tabIds.length === 0) {
    await setPersistedEntries([]);
    return;
  }
  const tabs = await chrome.tabs.query({ pinned: true });
  const tabUrlById = {};
  for (const tab of tabs) {
    tabUrlById[String(tab.id)] = tab.url;
  }
  const entries = tabIds.map((id) => ({
    lastUrl: tabUrlById[id] || pinnedMap[id],
    fixedUrl: pinnedMap[id],
  }));
  await setPersistedEntries(entries);
}

// --- Helpers ---

function isLockableUrl(url) {
  return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('about:');
}

// --- Startup: restore fixed URLs from persisted entries ---

async function init() {
  const tabs = await chrome.tabs.query({ pinned: true });
  const entries = await getPersistedEntries();

  const map = {};

  if (entries.length > 0) {
    const remaining = [...entries];

    for (const tab of tabs) {
      if (!isLockableUrl(tab.url)) continue;
      const idx = remaining.findIndex((e) => e.lastUrl === tab.url);
      if (idx !== -1) {
        map[String(tab.id)] = remaining[idx].fixedUrl;
        remaining.splice(idx, 1);
      } else {
        map[String(tab.id)] = tab.url;
      }
    }
  } else {
    for (const tab of tabs) {
      if (isLockableUrl(tab.url)) {
        map[String(tab.id)] = tab.url;
      }
    }
  }

  await setPinnedMap(map);
  await syncPersistedEntries(map);
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// --- Tab pinned / unpinned / URL changed ---

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.pinned === true) {
    const url = tab.url || changeInfo.url;
    if (!isLockableUrl(url)) return;
    const map = await getPinnedMap();
    map[String(tabId)] = url;
    await setPinnedMap(map);
    await syncPersistedEntries(map);
    return;
  }

  if (changeInfo.pinned === false) {
    const map = await getPinnedMap();
    delete map[String(tabId)];
    await setPinnedMap(map);
    await syncPersistedEntries(map);
    return;
  }

  if (changeInfo.url && tab.pinned) {
    const map = await getPinnedMap();
    if (map[String(tabId)]) {
      await syncPersistedEntries(map);
    }
  }
});

// --- Clean up when a tab is closed ---

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getPinnedMap();
  if (map[String(tabId)]) {
    delete map[String(tabId)];
    await setPinnedMap(map);
    await syncPersistedEntries(map);
  }
});

// --- Detect reloads on pinned tabs and redirect to the fixed URL ---

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (details.transitionType !== 'reload') return;

  const map = await getPinnedMap();
  const fixedUrl = map[String(details.tabId)];
  if (!fixedUrl) return;

  if (details.url !== fixedUrl) {
    chrome.tabs.update(details.tabId, { url: fixedUrl });
  }
});

// --- Message handler for popup interactions ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PINNED_MAP') {
    getPinnedMap().then(sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_FIXED_URL') {
    getPinnedMap().then(async (map) => {
      map[String(message.tabId)] = message.url;
      await setPinnedMap(map);
      await syncPersistedEntries(map);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'REMOVE_FIXED_URL') {
    getPinnedMap().then(async (map) => {
      delete map[String(message.tabId)];
      await setPinnedMap(map);
      await syncPersistedEntries(map);
      sendResponse({ ok: true });
    });
    return true;
  }
});
