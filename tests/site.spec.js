const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const SITE_ROOT = path.resolve(__dirname, '..', 'website');

const PAGES = [
  {
    name: 'home',
    file: 'index.html',
    title: 'AI coding 入门导航站',
    content: [
      '重要提示‼️',
      '亲测可用住宅IP OnesProxy',
      '亲测好用 🪜 极速云',
      'Claude / GPT、Claude Code / Codex',
    ],
    shot: '.hero-inner',
  },
  {
    name: 'network',
    file: 'step1-network.html',
    title: '步骤一-A：电脑端网络准备',
    content: [
      '先选订阅方案，再导入外网',
      '免费方案视频',
      '打开 ping0.cc',
    ],
    shot: 'div.step-item:nth-of-type(2)',
  },
  {
    name: 'advanced',
    file: 'step1-advanced.html',
    title: '步骤一-C：进阶内容',
    content: [
      '用 Gmail 登录 Cloudflare，搭建订阅',
      '极速云视频',
      '确定静态住宅IP生效',
    ],
    shot: 'div.step-item:nth-of-type(1)',
  },
  {
    name: 'mobile',
    file: 'step1-mobile.html',
    title: '步骤一-B：手机端配置',
    content: [
      '免费重置次数',
      '苹果注册美区账号教程',
      '小火箭（Shadowrocket）配置教程',
    ],
    shot: '.page-section',
  },
  {
    name: 'step2',
    file: 'step2.html',
    title: '步骤二：下载 & 安装',
    content: [
      '新手还是建议先用桌面版',
      '打开 Claude 桌面版',
      '打开官方入口',
    ],
    shot: '.container > .member-card.codex-install-card:nth-of-type(2)',
  },
  {
    name: 'step3',
    file: 'step3.html',
    title: '步骤三：会员订阅',
    content: [
      'wildai订阅会员',
      '去 WildAI 看价格',
      '这个视频对应申请招行卡订阅会员',
      '海外手机号码接码 giff卡申请流程',
    ],
    shot: 'main .container > div:first-of-type',
  },
];

for (const pageSpec of PAGES) {
  test(`${pageSpec.name} page renders expected content`, async ({ page }) => {
    const problems = await openAndCollectProblems(page, pageSpec.file);

    await expect(page).toHaveTitle(new RegExp(escapeRegex(pageSpec.title)));

    for (const text of pageSpec.content) {
      await expect(page.getByText(text, { exact: false })).toBeVisible();
    }

    expect(problems, `Console/page errors on ${pageSpec.file}`).toEqual([]);
  });
}

for (const pageSpec of PAGES) {
  test(`${pageSpec.name} page visual snapshot`, async ({ page }) => {
    await openPage(page, pageSpec.file);
    const shot = page.locator(pageSpec.shot);
    await shot.scrollIntoViewIfNeeded();
    await expect(shot).toHaveScreenshot(`${pageSpec.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

async function openAndCollectProblems(page, file) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console:${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    problems.push(`pageerror:${err.message}`);
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('youtube.com/api/stats/')) return;
    const failure = request.failure();
    problems.push(`requestfailed:${request.method()} ${request.url()} ${failure?.errorText || 'unknown'}`);
  });

  await openPage(page, file);
  return problems;
}

async function openPage(page, file) {
  const url = pathToFileURL(path.join(SITE_ROOT, file)).href;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(200);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
