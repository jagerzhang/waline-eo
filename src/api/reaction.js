/**
 * Article Reaction API Module
 * Implements article reactions/emotions feature similar to official Waline
 * Compatible with EdgeOne Pages Functions
 */

/**
 * Reaction types (emotions)
 * Can be customized via REACTIONS environment variable
 */
const DEFAULT_REACTIONS = [
  { id: 'like', emoji: '👍', name: '赞' },
  { id: 'love', emoji: '❤️', name: '喜欢' },
  { id: 'laugh', emoji: '😄', name: '哈哈' },
  { id: 'wow', emoji: '😮', name: '惊讶' },
  { id: 'sad', emoji: '😢', name: '悲伤' },
  { id: 'angry', emoji: '😡', name: '愤怒' },
];

/**
 * ReactionAPI class for handling article reactions
 */
export class ReactionAPI {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter
   * @param {Object} options.config - Waline configuration
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.config = options.config || {};
    this.reactions = this.parseReactions(this.config.REACTIONS);
  }

  /**
   * Parse reactions configuration
   * @private
   * @param {string} reactionsConfig - Reactions config string
   * @returns {Array} Array of reaction objects
   */
  parseReactions(reactionsConfig) {
    if (!reactionsConfig) {
      return DEFAULT_REACTIONS;
    }

    try {
      // Format: "like|👍|赞,love|❤️|喜欢"
      return reactionsConfig.split(',').map(item => {
        const [id, emoji, name] = item.split('|');
        return { id: id.trim(), emoji: emoji.trim(), name: name?.trim() || id };
      });
    } catch (e) {
      return DEFAULT_REACTIONS;
    }
  }

  /**
   * Get storage model
   * @private
   * @returns {Object} Storage model
   */
  getModel() {
    return this.storage;
  }

  /**
   * Get user IP for reaction tracking
   * @private
   * @param {Request} request - HTTP request
   * @returns {string} IP address
   */
  getIP(request) {
    return request?.headers?.get('cf-connecting-ip') ||
           request?.headers?.get('x-forwarded-for') ||
           '127.0.0.1';
  }

  /**
   * Create standardized response
   * @private
   */
  createResponse(data, status = 200, errmsg = 'ok') {
    return {
      errno: status === 200 ? 0 : status,
      errmsg,
      data,
    };
  }

  /**
   * GET /reaction - Get reaction counts for an article
   * @param {Object} ctx - Request context
   * @returns {Promise<Object>} Reaction counts
   */
  async get(ctx) {
    try {
      const url = new URL(ctx.request.url);
      const path = url.searchParams.get('url') || url.searchParams.get('path');

      if (!path) {
        return this.createResponse(null, 400, 'URL is required');
      }

      // Get reaction counts from storage
      const reactions = await this.getModel().query('reaction', { url: path });

      // Build response
      const result = {
        url: path,
        reactions: {},
        total: 0,
      };

      // Initialize all reaction types with 0
      this.reactions.forEach(r => {
        result.reactions[r.id] = {
          id: r.id,
          emoji: r.emoji,
          name: r.name,
          count: 0,
        };
      });

      // Add counts from storage
      reactions.forEach(r => {
        if (result.reactions[r.reactionId]) {
          result.reactions[r.reactionId].count = r.count || 0;
          result.total += r.count || 0;
        }
      });

      return this.createResponse(result);
    } catch (error) {
      console.error('Get reaction error:', error);
      return this.createResponse(null, 500, error.message);
    }
  }

  /**
   * POST /reaction - Add a reaction to an article
   * @param {Object} ctx - Request context
   * @returns {Promise<Object>} Updated reaction counts
   */
  async post(ctx) {
    try {
      const body = await ctx.request.json();
      const { url, reaction: reactionId } = body;

      if (!url || !reactionId) {
        return this.createResponse(null, 400, 'URL and reaction are required');
      }

      // Validate reaction type
      const validReaction = this.reactions.find(r => r.id === reactionId);
      if (!validReaction) {
        return this.createResponse(null, 400, 'Invalid reaction type');
      }

      const ip = this.getIP(ctx.request);
      const userId = ctx.userInfo?.objectId || null;

      // Check if user already reacted (by IP or userId)
      const existingReaction = await this.findExistingReaction(url, ip, userId);

      if (existingReaction) {
        if (existingReaction.reactionId === reactionId) {
          // Same reaction - remove it (toggle off)
          await this.removeReaction(existingReaction.id);
        } else {
          // Different reaction - update it
          await this.updateReaction(existingReaction.id, reactionId);
        }
      } else {
        // New reaction
        await this.addReaction(url, reactionId, ip, userId);
      }

      // Return updated counts
      return this.get(ctx);
    } catch (error) {
      console.error('Post reaction error:', error);
      return this.createResponse(null, 500, error.message);
    }
  }

  /**
   * Find existing reaction by user
   * @private
   * @param {string} url - Article URL
   * @param {string} ip - User IP
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object|null>} Existing reaction or null
   */
  async findExistingReaction(url, ip, userId) {
    const where = { url };

    if (userId) {
      where.userId = userId;
    } else {
      where.ip = ip;
    }

    const reactions = await this.getModel().query('reaction_user', where);
    return reactions[0] || null;
  }

  /**
   * Add a new reaction
   * @private
   * @param {string} url - Article URL
   * @param {string} reactionId - Reaction type ID
   * @param {string} ip - User IP
   * @param {string} userId - User ID (optional)
   */
  async addReaction(url, reactionId, ip, userId) {
    // Record user reaction
    await this.getModel().create('reaction_user', {
      id: this.generateId(),
      url,
      reactionId,
      ip,
      userId,
      createdAt: new Date().toISOString(),
    });

    // Increment reaction count
    await this.incrementReactionCount(url, reactionId, 1);
  }

  /**
   * Remove a reaction
   * @private
   * @param {string} reactionUserId - Reaction user record ID
   */
  async removeReaction(reactionUserId) {
    // Get the reaction to decrement count
    const reaction = await this.getModel().get('reaction_user', reactionUserId);
    if (reaction) {
      // Remove user reaction
      await this.getModel().delete('reaction_user', reactionUserId);

      // Decrement count
      await this.incrementReactionCount(reaction.url, reaction.reactionId, -1);
    }
  }

  /**
   * Update a reaction (change reaction type)
   * @private
   * @param {string} reactionUserId - Reaction user record ID
   * @param {string} newReactionId - New reaction type ID
   */
  async updateReaction(reactionUserId, newReactionId) {
    // Get the old reaction
    const reaction = await this.getModel().get('reaction_user', reactionUserId);
    if (reaction) {
      const oldReactionId = reaction.reactionId;

      // Update user reaction
      await this.getModel().update('reaction_user', reactionUserId, {
        reactionId: newReactionId,
        updatedAt: new Date().toISOString(),
      });

      // Decrement old count
      await this.incrementReactionCount(reaction.url, oldReactionId, -1);

      // Increment new count
      await this.incrementReactionCount(reaction.url, newReactionId, 1);
    }
  }

  /**
   * Increment or decrement reaction count
   * @private
   * @param {string} url - Article URL
   * @param {string} reactionId - Reaction type ID
   * @param {number} delta - Change amount (+1 or -1)
   */
  async incrementReactionCount(url, reactionId, delta) {
    // Find existing count
    const existing = await this.getModel().query('reaction', { url, reactionId });

    if (existing.length > 0) {
      // Update existing
      const currentCount = existing[0].count || 0;
      const newCount = Math.max(0, currentCount + delta);

      await this.getModel().update('reaction', existing[0].id, {
        count: newCount,
        updatedAt: new Date().toISOString(),
      });
    } else if (delta > 0) {
      // Create new
      await this.getModel().create('reaction', {
        id: this.generateId(),
        url,
        reactionId,
        count: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate a random ID
   * @private
   * @returns {string} Random ID
   */
  generateId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get available reaction types
   * @returns {Array} Array of reaction type objects
   */
  getReactionTypes() {
    return this.reactions;
  }
}

/**
 * Factory function to create ReactionAPI instance
 * @param {Object} options - Configuration options
 * @returns {ReactionAPI}
 */
export function createReactionAPI(options) {
  return new ReactionAPI(options);
}

export default ReactionAPI;
