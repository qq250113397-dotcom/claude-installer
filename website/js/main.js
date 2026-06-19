// ===== 两条路选择层 =====
(function () {
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
      '  <p style="text-align:center;color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">自己来，或者找我协助部署，都行</p>',
      '  <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;margin-bottom:20px;display:flex;gap:8px;align-items:flex-start;">',
      '    <span style="font-size:1rem;flex-shrink:0;">⚠️</span>',
      '    <p style="margin:0;font-size:0.82rem;color:#ef4444;font-weight:600;line-height:1.5;"><strong>重要提示：</strong>教程需要手机和电脑配合使用。华为手机因缺乏谷歌框架，无法完成部署！！！</p>',
      '  </div>',
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
      '      <a href="step1.html" class="btn btn-secondary">自己开始 →</a>',
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
    if (el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); el.scrollTop = 0; }
  }
  function closePathOverlay() {
    var el = document.getElementById('path-overlay');
    if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-path-overlay]')) openPathOverlay();
    if (e.target.hasAttribute('data-close-path-overlay') || e.target.closest('[data-close-path-overlay]')) closePathOverlay();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePathOverlay(); });

  injectPathOverlay();
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
