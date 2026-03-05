import * as Sentry from '@sentry/browser';
import EkaScribeStore from '../store/store';

const SENTRY_DSN = 'REPLACE_WITH_YOUR_SENTRY_DSN';

export function initSentry(env: 'PROD' | 'DEV'): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: env,
    defaultIntegrations: false,
    tracesSampleRate: 0,
  });
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!EkaScribeStore.enableSentryLogs) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info', timestamp: Date.now() / 1000 });
}

export function captureEvent(message: string, data?: Record<string, unknown>): void {
  if (!EkaScribeStore.enableSentryLogs) return;
  Sentry.captureMessage(message, {
    level: 'info',
    tags: { txn_id: EkaScribeStore.txnID },
    extra: data,
  });
}
