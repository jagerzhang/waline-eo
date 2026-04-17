/**
 * CAPTCHA Verification Service
 * Supports reCAPTCHA V3, Cloudflare Turnstile, and Geetest (极验)
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
 * Verify Geetest (极验) CAPTCHA
 * @param {Object} params - Geetest validation parameters
 * @param {string} params.geetest_challenge - Geetest challenge
 * @param {string} params.geetest_validate - Geetest validate
 * @param {string} params.geetest_seccode - Geetest seccode
 * @param {string} captchaId - Geetest captcha ID
 * @param {string} captchaKey - Geetest captcha key
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyGeetest(params, captchaId, captchaKey) {
  if (!params || !captchaId || !captchaKey) {
    return { success: false, error: 'Missing Geetest parameters' };
  }

  const { geetest_challenge, geetest_validate, geetest_seccode } = params;

  if (!geetest_challenge || !geetest_validate || !geetest_seccode) {
    return { success: false, error: 'Incomplete Geetest validation data' };
  }

  try {
    // Geetest validate API endpoint
    const url = 'http://api.geetest.com/validate.php';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        captcha_id: captchaId,
        captcha_key: captchaKey,
        geetest_challenge,
        geetest_validate,
        geetest_seccode,
      }),
    });

    const data = await response.json();

    // Geetest returns seccode on success
    if (data.seccode && data.seccode === geetest_seccode) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Geetest validation failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify Geetest CAPTCHA v4 (newer version)
 * @param {string} captchaId - Geetest captcha ID
 * @param {string} lotNumber - Lot number from frontend
 * @param {string} captchaOutput - Captcha output from frontend
 * @param {string} passToken - Pass token from frontend
 * @param {string} genTime - Generation time
 * @param {string} captchaKey - Geetest captcha key
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyGeetestV4(captchaId, lotNumber, captchaOutput, passToken, genTime, captchaKey) {
  if (!captchaId || !lotNumber || !captchaOutput || !passToken || !genTime || !captchaKey) {
    return { success: false, error: 'Missing Geetest v4 parameters' };
  }

  try {
    // Geetest v4 validate API endpoint
    const url = 'https://gcaptcha4.geetest.com/validate';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        captcha_id: captchaId,
        lot_number: lotNumber,
        captcha_output: captchaOutput,
        pass_token: passToken,
        gen_time: genTime,
        captcha_key: captchaKey,
      }),
    });

    const data = await response.json();

    // Geetest v4 returns result and reason
    if (data.result === 'success') {
      return { success: true };
    }

    return {
      success: false,
      error: data.reason || 'Geetest v4 validation failed',
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
 * @param {string} options.type - 'recaptcha-v3', 'turnstile', 'geetest', or 'geetest-v4'
 * @param {string} options.secret - CAPTCHA secret key
 * @param {string} options.remoteIp - User IP address
 * @param {Object} options.geetestParams - Geetest specific parameters
 * @returns {Promise<{success: boolean, score?: number, error?: string}>}
 */
export async function verifyCaptcha({ token, type, secret, remoteIp, geetestParams = {} }) {
  if (!token && type !== 'geetest' && type !== 'geetest-v4') {
    return { success: false, error: 'CAPTCHA token required' };
  }

  if (type === 'recaptcha-v3') {
    return verifyRecaptchaV3(token, secret, remoteIp);
  }

  if (type === 'turnstile') {
    return verifyTurnstile(token, secret, remoteIp);
  }

  if (type === 'geetest') {
    const { captchaId, captchaKey, ...params } = geetestParams;
    return verifyGeetest(params, captchaId, captchaKey);
  }

  if (type === 'geetest-v4') {
    const { captchaId, lotNumber, captchaOutput, passToken, genTime, captchaKey } = geetestParams;
    return verifyGeetestV4(captchaId, lotNumber, captchaOutput, passToken, genTime, captchaKey);
  }

  return { success: false, error: 'Unknown CAPTCHA type' };
}

export default {
  verifyRecaptchaV3,
  verifyTurnstile,
  verifyGeetest,
  verifyGeetestV4,
  verifyCaptcha,
};
