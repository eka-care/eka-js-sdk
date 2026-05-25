export class WidgetTimer {
  private startTime = 0;
  private elapsed = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCallback: (formatted: string) => void;

  constructor(onTick: (formatted: string) => void) {
    this.tickCallback = onTick;
  }

  start(): void {
    this.elapsed = 0;
    this.startTime = Date.now();
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  pause(): void {
    this.clearInterval();
    this.elapsed = Date.now() - this.startTime;
  }

  resume(): void {
    this.startTime = Date.now() - this.elapsed;
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop(): number {
    this.clearInterval();
    this.elapsed = Date.now() - this.startTime;
    return this.getDurationSeconds();
  }

  getDurationSeconds(): number {
    return Math.floor(this.elapsed / 1000);
  }

  getFormatted(): string {
    return this.format();
  }

  private tick(): void {
    this.elapsed = Date.now() - this.startTime;
    this.tickCallback(this.format());
  }

  private format(): string {
    const totalSec = this.getDurationSeconds();
    const min = String(Math.floor(totalSec / 60));
    const sec = String(totalSec % 60).padStart(2, '0');
    return `${min}:${sec}`;
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
