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
  ...(caPath ? { ssl: { ca: readFileSync(caPath, "utf8") } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
