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
