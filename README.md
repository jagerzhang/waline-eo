# Waline EdgeOne - Full Featured

完整的 Waline 服务端实现，适配 EdgeOne Pages Functions 和 EdgeOne KV 存储。

## 特性

- **完全兼容** `@waline/client` v3.x
- **基于官方** `@waline/vercel` v1.39.3 功能完整实现
- **EdgeOne 原生** 专为 EdgeOne Pages 优化
- **KV 存储** 使用 EdgeOne KV 替代传统数据库
- **功能完整** 包含官方所有功能：
  - 评论系统（嵌套回复、审核、置顶、点赞）
  - 用户系统（注册/登录/OAuth/2FA）
  - 邮件通知（SMTP/多平台）
  - 反垃圾（Akismet/关键词过滤）
  - Markdown 渲染（Emoji/数学公式/代码高亮）
  - 管理后台（完整 UI/数据管理）
  - 数据导入导出（JSON/CSV）
  - 文件上传/头像管理

## 与官方版本对比

| 功能 | 官方 @waline/vercel | Waline EdgeOne |
|-----|-------------------|----------------|
| 运行环境 | Node.js + 数据库 | EdgeOne Pages + KV |
| 评论 CRUD | ✅ | ✅ |
| 嵌套回复 | ✅ | ✅ |
| 评论审核 | ✅ | ✅ |
| 用户系统 | ✅ | ✅ |
| OAuth 登录 | ✅ | ✅ |
| 2FA 支持 | ✅ | ✅ |
| 邮件通知 | ✅ | ✅ |
| 反垃圾 | ✅ | ✅ |
| Markdown | ✅ | ✅ |
| 管理后台 | ✅ | ✅ |
| 数据导入导出 | ✅ | ✅ |
| 文件上传 | ✅ | ✅ |

## 快速开始

### 1. 创建 KV 命名空间

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 进入 **Pages** -> **KV 命名空间**
3. 点击 **新建命名空间**
4. 名称：`waline-kv`
5. 记录 **命名空间 ID**

### 2. 创建 Pages 项目

1. 进入 **Pages** -> **项目管理**
2. 点击 **新建项目**
3. 上传本项目的 zip 文件或从 Git 导入
4. 项目名称：`my-waline`

### 3. 配置环境变量

进入项目 **设置** -> **变量**：

**必需变量：**

| 变量名 | 说明 | 示例 |
|-------|------|------|
| `WALINE_KV` | KV 命名空间绑定 | 选择创建的命名空间 |
| `JWT_TOKEN` | JWT 密钥 | `openssl rand -base64 32` |
| `ADMIN_EMAIL` | 管理员邮箱 | `admin@example.com` |
| `ADMIN_PASSWORD_HASH` | 密码 SHA256 哈希 | 见下方生成方法 |
| `SITE_NAME` | 站点名称 | `My Blog` |
| `SITE_URL` | 站点 URL | `https://example.com` |

**生成密码哈希：**

```javascript
// 在浏览器控制台运行
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
sha256('your-password').then(console.log);
```

### 4. 部署

点击 **部署** 或 **重新部署**

部署完成后会得到域名：`https://your-project.pages.dev`

### 5. 访问管理后台

浏览器打开：`https://your-project.pages.dev/ui`

使用管理员邮箱和密码登录

## 前端集成

```html
<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>

<script type="module">
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';
  
  init({
    el: '#waline',
    serverURL: 'https://your-project.pages.dev',
    path: window.location.pathname,
  });
</script>
```

## API 文档

所有 API 与官方 Waline 完全兼容：

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/comment` | GET/POST/PUT/DELETE | 评论操作 |
| `/user` | GET | 获取用户信息 |
| `/login` | POST | 用户登录 |
| `/register` | POST | 用户注册 |
| `/token` | POST/DELETE | Token 刷新/登出 |
| `/oauth` | GET | OAuth 登录 (支持 GitHub/QQ/微博/Twitter/Facebook) |
| `/article` | GET/POST | 文章计数 |
| `/recent` | GET | 最近评论 |
| `/hot` | GET | 热门评论 |
| `/stat` | GET/PUT | 统计信息 |
| `/admin/comment` | GET/PUT/DELETE | 管理评论 |
| `/admin/user` | GET/PUT/DELETE | 管理用户 |
| `/db/export` | GET | 导出数据 |
| `/db/import` | POST | 导入数据 |
| `/upload` | POST | 文件上传 |

## 环境变量配置

### 邮件通知

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 反垃圾

```
AKISMET_KEY=your-akismet-key
```

### OAuth 社交登录

Waline EdgeOne 使用官方 OAuth 代理服务，支持以下平台：
- **GitHub** - `type=github`
- **QQ** - `type=qq`
- **微博 (Weibo)** - `type=weibo`
- **Twitter/X** - `type=twitter`
- **Facebook** - `type=facebook`

```
# OAuth 代理 URL（可选，默认使用官方代理）
OAUTH_URL=https://oauth.lithub.cc
```

前端使用示例：
```javascript
// GitHub 登录
fetch('/oauth?type=github&redirect=https://your-site.com/callback')

// QQ 登录
fetch('/oauth?type=qq&redirect=https://your-site.com/callback')

// 微博登录
fetch('/oauth?type=weibo&redirect=https://your-site.com/callback')
```

### 其他通知

```
SC_KEY=serverchan-key          # 微信 ServerChan
TG_BOT_TOKEN=telegram-token    # Telegram
TG_CHAT_ID=chat-id             # Telegram Chat ID
```

## 更新官方版本

当官方 Waline 更新时：

```bash
# 1. 拉取官方最新代码
cd waline-official
git pull origin main

# 2. 对比官方变更
# 主要关注 packages/server/src/controller/ 和 packages/server/src/service/

# 3. 同步变更到本项目
# 修改 src/api/comment.js, src/api/user.js, src/service/*.js

# 4. 重新部署
```

## 许可证

MIT License - 与官方 Waline 相同
