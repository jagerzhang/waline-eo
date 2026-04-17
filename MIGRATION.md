# 从官方 Waline 迁移到 Waline EdgeOne

## 快速对比

| 项目 | 官方 @waline/vercel | Waline EdgeOne |
|-----|-------------------|----------------|
| **部署平台** | Vercel/Node.js 服务器 | EdgeOne Pages |
| **数据存储** | MongoDB/LeanCloud/MySQL/PostgreSQL/SQLite | EdgeOne KV |
| **前端客户端** | `@waline/client` | `@waline/client` (相同) |
| **API 接口** | 完全相同 | 完全相同 |
| **环境变量** | 大部分相同 | 大部分相同 |
| **管理后台** | 内置 `/ui` | 内置 `/ui` (相同) |

## 环境变量对比

### 必需变量

| 变量名 | 官方 | EdgeOne | 说明 |
|-------|------|---------|------|
| `LEAN_KEY` | ✅ | ❌ | LeanCloud key，EdgeOne 不需要 |
| `MONGO_DB` | ✅ | ❌ | MongoDB URI，EdgeOne 不需要 |
| `MYSQL_DB` | ✅ | ❌ | MySQL 配置，EdgeOne 不需要 |
| `WALINE_KV` | ❌ | ✅ | EdgeOne KV 绑定，必需 |
| `JWT_TOKEN` | ✅ | ✅ | JWT 密钥，相同 |
| `SITE_NAME` | ✅ | ✅ | 站点名称，相同 |
| `SITE_URL` | ✅ | ✅ | 站点 URL，相同 |

### 可选变量（完全相同）

```bash
# 管理员设置
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=sha256_hash

# 评论设置
COMMENT_AUDIT=false
DISABLE_USERAGENT=false
DISABLE_REGION=false
IP_QPS=60
LIKE_INC_MAX=10

# 安全设置
DISALLOW_IP_LIST=1.2.3.4,5.6.7.8
FORBIDDEN_WORDS=spam,badword
LEVELS=0,10,20,50,100,200

# 头像设置
AVATAR_PROXY=https://your-proxy.com

# 反垃圾
AKISMET_KEY=your-key

# 邮件通知（完全相同）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
SENDER_EMAIL=noreply@example.com
SENDER_NAME=Waline

# 其他通知（完全相同）
SC_KEY=serverchan-key
TG_BOT_TOKEN=telegram-token
TG_CHAT_ID=chat-id
QQ_KEY=coolpush-key
DISCORD_WEBHOOK=webhook-url
LARK_WEBHOOK=lark-webhook

# OAuth（完全相同）
OAUTH_URL=https://oauth.lithub.cc
```

## 前端使用（完全相同）

### 官方 Waline
```html
<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>

<script type="module">
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';
  
  init({
    el: '#waline',
    serverURL: 'https://your-vercel-app.vercel.app',
    path: window.location.pathname,
  });
</script>
```

### Waline EdgeOne
```html
<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>

<script type="module">
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';
  
  init({
    el: '#waline',
    serverURL: 'https://your-edgeone.pages.dev',  // 只需修改这里
    path: window.location.pathname,
  });
</script>
```

## 配置项（完全相同）

### 客户端配置

```javascript
init({
  // 基础配置（完全相同）
  el: '#waline',
  serverURL: 'https://your-edgeone.pages.dev',
  path: window.location.pathname,
  
  // 多语言（完全相同）
  lang: 'zh-CN',
  
  // 占位符（完全相同）
  placeholder: '欢迎评论',
  
  // 头像（完全相同）
  avatar: 'mp',
  avatarCDN: 'https://cravatar.cn/avatar/',
  
  // 页面浏览量（完全相同）
  pageview: true,
  
  // 评论数（完全相同）
  comment: true,
  
  // 表情（完全相同）
  emoji: [
    'https://unpkg.com/@waline/emojis@1.1.0/weibo',
    'https://unpkg.com/@waline/emojis@1.1.0/alus',
  ],
  
  // 图片上传（完全相同）
  imageUploader: (file) => {
    // 自定义上传逻辑
  },
  
  // 登录模式（完全相同）
  login: 'enable', // 'enable', 'disable', 'force'
  
  // 置顶（完全相同）
  sticky: true,
  
  // 搜索（完全相同）
  search: true,
  
  // 预览（完全相同）
  preview: true,
  
  // 字数限制（完全相同）
  wordLimit: [0, 1000],
  
  // 分页（完全相同）
  pageSize: 10,
  
  // 排序（完全相同）
  sortBy: 'insertedAt_desc',
  
  // 高亮（完全相同）
  highlight: true,
  
  // 数学公式（完全相同）
  texRenderer: (block, tex) => {
    // 自定义渲染
  },
  
  // 自定义 CSS（完全相同）
  dark: 'html[data-theme="dark"]',
  
  // 回调函数（完全相同）
  onLogin: (user) => {
    console.log('User logged in:', user);
  },
  onLogout: () => {
    console.log('User logged out');
  },
  onComment: (comment) => {
    console.log('New comment:', comment);
  },
});
```

