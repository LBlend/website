import { DATABASE_URL } from "astro:env/server";
import postgres from "postgres";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

// On globalThis so dev-server reloads reuse the pool instead of leaking connections
const g = globalThis as { __furumoDb?: Sql };

export function getDb(): Sql | null {
  if (!DATABASE_URL) return null;
  g.__furumoDb ??= postgres(DATABASE_URL, {
    max: 5,
    connect_timeout: 5,
    query_timeout: 10,
    idle_timeout: 60,
    onnotice: () => {},
    connection: { application_name: "furumo-website" },
  });
  return g.__furumoDb;
}
