(function (window) {
  var WORKER_URL = 'https://verify-card.qq250113397.workers.dev/verify';
  var LS_KEY = 'cc_unlock';
  var VERIFY_CACHE_MS = 12 * 60 * 60 * 1000;

  function normalizeCard(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[‐‑‒–—―]/g, '-')
      .replace(/\s+/g, '');
  }

  function readRecord() {
    try {
      var record = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!record || !record.card || !record.token || !record.expiry) return null;
      return {
        card: normalizeCard(record.card),
        token: String(record.token),
        expiry: Number(record.expiry),
        lastCheckedAt: Number(record.lastCheckedAt || record.unlockedAt || 0)
      };
    } catch (e) {
      return null;
    }
  }

  function writeRecord(card, data) {
    var record = {
      card: normalizeCard(data.card || card),
      token: data.token,
      expiry: data.expiry,
      unlockedAt: Date.now(),
      lastCheckedAt: Number(data.lastCheckedAt || Date.now())
    };
    localStorage.setItem(LS_KEY, JSON.stringify(record));
    return record;
  }

  function clearRecord() {
    localStorage.removeItem(LS_KEY);
  }

  function isExpired(record) {
    return !record || !record.expiry || Date.now() > record.expiry;
  }

  function shouldRefresh(record, maxAgeMs) {
    if (!record) return true;
    var age = Date.now() - Number(record.lastCheckedAt || 0);
    if (!Number.isFinite(age)) return true;
    return age >= (maxAgeMs || VERIFY_CACHE_MS);
  }

  function verify(record, mode) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;

    return fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card: record.card,
        token: record.token || null,
        mode: mode || 'check'
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json();
    }, function (error) {
      if (timer) clearTimeout(timer);
      throw error;
    });
  }

  window.CC_ACCESS = {
    storageKey: LS_KEY,
    workerUrl: WORKER_URL,
    normalizeCard: normalizeCard,
    readRecord: readRecord,
    writeRecord: writeRecord,
    clearRecord: clearRecord,
    isExpired: isExpired,
    shouldRefresh: shouldRefresh,
    verify: verify
  };
})(window);
