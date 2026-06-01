(function (window, document) {
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
