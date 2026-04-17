# OAuth 社交登录配置

Waline EdgeOne 完全兼容官方 Waline 的 OAuth 社交登录功能，使用相同的 OAuth 代理服务。

## 支持的 OAuth 提供商

| 提供商 | type 参数 | 说明 |
|-------|----------|------|
| GitHub | `github` | 全球最大的代码托管平台 |
| QQ | `qq` | 腾讯 QQ 登录 |
| 微博 (Weibo) | `weibo` | 新浪微博登录 |
| Twitter/X | `twitter` | Twitter/X 登录 |
| Facebook | `facebook` | Facebook 登录 |

## 使用方法

### 1. 前端发起 OAuth 登录

```javascript
// 方式一：直接跳转
window.location.href = 'https://your-waline-edgeone.com/oauth?type=github&redirect=https://your-site.com/callback';

// 方式二：使用 @waline/client
import { init } from '@waline/client';

init({
  el: '#waline',
  serverURL: 'https://your-waline-edgeone.com',
  path: window.location.pathname,
  // 社交登录按钮会自动显示
});
```

### 2. 回调处理

用户授权后，会重定向到：
```
https://your-site.com/callback?token=xxx&refreshToken=xxx
```

前端获取 token 后保存到 localStorage：
```javascript
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (token) {
  localStorage.setItem('waline-token', token);
  // 刷新页面或更新用户状态
  window.location.href = '/';
}
```

### 3. 绑定社交账号

已登录用户可以绑定社交账号：
```javascript
// 用户已登录，带上当前 token
fetch('/oauth?type=github', {
  headers: {
    'Authorization': `Bearer ${currentToken}`
  }
});
```

## OAuth 流程说明

```
1. 用户点击"GitHub 登录"
   ↓
2. 请求 /oauth?type=github&redirect=xxx
   ↓
3. 服务端重定向到 https://oauth.lithub.cc/github?redirect=xxx&state=xxx
   ↓
4. 用户在 GitHub 授权页面确认
   ↓
5. GitHub 重定向回 https://oauth.lithub.cc/github/callback?code=xxx
   ↓
6. OAuth 代理获取用户信息
   ↓
7. 重定向回 /oauth?type=github&code=xxx&state=xxx
   ↓
8. 服务端通过 code 向 OAuth 代理获取用户信息
   ↓
9. 创建或关联用户账号
   ↓
10. 生成 JWT token，重定向回前端
```

## 用户信息字段

OAuth 登录成功后，会获取以下用户信息：

```javascript
{
  id: '123456',           // 社交平台的用户 ID
  name: 'User Name',      // 用户昵称
  email: 'user@example.com',  // 邮箱（可能为空）
  avatar: 'https://...',  // 头像 URL
  url: 'https://...'      // 个人主页（可能为空）
}
```

## 账号关联逻辑

1. **新用户**：自动创建账号，密码为空（只能通过 OAuth 登录）
2. **已有社交绑定**：直接登录关联的账号
3. **邮箱匹配**：如果 OAuth 邮箱与现有账号相同，自动关联
4. **手动绑定**：已登录用户可以在个人设置中绑定社交账号

## 环境变量

```bash
# OAuth 代理 URL（可选，默认使用官方代理）
OAUTH_URL=https://oauth.lithub.cc

# 站点 URL（用于 OAuth 回调）
SITE_URL=https://your-site.com
```

## 注意事项

1. **无需配置 GitHub/QQ 等 App** - 使用官方 OAuth 代理，已配置好所有平台
2. **邮箱问题** - 部分平台（如 Twitter）可能不提供邮箱，需要用户补充
3. **头像同步** - 首次登录会同步头像，之后可以在个人设置中修改
4. **账号安全** - OAuth 用户没有密码，只能通过社交账号登录

## 自定义 OAuth 代理

如果需要使用自己的 OAuth 代理：

```bash
OAUTH_URL=https://your-oauth-proxy.com
```

代理服务需要实现以下接口：
- `GET /{provider}?redirect=xxx&state=xxx` - 重定向到 OAuth 授权页
- `GET /{provider}?code=xxx` - 通过 code 获取用户信息

返回格式：
```json
{
  "id": "123456",
  "name": "User Name",
  "email": "user@example.com",
  "avatar": "https://...",
  "url": "https://..."
}
```
