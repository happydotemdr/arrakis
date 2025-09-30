const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const logger = require('./logger');

/**
 * QueueManager - File-based queue for failed webhook requests
 * Features:
 * - Persistent queue in filesystem
 * - Atomic operations (rename for lock-free concurrency)
 * - Exponential backoff retry scheduling
 * - Automatic cleanup of stale entries
 */
class QueueManager {
  constructor() {
    this.config = CONFIG.queue;
    this.setupQueueDirectories();
  }

  setupQueueDirectories() {
    try {
      const dirs = [
        this.config.directory,
        path.join(this.config.directory, this.config.subdirs.pending),
        path.join(this.config.directory, this.config.subdirs.processing),
        path.join(this.config.directory, this.config.subdirs.failed)
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (error) {
      logger.error('Failed to create queue directories', { error: error.message });
      this.config.enabled = false;
    }
  }

  /**
   * Add failed request to queue
   * @param {string} requestId - Unique request identifier
   * @param {object} payload - Original webhook payload
   * @param {Error} error - Error that caused failure
   * @param {number} retryCount - Current retry attempt count
   * @returns {Promise<boolean>} Success status
   */
  async enqueue(requestId, payload, error, retryCount = 0) {
    if (!this.config.enabled) {
      logger.warn('Queue disabled, skipping enqueue', { requestId });
      return false;
    }

    const queueEntry = {
      requestId,
      payload,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      },
      retryCount,
      enqueuedAt: new Date().toISOString(),
      nextRetryAt: this.calculateNextRetry(retryCount)
    };

    // Sanitize requestId to prevent path traversal attacks
    const sanitizedRequestId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const filepath = path.join(
      this.config.directory,
      this.config.subdirs.pending,
      `${sanitizedRequestId}.json`
    );

    try {
      // Check queue size limit
      if (this.getQueueSize('pending') >= this.config.maxQueueSize) {
        logger.error('Queue size limit reached', {
          requestId,
          maxSize: this.config.maxQueueSize
        });
        return false;
      }

      // Async write
      await fs.promises.writeFile(filepath, JSON.stringify(queueEntry, null, 2));

      logger.queue('Request enqueued', {
        requestId,
        retryCount,
        nextRetryAt: queueEntry.nextRetryAt
      });

      return true;
    } catch (writeError) {
      logger.error('Failed to enqueue request', {
        requestId,
        error: writeError.message
      });
      return false;
    }
  }

  calculateNextRetry(retryCount) {
    const delay = this.config.retryDelays[retryCount] ||
                 this.config.retryDelays[this.config.retryDelays.length - 1];
    return new Date(Date.now() + delay).toISOString();
  }

  getQueueSize(subdir) {
    try {
      const dir = path.join(this.config.directory, this.config.subdirs[subdir]);
      const files = fs.readdirSync(dir);
      return files.filter(f => f.endsWith('.json')).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get requests ready for retry
   * @returns {Promise<Array>} Array of {filepath, entry} objects
   */
  async getReadyRequests() {
    const pendingDir = path.join(this.config.directory, this.config.subdirs.pending);
    const readyRequests = [];

    try {
      const files = fs.readdirSync(pendingDir);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(pendingDir, file);
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const entry = JSON.parse(content);

          // Check if ready for retry
          const nextRetry = new Date(entry.nextRetryAt);
          if (now >= nextRetry) {
            readyRequests.push({ filepath, entry });
          }

          // Check for stale entries
          const enqueuedAt = new Date(entry.enqueuedAt);
          const age = now - enqueuedAt;
          if (age > this.config.maxFileAge) {
            logger.warn('Removing stale queue entry', {
              requestId: entry.requestId,
              age: Math.floor(age / 1000 / 60 / 60) + 'h'
            });
            await this.moveToFailed(filepath, entry, 'Stale entry (too old)');
          }
        } catch (parseError) {
          logger.error('Failed to parse queue file', {
            file,
            error: parseError.message
          });
        }
      }
    } catch (error) {
      logger.error('Failed to read pending queue', { error: error.message });
    }

    return readyRequests;
  }

  /**
   * Move request to processing directory (atomic operation)
   */
  async moveToProcessing(filepath, entry) {
    const filename = path.basename(filepath);
    const processingPath = path.join(
      this.config.directory,
      this.config.subdirs.processing,
      filename
    );

    try {
      await fs.promises.rename(filepath, processingPath);
      logger.queue('Moved to processing', { requestId: entry.requestId });
      return processingPath;
    } catch (error) {
      logger.error('Failed to move to processing', {
        requestId: entry.requestId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Move permanently failed request to failed directory
   */
  async moveToFailed(filepath, entry, reason) {
    const filename = path.basename(filepath);
    const failedPath = path.join(
      this.config.directory,
      this.config.subdirs.failed,
      filename
    );

    try {
      // Add failure metadata
      const failedEntry = {
        ...entry,
        failedAt: new Date().toISOString(),
        failureReason: reason
      };

      await fs.promises.writeFile(failedPath, JSON.stringify(failedEntry, null, 2));
      await fs.promises.unlink(filepath);

      logger.queue('Moved to failed', {
        requestId: entry.requestId,
        reason
      });
      return true;
    } catch (error) {
      logger.error('Failed to move to failed queue', {
        requestId: entry.requestId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Move request back to pending for another retry
   */
  async moveToPending(filepath, entry, newRetryCount) {
    const filename = path.basename(filepath);
    const pendingPath = path.join(
      this.config.directory,
      this.config.subdirs.pending,
      filename
    );

    try {
      // Update retry metadata
      const updatedEntry = {
        ...entry,
        retryCount: newRetryCount,
        nextRetryAt: this.calculateNextRetry(newRetryCount),
        lastRetryAt: new Date().toISOString()
      };

      await fs.promises.writeFile(pendingPath, JSON.stringify(updatedEntry, null, 2));
      await fs.promises.unlink(filepath);

      logger.queue('Moved back to pending', {
        requestId: entry.requestId,
        retryCount: newRetryCount,
        nextRetryAt: updatedEntry.nextRetryAt
      });
      return true;
    } catch (error) {
      logger.error('Failed to move to pending', {
        requestId: entry.requestId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Delete queue entry (after successful retry)
   */
  async deleteQueueEntry(filepath) {
    try {
      await fs.promises.unlink(filepath);
      return true;
    } catch (error) {
      logger.error('Failed to delete queue entry', {
        filepath,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = new QueueManager();