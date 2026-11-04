/* Runs in <head>, before the page is drawn: when the visitor chose Chinese, keep the page hidden until
   i18n.js has put the Chinese text in place, so English never flashes. A timer shows the page regardless. */
(function () {
  try {
    var q = new URLSearchParams(location.search).get('lang');
    var lang = q || localStorage.getItem('maohan-lang');
    if (lang === 'zh') {
      var html = document.documentElement;
      html.classList.add('i18n-pending', 'lang-zh');
      html.lang = 'zh-CN';
      setTimeout(function () { html.classList.remove('i18n-pending'); }, 2500);
    }
  } catch (e) { /* storage unavailable: English */ }
})();
