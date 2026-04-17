# EdgeOne 部署指南

## 项目结构

```
waline-edgeone-full/
├── edge-functions/         # EdgeOne Pages Edge Functions（必需）
│   ├── meta.json          # 元数据文件（必需）
│   ├── index.js           # 根路径重定向到 /ui
│   ├── ui.js              # 管理后台 UI
│   ├── register.js        # 用户注册
│   ├── token.js           # 登录/Token 管理
│   └── comment.js         # 评论 API
├── src/                   # 源代码（供参考）
└── _routes.json           # 路由配置
```

**重要**：EdgeOne Pages 使用 `edge-functions` 目录（不是 `functions`），并且需要 `meta.json` 文件。

## 部署步骤

### 1. 创建 GitHub 仓库

```bash
# 进入项目目录
cd waline-edgeone-full

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/your-username/waline-edgeone.git

# 推送
git push -u origin main
```

### 2. 创建 EdgeOne KV 命名空间

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 进入 **边缘安全加速平台** → **Pages**
3. 点击左侧 **KV 命名空间**
4. 点击 **新建命名空间**
5. 名称：`waline-kv`
6. 点击 **创建**
7. 记录 **命名空间 ID**

### 3. 创建 Pages 项目

1. 进入 **Pages** → **项目管理**
2. 点击 **新建项目**
3. 选择 **从 Git 仓库导入**
4. 授权 GitHub 并选择你的仓库
5. 构建设置：
   - **框架预设**：None
   - **构建命令**：留空（不需要构建）
   - **输出目录**：留空
6. 点击 **保存并部署**

### 4. 配置 KV 绑定

1. 进入项目详情页
2. 点击 **设置** → **变量**
3. 在 **KV 命名空间绑定** 区域：
   - 变量名称：`WALINE_KV`
   - KV 命名空间：选择 `waline-kv`
4. 点击 **保存**

> **重要**: 变量名必须是 `WALINE_KV`，代码中通过 `env.WALINE_KV` 访问。

### 5. 配置环境变量

在 **设置** → **变量** 页面，添加以下环境变量：

#### 必需变量

| 变量名 | 值 | 说明 |
|-------|-----|------|
| `JWT_TOKEN` | 随机字符串 | 用于 JWT 签名，建议 32+ 字符 |
| `SITE_NAME` | 站点名称 | 如：My Blog |
| `SITE_URL` | 站点 URL | 如：https://your-site.com |

> **注意**: 第一个注册的用户将自动成为管理员，无需预设管理员密码。

#### 可选变量

```bash
# 评论审核
COMMENT_AUDIT=false

# 禁用 UA 和地域解析
DISABLE_USERAGENT=false
DISABLE_REGION=false

# IP 频率限制（秒）
IP_QPS=60

# 用户等级阈值
LEVELS=0,10,20,50,100,200

# 禁用 IP 列表
DISALLOW_IP_LIST=1.2.3.4,5.6.7.8

# 敏感词过滤
FORBIDDEN_WORDS=spam,badword

# 头像代理
AVATAR_PROXY=https://your-proxy.com

# Akismet 反垃圾
AKISMET_KEY=your-key

# SMTP 邮件
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# 其他通知
SC_KEY=serverchan-key
TG_BOT_TOKEN=telegram-token
TG_CHAT_ID=chat-id
```

### 6. 重新部署

添加环境变量后，需要重新部署：

1. 进入项目详情页
2. 点击 **重新部署**
3. 等待部署完成

### 7. 访问管理后台

部署完成后，访问：
```
https://your-project.pages.dev/ui
```

**首次使用说明：**
1. 第一个注册的用户将自动成为管理员
2. 点击"还没有账号？立即注册"进行注册
3. 注册成功后自动登录为管理员

### API 端点

部署后，以下 API 端点可用：

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/health` | GET | 健康检查 |
| `/version` | GET | 版本信息 |
| `/register` | POST | 用户注册 |
| `/token` | POST/PUT/DELETE | 登录/更新资料/退出 |
| `/comment` | GET/POST/PUT/DELETE | 评论操作 |
| `/user` | GET/PUT | 用户信息 |
| `/article` | GET/POST | 文章统计 |
| `/count` | GET | 评论计数 |
| `/recent` | GET | 最新评论 |
| `/hot` | GET | 热门评论 |
| `/stat` | GET/PUT | 统计数据 |
| `/reaction` | GET/POST | 文章反应 |
| `/admin/comment` | GET/PUT/DELETE | 管理评论 |
| `/admin/user` | GET/PUT/DELETE | 管理用户 |
| `/admin/config` | GET/PUT | 系统配置 |

### 8. 前端集成

在你的博客中添加：

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

## 更新部署

代码更新后：

```bash
git add .
git commit -m "Update"
git push
```

EdgeOne 会自动重新部署。

## 故障排查

### Error return from script
这是最常见的错误，通常由以下原因引起：
- Functions 文件使用了 `import` 语句导入外部模块
- 代码中有语法错误
- 使用了 EdgeOne 不支持的 API

**解决方法**：
1. 确保所有 Functions 文件都是自包含的（无 import 语句）
2. 检查文件结构是否正确（见上方项目结构）
3. 查看 EdgeOne Pages 的实时日志

### 注册返回 404
- 检查文件是否放在 `functions/` 根目录（不是 `functions/api/`）
- EdgeOne Pages 的路由是基于文件路径的：`functions/register.js` → `/register`

### KV 存储错误
- 检查 KV 命名空间是否正确绑定
- 检查变量名是否为 `WALINE_KV`
- 确认 KV 命名空间 ID 正确

### 登录失败
- 检查 `JWT_TOKEN` 是否设置
- 检查邮箱和密码是否正确
- 第一个注册的用户自动成为管理员

### 注册失败
- 检查邮箱格式是否正确
- 密码至少需要 6 个字符
- 查看 EdgeOne Pages 的实时日志获取详细错误信息

### 邮件发送失败
- 检查 SMTP 配置
- 部分邮箱需要应用专用密码
