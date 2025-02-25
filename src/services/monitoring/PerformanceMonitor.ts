type MetricType = 'request' | 'track' | 'error' | 'rateLimit' | 'command-init' | 'event-init';

interface Metric {
  timestamp: number;
  type: MetricType;
  duration?: number;
  error?: string;
  userId?: string;
  details?: Record<string, any>;
}

interface Alert {
  type: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Metric[] = [];
  private alerts: Alert[] = [];
  private readonly MAX_METRICS = 1000;
  private readonly THRESHOLDS = {
    errorRate: 0.1, // 10% error rate
    avgResponseTime: 2000, // 2 seconds
    rateLimitWarning: 0.8, // 80% of rate limit
  };

  private constructor() {
    setInterval(() => this.cleanup(), 3600000); // Cleanup every hour
    setInterval(() => this.checkHealthMetrics(), 300000); // Check health every 5 minutes
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(): number {
    return performance.now();
  }

  recordMetric(type: MetricType, data: Partial<Metric> = {}) {
    const metric: Metric = {
      timestamp: Date.now(),
      type,
      ...data,
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Immediate checks for critical conditions
    if (type === 'error') {
      this.checkErrorThreshold();
    }
    if (type === 'rateLimit') {
      this.checkRateLimitThreshold(data.details);
    }
  }

  recordDuration(type: MetricType, startTime: number, userId?: string) {
    const duration = performance.now() - startTime;
    this.recordMetric(type, { duration, userId });

    if (duration > this.THRESHOLDS.avgResponseTime) {
      this.createAlert(
        'performance',
        `High response time detected: ${Math.round(duration)}ms`,
        'medium'
      );
    }
  }

  recordError(error: Error, userId?: string, details?: Record<string, any>) {
    this.recordMetric('error', {
      error: error.message,
      userId,
      details,
    });
  }

  recordRateLimit(service: string, remaining: number, total: number) {
    this.recordMetric('rateLimit', {
      details: { service, remaining, total },
    });
  }

  private createAlert(type: string, message: string, severity: Alert['severity']) {
    const alert: Alert = {
      type,
      message,
      timestamp: Date.now(),
      severity,
    };

    this.alerts.push(alert);
    console.warn(`[${severity.toUpperCase()}] ${message}`);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  private checkErrorThreshold() {
    const recentErrorRate = this.getErrorRate(300000); // Last 5 minutes
    if (recentErrorRate > this.THRESHOLDS.errorRate) {
      this.createAlert(
        'error-rate',
        `High error rate detected: ${(recentErrorRate * 100).toFixed(1)}%`,
        'high'
      );
    }
  }

  private checkRateLimitThreshold(details?: Record<string, any>) {
    if (details && typeof details.remaining === 'number' && typeof details.total === 'number') {
      const usageRate = 1 - details.remaining / details.total;
      if (usageRate > this.THRESHOLDS.rateLimitWarning) {
        this.createAlert(
          'rate-limit',
          `Rate limit warning: ${(usageRate * 100).toFixed(1)}% used for ${details.service}`,
          'medium'
        );
      }
    }
  }

  private checkHealthMetrics() {
    const avgResponseTime = this.getAverageResponseTime(300000); // Last 5 minutes
    if (avgResponseTime > this.THRESHOLDS.avgResponseTime) {
      this.createAlert(
        'performance',
        `High average response time: ${Math.round(avgResponseTime)}ms`,
        'medium'
      );
    }
  }

  getMetrics(type?: MetricType, timeRange?: number): Metric[] {
    let filtered = this.metrics;

    if (type) {
      filtered = filtered.filter((m) => m.type === type);
    }

    if (timeRange) {
      const cutoff = Date.now() - timeRange;
      filtered = filtered.filter((m) => m.timestamp >= cutoff);
    }

    return filtered;
  }

  getAverageResponseTime(timeRange?: number): number {
    const requests = this.getMetrics('request', timeRange)
      .filter((m) => m.duration !== undefined)
      .map((m) => m.duration as number);

    if (requests.length === 0) return 0;
    return requests.reduce((sum, dur) => sum + dur, 0) / requests.length;
  }

  getErrorRate(timeRange?: number): number {
    const metrics = this.getMetrics(undefined, timeRange);
    if (metrics.length === 0) return 0;

    const errors = metrics.filter((m) => m.type === 'error').length;
    return errors / metrics.length;
  }

  getAlerts(timeRange?: number): Alert[] {
    if (!timeRange) return this.alerts;
    const cutoff = Date.now() - timeRange;
    return this.alerts.filter((a) => a.timestamp >= cutoff);
  }

  private cleanup() {
    const cutoff = Date.now() - 24 * 3600 * 1000; // Keep last 24 hours
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
    this.alerts = this.alerts.filter((a) => a.timestamp >= cutoff);
  }
}
