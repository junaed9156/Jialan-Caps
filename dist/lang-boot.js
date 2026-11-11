/* English lives at /, Chinese at /zh (a pre-translated page, so it never flashes English).
   An older ?lang=zh link is sent to /zh; until it moves, that page stays hidden briefly. */
(function () {
  var html = document.documentElement;
  // The inline illustration is already visible. Never blank the hero while WebGL loads.
  try {
    if (html.dataset && html.dataset.lang === 'zh') { html.classList.add('lang-zh'); html.lang = 'zh-CN'; return; }
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh') {
      html.classList.add('i18n-pending', 'lang-zh');
      html.lang = 'zh-CN';
      setTimeout(function () { html.classList.remove('i18n-pending'); }, 2500);
      if (typeof location.replace === 'function' && location.href) location.replace(new URL('zh' + (location.hash || ''), location.href).href);
    }
  } catch (e) { /* storage unavailable: English */ }
})();
