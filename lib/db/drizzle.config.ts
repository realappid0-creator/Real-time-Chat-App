import { defineConfig } from "drizzle-kit";
import { existsSync } from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const caPath = path.resolve(__dirname, "../../supabase-ca.crt");
if (existsSync(caPath)) {
  databaseUrl.searchParams.set("sslrootcert", caPath);
  databaseUrl.searchParams.set("sslmode", "verify-full");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl.toString(),
  },
});
