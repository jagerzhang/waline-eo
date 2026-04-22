export interface Env {
  // Environment variables
  JWT_SECRET?: string;
  SITE_NAME?: string;
  SITE_URL?: string;
  SECURE_DOMAINS?: string;
  DISABLE_USERAGENT?: string;
  DISABLE_REGION?: string;
  IPQPS?: string;
  AUDIT?: string;
  COMMENT_AUDIT?: string;
  AUTHOR_EMAIL?: string;
  LEVELS?: string;

  // SMTP
  SMTP_SERVICE?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_SECURE?: string;
  SENDER_NAME?: string;
  SENDER_EMAIL?: string;

  // Mail templates
  MAIL_SUBJECT?: string;
  MAIL_TEMPLATE?: string;
  MAIL_SUBJECT_ADMIN?: string;
  MAIL_TEMPLATE_ADMIN?: string;

  // PushPlus
  PUSH_PLUS_KEY?: string;
  PUSH_PLUS_TOPIC?: string;
  PUSH_PLUS_TEMPLATE?: string;
  PUSH_PLUS_CHANNEL?: string;
  PUSH_PLUS_WEBHOOK?: string;
  PUSH_PLUS_CALLBACKURL?: string;

  // OAuth
  OAUTH_URL?: string;

  // Anti-spam
  AKISMET_KEY?: string;

  // CAPTCHA
  TURNSTILE_KEY?: string;
  TURNSTILE_SECRET?: string;
  RECAPTCHA_V3_KEY?: string;
  RECAPTCHA_V3_SECRET?: string;

  // Geetest CAPTCHA v4
  GEETEST_CAPTCHA_ID?: string;
  GEETEST_CAPTCHA_KEY?: string;
}

export interface UserInfo {
  objectId: number;
  display_name: string;
  email: string;
  type: string;
  url: string;
  avatar: string;
  label?: string;
  github?: string;
  twitter?: string;
  facebook?: string;
  google?: string;
  weibo?: string;
  qq?: string;
  '2fa'?: string;
}

export interface Variables {
  userInfo?: UserInfo;
}
