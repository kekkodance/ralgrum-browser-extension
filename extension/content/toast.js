// RalgrumToast card: dialog chrome (BACKGROUND header with border-bottom,
// BACKGROUND footer with border-top) around app-faithful content: queue row
// for tracks, collection header copy for albums, playlists and artists.
// Tokens mirror toast.rs, queue_rows.rs, collection_detail.rs,
// app_button.rs and music_ui explicit_badge. Brand, X and note glyphs are
// the same Font Awesome paths the app embeds. Flat card, original blur.
(function (root) {
  'use strict';
  var BORDER = '#27272a';
  var FOREGROUND = '#fafafa';
  var MUTED = '#a1a1aa';
  var PRIMARY = '#6366f1';
  var CHROME_BG = '#09090b';
  var CARD_BG = '#09090b';
  var ART_BG = '#18181b';
  var DEEZER = '#a238ff';
  var SOUNDCLOUD = '#ff5500';
  var DANGER = '#ef4444';
  var FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
  var SHOWN = {};
  var DEEZER_PATH =
    'M14.8 101.1C6.6 101.1 0 127.6 0 160.3s6.6 59.2 14.8 59.2 14.8-26.5 14.8-59.2-6.6-59.2-14.8-59.2zM448.7 40.9c-7.7 0-14.5 17.1-19.4' +
    ' 44.1-7.7-46.7-20.2-77-34.2-77-16.8 0-31.1 42.9-38 105.4-6.6-45.4-16.8-74.2-28.3-74.2-16.1 0-29.6 56.9-34.7 136.2-9.4-40.8-23.2-66.3-38.3-66.3s-28.8 25.5-38.3' +
    ' 66.3c-5.1-79.3-18.6-136.2-34.7-136.2-11.5 0-21.7 28.8-28.3 74.2-6.6-62.5-21.2-105.4-37.8-105.4-14 0-26.5 30.4-34.2 77-4.8-27-11.7-44.1-19.4-44.1-14.3 0-26' +
    ' 59.2-26 132.1S49 305.2 63.3 305.2c5.9 0 11.5-9.9 15.8-26.8 6.9 61.7 21.2 104.1 38 104.1 13 0 24.5-25.5 32.1-65.6 5.4 76.3 18.6 130.4 34.2 130.4 9.7 0 18.6-21.4' +
    ' 25.3-56.4 7.9 72.2 26.3 122.7 47.7 122.7s39.5-50.5 47.7-122.7c6.6 35 15.6 56.4 25.3 56.4 15.6 0 28.8-54.1 34.2-130.4 7.7 40.1 19.4 65.6 32.1 65.6 16.6 0' +
    ' 30.9-42.3 38-104.1 4.3 16.8 9.7 26.8 15.8 26.8 14.3 0 26-59.2 26-132.1S463 40.9 448.7 40.9zm48.5 60.2c-8.2 0-14.8 26.5-14.8 59.2s6.6 59.2 14.8 59.2 14.8-26.5' +
    ' 14.8-59.2-6.6-59.2-14.8-59.2z';
  var SOUNDCLOUD_PATH =
    'M640.2 298.6c-1.3 23.1-11.5 44.8-28.4 60.5s-39.2 24.4-62.3 24.1l-218 0c-4.8 0-9.4-2-12.8-5.4s-5.3-8-5.3-12.8l0-234.8c-.2-4 .9-8 3.1-11.4s5.3-6.1 9-7.7c0 0' +
    ' 20.1-13.9 62.3-13.9 25.8 0 51.1 6.9 73.3 20.1 17.3 10.2 32.3 23.8 44.1 40.1s20 34.8 24.2 54.4c7.5-2.1 15.3-3.2 23.1-3.2 11.7-.1 23.3 2.2 34.2 6.7s20.5 11.3 28.7' +
    ' 19.7 14.6 18.3 18.9 29.3 6.3 22.6 5.9 34.3zm-354-153.5c.1-1 0-2-.3-2.9s-.8-1.8-1.5-2.6-1.5-1.3-2.4-1.7c-1.8-.8-4-.8-5.8 0-.9 .4-1.7 1-2.4 1.7s-1.2 1.6-1.5' +
    ' 2.6-.4 1.9-.3 2.9c-6 78.9-10.6 152.9 0 231.6 .2 1.7 1 3.3 2.3 4.5 2.6 2.4 6.8 2.4 9.4 0 1.3-1.2 2.1-2.8 2.3-4.5 11.3-79.4 6.6-152 0-231.6l.2 0zm-44' +
    ' 27.3c-.2-1.8-1.1-3.5-2.4-4.7s-3.1-1.9-5-1.9-3.6 .7-5 1.9-2.2 2.9-2.4 4.7c-7.9 67.9-7.9 136.5 0 204.4 .3 1.8 1.2 3.4 2.5 4.5s3.1 1.8 4.8 1.8 3.5-.6 4.8-1.8' +
    ' 2.2-2.8 2.5-4.5c8.8-67.8 8.8-136.5 .1-204.4l.1 0zm-44.3-6.9c-.2-1.8-1-3.4-2.3-4.6s-3-1.8-4.8-1.8-3.5 .7-4.8 1.8-2.1 2.8-2.3 4.6c-6.7 72-10.2 139.3 0 211.1 0 1.9' +
    ' .7 3.7 2.1 5s3.1 2.1 5 2.1 3.7-.7 5-2.1 2.1-3.1 2.1-5c10.5-72.8 7.3-138.2 .1-211.1l-.1 0zm-44 20.6c0-1.9-.8-3.8-2.1-5.2s-3.2-2.1-5.2-2.1-3.8 .8-5.2 2.1-2.1' +
    ' 3.2-2.1 5.2c-8.1 63.3-8.1 127.5 0 190.8 .2 1.8 1 3.4 2.4 4.6s3.1 1.9 4.8 1.9 3.5-.7 4.8-1.9 2.2-2.8 2.4-4.6c8.8-63.3 8.9-127.5 .3-190.8l-.1 0zm-44.5' +
    ' 47.6c0-1.9-.8-3.8-2.1-5.1s-3.2-2.1-5.1-2.1-3.8 .8-5.1 2.1-2.1 3.2-2.1 5.1c-10.5 49.2-5.5 93.9 .4 143.6 .3 1.6 1.1 3.1 2.3 4.2s2.8 1.7 4.5 1.7 3.2-.6 4.5-1.7' +
    ' 2.1-2.5 2.3-4.2c6.6-50.4 11.6-94.1 .4-143.6zm-44.1-7.5c-.2-1.8-1.1-3.5-2.4-4.8s-3.2-1.9-5-1.9-3.6 .7-5 1.9-2.2 2.9-2.4 4.8c-9.3 50.2-6.2 94.4 .3 144.5 .7 7.6' +
    ' 13.6 7.5 14.4 0 7.2-50.9 10.5-93.8 .3-144.5l-.2 0zM20.7 250.8c-.2-1.8-1.1-3.5-2.4-4.8s-3.2-1.9-5-1.9-3.6 .7-5 1.9-2.3 2.9-2.4 4.8c-8.5 33.7-5.9 61.6 .6 95.4 .2' +
    ' 1.7 1 3.3 2.3 4.4s2.9 1.8 4.7 1.8 3.4-.6 4.7-1.8 2.1-2.7 2.3-4.4c7.5-34.5 11.2-61.8 .4-95.4l-.2 0z';
  var XMARK_PATH =
    'M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8' +
    ' 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z';
  var MUSIC_PATH =
    'M468 7c7.6 6.1 12 15.3 12 25l0 304c0 44.2-43 80-96 80s-96-35.8-96-80 43-80 96-80c11.2 0 22 1.6 32 4.6l0-116.7-224 49.8 0 206.3c0 44.2-43 80-96 80s-96-35.8-96-80' +
    ' 43-80 96-80c11.2 0 22 1.6 32 4.6L128 96c0-15 10.4-28 25.1-31.2l288-64c9.5-2.1 19.4 .2 27 6.3z';
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
  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }
  function createImage(className, src) {
    var image = createElement('img', className);
    image.setAttribute('src', src);
    image.setAttribute('alt', '');
    image.setAttribute('draggable', 'false');
    return image;
  }
  function isWebUrl(value) {
    return /^https?:\/\/\S*$/i.test(String(value || '').trim());
  }
  function cleanText(value) {
    var text = String(value == null ? '' : value).trim();
    return isWebUrl(text) ? '' : text;
  }
  function stableEntityKey(entity) {
    if (root.RalgrumSpaNavigation && root.RalgrumSpaNavigation.entityKey) {
      return root.RalgrumSpaNavigation.entityKey(entity);
    }
    if (!entity || !entity.provider || !entity.type) {
      return '';
    }
    var provider = String(entity.provider).toLowerCase();
    var type = String(entity.type).toLowerCase();
    if (provider === 'deezer' && /^\d+$/.test(String(entity.id || ''))) {
      return provider + ':' + type + ':' + String(entity.id);
    }
    var url = String(entity.url || '')
      .split('#')[0]
      .split('?')[0]
      .replace(/\/+$/, '');
    return provider + ':' + type + ':' + (url || String(entity.id || ''));
  }
  function resolveLogoUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('icons/icon32.png');
      }
    } catch (e) {
      // no extension runtime (dev preview), use glyph fallback
    }
    try {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
        return browser.runtime.getURL('icons/icon32.png');
      }
    } catch (e) {
      // no extension runtime (dev preview), use glyph fallback
    }
    return null;
  }
  var CACHED_LOGO_URL = null;
  function logoUrl() {
    if (!CACHED_LOGO_URL) {
      CACHED_LOGO_URL = resolveLogoUrl();
    }
    return CACHED_LOGO_URL;
  }
  function createGlyph(size, viewBox, fill, pathData) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', fill);
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
  }
  function createProviderGlyph(provider, size) {
    var isSc = provider === 'soundcloud';
    var path = isSc ? SOUNDCLOUD_PATH : DEEZER_PATH;
    var box = isSc ? '0 0 640 512' : '0 0 512 512';
    var svg = createGlyph(size, box, accentFor(provider), path);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return svg;
  }
  function createMusicGlyph() {
    return createGlyph(14, '0 0 512 512', MUTED, MUSIC_PATH);
  }
  function createDismissGlyph() {
    return createGlyph(12, '0 0 384 512', MUTED, XMARK_PATH);
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
  function ralgrumUrlFor(entity, action, title) {
    if (root.RalgrumDetectors && root.RalgrumDetectors.buildRalgrumUrl) {
      return root.RalgrumDetectors.buildRalgrumUrl(entity, { action: action, title: title });
    }
    return null;
  }
  function sendToApp(url) {
    try {
      // Keep the custom-protocol navigation inside the trusted button click.
      // Moving it to an extension message can make browsers discard the user
      // activation and silently block the external application launch.
      window.location.href = url;
      return;
    } catch (e) {
      // fall through to the extension background
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'RALGRUM_OPEN', url: url }, function (response) {
          void chrome.runtime.lastError;
          if (!response || response.ok !== true) {
            window.location.href = url;
          }
        });
        return;
      }
    } catch (e) {
      // fall through to direct navigation
    }
    window.location.href = url;
  }
  function styleText() {
    return (
      '' +
      '.rg-stack{width:360px;max-width:calc(100vw - 32px);font-family:' +
      FONT +
      ';}' +
      '.rg-stack,.rg-stack *{box-sizing:border-box;-webkit-user-select:none;user-select:none;}' +
      '.rg-stack img{-webkit-user-drag:none;}' +
      '.rg-card{min-width:280px;max-width:380px;border-radius:12px;border:1px solid ' +
      BORDER +
      ';' +
      'background:' +
      CARD_BG +
      ';overflow:hidden;' +
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
      'animation:rg-in 180ms ease-out;}' +
      '.rg-card.rg-update{animation:none;}' +
      '@keyframes rg-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}' +
      '.rg-head{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 12px;border-bottom:1px solid ' +
      BORDER +
      ';background:' +
      CHROME_BG +
      ';}' +
      '.rg-logo{width:18px;height:18px;border-radius:4px;flex:none;display:block;}' +
      '.rg-logo-fallback{width:18px;height:18px;border-radius:4px;flex:none;background:' +
      PRIMARY +
      ';' +
      'color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;}' +
      '.rg-brand{margin:0;font-size:13px;line-height:1;font-weight:600;color:' +
      FOREGROUND +
      ';position:relative;top:-1px;}' +
      '.rg-x{margin-left:auto;width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center;' +
      'border-radius:6px;border:none;background:transparent;cursor:pointer;padding:0;}' +
      '.rg-x:hover{background:' +
      BORDER +
      ';}' +
      '.rg-x:hover path{fill:' +
      FOREGROUND +
      ';}' +
      '.rg-x:focus-visible{outline:none;border:1px solid ' +
      PRIMARY +
      ';}' +
      '.rg-center{padding:10px 12px;}' +
      '.rg-trow{display:flex;align-items:center;gap:9px;padding:7px 6px;border-radius:6px;' +
      'border:1px solid transparent;}' +
      '.rg-art{width:40px;height:40px;flex:none;object-fit:cover;border-radius:5px;border:1px solid ' +
      BORDER +
      ';background:' +
      ART_BG +
      ';display:block;}' +
      '.rg-art-fallback{width:40px;height:40px;flex:none;display:flex;align-items:center;justify-content:center;' +
      'border-radius:5px;border:1px solid ' +
      BORDER +
      ';background:' +
      ART_BG +
      ';}' +
      '.rg-tcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}' +
      '.rg-ttitle-row{display:flex;align-items:center;gap:5px;min-width:0;}' +
      '.rg-ttitle{margin:0;flex:1;min-width:0;font-size:12.5px;font-weight:500;color:' +
      FOREGROUND +
      ';' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.rg-tartist{margin:0;font-size:11.5px;color:' +
      MUTED +
      ';' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.rg-explicit{position:relative;top:1px;width:14px;height:14px;flex:none;display:inline-flex;align-items:center;justify-content:center;' +
      'border-radius:3px;border:1px solid rgba(239, 68, 68, 0.4);background:rgba(239, 68, 68, 0.15);' +
      'font-size:8px;font-weight:800;color:' +
      DANGER +
      ';}' +
      '.rg-explicit-glyph{position:relative;top:-1px;}' +
      '.rg-prov{flex:none;display:flex;align-items:center;gap:4px;margin-right:2px;}' +
      '.rg-prov svg{position:relative;top:1px;flex:none;display:block;}' +
      '.rg-provlabel-t{font-size:11px;font-weight:500;white-space:nowrap;}' +
      '.rg-hrow{display:flex;align-items:center;gap:16px;}' +
      '.rg-hart{width:76px;height:76px;flex:none;object-fit:cover;border-radius:6px;border:1px solid ' +
      BORDER +
      ';background:' +
      ART_BG +
      ';display:block;}' +
      '.rg-hart-fallback{width:76px;height:76px;flex:none;display:flex;align-items:center;justify-content:center;' +
      'border-radius:6px;border:1px solid ' +
      BORDER +
      ';background:' +
      ART_BG +
      ';}' +
      '.rg-hcol{flex:1;min-width:0;display:flex;align-items:center;gap:10px;}' +
      '.rg-htext{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}' +
      '.rg-htitle{margin:0;font-size:18px;line-height:22.5px;font-weight:600;color:' +
      FOREGROUND +
      ';position:relative;top:-1px;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.rg-hmeta{margin:0;font-size:11.5px;color:' +
      MUTED +
      ';' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.rg-provcol{flex:none;display:flex;align-items:center;gap:5px;margin-top:2px;}' +
      '.rg-provlabel{font-size:11.5px;font-weight:500;position:relative;top:1px;}' +
      '.rg-foot{display:flex;gap:6px;padding:10px 12px 12px;border-top:1px solid ' +
      BORDER +
      ';background:' +
      CHROME_BG +
      ';}' +
      '.rg-primary{flex:1;height:34px;padding:0 13px 2px;border-radius:6px;border:1px solid #818cf8c2;background:' +
      PRIMARY +
      ';' +
      'color:' +
      FOREGROUND +
      ';font-family:' +
      FONT +
      ';font-size:13px;line-height:1;font-weight:600;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;}' +
      '.rg-primary:hover{background:#5558e8;border-color:#a5b4fc;}' +
      '.rg-primary:focus-visible{outline:none;border-color:' +
      PRIMARY +
      ';}' +
      '.rg-secondary{height:34px;padding:0 11px 2px;border-radius:6px;border:1px solid ' +
      BORDER +
      ';background:transparent;' +
      'color:' +
      FOREGROUND +
      ';font-family:' +
      FONT +
      ';font-size:13px;line-height:1;font-weight:500;cursor:pointer;white-space:nowrap;' +
      'display:inline-flex;align-items:center;justify-content:center;}' +
      '.rg-secondary:hover{background:' +
      BORDER +
      ';}' +
      '.rg-secondary:focus-visible{outline:none;border-color:' +
      PRIMARY +
      ';}'
    );
  }
  function createHeader() {
    var logo = logoUrl();
    var header = createElement('div', 'rg-head');
    header.appendChild(logo ? createImage('rg-logo', logo) : createElement('span', 'rg-logo-fallback', 'R'));
    header.appendChild(createElement('p', 'rg-brand', 'ralgruM'));
    var dismiss = createElement('button', 'rg-x');
    dismiss.setAttribute('data-rg-x', '1');
    dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.appendChild(createDismissGlyph());
    header.appendChild(dismiss);
    return header;
  }
  function createTrackRow(entity, meta) {
    var title = cleanText((meta && meta.title) || entity.title) || 'Unknown track';
    var artist = cleanText(meta && meta.subtitle);
    var artwork = (meta && meta.artwork) || '';
    var row = createElement('div', 'rg-trow');
    row.setAttribute('data-rg-play', '1');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', 'Play in ralgruM');
    if (artwork) {
      row.appendChild(createImage('rg-art', artwork));
    } else {
      var fallback = createElement('span', 'rg-art-fallback');
      fallback.appendChild(createMusicGlyph());
      row.appendChild(fallback);
    }
    var column = createElement('div', 'rg-tcol');
    var titleRow = createElement('div', 'rg-ttitle-row');
    titleRow.appendChild(createElement('p', 'rg-ttitle', title));
    if (meta && meta.explicit) {
      var badge = createElement('span', 'rg-explicit');
      badge.appendChild(createElement('span', 'rg-explicit-glyph', 'E'));
      titleRow.appendChild(badge);
    }
    column.appendChild(titleRow);
    if (artist) {
      column.appendChild(createElement('p', 'rg-tartist', artist));
    }
    row.appendChild(column);
    var provider = createElement('span', 'rg-prov');
    provider.appendChild(createProviderGlyph(entity.provider, 11));
    var label = createElement('span', 'rg-provlabel-t', providerName(entity.provider));
    label.style.color = accentFor(entity.provider);
    provider.appendChild(label);
    row.appendChild(provider);
    return row;
  }
  function createCollectionHeader(entity, meta) {
    var title = cleanText((meta && meta.title) || entity.title) || typeName(entity.type);
    var sub = cleanText(meta && meta.subtitle);
    var artwork = (meta && meta.artwork) || '';
    var row = createElement('div', 'rg-hrow');
    row.appendChild(artwork ? createImage('rg-hart', artwork) : createElement('span', 'rg-hart-fallback'));
    var column = createElement('div', 'rg-hcol');
    var text = createElement('div', 'rg-htext');
    text.appendChild(createElement('p', 'rg-htitle', title));
    if (sub) {
      text.appendChild(createElement('p', 'rg-hmeta', sub));
    }
    column.appendChild(text);
    row.appendChild(column);
    var provider = createElement('span', 'rg-provcol');
    provider.appendChild(createProviderGlyph(entity.provider, 14));
    var label = createElement('span', 'rg-provlabel', providerName(entity.provider));
    label.style.color = accentFor(entity.provider);
    provider.appendChild(label);
    row.appendChild(provider);
    return row;
  }
  function createFooter(entity, related, primaryUrl) {
    var footer = createElement('div', 'rg-foot');
    var mainLabel = entity.type === 'track' ? 'Play in ralgruM' : 'Open in ralgruM';
    var primary = createElement('button', 'rg-primary', mainLabel);
    primary.setAttribute('data-rg-open', primaryUrl);
    footer.appendChild(primary);
    (related || []).slice(0, 2).forEach(function (rel) {
      var url = ralgrumUrlFor(rel, rel.type === 'track' ? 'play' : 'open');
      if (url) {
        var secondary = createElement('button', 'rg-secondary', typeName(rel.type));
        secondary.setAttribute('data-rg-open', url);
        footer.appendChild(secondary);
      }
    });
    return footer;
  }
  function render(entity, meta, related, update) {
    var focusSelector = null;
    var focusUrl = null;
    if (update) {
      var previousHost = document.querySelector('.ralgrum-toast-host');
      var previousShadow = previousHost && previousHost.shadowRoot;
      var focused = previousShadow
        ? previousShadow.activeElement
        : previousHost && previousHost.contains(document.activeElement)
          ? document.activeElement
          : null;
      if (focused && focused.matches) {
        if (focused.matches('[data-rg-x]')) {
          focusSelector = '[data-rg-x]';
        } else if (focused.matches('.rg-primary')) {
          focusSelector = '.rg-primary';
        } else if (focused.matches('[data-rg-play]')) {
          focusSelector = '[data-rg-play]';
        } else if (focused.matches('[data-rg-open]')) {
          focusUrl = focused.getAttribute('data-rg-open');
        }
      }
    }
    clearHost();
    var host = ensureHost();
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var action = entity.type === 'track' ? 'play' : 'open';
    var primaryUrl = ralgrumUrlFor(entity, action, meta && meta.title);
    var content = entity.type === 'track' ? createTrackRow(entity, meta) : createCollectionHeader(entity, meta);
    var cardClass = update ? 'rg-card rg-update' : 'rg-card';
    var renderKey = stableEntityKey(entity);
    var style = createElement('style');
    style.textContent = styleText();
    var stack = createElement('div', 'rg-stack');
    var card = createElement('div', cardClass);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Open in ralgruM');
    card.appendChild(createHeader());
    var center = createElement('div', 'rg-center');
    center.appendChild(content);
    card.appendChild(center);
    if (primaryUrl) {
      card.appendChild(createFooter(entity, related, primaryUrl));
    }
    stack.appendChild(card);
    shadow.appendChild(style);
    shadow.appendChild(stack);
    var container = shadow.querySelector ? shadow : host;
    container.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) {
        return;
      }
      var x = t.closest('[data-rg-x]');
      if (x) {
        var dismissed = SHOWN[renderKey];
        if (dismissed) {
          dismissed.dismissed = true;
        }
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
    var focusTarget = focusSelector && container.querySelector(focusSelector);
    if (focusUrl) {
      var openers = container.querySelectorAll('[data-rg-open]');
      for (var i = 0; i < openers.length; i++) {
        if (openers[i].getAttribute('data-rg-open') === focusUrl) {
          focusTarget = openers[i];
          break;
        }
      }
    }
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }
  }
  function show(entity, meta, related) {
    if (!entity) {
      return false;
    }
    render(entity, meta, related || [], false);
    return true;
  }
  var SETTLE_MS = 800;
  var READY_DEADLINE_MS = 6000;
  function showOncePerPage(entity, meta, related) {
    if (!entity) {
      return false;
    }
    var key = stableEntityKey(entity);
    var t = cleanText(meta && meta.title);
    var s = cleanText(meta && meta.subtitle);
    var authoritative = !!(meta && meta.authoritative && t);
    var now = Date.now();
    var seen = SHOWN[key];
    if (!seen) {
      seen = SHOWN[key] = {
        entity: entity,
        title: '',
        subtitle: '',
        artwork: '',
        explicit: false,
        dismissed: false,
        related: [],
        shownTitle: null,
        shownSubtitle: null,
        firstSeen: now,
        settleTimer: 0,
        deadlineTimer: 0
      };
    }
    var previousArtwork = seen.artwork;
    var previousExplicit = seen.explicit;
    if (authoritative) {
      seen.title = t;
      seen.subtitle = s;
      seen.artwork = (meta && meta.artwork) || '';
    } else {
      if (t) {
        seen.title = t;
      }
      if (s) {
        seen.subtitle = s;
      }
      if (meta && meta.artwork) {
        seen.artwork = meta.artwork;
      }
    }
    if (meta && typeof meta.explicit === 'boolean') {
      seen.explicit = meta.explicit;
    }
    seen.entity = entity;
    if (related && related.length) {
      seen.related = related;
    }
    if (seen.dismissed) {
      return false;
    }
    if (seen.shownTitle !== null || seen.shownSubtitle !== null) {
      var textChanged = authoritative
        ? seen.title !== seen.shownTitle || seen.subtitle !== seen.shownSubtitle
        : (t && t !== seen.shownTitle) || (s && s !== seen.shownSubtitle);
      var visualChanged = seen.artwork !== previousArtwork || seen.explicit !== previousExplicit;
      var hostPresent = !!document.querySelector('.ralgrum-toast-host');
      if (textChanged || visualChanged || !hostPresent) {
        return showNow(seen, hostPresent);
      }
      return false;
    }
    if (authoritative && seen.title) {
      return showNow(seen);
    }
    if (seen.title && seen.subtitle) {
      armSettle(seen);
      return false;
    }
    armDeadline(seen, now);
    return false;
  }
  function showNow(seen, update) {
    clearSeenTimers(seen);
    if (!seen.title || seen.dismissed) {
      return false;
    }
    seen.shownTitle = seen.title;
    seen.shownSubtitle = seen.subtitle;
    if (update) {
      render(
        seen.entity,
        { title: seen.title, subtitle: seen.subtitle, artwork: seen.artwork, explicit: seen.explicit },
        seen.related,
        true
      );
      return true;
    }
    return show(
      seen.entity,
      { title: seen.title, subtitle: seen.subtitle, artwork: seen.artwork, explicit: seen.explicit },
      seen.related
    );
  }
  function armSettle(seen) {
    if (seen.settleTimer || seen.shownTitle !== null || seen.shownSubtitle !== null) {
      return;
    }
    clearDeadline(seen);
    seen.settleTimer = setTimeout(function () {
      seen.settleTimer = 0;
      if (seen.shownTitle === null && seen.shownSubtitle === null) {
        showNow(seen);
      }
    }, SETTLE_MS);
  }
  function armDeadline(seen, now) {
    if (seen.deadlineTimer || seen.shownTitle !== null || seen.shownSubtitle !== null) {
      return;
    }
    var wait = READY_DEADLINE_MS - (now - seen.firstSeen);
    if (wait < 0) {
      wait = 0;
    }
    seen.deadlineTimer = setTimeout(function () {
      seen.deadlineTimer = 0;
      if (seen.shownTitle === null && seen.shownSubtitle === null) {
        showNow(seen);
      }
    }, wait);
  }
  function clearSeenTimers(seen) {
    if (seen.settleTimer) {
      clearTimeout(seen.settleTimer);
      seen.settleTimer = 0;
    }
    clearDeadline(seen);
  }
  function clearDeadline(seen) {
    if (seen.deadlineTimer) {
      clearTimeout(seen.deadlineTimer);
      seen.deadlineTimer = 0;
    }
  }
  function clearAllTimers() {
    for (var k in SHOWN) {
      if (Object.prototype.hasOwnProperty.call(SHOWN, k)) {
        clearSeenTimers(SHOWN[k]);
      }
    }
  }
  function dismiss() {
    clearAllTimers();
    clearHost();
  }
  function resetForNavigation() {
    clearAllTimers();
    SHOWN = {};
    clearHost();
  }
  root.RalgrumToast = {
    show: show,
    showOncePerPage: showOncePerPage,
    showDialog: show,
    dismiss: dismiss,
    resetForNavigation: resetForNavigation,
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
