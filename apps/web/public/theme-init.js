try {
  var stored = localStorage.getItem('linksight-color-scheme');
  if (stored === 'light' || stored === 'dark') {
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', stored);
    }
    var tint = stored === 'dark' ? '#111722' : '#ffffff';
    var themeMetas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < themeMetas.length; i++) {
      themeMetas[i].setAttribute('content', tint);
    }
  }
} catch (_e) {}
