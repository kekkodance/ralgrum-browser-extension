// RalgrumToast card layout: header (app logo, ralgruM, plain-x close),
// center (queue row for tracks, collection header copy for albums,
// playlists and artists), footer (primary plus secondary actions).
// Every token mirrors the app: toast frame, plain_x_button, queue row,
// collection header, primary button, secondary page action. Flat, no shadow.
(function (root) {
  'use strict';
  var BORDER = '#27272a';
  var FOREGROUND = '#fafafa';
  var TITLE = '#ffffff';
  var MUTED = '#a1a1aa';
  var PRIMARY = '#6366f1';
  var CARD_BG = '#121214f5';
  var ROW_HOVER_BG = 'rgba(255, 255, 255, 0.04)';
  var ART_BG = '#18181b';
  var DEEZER = '#a238ff';
  var SOUNDCLOUD = '#ff5500';
  var FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
  var SHOWN_KEYS = {};
  function accentFor(provider) {
    return provider === 'soundcloud' ? SOUNDCLOUD : DEEZER;
  }
  function providerName(provider) {
    return provider === 'soundcloud' ? 'SoundCloud' : 'Deezer';
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
  function logoUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('icons/icon32.png');
      }
    } catch (e) {
      // no extension runtime (dev preview), use glyph fallback
    }
    return null;
  }
  function brandGlyph(color) {
    return '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">'
      + '<circle cx="5" cy="12" r="2.6" fill="' + color + '"/>'
      + '<circle cx="11.5" cy="10.5" r="2.6" fill="' + color + '"/>'
      + '<rect x="7" y="1.5" width="1.6" height="9" fill="' + color + '"/>'
      + '<rect x="13.5" y="1.5" width="1.6" height="7" fill="' + color + '"/>'
      + '<rect x="7" y="1.5" width="8.1" height="1.6" fill="' + color + '"/>'
      + '</svg>';
  }
  function musicGlyph() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">'
      + '<circle cx="5" cy="12" r="2.6" fill="' + MUTED + '"/>'
      + '<circle cx="11.5" cy="10.5" r="2.6" fill="' + MUTED + '"/>'
      + '<rect x="7" y="1.5" width="1.6" height="9" fill="' + MUTED + '"/>'
      + '<rect x="13.5" y="1.5" width="1.6" height="7" fill="' + MUTED + '"/>'
      + '<rect x="7" y="1.5" width="8.1" height="1.6" fill="' + MUTED + '"/>'
      + '</svg>';
  }
  function xGlyph(color, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 12 12" aria-hidden="true">'
      + '<rect x="2" y="5.2" width="8" height="1.6" rx="0.8" fill="' + color + '" transform="rotate(45 6 6)"/>'
      + '<rect x="2" y="5.2" width="8" height="1.6" rx="0.8" fill="' + color + '" transform="rotate(-45 6 6)"/>'
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
  function styleText() {
    return ''
      + '.rg-stack{width:360px;max-width:calc(100vw - 32px);font-family:' + FONT + ';}'
      + '.rg-stack,.rg-stack *{box-sizing:border-box;}'
      + '.rg-card{min-width:280px;max-width:380px;border-radius:12px;border:1px solid ' + BORDER + ';'
      + 'background:' + CARD_BG + ';animation:rg-in 180ms ease-out;}'
      + '@keyframes rg-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
      + '.rg-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid ' + BORDER + ';}'
      + '.rg-logo{width:18px;height:18px;border-radius:4px;flex:none;}'
      + '.rg-logo-fallback{width:18px;height:18px;border-radius:4px;flex:none;background:' + PRIMARY + ';'
      + 'color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;}'
      + '.rg-brand{margin:0;font-size:13px;font-weight:600;color:' + FOREGROUND + ';}'
      + '.rg-x{margin-left:auto;width:24px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;'
      + 'border-radius:5px;border:1px solid transparent;background:transparent;cursor:pointer;padding:0;}'
      + '.rg-x:focus-visible{outline:none;border-color:' + PRIMARY + ';}'
      + '.rg-x .rg-x-hover{display:none;}'
      + '.rg-x:hover .rg-x-idle{display:none;}'
      + '.rg-x:hover .rg-x-hover{display:block;}'
      + '.rg-center{padding:10px 12px;}'
      + '.rg-trow{display:flex;align-items:center;gap:9px;padding:6px;border-radius:6px;'
      + 'border:1px solid transparent;cursor:pointer;}'
      + '.rg-trow:hover{background:' + ROW_HOVER_BG + ';border-color:' + BORDER + ';}'
      + '.rg-art{width:40px;height:40px;flex:none;object-fit:cover;border-radius:5px;border:1px solid ' + BORDER + ';background:' + ART_BG + ';}'
      + '.rg-art-fallback{width:40px;height:40px;flex:none;display:flex;align-items:center;justify-content:center;'
      + 'border-radius:5px;border:1px solid ' + BORDER + ';background:' + ART_BG + ';}'
      + '.rg-tcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}'
      + '.rg-ttitle{margin:0;font-size:12.5px;font-weight:500;color:' + FOREGROUND + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.rg-tartist{margin:0;font-size:11.5px;color:' + MUTED + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.rg-prov{flex:none;display:flex;align-items:center;}'
      + '.rg-hrow{display:flex;align-items:center;gap:16px;}'
      + '.rg-hart{width:76px;height:76px;flex:none;object-fit:cover;border-radius:6px;border:1px solid ' + BORDER + ';background:' + ART_BG + ';}'
      + '.rg-hart-fallback{width:76px;height:76px;flex:none;display:flex;align-items:center;justify-content:center;'
      + 'border-radius:6px;border:1px solid ' + BORDER + ';background:' + ART_BG + ';}'
      + '.rg-hcol{flex:1;min-width:0;display:flex;align-items:center;gap:10px;}'
      + '.rg-htext{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}'
      + '.rg-htitle{margin:0;font-size:18px;line-height:22.5px;font-weight:600;color:' + FOREGROUND + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.rg-hmeta{margin:0;font-size:11.5px;color:' + MUTED + ';'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.rg-provcol{flex:none;display:flex;align-items:center;gap:5px;margin-top:2px;}'
      + '.rg-provlabel{font-size:11.5px;font-weight:500;}'
      + '.rg-foot{display:flex;gap:6px;padding:2px 12px 12px;}'
      + '.rg-primary{flex:1;height:34px;padding:0 13px;border-radius:6px;border:1px solid #818cf8c2;background:' + PRIMARY + ';'
      + 'color:' + FOREGROUND + ';font-family:' + FONT + ';font-size:13px;font-weight:600;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;}'
      + '.rg-primary:hover{background:#5558e8;border-color:#a5b4fc;}'
      + '.rg-primary:focus-visible{outline:none;border-color:' + PRIMARY + ';}'
      + '.rg-secondary{height:34px;padding:0 13px;border-radius:6px;border:1px solid ' + BORDER + ';background:transparent;'
      + 'color:' + FOREGROUND + ';font-family:' + FONT + ';font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;}'
      + '.rg-secondary:hover{background:' + BORDER + ';}'
      + '.rg-secondary:focus-visible{outline:none;border-color:' + PRIMARY + ';}';
  }
  function headerHtml() {
    var logo = logoUrl();
    var logoHtml = logo
      ? '<img class="rg-logo" src="' + esc(logo) + '" alt=""/>'
      : '<span class="rg-logo-fallback">R</span>';
    return '<div class="rg-head">' + logoHtml
      + '<p class="rg-brand">ralgruM</p>'
      + '<button class="rg-x" data-rg-x="1" aria-label="Dismiss notification">'
      + '<span class="rg-x-idle">' + xGlyph(MUTED, 9) + '</span>'
      + '<span class="rg-x-hover">' + xGlyph(TITLE, 9) + '</span>'
      + '</button></div>';
  }
  function centerTrackHtml(entity, meta) {
    var title = (meta && meta.title) || entity.title || 'Unknown track';
    var artist = (meta && meta.subtitle) || '';
    var artwork = (meta && meta.artwork) || '';
    var artHtml = artwork
      ? '<img class="rg-art" src="' + esc(artwork) + '" alt=""/>'
      : '<span class="rg-art-fallback">' + musicGlyph() + '</span>';
    return '<div class="rg-trow" data-rg-play="1" role="button" aria-label="Play in ralgruM">'
      + artHtml
      + '<div class="rg-tcol">'
      + '<p class="rg-ttitle">' + esc(title) + '</p>'
      + '<p class="rg-tartist">' + esc(artist) + '</p>'
      + '</div>'
      + '<span class="rg-prov">' + brandGlyph(accentFor(entity.provider)) + '</span>'
      + '</div>';
  }
  function centerHeaderHtml(entity, meta) {
    var title = (meta && meta.title) || entity.title || typeName(entity.type);
    var sub = (meta && meta.subtitle) || '';
    var artwork = (meta && meta.artwork) || '';
    var artHtml = artwork
      ? '<img class="rg-hart" src="' + esc(artwork) + '" alt=""/>'
      : '<span class="rg-hart-fallback">' + musicGlyph() + '</span>';
    var color = accentFor(entity.provider);
    return '<div class="rg-hrow">'
      + artHtml
      + '<div class="rg-hcol"><div class="rg-htext">'
      + '<p class="rg-htitle">' + esc(title) + '</p>'
      + '<p class="rg-hmeta">' + esc(sub) + '</p>'
      + '</div></div>'
      + '<span class="rg-provcol">' + brandGlyph(color)
      + '<span class="rg-provlabel" style="color:' + color + '">' + esc(providerName(entity.provider)) + '</span>'
      + '</span>'
      + '</div>';
  }
  function footerHtml(entity, related, primaryUrl) {
    var html = '<div class="rg-foot">';
    var mainLabel = entity.type === 'track' ? 'Play in ralgruM' : 'Open in ralgruM';
    html += '<button class="rg-primary" data-rg-open="' + esc(primaryUrl) + '">' + esc(mainLabel) + '</button>';
    (related || []).slice(0, 2).forEach(function (rel) {
      var url = ralgrumUrlFor(rel, rel.type === 'track' ? 'play' : 'open');
      if (url) {
        html += '<button class="rg-secondary" data-rg-open="' + esc(url) + '">' + esc(typeName(rel.type)) + '</button>';
      }
    });
    html += '</div>';
    return html;
  }
  function render(entity, meta, related) {
    clearHost();
    var host = ensureHost();
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var action = entity.type === 'track' ? 'play' : 'open';
    var primaryUrl = ralgrumUrlFor(entity, action);
    var center = entity.type === 'track'
      ? centerTrackHtml(entity, meta)
      : centerHeaderHtml(entity, meta);
    var html = '<style>' + styleText() + '</style>'
      + '<div class="rg-stack"><div class="rg-card" role="dialog" aria-label="Open in ralgruM">'
      + headerHtml()
      + '<div class="rg-center">' + center + '</div>'
      + (primaryUrl ? footerHtml(entity, related, primaryUrl) : '')
      + '</div></div>';
    if (shadow.innerHTML !== undefined) {
      shadow.innerHTML = html;
    } else {
      host.innerHTML = html;
    }
    var container = shadow.querySelector ? shadow : host;
    container.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) {
        return;
      }
      var x = t.closest('[data-rg-x]');
      if (x) {
        clearHost();
        return;
      }
      var opener = t.closest('[data-rg-open]');
      if (opener) {
        sendToApp(opener.getAttribute('data-rg-open'));
        return;
      }
      var player = t.closest('[data-rg-play]');
      if (player && primaryUrl) {
        sendToApp(primaryUrl);
      }
    });
  }
  function show(entity, meta, related) {
    if (!entity) {
      return false;
    }
    render(entity, meta, related || []);
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
    clearHost();
  }
  root.RalgrumToast = {
    show: show,
    showOncePerPage: showOncePerPage,
    showDialog: show,
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
