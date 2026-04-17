/**
 * Notification Service for Waline
 * Supports: Email (SMTP), WeChat (ServerChan), Telegram, QQ, Discord, Lark/Feishu
 * EdgeOne Pages Functions compatible - no Node.js dependencies
 */

// Default templates matching official Waline behavior
const DEFAULT_TEMPLATES = {
  mailSubject: '{{site.name}} 上有新评论了',
  mailTemplate: `<div style="border-top:3px solid #60a5fa;padding:20px;background:#f8fafc;border-radius:8px;font-family:system-ui,-apple-system,sans-serif">
  <h2 style="color:#1e40af;margin-top:0">{{site.name}}</h2>
  <p><strong>{{self.nick}}</strong> 回复说：</p>
  <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #60a5fa;margin:15px 0">
    {{{self.comment}}}
  </div>
  <p>来自：<a href="{{self.url}}" style="color:#2563eb;text-decoration:none">{{self.url}}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
  <p style="color:#64748b;font-size:14px">此邮件由 Waline 自动发送，请勿直接回复。</p>
</div>`,
  mailToAdminSubject: '{{site.name}} 上有新评论了',
  mailToAdminTemplate: `<div style="border-top:3px solid #60a5fa;padding:20px;background:#f8fafc;border-radius:8px;font-family:system-ui,-apple-system,sans-serif">
  <h2 style="color:#1e40af;margin-top:0">{{site.name}}</h2>
  <p><strong>{{self.nick}}</strong> 评论说：</p>
  <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #60a5fa;margin:15px 0">
    {{{self.comment}}}
  </div>
  <p>邮箱：{{self.mail}}</p>
  <p>网址：{{self.link}}</p>
  <p>来自：<a href="{{self.url}}" style="color:#2563eb;text-decoration:none">{{self.url}}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
  <p style="color:#64748b;font-size:14px">此邮件由 Waline 自动发送，请勿直接回复。</p>
</div>`,
  mailToGuestSubject: '您在 {{site.name}} 上的评论收到了回复',
  mailToGuestTemplate: `<div style="border-top:3px solid #60a5fa;padding:20px;background:#f8fafc;border-radius:8px;font-family:system-ui,-apple-system,sans-serif">
  <h2 style="color:#1e40af;margin-top:0">{{site.name}}</h2>
  <p>您好，<strong>{{parent.nick}}</strong></p>
  <p>您曾评论：</p>
  <div style="background:#f1f5f9;padding:12px;border-radius:6px;margin:10px 0;color:#475569">
    {{{parent.comment}}}
  </div>
  <p><strong>{{self.nick}}</strong> 回复说：</p>
  <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #60a5fa;margin:15px 0">
    {{{self.comment}}}
  </div>
  <p>来自：<a href="{{self.url}}" style="color:#2563eb;text-decoration:none">{{self.url}}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
  <p style="color:#64748b;font-size:14px">此邮件由 Waline 自动发送，请勿直接回复。</p>
</div>`
};

/**
 * Format date string
 * @param {string|Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, '0');
  return format
    .replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

/**
 * Render template with data using simple template strings
 * @param {string} template - Template string
 * @param {object} data - Data to render
 * @returns {string} Rendered string
 */
function renderTemplate(template, data) {
  try {
    if (!template) return '';

    let result = template;

    // Handle {{{var}}} - raw HTML (unescaped)
    result = result.replace(/\{\{\{([^}]+)\}\}\}/g, (match, path) => {
      const value = getValueByPath(data, path.trim());
      return value !== undefined ? value : '';
    });

    // Handle {{var}} - escaped HTML
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getValueByPath(data, path.trim());
      return value !== undefined ? escapeHtml(value) : '';
    });

    return result;
  } catch (e) {
    console.error('Template render error:', e);
    return template;
  }
}

/**
 * Get value from object by dot path
 * @param {object} obj - Object to traverse
 * @param {string} path - Dot notation path
 * @returns {any} Value at path
 */
function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;

  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }

  return value;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send Email notification via SMTP
 * @param {object} options - Email options
 * @param {object} config - SMTP configuration
 * @returns {Promise<boolean>}
 */
async function sendEmail(options, config) {
  if (!config || !config.host) {
    return false;
  }

  try {
    const { from } = config;

    // Build email data
    const emailData = {
      from: from || config.user,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    // Use fetch to send email via SMTP relay or API
    if (config.service === 'sendgrid') {
      return await sendSendGrid(emailData, config);
    } else if (config.service === 'mailgun') {
      return await sendMailgun(emailData, config);
    } else if (config.service === 'postmark') {
      return await sendPostmark(emailData, config);
    } else if (config.service === 'resend') {
      return await sendResend(emailData, config);
    }

    // Standard SMTP via Cloudflare Email Routing or similar
    return await sendSMTP(emailData, config);
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * Send via SendGrid API
 */
async function sendSendGrid(data, config) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: data.to }] }],
      from: { email: data.from },
      subject: data.subject,
      content: [
        { type: 'text/html', value: data.html }
      ]
    })
  });
  return response.ok;
}

