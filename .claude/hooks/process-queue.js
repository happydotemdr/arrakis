#!/usr/bin/env node

/**
 * Queue Processor - Retry failed webhook requests
 *
 * This script processes the queue of failed webhook requests, attempting to
 * send them again with exponential backoff. It should be run periodically
 * (e.g., on SessionEnd hook or via cron).
 *
 * Features:
 * - Processes pending requests ready for retry
 * - Respects exponential backoff delays
 * - Moves permanently failed requests to failed/ directory
 * - Comprehensive logging of all operations
 */

const logger = require('./lib/logger');
const queueManager = require('./lib/queue-manager');
const webhookClient = require('./lib/webhook-client');
const CONFIG = require('./lib/config');

async function processQueue() {
  const startTime = Date.now();

  logger.queue('Queue processing started', {
    queueSizes: {
      pending: queueManager.getQueueSize('pending'),
      processing: queueManager.getQueueSize('processing'),
      failed: queueManager.getQueueSize('failed')
    }
  });

  const readyRequests = await queueManager.getReadyRequests();

  if (readyRequests.length === 0) {
    logger.queue('No requests ready for retry');
    return;
  }

  logger.queue(`Processing ${readyRequests.length} queued requests`);

  let successCount = 0;
  let failCount = 0;
  let requeueCount = 0;

  for (const { filepath, entry } of readyRequests) {
    const { requestId, payload, retryCount } = entry;

    // Move to processing
    const processingPath = await queueManager.moveToProcessing(filepath, entry);
    if (!processingPath) {
      continue;
    }

    // Attempt to send webhook
    const result = await webhookClient.send(
      CONFIG.webhook.url,
      payload,
      {
        requestId,
        traceId: payload._trace?.traceId,
        retryCount
      }
    );

    if (result.success) {
      // Success - remove from queue
      await queueManager.deleteQueueEntry(processingPath);
      successCount++;

      logger.queue('Queued request succeeded', {
        requestId,
        retryCount,
        statusCode: result.statusCode
      });
    } else {
      // Failed - check if we should retry again
      const newRetryCount = retryCount + 1;

      if (newRetryCount >= CONFIG.queue.maxRetries) {
        // Max retries reached - move to failed
        await queueManager.moveToFailed(
          processingPath,
          entry,
          `Max retries (${CONFIG.queue.maxRetries}) exceeded`
        );
        failCount++;

        logger.error('Queued request permanently failed', {
          requestId,
          retryCount: newRetryCount,
          error: result.error.message
        });
      } else if (result.shouldQueue) {
        // Retry again - move back to pending
        await queueManager.moveToPending(processingPath, entry, newRetryCount);
        requeueCount++;

        logger.queue('Queued request requeued', {
          requestId,
          retryCount: newRetryCount
        });
      } else {
        // Non-retryable error - move to failed
        await queueManager.moveToFailed(
          processingPath,
          entry,
          'Non-retryable error: ' + result.error.message
        );
        failCount++;
      }
    }
  }

  const duration = Date.now() - startTime;

  logger.queue('Queue processing completed', {
    duration,
    successCount,
    failCount,
    requeueCount,
    finalQueueSizes: {
      pending: queueManager.getQueueSize('pending'),
      processing: queueManager.getQueueSize('processing'),
      failed: queueManager.getQueueSize('failed')
    }
  });
}

// Execute
processQueue()
  .then(() => {
    logger.shutdown();
    process.exit(0);
  })
  .catch(error => {
    logger.error('Queue processing failed', {
      error: error.message,
      stack: error.stack
    });
    logger.shutdown();
    process.exit(1);
  });