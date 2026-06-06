// Usage disclaimer modal - show once per browser, then remember consent
(function () {
  const STORAGE_KEY = 'cc_usage_disclaimer_v2';
  const COUNTDOWN_SECONDS = 3;

  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      return;
    }
  } catch (e) {
    // If storage is unavailable, fall through and show the modal.
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;max-width:480px;width:100%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
  modal.innerHTML =
    '<div style="font-size:1.5rem;margin-bottom:12px;">⚠️</div>' +
    '<h2 style="font-size:1.15rem;margin-bottom:16px;color:var(--text-primary);">使用声明</h2>' +
    '<div style="color:var(--text-secondary);font-size:0.9rem;line-height:1.85;margin-bottom:24px;">' +
      '<p style="margin-bottom:10px;">本站仅提供 Claude Code 软件的<strong style="color:var(--text-primary);">安装指引教程</strong>，不提供任何网络代理或加速服务。</p>' +
      '<p style="margin-bottom:10px;">Claude Code 是 <strong style="color:var(--text-primary);">Anthropic</strong> 的官方产品，本站与 Anthropic <strong style="color:var(--text-primary);">无官方关联</strong>。</p>' +
      '<p style="margin-bottom:10px;">本站教程默认使用 <strong style="color:var(--text-primary);">CF Workers 节点 + 静态住宅 IP</strong> 的链式代理方案；如果你只用 GPT / Gemini，只搭好 CF Workers 机场节点就够了。</p>' +
      '<p>使用 Claude Code 须遵守 <a href="https://www.anthropic.com/legal/usage-policy" target="_blank" rel="noopener" style="color:var(--accent);">Anthropic 使用条款</a>。</p>' +
    '</div>' +
    '<button id="disclaimer-close" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:not-allowed;opacity:0.65;" disabled>我已了解，继续访问（3）</button>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const button = document.getElementById('disclaimer-close');
  let remaining = COUNTDOWN_SECONDS;

  const timer = window.setInterval(function () {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
      button.textContent = '我已了解，继续访问';
      return;
    }
    button.textContent = '我已了解，继续访问（' + remaining + ')';
  }, 1000);

  button.addEventListener('click', function () {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {
      // ignore storage failures
    }
    overlay.remove();
  });
})();

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

// Subscription URL copy button
(function () {
  var btn = document.getElementById('sub-copy-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var txt = document.getElementById('sub-url-txt');
    if (!txt) return;
    navigator.clipboard.writeText(txt.textContent.trim()).then(function () {
      btn.textContent = '已复制 ✓';
      setTimeout(function () { btn.textContent = '复制'; }, 2000);
    }).catch(function () {
      var r = document.createRange();
      r.selectNode(txt);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    });
  });
})();

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
