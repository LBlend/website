export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export interface SnapshotSource<TPayload = unknown, TData = unknown> {
  name: string;
  intervalMs: number;
  isConfigured: () => boolean;
  fetch: (signal: AbortSignal) => Promise<TPayload>;
  // Must throw on an unexpected payload shape, which keeps bad responses out of the database
  derive(payload: TPayload): TData;
  fallback: TData;
}

export const defineSource = <TPayload, TData>(source: SnapshotSource<TPayload, TData>) => source;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    // Query strings can contain API keys
    const { origin, pathname } = new URL(url);
    super(`HTTP ${status} from ${origin}${pathname}`);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { ...init, signal });
  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}
