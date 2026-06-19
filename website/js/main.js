// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
    }
  });
}

// Highlight active nav link
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === currentPage) a.classList.add('active');
});

// Copy buttons
document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var target = document.getElementById(btn.getAttribute('data-copy-target'));
    if (!target) return;
    var text = target.textContent.trim();
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = '已复制 ✓';
      setTimeout(function () { btn.textContent = orig; }, 2000);
    }).catch(function () {
      var r = document.createRange();
      r.selectNodeContents(target);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    });
  });
});

// Codex email capture / export helper
const CODEX_EMAILS_KEY = 'codexInviteEmails';

function normalizeEmail(value) {
  return String(value || '').trim();
}

function readSavedCodexEmails() {
  try {
    var raw = window.localStorage.getItem(CODEX_EMAILS_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function saveCodexEmails(entries) {
  try {
    window.localStorage.setItem(CODEX_EMAILS_KEY, JSON.stringify(entries));
  } catch (error) {}
}

function setCodexStatus(message, success) {
  document.querySelectorAll('[data-codex-email-status]').forEach(function (node) {
    node.textContent = message;
    node.classList.toggle('is-success', !!success);
    node.classList.toggle('is-muted', !success);
  });
}

function getCodexEmailRows() {
  return readSavedCodexEmails();
}

function buildCodexCsv(rows) {
  var lines = ['email,created_at,source_page'];
  rows.forEach(function (row) {
    lines.push([
      csvEscape(row.email),
      csvEscape(row.createdAt || ''),
      csvEscape(row.source || ''),
    ].join(','));
  });
  return lines.join('\n');
}

function csvEscape(value) {
  var text = String(value || '');
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function downloadTextFile(filename, text, mimeType) {
  var blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function syncCodexSummary() {
  var rows = getCodexEmailRows();
  var count = rows.length;
  document.querySelectorAll('[data-codex-email-count]').forEach(function (node) {
    node.textContent = String(count);
  });
  if (count === 0) {
    setCodexStatus('还没有收集到邮箱。', false);
  } else {
    setCodexStatus('已收集 ' + count + ' 个邮箱。你可以导出 CSV 后自己整理。', true);
  }
}

var savedCodexRows = readSavedCodexEmails();
if (savedCodexRows.length) {
  syncCodexSummary();
}

document.querySelectorAll('[data-codex-email-form]').forEach(function (form) {
  var input = form.querySelector('[data-codex-email-input]');
  if (input && savedCodexRows.length) {
    input.placeholder = '已收集 ' + savedCodexRows.length + ' 个邮箱，可继续新增';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = normalizeEmail(input && input.value);
    if (!email || !email.includes('@')) {
      setCodexStatus('请先填写一个有效的邮箱地址。', false);
      if (input) input.focus();
      return;
    }

    var rows = getCodexEmailRows();
    var exists = rows.some(function (row) { return row.email === email; });
    if (!exists) {
      rows.push({
        email: email,
        createdAt: new Date().toISOString(),
        source: window.location.pathname.split('/').pop() || 'step1-mobile.html',
      });
      saveCodexEmails(rows);
    }

    if (input) input.value = '';
    syncCodexSummary();
  });
});

document.querySelectorAll('[data-codex-copy-table]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var rows = getCodexEmailRows();
    if (!rows.length) {
      setCodexStatus('还没有可复制的表格，先收集一个邮箱。', false);
      return;
    }

    var csv = buildCodexCsv(rows);
    navigator.clipboard.writeText(csv).then(function () {
      setCodexStatus('表格已复制为 CSV，可直接粘贴到表格工具。', true);
    }).catch(function () {
      setCodexStatus('复制失败，你可以改用“导出 CSV”按钮下载文件。', false);
    });
  });
});

document.querySelectorAll('[data-codex-export-csv]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var rows = getCodexEmailRows();
    if (!rows.length) {
      setCodexStatus('还没有可导出的邮箱表格。', false);
      return;
    }

    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile('codex-emails-' + timestamp + '.csv', buildCodexCsv(rows), 'text/csv;charset=utf-8');
    setCodexStatus('CSV 已导出。你可以用 Excel / Numbers / Google Sheets 打开。', true);
  });
});

syncCodexSummary();

// Soft modal for quick-start guidance
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    openModal(btn.getAttribute('data-open-modal'));
  });
});

document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    closeModal(btn.closest('.modal-backdrop'));
  });
});

document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) {
      closeModal(backdrop);
    }
  });
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-backdrop.open').forEach(function (modal) {
    closeModal(modal);
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
