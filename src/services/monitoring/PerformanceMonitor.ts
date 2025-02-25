type MetricType = 'request' | 'track' | 'error';

interface Metric {
  timestamp: number;
  type: MetricType;
  duration?: number;
  error?: string;
  userId?: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Metric[] = [];
  private readonly MAX_METRICS = 1000;

  private constructor() {
    setInterval(() => this.cleanup(), 3600000); // Cleanup every hour
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
  }

  recordDuration(type: MetricType, startTime: number, userId?: string) {
    const duration = performance.now() - startTime;
    this.recordMetric(type, { duration, userId });
  }

  recordError(error: Error, userId?: string) {
    this.recordMetric('error', {
      error: error.message,
      userId,
    });
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

  private cleanup() {
    const cutoff = Date.now() - 24 * 3600 * 1000; // Keep last 24 hours
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
  }
}
