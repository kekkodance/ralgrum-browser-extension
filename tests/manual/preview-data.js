// Driver for toast-preview.html. Pick view with ?view=toast or ?view=dialog.
// Dev preview only: stub the extension runtime so the real app logo
// resolves under file://. Production always has chrome.runtime.getURL.
(function () {
  'use strict';
  try {
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {};
    if (!window.chrome.runtime.getURL) {
      window.chrome.runtime.getURL = function (p) { return '../../extension/' + p; };
    }
  } catch (e) {
    // ignore
  }
  var ART = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#18181b"/></svg>');
  var params = new URLSearchParams(location.search);
  var view = params.get('view') || 'toast';
  function demoToast() {
    var noSub = params.get('nosub') === '1';
    return RalgrumToast.show(
      { provider: 'deezer', type: 'track', id: '3135556', url: 'https://www.deezer.com/track/3135556' },
      { title: 'Harder Better Faster Stronger', subtitle: noSub ? '' : 'Daft Punk - Discovery', artwork: ART },
      [
        { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127', title: 'Discovery' },
        { provider: 'deezer', type: 'artist', id: '27', url: 'https://www.deezer.com/artist/27', title: 'Daft Punk' }
      ]
    );
  }
  if (view === 'metrics') {
    var center = params.get('center') || 'track';
    if (center === 'collection') {
      RalgrumToast.show(
        { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127' },
        { title: 'Discovery', subtitle: 'Daft Punk - 2001', artwork: ART },
        []
      );
    } else if (center === 'artist') {
      RalgrumToast.show(
        { provider: 'deezer', type: 'artist', id: '27', url: 'https://www.deezer.com/artist/27' },
        { title: 'Daft Punk', subtitle: '12 fans', artwork: ART },
        []
      );
    } else {
      demoToast();
    }
    setTimeout(function () {
      var out = { mode: params.get('center') || 'track' };
      try {
        var host = document.querySelector('.ralgrum-toast-host');
        var shadow = host.shadowRoot;
        function css(sel, props) {
          var el = shadow.querySelector(sel);
          var r = {};
          if (!el) {
            return r;
          }
          var cs = getComputedStyle(el);
          props.forEach(function (p) {
            r[p] = cs[p];
          });
          return r;
        }
        function rr(sel) {
          var el = shadow.querySelector(sel);
          if (!el) {
            return null;
          }
          var b = el.getBoundingClientRect();
          return { w: b.width, h: b.height };
        }
        var card = shadow.querySelector('.rg-card');
        var cc = getComputedStyle(card);
        out.card = { bg: cc.backgroundColor, border: cc.borderColor, radius: cc.borderRadius, shadow: cc.boxShadow };
        out.stack = rr('.rg-stack');
        var logo = shadow.querySelector('.rg-logo');
        out.logo = rr('.rg-logo');
        out.logoSrc = logo ? String(logo.src).slice(-22) : null;
        out.brand = css('.rg-brand', ['fontSize', 'fontWeight', 'color']);
        out.x = rr('.rg-x');
        out.xBorder = css('.rg-x', ['borderColor', 'borderRadius']);
        var xg = shadow.querySelector('.rg-x-idle svg');
        out.xGlyph = xg ? rr('.rg-x-idle svg') : null;
        out.centerMode = out.mode;
        if (out.mode === 'collection' || out.mode === 'artist') {
          out.hart = rr('.rg-hart');
          out.htitle = css('.rg-htitle', ['fontSize', 'fontWeight', 'lineHeight', 'color']);
          out.hmeta = css('.rg-hmeta', ['fontSize', 'color']);
          out.provlabel = css('.rg-provlabel', ['fontSize', 'fontWeight', 'color']);
        } else {
          out.art = rr('.rg-art');
          out.ttitle = css('.rg-ttitle', ['fontSize', 'fontWeight', 'color']);
          out.tartist = css('.rg-tartist', ['fontSize', 'color']);
          out.trow = css('.rg-trow', ['borderRadius']);
          out.trowRect = rr('.rg-trow');
          var pg = shadow.querySelector('.rg-prov svg');
          out.provGlyph = pg ? { w: pg.getBoundingClientRect().width, h: pg.getBoundingClientRect().height } : null;
        }
        out.primary = css('.rg-primary', ['backgroundColor', 'borderColor', 'borderRadius', 'fontSize', 'fontWeight']);
        out.primaryRect = rr('.rg-primary');
        var secs = shadow.querySelectorAll('.rg-secondary');
        out.secondaries = secs.length;
        out.primaryText = shadow.querySelector('.rg-primary').textContent;
        out.artistPresent = !!shadow.querySelector('.rg-tartist');
        out.xSize = css('.rg-x', ['width', 'height']);
        var xg2 = shadow.querySelector('.rg-x svg');
        out.xGlyph2 = xg2 ? { w: xg2.getBoundingClientRect().width, h: xg2.getBoundingClientRect().height } : null;
        out.rowBadge = (function () {
          var g = shadow.querySelector('.rg-prov svg');
          return g ? { w: g.getBoundingClientRect().width, h: g.getBoundingClientRect().height } : null;
        })();
      } catch (e) {
        out.error = String(e);
      }
      document.title = 'METRICS:' + JSON.stringify(out);
    }, 600);
    return;
  }
  if (view === 'dialog') {
    RalgrumToast.show(
      { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127' },
      { title: 'Discovery', subtitle: 'Daft Punk - 2001', artwork: ART },
      []
    );
    return;
  }
  RalgrumToast.show(
    { provider: 'deezer', type: 'track', id: '3135556', url: 'https://www.deezer.com/track/3135556' },
    { title: 'Harder Better Faster Stronger', subtitle: 'Daft Punk - Discovery' },
    [
      { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127', title: 'Discovery' },
      { provider: 'deezer', type: 'artist', id: '27', url: 'https://www.deezer.com/artist/27', title: 'Daft Punk' }
    ]
  );
})();
