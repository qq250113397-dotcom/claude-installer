// ===== 面包多会员系统 =====
(function () {
  var MBD_VERIFY_URL = 'https://mbd-verify.qq250113397.workers.dev';
  var MBD_PRODUCT_URL = 'https://mbd.pub/o/bread/YZaTmZtvaw==';

  function getMbrExpiry() { return Number(localStorage.getItem('mbr_expiry') || 0); }
  function isMember() { return getMbrExpiry() > Date.now(); }
  function daysLeft() { return Math.max(1, Math.ceil((getMbrExpiry() - Date.now()) / 86400000)); }

  // 注入验证弹窗 DOM
  function injectModal() {
    if (document.getElementById('mbd-modal')) return;
    var div = document.createElement('div');
    div.id = 'mbd-modal';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = [
      '<div class="mbd-modal-card" role="dialog" aria-modal="true">',
      '  <button class="mbd-modal-close" aria-label="关闭" data-close-mbd-modal>×</button>',
      '  <div class="mbd-modal-eyebrow">面包多会员</div>',
      '  <div class="mbd-modal-title">验证会员订单</div>',
      '  <div class="mbd-modal-desc">',
      '    在面包多完成购买后，把订单号粘贴到下方，验证成功后解锁全部内容，有效期 32 天。',
      '  </div>',
      '  <form id="mbd-verify-form">',
      '    <div class="card-verify-row">',
      '      <input id="mbd-order-input" type="text" placeholder="面包多订单号，如 xxxxx" autocomplete="off" spellcheck="false">',
      '      <button type="submit" class="btn btn-primary" style="flex-shrink:0;">验证</button>',
      '    </div>',
      '  </form>',
      '  <div id="mbd-verify-status" class="mbd-verify-status"></div>',
      '  <div class="mbd-modal-divider"><span>还没有购买？</span></div>',
      '  <a href="' + MBD_PRODUCT_URL + '" target="_blank" rel="noopener" class="btn btn-secondary" style="width:100%;justify-content:center;">',
      '    前往面包多开通会员 →',
      '  </a>',
      '</div>'
    ].join('');
    document.body.appendChild(div);

    // 绑定关闭
    div.addEventListener('click', function (e) {
      if (e.target === div || e.target.hasAttribute('data-close-mbd-modal')) closeMbdModal();
    });

    // 绑定验证表单
    initVerifyForm();
  }

  function openMbdModal() {
    var modal = document.getElementById('mbd-modal');
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }

  function closeMbdModal() {
    var modal = document.getElementById('mbd-modal');
    if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
  }

  function initVerifyForm() {
    var form = document.getElementById('mbd-verify-form');
    if (!form) return;
    var input = document.getElementById('mbd-order-input');
    var statusEl = document.getElementById('mbd-verify-status');

    if (isMember()) {
      setStatus('✓ 会员有效，剩余 ' + daysLeft() + ' 天', 'ok');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var orderNo = (input ? input.value : '').trim();
      if (!orderNo) { setStatus('请先输入面包多订单号', 'err'); return; }

      setStatus('验证中...', 'info');

      fetch(MBD_VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_no: orderNo }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            localStorage.setItem('mbr_expiry', String(data.expiry));
            localStorage.setItem('mbr_order', orderNo);
            setStatus('验证成功 ✓ 剩余 ' + Math.ceil((data.expiry - Date.now()) / 86400000) + ' 天，3秒后自动刷新页面', 'ok');
            setTimeout(function () { location.reload(); }, 3000);
          } else {
            setStatus('验证失败：' + (data.error || '请检查订单号后重试'), 'err');
          }
        })
        .catch(function () {
          setStatus('网络错误，请检查网络后重试', 'err');
        });

      function setStatus(msg, type) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.className = 'mbd-verify-status show ' + type;
      }
    });
  }

  // 替换视频为会员锁（仅对有 data-member-gate 属性的元素）
  function applyContentGates() {
    if (isMember()) return;
    document.querySelectorAll('[data-member-gate]').forEach(function (el) {
      var gate = document.createElement('div');
      gate.className = 'member-gate';
      gate.innerHTML = [
        '<div class="member-gate-icon">🔒</div>',
        '<div class="member-gate-title">此内容仅会员可见</div>',
        '<div class="member-gate-desc">开通会员后可查看全部视频和资源</div>',
        '<div class="member-gate-actions">',
        '  <a href="' + MBD_PRODUCT_URL + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">开通会员</a>',
        '  <button class="btn btn-secondary btn-sm" data-open-mbd-modal>已购买？验证订单</button>',
        '</div>'
      ].join('');
      el.parentNode.replaceChild(gate, el);
    });
  }

  // 在导航栏注入「开通会员」按钮
  function injectNavBtn() {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks || navLinks.querySelector('.nav-mbd-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'nav-mbd-btn';
    if (isMember()) {
      btn.textContent = '会员 ✓ 剩余' + daysLeft() + '天';
      btn.classList.add('is-member');
      btn.setAttribute('data-open-mbd-modal', '');
    } else {
      btn.textContent = '开通会员';
      btn.addEventListener('click', openMbdModal);
    }
    btn.addEventListener('click', openMbdModal);
    navLinks.appendChild(btn);
  }

  // 全局 [data-open-mbd-modal] 按钮绑定（包括注入的锁内容里的按钮）
  document.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-open-mbd-modal') || e.target.closest('[data-open-mbd-modal]')) {
      openMbdModal();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMbdModal();
  });

  // 初始化
  injectModal();
  applyContentGates();
  injectNavBtn();

  // data-buy-and-verify：开新窗口去面包多 + 同时弹出验证框，付完款直接粘贴订单号
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-buy-and-verify]');
    if (btn) {
      e.preventDefault();
      window.open(MBD_PRODUCT_URL, '_blank');
      openMbdModal();
    }
  });

  // data-mbd-gate-href：会员直接跳转，非会员触发购买+验证
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mbd-gate-href]');
    if (btn) {
      e.preventDefault();
      if (isMember()) {
        location.href = btn.getAttribute('data-mbd-gate-href');
      } else {
        window.open(MBD_PRODUCT_URL, '_blank');
        openMbdModal();
      }
    }
  });

  // 首页非会员隐藏步骤导航链接
  (function () {
    if (isMember()) return;
    var page = location.pathname.split('/').pop() || 'index.html';
    if (page !== 'index.html' && page !== '') return;
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if ((a.getAttribute('href') || '').indexOf('step') === 0) {
        a.style.display = 'none';
      }
    });
  })();

  // data-scroll-to-path：平滑滚动到"两条路"并触发淡入
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-scroll-to-path]');
    if (btn) {
      var target = document.getElementById('path-select');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function () { target.classList.add('visible'); }, 200);
      }
    }
  });

  // 滚动进入视口时自动淡入（用户手动滚动也能触发）
  var pathSection = document.getElementById('path-select');
  if (pathSection && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    obs.observe(pathSection);
  }

  // URL 含 ?verify 时自动弹出验证框（面包多后台可设付款跳转链接为 ?verify=1）
  if (location.search.indexOf('verify') !== -1) {
    openMbdModal();
  }
})();

// ===== FAQ Accordion =====
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

// QQ 号码点击显示
document.querySelectorAll('.qq-blur').forEach(function (el) {
  el.addEventListener('click', function () { el.classList.toggle('revealed'); });
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

