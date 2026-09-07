// RalgrumToast mirrors src/ui/toast.rs value for value.
// Card: min 280 max 380, pad 12 vertical 16 horizontal, radius 12,
// 1px BORDER, flat bg 121214f5, row gap 12, no shadow (theme.shadow=false).
// Glyph 16 in kind color, title 13.5 semibold white, desc 12 muted,
// actions h30 secondary buttons, close 28 with 12 glyph, entry 180ms
// fade plus 8px rise. Action-less toasts auto dismiss in 6s with hover
// pause; toasts with actions stay until dismissed, like the app.
(function (root) {
  'use strict';
  var BORDER = '#27272a';
  var FOREGROUND = '#fafafa';
  var TITLE = '#ffffff';
  var MUTED = '#a1a1aa';
  var PRIMARY = '#6366f1';
  var CARD_BG = '#121214f5';
  var PANEL_BG = '#121215';
  var ROW_HOVER = '#18181b';
  var DEEZER = '#a238ff';
  var SOUNDCLOUD = '#ff5500';
  var FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
  var LIFETIME = 6000;
  var TICK = 250;
  var SHOWN_KEYS = {};
  function accentFor(provider) {
    if (provider === 'deezer') {
      return DEEZER;
    }
    if (provider === 'soundcloud') {
      return SOUNDCLOUD;
    }
    return PRIMARY;
  }
  function providerName(provider) {
    if (provider === 'deezer') {
      return 'Deezer';
    }
    if (provider === 'soundcloud') {
      return 'SoundCloud';
    }
    return 'ralgruM';
  }
  function typeName(type) {
    if (type === 'album') {
      return 'Album';
    }
    if (type === 'playlist') {
      return 'Playlist';
    }
    if (type === 'artist') {
      return 'Artist';
    }
    return 'Track';
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function noteSvg(color) {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
      + '<circle cx="5" cy="12" r="2.6" fill="' + color + '"/>'
      + '<circle cx="11.5" cy="10.5" r="2.6" fill="' + color + '"/>'
      + '<rect x="7" y="1.5" width="1.6" height="9" fill="' + color + '"/>'
      + '<rect x="13.5" y="1.5" width="1.6" height="7" fill="' + color + '"/>'
      + '<rect x="7" y="1.5" width="8.1" height="1.6" fill="' + color + '"/>'
      + '</svg>';
  }
  function xSvg() {
    return '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">'
      + '<rect x="2" y="5.2" width="8" height="1.6" rx="0.8" fill="' + MUTED + '" transform="rotate(45 6 6)"/>'
      + '<rect x="2" y="5.2" width="8" height="1.6" rx="0.8" fill="' + MUTED + '" transform="rotate(-45 6 6)"/>'
      + '</svg>';
  }
  function ensureHost() {
    var host = document.querySelector('.ralgrum-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'ralgrum-toast-host';
      document.documentElement.appendChild(host);
    }
    return host;
  }
  function clearHost() {
    var host = document.querySelector('.ralgrum-toast-host');
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
  function ralgrumUrlFor(entity, action) {
    if (root.RalgrumDetectors && root.RalgrumDetectors.buildRalgrumUrl) {
      return root.RalgrumDetectors.buildRalgrumUrl(entity, { action: action });
    }
    return null;
  }
  function sendToApp(url) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'RALGRUM_OPEN', url: url }, function () {
          void chrome.runtime.lastError;
        });
        return;
      }
    } catch (e) {
      // fall through to direct navigation
    }
    window.location.href = url;
  }
  function copyText(value, done) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done(true);
      } catch (e) {
        done(false);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        done(true);
      }, fallback);
    } else {
      fallback();
    }
  }
  function styleText() {
    return ''
      + '.rg-stack{width:360px;max-width:calc(100vw - 32px);font-family:' + FONT + ';}'
      + '.rg-card{min-width:280px;max-width:380px;display:flex;align-items:center;gap:12px;'
      + 'padding:12px 16px;border-radius:12px;border:1px solid ' + BORDER + ';background:' + CARD_BG + ';'
      + 'animation:rg-in 180ms ease-out;}'
      + '@keyframes rg-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
      + '.rg-glyph{flex:none;display:flex;}'
      + '.rg-main{flex:1;min-width:0;}'
      + '.rg-title{margin:0;font-size:13.5px;font-weight:600;color:' + TITLE + ';'
      + 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}'
      + '.rg-desc{margin:2px 0 0;font-size:12px;color:' + MUTED + ';'
      + 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}'
      + '.rg-actions{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;}'
      + '.rg-btn{height:30px;padding:0 12px;border-radius:6px;border:1px solid ' + BORDER + ';'
      + 'background:transparent;color:' + FOREGROUND + ';font-family:' + FONT + ';font-size:13px;font-weight:500;'
      + 'white-space:nowrap;cursor:pointer;}'
      + '.rg-btn:hover{background:' + BORDER + ';}'
      + '.rg-btn:focus-visible{outline:none;border-color:' + PRIMARY + ';}'
      + '.rg-close{flex:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;'
      + 'border-radius:6px;border:none;background:transparent;cursor:pointer;}'
      + '.rg-close:hover{background:' + BORDER + ';}'
      + '.rg-close:focus-visible{outline:none;border:1px solid ' + PRIMARY + ';}'
      + '.rg-panel{min-width:280px;max-width:380px;border-radius:12px;border:1px solid ' + BORDER + ';'
      + 'background:' + PANEL_BG + ';padding:12px 12px 8px;animation:rg-in 180ms ease-out;}'
      + '.rg-panel-head{display:flex;align-items:center;gap:8px;padding:0 4px 8px;}'
      + '.rg-panel-title{margin:0;flex:1;font-size:13.5px;font-weight:600;color:' + TITLE + ';}'
      + '.rg-row{display:flex;align-items:center;gap:10px;padding:6px 4px;border-radius:6px;}'
      + '.rg-row:hover{background:' + ROW_HOVER + ';}'
      + '.rg-art{width:40px;height:40px;border-radius:5px;object-fit:cover;flex:none;background:' + BORDER + ';}'
      + '.rg-row-main{flex:1;min-width:0;}'
      + '.rg-row-title{margin:0;font-size:12.5px;font-weight:500;color:' + FOREGROUND + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.rg-row-sub{margin:1px 0 0;font-size:11.5px;color:' + MUTED + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}';
  }
  function actionButtons(entity, related, primaryUrl) {
    var buttons = [];
    var mainLabel = entity.type === 'track' ? 'Play' : 'Open';
    buttons.push({ label: mainLabel, url: primaryUrl });
    (related || []).slice(0, 2).forEach(function (rel) {
      var url = ralgrumUrlFor(rel, rel.type === 'track' ? 'play' : 'open');
      if (url) {
        buttons.push({ label: typeName(rel.type), url: url, title: rel.title });
      }
    });
    buttons.push({ label: 'Copy link', copy: primaryUrl });
    buttons.push({ label: 'Dismiss', dismiss: true });
    return buttons;
  }
  function render(entity, meta, related) {
    clearHost();
    var host = ensureHost();
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var accent = accentFor(entity.provider);
    var action = entity.type === 'track' ? 'play' : 'open';
    var primaryUrl = ralgrumUrlFor(entity, action);
    var title = (meta && meta.title) || entity.title || (providerName(entity.provider) + ' ' + typeName(entity.type));
    var sub = (meta && meta.subtitle) || entity.url;
    var desc = providerName(entity.provider) + ' ' + typeName(entity.type) + ' - ' + sub;
    var buttons = primaryUrl ? actionButtons(entity, related, primaryUrl) : [{ label: 'Dismiss', dismiss: true }];
    var html = '<style>' + styleText() + '</style>'
      + '<div class="rg-stack"><div class="rg-card" role="status">'
      + '<span class="rg-glyph">' + noteSvg(accent) + '</span>'
      + '<div class="rg-main">'
      + '<p class="rg-title">' + esc(title) + '</p>'
      + '<p class="rg-desc">' + esc(desc) + '</p>'
      + '<div class="rg-actions">';
    buttons.forEach(function (b, i) {
      var attrs = 'class="rg-btn" data-rg-i="' + i + '"';
      if (b.title) {
        attrs += ' title="' + esc(b.title) + '"';
      }
      html += '<button ' + attrs + '>' + esc(b.label) + '</button>';
    });
    html += '</div></div></div></div>';
    if (shadow.innerHTML !== undefined) {
      shadow.innerHTML = html;
    } else {
      host.innerHTML = html;
    }
    var box = shadow.querySelector ? shadow.querySelector('.rg-card') : host;
    var state = { hovered: false, remaining: LIFETIME, timer: 0 };
    function onClick(ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) {
        return;
      }
      var idx = t.getAttribute('data-rg-i');
      if (idx === null || idx === undefined) {
        return;
      }
      var b = buttons[Number(idx)];
      if (!b) {
        return;
      }
      if (b.dismiss) {
        teardown();
        clearHost();
        return;
      }
      if (b.copy) {
        copyText(b.copy, function (ok) {
          t.textContent = ok ? 'Copied' : 'Copy failed';
          setTimeout(function () {
            t.textContent = 'Copy link';
          }, 1400);
        });
        return;
      }
      if (b.url) {
        sendToApp(b.url);
      }
    }
    function teardown() {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = 0;
      }
    }
    var container = shadow.querySelector ? shadow : host;
    if (container.addEventListener) {
      container.addEventListener('click', onClick);
    }
    if (box && box.addEventListener) {
      box.addEventListener('mouseenter', function () {
        state.hovered = true;
      });
      box.addEventListener('mouseleave', function () {
        state.hovered = false;
      });
    }
    return { teardown: teardown };
  }
  function renderDialog(entities) {
    clearHost();
    var host = ensureHost();
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var html = '<style>' + styleText() + '</style>'
      + '<div class="rg-stack"><div class="rg-panel" role="dialog" aria-label="Open in ralgruM">'
      + '<div class="rg-panel-head">'
      + '<p class="rg-panel-title">Open in ralgruM</p>'
      + '<button class="rg-close" data-rg-x="1" aria-label="Dismiss notification">' + xSvg() + '</button>'
      + '</div>';
    entities.forEach(function (item, i) {
      var action = item.entity.type === 'track' ? 'play' : 'open';
      var url = ralgrumUrlFor(item.entity, action);
      var label = item.entity.type === 'track' ? 'Play' : 'Open';
      html += '<div class="rg-row">'
        + (item.artwork ? '<img class="rg-art" src="' + esc(item.artwork) + '" alt=""/>' : '')
        + '<div class="rg-row-main">'
        + '<p class="rg-row-title">' + esc(item.title || item.entity.url) + '</p>'
        + '<p class="rg-row-sub">' + esc(providerName(item.entity.provider) + ' ' + typeName(item.entity.type)) + '</p>'
        + '</div>'
        + (url ? '<button class="rg-btn" data-rg-open="' + esc(url) + '">' + esc(label) + '</button>' : '')
        + '</div>';
    });
    html += '</div></div>';
    if (shadow.innerHTML !== undefined) {
      shadow.innerHTML = html;
    } else {
      host.innerHTML = html;
    }
    var container = shadow.querySelector ? shadow : host;
    container.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) {
        return;
      }
      if (t.getAttribute('data-rg-x')) {
        clearHost();
        return;
      }
      var url = t.getAttribute('data-rg-open');
      if (url) {
        sendToApp(url);
      }
    });
  }
  var live = null;
  function show(entity, meta, related) {
    if (!entity) {
      return false;
    }
    if (live) {
      live.teardown();
      live = null;
    }
    live = render(entity, meta, related || []);
    return true;
  }
  function showOncePerPage(entity, meta, related) {
    var key = String(entity.provider) + ':' + String(entity.type) + ':' + String(entity.id || entity.url);
    if (SHOWN_KEYS[key]) {
      return false;
    }
    SHOWN_KEYS[key] = true;
    return show(entity, meta, related);
  }
  function dismiss() {
    if (live) {
      live.teardown();
      live = null;
    }
    clearHost();
  }
  root.RalgrumToast = {
    show: show,
    showOncePerPage: showOncePerPage,
    showDialog: renderDialog,
    dismiss: dismiss,
    resetForNavigation: dismiss,
    colors: {
      border: BORDER,
      foreground: FOREGROUND,
      muted: MUTED,
      primary: PRIMARY,
      deezer: DEEZER,
      soundcloud: SOUNDCLOUD
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
