# Claude Code 安装教程网站

## 项目说明

这是一个 Claude Code 安装教程网站，帮助用户了解和安装 Claude Code。

## 网站信息

- **网站地址**：claude.lbenben.cc.cd
- **部署方式**：GitHub 推送后 Cloudflare Pages 自动部署

## 文件结构

```
claude-installer/
├── website/    # 网站源码（静态 HTML/CSS/JS）
└── worker/     # Cloudflare Worker 代码
```

## 技术栈

- 纯静态 HTML / CSS / JS
- Cloudflare Pages（托管 + 自动部署）
- Cloudflare R2（文件存储）
- Cloudflare Workers（后端逻辑）
- Cloudflare KV（键值存储，用于卡密系统）

## 基础设施

- **R2 存储域名**：hidden-lab-852a.qq250113397.workers.dev

## 当前进度

正在开发**卡密验证系统**，使用 Cloudflare Worker + KV 实现：
- 卡密生成与存储（KV）
- 前端验证流程
- 访问权限控制
