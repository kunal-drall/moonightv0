import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import * as schema from "./schema.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

const log = createLogger("db");

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
    const sqlite = new Database(config.DATABASE_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    log.info({ path: config.DATABASE_PATH }, "Database initialized");
  }
  return db;
}
