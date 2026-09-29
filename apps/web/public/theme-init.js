// Sets the theme before the first paint so a dark window never flashes light.
// A file rather than an inline script: the CSP allows only 'self' scripts.
// Keep the storage key and values in sync with ThemeProvider.
;(function () {
  try {
    var t = localStorage.getItem('theme') || 'system'
    var dark =
      t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
