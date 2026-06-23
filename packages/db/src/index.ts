import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema.js";

const localDatabaseUrl =
  "postgres://bankroll:bankroll@localhost:5432/bankroll_mafia";

export function createDb(
  databaseUrl =
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "production" ? undefined : localDatabaseUrl),
) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create the database client");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}

export * from "./schema.js";
