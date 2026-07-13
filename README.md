# Waline On EdgeOne

基于 [Hono](https://hono.dev/) 框架构建的 **Waline** 评论系统后端，专为 **EdgeOne Pages** 边缘计算平台优化，使用 **EdgeOne KV** 作为数据持久化存储。

完全兼容 `@waline/client` v3 前端与 `@waline/admin` 管理后台，同时提供独立的 EdgeOne 扩展设置面板，将大量原需环境变量的配置项迁移至 Web 后台，降低部署后的维护成本。

---

## 功能概览

### 核心评论系统

- 完整的评论 CRUD：发表、编辑、删除、点赞
- 树状 threaded 回复：支持一级（pid）与二级（rid）嵌套回复
- 分页与排序：支持按时间正序/倒序、按点赞数排序
- 评论计数：按页面路径统计 approved 状态评论数量
- 最近评论：获取站点最新评论列表
- RSS 订阅：按页面路径或用户筛选输出 RSS 2.0  Feed
- Markdown 渲染：评论内容支持 Markdown 语法，实时渲染为 HTML
- XSS 过滤：内置安全的 Markdown 处理策略
- 大规模数据支持：采用 KV 分页索引设计，可稳定支撑 10 万级评论数据量

### 用户与认证

- JWT Token 认证：无状态登录，支持 localStorage / sessionStorage
- 用户注册与登录：独立的邮箱密码体系
- 社交登录（OAuth）：支持 GitHub 等第三方登录（通过 OAUTH_URL 扩展）
- 两步验证（2FA / TOTP）：管理员账号可启用 TOTP 动态口令
- 角色体系：administrator / guest / user，权限严格分离

### 管理后台

- 原生 Waline Admin：从 CDN 加载 `@waline/admin`，保持熟悉的操作体验
- EdgeOne 扩展菜单：Admin 面板内自动注入「EdgeOne 设置」入口（仅管理员可见）
- 独立的设置页面 `/ui/worker-setting`：Typecho 风格后台，包含以下配置模块：
  - **前端版本**：管理 `@waline/client` CDN 版本、Worker 标识显示策略
  - **基础设置**：站点名称/地址、博主邮箱、IP 限流秒数、强制评论审核、Akismet Key、禁用地区/UA 解析
  - **评论策略**：匿名用户与登录用户的默认评论状态（approved / waiting）
  - **邮件通知**：SMTP / Resend / SendGrid 三合一邮件发送配置，支持自定义回复通知与管理通知模板
  - **PushPlus**：微信推送配置，新评论/回复实时通知到微信

### 安全防护与反垃圾

- **极验行为验证 4.0**：前后端完整集成 Geetest v4，评论提交前需完成人机验证
- **IPQPS 限流**：基于 IP 的评论频率限制，后台可配置间隔秒数（默认 60 秒，0 为关闭）
- **评论审核**：支持强制审核模式，匿名评论可默认进入 waiting 状态
- **字段长度限制**：评论内容、昵称、邮箱、链接、URL、UA 等字段均有长度上限校验
- **CORS 安全域**：通过 `SECURE_DOMAINS` 限制可跨域调用的来源域名
- **Akismet 预留**：后台已提供 Akismet Key 配置入口，便于后续接入反垃圾服务

### 通知系统

- **邮件通知**：
  - 评论被回复时，自动邮件通知被回复者
  - 新评论提交时，自动邮件通知博主（作者邮箱）
  - 支持 SMTP（原生 TCP）、Resend HTTP API、SendGrid HTTP API 三种发送方式
  - 邮件模板支持变量替换：`{{site.name}}`、`{{site.url}}`、`{{comment.nick}}`、`{{comment.content}}`、`{{parent.nick}}` 等
- **PushPlus 微信推送**：
  - 新评论或评论回复时，向配置的 PushPlus Token 发送微信消息
  - 支持 topic 群组、template 模板、channel 渠道等高级参数

### 评论展示增强

- **Gravatar 头像**：根据评论者邮箱自动获取 Gravatar 头像
- **UA 解析**：自动识别并显示浏览器与操作系统信息（后台可关闭）
- **博主标识**：评论者邮箱与博主邮箱一致时，自动标注「博主」标签
- **审核状态提示**：评论提交后，如进入待审核状态，返回友好的等待提示文案

### 数据迁移

- **导出**：后台导出数据严格对齐原版 Waline 格式，包含 `__version`、`objectId`（数字）、`type`、`version`、`time`、`tables`、`data` 等完整结构，可直接被原版 Waline 导入
- **导入**：通过 Admin 迁移面板，支持导入原版 Waline 导出的 JSON 数据，自动重建索引与关联关系
- **Counter / Users**：同步导出导入评论计数器与用户数据

---

## 快速部署

### 1. 准备工作

在 EdgeOne 控制台中：

1. 创建一个 **KV 命名空间**，用于存储评论、用户、计数器及配置数据
2. 创建 EdgeOne Pages 项目，将本仓库代码作为函数源码部署

### 2. 必须的环境变量

仅需在 EdgeOne 控制台配置以下 2 个环境变量，其余所有设置均可在部署后通过后台管理：

| 变量名 | 说明 | 必填 |
|---|---|---|
| `WALINE_KV` | EdgeOne KV 命名空间绑定名 | 是 |
| `JWT_SECRET` | JWT 签名密钥，请设置足够复杂的随机字符串 | 是 |

> 旧版中需要配置的 `SITE_NAME`、`SITE_URL`、`AUTHOR_EMAIL`、`IPQPS`、`COMMENT_AUDIT`、`AKISMET_KEY`、`DISABLE_REGION`、`DISABLE_USERAGENT` 等变量，现已全部迁移至后台 `/ui/worker-setting` 页面，部署后登录管理员账号即可可视化配置。

### 3. 可选的环境变量

| 变量名 | 说明 |
|---|---|
| `SECURE_DOMAINS` | 允许的跨域来源域名，多个用逗号分隔 |
| `OAUTH_URL` | 自定义 OAuth 登录服务地址 |
| `GEETEST_CAPTCHA_ID` / `GEETEST_CAPTCHA_KEY` | 极验 CAPTCHA v4 的 ID 与 Key |
| `RECAPTCHA_V3_KEY` / `RECAPTCHA_V3_SECRET` | 保留接口，当前主要用于前端 Geetest 对接兼容 |
| `TURNSTILE_KEY` / `TURNSTILE_SECRET` | Cloudflare Turnstile 验证（如需要） |

### 4. 访问管理后台

部署完成后：

- 管理后台：`https://your-domain/ui`
- EdgeOne 设置：`https://your-domain/ui/worker-setting`

首次部署需先注册一个管理员账号，然后通过管理后台配置站点信息、邮件通知、极验验证等。

---

## 前端对接（Geetest 验证）

如启用了极验验证，前端博客页面需要加载极验 v4 SDK，并在 Waline 提交 `POST /api/comment` 前完成验证。PrimeEdge 博客模板会把 `getValidate()` 返回值注入评论请求，无需配置 reCAPTCHA。

后端在 `POST /api/comment` 中读取 `geetest_lot_number`、`geetest_captcha_output`、`geetest_pass_token`、`geetest_gen_time`，以 Captcha Key 生成 `sign_token` 后请求极验服务端校验。ID/Key 只配置一项、字段缺失、网络超时或极验返回失败时都会拒绝评论请求。

博客端公开的 Captcha ID 必须与服务端 `geetest_captcha_id` 一致，Captcha Key 只能保存在服务端环境变量或 `WALINE_KV`。完整对接代码见 PrimeEdge 博客的 `layouts/partials/waline.html`。

---

## KV 数据存储结构

EdgeOne KV 中使用的键前缀说明：

| 前缀 | 说明 |
|---|---|
| `comment:{id}` | 单条评论数据 |
| `user:{id}` | 单个用户数据 |
| `counter:{url}` | 单页计数器数据 |
| `setting:{key}` | 后台配置项 |
| `ipqps:{ip}` | IP 限流时间戳记录 |
| `index:comments:all` | 全部评论 ID 索引 |
| `index:comments:url:{url}` | 按页面路径分片的评论 ID 索引 |
| `index:comments:pid:{pid}` | 子评论索引 |
| `index:user:email:{email}` | 用户邮箱索引 |
| `meta:next_comment_id` | 评论自增 ID 计数器 |
| `meta:next_user_id` | 用户自增 ID 计数器 |

---

## 技术栈

- [Hono](https://hono.dev/) — 轻量级 Web 框架
- EdgeOne Pages V8 Runtime — 边缘计算运行时
- EdgeOne KV — 分布式键值存储
- TypeScript — 全栈类型安全

---

## 开源协议

[GPL-3.0](LICENSE)
