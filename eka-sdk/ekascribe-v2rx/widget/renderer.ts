import { WidgetState, type WidgetPosition } from './types';
import { getWidgetStyles } from './styles';
import { enableDrag } from './drag';

type Orientation = 'horizontal' | 'vertical';

const SVG_PAUSE =
  '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const SVG_PLAY =
  '<svg viewBox="0 0 24 24"><polygon points="8,4 20,12 8,20"/></svg>';
const SVG_STOP =
  '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
const SVG_CHECK =
  '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_X =
  '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const H_BAR_COUNT = 20;
const V_BAR_COUNT = 14;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

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
  private contentEl: HTMLElement;
  private cleanupDrag: (() => void) | null = null;
  private actions: RendererActions;
  private orientation: Orientation;
  private animationId: number | null = null;
  private waveformBars: SVGRectElement[] = [];

  constructor(
    zIndex: number,
    position: WidgetPosition | undefined,
    orientation: Orientation,
    actions: RendererActions
  ) {
    this.actions = actions;
    this.orientation = orientation;

    this.host = document.createElement('eka-scribe-widget');
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = getWidgetStyles();
    this.shadow.appendChild(style);

    this.widgetEl = document.createElement('div');
    this.widgetEl.className = 'widget hidden';
    this.widgetEl.style.zIndex = String(zIndex);
    this.applyPosition(position);
    this.shadow.appendChild(this.widgetEl);

    this.contentEl = document.createElement('div');
    this.widgetEl.appendChild(this.contentEl);

    document.body.appendChild(this.host);
  }

  renderState(
    state: WidgetState,
    data?: { time?: string; error?: string }
  ): void {
    this.stopAnimation();

    switch (state) {
      case WidgetState.COLLAPSED:
        this.renderCollapsed();
        break;
      case WidgetState.RECORDING:
        this.renderRecording(data?.time || '0:00');
        break;
      case WidgetState.PAUSED:
        this.renderPaused(data?.time || '0:00');
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
    this.stopAnimation();
    if (this.cleanupDrag) {
      this.cleanupDrag();
      this.cleanupDrag = null;
    }
    this.host.remove();
  }

  // ─── State renderers ──────────────────────────────────────────────────────

  private renderCollapsed(): void {
    this.widgetEl.classList.add('hidden');
    this.contentEl.innerHTML = '';
  }

  private renderRecording(time: string): void {
    this.widgetEl.classList.remove('hidden');
    this.contentEl.innerHTML = '';

    const pill = this.createPill();

    const { svg, bars } = this.createWaveform();
    this.waveformBars = bars;
    pill.appendChild(svg);

    const timer = document.createElement('span');
    timer.className = 'timer';
    timer.textContent = time;
    pill.appendChild(timer);

    const pauseBtn = this.createButton('btn btn-play-pause', SVG_PAUSE);
    pauseBtn.addEventListener('click', this.actions.onPause);
    pill.appendChild(pauseBtn);

    const stopBtn = this.createButton('btn btn-stop', SVG_STOP);
    stopBtn.addEventListener('click', this.actions.onStop);
    pill.appendChild(stopBtn);

    this.contentEl.appendChild(pill);
    this.bindDrag(pill);
    this.startAnimation();
  }

  private renderPaused(time: string): void {
    this.widgetEl.classList.remove('hidden');
    this.contentEl.innerHTML = '';

    const pill = this.createPill();

    const { svg, bars } = this.createWaveform();
    this.waveformBars = bars;
    for (const bar of bars) {
      bar.style.opacity = '0.55';
    }
    pill.appendChild(svg);

    const timer = document.createElement('span');
    timer.className = 'timer';
    timer.textContent = time;
    pill.appendChild(timer);

    const playBtn = this.createButton('btn btn-play-pause', SVG_PLAY);
    playBtn.addEventListener('click', this.actions.onResume);
    pill.appendChild(playBtn);

    const stopBtn = this.createButton('btn btn-stop', SVG_STOP);
    stopBtn.addEventListener('click', this.actions.onStop);
    pill.appendChild(stopBtn);

    this.contentEl.appendChild(pill);
    this.bindDrag(pill);
  }

  private renderProcessing(): void {
    this.widgetEl.classList.remove('hidden');
    this.contentEl.innerHTML = '';

    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `
      <div class="spinner"></div>
      <span class="status-text">Processing notes...</span>
    `;

    this.contentEl.appendChild(pill);
    this.bindDrag(pill);
  }

  private renderDone(): void {
    this.widgetEl.classList.remove('hidden');
    this.contentEl.innerHTML = '';

    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `
      <div class="done-icon">${SVG_CHECK}</div>
      <span class="done-text">Notes ready</span>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-x';
    closeBtn.innerHTML = SVG_X;
    closeBtn.addEventListener('click', this.actions.onClose);
    pill.appendChild(closeBtn);

    this.contentEl.appendChild(pill);
    this.bindDrag(pill);
  }

  private renderError(message: string): void {
    this.widgetEl.classList.remove('hidden');
    this.contentEl.innerHTML = '';

    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `
      <div class="error-icon">${SVG_X}</div>
      <span class="error-text">${this.escapeHtml(message)}</span>
    `;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', this.actions.onRetry);
    pill.appendChild(retryBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-x';
    closeBtn.innerHTML = SVG_X;
    closeBtn.addEventListener('click', this.actions.onClose);
    pill.appendChild(closeBtn);

    this.contentEl.appendChild(pill);
    this.bindDrag(pill);
  }

  // ─── Waveform ─────────────────────────────────────────────────────────────

  private createWaveform(): { svg: SVGSVGElement; bars: SVGRectElement[] } {
    const isVertical = this.orientation === 'vertical';
    const count = isVertical ? V_BAR_COUNT : H_BAR_COUNT;
    const maxHeight = isVertical ? 60 : 28;

    const svgWidth = isVertical
      ? maxHeight
      : count * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
    const svgHeight = isVertical
      ? count * (BAR_WIDTH + BAR_GAP) - BAR_GAP
      : maxHeight;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(svgWidth));
    svg.setAttribute('height', String(svgHeight));
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    const bars: SVGRectElement[] = [];

    for (let i = 0; i < count; i++) {
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      rect.setAttribute('fill', '#2563EB');
      rect.setAttribute('rx', '1.5');

      const h = maxHeight * 0.4;
      if (isVertical) {
        const y = i * (BAR_WIDTH + BAR_GAP);
        rect.setAttribute('x', String((maxHeight - h) / 2));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(h));
        rect.setAttribute('height', String(BAR_WIDTH));
      } else {
        const x = i * (BAR_WIDTH + BAR_GAP);
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String((maxHeight - h) / 2));
        rect.setAttribute('width', String(BAR_WIDTH));
        rect.setAttribute('height', String(h));
      }

      rect.style.opacity = '0.35';
      svg.appendChild(rect);
      bars.push(rect);
    }

    return { svg, bars };
  }

  private startAnimation(): void {
    const isVertical = this.orientation === 'vertical';
    const maxDim = isVertical ? 60 : 28;
    const count = this.waveformBars.length;

    const animate = () => {
      const now = Date.now() / 1000;
      for (let i = 0; i < count; i++) {
        const bar = this.waveformBars[i];
        const wave = Math.sin(now * 4 + i * 0.4) * 0.3 + 0.5;
        const scale = Math.min(1, Math.max(0.15, wave));
        const h = maxDim * scale;

        if (isVertical) {
          bar.setAttribute('width', String(h));
          bar.setAttribute('x', String((maxDim - h) / 2));
        } else {
          bar.setAttribute('height', String(h));
          bar.setAttribute('y', String((maxDim - h) / 2));
        }

        bar.style.opacity = String(0.5 + scale * 0.5);
      }
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.waveformBars = [];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private createPill(): HTMLElement {
    const pill = document.createElement('div');
    pill.className =
      this.orientation === 'vertical' ? 'pill vertical' : 'pill';
    return pill;
  }

  private createButton(
    className: string,
    svgContent: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.innerHTML = svgContent;
    return btn;
  }

  private bindDrag(handle: HTMLElement): void {
    if (this.cleanupDrag) {
      this.cleanupDrag();
    }
    this.cleanupDrag = enableDrag(this.widgetEl, handle);
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
