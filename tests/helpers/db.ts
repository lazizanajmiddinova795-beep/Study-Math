import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Creates an in-process Postgres with a stand-in for Supabase's auth schema/roles and applies ALL migrations. */
export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(), email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

export async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`);
  }
}

export async function addAuthUser(db: PGlite, id: string, email: string, meta = "{}"): Promise<void> {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`, [id, email, meta]);
}

export async function rows(db: PGlite, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return (await db.query(sql, params)).rows as Record<string, unknown>[];
}
