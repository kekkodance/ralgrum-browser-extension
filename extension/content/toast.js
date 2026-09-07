// RalgrumToast card layout: header (app logo, ralgruM, toast close X),
// center (queue row for tracks, collection header copy for albums,
// playlists and artists), footer (primary plus secondary actions).
// Tokens mirror the app: toast frame and toast_close_button, queue row
// with row_meta badge, collection header with provider_context chip,
// primary button, secondary page action. Flat, no shadow.
// Brand glyphs are the same Font Awesome paths the app embeds.
(function (root) {
  'use strict';
  var BORDER = '#27272a';
  var FOREGROUND = '#fafafa';
  var MUTED = '#a1a1aa';
  var PRIMARY = '#6366f1';
  var CARD_BG = '#121214f5';
  var ROW_HOVER_BG = 'rgba(255, 255, 255, 0.04)';
  var ART_BG = '#18181b';
  var DEEZER = '#a238ff';
  var SOUNDCLOUD = '#ff5500';
  var FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
  var SHOWN_KEYS = {};
  var DEEZER_PATH = 'M14.8 101.1C6.6 101.1 0 127.6 0 160.3s6.6 59.2 14.8 59.2 14.8-26.5 14.8-59.2-6.6-59.2-14.8-59.2zM448.7 40.9c-7.7 0-14.5 17.1-19.4 44.1-7.7-46.7-20.2-77-34.2-77-16.8 0-31.1 42.9-38 105.4-6.6-45.4-16.8-74.2-28.3-74.2-16.1 0-29.6 56.9-34.7 136.2-9.4-40.8-23.2-66.3-38.3-66.3s-28.8 25.5-38.3 66.3c-5.1-79.3-18.6-136.2-34.7-136.2-11.5 0-21.7 28.8-28.3 74.2-6.6-62.5-21.2-105.4-37.8-105.4-14 0-26.5 30.4-34.2 77-4.8-27-11.7-44.1-19.4-44.1-14.3 0-26 59.2-26 132.1S49 305.2 63.3 305.2c5.9 0 11.5-9.9 15.8-26.8 6.9 61.7 21.2 104.1 38 104.1 13 0 24.5-25.5 32.1-65.6 5.4 76.3 18.6 130.4 34.2 130.4 9.7 0 18.6-21.4 25.3-56.4 7.9 72.2 26.3 122.7 47.7 122.7s39.5-50.5 47.7-122.7c6.6 35 15.6 56.4 25.3 56.4 15.6 0 28.8-54.1 34.2-130.4 7.7 40.1 19.4 65.6 32.1 65.6 16.6 0 30.9-42.3 38-104.1 4.3 16.8 9.7 26.8 15.8 26.8 14.3 0 26-59.2 26-132.1S463 40.9 448.7 40.9zm48.5 60.2c-8.2 0-14.8 26.5-14.8 59.2s6.6 59.2 14.8 59.2 14.8-26.5 14.8-59.2-6.6-59.2-14.8-59.2z';
  var SOUNDCLOUD_PATH = 'M640.2 298.6c-1.3 23.1-11.5 44.8-28.4 60.5s-39.2 24.4-62.3 24.1l-218 0c-4.8 0-9.4-2-12.8-5.4s-5.3-8-5.3-12.8l0-234.8c-.2-4 .9-8 3.1-11.4s5.3-6.1 9-7.7c0 0 20.1-13.9 62.3-13.9 25.8 0 51.1 6.9 73.3 20.1 17.3 10.2 32.3 23.8 44.1 40.1s20 34.8 24.2 54.4c7.5-2.1 15.3-3.2 23.1-3.2 11.7-.1 23.3 2.2 34.2 6.7s20.5 11.3 28.7 19.7 14.6 18.3 18.9 29.3 6.3 22.6 5.9 34.3zm-354-153.5c.1-1 0-2-.3-2.9s-.8-1.8-1.5-2.6-1.5-1.3-2.4-1.7c-1.8-.8-4-.8-5.8 0-.9 .4-1.7 1-2.4 1.7s-1.2 1.6-1.5 2.6-.4 1.9-.3 2.9c-6 78.9-10.6 152.9 0 231.6 .2 1.7 1 3.3 2.3 4.5 2.6 2.4 6.8 2.4 9.4 0 1.3-1.2 2.1-2.8 2.3-4.5 11.3-79.4 6.6-152 0-231.6l.2 0zm-44 27.3c-.2-1.8-1.1-3.5-2.4-4.7s-3.1-1.9-5-1.9-3.6 .7-5 1.9-2.2 2.9-2.4 4.7c-7.9 67.9-7.9 136.5 0 204.4 .3 1.8 1.2 3.4 2.5 4.5s3.1 1.8 4.8 1.8 3.5-.6 4.8-1.8 2.2-2.8 2.5-4.5c8.8-67.8 8.8-136.5 .1-204.4l.1 0zm-44.3-6.9c-.2-1.8-1-3.4-2.3-4.6s-3-1.8-4.8-1.8-3.5 .7-4.8 1.8-2.1 2.8-2.3 4.6c-6.7 72-10.2 139.3 0 211.1 0 1.9 .7 3.7 2.1 5s3.1 2.1 5 2.1 3.7-.7 5-2.1 2.1-3.1 2.1-5c10.5-72.8 7.3-138.2 .1-211.1l-.1 0zm-44 20.6c0-1.9-.8-3.8-2.1-5.2s-3.2-2.1-5.2-2.1-3.8 .8-5.2 2.1-2.1 3.2-2.1 5.2c-8.1 63.3-8.1 127.5 0 190.8 .2 1.8 1 3.4 2.4 4.6s3.1 1.9 4.8 1.9 3.5-.7 4.8-1.9 2.2-2.8 2.4-4.6c8.8-63.3 8.9-127.5 .3-190.8l-.1 0zm-44.5 47.6c0-1.9-.8-3.8-2.1-5.1s-3.2-2.1-5.1-2.1-3.8 .8-5.1 2.1-2.1 3.2-2.1 5.1c-10.5 49.2-5.5 93.9 .4 143.6 .3 1.6 1.1 3.1 2.3 4.2s2.8 1.7 4.5 1.7 3.2-.6 4.5-1.7 2.1-2.5 2.3-4.2c6.6-50.4 11.6-94.1 .4-143.6zm-44.1-7.5c-.2-1.8-1.1-3.5-2.4-4.8s-3.2-1.9-5-1.9-3.6 .7-5 1.9-2.2 2.9-2.4 4.8c-9.3 50.2-6.2 94.4 .3 144.5 .7 7.6 13.6 7.5 14.4 0 7.2-50.9 10.5-93.8 .3-144.5l-.2 0zM20.7 250.8c-.2-1.8-1.1-3.5-2.4-4.8s-3.2-1.9-5-1.9-3.6 .7-5 1.9-2.3 2.9-2.4 4.8c-8.5 33.7-5.9 61.6 .6 95.4 .2 1.7 1 3.3 2.3 4.4s2.9 1.8 4.7 1.8 3.4-.6 4.7-1.8 2.1-2.7 2.3-4.4c7.5-34.5 11.2-61.8 .4-95.4l-.2 0z';
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
  function providerGlyph(provider, size) {
    var isSc = provider === 'soundcloud';
    var path = isSc ? SOUNDCLOUD_PATH : DEEZER_PATH;
    var box = isSc ? '0 0 640 512' : '0 0 512 512';
    return '<svg width="' + size + '" height="' + Math.round(size * (isSc ? 512 / 640 : 1)) + '" viewBox="' + box + '" aria-hidden="true">'
      + '<path fill="' + accentFor(provider) + '" d="' + path + '"/>'
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
  function xGlyph() {
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
      + '.rg-x{margin-left:auto;width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center;'
      + 'border-radius:6px;border:none;background:transparent;cursor:pointer;padding:0;}'
      + '.rg-x:hover{background:' + BORDER + ';}'
      + '.rg-x:focus-visible{outline:none;border:1px solid ' + PRIMARY + ';}'
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
      + '.rg-tartist{margin:1px 0 0;font-size:11.5px;color:' + MUTED + ';'
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
      + '<button class="rg-x" data-rg-x="1" aria-label="Dismiss notification">' + xGlyph() + '</button></div>';
  }
  function centerTrackHtml(entity, meta) {
    var title = (meta && meta.title) || entity.title || 'Unknown track';
    var artist = (meta && meta.subtitle) || '';
    var artwork = (meta && meta.artwork) || '';
    var artHtml = artwork
      ? '<img class="rg-art" src="' + esc(artwork) + '" alt=""/>'
      : '<span class="rg-art-fallback">' + musicGlyph() + '</span>';
    var artistHtml = artist
      ? '<p class="rg-tartist">' + esc(artist) + '</p>'
      : '';
    return '<div class="rg-trow" data-rg-play="1" role="button" aria-label="Play in ralgruM">'
      + artHtml
      + '<div class="rg-tcol">'
      + '<p class="rg-ttitle">' + esc(title) + '</p>'
      + artistHtml
      + '</div>'
      + '<span class="rg-prov">' + providerGlyph(entity.provider, 11) + '</span>'
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
    var subHtml = sub
      ? '<p class="rg-hmeta">' + esc(sub) + '</p>'
      : '';
    return '<div class="rg-hrow">'
      + artHtml
      + '<div class="rg-hcol"><div class="rg-htext">'
      + '<p class="rg-htitle">' + esc(title) + '</p>'
      + subHtml
      + '</div></div>'
      + '<span class="rg-provcol">' + providerGlyph(entity.provider, 14)
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
