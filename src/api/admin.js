/**
 * Waline Admin API Module for EdgeOne
 * Implements all admin features from the official Waline admin controller
 * @module api/admin
 */

// Web Crypto API helpers for EdgeOne Pages Functions (V8 runtime)

/**
 * Generate a random ID using Web Crypto API
 * @param {number} length - Length of the ID in bytes (default: 16)
 * @returns {string} Hex-encoded random string
 */
async function generateRandomId(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate MD5 hash using Web Crypto API
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded MD5 hash
 */
async function md5Hash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('MD5', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate SHA-256 hash using Web Crypto API
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function sha256Hash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ArrayBuffer to Base64 string using Web standard API
 * @param {ArrayBuffer} buffer - ArrayBuffer to convert
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * @typedef {Object} AdminComment
 * @property {string} objectId - Unique identifier
 * @property {string} nick - User nickname
 * @property {string} mail - User email
 * @property {string} link - User website URL
 * @property {string} ua - User agent string
 * @property {string} ip - IP address
 * @property {string} comment - Comment content (HTML rendered)
 * @property {string} commentRaw - Raw comment content
 * @property {string} url - Article URL path
 * @property {string} rid - Root comment ID (for replies)
 * @property {string} pid - Parent comment ID (for replies)
 * @property {string} status - Comment status: 'approved', 'waiting', 'spam'
 * @property {number} like - Like count
 * @property {boolean} sticky - Whether comment is sticky
 * @property {string} insertedAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} AdminUser
 * @property {string} objectId - Unique identifier
 * @property {string} email - User email
 * @property {string} nick - User nickname
 * @property {string} link - User website
 * @property {string} avatar - User avatar URL
 * @property {string} type - User type: 'administrator', 'user', 'guest'
 * @property {string} status - User status: 'active', 'inactive', 'banned'
 * @property {string} label - User label/tag
 * @property {number} commentCount - Number of comments
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Statistics
 * @property {number} commentCount - Total comment count
 * @property {number} userCount - Total user count
 * @property {number} spamCount - Spam comment count
 * @property {number} waitingCount - Pending comment count
 * @property {number} approvedCount - Approved comment count
 * @property {number} todayCommentCount - Today's comment count
 * @property {number} todayUserCount - Today's new user count
 */

/**
 * @typedef {Object} ExportData
 * @property {string} version - Export version
 * @property {string} exportedAt - Export timestamp
 * @property {Object[]} comments - All comments
 * @property {Object[]} users - All users
 * @property {Object[]} counters - All counters
 */

/**
 * User types in Waline
 */
export const UserType = {
  ADMINISTRATOR: 'administrator',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest'
};

/**
 * User statuses
 */
export const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned'
};

/**
 * Comment statuses
 */
export const CommentStatus = {
  APPROVED: 'approved',
  WAITING: 'waiting',
  SPAM: 'spam'
};

/**
 * AdminAPI class for handling all admin operations
 * Compatible with Waline EdgeOne deployment
 */
