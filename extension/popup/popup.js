// Popup: parses the active tab URL locally, builds a ralgrum:// link.
(function () {
  'use strict';
  function parseDeezer(url) {
    var m = String(url || '').match(/deezer\.com(?:\.[a-z]{2})?\/[a-z-]*\/?(track|album|playlist|artist)\/(\d+)/i);
    if (!m || !m[2] || m[2] === '0') {
      return null;
    }
    return { provider: 'deezer', type: m[1].toLowerCase(), id: m[2], url: String(url) };
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
  function build(entity) {
    var act = entity.type === 'track' ? 'play' : 'open';
    var p = new URLSearchParams();
    p.set('provider', entity.provider);
    p.set('type', entity.type);
    if (entity.id) {
      p.set('id', entity.id);
    }
    p.set('action', act);
    p.set('url', entity.url);
    return { link: 'ralgrum://open?' + p.toString(), action: act };
  }
  function setStatus(msg) {
    document.getElementById('status').textContent = msg || '';
  }
  function run(tabUrl) {
    var entity = parseDeezer(tabUrl) || parseSoundcloud(tabUrl);
    var badge = document.getElementById('provider');
    var title = document.getElementById('title');
    var sub = document.getElementById('sub');
    var openBtn = document.getElementById('open');
    var copyBtn = document.getElementById('copy');
    var copyOrig = document.getElementById('copyOrig');
    if (!entity) {
      badge.textContent = 'no match';
      title.textContent = 'Not a supported page';
      sub.textContent = 'Open a Deezer or SoundCloud track, album, playlist, or artist page.';
      setStatus('Nothing to send to ralgruM from this tab.');
      return;
    }
    var built = build(entity);
    badge.textContent = entity.provider === 'deezer' ? 'Deezer' : 'SoundCloud';
    badge.className = 'badge ' + entity.provider;
    title.textContent = entity.type.charAt(0).toUpperCase() + entity.type.slice(1) + (entity.id ? ' ' + entity.id : '');
    sub.textContent = tabUrl;
    openBtn.disabled = false;
    copyBtn.disabled = false;
    copyOrig.disabled = false;
    openBtn.textContent = built.action === 'play' ? 'Play in ralgruM' : 'Open in ralgruM';
    openBtn.onclick = function () {
      var api = (typeof chrome !== 'undefined' && chrome.tabs) ? chrome.tabs : (typeof browser !== 'undefined' ? browser.tabs : null);
      if (api) {
        api.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs && tabs[0] && tabs[0].id != null) {
            api.update(tabs[0].id, { url: built.link });
          } else {
            window.open(built.link, '_self');
          }
        });
      } else {
        window.open(built.link, '_self');
      }
      setStatus('Sent to ralgruM. If nothing happens, register the protocol (see README).');
    };
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(built.link).then(function () {
        setStatus('ralgruM link copied.');
      }, function () {
        setStatus('Copy failed in this browser.');
      });
    };
    copyOrig.onclick = function () {
      navigator.clipboard.writeText(tabUrl).then(function () {
        setStatus('Original link copied.');
      }, function () {
        setStatus('Copy failed in this browser.');
      });
    };
    setStatus('Ready: ' + built.link.slice(0, 90) + (built.link.length > 90 ? '...' : ''));
  }
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var api = (typeof chrome !== 'undefined' && chrome.tabs) ? chrome.tabs : (typeof browser !== 'undefined' ? browser.tabs : null);
      if (api) {
        api.query({ active: true, currentWindow: true }, function (tabs) {
          run(tabs && tabs[0] ? tabs[0].url : '');
        });
      } else {
        run(window.location.href);
      }
    } catch (e) {
      run('');
    }
  });
})();
