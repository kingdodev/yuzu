import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Een Drizzle-database, ongeacht driver (postgres.js in productie, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Een open transactie op die database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
