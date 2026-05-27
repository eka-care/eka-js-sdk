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
      max-height: calc(100vh - 40px);
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
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
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

    /* ── Expanded Done State ── */

    .content-expanded {
      display: flex;
      flex-direction: column-reverse;
      align-items: flex-end;
      gap: 8px;
      cursor: grab;
    }

    .content-expanded:active {
      cursor: grabbing;
    }

    .panel {
      background: #F8F9FF;
      border: 1.5px solid #C7D2F6;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
      overflow: hidden;
      width: 340px;
    }

    .drag-bar {
      display: flex;
      justify-content: center;
      padding: 6px 0 2px;
      cursor: grab;
    }

    .drag-bar:active {
      cursor: grabbing;
    }

    .drag-bar span {
      width: 32px;
      height: 4px;
      background: #C7D2F6;
      border-radius: 2px;
    }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid #C7D2F6;
    }

    .tab {
      flex: 1;
      padding: 8px 0;
      border: none;
      background: none;
      font-size: 12px;
      font-weight: 600;
      color: #9CA3AF;
      cursor: pointer;
      font-family: inherit;
      border-bottom: 2px solid transparent;
    }

    .tab.active {
      color: #2563EB;
      border-bottom-color: #2563EB;
    }

    .tab:hover:not(.active) {
      color: #6B7280;
    }

    .tab-body {
      padding: 12px 16px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
      word-wrap: break-word;
      cursor: auto;
      user-select: text;
    }

    .tab-body::-webkit-scrollbar {
      width: 4px;
    }

    .tab-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .tab-body::-webkit-scrollbar-thumb {
      background: #C7D2F6;
      border-radius: 2px;
    }

    /* ── Markdown content ── */

    .md-content {
      white-space: normal;
    }

    .md-content h1,
    .md-content h2,
    .md-content h3,
    .md-content h4,
    .md-content h5,
    .md-content h6 {
      margin: 12px 0 6px;
      color: #1F2937;
      line-height: 1.3;
    }

    .md-content h1 { font-size: 18px; }
    .md-content h2 { font-size: 16px; }
    .md-content h3 { font-size: 14px; }
    .md-content h4 { font-size: 13px; }

    .md-content p {
      margin: 6px 0;
    }

    .md-content ul,
    .md-content ol {
      padding-left: 20px;
      margin: 6px 0;
    }

    .md-content li {
      margin: 2px 0;
    }

    .md-content code {
      background: #E0E7FF;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }

    .md-content pre {
      background: #1F2937;
      color: #E5E7EB;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      font-size: 12px;
    }

    .md-content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    .md-content strong {
      font-weight: 600;
    }

    .md-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 12px;
    }

    .md-content th,
    .md-content td {
      border: 1px solid #C7D2F6;
      padding: 6px 8px;
      text-align: left;
    }

    .md-content th {
      background: #E0E7FF;
      font-weight: 600;
    }
  `;
}
