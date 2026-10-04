import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
if (!Number.isInteger(configuredPoolMax) || configuredPoolMax < 1 || configuredPoolMax > 20) {
  throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20.");
}

let directory = process.cwd();
let caPath: string | undefined;
while (true) {
  const candidate = path.join(directory, "supabase-ca.crt");
  if (existsSync(candidate)) {
    caPath = candidate;
    break;
  }
  const parent = path.dirname(directory);
  if (parent === directory) break;
  directory = parent;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: configuredPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(caPath ? { ssl: { ca: readFileSync(caPath, "utf8") } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
