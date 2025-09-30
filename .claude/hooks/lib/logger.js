const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

/**
 * Logger - Async file-based logging with buffering and rotation
 * Features:
 * - Non-blocking async writes with in-memory buffering
 * - Automatic log rotation at 10MB
 * - Multiple log files (success, error, queue, debug)
 * - Graceful degradation if filesystem unavailable
 */
class Logger {
  constructor() {
    this.config = CONFIG.logging;
    this.buffers = new Map(); // In-memory buffers for async writes
    this.lastFlush = Date.now();
    this.setupLogDirectory();
    this.startFlushInterval();
  }

  setupLogDirectory() {
    try {
      if (!fs.existsSync(this.config.directory)) {
        fs.mkdirSync(this.config.directory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
      this.config.enabled = false;
    }
  }

  startFlushInterval() {
    if (this.config.asyncWrite) {
      this.flushTimer = setInterval(() => {
        this.flushAllBuffers();
      }, this.config.flushInterval);

      // Don't let timer keep process alive
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
  }

  /**
   * Main logging method
   * @param {string} level - Log level (debug, info, warn, error, queue)
   * @param {string} message - Log message
   * @param {object} context - Additional context fields
   */
  log(level, message, context = {}) {
    if (!this.config.enabled) {
      console.log(JSON.stringify({ level, message, ...context }));
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      hostname: CONFIG.system.hostname
    };

    // Determine target file
    const targetFile = this.getTargetFile(level);
    const logLine = JSON.stringify(entry) + '\n';

    // Console output for critical errors or debug mode
    if (level === 'error') {
      console.error(logLine.trim());
    } else if (this.config.level === 'debug') {
      console.log(logLine.trim());
    }

    // Write to file
    if (this.config.asyncWrite) {
      this.appendToBuffer(targetFile, logLine);
    } else {
      this.writeSync(targetFile, logLine);
    }
  }

  getTargetFile(level) {
    const fileMap = {
      debug: this.config.files.debug,
      info: this.config.files.success,
      warn: this.config.files.error,
      error: this.config.files.error,
      queue: this.config.files.queue
    };
    return path.join(this.config.directory, fileMap[level] || this.config.files.success);
  }

  appendToBuffer(filepath, content) {
    if (!this.buffers.has(filepath)) {
      this.buffers.set(filepath, []);
    }
    this.buffers.get(filepath).push(content);

    // Flush if buffer gets too large (safety)
    if (this.buffers.get(filepath).length > 100) {
      this.flushBuffer(filepath);
    }
  }

  flushBuffer(filepath) {
    const buffer = this.buffers.get(filepath);
    if (!buffer || buffer.length === 0) return;

    const content = buffer.join('');
    this.buffers.set(filepath, []); // Clear buffer

    // Non-blocking write
    fs.appendFile(filepath, content, (err) => {
      if (err) {
        console.error('Log write failed:', err.message);
      }
    });

    // Check for rotation after write
    this.checkRotation(filepath);
  }

  flushAllBuffers() {
    for (const filepath of this.buffers.keys()) {
      this.flushBuffer(filepath);
    }
  }

  writeSync(filepath, content) {
    try {
      fs.appendFileSync(filepath, content);
      this.checkRotation(filepath);
    } catch (error) {
      console.error('Sync log write failed:', error.message);
    }
  }

  checkRotation(filepath) {
    try {
      const stats = fs.statSync(filepath);
      if (stats.size > this.config.maxFileSize) {
        this.rotateFile(filepath);
      }
    } catch (error) {
      // File doesn't exist yet, ignore
    }
  }

  rotateFile(filepath) {
    const timestamp = Date.now();
    const ext = path.extname(filepath);
    const base = filepath.slice(0, -ext.length);
    const rotatedPath = `${base}.${timestamp}${ext}`;

    try {
      fs.renameSync(filepath, rotatedPath);
      this.cleanOldRotations(base, ext);
    } catch (error) {
      console.error('Log rotation failed:', error.message);
    }
  }

  cleanOldRotations(base, ext) {
    try {
      const dir = path.dirname(base);
      const filename = path.basename(base);
      const files = fs.readdirSync(dir);

      const rotatedFiles = files
        .filter(f => f.startsWith(filename) && f.endsWith(ext) && f.includes('.'))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          time: fs.statSync(path.join(dir, f)).mtimeMs
        }))
        .sort((a, b) => b.time - a.time); // Newest first

      // Keep only maxFiles rotations
      rotatedFiles.slice(this.config.maxFiles).forEach(file => {
        fs.unlinkSync(file.path);
      });
    } catch (error) {
      console.error('Rotation cleanup failed:', error.message);
    }
  }

  // Convenience methods
  debug(message, context) {
    if (this.config.level === 'debug') {
      this.log('debug', message, context);
    }
  }

  info(message, context) {
    this.log('info', message, context);
  }

  warn(message, context) {
    this.log('warn', message, context);
  }

  error(message, context) {
    this.log('error', message, context);
  }

  queue(message, context) {
    this.log('queue', message, context);
  }

  // Graceful shutdown
  shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushAllBuffers();
  }
}

// Singleton instance
const logger = new Logger();

// Ensure flush on process exit
process.on('exit', () => logger.shutdown());
process.on('SIGINT', () => {
  logger.shutdown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  logger.shutdown();
  process.exit(143);
});

module.exports = logger;