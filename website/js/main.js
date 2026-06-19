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

// Codex email capture helper
const CODEX_EMAIL_ENDPOINT = 'https://codex-email-leads.qq250113397.workers.dev/';

function normalizeEmail(value) {
  return String(value || '').trim();
}

function setCodexStatus(message, success) {
  document.querySelectorAll('[data-codex-email-status]').forEach(function (node) {
    node.textContent = message;
    node.classList.toggle('is-success', !!success);
    node.classList.toggle('is-muted', !success);
  });
}

document.querySelectorAll('[data-codex-email-form]').forEach(function (form) {
  var input = form.querySelector('[data-codex-email-input]');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = normalizeEmail(input && input.value);
    if (!email || !email.includes('@')) {
      setCodexStatus('请先填写一个有效的邮箱地址。', false);
      if (input) input.focus();
      return;
    }

    setCodexStatus('正在提交到后台汇总...', true);

    fetch(CODEX_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        sourcePage: window.location.pathname.split('/').pop() || 'unknown',
      }),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('request_failed');
      }
      if (input) input.value = '';
      setCodexStatus('提交成功，邮箱会在每日汇总中发到站长 Gmail。', true);
    }).catch(function () {
      setCodexStatus('提交失败，请检查网络后重试。', false);
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
