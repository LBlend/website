import type { Tx } from "@lib/db/client";

export interface Job {
  name: string;
  intervalMs: number;
  isConfigured: () => boolean;
  run: (tx: Tx, signal: AbortSignal) => Promise<void>;
}
