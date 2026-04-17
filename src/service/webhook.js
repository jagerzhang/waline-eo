/**
 * Webhook Notification Service
 * Sends comment notifications to custom webhook URLs
 */

/**
 * Send webhook notification
 * @param {Object} comment - Comment data
 * @param {Object} parent - Parent comment (for replies)
 * @param {string} webhookUrl - Webhook URL
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendWebhook(comment, parent, webhookUrl, options = {}) {
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const payload = {
      event: parent ? 'reply' : 'comment',
      comment: {
        id: comment.objectId || comment.id,
        nick: comment.nick,
        mail: comment.mail,
        link: comment.link,
        content: comment.comment,
        url: comment.url,
        status: comment.status,
        createdAt: comment.insertedAt || comment.createdAt,
      },
      site: {
        name: options.siteName || 'Waline',
        url: options.siteUrl || '',
      },
    };

    // Add parent info if it's a reply
    if (parent) {
      payload.parent = {
        id: parent.objectId || parent.id,
        nick: parent.nick,
        mail: parent.mail,
        content: parent.comment,
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Waline-Webhook/1.0',
        'X-Waline-Event': parent ? 'reply' : 'comment',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${await response.text()}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  sendWebhook,
};