/**
 * Send via Mailgun API
 */
async function sendMailgun(data, config) {
  const formData = new URLSearchParams();
  formData.append('from', data.from);
  formData.append('to', data.to);
  formData.append('subject', data.subject);
  formData.append('html', data.html);

  const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.apiKey}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });
  return response.ok;
}

/**
 * Send via Postmark API
 */
async function sendPostmark(data, config) {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': config.apiKey
    },
    body: JSON.stringify({
      From: data.from,
      To: data.to,
      Subject: data.subject,
      HtmlBody: data.html,
      TextBody: data.text
    })
  });
  return response.ok;
}

/**
 * Send via Resend API
 */
async function sendResend(data, config) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: data.from,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text
    })
  });
  return response.ok;
}

/**
 * Send via SMTP (using external relay)
 */
async function sendSMTP(data, config) {
  // For EdgeOne/Worker environment, use a compatible SMTP relay service
  // This is a placeholder for SMTP implementation
  console.log('SMTP not directly supported in EdgeOne, use API-based email service');
  return false;
}

/**
 * Send WeChat notification via ServerChan
 * @param {object} options - Notification options
 * @param {string} key - ServerChan key
 * @returns {Promise<boolean>}
 */
async function sendWeChat(options, key) {
  if (!key) {
    return false;
  }

  try {
    const url = `https://sctapi.ftqq.com/${key}.send`;
    const formData = new URLSearchParams();
    formData.append('title', options.title.substring(0, 100));
    formData.append('desp', options.content.substring(0, 1000));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const result = await response.json();
    return result.code === 0;
  } catch (error) {
    console.error('WeChat notification error:', error);
    return false;
  }
}

/**
 * Send Telegram notification
 * @param {object} options - Notification options
 * @param {object} config - Telegram config (botToken, chatId)
 * @returns {Promise<boolean>}
 */
async function sendTelegram(options, config) {
  if (!config || !config.botToken || !config.chatId) {
    return false;
  }

  try {
    const { botToken, chatId } = config;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const text = `<b>${escapeHtml(options.title)}</b>\n\n${escapeHtml(options.content)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('Telegram notification error:', error);
    return false;
  }
}

/**
 * Send QQ notification via CoolPush/Qmsg
 * @param {object} options - Notification options
 * @param {object} config - QQ config (key, type)
 * @returns {Promise<boolean>}
 */
async function sendQQ(options, config) {
  if (!config || !config.key) {
    return false;
  }

  try {
    const { key, type = 'send' } = config;

    // CoolPush
    if (type === 'coolpush') {
      const url = `https://push.xuthus.cc/${config.coolType || 'send'}/${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          c: `${options.title}\n${options.content}`
        })
      });
      const result = await response.json();
      return result.code === 200;
    }

    // Qmsg
    const url = `https://qmsg.zendee.cn/send/${key}`;
    const formData = new URLSearchParams();
    formData.append('msg', `${options.title}\n${options.content}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const result = await response.json();
    return result.success === true || result.code === 0;
  } catch (error) {
    console.error('QQ notification error:', error);
    return false;
  }
}

/**
 * Send Discord notification via webhook
 * @param {object} options - Notification options
 * @param {string} webhookUrl - Discord webhook URL
 * @returns {Promise<boolean>}
 */
async function sendDiscord(options, webhookUrl) {
  if (!webhookUrl) {
    return false;
  }

  try {
    const embed = {
      title: options.title.substring(0, 256),
      description: options.content.substring(0, 4096),
      color: 3447003,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Waline Comment System'
      }
    };

    if (options.url) {
      embed.url = options.url;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'Waline',
        embeds: [embed]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}

/**
 * Send Lark/Feishu notification via webhook
 * @param {object} options - Notification options
 * @param {object} config - Lark config (webhook, secret)
 * @returns {Promise<boolean>}
 */
async function sendLark(options, config) {
  if (!config || !config.webhook) {
    return false;
  }

  try {
    const { webhook, secret } = config;

    const headers = {
      'Content-Type': 'application/json'
    };

    let body = {
      msg_type: 'interactive',
      card: {
        config: {
          wide_screen_mode: true
        },
        header: {
          title: {
            tag: 'plain_text',
            content: options.title
          },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: options.content
            }
          }
        ]
      }
    };

    // If secret is provided, generate signature
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = await generateLarkSign(secret, timestamp);
      body = {
        timestamp,
        sign,
        ...body
      };
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const result = await response.json();
    return result.code === 0;
  } catch (error) {
    console.error('Lark notification error:', error);
    return false;
  }
}

/**
 * Generate Lark/Feishu signature
 * @param {string} secret - Webhook secret
 * @param {number} timestamp - Unix timestamp
 * @returns {Promise<string>} Base64 encoded signature
 */
async function generateLarkSign(secret, timestamp) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}\n${secret}`)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML text
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Main notification function
 * @param {object} comment - Comment data
 * @param {object} parent - Parent comment data (for replies)
 * @param {object} config - Notification configuration
 * @returns {Promise<object>} Notification results
 */
