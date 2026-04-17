/**
 * Multi-Channel Notification Service
 * Supports: WeChat (Server酱), Telegram, Discord, Lark/Feishu, PushPlus
 */

/**
 * Send WeChat notification via Server酱 (ServerChan)
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} scKey - Server酱 SCKEY
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendWeChat(comment, parent, scKey) {
  if (!scKey) {
    return { success: false, error: 'ServerChan SCKEY not configured' };
  }

  try {
    const title = parent
      ? `💬 ${comment.nick} 回复了 ${parent.nick}`
      : `💬 新评论来自 ${comment.nick}`;

    const content = [
      `**评论内容：**`,
      comment.comment,
      ``,
      `**文章：** ${comment.url}`,
      `**邮箱：** ${comment.mail || '匿名'}`,
      `**时间：** ${new Date().toLocaleString('zh-CN')}`,
    ].join('\n');

    const response = await fetch(`https://sctapi.ftqq.com/${scKey}.send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        title,
        desp: content,
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send Telegram notification
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - Telegram Chat ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendTelegram(comment, parent, botToken, chatId) {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram bot token or chat ID not configured' };
  }

  try {
    const text = parent
      ? `💬 <b>新回复</b>\n\n<b>${comment.nick}</b> 回复了 <b>${parent.nick}</b>\n\n${comment.comment}\n\n<a href="${comment.url}">查看文章</a>`
      : `💬 <b>新评论</b>\n\n<b>${comment.nick}</b>:\n${comment.comment}\n\n<a href="${comment.url}">查看文章</a>`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send Discord notification via Webhook
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} webhookUrl - Discord Webhook URL
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendDiscord(comment, parent, webhookUrl) {
  if (!webhookUrl) {
    return { success: false, error: 'Discord webhook URL not configured' };
  }

  try {
    const embed = {
      title: parent ? '💬 新回复' : '💬 新评论',
      description: comment.comment,
      color: parent ? 0x3498db : 0x27ae60,
      fields: [
        {
          name: '评论者',
          value: comment.nick,
          inline: true,
        },
        {
          name: '文章',
          value: comment.url,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (parent) {
      embed.fields.push({
        name: '回复给',
        value: parent.nick,
        inline: true,
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send Lark/Feishu notification
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} webhookUrl - Lark Webhook URL
 * @param {string} secret - Lark Webhook Secret (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendLark(comment, parent, webhookUrl, secret) {
  if (!webhookUrl) {
    return { success: false, error: 'Lark webhook URL not configured' };
  }

  try {
    const content = [
      {
        tag: 'text',
        text: `评论者: ${comment.nick}\n`,
      },
      {
        tag: 'text',
        text: `内容: ${comment.comment}\n`,
      },
      {
        tag: 'a',
        text: '查看文章',
        href: comment.url,
      },
    ];

    if (parent) {
      content.splice(1, 0, {
        tag: 'text',
        text: `回复给: ${parent.nick}\n`,
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title: parent ? '💬 新回复' : '💬 新评论',
              content: [content],
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.msg };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send PushPlus notification
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} token - PushPlus Token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPushPlus(comment, parent, token) {
  if (!token) {
    return { success: false, error: 'PushPlus token not configured' };
  }

  try {
    const title = parent
      ? `💬 ${comment.nick} 回复了 ${parent.nick}`
      : `💬 新评论来自 ${comment.nick}`;

    const content = [
      `<b>评论内容：</b>`,
      comment.comment,
      ``,
      `<b>文章：</b> ${comment.url}`,
      `<b>时间：</b> ${new Date().toLocaleString('zh-CN')}`,
    ].join('<br>');

    const response = await fetch('http://www.pushplus.plus/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        title,
        content,
        template: 'html',
      }),
    });

    const data = await response.json();

    if (data.code !== 200) {
      return { success: false, error: data.msg };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send QQ notification via Qmsg酱
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} key - Qmsg Key
 * @param {string} qq - QQ Number (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendQQ(comment, parent, key, qq) {
  if (!key) {
    return { success: false, error: 'Qmsg key not configured' };
  }

  try {
    const msg = parent
      ? `💬 新回复\n${comment.nick} 回复了 ${parent.nick}:\n${comment.comment}\n文章: ${comment.url}`
      : `💬 新评论\n${comment.nick}:\n${comment.comment}\n文章: ${comment.url}`;

    const params = new URLSearchParams({
      msg,
    });

    if (qq) {
      params.append('qq', qq);
    }

    const response = await fetch(`https://qmsg.zendee.cn/send/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();

    if (data.code !== 0) {
      return { success: false, error: data.reason };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to all configured channels
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {Object} config - Notification configuration
 * @returns {Promise<Array<{channel: string, success: boolean, error?: string}>>}
 */
export async function sendToAllChannels(comment, parent, config) {
  const results = [];

  // WeChat (ServerChan)
  if (config.SC_KEY) {
    results.push({
      channel: 'wechat',
      ...(await sendWeChat(comment, parent, config.SC_KEY)),
    });
  }

  // Telegram
  if (config.TG_BOT_TOKEN && config.TG_CHAT_ID) {
    results.push({
      channel: 'telegram',
      ...(await sendTelegram(comment, parent, config.TG_BOT_TOKEN, config.TG_CHAT_ID)),
    });
  }

  // Discord
  if (config.DISCORD_WEBHOOK) {
    results.push({
      channel: 'discord',
      ...(await sendDiscord(comment, parent, config.DISCORD_WEBHOOK)),
    });
  }

  // Lark/Feishu
  if (config.LARK_WEBHOOK) {
    results.push({
      channel: 'lark',
      ...(await sendLark(comment, parent, config.LARK_WEBHOOK, config.LARK_SECRET)),
    });
  }

  // PushPlus
  if (config.PUSH_PLUS_KEY) {
    results.push({
      channel: 'pushplus',
      ...(await sendPushPlus(comment, parent, config.PUSH_PLUS_KEY)),
    });
  }

  // QQ (Qmsg)
  if (config.QMSG_KEY) {
    results.push({
      channel: 'qq',
      ...(await sendQQ(comment, parent, config.QMSG_KEY, config.QQ_ID)),
    });
  }

  return results;
}

export default {
  sendWeChat,
  sendTelegram,
  sendDiscord,
  sendLark,
  sendPushPlus,
  sendQQ,
  sendToAllChannels,
};
