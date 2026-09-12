// Background service worker (Chrome) and background script (Firefox).
// Owns context menus, settings defaults, and ralgrum:// navigation.
// URL parsing and link building come from the shared content detector.
if (typeof RalgrumDetectors === 'undefined' && typeof importScripts === 'function') {
  try {
    importScripts('content/detectors.js');
  } catch (e) {
    // Keep startup nonfatal when the shared detector cannot be loaded.
  }
}

var RALGRUM_DEFAULTS = {
  autoShow: true,
  showOnTrack: true,
  showOnCollection: true,
  showOnArtist: true,
  providers: { deezer: true, soundcloud: true }
};
function detectorApi() {
  return typeof RalgrumDetectors !== 'undefined' ? RalgrumDetectors : null;
}
function openRalgrumUrl(url, tabId, done) {
  var finish = typeof done === 'function' ? done : function () {};
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && tabId != null) {
      chrome.tabs.update(tabId, { url: url }, function () {
        var failed = chrome.runtime && chrome.runtime.lastError;
        finish(!failed);
      });
      return true;
    }
  } catch (e) {
    // fall through
  }
  try {
    if (typeof browser !== 'undefined' && browser.tabs && tabId != null) {
      Promise.resolve(browser.tabs.update(tabId, { url: url })).then(
        function () {
          finish(true);
        },
        function () {
          finish(false);
        }
      );
      return true;
    }
  } catch (e) {
    // fall through
  }
  finish(false);
  return false;
}
var settingsQueue = Promise.resolve();
function withSettingsQueue(operation) {
  var result = settingsQueue.then(operation);
  // A failed operation must not prevent subsequent settings changes.
  settingsQueue = result.then(
    function () {},
    function () {}
  );
  return result;
}
function settingsStorageCall(method, value) {
  return new Promise(function (resolve, reject) {
    var chromeStorage = typeof chrome !== 'undefined' && chrome.storage;
    var store = chromeStorage ? chrome.storage : typeof browser !== 'undefined' ? browser.storage : null;
    if (!store || !store.sync) {
      reject(new Error('Settings storage unavailable'));
      return;
    }
    if (chromeStorage) {
      store.sync[method](value, function (items) {
        var error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message || 'Settings storage failed'));
        } else {
          resolve(items);
        }
      });
    } else {
      resolve(store.sync[method](value));
    }
  });
}
function persistSettings(key, value) {
  return withSettingsQueue(function () {
    return settingsStorageCall('get', null).then(function (items) {
      items = items || {};
      var patch = {};
      Object.keys(RALGRUM_DEFAULTS).forEach(function (name) {
        if (name !== 'providers' && items[name] === undefined) {
          patch[name] = RALGRUM_DEFAULTS[name];
        }
      });
      var providers = items.providers;
      Object.keys(RALGRUM_DEFAULTS.providers).forEach(function (name) {
        if (!providers || providers[name] === undefined) {
          if (!patch.providers) {
            patch.providers = Object.assign({}, providers);
          }
          patch.providers[name] = RALGRUM_DEFAULTS.providers[name];
        }
      });
      if (key === 'deezer' || key === 'soundcloud') {
        if (!patch.providers) {
          patch.providers = Object.assign({}, providers);
        }
        patch.providers[key] = value;
      } else if (key !== undefined) {
        patch[key] = value;
      }
      if (!Object.keys(patch).length) {
        return items;
      }
      return settingsStorageCall('set', patch).then(function () {
        return Object.assign({}, items, patch);
      });
    });
  });
}
function ensureDefaults() {
  // Initialization uses the same queue as user edits and remains nonfatal.
  return persistSettings().catch(function () {});
}
function setSettingMessage(msg) {
  var key = msg.key;
  var validKey =
    key === 'autoShow' ||
    key === 'showOnTrack' ||
    key === 'showOnCollection' ||
    key === 'showOnArtist' ||
    key === 'deezer' ||
    key === 'soundcloud';
  if (!validKey || typeof msg.value !== 'boolean') {
    return Promise.resolve({ ok: false });
  }
  return persistSettings(key, msg.value).then(
    function (settings) {
      return { ok: true, settings: settings };
    },
    function () {
      return { ok: false };
    }
  );
}
function setupMenus() {
  try {
    var chromeMenus = typeof chrome !== 'undefined' && chrome.contextMenus;
    var menus = chromeMenus ? chrome.contextMenus : typeof browser !== 'undefined' ? browser.menus : null;
    if (!menus) {
      return;
    }
    function createMenus() {
      menus.create({
        id: 'ralgrum-page-open',
        title: 'Open in ralgruM',
        contexts: ['page'],
        documentUrlPatterns: [
          'https://www.deezer.com/*',
          'https://*.deezer.com/*',
          'https://soundcloud.com/*',
          'https://*.soundcloud.com/*'
        ]
      });
      menus.create({
        id: 'ralgrum-link-open',
        title: 'Open link in ralgruM',
        contexts: ['link'],
        targetUrlPatterns: [
          'https://www.deezer.com/*',
          'https://*.deezer.com/*',
          'https://soundcloud.com/*',
          'https://*.soundcloud.com/*'
        ]
      });
    }
    if (chromeMenus) {
      menus.removeAll(createMenus);
    } else {
      Promise.resolve(menus.removeAll()).then(createMenus, function () {});
    }
  } catch (e) {
    // menus unavailable
  }
}
function onMenuClicked(info, tab) {
  var raw = info.linkUrl || info.pageUrl;
  var detectors = detectorApi();
  var entity = detectors && detectors.detectFromUrl ? detectors.detectFromUrl(raw) : null;
  if (!entity) {
    return;
  }
  var url = detectors && detectors.buildRalgrumUrl ? detectors.buildRalgrumUrl(entity) : null;
  if (url && tab && tab.id != null) {
    openRalgrumUrl(url, tab.id);
  }
}
function init() {
  ensureDefaults();
  setupMenus();
  try {
    var rt =
      typeof chrome !== 'undefined' && chrome.runtime
        ? chrome.runtime
        : typeof browser !== 'undefined'
          ? browser.runtime
          : null;
    if (rt && rt.onInstalled) {
      rt.onInstalled.addListener(function () {
        ensureDefaults();
        setupMenus();
      });
    }
    if (rt && rt.onMessage) {
      var chromeRuntime = typeof chrome !== 'undefined' && chrome.runtime;
      rt.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg && msg.type === 'RALGRUM_SET_SETTING') {
          var response = setSettingMessage(msg);
          if (chromeRuntime) {
            response.then(function (result) {
              if (sendResponse) {
                sendResponse(result);
              }
            });
            return true;
          }
          return response;
        }
        if (msg && msg.type === 'RALGRUM_OPEN' && msg.url) {
          var tabId = sender && sender.tab ? sender.tab.id : null;
          if (tabId != null) {
            if (chromeRuntime) {
              openRalgrumUrl(String(msg.url), tabId, function (ok) {
                if (sendResponse) {
                  sendResponse({ ok: ok });
                }
              });
              return true;
            }
            return new Promise(function (resolve) {
              openRalgrumUrl(String(msg.url), tabId, function (ok) {
                resolve({ ok: ok });
              });
            });
          }
          if (chromeRuntime && sendResponse) {
            sendResponse({ ok: false });
          }
          return chromeRuntime ? false : Promise.resolve({ ok: false });
        }
        if (chromeRuntime && sendResponse) {
          sendResponse({ ok: false });
        }
        return chromeRuntime ? false : Promise.resolve({ ok: false });
      });
    }
    var menus = typeof chrome !== 'undefined' && chrome.contextMenus ? chrome.contextMenus : null;
    if (menus && menus.onClicked) {
      menus.onClicked.addListener(onMenuClicked);
    } else if (typeof browser !== 'undefined' && browser.menus && browser.menus.onClicked) {
      browser.menus.onClicked.addListener(onMenuClicked);
    }
  } catch (e) {
    // background APIs unavailable in this context
  }
}
init();
