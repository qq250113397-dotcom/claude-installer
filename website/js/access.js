(function (window) {
  var LS_KEY = 'cc_unlock';
  var VERIFY_CACHE_MS = 12 * 60 * 60 * 1000;
  var FALLBACK_VERIFY_URL = 'https://verify-card.qq250113397.workers.dev/verify';
  var LOCAL_DEV_TOK = 'local-dev-access';

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

  function isLocalDev() {
    try {
      var host = window.location && window.location.hostname ? window.location.hostname : '';
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch (e) {
      return false;
    }
  }

  function resolveVerifyUrl() {
    try {
      var origin = window.location && window.location.origin ? window.location.origin : '';
      if (!origin || origin === 'null' || origin.indexOf('127.0.0.1') !== -1 || origin.indexOf('localhost') !== -1) {
        return FALLBACK_VERIFY_URL;
      }
      return origin + '/verify';
    } catch (e) {
      return FALLBACK_VERIFY_URL;
    }
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
    if (isLocalDev()) {
      return Promise.resolve({
        ok: true,
        card: normalizeCard(record && record.card ? record.card : 'LOCAL-DEV'),
        token: LOCAL_DEV_TOK,
        expiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    }

    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;

    return fetch(resolveVerifyUrl(), {
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
    workerUrl: resolveVerifyUrl(),
    normalizeCard: normalizeCard,
    readRecord: readRecord,
    writeRecord: writeRecord,
    clearRecord: clearRecord,
    isLocalDev: isLocalDev,
    isExpired: isExpired,
    shouldRefresh: shouldRefresh,
    verify: verify,
    resolveVerifyUrl: resolveVerifyUrl
  };
})(window);
