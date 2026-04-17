# EdgeOne 部署指南

## 部署步骤

### 1. 创建 GitHub 仓库

```bash
# 进入项目目录
cd D:\qoder\waline-edgeone-full

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

### 5. 配置环境变量

在 **设置** → **变量** 页面，添加以下环境变量：

#### 必需变量

| 变量名 | 值 | 说明 |
|-------|-----|------|
| `JWT_TOKEN` | 随机字符串 | 生成：`openssl rand -base64 32` |
| `ADMIN_EMAIL` | 你的邮箱 | 管理员登录邮箱 |
| `ADMIN_PASSWORD_HASH` | SHA256 哈希 | 见下方生成方法 |
| `SITE_NAME` | 站点名称 | 如：My Blog |
| `SITE_URL` | 站点 URL | 如：https://your-site.com |

#### 生成密码哈希

在浏览器控制台运行：
```javascript
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
sha256('你的密码').then(console.log);
```

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

使用管理员邮箱和密码登录。

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

### 部署失败
- 检查 `functions/index.js` 是否存在
- 检查依赖是否正确安装

### KV 错误
- 检查 KV 命名空间是否正确绑定
- 检查变量名是否为 `WALINE_KV`

### 登录失败
- 检查 `JWT_TOKEN` 是否设置
- 检查 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD_HASH` 是否正确

### 邮件发送失败
- 检查 SMTP 配置
- 部分邮箱需要应用专用密码
