declare module 'node-telegram-bot-api';
declare module 'pdf-parse';
declare module 'exceljs';
declare module 'uuid' {
  export function v4(): string;
}

declare module 'bullmq' {
  export class Queue<T = unknown> {
    constructor(name: string, opts: { connection: object });
    add(name: string, data: T, opts?: object): Promise<{ id: string }>;
  }
  export class Worker<T = unknown> {
    constructor(name: string, processor: (job: Job<T>) => Promise<void>, opts: { connection: object; concurrency: number });
    on(event: string, fn: (job?: { id?: string }, err?: Error) => void): void;
    close(): Promise<void>;
  }
  export interface Job<T = unknown> {
    data: T;
    id?: string;
    log(message: string): void;
  }
}
