(function (window, document) {
  var ADMIN_TOKEN = 'lbenben2025';
  var ADMIN_LS_KEY = 'cc_admin';

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

  // 管理员通道：URL hash 为 #admin-<token> 时设置永久标记后跳过验证
  if (window.location.hash === '#admin-' + ADMIN_TOKEN) {
    localStorage.setItem(ADMIN_LS_KEY, '1');
    history.replaceState(null, '', window.location.pathname);
    finish();
    return;
  }
  if (localStorage.getItem(ADMIN_LS_KEY) === '1') {
    finish();
    return;
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

  access.verify(record, 'check')
    .then(function (data) {
      if (data && data.ok) {
        access.writeRecord(record.card, data);
        finish();
        return;
      }

      access.clearRecord();
      redirect('invalid');
    })
    .catch(function () {
      redirect('network');
    });
})(window, document);
