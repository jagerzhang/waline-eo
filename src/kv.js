/**
 * EdgeOne KV Storage Adapter
 * Compatible with Waline data models
 */

export class WalineKV {
  constructor(kv) {
    this.kv = kv;
    this.prefix = {
      comment: 'waline:comment:',
      user: 'waline:user:',
      counter: 'waline:counter:',
      config: 'waline:config:',
      token: 'waline:token:',
      upload: 'waline:upload:',
    };
  }

  // ===== Comment Operations =====
  
  async createComment(data) {
    const id = data.objectId || this.generateId();
    const comment = {
      objectId: id,
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(this.prefix.comment + id, JSON.stringify(comment));
    
    // Add to URL index
    if (comment.url) {
      const urlKey = this.prefix.comment + 'url:' + this.hashString(comment.url);
      const urlList = await this.getUrlComments(comment.url);
      urlList.push(comment);
      await this.kv.put(urlKey, JSON.stringify(urlList));
    }

    // Add to status index
    const statusKey = this.prefix.comment + 'status:' + (comment.status || 'approved');
    const statusList = await this.getCommentsByStatus(comment.status || 'approved');
    statusList.push(comment);
    await this.kv.put(statusKey, JSON.stringify(statusList));

    return comment;
  }

  async getComment(id) {
    const data = await this.kv.get(this.prefix.comment + id);
    return data ? JSON.parse(data) : null;
  }

  async updateComment(id, updates) {
    const comment = await this.getComment(id);
    if (!comment) return null;

    const updated = {
      ...comment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(this.prefix.comment + id, JSON.stringify(updated));
    
    // Refresh indexes
    await this.refreshUrlIndex(comment.url);
    await this.refreshStatusIndex(comment.status);
    if (updates.status && updates.status !== comment.status) {
      await this.refreshStatusIndex(updates.status);
    }

    return updated;
  }

  async deleteComment(id) {
    const comment = await this.getComment(id);
    if (!comment) return false;

    await this.kv.delete(this.prefix.comment + id);
    
    // Update indexes
    await this.refreshUrlIndex(comment.url);
    await this.refreshStatusIndex(comment.status);

    return true;
  }

  async getUrlComments(url, options = {}) {
    const { status, limit = 100, offset = 0 } = options;
    const urlKey = this.prefix.comment + 'url:' + this.hashString(url);
    const data = await this.kv.get(urlKey);
    let comments = data ? JSON.parse(data) : [];

    if (status) {
      comments = comments.filter(c => c.status === status);
    }

    // Sort by createdAt desc
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = comments.length;
    comments = comments.slice(offset, offset + limit);

    return { data: comments, total };
  }

  async getCommentsByStatus(status, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const statusKey = this.prefix.comment + 'status:' + status;
    const data = await this.kv.get(statusKey);
    let comments = data ? JSON.parse(data) : [];

    // Sort by createdAt desc
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = comments.length;
    comments = comments.slice(offset, offset + limit);

    return { data: comments, total };
  }

  async getAllComments(options = {}) {
    const { limit = 100, offset = 0, status } = options;
    
    // List all comment keys
    const { keys } = await this.kv.list({ prefix: this.prefix.comment });
    let comments = [];

    for (const key of keys) {
      if (key.name.includes(':url:') || key.name.includes(':status:')) continue;
      
      const data = await this.kv.get(key.name);
      if (data) {
        const comment = JSON.parse(data);
        if (!status || comment.status === status) {
          comments.push(comment);
        }
      }
    }

    // Sort by createdAt desc
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = comments.length;
    comments = comments.slice(offset, offset + limit);

    return { data: comments, total };
  }

  // ===== User Operations =====

  async createUser(data) {
    const id = data.objectId || this.generateId();
    const user = {
      objectId: id,
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(this.prefix.user + id, JSON.stringify(user));
    
    // Add email index
    if (user.email) {
      await this.kv.put(this.prefix.user + 'email:' + user.email.toLowerCase(), id);
    }

    return user;
  }

  async getUser(id) {
    const data = await this.kv.get(this.prefix.user + id);
    return data ? JSON.parse(data) : null;
  }

  async getUserByEmail(email) {
    const id = await this.kv.get(this.prefix.user + 'email:' + email.toLowerCase());
    if (!id) return null;
    return this.getUser(id);
  }

  async updateUser(id, updates) {
    const user = await this.getUser(id);
    if (!user) return null;

    const updated = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(this.prefix.user + id, JSON.stringify(updated));

    // Update email index if changed
    if (updates.email && updates.email !== user.email) {
      await this.kv.delete(this.prefix.user + 'email:' + user.email.toLowerCase());
      await this.kv.put(this.prefix.user + 'email:' + updates.email.toLowerCase(), id);
    }

    return updated;
  }

  async deleteUser(id) {
    const user = await this.getUser(id);
    if (!user) return false;

    await this.kv.delete(this.prefix.user + id);
    
    if (user.email) {
      await this.kv.delete(this.prefix.user + 'email:' + user.email.toLowerCase());
    }

    return true;
  }

  async getAllUsers(options = {}) {
    const { limit = 100, offset = 0, type } = options;
    
    const { keys } = await this.kv.list({ prefix: this.prefix.user });
    let users = [];

    for (const key of keys) {
      if (key.name.includes(':email:')) continue;
      
      const data = await this.kv.get(key.name);
      if (data) {
        const user = JSON.parse(data);
        if (!type || user.type === type) {
          users.push(user);
        }
      }
    }

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = users.length;
    users = users.slice(offset, offset + limit);

    return { data: users, total };
  }

  // ===== Counter Operations =====

  async getCounter(url) {
    const data = await this.kv.get(this.prefix.counter + this.hashString(url));
    return data ? parseInt(data) : 0;
  }

  async incrementCounter(url, increment = 1) {
    const current = await this.getCounter(url);
    const newValue = current + increment;
    await this.kv.put(this.prefix.counter + this.hashString(url), newValue.toString());
    return newValue;
  }

  async setCounter(url, value) {
    await this.kv.put(this.prefix.counter + this.hashString(url), value.toString());
    return value;
  }

  // ===== Config Operations =====

  async getConfig(key) {
    const data = await this.kv.get(this.prefix.config + key);
    return data ? JSON.parse(data) : null;
  }

  async setConfig(key, value) {
    await this.kv.put(this.prefix.config + key, JSON.stringify(value));
    return value;
  }

  // ===== Token Operations =====

  async saveToken(token, data, ttl = 604800) {
    await this.kv.put(this.prefix.token + token, JSON.stringify(data), { expirationTtl: ttl });
  }

  async getToken(token) {
    const data = await this.kv.get(this.prefix.token + token);
    return data ? JSON.parse(data) : null;
  }

  async deleteToken(token) {
    await this.kv.delete(this.prefix.token + token);
  }

  // ===== Helper Methods =====

  generateId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async refreshUrlIndex(url) {
    const { keys } = await this.kv.list({ prefix: this.prefix.comment });
    const comments = [];

    for (const key of keys) {
      if (key.name.includes(':url:') || key.name.includes(':status:')) continue;
      
      const data = await this.kv.get(key.name);
      if (data) {
        const comment = JSON.parse(data);
        if (comment.url === url) {
          comments.push(comment);
        }
      }
    }

    const urlKey = this.prefix.comment + 'url:' + this.hashString(url);
    await this.kv.put(urlKey, JSON.stringify(comments));
  }

  async refreshStatusIndex(status) {
    const { keys } = await this.kv.list({ prefix: this.prefix.comment });
    const comments = [];

    for (const key of keys) {
      if (key.name.includes(':url:') || key.name.includes(':status:')) continue;
      
      const data = await this.kv.get(key.name);
      if (data) {
        const comment = JSON.parse(data);
        if (comment.status === status) {
          comments.push(comment);
        }
      }
    }

    const statusKey = this.prefix.comment + 'status:' + status;
    await this.kv.put(statusKey, JSON.stringify(comments));
  }

  // ===== Generic CRUD Operations (for API compatibility) =====

  /**
   * Create a record in the specified table
   * @param {string} table - Table name (user, comment, etc.)
   * @param {Object} data - Data to create
   * @returns {Promise<Object>}
   */
  async create(table, data) {
    switch (table) {
      case 'user':
        return this.createUser(data);
      case 'comment':
        return this.createComment(data);
      default:
        const id = data.objectId || data.id || this.generateId();
        const record = {
          objectId: id,
          id,
          ...data,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.kv.put(this.prefix[table] + id, JSON.stringify(record));
        return record;
    }
  }

  /**
   * Query records from the specified table
   * @param {string} table - Table name
   * @param {Object} where - Query conditions
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Array>}
   */
  async query(table, where = {}, options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    switch (table) {
      case 'user': {
        const { data: users } = await this.getAllUsers({ limit: 10000 });
        return users.filter(user => {
          for (const [key, value] of Object.entries(where)) {
            if (user[key] !== value && user[key]?.toLowerCase?.() !== value?.toLowerCase?.()) {
              return false;
            }
          }
          return true;
        }).slice(offset, offset + limit);
      }
      case 'comment': {
        const { data: comments } = await this.getAllComments({ limit: 10000 });
        return comments.filter(comment => {
          for (const [key, value] of Object.entries(where)) {
            if (comment[key] !== value) {
              return false;
            }
          }
          return true;
        }).slice(offset, offset + limit);
      }
      default: {
        const { keys } = await this.kv.list({ prefix: this.prefix[table] || table + ':' });
        const records = [];
        for (const key of keys) {
          const data = await this.kv.get(key.name);
          if (data) {
            const record = JSON.parse(data);
            let match = true;
            for (const [k, v] of Object.entries(where)) {
              if (record[k] !== v) {
                match = false;
                break;
              }
            }
            if (match) records.push(record);
          }
        }
        return records.slice(offset, offset + limit);
      }
    }
  }

  /**
   * Get a single record by ID
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async get(table, id) {
    switch (table) {
      case 'user':
        return this.getUser(id);
      case 'comment':
        return this.getComment(id);
      default:
        const data = await this.kv.get((this.prefix[table] || table + ':') + id);
        return data ? JSON.parse(data) : null;
    }
  }

  /**
   * Update a record
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @param {Object} updates - Data to update
   * @returns {Promise<Object|null>}
   */
  async update(table, id, updates) {
    switch (table) {
      case 'user':
        return this.updateUser(id, updates);
      case 'comment':
        return this.updateComment(id, updates);
      default: {
        const prefix = this.prefix[table] || table + ':';
        const data = await this.kv.get(prefix + id);
        if (!data) return null;
        const record = JSON.parse(data);
        const updated = {
          ...record,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        await this.kv.put(prefix + id, JSON.stringify(updated));
        return updated;
      }
    }
  }

  /**
   * Delete a record
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async delete(table, id) {
    switch (table) {
      case 'user':
        return this.deleteUser(id);
      case 'comment':
        return this.deleteComment(id);
      default: {
        const prefix = this.prefix[table] || table + ':';
        await this.kv.delete(prefix + id);
        return true;
      }
    }
  }

  /**
   * Count records in a table
   * @param {string} table - Table name
   * @param {Object} where - Filter conditions
   * @returns {Promise<number>}
   */
  async count(table, where = {}) {
    const records = await this.query(table, where, { limit: 100000 });
    return records.length;
  }

  /**
   * List all records from a table
   * @param {string} table - Table name
   * @param {Object} options - List options
   * @returns {Promise<Array>}
   */
  async list(table, options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    switch (table) {
      case 'user': {
        const { data } = await this.getAllUsers({ limit, offset });
        return data;
      }
      case 'comment': {
        const { data } = await this.getAllComments({ limit, offset });
        return data;
      }
      default: {
        const prefix = this.prefix[table] || table + ':';
        const { keys } = await this.kv.list({ prefix });
        const records = [];
        for (const key of keys) {
          const data = await this.kv.get(key.name);
          if (data) records.push(JSON.parse(data));
        }
        return records.slice(offset, offset + limit);
      }
    }
  }

  /**
   * Put a value directly (key-value store)
   * @param {string} key - Key
   * @param {string} value - Value
   * @returns {Promise<void>}
   */
  async put(key, value) {
    await this.kv.put(key, value);
  }

  // ===== Statistics =====

  async getStats() {
    const { keys: commentKeys } = await this.kv.list({ prefix: this.prefix.comment });
    const { keys: userKeys } = await this.kv.list({ prefix: this.prefix.user });

    let commentCount = 0;
    let userCount = 0;

    for (const key of commentKeys) {
      if (!key.name.includes(':url:') && !key.name.includes(':status:')) {
        commentCount++;
      }
    }

    for (const key of userKeys) {
      if (!key.name.includes(':email:')) {
        userCount++;
      }
    }

    return { commentCount, userCount };
  }
}
