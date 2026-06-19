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

// Codex email capture / copy helper
const CODEX_EMAIL_KEY = 'codexInviteEmail';

function normalizeEmail(value) {
  return String(value || '').trim();
}

function readSavedCodexEmail() {
  try {
    return normalizeEmail(window.localStorage.getItem(CODEX_EMAIL_KEY));
  } catch (error) {
    return '';
  }
}

function saveCodexEmail(email) {
  try {
    window.localStorage.setItem(CODEX_EMAIL_KEY, email);
  } catch (error) {}
}

function setCodexEmailDisplays(email) {
  var text = email || '还没有留下邮箱';
  document.querySelectorAll('[data-codex-email-display]').forEach(function (node) {
    node.textContent = text;
  });
}

function setCodexStatus(message, success) {
  document.querySelectorAll('[data-codex-email-status]').forEach(function (node) {
    node.textContent = message;
    node.classList.toggle('is-success', !!success);
    node.classList.toggle('is-muted', !success);
  });
}

function copyCodexEmail(email) {
  if (!email) return Promise.reject(new Error('missing email'));
  return navigator.clipboard.writeText(email);
}

var savedCodexEmail = readSavedCodexEmail();
setCodexEmailDisplays(savedCodexEmail);
if (savedCodexEmail) {
  setCodexStatus('已保存：' + savedCodexEmail + '。点击“复制邮箱”即可去官方邀请入口手动填写。', true);
}

document.querySelectorAll('[data-codex-email-form]').forEach(function (form) {
  var input = form.querySelector('[data-codex-email-input]');
  if (input && savedCodexEmail) {
    input.value = savedCodexEmail;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = normalizeEmail(input && input.value);
    if (!email || !email.includes('@')) {
      setCodexStatus('请先填写一个有效的邮箱地址。', false);
      if (input) input.focus();
      return;
    }

    saveCodexEmail(email);
    savedCodexEmail = email;
    setCodexEmailDisplays(email);

    copyCodexEmail(email).then(function () {
      setCodexStatus('已保存并复制：' + email + '。你可以直接去官方邀请入口粘贴。', true);
    }).catch(function () {
      setCodexStatus('已保存：' + email + '。复制失败时可以手动复制后再去官方邀请入口。', true);
    });
  });
});

document.querySelectorAll('[data-codex-copy-email]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var email = savedCodexEmail || '';
    if (!email) {
      var input = document.querySelector('[data-codex-email-input]');
      email = normalizeEmail(input && input.value);
    }

    if (!email || !email.includes('@')) {
      setCodexStatus('还没有可复制的邮箱，先在上方填一个。', false);
      var focusInput = document.querySelector('[data-codex-email-input]');
      if (focusInput) focusInput.focus();
      return;
    }

    copyCodexEmail(email).then(function () {
      setCodexStatus('邮箱已复制：' + email + '。', true);
    }).catch(function () {
      setCodexStatus('复制失败，你可以手动选中邮箱内容再去官方邀请入口。', false);
    });
  });
});

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
