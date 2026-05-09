export type CallbackName =
  | 'onRecordingStateChange'
  | 'onAudioEvent'
  | 'onUploadEvent'
  | 'onSessionEvent'
  | 'onError'
  | 'onTokenRequired';

type CallbackHandler = (...args: unknown[]) => unknown;

export class CallbackRegistry {
  private handlers = new Map<CallbackName, Set<CallbackHandler>>();

  register(name: CallbackName, handler: CallbackHandler): void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set());
    }
    this.handlers.get(name)!.add(handler);
  }

  remove(name: CallbackName, handler: CallbackHandler): void {
    this.handlers.get(name)?.delete(handler);
  }

  removeAll(): void {
    this.handlers.clear();
  }

  async dispatch(name: CallbackName, ...args: unknown[]): Promise<unknown> {
    const handlers = this.handlers.get(name);
    if (!handlers || handlers.size === 0) return undefined;

    let result: unknown;
    for (const handler of handlers) {
      try {
        result = await handler(...args);
      } catch (error) {
        console.error(`[EkaScribe] Callback error in '${name}':`, error);
      }
    }
    return result;
  }

  hasHandlers(name: CallbackName): boolean {
    const handlers = this.handlers.get(name);
    return !!handlers && handlers.size > 0;
  }
}
