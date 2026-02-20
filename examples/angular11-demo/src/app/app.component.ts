import { Component } from '@angular/core';
import { EkaScribeService } from './services/ekascribe.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="container">
      <h1>EkaScribe Angular 11 Demo</h1>

      <!-- Config -->
      <section class="card">
        <h2>Configuration</h2>
        <label>
          Access Token
          <input type="text" [(ngModel)]="accessToken" placeholder="Paste your access token" />
        </label>
        <label>
          Transaction ID
          <input type="text" [(ngModel)]="txnId" placeholder="unique-txn-id" />
        </label>
        <label>
          Environment
          <select [(ngModel)]="env">
            <option value="DEV">DEV</option>
            <option value="PROD">PROD</option>
          </select>
        </label>
      </section>

      <!-- Controls -->
      <section class="card">
        <h2>Controls</h2>
        <div class="btn-row">
          <button (click)="initAndStart()" [disabled]="recording">
            Start Recording
          </button>
          <button (click)="stop()" [disabled]="!recording">
            Stop Recording
          </button>
          <button (click)="getOutput()" [disabled]="recording || !txnId">
            Get Output
          </button>
        </div>
      </section>

      <!-- Status -->
      <section class="card">
        <h2>Status</h2>
        <p><strong>Recording:</strong> {{ recording ? 'Yes' : 'No' }}</p>
        <p><strong>Speaking:</strong> {{ speaking ? 'Yes' : 'No' }}</p>
      </section>

      <!-- Output -->
      <section class="card" *ngIf="output">
        <h2>Output</h2>
        <pre>{{ output | json }}</pre>
      </section>

      <!-- Event Log -->
      <section class="card">
        <h2>Event Log</h2>
        <div class="log">
          <div *ngFor="let entry of logs" class="log-entry">{{ entry }}</div>
          <div *ngIf="logs.length === 0" class="log-empty">No events yet</div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .container { max-width: 640px; margin: 0 auto; }
      .card { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      h1 { margin-bottom: 16px; }
      h2 { font-size: 14px; text-transform: uppercase; color: #888; margin-bottom: 8px; }
      label { display: block; margin-bottom: 8px; font-size: 14px; }
      input, select { display: block; width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; }
      .btn-row { display: flex; gap: 8px; }
      button { padding: 10px 20px; border: none; border-radius: 4px; background: #4f46e5; color: #fff; cursor: pointer; font-size: 14px; }
      button:disabled { background: #ccc; cursor: not-allowed; }
      pre { background: #f0f0f0; padding: 12px; border-radius: 4px; overflow: auto; max-height: 300px; font-size: 13px; }
      .log { max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; }
      .log-entry { padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
      .log-empty { color: #aaa; }
    `,
  ],
})
export class AppComponent {
  accessToken = '';
  txnId = '';
  env: 'DEV' | 'PROD' = 'DEV';
  recording = false;
  speaking = false;
  output: any = null;
  logs: string[] = [];

  constructor(private ekascribe: EkaScribeService) {}

  async initAndStart(): Promise<void> {
    try {
      this.log('Initialising SDK...');
      this.ekascribe.init(this.accessToken, this.env);

      // Register callbacks before starting
      this.ekascribe.onEvent((event) => {
        this.log(`[event] ${event.callback_type}: ${event.status} — ${event.message}`);
      });
      this.ekascribe.onSpeech((isSpeaking) => {
        this.speaking = isSpeaking;
      });

      this.log('Creating transaction...');
      const initRes = await this.ekascribe.initTransaction(this.txnId);
      this.log(`Transaction init: ${JSON.stringify(initRes)}`);

      this.log('Starting recording...');
      const startRes = await this.ekascribe.startRecording();
      this.log(`Recording started: ${JSON.stringify(startRes)}`);
      this.recording = true;
    } catch (err: any) {
      this.log(`ERROR: ${err.message || err}`);
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping recording...');
      const res = await this.ekascribe.stopRecording();
      this.log(`Recording stopped: ${JSON.stringify(res)}`);
      this.recording = false;
      this.speaking = false;
    } catch (err: any) {
      this.log(`ERROR: ${err.message || err}`);
    }
  }

  async getOutput(): Promise<void> {
    try {
      this.log('Fetching output...');
      const res = await this.ekascribe.getOutput();
      this.output = res;
      this.log('Output received');
    } catch (err: any) {
      this.log(`ERROR: ${err.message || err}`);
    }
  }

  private log(msg: string): void {
    const ts = new Date().toLocaleTimeString();
    this.logs.unshift(`[${ts}] ${msg}`);
  }
}
