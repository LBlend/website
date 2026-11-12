import { createHash } from "node:crypto";
import type { SnapshotSource } from "@lib/sources/source";
import type { Job } from "./job";

export function snapshotJob(source: SnapshotSource): Job {
  return {
    name: `snapshot:${source.name}`,
    intervalMs: source.intervalMs,
    isConfigured: source.isConfigured,
    run: async (tx, signal) => {
      const payload = await source.fetch(signal);
      source.derive(payload);

      const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
      const [latest] = await tx<{ payload_hash: string }[]>`
        select payload_hash from source_snapshots
        where source = ${source.name}
        order by fetched_at desc
        limit 1
      `;
      if (latest?.payload_hash === hash) return;

      await tx`
        insert into source_snapshots (source, payload, payload_hash)
        values (${source.name}, ${tx.json(payload as Parameters<typeof tx.json>[0])}, ${hash})
      `;
    },
  };
}