async function notify(comment, parent, config) {
  const results = {
    email: false,
    wechat: false,
    telegram: false,
    qq: false,
    discord: false,
    lark: false
  };

  if (!config) {
    return results;
  }

  const siteConfig = {
    name: config.siteName || 'Waline',
    url: config.siteUrl || ''
  };

  const selfData = {
    nick: comment.nick,
    mail: comment.mail,
    link: comment.link,
    url: comment.url,
    comment: comment.comment,
    createdAt: comment.createdAt || new Date().toISOString()
  };

  const parentData = parent ? {
    nick: parent.nick,
    mail: parent.mail,
    comment: parent.comment
  } : null;

  const templateData = {
    site: siteConfig,
    self: selfData,
    parent: parentData
  };

  // Determine notification targets
  const isReply = !!parent;
  const notifyAdmin = config.notifyAdmin !== false;
  const notifyReply = isReply && config.notifyReply !== false;

  // Send email notifications
  if (config.email) {
    try {
      if (notifyAdmin && config.authorEmail) {
        const subject = renderTemplate(
          config.mailSubject || DEFAULT_TEMPLATES.mailToAdminSubject,
          templateData
        );
        const html = renderTemplate(
          config.mailTemplate || DEFAULT_TEMPLATES.mailToAdminTemplate,
          templateData
        );

        results.email = await sendEmail({
          to: config.authorEmail,
          subject,
          html,
          text: stripHtml(html)
        }, config.email);
      }

      if (notifyReply && parentData && parentData.mail) {
        const subject = renderTemplate(
          config.mailToGuestSubject || DEFAULT_TEMPLATES.mailToGuestSubject,
          templateData
        );
        const html = renderTemplate(
          config.mailToGuestTemplate || DEFAULT_TEMPLATES.mailToGuestTemplate,
          templateData
        );

        results.email = await sendEmail({
          to: parentData.mail,
          subject,
          html,
          text: stripHtml(html)
        }, config.email) || results.email;
      }
    } catch (error) {
      console.error('Email notification error:', error);
    }
  }

  // Prepare common notification content
  const notificationTitle = isReply
    ? `${selfData.nick} 回复了 ${parentData.nick}`
    : `${selfData.nick} 发表了新评论`;

  const notificationContent = stripHtml(selfData.comment).substring(0, 500);

  // Send WeChat notification
  if (config.wechat) {
    try {
      results.wechat = await sendWeChat({
        title: notificationTitle,
        content: notificationContent
      }, config.wechat);
    } catch (error) {
      console.error('WeChat notification error:', error);
    }
  }

  // Send Telegram notification
  if (config.telegram) {
    try {
      results.telegram = await sendTelegram({
        title: notificationTitle,
        content: notificationContent,
        url: selfData.url
      }, config.telegram);
    } catch (error) {
      console.error('Telegram notification error:', error);
    }
  }

  // Send QQ notification
  if (config.qq) {
    try {
      results.qq = await sendQQ({
        title: notificationTitle,
        content: notificationContent
      }, config.qq);
    } catch (error) {
      console.error('QQ notification error:', error);
    }
  }

  // Send Discord notification
  if (config.discord) {
    try {
      results.discord = await sendDiscord({
        title: notificationTitle,
        content: notificationContent,
        url: selfData.url
      }, config.discord);
    } catch (error) {
      console.error('Discord notification error:', error);
    }
  }

  // Send Lark notification
  if (config.lark) {
    try {
      results.lark = await sendLark({
        title: notificationTitle,
        content: notificationContent
      }, config.lark);
    } catch (error) {
      console.error('Lark notification error:', error);
    }
  }

  return results;
}

export {
  notify,
  sendEmail,
  sendWeChat,
  sendTelegram,
  sendQQ,
  sendDiscord,
  sendLark,
  renderTemplate,
  DEFAULT_TEMPLATES
};
