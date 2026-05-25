export function getWidgetStyles(primaryColor?: string): string {
  const primary = primaryColor || '#6c5ce7';

  return `
    :host {
      --eka-primary: ${primary};
      --eka-bg: #16213e;
      --eka-text: #ffffff;
      --eka-text-muted: #888888;
      --eka-text-dim: #666666;
      --eka-surface: #2d3436;
      --eka-border: none;
      --eka-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      --eka-error: #e74c3c;
      --eka-success: #00b894;
      --eka-warning: #f39c12;
      --eka-drag-color: #aaaaaa;
    }

    :host(.light) {
      --eka-bg: #ffffff;
      --eka-text: #1a1a2e;
      --eka-text-muted: #777777;
      --eka-text-dim: #bbbbbb;
      --eka-surface: #eeeeee;
      --eka-border: 1px solid #e0e0e0;
      --eka-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      --eka-drag-color: #666666;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 140px;
      height: 160px;
      background: var(--eka-bg);
      border-radius: 14px;
      box-shadow: var(--eka-shadow);
      border: var(--eka-border);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* ── Header ── */

    .header {
      display: flex;
      align-items: center;
      padding: 8px 10px 0;
      cursor: grab;
      flex-shrink: 0;
    }

    .header:active {
      cursor: grabbing;
    }

    .drag-handle {
      display: flex;
      flex-direction: column;
      gap: 2px;
      opacity: 0.5;
    }

    .drag-handle span {
      display: block;
      width: 16px;
      height: 2px;
      background: var(--eka-drag-color);
      border-radius: 1px;
    }

    .spacer {
      flex: 1;
    }

    .header-action {
      color: var(--eka-text-muted);
      font-size: 15px;
      cursor: pointer;
      line-height: 1;
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
    }

    .header-action:hover {
      opacity: 0.8;
    }

    /* ── Badges ── */

    .badge-rec {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .badge-rec .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--eka-error);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .badge-rec .txt {
      color: var(--eka-error);
      font-size: 9px;
      font-weight: 700;
    }

    .badge-paused {
      color: var(--eka-warning);
      font-size: 9px;
      font-weight: 700;
    }

    /* ── Animations ── */

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Body ── */

    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 12px 12px;
      text-align: center;
    }

    /* ── Collapsed: mic icon ── */

    .mic-btn {
      width: 48px;
      height: 48px;
      background: var(--eka-primary);
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .mic-btn:hover {
      transform: scale(1.05);
    }

    .mic-btn svg {
      width: 22px;
      height: 22px;
      stroke: #fff;
      fill: none;
      stroke-width: 2;
    }

    /* ── Timer ── */

    .timer {
      font-size: 24px;
      font-weight: 300;
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      color: var(--eka-text);
    }

    .timer.dimmed {
      color: var(--eka-text-dim);
    }

    /* ── Buttons ── */

    .btn-row {
      margin-top: 10px;
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .btn-circle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .btn-circle:hover {
      transform: scale(1.08);
    }

    .btn-circle svg {
      width: 12px;
      height: 12px;
    }

    .btn-pause {
      background: var(--eka-surface);
    }

    .btn-pause svg {
      fill: var(--eka-text);
    }

    .btn-stop {
      background: var(--eka-error);
    }

    .btn-stop svg {
      fill: #fff;
    }

    .btn-resume {
      background: var(--eka-primary);
    }

    .btn-resume svg {
      fill: #fff;
    }

    /* ── Spinner ── */

    .spinner {
      width: 26px;
      height: 26px;
      border: 3px solid var(--eka-surface);
      border-top-color: var(--eka-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 10px;
    }

    .status-text {
      font-size: 10px;
      color: var(--eka-text-muted);
    }

    /* ── Done ── */

    .done-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--eka-success);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }

    .done-icon svg {
      width: 14px;
      height: 14px;
      stroke: #fff;
      fill: none;
      stroke-width: 3;
    }

    .done-text {
      font-size: 11px;
      font-weight: 600;
      color: var(--eka-success);
    }

    /* ── Error ── */

    .error-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--eka-error);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .error-icon svg {
      width: 14px;
      height: 14px;
      stroke: #fff;
      fill: none;
      stroke-width: 3;
    }

    .error-text {
      font-size: 9px;
      color: var(--eka-error);
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .btn-retry {
      margin-top: 6px;
      background: none;
      border: 1px solid var(--eka-error);
      color: var(--eka-error);
      font-size: 9px;
      padding: 3px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
    }

    .btn-retry:hover {
      background: var(--eka-error);
      color: #fff;
    }
  `;
}
