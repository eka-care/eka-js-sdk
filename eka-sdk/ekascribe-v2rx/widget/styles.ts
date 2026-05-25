export function getWidgetStyles(): string {
  return `
    :host {
      all: initial;
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
    }

    .widget.hidden {
      display: none;
    }

    /* ── Pill Container ── */

    .pill {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #F8F9FF;
      border: 1.5px solid #C7D2F6;
      border-radius: 999px;
      padding: 8px 16px;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.12);
      cursor: grab;
    }

    .pill:active {
      cursor: grabbing;
    }

    .pill.vertical {
      flex-direction: column;
      border-radius: 28px;
      padding: 16px 12px;
      gap: 10px;
    }

    /* ── Buttons ── */

    .btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }

    .btn:hover {
      transform: scale(1.08);
    }

    .btn-play-pause {
      background: #2563EB;
    }

    .btn-play-pause svg {
      width: 14px;
      height: 14px;
      fill: #fff;
    }

    .btn-stop {
      background: #DC2626;
    }

    .btn-stop svg {
      width: 12px;
      height: 12px;
      fill: #fff;
    }

    /* ── Timer ── */

    .timer {
      font-size: 16px;
      font-weight: 600;
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      color: #1A1A1A;
      flex-shrink: 0;
      min-width: 36px;
      text-align: center;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border: 3px solid #E0E7FF;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .status-text {
      font-size: 11px;
      color: #6B7280;
    }

    /* ── Done ── */

    .done-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #16A34A;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .done-icon svg {
      width: 14px;
      height: 14px;
      stroke: #fff;
      fill: none;
      stroke-width: 3;
    }

    .done-text {
      font-size: 12px;
      font-weight: 600;
      color: #16A34A;
    }

    .btn-x {
      width: 28px;
      height: 28px;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .btn-x svg {
      width: 16px;
      height: 16px;
      stroke: #9CA3AF;
      stroke-width: 2.5;
    }

    .btn-x:hover svg {
      stroke: #4B5563;
    }

    /* ── Error ── */

    .error-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #DC2626;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .error-icon svg {
      width: 14px;
      height: 14px;
      stroke: #fff;
      fill: none;
      stroke-width: 3;
    }

    .error-text {
      font-size: 10px;
      color: #DC2626;
      text-align: center;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .btn-retry {
      background: none;
      border: 1px solid #DC2626;
      color: #DC2626;
      font-size: 10px;
      padding: 4px 12px;
      border-radius: 999px;
      cursor: pointer;
      font-family: inherit;
    }

    .btn-retry:hover {
      background: #DC2626;
      color: #fff;
    }
  `;
}
