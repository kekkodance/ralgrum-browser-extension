// Driver for toast-preview.html. Pick view with ?view=toast or ?view=dialog.
(function () {
  'use strict';
  var ART = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#18181b"/></svg>');
  var params = new URLSearchParams(location.search);
  var view = params.get('view') || 'toast';
  function demoToast() {
    return RalgrumToast.show(
      { provider: 'deezer', type: 'track', id: '3135556', url: 'https://www.deezer.com/track/3135556' },
      { title: 'Harder Better Faster Stronger', subtitle: 'Daft Punk - Discovery' },
      [
        { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127', title: 'Discovery' },
        { provider: 'deezer', type: 'artist', id: '27', url: 'https://www.deezer.com/artist/27', title: 'Daft Punk' }
      ]
    );
  }
  if (view === 'metrics') {
    demoToast();
    setTimeout(function () {
      var out = {};
      try {
        var host = document.querySelector('.ralgrum-toast-host');
        var shadow = host.shadowRoot;
        var card = shadow.querySelector('.rg-card');
        var cs = getComputedStyle(card);
        var cr = card.getBoundingClientRect();
        out.card = { w: cr.width, h: cr.height, bg: cs.backgroundColor, border: cs.borderColor, radius: cs.borderRadius, padding: cs.padding, shadow: cs.boxShadow };
        var stack = shadow.querySelector('.rg-stack');
        out.stack = { w: stack.getBoundingClientRect().width };
        var title = shadow.querySelector('.rg-title');
        var ts = getComputedStyle(title);
        out.title = { size: ts.fontSize, weight: ts.fontWeight, color: ts.color, family: ts.fontFamily };
        var desc = shadow.querySelector('.rg-desc');
        var ds = getComputedStyle(desc);
        out.desc = { size: ds.fontSize, color: ds.color };
        var btn = shadow.querySelector('.rg-btn');
        var bs = getComputedStyle(btn);
        out.btn = { h: btn.getBoundingClientRect().height, bg: bs.backgroundColor, border: bs.borderColor, radius: bs.borderRadius, size: bs.fontSize, weight: bs.fontWeight };
        var glyph = shadow.querySelector('.rg-glyph svg');
        var gr = glyph.getBoundingClientRect();
        out.glyph = { w: gr.width, h: gr.height };
        out.buttons = shadow.querySelectorAll('.rg-btn').length;
      } catch (e) {
        out.error = String(e);
      }
      document.title = 'METRICS:' + JSON.stringify(out);
    }, 600);
    return;
  }
  if (view === 'dialog') {
    RalgrumToast.showDialog([
      { entity: { provider: 'deezer', type: 'track', id: '3135556', url: 'https://www.deezer.com/track/3135556' }, title: 'Harder Better Faster Stronger', artwork: ART },
      { entity: { provider: 'deezer', type: 'album', id: '302127', url: 'https://www.deezer.com/album/302127' }, title: 'Discovery', artwork: ART },
      { entity: { provider: 'deezer', type: 'artist', id: '27', url: 'https://www.deezer.com/artist/27' }, title: 'Daft Punk', artwork: ART }
    ]);
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
