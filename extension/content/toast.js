// RalgrumToast: top right toast and dialog in ralgruM style using Shadow DOM.
// Colors match the ralgruM GPUI theme (src/ui/theme.rs and src/ui/toast.rs).
// No chrome APIs required here, background handles protocol navigation.
(function (root) {
  'use strict';
  var COLORS = {
    background: '#09090b',
    surface: '#121215',
    surfaceOverlay: '#121215fc',
    border: '#27272a',
    foreground: '#fafafa',
    muted: '#a1a1aa',
    primary: '#6366f1',
    deezer: '#a238ff',
    soundcloud: '#ff5500'
  };
  var SHOWN_KEYS = {};
  var STATE = { minimized: false, lastEntity: null, lastMeta: null };

  function providerColor(provider) {
    if (provider === 'deezer') {
      return COLORS.deezer;
    }
    if (provider === 'soundcloud') {
      return COLORS.soundcloud;
    }
    return COLORS.primary;
  }

  function providerLabel(provider) {
    if (provider === 'deezer') {
      return 'Deezer';
    }
    if (provider === 'soundcloud') {
      return 'SoundCloud';
    }
    return 'ralgruM';
  }

  function typeLabel(type) {
    if (type === 'track') {
      return 'Track';
    }
    if (type === 'album') {
      return 'Album';
    }
    if (type === 'playlist') {
      return 'Playlist';
    }
    if (type === 'artist') {
      return 'Artist';
    }
    return 'Page';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function removeHost() {
    var host = document.querySelector('.ralgrum-toast-host');
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    var pill = document.querySelector('.ralgrum-toast-pill');
    if (pill && pill.parentNode) {
      pill.parentNode.removeChild(pill);
    }
  }

  function primaryLabelFor(entity) {
    if (!entity) {
      return 'Open in ralgruM';
    }
    if (entity.type === 'track') {
      return 'Play in ralgruM';
    }
    return 'Open in ralgruM';
  }

  function buildRalgrumUrl(entity, action) {
    if (root.RalgrumDetectors && root.RalgrumDetectors.buildRalgrumUrl) {
      return root.RalgrumDetectors.buildRalgrumUrl(entity, { action: action });
    }
    var p = new URLSearchParams();
    p.set('provider', entity.provider);
    p.set('type', entity.type);
    if (entity.id) {
      p.set('id', entity.id);
    }
    p.set('action', action || 'open');
    p.set('url', entity.url);
    return 'ralgrum://open?' + p.toString();
  }

  function openInRalgrum(entity, action) {
    var url = buildRalgrumUrl(entity, action);
    if (!url) {
      return;
    }
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
        if (done) {
          done(true);
        }
      } catch (e) {
        if (done) {
          done(false);
        }
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        if (done) {
          done(true);
        }
      }, fallback);
    } else {
      fallback();
    }
  }

  function relatedLinks(entity, related) {
    if (!related || related.length === 0) {
      return '';
    }
    var items = related.slice(0, 3).map(function (rel) {
      var url = buildRalgrumUrl(rel, rel.type === 'track' ? 'play' : 'open');
      return '<button class="rg-link" data-rg-url="' + esc(url) + '">'
        + esc(typeLabel(rel.type)) + ': ' + esc(rel.title || rel.id || rel.url)
        + '</button>';
    });
    return '<div class="rg-related">' + items.join('') + '</div>';
  }

  function render(entity, meta, related) {
    removeHost();
    var host = ensureHost();
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var accent = providerColor(entity.provider);
    var title = (meta && meta.title) || entity.title || (providerLabel(entity.provider) + ' ' + typeLabel(entity.type));
    var subtitle = (meta && meta.subtitle) || entity.url;
    var artwork = (meta && meta.artwork) || '';
    var primaryLabel = primaryLabelFor(entity);
    var primaryAction = entity.type === 'track' ? 'play' : 'open';
    var primaryUrl = buildRalgrumUrl(entity, primaryAction);
    var style = ''
      + '.rg-card{width:340px;max-width:calc(100vw - 32px);background:' + COLORS.surfaceOverlay + ';'
      + 'border:1px solid ' + COLORS.border + ';border-radius:12px;color:' + COLORS.foreground + ';'
      + 'font-family:"Segoe UI",system-ui,-apple-system,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.55);'
      + 'overflow:hidden;animation:rg-in .22s ease-out}'
      + '@keyframes rg-in{from{transform:translateX(16px);opacity:0}to{transform:none;opacity:1}}'
      + '.rg-top{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid ' + COLORS.border + ';}'
      + '.rg-dot{width:10px;height:10px;border-radius:999px;background:' + COLORS.primary + ';}'
      + '.rg-brand{font-size:12px;font-weight:700;letter-spacing:.04em;}'
      + '.rg-badge{margin-left:auto;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;color:#fff;background:' + accent + ';}'
      + '.rg-type{font-size:11px;color:' + COLORS.muted + ';border:1px solid ' + COLORS.border + ';padding:3px 8px;border-radius:999px;}'
      + '.rg-close{border:1px solid ' + COLORS.border + ';background:transparent;color:' + COLORS.muted + ';'
      + 'width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px;line-height:1;}'
      + '.rg-close:hover{color:' + COLORS.foreground + ';border-color:' + COLORS.primary + ';}'
      + '.rg-body{display:flex;gap:12px;padding:12px;}'
      + '.rg-art{width:56px;height:56px;border-radius:8px;object-fit:cover;background:' + COLORS.background + ';border:1px solid ' + COLORS.border + ';flex:none;}'
      + '.rg-art-fallback{width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,' + accent + ',' + COLORS.primary + ');'
      + 'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;color:#fff;flex:none;}'
      + '.rg-title{font-size:14px;font-weight:650;margin:0 0 4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}'
      + '.rg-sub{font-size:12.5px;color:' + COLORS.muted + ';margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}'
      + '.rg-actions{display:flex;gap:8px;padding:0 12px 10px;}'
      + '.rg-primary{flex:1;height:32px;border-radius:8px;border:1px solid ' + COLORS.primary + ';background:' + COLORS.primary + ';color:#fff;'
      + 'font-size:13px;font-weight:700;cursor:pointer;}'
      + '.rg-primary:hover{filter:brightness(1.08);}'
      + '.rg-secondary{height:32px;border-radius:8px;border:1px solid ' + COLORS.border + ';background:transparent;color:' + COLORS.foreground + ';'
      + 'font-size:12.5px;font-weight:600;padding:0 10px;cursor:pointer;}'
      + '.rg-secondary:hover{border-color:' + COLORS.primary + ';}'
      + '.rg-related{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px;}'
      + '.rg-link{font-size:11.5px;color:' + COLORS.foreground + ';background:transparent;border:1px solid ' + COLORS.border + ';'
      + 'border-radius:999px;padding:4px 9px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.rg-link:hover{border-color:' + accent + ';}'
      + '.rg-foot{padding:0 12px 12px;font-size:11px;color:' + COLORS.muted + ';}';
    var artHtml = artwork
      ? '<img class="rg-art" src="' + esc(artwork) + '" alt="" />'
      : '<div class="rg-art-fallback">R</div>';
    var html = ''
      + '<style>' + style + '</style>'
      + '<div class="rg-card" role="dialog" aria-label="Open in ralgruM">'
      + '<div class="rg-top"><span class="rg-dot"></span><span class="rg-brand">ralgruM</span>'
      + '<span class="rg-badge">' + esc(providerLabel(entity.provider)) + '</span>'
      + '<span class="rg-type">' + esc(typeLabel(entity.type)) + '</span>'
      + '<button class="rg-close" data-rg-act="close" aria-label="Dismiss">x</button></div>'
      + '<div class="rg-body">' + artHtml
      + '<div><p class="rg-title">' + esc(title) + '</p><p class="rg-sub">' + esc(subtitle) + '</p></div></div>'
      + '<div class="rg-actions">'
      + '<button class="rg-primary" data-rg-act="primary">' + esc(primaryLabel) + '</button>'
      + '<button class="rg-secondary" data-rg-act="copy">Copy link</button>'
      + '<button class="rg-secondary" data-rg-act="min">Later</button>'
      + '</div>'
      + relatedLinks(entity, related)
      + '<div class="rg-foot">Opens directly in your ralgruM desktop app.</div>'
      + '</div>';
    if (shadow.innerHTML !== undefined) {
      shadow.innerHTML = html;
    } else {
      host.innerHTML = html;
    }
    function onClick(ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) {
        return;
      }
      if (t.getAttribute('data-rg-url')) {
        var u = t.getAttribute('data-rg-url');
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'RALGRUM_OPEN', url: u });
          } else {
            window.location.href = u;
          }
        } catch (e) {
          window.location.href = u;
        }
        return;
      }
      var act = t.getAttribute('data-rg-act');
      if (act === 'close') {
        removeHost();
      } else if (act === 'min') {
        showPill(entity, meta, related);
      } else if (act === 'primary') {
        openInRalgrum(entity, primaryAction);
      } else if (act === 'copy') {
        copyText(primaryUrl, function (ok) {
          t.textContent = ok ? 'Copied' : 'Copy failed';
          setTimeout(function () { t.textContent = 'Copy link'; }, 1400);
        });
      }
    }
    var container = shadow.querySelector ? shadow : host;
    if (container.addEventListener) {
      container.addEventListener('click', onClick);
    } else {
      host.addEventListener('click', onClick);
    }
  }

  function showPill(entity, meta, related) {
    removeHost();
    var pill = document.createElement('div');
    pill.className = 'ralgrum-toast-pill';
    var shadow = pill.attachShadow ? pill.attachShadow({ mode: 'open' }) : pill;
    var accent = providerColor(entity.provider);
    var style = ''
      + '.rg-pill{display:flex;align-items:center;gap:8px;background:' + COLORS.surfaceOverlay + ';'
      + 'border:1px solid ' + COLORS.border + ';border-radius:999px;padding:7px 8px 7px 10px;color:' + COLORS.foreground + ';'
      + 'font-family:"Segoe UI",system-ui,sans-serif;font-size:12.5px;font-weight:650;cursor:pointer;'
      + 'box-shadow:0 8px 28px rgba(0,0,0,.5);}'
      + '.rg-pill-dot{width:9px;height:9px;border-radius:999px;background:' + accent + ';}'
      + '.rg-pill-x{border:1px solid ' + COLORS.border + ';background:transparent;color:' + COLORS.muted + ';'
      + 'border-radius:999px;width:22px;height:22px;cursor:pointer;font-size:12px;}';
    var html = '<style>' + style + '</style>'
      + '<div class="rg-pill" role="button" aria-label="Show ralgruM actions">'
      + '<span class="rg-pill-dot"></span><span>Open in ralgruM</span>'
      + '<button class="rg-pill-x" data-rg-act="x" aria-label="Dismiss">x</button></div>';
    if (shadow.innerHTML !== undefined) {
      shadow.innerHTML = html;
    } else {
      pill.innerHTML = html;
    }
    document.documentElement.appendChild(pill);
    var container = shadow.querySelector ? shadow : pill;
    container.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-rg-act') === 'x') {
        ev.stopPropagation();
        removeHost();
        return;
      }
      render(entity, meta, related);
    });
  }

  function show(entity, meta, related) {
    if (!entity) {
      return false;
    }
    STATE.lastEntity = entity;
    STATE.lastMeta = meta || null;
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

  function resetForNavigation() {
    removeHost();
  }

  root.RalgrumToast = {
    show: show,
    showOncePerPage: showOncePerPage,
    showPill: showPill,
    dismiss: removeHost,
    resetForNavigation: resetForNavigation,
    colors: COLORS
  };
})(typeof window !== 'undefined' ? window : globalThis);