## 管理后台（完全相同）

访问方式：
- 官方：`https://your-vercel-app.vercel.app/ui`
- EdgeOne：`https://your-edgeone.pages.dev/ui`

功能完全一致：
- 评论管理（审核、编辑、删除）
- 用户管理
- 数据统计
- 数据导入导出
- 系统设置

## API 接口（完全相同）

所有 API 端点、请求参数、响应格式与官方完全一致：

```
GET    /comment          # 获取评论列表
POST   /comment          # 发表评论
PUT    /comment          # 更新评论
DELETE /comment          # 删除评论
GET    /user             # 获取用户信息
POST   /login            # 用户登录
POST   /register         # 用户注册
POST   /token            # 刷新 Token
DELETE /token            # 登出
GET    /oauth            # OAuth 登录
GET    /article          # 获取评论数
GET    /recent           # 最近评论
GET    /stat             # 统计数据
...
```

## 主题定制（完全相同）

### CSS 变量
```css
:root {
  --waline-white: #fff;
  --waline-light-grey: #999;
  --waline-dark-grey: #666;
  --waline-theme-color: #27ae60;
  --waline-active-color: #2ecc71;
  --waline-color: #444;
  --waline-bgcolor: #fff;
  --waline-bgcolor-light: #f8f8f8;
  --waline-border-color: #ddd;
  --waline-disable-bgcolor: #f8f8f8;
  --waline-disable-color: #000;
  --waline-code-bgcolor: #282c34;
  --waline-bq-color: #27ae60;
  --waline-avatar-size: 3.25rem;
  --waline-m-avatar-size: 2rem;
  --waline-badge-color: #3498db;
  --waline-badge-font-size: 0.75em;
  --waline-info-bgcolor: #f8f8f8;
  --waline-info-color: #999;
  --waline-info-font-size: 0.625em;
  --waline-border: 1px solid var(--waline-border-color);
  --waline-avatar-radius: 50%;
  --waline-box-shadow: none;
}
```

## 迁移步骤

### 从官方迁移到 EdgeOne

1. **导出数据**
   - 登录官方管理后台
   - 数据管理 → 导出 → 下载 JSON

2. **部署 EdgeOne 版本**
   - 按照 README.md 部署到 EdgeOne

3. **导入数据**
   - 登录 EdgeOne 管理后台
   - 数据管理 → 导入 → 上传 JSON

4. **修改前端配置**
   ```javascript
   // 修改前
   serverURL: 'https://your-vercel-app.vercel.app'
   
   // 修改后
   serverURL: 'https://your-edgeone.pages.dev'
   ```

5. **完成！** 其他配置完全不变

## 功能差异

| 功能 | 官方 | EdgeOne | 说明 |
|-----|------|---------|------|
| 数据存储 | 多种数据库 | EdgeOne KV | 存储方式不同，功能相同 |
| 数据库查询 | SQL/MongoDB | KV 扫描 | 实现方式不同，结果相同 |
| 文件上传 | 本地/云存储 | KV/R2 | 存储位置不同，功能相同 |
| Webhook | ✅ | ✅ | 完全相同 |
| 邮件通知 | ✅ | ✅ | 完全相同 |
| 社交登录 | ✅ | ✅ | 完全相同 |
| 反垃圾 | ✅ | ✅ | 完全相同 |
| 数学公式 | ✅ | ✅ | 完全相同 |
| 代码高亮 | ✅ | ✅ | 完全相同 |

## 常见问题

### Q: 客户端版本需要更换吗？
**A:** 不需要，使用相同的 `@waline/client`

### Q: 主题/样式需要修改吗？
**A:** 不需要，CSS 变量和样式完全相同

### Q: 数据可以迁移吗？
**A:** 可以，通过导入导出功能

### Q: OAuth 登录需要重新配置吗？
**A:** 不需要，使用相同的 OAuth 代理

### Q: 邮件通知需要重新配置吗？
**A:** 不需要，SMTP 配置完全相同

### Q: 管理后台操作有变化吗？
**A:** 没有，界面和功能完全相同

## 总结

**唯一区别：**
- 部署平台：Vercel → EdgeOne
- 数据存储：数据库 → EdgeOne KV
- 服务端 URL：修改 `serverURL` 配置

**其他全部相同：**
- 客户端代码
- 环境变量
- API 接口
- 管理后台
- 主题样式
- 功能特性
