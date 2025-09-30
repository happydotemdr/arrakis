class IdGenerator {
  static generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `req_${timestamp}_${random}`;
  }

  static generateTraceId(sessionId) {
    const timestamp = Date.now().toString(36);
    const shortSession = sessionId ? sessionId.substring(0, 8) : 'unknown';
    return `trace_${shortSession}_${timestamp}`;
  }

  static generateSpanId(component, sequence = 0) {
    return `span_${component}_${sequence}`;
  }
}

module.exports = IdGenerator;