export class AdminAPI {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter (D1, KV, etc.)
   * @param {Object} options.config - Waline configuration
   * @param {Object} options.ctx - Request context
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.config = options.config || {};
    this.ctx = options.ctx || {};
    this.userInfo = options.ctx?.state?.userInfo || null;
  }

  /**
   * Get storage model
   * @private
   * @param {string} model - Model name (comment, user, counter)
   * @returns {Object} Storage model instance
   */
  getModel(model = 'comment') {
    return this.storage;
  }

  /**
   * Check if current user is admin
   * @private
   * @returns {boolean}
   */
  isAdmin() {
    return this.userInfo?.type === 'administrator';
  }

  /**
   * Check if current user is moderator or admin
   * @private
   * @returns {boolean}
   */
  isModerator() {
    return this.userInfo?.type === 'administrator' || this.userInfo?.type === 'moderator';
  }

  /**
   * Check if current user is logged in
   * @private
   * @returns {boolean}
   */
  isLogin() {
    return !!this.userInfo && Object.keys(this.userInfo).length > 0;
  }

  /**
   * Require admin permission
   * @private
   * @throws {Error} If not admin
   */
  requireAdmin() {
    if (!this.isAdmin()) {
      const error = new Error('Unauthorized - Admin access required');
      error.status = 403;
      throw error;
    }
  }

  /**
   * Require moderator or admin permission
   * @private
   * @throws {Error} If not moderator or admin
   */
  requireModerator() {
    if (!this.isModerator()) {
      const error = new Error('Unauthorized - Moderator access required');
      error.status = 403;
      throw error;
    }
  }

  /**
   * Create standardized response
   * @private
   * @param {*} data - Response data
   * @param {number} status - HTTP status
   * @param {string} message - Response message
   * @returns {Object} Standardized response
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
   * @private
   * @param {string} message - Error message
   * @param {number} status - HTTP status
   * @param {string} code - Error code
   * @returns {Object} Error response
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
   * ============================================================================
   * ADMIN COMMENT API
   * ============================================================================
   */

  /**
   * GET /admin/comment - Get all comments with filters
   * @param {Object} query - Query parameters
   * @param {number} [query.page=1] - Page number
   * @param {number} [query.pageSize=10] - Comments per page (max 100)
   * @param {string} [query.status] - Filter by status: 'approved', 'waiting', 'spam'
   * @param {string} [query.keyword] - Search keyword (searches nick, mail, comment, url)
   * @param {string} [query.owner] - Filter by owner: 'mine' for current user's comments
   * @param {string} [query.url] - Filter by article URL
   * @param {string} [query.sortBy='insertedAt_desc'] - Sort order
   * @returns {Promise<{page: number, totalPages: number, pageSize: number, count: number, spamCount: number, waitingCount: number, data: AdminComment[]}>}
   */
  async getComments(query = {}) {
    this.requireModerator();

    const {
      page = 1,
      pageSize = 10,
      status,
      keyword,
      owner,
      url,
      sortBy = 'insertedAt_desc'
    } = query;

    const limit = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
    const currentPage = Math.max(1, parseInt(page) || 1);

    // Build where clause
    const where = {};

    if (status) {
      where.status = status;
    }

    if (url) {
      where.url = url;
    }

    if (owner === 'mine' && this.userInfo) {
      where.user_id = this.userInfo.objectId;
    }

    if (keyword) {
      where.$or = [
        { nick: { $regex: keyword, $options: 'i' } },
        { mail: { $regex: keyword, $options: 'i' } },
        { comment: { $regex: keyword, $options: 'i' } },
        { url: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Parse sortBy
    const [sortField, sortOrder] = sortBy.split('_');
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get counts
    const [totalCount, spamCount, waitingCount] = await Promise.all([
      this.getModel().count(where),
      this.getModel().count({ ...where, status: 'spam' }),
      this.getModel().count({ ...where, status: 'waiting' })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Get comments
    const comments = await this.getModel().find(where, {
      sort: { [sortField]: order },
      skip: (currentPage - 1) * limit,
      limit
    });

    // Format comments
    const formattedComments = await Promise.all(
      comments.map(c => this.formatAdminComment(c))
    );

    return {
      page: currentPage,
      totalPages,
      pageSize: limit,
      count: totalCount,
      spamCount,
      waitingCount,
      data: formattedComments
    };
  }

  /**
   * PUT /admin/comment - Update any comment
   * @param {string} id - Comment ID
   * @param {Object} data - Update data
   * @param {string} [data.status] - Comment status: 'approved', 'waiting', 'spam'
   * @param {boolean} [data.sticky] - Sticky status
   * @param {string} [data.comment] - Comment content
   * @param {string} [data.nick] - User nickname
   * @param {string} [data.mail] - User email
   * @param {string} [data.link] - User website
   * @param {string} [data.url] - Article URL
   * @returns {Promise<AdminComment>}
   */
  async updateComment(id, data) {
    this.requireModerator();

    if (!id) {
      throw new Error('Comment ID is required');
    }

    const comment = await this.getModel().findOne({ objectId: id });

    if (!comment) {
      const error = new Error('Comment not found');
      error.status = 404;
      throw error;
    }

    const updateData = {};

    // Update allowed fields
    if (data.status !== undefined) {
      const validStatuses = ['approved', 'waiting', 'spam'];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = data.status;

      // Handle notification when approving a waiting comment with parent
      if (comment.status === 'waiting' && data.status === 'approved' && comment.pid) {
        const parent = await this.getModel().findOne({ objectId: comment.pid });
        if (parent) {
          this.sendNotification(comment, parent).catch(console.error);
        }
      }
    }

    if (data.sticky !== undefined) {
      updateData.sticky = !!data.sticky;
    }

    if (data.comment !== undefined) {
      updateData.comment = data.comment.trim();
    }

    if (data.nick !== undefined) {
      updateData.nick = data.nick.trim();
    }

    if (data.mail !== undefined) {
      updateData.mail = data.mail.trim().toLowerCase();
    }

    if (data.link !== undefined) {
      updateData.link = data.link.trim();
    }

    if (data.url !== undefined) {
      updateData.url = data.url.trim();
    }

    updateData.updatedAt = new Date().toISOString();

    // Update comment
    const updated = await this.getModel().update(
      { objectId: id },
      updateData
    );

    return this.formatAdminComment({ ...comment, ...updated });
  }

  /**
   * DELETE /admin/comment - Delete any comment
   * @param {string} id - Comment ID
   * @returns {Promise<{success: boolean, deletedCount: number}>}
   */
  async deleteComment(id) {
    this.requireModerator();

    if (!id) {
      throw new Error('Comment ID is required');
    }

    const comment = await this.getModel().findOne({ objectId: id });

    if (!comment) {
      const error = new Error('Comment not found');
      error.status = 404;
      throw error;
    }

    // Delete comment and all its children/replies
    const idsToDelete = [id];

    // Find all children recursively
    const findChildren = async (parentId) => {
      const children = await this.getModel().find({
        $or: [{ pid: parentId }, { rid: parentId }]
      });

      for (const child of children) {
        idsToDelete.push(child.objectId);
        await findChildren(child.objectId);
      }
    };

    await findChildren(id);

    // Delete all comments
    let deletedCount = 0;
    for (const commentId of idsToDelete) {
      await this.getModel().delete({ objectId: commentId });
      deletedCount++;
    }

    return { success: true, deletedCount };
  }

  /**
   * POST /admin/comment/bulk - Bulk operations on comments
   * @param {Object} data - Bulk operation data
   * @param {string[]} data.ids - Array of comment IDs
   * @param {string} data.action - Action to perform: 'approve', 'spam', 'delete', 'sticky', 'unsticky'
   * @returns {Promise<{success: boolean, processedCount: number}>}
   */
  async bulkCommentOperation(data) {
    this.requireModerator();

    const { ids, action } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Comment IDs array is required');
    }

    if (!action) {
      throw new Error('Action is required');
    }

    const validActions = ['approve', 'spam', 'delete', 'sticky', 'unsticky'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
    }

    let processedCount = 0;

    for (const id of ids) {
      try {
        switch (action) {
          case 'approve':
            await this.updateComment(id, { status: 'approved' });
            processedCount++;
            break;
          case 'spam':
            await this.updateComment(id, { status: 'spam' });
            processedCount++;
            break;
          case 'delete':
            await this.deleteComment(id);
            processedCount++;
            break;
          case 'sticky':
            await this.updateComment(id, { sticky: true });
            processedCount++;
            break;
          case 'unsticky':
            await this.updateComment(id, { sticky: false });
            processedCount++;
            break;
        }
      } catch (e) {
        console.error(`Failed to ${action} comment ${id}:`, e);
      }
    }

    return { success: true, processedCount };
  }

  /**
   * ============================================================================
   * ADMIN USER API
   * ============================================================================
   */

  /**
   * GET /admin/user - Get all users with pagination
   * @param {Object} query - Query parameters
   * @param {number} [query.page=1] - Page number
   * @param {number} [query.pageSize=10] - Users per page (max 100)
   * @param {string} [query.type] - Filter by type: 'administrator', 'moderator', 'user', 'guest'
   * @param {string} [query.status] - Filter by status: 'active', 'inactive', 'banned'
   * @param {string} [query.keyword] - Search keyword (searches email, nick)
   * @param {string} [query.sortBy='createdAt_desc'] - Sort order
   * @returns {Promise<{page: number, totalPages: number, pageSize: number, count: number, data: AdminUser[]}>}
   */
  async getUsers(query = {}) {
    this.requireAdmin();

    const {
      page = 1,
      pageSize = 10,
      type,
      status,
      keyword,
      sortBy = 'createdAt_desc'
    } = query;

    const limit = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
    const currentPage = Math.max(1, parseInt(page) || 1);

    // Build where clause
    const where = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (keyword) {
      where.$or = [
        { email: { $regex: keyword, $options: 'i' } },
        { nick: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Parse sortBy
    const [sortField, sortOrder] = sortBy.split('_');
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get count
    const totalCount = await this.storage.count(where, 'user');
    const totalPages = Math.ceil(totalCount / limit);

    // Get users
    const users = await this.storage.find(where, {
      sort: { [sortField]: order },
      skip: (currentPage - 1) * limit,
      limit
    }, 'user');

    // Format users with comment counts
    const formattedUsers = await Promise.all(
      users.map(u => this.formatAdminUser(u))
    );

    return {
      page: currentPage,
      totalPages,
      pageSize: limit,
      count: totalCount,
      data: formattedUsers
    };
  }

  /**
   * PUT /admin/user - Update user
   * @param {string} id - User ID
   * @param {Object} data - Update data
   * @param {string} [data.type] - User type: 'administrator', 'moderator', 'user', 'guest'
   * @param {string} [data.status] - User status: 'active', 'inactive', 'banned'
   * @param {string} [data.label] - User label/tag
   * @param {string} [data.nick] - User nickname
   * @param {string} [data.url] - User website
   * @param {string} [data.avatar] - User avatar URL
   * @returns {Promise<AdminUser>}
   */
  async updateUser(id, data) {
    this.requireAdmin();

    if (!id) {
      throw new Error('User ID is required');
    }

    const user = await this.storage.findOne({ objectId: id }, 'user');

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Prevent self-demotion from admin
    if (id === this.userInfo?.objectId && data.type && data.type !== 'administrator') {
      throw new Error('Cannot demote yourself from admin');
    }

    const updateData = {};

    // Update allowed fields
    if (data.type !== undefined) {
      const validTypes = ['administrator', 'moderator', 'user', 'guest'];
      if (!validTypes.includes(data.type)) {
        throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
      updateData.type = data.type;
    }

    if (data.status !== undefined) {
      const validStatuses = ['active', 'inactive', 'banned'];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = data.status;
    }

    if (data.label !== undefined) {
      updateData.label = data.label;
    }

    if (data.nick !== undefined) {
      updateData.nick = data.nick.trim();
    }

    if (data.url !== undefined) {
      updateData.url = data.url.trim();
    }

    if (data.avatar !== undefined) {
      updateData.avatar = data.avatar.trim();
    }

    updateData.updatedAt = new Date().toISOString();

    // Update user
    const updated = await this.storage.update(
      { objectId: id },
      updateData,
      'user'
    );

    return this.formatAdminUser({ ...user, ...updated });
  }

  /**
   * DELETE /admin/user - Delete user
   * @param {string} id - User ID
   * @param {Object} [options] - Delete options
   * @param {boolean} [options.deleteComments=false] - Whether to delete user's comments
   * @returns {Promise<{success: boolean, deletedComments: number}>}
   */
  async deleteUser(id, options = {}) {
    this.requireAdmin();

    if (!id) {
      throw new Error('User ID is required');
    }

    // Prevent self-deletion
    if (id === this.userInfo?.objectId) {
      throw new Error('Cannot delete yourself');
    }

    const user = await this.storage.findOne({ objectId: id }, 'user');

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    let deletedComments = 0;

    // Delete user's comments if requested
    if (options.deleteComments) {
      const userComments = await this.getModel().find({ user_id: id });
      for (const comment of userComments) {
        await this.getModel().delete({ objectId: comment.objectId });
        deletedComments++;
      }
    } else {
      // Set comments to guest comments
      const userComments = await this.getModel().find({ user_id: id });
      for (const comment of userComments) {
        await this.getModel().update(
          { objectId: comment.objectId },
          {
            user_id: null,
            nick: comment.nick || user.nick || 'Anonymous',
            updatedAt: new Date().toISOString()
          }
        );
      }
    }

    // Delete user
    await this.storage.delete({ objectId: id }, 'user');

    return { success: true, deletedComments };
  }

  /**
   * POST /admin/user/bulk - Bulk operations on users
   * @param {Object} data - Bulk operation data
   * @param {string[]} data.ids - Array of user IDs
   * @param {string} data.action - Action to perform: 'ban', 'unban', 'delete', 'set_type'
   * @param {string} [data.value] - Value for set_type action
   * @returns {Promise<{success: boolean, processedCount: number}>}
   */
  async bulkUserOperation(data) {
    this.requireAdmin();

    const { ids, action, value } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('User IDs array is required');
    }

    if (!action) {
      throw new Error('Action is required');
    }

    const validActions = ['ban', 'unban', 'delete', 'set_type'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
    }

    let processedCount = 0;

    for (const id of ids) {
      try {
        // Skip self
        if (id === this.userInfo?.objectId) {
          continue;
        }

        switch (action) {
          case 'ban':
            await this.updateUser(id, { status: 'banned' });
            processedCount++;
            break;
          case 'unban':
            await this.updateUser(id, { status: 'active' });
            processedCount++;
            break;
          case 'delete':
            await this.deleteUser(id);
            processedCount++;
            break;
          case 'set_type':
            if (value) {
              await this.updateUser(id, { type: value });
              processedCount++;
            }
            break;
        }
      } catch (e) {
        console.error(`Failed to ${action} user ${id}:`, e);
      }
    }

    return { success: true, processedCount };
  }

  /**
   * ============================================================================
   * STATISTICS API
   * ============================================================================
   */

  /**
   * GET /stat - Get statistics
   * @param {Object} [query] - Query parameters
   * @param {string} [query.start] - Start date (ISO string)
   * @param {string} [query.end] - End date (ISO string)
   * @returns {Promise<Statistics>}
   */
  async getStatistics(query = {}) {
    this.requireModerator();

    const { start, end } = query;

    // Build date filter
    const dateFilter = {};
    if (start || end) {
      dateFilter.insertedAt = {};
      if (start) dateFilter.insertedAt.$gte = start;
      if (end) dateFilter.insertedAt.$lte = end;
    }

    // Get comment statistics
    const [
      commentCount,
      approvedCount,
      spamCount,
      waitingCount
    ] = await Promise.all([
      this.getModel().count(dateFilter),
      this.getModel().count({ ...dateFilter, status: 'approved' }),
      this.getModel().count({ ...dateFilter, status: 'spam' }),
      this.getModel().count({ ...dateFilter, status: 'waiting' })
    ]);

    // Get user count
    const userCount = await this.storage.count({}, 'user');

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const todayCommentCount = await this.getModel().count({
      insertedAt: { $gte: todayISO }
    });

    const todayUserCount = await this.storage.count({
      createdAt: { $gte: todayISO }
    }, 'user');

    return {
      commentCount,
      userCount,
      spamCount,
      waitingCount,
      approvedCount,
      todayCommentCount,
      todayUserCount
    };
  }

  /**
   * PUT /stat - Update statistics (recalculate)
   * @returns {Promise<Statistics>}
   */
  async updateStatistics() {
    this.requireAdmin();

    // Recalculate all statistics
    // This is useful if data becomes inconsistent
    const stats = await this.getStatistics();

    // Store statistics in storage for caching
    await this.storage.set?.('statistics', {
      ...stats,
      updatedAt: new Date().toISOString()
    });

    return stats;
  }

  /**
   * GET /stat/activity - Get recent activity
   * @param {Object} [query] - Query parameters
   * @param {number} [query.limit=20] - Number of activities to return
   * @returns {Promise<Object[]>}
   */
  async getRecentActivity(query = {}) {
    this.requireModerator();

    const { limit = 20 } = query;

    // Get recent comments
    const recentComments = await this.getModel().find({}, {
      sort: { insertedAt: 'desc' },
      limit: parseInt(limit)
    });

    // Get recent users
    const recentUsers = await this.storage.find({}, {
      sort: { createdAt: 'desc' },
      limit: parseInt(limit)
    }, 'user');

    // Combine and sort activities
    const activities = [
      ...recentComments.map(c => ({
        type: 'comment',
        action: c.status === 'approved' ? 'approved' : c.status,
        objectId: c.objectId,
        nick: c.nick,
        url: c.url,
        createdAt: c.insertedAt
      })),
      ...recentUsers.map(u => ({
        type: 'user',
        action: 'registered',
        objectId: u.objectId,
        nick: u.nick,
        email: u.email,
        createdAt: u.createdAt
      }))
    ];

    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return activities.slice(0, parseInt(limit));
  }

  /**
   * ============================================================================
   * DATABASE EXPORT/IMPORT API
   * ============================================================================
   */

  /**
   * GET /db/export - Export all data as JSON
   * @param {Object} [options] - Export options
   * @param {boolean} [options.includeSpam=true] - Include spam comments
   * @param {boolean} [options.includeUsers=true] - Include users
   * @param {boolean} [options.includeCounters=true] - Include counters
   * @returns {Promise<ExportData>}
   */
  async exportData(options = {}) {
    this.requireAdmin();

    const {
      includeSpam = true,
      includeUsers = true,
      includeCounters = true
    } = options;

    // Build export object
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      comments: [],
      users: [],
      counters: []
    };

    // Export comments
    const commentWhere = includeSpam ? {} : { status: { $ne: 'spam' } };
    exportData.comments = await this.getModel().find(commentWhere, {
      sort: { insertedAt: 'asc' },
      limit: 10000 // Reasonable limit
    });

    // Export users
    if (includeUsers) {
      exportData.users = await this.storage.find({}, {
        sort: { createdAt: 'asc' },
        limit: 10000
      }, 'user');

      // Remove sensitive fields
      exportData.users = exportData.users.map(u => {
        const { password, salt, twoFASecret, resetToken, ...safeUser } = u;
        return safeUser;
      });
    }

    // Export counters
    if (includeCounters) {
      exportData.counters = await this.storage.find({}, {
        sort: { url: 'asc' }
      }, 'counter');
    }

    return exportData;
  }

  /**
   * POST /db/import - Import data from JSON
   * @param {Object} data - Import data
   * @param {Object} [options] - Import options
   * @param {boolean} [options.merge=false] - Merge with existing data instead of replacing
   * @param {boolean} [options.skipDuplicates=true] - Skip duplicate entries
   * @returns {Promise<{success: boolean, imported: {comments: number, users: number, counters: number}, errors: string[]}>}
   */
  async importData(data, options = {}) {
    this.requireAdmin();

    const {
      merge = false,
      skipDuplicates = true
    } = options;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }

    const result = {
      success: true,
      imported: {
        comments: 0,
        users: 0,
        counters: 0
      },
      errors: []
    };

    // Import comments
    if (Array.isArray(data.comments)) {
      for (const comment of data.comments) {
        try {
          // Check for duplicates
          if (skipDuplicates && comment.objectId) {
            const existing = await this.getModel().findOne({ objectId: comment.objectId });
            if (existing) {
              if (merge) {
                await this.getModel().update(
                  { objectId: comment.objectId },
                  comment
                );
              }
              continue;
            }
          }

          // Create new comment
          await this.getModel().create({
            ...comment,
            objectId: comment.objectId || await this.generateId(),
            insertedAt: comment.insertedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          result.imported.comments++;
        } catch (e) {
          result.errors.push(`Failed to import comment: ${e.message}`);
        }
      }
    }

    // Import users
    if (Array.isArray(data.users)) {
      for (const user of data.users) {
        try {
          // Check for duplicates
          if (skipDuplicates && user.objectId) {
            const existing = await this.storage.findOne({ objectId: user.objectId }, 'user');
            if (existing) {
              if (merge) {
                await this.storage.update(
                  { objectId: user.objectId },
                  user,
                  'user'
                );
              }
              continue;
            }
          }

          // Create new user
          await this.storage.create({
            ...user,
            objectId: user.objectId || await this.generateId(),
            createdAt: user.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, 'user');
          result.imported.users++;
        } catch (e) {
          result.errors.push(`Failed to import user: ${e.message}`);
        }
      }
    }

    // Import counters
    if (Array.isArray(data.counters)) {
      for (const counter of data.counters) {
        try {
          // Check for duplicates
          if (skipDuplicates && counter.objectId) {
            const existing = await this.storage.findOne({ objectId: counter.objectId }, 'counter');
            if (existing) {
              if (merge) {
                await this.storage.update(
                  { objectId: counter.objectId },
                  counter,
                  'counter'
                );
              }
              continue;
            }
          }

          // Create new counter
          await this.storage.create({
            ...counter,
            objectId: counter.objectId || await this.generateId(),
            updatedAt: new Date().toISOString()
          }, 'counter');
          result.imported.counters++;
        } catch (e) {
          result.errors.push(`Failed to import counter: ${e.message}`);
        }
      }
    }

    return result;
  }

  /**
   * ============================================================================
   * FILE UPLOAD API
   * ============================================================================
   */

  /**
   * POST /upload - Handle file uploads (images)
   * @param {File|Blob} file - File to upload
   * @param {Object} [options] - Upload options
   * @param {string} [options.allowedTypes] - Allowed MIME types (comma-separated)
   * @param {number} [options.maxSize] - Maximum file size in bytes
   * @param {string} [options.storageType='local'] - Storage type: 'local', 's3', 'r2', 'kv'
   * @returns {Promise<{url: string, name: string, size: number, type: string}>}
   */
  async uploadFile(file, options = {}) {
    this.requireModerator();

    const {
      allowedTypes = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml',
      maxSize = 5 * 1024 * 1024, // 5MB default
      storageType = 'local'
    } = options;

    if (!file) {
      throw new Error('No file provided');
    }

    // Check file size
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${this.formatBytes(maxSize)}`);
    }

    // Check file type
    const allowedTypesList = allowedTypes.split(',').map(t => t.trim());
    if (!allowedTypesList.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedTypes}`);
    }

    // Generate unique filename
    const ext = this.getFileExtension(file.name);
    const hash = await md5Hash(`${file.name}${Date.now()}`);
    const filename = `${hash.substring(0, 16)}.${ext}`;

    let url;

    switch (storageType) {
      case 'r2':
        url = await this.uploadToR2(file, filename);
        break;
      case 's3':
        url = await this.uploadToS3(file, filename);
        break;
      case 'kv':
        url = await this.uploadToKV(file, filename);
        break;
      case 'local':
      default:
        url = await this.uploadToLocal(file, filename);
        break;
    }

    return {
      url,
      name: file.name,
      size: file.size,
      type: file.type
    };
  }

  /**
   * Upload file to R2 storage
   * @private
   * @param {File|Blob} file - File to upload
   * @param {string} filename - Target filename
   * @returns {Promise<string>} File URL
   */
  async uploadToR2(file, filename) {
    const r2Config = this.config.R2;
    if (!r2Config) {
      throw new Error('R2 storage not configured');
    }

    const { bucket, accountId, accessKeyId, secretAccessKey, publicUrl } = r2Config;

    // Upload to R2 using S3-compatible API
    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(file.size),
        'Authorization': `AWS ${accessKeyId}:${this.signR2Request(filename, file.type, secretAccessKey)}`
      },
      body: arrayBuffer
    });

    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.statusText}`);
    }

    return `${publicUrl}/${filename}`;
  }

  /**
   * Upload file to S3 storage
   * @private
   * @param {File|Blob} file - File to upload
   * @param {string} filename - Target filename
   * @returns {Promise<string>} File URL
   */
  async uploadToS3(file, filename) {
    const s3Config = this.config.S3;
    if (!s3Config) {
      throw new Error('S3 storage not configured');
    }

    const { bucket, region, accessKeyId, secretAccessKey, endpoint } = s3Config;

    const arrayBuffer = await file.arrayBuffer();
    const s3Endpoint = endpoint || `https://s3.${region}.amazonaws.com`;

    const response = await fetch(`${s3Endpoint}/${bucket}/${filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(file.size),
        'x-amz-acl': 'public-read'
      },
      body: arrayBuffer
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.statusText}`);
    }

    return `${s3Endpoint}/${bucket}/${filename}`;
  }

  /**
   * Upload file to KV storage (for small files)
   * @private
   * @param {File|Blob} file - File to upload
   * @param {string} filename - Target filename
   * @returns {Promise<string>} File URL
   */
  async uploadToKV(file, filename) {
    if (file.size > 1024 * 1024) { // 1MB limit for KV
      throw new Error('File too large for KV storage. Maximum is 1MB');
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    await this.storage.setKV?.(`upload:${filename}`, JSON.stringify({
      data: base64,
      type: file.type,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    // Return a data URL or reference
    return `data:${file.type};base64,${base64}`;
  }

  /**
   * Upload file to local/temporary storage
   * @private
   * @param {File|Blob} file - File to upload
   * @param {string} filename - Target filename
   * @returns {Promise<string>} File URL
   */
  async uploadToLocal(file, filename) {
    // For EdgeOne/Workers, we might store in KV or return a data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Store metadata
    await this.storage.setKV?.(`upload:${filename}`, JSON.stringify({
      type: file.type,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    // Return data URL for immediate use
    return `data:${file.type};base64,${base64}`;
  }

  /**
   * Sign R2 request (simplified)
   * @private
   * @param {string} filename - Filename
   * @param {string} contentType - Content type
   * @param {string} secretKey - Secret key
   * @returns {Promise<string>} Signature
   */
  async signR2Request(filename, contentType, secretKey) {
    // Simplified signing - implement proper AWS Signature Version 4 for production
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const stringToSign = `PUT\n\n${contentType}\n${date}\n/${filename}`;
    return await sha256Hash(stringToSign + secretKey);
  }

  /**
   * ============================================================================
   * HELPER METHODS
   * ============================================================================
   */

  /**
   * Format comment for admin response
   * @private
   * @param {Object} comment - Raw comment data
   * @returns {Promise<AdminComment>}
   */
  async formatAdminComment(comment) {
    if (!comment) return null;

    return {
      objectId: comment.objectId || comment.id,
      nick: comment.nick,
      mail: comment.mail,
      link: comment.link || '',
      ua: comment.ua || '',
      ip: comment.ip || '',
      comment: comment.comment,
      commentRaw: comment.comment,
      url: comment.url,
      rid: comment.rid || '',
      pid: comment.pid || '',
      status: comment.status || 'approved',
      like: comment.like || 0,
      sticky: comment.sticky || false,
      insertedAt: comment.insertedAt || comment.createdAt,
      updatedAt: comment.updatedAt
    };
  }

  /**
   * Format user for admin response
   * @private
   * @param {Object} user - Raw user data
   * @returns {Promise<AdminUser>}
   */
  async formatAdminUser(user) {
    if (!user) return null;

    // Get comment count for user
    const commentCount = await this.getModel().count({
      $or: [
        { user_id: user.objectId || user.id },
        { mail: user.email }
      ]
    });

    return {
      objectId: user.objectId || user.id,
      email: user.email,
      nick: user.nick || user.display_name,
      link: user.link || user.url || '',
      avatar: user.avatar || '',
      type: user.type || 'user',
      status: user.status || 'active',
      label: user.label || '',
      commentCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Send notification (placeholder)
   * @private
   * @param {Object} comment - Comment
   * @param {Object} parent - Parent comment
   */
  async sendNotification(comment, parent) {
    // Implementation depends on your notification service
    // This is a placeholder for the notification logic
    console.log('Notification would be sent for approved comment:', comment.objectId);
  }

  /**
   * Generate unique ID
   * @private
   * @returns {Promise<string>} Unique ID
   */
  async generateId() {
    return await generateRandomId(16);
  }

  /**
   * Get file extension
   * @private
   * @param {string} filename - Filename
   * @returns {string} File extension
   */
  getFileExtension(filename) {
    const ext = filename.split('.').pop();
    return ext ? ext.toLowerCase() : 'bin';
  }

  /**
   * Format bytes to human readable string
   * @private
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * ============================================================================
   * ADDITIONAL ADMIN FEATURES
   * ============================================================================
   */

  /**
   * GET /admin/config - Get system configuration
   * @returns {Promise<Object>}
   */
  async getConfig() {
    this.requireAdmin();

    // Return safe configuration (no secrets)
    return {
      siteName: this.config.SITE_NAME,
      siteUrl: this.config.SITE_URL,
      commentAudit: this.config.COMMENT_AUDIT,
      disallowIPList: this.config.DISALLOW_IP_LIST || [],
      forbiddenWords: this.config.FORBIDDEN_WORDS || [],
      akismetKey: this.config.AKISMET_KEY ? '***' : null,
      avatarProxy: this.config.AVATAR_PROXY,
      disableUserAgent: this.config.DISABLE_USERAGENT,
      disableRegion: this.config.DISABLE_REGION,
      levels: this.config.LEVELS,
      maxCommentLength: this.config.MAX_COMMENT_LENGTH,
      maxNickLength: this.config.MAX_NICK_LENGTH
    };
  }

  /**
   * PUT /admin/config - Update system configuration
   * @param {Object} config - Configuration updates
   * @returns {Promise<Object>}
   */
  async updateConfig(config) {
    this.requireAdmin();

    // Update configuration
    // Note: Actual implementation depends on how config is stored
    const allowedKeys = [
      'SITE_NAME',
      'SITE_URL',
      'COMMENT_AUDIT',
      'DISALLOW_IP_LIST',
      'FORBIDDEN_WORDS',
      'AVATAR_PROXY',
      'DISABLE_USERAGENT',
      'DISABLE_REGION',
      'LEVELS',
      'MAX_COMMENT_LENGTH',
      'MAX_NICK_LENGTH'
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (config[key] !== undefined) {
        updates[key] = config[key];
      }
    }

    // Store updates
    await this.storage.set?.('config', updates);

    return { success: true, updated: Object.keys(updates) };
  }

  /**
   * GET /admin/ip - Get IP blacklist/whitelist
   * @returns {Promise<{blacklist: string[], whitelist: string[]}>}
   */
  async getIPList() {
    this.requireAdmin();

    return {
      blacklist: this.config.DISALLOW_IP_LIST || [],
      whitelist: this.config.ALLOW_IP_LIST || []
    };
  }

  /**
   * POST /admin/ip - Add IP to blacklist
   * @param {string} ip - IP address
   * @param {string} [reason] - Reason for blacklisting
   * @returns {Promise<{success: boolean}>}
   */
  async addToBlacklist(ip, reason) {
    this.requireAdmin();

    if (!ip) {
      throw new Error('IP address is required');
    }

    const blacklist = this.config.DISALLOW_IP_LIST || [];
    if (!blacklist.includes(ip)) {
      blacklist.push(ip);
      await this.storage.set?.('DISALLOW_IP_LIST', blacklist);
    }

    return { success: true };
  }

  /**
   * DELETE /admin/ip - Remove IP from blacklist
   * @param {string} ip - IP address
   * @returns {Promise<{success: boolean}>}
   */
  async removeFromBlacklist(ip) {
    this.requireAdmin();

    if (!ip) {
      throw new Error('IP address is required');
    }

    const blacklist = this.config.DISALLOW_IP_LIST || [];
    const index = blacklist.indexOf(ip);
    if (index > -1) {
      blacklist.splice(index, 1);
      await this.storage.set?.('DISALLOW_IP_LIST', blacklist);
    }

    return { success: true };
  }
}

/**
 * Factory function to create AdminAPI instance
 * @param {Object} options - Configuration options
 * @returns {AdminAPI}
 */
export function createAdminAPI(options) {
  return new AdminAPI(options);
}

/**
 * Router helper to mount all admin routes
 * @param {AdminAPI} adminAPI - AdminAPI instance
 * @returns {Object} Route handlers
 */
export function createAdminRoutes(adminAPI) {
  return {
    // GET /admin/comment - Get all comments with filters
    'GET /admin/comment': (request) => {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams);
      return adminAPI.getComments(query);
    },

    // PUT /admin/comment - Update any comment
    'PUT /admin/comment': async (request) => {
      const body = await request.json();
      const { id, ...data } = body;
      return adminAPI.updateComment(id, data);
    },

    // DELETE /admin/comment - Delete any comment
    'DELETE /admin/comment': async (request) => {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      return adminAPI.deleteComment(id);
    },

    // POST /admin/comment/bulk - Bulk comment operations
    'POST /admin/comment/bulk': async (request) => {
      const body = await request.json();
      return adminAPI.bulkCommentOperation(body);
    },

    // GET /admin/user - Get all users
    'GET /admin/user': (request) => {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams);
      return adminAPI.getUsers(query);
    },

    // PUT /admin/user - Update user
    'PUT /admin/user': async (request) => {
      const body = await request.json();
      const { id, ...data } = body;
      return adminAPI.updateUser(id, data);
    },

    // DELETE /admin/user - Delete user
    'DELETE /admin/user': async (request) => {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      const deleteComments = url.searchParams.get('deleteComments') === 'true';
      return adminAPI.deleteUser(id, { deleteComments });
    },

    // POST /admin/user/bulk - Bulk user operations
    'POST /admin/user/bulk': async (request) => {
      const body = await request.json();
      return adminAPI.bulkUserOperation(body);
    },

    // GET /stat - Get statistics
    'GET /stat': (request) => {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams);
      return adminAPI.getStatistics(query);
    },

    // PUT /stat - Update statistics
    'PUT /stat': () => adminAPI.updateStatistics(),

    // GET /stat/activity - Get recent activity
    'GET /stat/activity': (request) => {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams);
      return adminAPI.getRecentActivity(query);
    },

    // GET /db/export - Export all data
    'GET /db/export': (request) => {
      const url = new URL(request.url);
      const options = {
        includeSpam: url.searchParams.get('includeSpam') !== 'false',
        includeUsers: url.searchParams.get('includeUsers') !== 'false',
        includeCounters: url.searchParams.get('includeCounters') !== 'false'
      };
      return adminAPI.exportData(options);
    },

    // POST /db/import - Import data
    'POST /db/import': async (request) => {
      const body = await request.json();
      const { data, options } = body;
      return adminAPI.importData(data, options);
    },

    // POST /upload - File upload
    'POST /upload': async (request) => {
      const formData = await request.formData();
      const file = formData.get('file');
      const options = {
        allowedTypes: formData.get('allowedTypes'),
        maxSize: parseInt(formData.get('maxSize')) || undefined,
        storageType: formData.get('storageType') || 'local'
      };
      return adminAPI.uploadFile(file, options);
    },

    // GET /admin/config - Get configuration
    'GET /admin/config': () => adminAPI.getConfig(),

    // PUT /admin/config - Update configuration
    'PUT /admin/config': async (request) => {
      const body = await request.json();
      return adminAPI.updateConfig(body);
    },

    // GET /admin/ip - Get IP list
    'GET /admin/ip': () => adminAPI.getIPList(),

    // POST /admin/ip - Add to blacklist
    'POST /admin/ip': async (request) => {
      const body = await request.json();
      return adminAPI.addToBlacklist(body.ip, body.reason);
    },

    // DELETE /admin/ip - Remove from blacklist
    'DELETE /admin/ip': async (request) => {
      const url = new URL(request.url);
      const ip = url.searchParams.get('ip');
      return adminAPI.removeFromBlacklist(ip);
    }
  };
}

export default AdminAPI;
