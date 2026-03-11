import * as Sentry from '@sentry/browser';
import EkaScribeStore from '../store/store';

const SENTRY_DSN =
  'https://06451c8d861702902d2e6b2088fa9b62@o1128948.ingest.us.sentry.io/4509207135387648';

export function initSentry(env: 'PROD' | 'DEV'): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: env,
    defaultIntegrations: false,
    tracesSampleRate: 0,
  });
}

export function setSentryUser(flavour: string): void {
  if (!flavour) return;
  Sentry.setUser({ id: flavour, username: flavour });
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
  const txnID = EkaScribeStore.txnID;
  Sentry.captureMessage(message, {
    level: 'info',
    tags: { txn_id: txnID, flavour: EkaScribeStore.flavour },
    extra: data,
    // Each txn_id + event type gets its own Sentry Issue
    fingerprint: [message, txnID],
  });
}
