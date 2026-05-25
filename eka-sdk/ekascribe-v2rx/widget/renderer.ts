import { WidgetState, type WidgetTheme, type WidgetPosition } from './types';
import { getWidgetStyles } from './styles';
import { enableDrag } from './drag';

const SVG_MIC =
  '<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
const SVG_PAUSE =
  '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const SVG_STOP =
  '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
const SVG_PLAY =
  '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
const SVG_CHECK =
  '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_X =
  '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const DRAG_HANDLE_HTML =
  '<div class="drag-handle"><span></span><span></span><span></span></div>';

export interface RendererActions {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export class WidgetRenderer {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private widgetEl: HTMLElement;
  private bodyEl: HTMLElement;
  private headerEl: HTMLElement;
  private cleanupDrag: (() => void) | null = null;
  private actions: RendererActions;

  constructor(
    theme: WidgetTheme,
    zIndex: number,
    primaryColor: string | undefined,
    position: WidgetPosition | undefined,
    actions: RendererActions
  ) {
    this.actions = actions;

    this.host = document.createElement('eka-scribe-widget');
    if (theme === 'light') {
      this.host.classList.add('light');
    }
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = getWidgetStyles(primaryColor);
    this.shadow.appendChild(style);

    this.widgetEl = document.createElement('div');
    this.widgetEl.className = 'widget';
    this.widgetEl.style.zIndex = String(zIndex);
    this.applyPosition(position);
    this.shadow.appendChild(this.widgetEl);

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'header';
    this.widgetEl.appendChild(this.headerEl);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'body';
    this.widgetEl.appendChild(this.bodyEl);

    this.cleanupDrag = enableDrag(this.widgetEl, this.headerEl);

    document.body.appendChild(this.host);
  }

  renderState(
    state: WidgetState,
    data?: { time?: string; error?: string }
  ): void {
    switch (state) {
      case WidgetState.COLLAPSED:
        this.renderCollapsed();
        break;
      case WidgetState.RECORDING:
        this.renderRecording(data?.time || '00:00');
        break;
      case WidgetState.PAUSED:
        this.renderPaused(data?.time || '00:00');
        break;
      case WidgetState.PROCESSING:
        this.renderProcessing();
        break;
      case WidgetState.DONE:
        this.renderDone();
        break;
      case WidgetState.ERROR:
        this.renderError(data?.error || 'Something went wrong');
        break;
    }
  }

  updateTimer(time: string): void {
    const timerEl = this.shadow.querySelector('.timer');
    if (timerEl) {
      timerEl.textContent = time;
    }
  }

  destroy(): void {
    if (this.cleanupDrag) {
      this.cleanupDrag();
      this.cleanupDrag = null;
    }
    this.host.remove();
  }

  private renderCollapsed(): void {
    this.headerEl.style.display = 'none';
    this.bodyEl.innerHTML = '';
    const btn = this.createButton('mic-btn', SVG_MIC);
    this.bodyEl.appendChild(btn);
  }

  private renderRecording(time: string): void {
    this.setHeader(`
      ${DRAG_HANDLE_HTML}
      <div class="spacer"></div>
      <div class="badge-rec"><div class="dot"></div><span class="txt">REC</span></div>
    `);

    this.bodyEl.innerHTML = `<span class="timer">${this.escapeHtml(time)}</span>`;

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const pauseBtn = this.createButton('btn-circle btn-pause', SVG_PAUSE);
    pauseBtn.addEventListener('click', this.actions.onPause);
    btnRow.appendChild(pauseBtn);

    const stopBtn = this.createButton('btn-circle btn-stop', SVG_STOP);
    stopBtn.addEventListener('click', this.actions.onStop);
    btnRow.appendChild(stopBtn);

    this.bodyEl.appendChild(btnRow);
  }

  private renderPaused(time: string): void {
    this.setHeader(`
      ${DRAG_HANDLE_HTML}
      <div class="spacer"></div>
      <span class="badge-paused">PAUSED</span>
    `);

    this.bodyEl.innerHTML = `<span class="timer dimmed">${this.escapeHtml(time)}</span>`;

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const resumeBtn = this.createButton('btn-circle btn-resume', SVG_PLAY);
    resumeBtn.addEventListener('click', this.actions.onResume);
    btnRow.appendChild(resumeBtn);

    const stopBtn = this.createButton('btn-circle btn-stop', SVG_STOP);
    stopBtn.addEventListener('click', this.actions.onStop);
    btnRow.appendChild(stopBtn);

    this.bodyEl.appendChild(btnRow);
  }

  private renderProcessing(): void {
    this.setHeader(`
      ${DRAG_HANDLE_HTML}
      <div class="spacer"></div>
    `);

    this.bodyEl.innerHTML = `
      <div class="spinner"></div>
      <span class="status-text">Processing notes...</span>
    `;
  }

  private renderDone(): void {
    this.headerEl.style.display = 'flex';
    this.headerEl.innerHTML = `${DRAG_HANDLE_HTML}<div class="spacer"></div>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'header-action';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', this.actions.onClose);
    this.headerEl.appendChild(closeBtn);
    this.rebindDrag();

    this.bodyEl.innerHTML = `
      <div class="done-icon">${SVG_CHECK}</div>
      <span class="done-text">Notes ready</span>
    `;
  }

  private renderError(message: string): void {
    this.headerEl.style.display = 'flex';
    this.headerEl.innerHTML = `${DRAG_HANDLE_HTML}<div class="spacer"></div>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'header-action';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', this.actions.onClose);
    this.headerEl.appendChild(closeBtn);
    this.rebindDrag();

    this.bodyEl.innerHTML = `
      <div class="error-icon">${SVG_X}</div>
      <span class="error-text">${this.escapeHtml(message)}</span>
    `;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', this.actions.onRetry);
    this.bodyEl.appendChild(retryBtn);
  }

  private setHeader(html: string): void {
    this.headerEl.style.display = 'flex';
    this.headerEl.innerHTML = html;
    this.rebindDrag();
  }

  private createButton(className: string, svgContent: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.innerHTML = svgContent;
    return btn;
  }

  private rebindDrag(): void {
    if (this.cleanupDrag) {
      this.cleanupDrag();
    }
    this.cleanupDrag = enableDrag(this.widgetEl, this.headerEl);
  }

  private applyPosition(position?: WidgetPosition): void {
    if (!position) return;
    if (position.top != null) {
      this.widgetEl.style.top = `${position.top}px`;
      this.widgetEl.style.bottom = 'auto';
    }
    if (position.bottom != null) {
      this.widgetEl.style.bottom = `${position.bottom}px`;
    }
    if (position.left != null) {
      this.widgetEl.style.left = `${position.left}px`;
      this.widgetEl.style.right = 'auto';
    }
    if (position.right != null) {
      this.widgetEl.style.right = `${position.right}px`;
    }
  }

  private escapeHtml(text: string): string {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
  }
}
