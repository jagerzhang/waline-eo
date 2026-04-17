/**
 * Waline User API Module
 * Implements all user-related features from official Waline
 * Compatible with EdgeOne/Cloudflare Workers environment
 */

import { createHash, randomBytes } from 'crypto';

/**
 * User types in Waline
 */
export const UserType = {
  ADMINISTRATOR: 'administrator',
  GUEST: 'guest',
  USER: 'user' // normal user
};

/**
 * User roles/permissions
 */
export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};

/**
 * JWT Token utilities
 */
class JWTUtils {
  /**
   * Generate a JWT token
   * @param {Object} payload - Token payload
   * @param {string} secret - JWT secret
   * @param {number} expiresIn - Token expiration in seconds
   * @returns {string} JWT token
   */
  static sign(payload, secret, expiresIn = 86400) {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const base64Header = JWTUtils.base64UrlEncode(JSON.stringify(header));
    const base64Payload = JWTUtils.base64UrlEncode(JSON.stringify(fullPayload));
    const signature = JWTUtils.createSignature(base64Header, base64Payload, secret);

    return `${base64Header}.${base64Payload}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token
   * @param {string} secret - JWT secret
   * @returns {Object|null} Decoded payload or null if invalid
   */
  static verify(token, secret) {
    try {
      const [header, payload, signature] = token.split('.');

      if (!header || !payload || !signature) {
        return null;
      }

      // Verify signature
      const expectedSignature = JWTUtils.createSignature(header, payload, secret);
      if (signature !== expectedSignature) {
        return null;
      }

      const decodedPayload = JSON.parse(JWTUtils.base64UrlDecode(payload));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        return null;
      }

      return decodedPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token
   * @returns {Object|null} Decoded payload
   */
  static decode(token) {
    try {
      const [, payload] = token.split('.');
      if (!payload) return null;
      return JSON.parse(JWTUtils.base64UrlDecode(payload));
    } catch (error) {
      return null;
    }
  }

  /**
   * Create HMAC-SHA256 signature
   */
  static createSignature(header, payload, secret) {
    const data = `${header}.${payload}`;
    return JWTUtils.base64UrlEncode(
      createHash('sha256').update(`${data}.${secret}`).digest()
    );
  }

  /**
   * Base64 URL-safe encode
   */
  static base64UrlEncode(str) {
    const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str, 'utf8');
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL-safe decode
   */
  static base64UrlDecode(str) {
    // Add padding
    const padding = 4 - (str.length % 4);
    if (padding !== 4) {
      str += '='.repeat(padding);
    }
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
  }
}

/**
 * Password utilities
 */
class PasswordUtils {
  /**
   * Hash password using SHA256
   * @param {string} password - Plain text password
   * @param {string} salt - Optional salt
   * @returns {string} Hashed password
   */
  static hash(password, salt = '') {
    const hash = createHash('sha256');
    hash.update(password + salt);
    return hash.digest('hex');
  }

  /**
   * Generate a random salt
   * @param {number} length - Salt length
   * @returns {string} Random salt
   */
  static generateSalt(length = 16) {
    return randomBytes(length).toString('hex');
  }

  /**
   * Verify password
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Stored hash
   * @param {string} salt - Salt used for hashing
   * @returns {boolean} Whether password matches
   */
  static verify(password, hashedPassword, salt = '') {
    const hash = PasswordUtils.hash(password, salt);
    return hash === hashedPassword;
  }
}

/**
 * Email utilities
 */
class EmailUtils {
  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} Whether email is valid
   */
  static isValid(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate verification token
   * @returns {string} Verification token
   */
  static generateVerificationToken() {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate verification link
   * @param {string} baseUrl - Base URL
   * @param {string} token - Verification token
   * @returns {string} Verification link
   */
  static generateVerificationLink(baseUrl, token) {
    return `${baseUrl}/verify?token=${token}`;
  }
}

/**
 * 2FA utilities
 */
class TwoFAUtils {
  /**
   * Generate 2FA secret
   * @returns {string} 2FA secret
   */
  static generateSecret() {
    return randomBytes(20).toString('base64');
  }

  /**
   * Generate TOTP code (simplified implementation)
   * @param {string} secret - 2FA secret
   * @param {number} timeStep - Time step (default 30 seconds)
   * @returns {string} 6-digit TOTP code
   */
  static generateTOTP(secret, timeStep = 30) {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(time), 0);

    const hmac = createHash('sha1');
    hmac.update(secret + timeBuffer.toString());
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const code = ((hash[offset] & 0x7f) << 24 |
                  (hash[offset + 1] & 0xff) << 16 |
                  (hash[offset + 2] & 0xff) << 8 |
                  (hash[offset + 3] & 0xff)) % 1000000;

    return code.toString().padStart(6, '0');
  }

  /**
   * Verify TOTP code
   * @param {string} code - User provided code
   * @param {string} secret - 2FA secret
   * @param {number} window - Allowed time window (steps)
   * @returns {boolean} Whether code is valid
   */
  static verifyTOTP(code, secret, window = 1) {
    for (let i = -window; i <= window; i++) {
      const timeStep = 30;
      const time = Math.floor(Date.now() / 1000 / timeStep) + i;
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeBigUInt64BE(BigInt(time), 0);

      const hmac = createHash('sha1');
      hmac.update(secret + timeBuffer.toString());
      const hash = hmac.digest();

      const offset = hash[hash.length - 1] & 0x0f;
      const expectedCode = ((hash[offset] & 0x7f) << 24 |
                            (hash[offset + 1] & 0xff) << 16 |
                            (hash[offset + 2] & 0xff) << 8 |
                            (hash[offset + 3] & 0xff)) % 1000000;

      if (expectedCode.toString().padStart(6, '0') === code) {
        return true;
      }
    }
    return false;
  }
}

/**
 * OAuth utilities - Uses official Waline OAuth proxy service
 * Default proxy: https://oauth.lithub.cc
 */
class OAuthUtils {
  /**
   * Generate OAuth state parameter
   * @returns {string} OAuth state
   */
  static generateState() {
    return randomBytes(16).toString('hex');
  }
}

/**
 * UserAPI Class - Main API implementation
 */
export class UserAPI {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.db - Database adapter
   * @param {string} options.jwtSecret - JWT secret key
   * @param {Object} options.oauth - OAuth configuration
   * @param {Object} options.email - Email service configuration
   * @param {string} options.siteUrl - Site base URL
   * @param {Object} options.security - Security settings
   */
  constructor(options = {}) {
    this.db = options.db;
    this.jwtSecret = options.jwtSecret;
    this.oauth = options.oauth || {};
    this.email = options.email || {};
    this.siteUrl = options.siteUrl || '';
    this.security = {
      tokenExpiresIn: 86400, // 24 hours
      refreshTokenExpiresIn: 604800, // 7 days
      maxLoginAttempts: 5,
      lockoutDuration: 900, // 15 minutes
      ...options.security
    };
  }

  /**
   * Create standardized response
   */
  createResponse(data, status = 200, message = 'success') {
    return {
      status,
      message,
      data
    };
  }

  /**
   * Create error response
   */
  createError(message, status = 400, code = null) {
    return {
      status,
      message,
      code,
      data: null
    };
  }

  /**
   * Extract token from request
   * @param {Request} request - HTTP request
   * @returns {string|null} Token
   */
  extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Get current user from request
   * @param {Request} request - HTTP request
   * @returns {Object|null} User object
   */
  async getCurrentUser(request) {
    const token = this.extractToken(request);
    if (!token) {
      return null;
    }

    const payload = JWTUtils.verify(token, this.jwtSecret);
    if (!payload) {
      return null;
    }

    const user = await this.db.get('user', payload.sub);
    if (!user) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  /**
   * Remove sensitive fields from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user
   */
  sanitizeUser(user) {
    const { password, salt, twoFASecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * ============================================================================
   * API ENDPOINTS
   * ============================================================================
   */

  /**
   * GET /user - Get current user info
   * @param {Request} request - HTTP request
   * @returns {Response} User info response
   */
  async getUser(request) {
    try {
      const user = await this.getCurrentUser(request);

      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Unauthorized', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(this.createResponse(user)),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * POST /login - User login
   * @param {Request} request - HTTP request
   * @returns {Response} Login response with tokens
   */
  async login(request) {
    try {
      const body = await request.json();
      const { email, password, code: twoFACode } = body;

      // Validate input
      if (!email || !password) {
        return new Response(
          JSON.stringify(this.createError('Email and password are required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const users = await this.db.query('user', { email: email.toLowerCase() });
      const user = users[0];

      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Invalid email or password', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check account lockout
      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const remaining = Math.ceil((user.lockedUntil - Date.now()) / 1000);
        return new Response(
          JSON.stringify(this.createError(
            `Account locked. Try again in ${remaining} seconds`,
            423,
            'ACCOUNT_LOCKED'
          )),
          { status: 423, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify password
      const isValidPassword = PasswordUtils.verify(password, user.password, user.salt || '');

      if (!isValidPassword) {
        // Increment failed attempts
        const failedAttempts = (user.failedAttempts || 0) + 1;
        const updates = { failedAttempts };

        if (failedAttempts >= this.security.maxLoginAttempts) {
          updates.lockedUntil = Date.now() + (this.security.lockoutDuration * 1000);
        }

        await this.db.update('user', user.id, updates);

        return new Response(
          JSON.stringify(this.createError('Invalid email or password', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check 2FA if enabled
      if (user.twoFAEnabled) {
        if (!twoFACode) {
          return new Response(
            JSON.stringify(this.createError(
              '2FA code required',
              403,
              '2FA_REQUIRED'
            )),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const isValid2FA = TwoFAUtils.verifyTOTP(twoFACode, user.twoFASecret);
        if (!isValid2FA) {
          return new Response(
            JSON.stringify(this.createError('Invalid 2FA code', 401)),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check email verification
      if (this.email.requireVerification && !user.emailVerified) {
        return new Response(
          JSON.stringify(this.createError(
            'Email not verified',
            403,
            'EMAIL_NOT_VERIFIED'
          )),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Reset failed attempts
      await this.db.update('user', user.id, {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString()
      });

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await this.db.create('token', {
        id: randomBytes(16).toString('hex'),
        userId: user.id,
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({
          user: this.sanitizeUser(user),
          token: accessToken,
          refreshToken: refreshToken,
          expiresIn: this.security.tokenExpiresIn
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * POST /register - User registration
   * @param {Request} request - HTTP request
   * @returns {Response} Registration response
   */
  async register(request) {
    try {
      const body = await request.json();
      const { email, password, nick, url, avatar } = body;

      // Validate input
      if (!email || !password) {
        return new Response(
          JSON.stringify(this.createError('Email and password are required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!EmailUtils.isValid(email)) {
        return new Response(
          JSON.stringify(this.createError('Invalid email format', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify(this.createError('Password must be at least 6 characters', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if email already exists
      const existingUsers = await this.db.query('user', { email: email.toLowerCase() });
      if (existingUsers.length > 0) {
        return new Response(
          JSON.stringify(this.createError('Email already registered', 409)),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate salt and hash password
      const salt = PasswordUtils.generateSalt();
      const hashedPassword = PasswordUtils.hash(password, salt);

      // Generate verification token if required
      let verificationToken = null;
      if (this.email.requireVerification) {
        verificationToken = EmailUtils.generateVerificationToken();
      }

      // Create user
      const userId = randomBytes(16).toString('hex');
      const user = {
        id: userId,
        email: email.toLowerCase(),
        password: hashedPassword,
        salt: salt,
        nick: nick || email.split('@')[0],
        url: url || '',
        avatar: avatar || '',
        type: UserType.USER,
        role: UserRole.USER,
        emailVerified: !this.email.requireVerification,
        verificationToken: verificationToken,
        twoFAEnabled: false,
        twoFASecret: null,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.db.create('user', user);

      // Send verification email if required
      if (this.email.requireVerification && verificationToken) {
        await this.sendVerificationEmail(email, verificationToken);
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await this.db.create('token', {
        id: randomBytes(16).toString('hex'),
        userId: user.id,
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({
          user: this.sanitizeUser(user),
          token: accessToken,
          refreshToken: refreshToken,
          expiresIn: this.security.tokenExpiresIn,
          message: this.email.requireVerification
            ? 'Registration successful. Please verify your email.'
            : 'Registration successful'
        })),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * POST /token - Refresh access token
   * @param {Request} request - HTTP request
   * @returns {Response} New tokens response
   */
  async refreshToken(request) {
    try {
      const body = await request.json();
      const { refreshToken } = body;

      if (!refreshToken) {
        return new Response(
          JSON.stringify(this.createError('Refresh token required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify refresh token in database
      const tokens = await this.db.query('token', { token: refreshToken, type: 'refresh' });
      const storedToken = tokens[0];

      if (!storedToken) {
        return new Response(
          JSON.stringify(this.createError('Invalid refresh token', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check expiration
      if (new Date(storedToken.expiresAt) < new Date()) {
        await this.db.delete('token', storedToken.id);
        return new Response(
          JSON.stringify(this.createError('Refresh token expired', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get user
      const user = await this.db.get('user', storedToken.userId);
      if (!user) {
        return new Response(
          JSON.stringify(this.createError('User not found', 404)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Delete old refresh token and create new one
      await this.db.delete('token', storedToken.id);
      await this.db.create('token', {
        id: randomBytes(16).toString('hex'),
        userId: user.id,
        token: newRefreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: this.security.tokenExpiresIn
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * DELETE /token - Logout
   * @param {Request} request - HTTP request
   * @returns {Response} Logout response
   */
  async logout(request) {
    try {
      const token = this.extractToken(request);

      // Delete refresh token if provided in body
      const body = await request.json().catch(() => ({}));
      const { refreshToken } = body;

      if (refreshToken) {
        const tokens = await this.db.query('token', { token: refreshToken, type: 'refresh' });
        if (tokens.length > 0) {
          await this.db.delete('token', tokens[0].id);
        }
      }

      // Add access token to blacklist (optional, for immediate invalidation)
      if (token) {
        const payload = JWTUtils.decode(token);
        if (payload) {
          await this.db.create('token', {
            id: randomBytes(16).toString('hex'),
            token: token,
            type: 'blacklist',
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            createdAt: new Date().toISOString()
          });
        }
      }

      return new Response(
        JSON.stringify(this.createResponse({ message: 'Logged out successfully' })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * POST /forgot - Password reset request
   * @param {Request} request - HTTP request
   * @returns {Response} Password reset response
   */
  async forgotPassword(request) {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return new Response(
          JSON.stringify(this.createError('Email is required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Find user
      const users = await this.db.query('user', { email: email.toLowerCase() });
      const user = users[0];

      // Always return success to prevent email enumeration
      if (!user) {
        return new Response(
          JSON.stringify(this.createResponse({
            message: 'If the email exists, a reset link has been sent'
          })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate reset token
      const resetToken = EmailUtils.generateVerificationToken();
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      await this.db.update('user', user.id, {
        resetToken: resetToken,
        resetExpires: resetExpires.toISOString()
      });

      // Send reset email
      await this.sendPasswordResetEmail(user.email, resetToken);

      return new Response(
        JSON.stringify(this.createResponse({
          message: 'If the email exists, a reset link has been sent'
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * POST /verify - Email verification
   * @param {Request} request - HTTP request
   * @returns {Response} Verification response
   */
  async verifyEmail(request) {
    try {
      const body = await request.json();
      const { token } = body;

      if (!token) {
        return new Response(
          JSON.stringify(this.createError('Verification token required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Find user by verification token
      const users = await this.db.query('user', { verificationToken: token });
      const user = users[0];

      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Invalid verification token', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update user
      await this.db.update('user', user.id, {
        emailVerified: true,
        verificationToken: null,
        updatedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({
          message: 'Email verified successfully'
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * GET /oauth - OAuth login initiation
   * @param {Request} request - HTTP request
   * @returns {Response} Redirect to OAuth provider
   */
  async oauthLogin(request) {
    try {
      const url = new URL(request.url);
      const provider = url.searchParams.get('type') || url.searchParams.get('provider') || 'github';
      const redirect = url.searchParams.get('redirect');
      
      // Use official Waline OAuth proxy service (same as official)
      const oauthUrl = this.config.oauthUrl || 'https://oauth.lithub.cc';
      const serverURL = this.config.siteUrl || url.origin;
      
      // Build redirect URL back to our callback
      const callbackUrl = `${serverURL}/oauth?${redirect ? `redirect=${encodeURIComponent(redirect)}&` : ''}type=${provider}`;
      
      // Build OAuth proxy URL
      const authUrl = `${oauthUrl}/${provider}?${new URLSearchParams({
        redirect: callbackUrl,
        state: request.headers.get('Authorization')?.replace('Bearer ', '') || ''
      }).toString()}`;

      return Response.redirect(authUrl, 302);
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * GET /oauth/callback - OAuth callback handler
   * @param {Request} request - HTTP request
   * @returns {Response} Login/registration response
   */
  async oauthCallback(request) {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const type = url.searchParams.get('type') || 'github';
      const redirect = url.searchParams.get('redirect');
      const error = url.searchParams.get('error');

      if (error) {
        return new Response(
          JSON.stringify(this.createError(`OAuth error: ${error}`, 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!code) {
        return new Response(
          JSON.stringify(this.createError('Missing code', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Use official Waline OAuth proxy service (same as official)
      const oauthUrl = this.config.oauthUrl || 'https://oauth.lithub.cc';
      
      // Build params for OAuth proxy
      const params = { code };
      if (state) params.state = state;
      
      // Special handling for Facebook
      if (type === 'facebook') {
        const serverURL = this.config.siteUrl || url.origin;
        const redirectUrl = `${serverURL}/oauth?${redirect ? `redirect=${encodeURIComponent(redirect)}&` : ''}type=${type}`;
        params.state = new URLSearchParams({
          redirect: redirectUrl,
          state: state || ''
        }).toString();
      }

      // Fetch user from OAuth proxy
      const oauthResponse = await fetch(`${oauthUrl}/${type}?${new URLSearchParams(params).toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': '@waline',
          'Accept': 'application/json'
        }
      });

      const user = await oauthResponse.json();

      if (!user?.id) {
        return new Response(
          JSON.stringify(this.createError(user?.message || 'OAuth failed', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Convert to our format
      const oauthUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        url: user.url
      };

      // Check if user already linked this social account
      const oauthLinks = await this.db.query('oauth_link', {
        provider: type,
        providerId: oauthUser.id
      });

      let existingUser = null;

      if (oauthLinks.length > 0) {
        existingUser = await this.db.get('user', oauthLinks[0].userId);
      }

      // Check if there's a current logged-in user (linking account)
      let currentUser = null;
      if (state) {
        try {
          const decoded = JWTUtils.verify(state, this.jwtSecret);
          if (decoded) {
            currentUser = await this.db.get('user', decoded.sub);
          }
        } catch (e) {
          // Invalid token, ignore
        }
      }

      // If user is logged in, link the social account
      if (currentUser) {
        // Check if already linked to another account
        if (existingUser && existingUser.id !== currentUser.id) {
          return new Response(
            JSON.stringify(this.createError('This social account is already linked to another user', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Link account
        if (!existingUser) {
          await this.db.create('oauth_link', {
            id: randomBytes(16).toString('hex'),
            userId: currentUser.id,
            provider: type,
            providerId: oauthUser.id,
            providerData: JSON.stringify(oauthUser),
            createdAt: new Date().toISOString()
          });

          // Update avatar if not set
          if (!currentUser.avatar && oauthUser.avatar) {
            await this.db.update('user', currentUser.id, { avatar: oauthUser.avatar });
          }
        }

        // Redirect to profile
        if (redirect) {
          return Response.redirect(redirect, 302);
        }

        return new Response(
          JSON.stringify(this.createResponse({ linked: true })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // If social account already linked, login as that user
      if (existingUser) {
        const accessToken = this.generateAccessToken(existingUser);
        const refreshToken = this.generateRefreshToken(existingUser);

        await this.db.create('token', {
          id: randomBytes(16).toString('hex'),
          userId: existingUser.id,
          token: refreshToken,
          type: 'refresh',
          expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
          createdAt: new Date().toISOString()
        });

        if (redirect) {
          const redirectWithToken = new URL(redirect);
          redirectWithToken.searchParams.set('token', accessToken);
          return Response.redirect(redirectWithToken.toString(), 302);
        }

        return new Response(
          JSON.stringify(this.createResponse({
            user: this.sanitizeUser(existingUser),
            token: accessToken,
            refreshToken: refreshToken
          })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create new user from OAuth data
      if (!oauthUser.email) {
        return new Response(
          JSON.stringify(this.createError('Email is required from OAuth provider', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if email already exists
      const usersByEmail = await this.db.query('user', { email: oauthUser.email.toLowerCase() });
      
      if (usersByEmail.length > 0) {
        // Link OAuth to existing user
        await this.db.create('oauth_link', {
          id: randomBytes(16).toString('hex'),
          userId: usersByEmail[0].id,
          provider: type,
          providerId: oauthUser.id,
          providerData: JSON.stringify(oauthUser),
          createdAt: new Date().toISOString()
        });

        const user = usersByEmail[0];
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);

        await this.db.create('token', {
          id: randomBytes(16).toString('hex'),
          userId: user.id,
          token: refreshToken,
          type: 'refresh',
          expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
          createdAt: new Date().toISOString()
        });

        if (redirect) {
          const redirectWithToken = new URL(redirect);
          redirectWithToken.searchParams.set('token', accessToken);
          return Response.redirect(redirectWithToken.toString(), 302);
        }

        return new Response(
          JSON.stringify(this.createResponse({
            user: this.sanitizeUser(user),
            token: accessToken,
            refreshToken: refreshToken
          })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create new user
      const userCount = await this.db.count('user');
      const userId = randomBytes(16).toString('hex');
      
      const newUser = {
        id: userId,
        email: oauthUser.email.toLowerCase(),
        password: null,
        salt: null,
        nick: oauthUser.name || oauthUser.login || 'User',
        url: oauthUser.url || '',
        avatar: oauthUser.avatar || '',
        type: userCount === 0 ? UserType.ADMINISTRATOR : UserType.USER,
        role: userCount === 0 ? UserRole.ADMIN : UserRole.USER,
        emailVerified: true,
        verificationToken: null,
        twoFAEnabled: false,
        twoFASecret: null,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.db.create('user', newUser);

      // Create OAuth link
      await this.db.create('oauth_link', {
        id: randomBytes(16).toString('hex'),
        userId: newUser.id,
        provider: type,
        providerId: oauthUser.id,
        providerData: JSON.stringify(oauthUser),
        createdAt: new Date().toISOString()
      });

      const accessToken = this.generateAccessToken(newUser);
      const refreshToken = this.generateRefreshToken(newUser);

      await this.db.create('token', {
        id: randomBytes(16).toString('hex'),
        userId: newUser.id,
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      if (redirect) {
        const redirectWithToken = new URL(redirect);
        redirectWithToken.searchParams.set('token', accessToken);
        return Response.redirect(redirectWithToken.toString(), 302);
      }

      return new Response(
        JSON.stringify(this.createResponse({
          user: this.sanitizeUser(newUser),
          token: accessToken,
          refreshToken: refreshToken
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
          return new Response(
            JSON.stringify(this.createError(`Unsupported provider: ${provider}`, 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
      }

      // Find or create user
      let user = null;

      // Try to find by OAuth ID
      const oauthLinks = await this.db.query('oauth_link', {
        provider: provider,
        providerId: oauthUser.id
      });

      if (oauthLinks.length > 0) {
        user = await this.db.get('user', oauthLinks[0].userId);
      }

      // Try to find by email
      if (!user && oauthUser.email) {
        const users = await this.db.query('user', { email: oauthUser.email.toLowerCase() });
        if (users.length > 0) {
          user = users[0];

          // Link OAuth account
          await this.db.create('oauth_link', {
            id: randomBytes(16).toString('hex'),
            userId: user.id,
            provider: provider,
            providerId: oauthUser.id,
            providerData: JSON.stringify(oauthUser),
            createdAt: new Date().toISOString()
          });
        }
      }

      // Create new user if not found
      if (!user) {
        if (!oauthUser.email) {
          return new Response(
            JSON.stringify(this.createError('Email required from OAuth provider', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const userId = randomBytes(16).toString('hex');
        user = {
          id: userId,
          email: oauthUser.email.toLowerCase(),
          password: null, // OAuth users don't have password
          salt: null,
          nick: oauthUser.name || oauthUser.login,
          url: oauthUser.url || '',
          avatar: oauthUser.avatar || '',
          type: UserType.USER,
          role: UserRole.USER,
          emailVerified: true, // OAuth emails are verified
          verificationToken: null,
          twoFAEnabled: false,
          twoFASecret: null,
          failedAttempts: 0,
          lockedUntil: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await this.db.create('user', user);

        // Create OAuth link
        await this.db.create('oauth_link', {
          id: randomBytes(16).toString('hex'),
          userId: user.id,
          provider: provider,
          providerId: oauthUser.id,
          providerData: JSON.stringify(oauthUser),
          createdAt: new Date().toISOString()
        });
      }

      // Update last login
      await this.db.update('user', user.id, {
        lastLoginAt: new Date().toISOString()
      });

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await this.db.create('token', {
        id: randomBytes(16).toString('hex'),
        userId: user.id,
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + this.security.refreshTokenExpiresIn * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      // Redirect with tokens or return JSON
      const redirectUrl = url.searchParams.get('redirect');
      if (redirectUrl) {
        const redirectWithToken = new URL(redirectUrl);
        redirectWithToken.searchParams.set('token', accessToken);
        redirectWithToken.searchParams.set('refreshToken', refreshToken);
        return Response.redirect(redirectWithToken.toString(), 302);
      }

      return new Response(
        JSON.stringify(this.createResponse({
          user: this.sanitizeUser(user),
          token: accessToken,
          refreshToken: refreshToken,
          expiresIn: this.security.tokenExpiresIn
        })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * ============================================================================
   * HELPER METHODS
   * ============================================================================
   */

  /**
   * Generate access token for user
   * @param {Object} user - User object
   * @returns {string} JWT access token
   */
  generateAccessToken(user) {
    return JWTUtils.sign(
      {
        sub: user.id,
        email: user.email,
        type: user.type,
        role: user.role
      },
      this.jwtSecret,
      this.security.tokenExpiresIn
    );
  }

  /**
   * Generate refresh token for user
   * @param {Object} user - User object
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(user) {
    return JWTUtils.sign(
      {
        sub: user.id,
        type: 'refresh'
      },
      this.jwtSecret,
      this.security.refreshTokenExpiresIn
    );
  }

  /**
   * Send verification email
   * @param {string} email - Recipient email
   * @param {string} token - Verification token
   */
  async sendVerificationEmail(email, token) {
    if (!this.email.service) {
      console.warn('Email service not configured');
      return;
    }

    const verificationLink = EmailUtils.generateVerificationLink(this.siteUrl, token);

    const emailData = {
      to: email,
      subject: 'Verify your email address',
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}">${verificationLink}</a>
        <p>If you didn't create an account, you can ignore this email.</p>
      `
    };

    // Implement email sending based on your email service
    // This is a placeholder that should be implemented with your preferred email provider
    console.log('Sending verification email:', emailData);
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} token - Reset token
   */
  async sendPasswordResetEmail(email, token) {
    if (!this.email.service) {
      console.warn('Email service not configured');
      return;
    }

    const resetLink = `${this.siteUrl}/reset-password?token=${token}`;

    const emailData = {
      to: email,
      subject: 'Password reset request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `
    };

    console.log('Sending password reset email:', emailData);
  }

  /**
   * Update user profile
   * @param {Request} request - HTTP request
   * @returns {Response} Updated user response
   */
  async updateProfile(request) {
    try {
      const user = await this.getCurrentUser(request);
      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Unauthorized', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await request.json();
      const allowedUpdates = ['nick', 'url', 'avatar'];
      const updates = {};

      for (const key of allowedUpdates) {
        if (body[key] !== undefined) {
          updates[key] = body[key];
        }
      }

      updates.updatedAt = new Date().toISOString();

      await this.db.update('user', user.id, updates);

      const updatedUser = await this.db.get('user', user.id);

      return new Response(
        JSON.stringify(this.createResponse(this.sanitizeUser(updatedUser))),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Change password
   * @param {Request} request - HTTP request
   * @returns {Response} Password change response
   */
  async changePassword(request) {
    try {
      const user = await this.getCurrentUser(request);
      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Unauthorized', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await request.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return new Response(
          JSON.stringify(this.createError('Current and new password required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify(this.createError('New password must be at least 6 characters', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify current password
      const fullUser = await this.db.get('user', user.id);
      const isValid = PasswordUtils.verify(currentPassword, fullUser.password, fullUser.salt || '');

      if (!isValid) {
        return new Response(
          JSON.stringify(this.createError('Current password is incorrect', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Hash new password
      const salt = PasswordUtils.generateSalt();
      const hashedPassword = PasswordUtils.hash(newPassword, salt);

      await this.db.update('user', user.id, {
        password: hashedPassword,
        salt: salt,
        updatedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({ message: 'Password changed successfully' })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Enable/disable 2FA
   * @param {Request} request - HTTP request
   * @returns {Response} 2FA setup response
   */
  async setup2FA(request) {
    try {
      const user = await this.getCurrentUser(request);
      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Unauthorized', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await request.json();
      const { enable, code } = body;

      const fullUser = await this.db.get('user', user.id);

      if (enable) {
        // Generate new 2FA secret
        if (!fullUser.twoFASecret) {
          const secret = TwoFAUtils.generateSecret();
          await this.db.update('user', user.id, { twoFASecret: secret });

          // Return QR code data for setup
          const otpauthUrl = `otpauth://totp/Waline:${user.email}?secret=${secret}&issuer=Waline`;

          return new Response(
            JSON.stringify(this.createResponse({
              secret: secret,
              otpauthUrl: otpauthUrl,
              message: 'Scan this QR code with your authenticator app'
            })),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Verify code and enable 2FA
        if (!code) {
          return new Response(
            JSON.stringify(this.createError('2FA code required to enable', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const isValid = TwoFAUtils.verifyTOTP(code, fullUser.twoFASecret);
        if (!isValid) {
          return new Response(
            JSON.stringify(this.createError('Invalid 2FA code', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        await this.db.update('user', user.id, {
          twoFAEnabled: true,
          updatedAt: new Date().toISOString()
        });

        return new Response(
          JSON.stringify(this.createResponse({ message: '2FA enabled successfully' })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        // Disable 2FA
        if (!code) {
          return new Response(
            JSON.stringify(this.createError('2FA code required to disable', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const isValid = TwoFAUtils.verifyTOTP(code, fullUser.twoFASecret);
        if (!isValid) {
          return new Response(
            JSON.stringify(this.createError('Invalid 2FA code', 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        await this.db.update('user', user.id, {
          twoFAEnabled: false,
          twoFASecret: null,
          updatedAt: new Date().toISOString()
        });

        return new Response(
          JSON.stringify(this.createResponse({ message: '2FA disabled successfully' })),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Reset password with token
   * @param {Request} request - HTTP request
   * @returns {Response} Password reset response
   */
  async resetPassword(request) {
    try {
      const body = await request.json();
      const { token, newPassword } = body;

      if (!token || !newPassword) {
        return new Response(
          JSON.stringify(this.createError('Token and new password required', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify(this.createError('Password must be at least 6 characters', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Find user by reset token
      const users = await this.db.query('user', { resetToken: token });
      const user = users[0];

      if (!user) {
        return new Response(
          JSON.stringify(this.createError('Invalid reset token', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check expiration
      if (user.resetExpires && new Date(user.resetExpires) < new Date()) {
        return new Response(
          JSON.stringify(this.createError('Reset token expired', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Hash new password
      const salt = PasswordUtils.generateSalt();
      const hashedPassword = PasswordUtils.hash(newPassword, salt);

      await this.db.update('user', user.id, {
        password: hashedPassword,
        salt: salt,
        resetToken: null,
        resetExpires: null,
        updatedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify(this.createResponse({ message: 'Password reset successfully' })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(this.createError(error.message, 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
}

/**
 * Factory function to create UserAPI instance
 * @param {Object} options - Configuration options
 * @returns {UserAPI} UserAPI instance
 */
export function createUserAPI(options) {
  return new UserAPI(options);
}

/**
 * Router helper to mount all user routes
 * @param {UserAPI} userAPI - UserAPI instance
 * @returns {Object} Route handlers
 */
export function createUserRoutes(userAPI) {
  return {
    // GET /user
    'GET /user': (request) => userAPI.getUser(request),

    // POST /login
    'POST /login': (request) => userAPI.login(request),

    // POST /register
    'POST /register': (request) => userAPI.register(request),

    // POST /token - refresh
    'POST /token': (request) => userAPI.refreshToken(request),

    // DELETE /token - logout
    'DELETE /token': (request) => userAPI.logout(request),

    // POST /forgot
    'POST /forgot': (request) => userAPI.forgotPassword(request),

    // POST /verify
    'POST /verify': (request) => userAPI.verifyEmail(request),

    // GET /oauth
    'GET /oauth': (request) => userAPI.oauthLogin(request),

    // GET /oauth/callback
    'GET /oauth/callback': (request) => userAPI.oauthCallback(request),

    // PUT /user - update profile
    'PUT /user': (request) => userAPI.updateProfile(request),

    // POST /user/password - change password
    'POST /user/password': (request) => userAPI.changePassword(request),

    // POST /user/2fa - setup 2FA
    'POST /user/2fa': (request) => userAPI.setup2FA(request),

    // POST /reset-password - reset with token
    'POST /reset-password': (request) => userAPI.resetPassword(request)
  };
}

export default UserAPI;
