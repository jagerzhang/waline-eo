# 验证码配置指南

Waline EdgeOne 版本支持多种验证码服务，用于防止垃圾评论和机器人攻击。

## 支持的验证码类型

### 1. reCAPTCHA V3 (Google)

无需用户交互，基于行为分析给出分数 (0.0 - 1.0)。

**环境变量：**
```bash
RECAPTCHA_V3_KEY=your_site_key
RECAPTCHA_V3_SECRET=your_secret_key
```

**前端配置：**
```javascript
Waline.init({
  el: '#waline',
  serverURL: 'https://your-domain.com',
  recaptchaV3Key: 'your_site_key',
});
```

---

### 2. Cloudflare Turnstile

Cloudflare 提供的隐私友好型验证码，无需用户交互。

**环境变量：**
```bash
TURNSTILE_KEY=your_site_key
TURNSTILE_SECRET=your_secret_key
```

**前端配置：**
```javascript
Waline.init({
  el: '#waline',
  serverURL: 'https://your-domain.com',
  turnstileKey: 'your_site_key',
});
```

---

### 3. 极验 Geetest (推荐国内用户使用)

极验验证码，支持滑动验证，用户体验好。

#### Geetest V4 (推荐)

**环境变量：**
```bash
GEETEST_CAPTCHA_ID=your_captcha_id
GEETEST_CAPTCHA_KEY=your_captcha_key
GEETEST_VERSION=v4
```

**前端配置：**
```javascript
Waline.init({
  el: '#waline',
  serverURL: 'https://your-domain.com',
  geetest: {
    captchaId: 'your_captcha_id',
    version: 'v4',
  },
});
```

#### Geetest V3 (旧版)

**环境变量：**
```bash
GEETEST_CAPTCHA_ID=your_captcha_id
GEETEST_CAPTCHA_KEY=your_captcha_key
GEETEST_VERSION=v3
```

**前端配置：**
```javascript
Waline.init({
  el: '#waline',
  serverURL: 'https://your-domain.com',
  geetest: {
    captchaId: 'your_captcha_id',
    version: 'v3',
  },
});
```

---

## 获取验证码密钥

### reCAPTCHA V3

1. 访问 [Google reCAPTCHA 控制台](https://www.google.com/recaptcha/admin)
2. 注册新网站，选择 reCAPTCHA v3
3. 获取站点密钥 (Site Key) 和密钥 (Secret Key)

### Cloudflare Turnstile

1. 访问 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. 添加新站点
3. 获取站点密钥 (Site Key) 和密钥 (Secret Key)

### 极验 Geetest

1. 访问 [极验控制台](https://www.geetest.com/)
2. 注册账号并创建验证应用
3. 获取验证码 ID (Captcha ID) 和密钥 (Captcha Key)

---

## 完整配置示例

### 使用 reCAPTCHA V3

```bash
# .env 文件
RECAPTCHA_V3_KEY=6Lcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RECAPTCHA_V3_SECRET=6Lcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 使用 Cloudflare Turnstile

```bash
# .env 文件
TURNSTILE_KEY=0x4AAAAAAAAxxxxxxxxxxxxxxxxxxxxxxx
TURNSTILE_SECRET=0x4AAAAAAAAxxxxxxxxxxxxxxxxxxxxxxx
```

### 使用极验 V4

```bash
# .env 文件
GEETEST_CAPTCHA_ID=your_captcha_id_here
GEETEST_CAPTCHA_KEY=your_captcha_key_here
GEETEST_VERSION=v4
```

---

## 注意事项

1. **只配置一种验证码**：同时配置多种验证码时，只有第一种会生效
2. **前端和后端要匹配**：前端使用的验证码类型必须与后端配置一致
3. **极验 V4 推荐**：对于国内用户，极验 V4 提供更好的用户体验和更高的安全性
4. **密钥安全**：不要将 Secret Key 暴露在前端代码中

---

## 故障排查

### 验证码验证失败

1. 检查环境变量是否正确配置
2. 确认前端传递的验证码参数完整
3. 查看 EdgeOne 函数日志获取详细错误信息

### 极验验证失败

1. 确认使用的是正确的版本 (v3 或 v4)
2. 检查 captchaId 和 captchaKey 是否匹配
3. 确保前端正确初始化了极验组件

### reCAPTCHA 在国内无法使用

reCAPTCHA 在国内可能无法访问，建议使用：
- Cloudflare Turnstile
- 极验 Geetest
