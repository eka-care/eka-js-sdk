import * as Sentry from '@sentry/browser';

const SENTRY_DSN =
  'https://06451c8d861702902d2e6b2088fa9b62@o1128948.ingest.us.sentry.io/4509207135387648';

export class Tracker {
  private enabled: boolean;
  private flavour?: string;
  private txnId?: string;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  init(env: string): void {
    if (!this.enabled) return;
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: env,
      defaultIntegrations: false,
      tracesSampleRate: 0,
    });
  }

  setUser(userId: string): void {
    if (!this.enabled || !userId) return;
    this.flavour = userId;
    Sentry.setUser({ id: userId, username: userId });
  }

  setTransactionId(txnId: string): void {
    this.txnId = txnId;
  }

  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    Sentry.addBreadcrumb({ category, message, data, level: 'info', timestamp: Date.now() / 1000 });
  }

  captureEvent(message: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    Sentry.captureMessage(message, {
      level: 'info',
      tags: { txn_id: this.txnId, flavour: this.flavour },
      extra: data,
      fingerprint: [message, this.txnId ?? ''],
    });
  }

  captureError(error: Error, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    Sentry.captureException(error, {
      tags: { txn_id: this.txnId, flavour: this.flavour },
      extra: data,
    });
  }
}
