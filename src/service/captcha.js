/**
 * CAPTCHA Verification Service
 * Supports reCAPTCHA V3 and Cloudflare Turnstile
 */

/**
 * Verify reCAPTCHA V3 token
 * @param {string} token - reCAPTCHA token
 * @param {string} secret - reCAPTCHA secret key
 * @param {string} remoteIp - User IP address
 * @returns {Promise<{success: boolean, score?: number, error?: string}>}
 */
export async function verifyRecaptchaV3(token, secret, remoteIp) {
  if (!token || !secret) {
    return { success: false, error: 'Missing token or secret' };
  }

  try {
    const params = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed',
      };
    }

    // reCAPTCHA V3 returns a score (0.0 - 1.0)
    // Scores >= 0.5 are typically considered human
    return {
      success: true,
      score: data.score || 0,
      action: data.action,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify Cloudflare Turnstile token
 * @param {string} token - Turnstile token
 * @param {string} secret - Turnstile secret key
 * @param {string} remoteIp - User IP address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyTurnstile(token, secret, remoteIp) {
  if (!token || !secret) {
    return { success: false, error: 'Missing token or secret' };
  }

  try {
    const body = {
      secret,
      response: token,
    };

    if (remoteIp) {
      body.remoteip = remoteIp;
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify CAPTCHA token (auto-detect type)
 * @param {Object} options - Verification options
 * @param {string} options.token - CAPTCHA token
 * @param {string} options.type - 'recaptcha-v3' or 'turnstile'
 * @param {string} options.secret - CAPTCHA secret key
 * @param {string} options.remoteIp - User IP address
 * @returns {Promise<{success: boolean, score?: number, error?: string}>}
 */
export async function verifyCaptcha({ token, type, secret, remoteIp }) {
  if (!token) {
    return { success: false, error: 'CAPTCHA token required' };
  }

  if (type === 'recaptcha-v3') {
    return verifyRecaptchaV3(token, secret, remoteIp);
  }

  if (type === 'turnstile') {
    return verifyTurnstile(token, secret, remoteIp);
  }

  return { success: false, error: 'Unknown CAPTCHA type' };
}

export default {
  verifyRecaptchaV3,
  verifyTurnstile,
  verifyCaptcha,
};
