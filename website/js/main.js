// ===== 面包多会员系统 =====
(function () {
  var MBD_VERIFY_URL = '/api/verify';
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
            var days = Math.ceil((data.expiry - Date.now()) / 86400000);
            setStatus('验证成功 ✓ 已开通会员，剩余 ' + days + ' 天！', 'ok');
            // 直接更新当前页面 UI，不依赖刷新后读 localStorage
            setTimeout(function () {
              closeMbdModal();
              var old = document.querySelector('[data-nav-mbd]');
              if (old) old.remove();
              injectNavBtn();
            }, 1200);
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

  // 退出登录
  function logout() {
    localStorage.removeItem('mbr_expiry');
    localStorage.removeItem('mbr_order');
    location.reload();
  }

  // 在导航栏注入「开通会员」或会员状态+退出按钮
  // 注意：注入到 .nav-inner（外层容器），而非 .nav-links（移动端 display:none 会把按钮一起隐藏）
  function injectNavBtn() {
    var navInner = document.querySelector('.nav-inner');
    if (!navInner || navInner.querySelector('[data-nav-mbd]')) return;

    var wrapper = document.createElement('div');
    wrapper.setAttribute('data-nav-mbd', '');
    wrapper.setAttribute('style', 'display:flex;align-items:center;gap:6px;flex-shrink:0;');

    if (isMember()) {
      var memberBtn = document.createElement('button');
      memberBtn.textContent = '会员 ✓ 剩余' + daysLeft() + '天';
      memberBtn.setAttribute('style', 'display:inline-flex;align-items:center;padding:5px 12px;border-radius:6px;background:rgba(52,211,153,0.15);color:#6ee7b7;border:1px solid rgba(52,211,153,0.35);font-size:0.8rem;font-weight:600;cursor:pointer;white-space:nowrap;letter-spacing:-0.01em;');
      memberBtn.addEventListener('click', openMbdModal);
      wrapper.appendChild(memberBtn);

      var logoutBtn = document.createElement('button');
      logoutBtn.textContent = '退出';
      logoutBtn.title = '退出后可重新输入订单号登录';
      logoutBtn.setAttribute('style', 'display:inline-flex;align-items:center;padding:5px 10px;border-radius:6px;background:transparent;color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.3);font-size:0.78rem;cursor:pointer;white-space:nowrap;');
      logoutBtn.addEventListener('click', logout);
      wrapper.appendChild(logoutBtn);

      // 同时更新首页"当前模式"面板
      var featureSub = document.querySelector('.hero-feature-sub');
      var featureBtn = document.querySelector('.hero-feature .btn');
      if (featureSub) featureSub.textContent = '已开通会员，剩余 ' + daysLeft() + ' 天。';
      if (featureBtn) {
        featureBtn.textContent = '退出登录';
        featureBtn.removeAttribute('data-buy-and-verify');
        featureBtn.addEventListener('click', function(e){ e.preventDefault(); logout(); });
      }
    } else {
      var btn = document.createElement('button');
      btn.textContent = '开通会员';
      btn.setAttribute('style', 'display:inline-flex;align-items:center;padding:7px 16px;border-radius:6px;background:#CF6B50;color:#fff;border:none;font-size:0.82rem;font-weight:600;cursor:pointer;white-space:nowrap;');
      btn.addEventListener('click', openMbdModal);
      wrapper.appendChild(btn);
    }

    // 插在 nav-toggle 之前，保证在 hamburger 左边
    var navToggle = navInner.querySelector('.nav-toggle');
    if (navToggle) {
      navInner.insertBefore(wrapper, navToggle);
    } else {
      navInner.appendChild(wrapper);
    }
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

  // 全屏遮罩：两条路选择层
  function injectPathOverlay() {
    if (document.getElementById('path-overlay')) return;
    var div = document.createElement('div');
    div.id = 'path-overlay';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = [
      '<div class="path-overlay-backdrop" data-close-path-overlay></div>',
      '<div class="path-overlay-card">',
      '  <button class="path-overlay-close" aria-label="关闭" data-close-path-overlay>×</button>',
      '  <h2 style="text-align:center;font-size:1.35rem;font-weight:800;margin-bottom:6px;">两条路，你选一条</h2>',
      '  <p style="text-align:center;color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">自己来，或者找我协助部署，都行</p>',
      '  <div class="two-path-grid">',
      '    <div class="path-card">',
      '      <div class="path-card-badge free">自助注册</div>',
      '      <h3>自己按步骤来</h3>',
      '      <p>跟着教程一步步配置，整个流程 30–60 分钟，自己注册账号完成全套安装。</p>',
      '      <ul class="path-card-list">',
      '        <li>步骤一：配置网络 + 注册 Gmail</li>',
      '        <li>步骤二：安装 Node.js + Claude Code</li>',
      '        <li>步骤三：登录授权，开始使用</li>',
      '      </ul>',
      '      <button class="btn btn-secondary" data-mbd-gate-href="step1.html">自己开始 →</button>',
      '    </div>',
      '    <div class="path-card path-buy">',
      '      <div class="path-card-badge paid">协助部署</div>',
      '      <h3>找我帮你搭好</h3>',
      '      <p>不想折腾环境？购买远程协助服务后，通过 ToDesk 远程帮你完成全套配置，通常 1 小时内搞定。</p>',
      '      <ul class="path-card-list">',
      '        <li>第一步：购买下方远程协助服务</li>',
      '        <li>第二步：下载安装 ToDesk 远程软件</li>',
      '        <li>第三步：添加 QQ，发送设备码等待远程</li>',
      '      </ul>',
      '      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">',
      '        <a href="https://dl.todesk.com/windows/ToDesk_Setup.exe" class="btn btn-secondary btn-sm" target="_blank" rel="noopener">下载 ToDesk（Windows）</a>',
      '        <a href="https://dl.todesk.com/macos/ToDesk_amd64.dmg" class="btn btn-secondary btn-sm" target="_blank" rel="noopener">下载 ToDesk（Mac）</a>',
      '      </div>',
      '      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:14px;">',
      '        安装后添加 QQ：<span class="qq-blur">250113397</span>（点击号码显示）',
      '      </p>',
      '      <a href="https://mbd.pub/o/bread/YZaTmZtxbQ==" target="_blank" rel="noopener" class="btn btn-primary">购买远程协助 →</a>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(div);
  }

  function openPathOverlay() {
    var el = document.getElementById('path-overlay');
    if (el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  }
  function closePathOverlay() {
    var el = document.getElementById('path-overlay');
    if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-path-overlay]')) openPathOverlay();
    if (e.target.hasAttribute('data-close-path-overlay') || e.target.closest('[data-close-path-overlay]')) closePathOverlay();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePathOverlay(); });

  injectPathOverlay();

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

