// Dev-only metrics harness. Loads the popup or options page in an iframe
// (?page=popup|options), reads real computed styles, and exfils them via
// document.title for headless --dump-dom verification.
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var page = params.get('page') || 'popup';
  var src = page === 'options'
    ? '../../extension/options/options.html'
    : '../../extension/popup/popup.html';
  var frame = document.createElement('iframe');
  frame.style.width = page === 'options' ? '620px' : '360px';
  frame.style.height = page === 'options' ? '900px' : '500px';
  frame.style.border = 'none';
  document.body.appendChild(frame);
  function css(el, props) {
    var out = {};
    if (!el) {
      return out;
    }
    var cs = getComputedStyle(el);
    props.forEach(function (p) {
      out[p] = cs[p];
    });
    return out;
  }
  function rect(el) {
    if (!el) {
      return null;
    }
    var r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  frame.addEventListener('load', function () {
    setTimeout(function () {
      var out = { page: page };
      try {
        var d = frame.contentDocument;
        out.bodyBg = css(d.body, ['backgroundColor']);
        out.wrapPad = css(d.querySelector('.set-wrap'), ['padding']);
        out.title = css(d.querySelector('.set-title'), ['fontSize', 'fontWeight', 'color']);
        out.copy = css(d.querySelector('.set-copy'), ['fontSize', 'color', 'lineHeight']);
        out.titleText = d.querySelector('.set-title').textContent;
        var card = d.querySelector('.set-card');
        out.card = css(card, ['backgroundColor', 'borderColor', 'borderRadius', 'padding']);
        out.cardhead = css(d.querySelector('.set-cardhead'), ['fontSize', 'fontWeight', 'color']);
        out.rows = d.querySelectorAll('.set-row').length;
        var row = d.querySelector('.set-row');
        out.rowMinH = css(row, ['minHeight']);
        out.label = css(d.querySelector('.set-row-label'), ['fontSize', 'fontWeight', 'color', 'lineHeight']);
        out.desc = css(d.querySelector('.set-row-desc'), ['fontSize', 'color']);
        var sw = d.querySelector('.switch');
        sw.style.transition = 'none';
        sw.checked = true;
        out.switchOn = css(sw, ['backgroundColor', 'borderColor', 'width', 'height']);
        sw.checked = false;
        out.switchOff = css(sw, ['backgroundColor']);
        var divider = d.querySelector('.set-row:not(:last-child)');
        out.divider = divider ? css(divider, ['borderBottomColor', 'borderBottomWidth']) : null;
        out.saveButton = !!d.querySelector('button.primary');
        out.testLinks = d.querySelectorAll('a[href^="ralgrum://"]').length;
      } catch (e) {
        out.error = String(e);
      }
      document.title = 'METRICS:' + JSON.stringify(out);
    }, 700);
  });
  frame.src = src;
})();
