# Waline on EdgeOne

移植自 [Waline on Worker](https://github.com/wuyilingwei/Waline_On_Worker)，运行在 **EdgeOne 边缘函数**上的 Waline 评论系统后端，使用 **EdgeOne KV** 作为数据存储。

---

## 特性

- 完全兼容 `@waline/client` 前端和 `@waline/admin` 管理面板
- 使用 EdgeOne KV 存储所有数据
- 评论 CRUD（线程化、计数、最近评论）
- 文章浏览量统计
- 用户注册 / 登录
- 社交登录
- 两步验证 (2FA / TOTP)
- Markdown 渲染 + XSS 防护
- Gravatar 头像
- UA 解析（浏览器 / 操作系统）
- RSS 订阅
- 数据导入导出（兼容 @waline/admin 迁移面板）
- LLM 评论审查

---

## 部署说明

### 1. 创建 EdgeOne KV 命名空间

在 EdgeOne 控制台中创建一个 KV 命名空间，并绑定到边缘函数。

### 2. 设置环境变量

在 EdgeOne 控制台中配置以下环境变量：

| 变量名 | 说明 | 必填 |
|---|---|---|
| `JWT_SECRET` | JWT 签名密钥 | 是 |
| `SITE_NAME` | 站点名称 | 否 |
| `SITE_URL` | 站点 URL | 否 |
| `SECURE_DOMAINS` | 允许的跨域域名，逗号分隔 | 否 |
| `AUDIT` | 设为任意值开启评论审核 | 否 |
| `OAUTH_URL` | OAuth 服务地址 | 否 |
| `TURNSTILE_KEY` / `TURNSTILE_SECRET` | Cloudflare Turnstile | 否 |
| `RECAPTCHA_V3_KEY` / `RECAPTCHA_V3_SECRET` | reCAPTCHA v3 | 否 |

### 3. 部署边缘函数

将 `src/index.ts` 作为 EdgeOne 边缘函数的入口文件进行部署。

> 注意：本项目的 TypeScript 需要在部署前编译，或者使用支持直接运行 TypeScript 的 EdgeOne 运行时。

---

## 数据模型

EdgeOne KV 中使用的键前缀：

| 前缀 | 说明 |
|---|---|
| `comment:{id}` | 评论数据 |
| `user:{id}` | 用户数据 |
| `counter:{url}` | 页面计数器 |
| `setting:{key}` | 系统设置 |
| `index:comments:*` | 评论索引 |
| `index:users:*` | 用户索引 |
| `meta:next_*_id` | 自增 ID 计数器 |

---

## 许可证

[GPL-3.0](LICENSE)
