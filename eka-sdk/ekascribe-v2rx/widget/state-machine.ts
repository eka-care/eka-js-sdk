import { WidgetState } from './types';

const VALID_TRANSITIONS: Record<WidgetState, WidgetState[]> = {
  [WidgetState.COLLAPSED]: [WidgetState.RECORDING],
  [WidgetState.RECORDING]: [
    WidgetState.PAUSED,
    WidgetState.PROCESSING,
    WidgetState.ERROR,
  ],
  [WidgetState.PAUSED]: [
    WidgetState.RECORDING,
    WidgetState.PROCESSING,
    WidgetState.ERROR,
  ],
  [WidgetState.PROCESSING]: [WidgetState.DONE, WidgetState.ERROR],
  [WidgetState.DONE]: [WidgetState.COLLAPSED],
  [WidgetState.ERROR]: [WidgetState.COLLAPSED, WidgetState.RECORDING],
};

export type StateChangeListener = (from: WidgetState, to: WidgetState) => void;

export class WidgetStateMachine {
  private state: WidgetState = WidgetState.COLLAPSED;
  private listeners: Set<StateChangeListener> = new Set();

  get current(): WidgetState {
    return this.state;
  }

  canTransition(to: WidgetState): boolean {
    return VALID_TRANSITIONS[this.state].includes(to);
  }

  transition(to: WidgetState): void {
    if (!this.canTransition(to)) {
      throw new Error(
        `[EkaScribe Widget] Invalid state transition: ${this.state} → ${to}`
      );
    }
    const from = this.state;
    this.state = to;
    for (const listener of this.listeners) {
      listener(from, to);
    }
  }

  onChange(listener: StateChangeListener): void {
    this.listeners.add(listener);
  }

  offChange(listener: StateChangeListener): void {
    this.listeners.delete(listener);
  }

  reset(): void {
    this.state = WidgetState.COLLAPSED;
  }
}
