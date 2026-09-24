// Applies every file in supabase/migrations/ to an in-process Postgres
// (PGlite) set up with Supabase's own role model, then checks what the
// public API roles can and can't do. This is the local counterpart of the
// read-only inspection of the live project recorded in
// docs/review-remediation-status.md (SEC-6) - it proves the migrations as
// written enforce the intended access, not that production has them applied.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(root, "supabase", "migrations");

let db;

// Supabase provisions these roles and, crucially, default privileges that
// give anon/authenticated ALL on every new public table - reproducing that
// is what makes the least-privilege migration's effect observable here.
const SUPABASE_BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

async function as(role, sql, params) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function denied(role, sql) {
  try {
    const r = await as(role, sql);
    return { denied: false, rows: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { denied: true, message: e.message };
  }
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  // Harmless fixture rows, inserted as the privileged setup user.
  await db.exec(`
    insert into public.news_items (external_id, headline, body, source, category, published_at) values ('fixture:1', 'Fixture headline', 'Fixture body', 'Fixture', 'vuln', now());
    insert into public.exploit_items (cve_id, vendor, product, headline, description, explainer, safe_guidance, source, source_url, date_added) values ('CVE-0000-0001', 'V', 'P', 'H', 'D', 'E', 'S', 'Fixture', 'https://example.test/', now());
    insert into public.case_studies (external_id, year, title, href, source_name, summary_what, summary_how, summary_impact, summary_lesson, summary_safeguard) values ('fixture-1', '2026', 'T', 'https://example.test/', 'S', 'w', 'h', 'i', 'l', 's');
    insert into public.case_study_fetch_log (found_count) values (0);
  `);
});

const PUBLIC_FEEDS = ["news_items", "exploit_items", "case_studies"];

test("anon and authenticated can read the three public feeds", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const t of PUBLIC_FEEDS) {
      const r = await as(role, `select count(*)::int as n from public.${t}`);
      assert.ok(r.rows[0].n >= 1, `${role} should read ${t}`);
    }
  }
});

test("anon can read keepalive (the keep-alive ping), authenticated needs nothing there", async () => {
  const r = await as("anon", "select count(*)::int as n from public.keepalive");
  assert.ok(r.rows[0].n >= 1);
});

test("API roles cannot INSERT, UPDATE, DELETE or TRUNCATE any table", async () => {
  const tables = [...PUBLIC_FEEDS, "keepalive", "case_study_fetch_log", "job_leases"];
  for (const role of ["anon", "authenticated"]) {
    for (const t of tables) {
      for (const sql of [
        `update public.${t} set id = id`,
        `delete from public.${t}`,
        `truncate public.${t}`,
      ]) {
        const r = await denied(role, sql);
        assert.ok(r.denied, `${role} must be denied: ${sql} (got ${JSON.stringify(r)})`);
      }
    }
    const insert = await denied(role, `insert into public.news_items (external_id, headline, body, source, category, published_at) values ('x', 'x', 'x', 'x', 'vuln', now())`);
    assert.ok(insert.denied, `${role} must not insert news_items`);
  }
});

test("internal tables are invisible to API roles", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const t of ["case_study_fetch_log", "job_leases"]) {
      const r = await denied(role, `select * from public.${t}`);
      assert.ok(r.denied, `${role} must not read ${t}`);
    }
  }
});

test("only service_role can call the job-lease functions", async () => {
  for (const role of ["anon", "authenticated"]) {
    const r = await denied(role, `select public.try_acquire_job_lease('x', '00000000-0000-0000-0000-000000000001', 60)`);
    assert.ok(r.denied, `${role} must not execute try_acquire_job_lease`);
  }
  const ok = await as("service_role", `select public.try_acquire_job_lease('grant-check', '00000000-0000-0000-0000-000000000001', 60) as got`);
  assert.equal(ok.rows[0].got, true);
});

const HOLDER_A = "00000000-0000-0000-0000-00000000000a";
const HOLDER_B = "00000000-0000-0000-0000-00000000000b";
async function acquire(job, holder, lease = 60, sinceStart = 0, sinceSuccess = 0) {
  const r = await as("service_role", `select public.try_acquire_job_lease($1, $2, $3, $4, $5) as got`, [job, holder, lease, sinceStart, sinceSuccess]);
  return r.rows[0].got;
}
async function release(job, holder, status) {
  const r = await as("service_role", `select public.release_job_lease($1, $2, $3) as ok`, [job, holder, status]);
  return r.rows[0].ok;
}
async function expireLease(job) {
  await db.query(`update public.job_leases set lease_expires_at = now() - interval '1 second' where job = $1`, [job]);
}

test("a held lease blocks a second holder until it expires", async () => {
  assert.equal(await acquire("race", HOLDER_A), true);
  assert.equal(await acquire("race", HOLDER_B), false, "second caller must not get a live lease");
  await expireLease("race");
  assert.equal(await acquire("race", HOLDER_B), true, "an abandoned (expired) lease can be taken over");
  assert.equal(await release("race", HOLDER_A, "ok"), false, "a stale holder cannot release someone else's lease");
  assert.equal(await release("race", HOLDER_B, "ok"), true);
});

test("min-since-success keeps a daily feed from re-running after a good run, but lets a failed run retry", async () => {
  const day = 20 * 3600;
  assert.equal(await acquire("feed", HOLDER_A, 60, 0, day), true);
  await release("feed", HOLDER_A, "ok");
  assert.equal(await acquire("feed", HOLDER_B, 60, 0, day), false, "succeeded recently - skip");
  await db.query(`update public.job_leases set last_status = 'error' where job = 'feed'`);
  assert.equal(await acquire("feed", HOLDER_B, 60, 0, day), true, "last run failed - retry allowed");
});

test("min-since-start throttles a paid job regardless of outcome", async () => {
  assert.equal(await acquire("paid", HOLDER_A, 60, 3600, 0), true);
  await release("paid", HOLDER_A, "error");
  assert.equal(await acquire("paid", HOLDER_B, 60, 3600, 0), false, "attempted within the hour - skip even though it failed");
  await db.query(`update public.job_leases set last_started_at = now() - interval '2 hours' where job = 'paid'`);
  assert.equal(await acquire("paid", HOLDER_B, 60, 3600, 0), true);
});

test("invalid lease length is rejected", async () => {
  await assert.rejects(() => as("service_role", `select public.try_acquire_job_lease('bad', $1, 0)`, [HOLDER_A]));
});
