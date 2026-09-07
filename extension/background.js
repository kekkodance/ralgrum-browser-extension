// Background service worker (Chrome) and background script (Firefox).
// Owns context menus, settings defaults, and ralgrum:// navigation.
// Self contained: duplicates the tiny URL parsers so it never imports files.
var RALGRUM_DEFAULTS = {
  autoShow: true,
  showOnTrack: true,
  showOnCollection: true,
  showOnArtist: true,
  providers: { deezer: true, soundcloud: true }
};
function parseDeezer(url) {
  try {
    var m = String(url || '').match(/deezer\.com(?:\.[a-z]{2})?\/[a-z-]*\/?(track|album|playlist|artist)\/(\d+)/i);
    if (!m) {
      return null;
    }
    if (!m[1] || !m[2] || m[2] === '0') {
      return null;
    }
    return { provider: 'deezer', type: m[1].toLowerCase(), id: m[2], url: String(url) };
  } catch (e) {
    return null;
  }
}
function parseSoundcloud(url) {
  try {
    var u = new URL(String(url));
    if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) {
      return null;
    }
    var segs = u.pathname.split('/').filter(Boolean);
    if (segs.length === 0) {
      return null;
    }
    var reserved = ['you', 'discover', 'stream', 'search', 'upload', 'settings', 'charts', 'stations'];
    if (reserved.indexOf(segs[0].toLowerCase()) !== -1) {
      return null;
    }
    if (segs.length === 1) {
      return { provider: 'soundcloud', type: 'artist', id: null, url: String(url) };
    }
    if (segs.map(function (s) { return s.toLowerCase(); }).indexOf('sets') !== -1) {
      return { provider: 'soundcloud', type: 'playlist', id: null, url: String(url) };
    }
    return { provider: 'soundcloud', type: 'track', id: null, url: String(url) };
  } catch (e) {
    return null;
  }
}
function detect(url) {
  return parseDeezer(url) || parseSoundcloud(url);
}
function buildRalgrumUrl(entity, action) {
  if (!entity) {
    return null;
  }
  var act = action || (entity.type === 'track' ? 'play' : 'open');
  var p = new URLSearchParams();
  p.set('provider', entity.provider);
  p.set('type', entity.type);
  if (entity.id) {
    p.set('id', entity.id);
  }
  p.set('action', act);
  p.set('url', entity.url);
  return 'ralgrum://open?' + p.toString();
}
function openRalgrumUrl(url, tabId) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && tabId != null) {
      chrome.tabs.update(tabId, { url: url });
      return;
    }
  } catch (e) {
    // fall through
  }
  try {
    if (typeof browser !== 'undefined' && browser.tabs && tabId != null) {
      browser.tabs.update(tabId, { url: url });
      return;
    }
  } catch (e) {
    // fall through
  }
}
function ensureDefaults() {
  try {
    var store = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
    if (!store || !store.sync) {
      return;
    }
    store.sync.get(null, function (items) {
      var patch = {};
      var needed = false;
      Object.keys(RALGRUM_DEFAULTS).forEach(function (k) {
        if (items == null || items[k] === undefined) {
          patch[k] = RALGRUM_DEFAULTS[k];
          needed = true;
        }
      });
      if (needed) {
        store.sync.set(patch);
      }
    });
  } catch (e) {
    // storage unavailable, content scripts fall back to defaults
  }
}
function setupMenus() {
  try {
    var menus = (typeof chrome !== 'undefined' && chrome.contextMenus) ? chrome.contextMenus : (typeof browser !== 'undefined' ? browser.menus : null);
    if (!menus) {
      return;
    }
    menus.removeAll(function () {
      menus.create({ id: 'ralgrum-page-open', title: 'Open in ralgruM', contexts: ['page'], documentUrlPatterns: ['https://www.deezer.com/*', 'https://*.deezer.com/*', 'https://soundcloud.com/*', 'https://*.soundcloud.com/*'] });
      menus.create({ id: 'ralgrum-link-open', title: 'Open link in ralgruM', contexts: ['link'], targetUrlPatterns: ['https://www.deezer.com/*', 'https://*.deezer.com/*', 'https://soundcloud.com/*', 'https://*.soundcloud.com/*'] });
    });
  } catch (e) {
    // menus unavailable
  }
}
function onMenuClicked(info, tab) {
  var raw = info.linkUrl || info.pageUrl;
  var entity = detect(raw);
  if (!entity) {
    return;
  }
  var url = buildRalgrumUrl(entity);
  if (url && tab && tab.id != null) {
    openRalgrumUrl(url, tab.id);
  }
}
function init() {
  ensureDefaults();
  setupMenus();
  try {
    var rt = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime : (typeof browser !== 'undefined' ? browser.runtime : null);
    if (rt && rt.onInstalled) {
      rt.onInstalled.addListener(function () {
        ensureDefaults();
        setupMenus();
      });
    }
    if (rt && rt.onMessage) {
      rt.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg && msg.type === 'RALGRUM_OPEN' && msg.url) {
          var tabId = sender && sender.tab ? sender.tab.id : null;
          if (tabId != null) {
            openRalgrumUrl(String(msg.url), tabId);
          }
        }
        if (sendResponse) {
          sendResponse({ ok: true });
        }
        return false;
      });
    }
    var menus = (typeof chrome !== 'undefined' && chrome.contextMenus) ? chrome.contextMenus : null;
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
