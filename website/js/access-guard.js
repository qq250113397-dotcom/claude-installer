(function (window, document) {
  var VERIFY_CACHE_MS = 12 * 60 * 60 * 1000;
  var style = document.createElement('style');
  style.textContent = 'html.cc-auth-checking body{visibility:hidden;}';
  document.head.appendChild(style);
  document.documentElement.classList.add('cc-auth-checking');

  function finish() {
    document.documentElement.classList.remove('cc-auth-checking');
  }

  function redirect(reason) {
    finish();
    var query = reason ? '?reason=' + encodeURIComponent(reason) : '';
    window.location.replace('unlock.html' + query);
  }

  var access = window.CC_ACCESS;
  if (!access) {
    redirect('missing_access_helper');
    return;
  }

  var record = access.readRecord();
  if (!record || access.isExpired(record)) {
    access.clearRecord();
    redirect('expired');
    return;
  }

  // 已经近期校验过的记录，直接放行，避免每次切页/刷新都弹出验证页。
  if (!access.shouldRefresh(record, VERIFY_CACHE_MS)) {
    finish();
    return;
  }

  // 先放行，再后台复验；只有明确失效时才踢回解锁页。
  finish();
  access.verify(record, 'check')
    .then(function (data) {
      if (data && data.ok) {
        access.writeRecord(record.card, {
          card: data.card || record.card,
          token: data.token || record.token,
          expiry: data.expiry || record.expiry,
          lastCheckedAt: Date.now()
        });
        return;
      }

      access.clearRecord();
      redirect('invalid');
    })
    .catch(function () {
      // 网络短抖时不打断使用，等下次再校验。
    });
})(window, document);
