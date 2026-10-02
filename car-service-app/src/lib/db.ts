import { Pool } from "pg";

// A single shared connection pool, reused across warm serverless invocations.
// On RDS, SSL is typically available but not always enforced with a
// publicly-trusted chain, so we accept the server certificate without
// strict verification. This still encrypts the connection.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
