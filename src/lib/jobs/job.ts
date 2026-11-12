import type { Tx } from "@lib/db/client";

export interface Job {
  name: string;
  intervalMs: number;
  timeoutMs?: number;
  isConfigured: () => boolean;
  run: (tx: Tx, signal: AbortSignal) => Promise<void>;
}
