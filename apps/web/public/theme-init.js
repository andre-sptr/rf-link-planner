try {
  var stored = localStorage.getItem('linksight-color-scheme');
  if (stored === 'light' || stored === 'dark') {
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', stored);
    }
  }
} catch (_e) {}
