/** Free, isolated capacity exercise. Never sends requests to a hosted service.
 * Runs the production Worker in workerd with local D1/R2 and synthetic trusted
 * gateway identities. This does not benchmark Supabase or a distributed edge. */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { build } from "esbuild";

const users = Number(process.env.SCALE_USERS || 100000);
const requests = Number(process.env.SCALE_REQUESTS || 5000);
const concurrency = Number(process.env.SCALE_CONCURRENCY || 100);
for (const value of [users, requests, concurrency]) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw Error("Invalid scale configuration");
}
const output =
  process.env.SCALE_OUTPUT || "verification-assets/scale-results.json";
const require = createRequire(import.meta.url);
const fromWrangler = createRequire(require.resolve("wrangler"));
const { Miniflare } = await import(
  pathToFileURL(fromWrangler.resolve("miniflare")).href
);
const compiled = await build({
  stdin: {
    contents: `
      import worker from "./sites/server";
      import {createEmptyWorkspace} from "./contracts/workspace";
      export default {async fetch(request,env,ctx) {
        if(new URL(request.url).pathname==="/__test/template") {
          const workspace=createEmptyWorkspace("template@example.invalid","Synthetic creator");
          workspace.brandKit.voice="Clear, practical creator narration. ".repeat(20);
          workspace.scripts=[0,1,2].map(i=>({id:"draft-"+i,title:"Synthetic draft "+i,hook:"A test hook",body:"Synthetic text for a short video. ".repeat(12),cta:"Review the edit",fullScript:"Synthetic text for a short video. ".repeat(12),platform:"tiktok",tone:"clear",duration:30,language:"en",createdAt:workspace.updatedAt}));
          return Response.json(workspace);
        }
        let queries=0;
        const DB={prepare(sql){const statement=env.DB.prepare(sql);return {
          bind(...values){const bound=statement.bind(...values);return wrap(bound);},
          ...wrap(statement)
        };},batch(statements){queries+=statements.length;return env.DB.batch(statements.map(s=>s.original));}};
        function wrap(statement){return {original:statement,bind(...values){return wrap(statement.bind(...values));},first(...args){queries++;return statement.first(...args);},all(...args){queries++;return statement.all(...args);},run(...args){queries++;return statement.run(...args);}};}
        const response=await worker.fetch(request,{...env,DB,ASSETS:{fetch:()=>new Response("test-only static placeholder")}},ctx);
        const headers=new Headers(response.headers);headers.set("X-Test-D1-Queries",String(queries));
        return new Response(response.body,{status:response.status,headers});
      }};
    `,
    resolveDir: process.cwd(),
    sourcefile: "scale-check-worker.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
let outboundCalls = 0;
const runtime = new Miniflare({
  modules: true,
  script: compiled.outputFiles[0].text,
  compatibilityDate: "2026-05-22",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  bindings: {
    AI_PROVENANCE_SIGNING_KEY: "synthetic-scale-test-only-signing-key",
  },
  outboundService: () => {
    outboundCalls++;
    return new Response("External network disabled", { status: 503 });
  },
});
const owner = id => `scale-${String(id).padStart(6, "0")}@example.invalid`;
const headers = id => ({
  "oai-authenticated-user-email": owner(id),
  "Content-Type": "application/json",
});
const call = (path, id, method = "GET", body) =>
  runtime.dispatchFetch(`https://scale.test${path}`, {
    method,
    headers: headers(id),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const report = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  environment: {
    node: process.version,
    os: `${os.platform()} ${os.release()}`,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
  },
  scope:
    "Single local workerd isolate, actual Worker routes and D1/R2 bindings, synthetic gateway identities; no hosted traffic, Supabase, paid providers, media transfer or browser rendering.",
  configuration: {
    users,
    requests,
    concurrency,
    assetsPerUser: 5,
    jobsPerUser: 2,
    ledgerEntriesPerUser: 3,
  },
  phases: [],
  failures: [],
};
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
const save = async () => {
  await mkdir("verification-assets", { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
};
try {
  const workspace = await (
    await runtime.dispatchFetch("https://scale.test/__test/template")
  ).json();
  for (const path of ["/api/workspace", "/api/billing/summary"]) {
    const response = await call(path, 1);
    assert(
      response.ok,
      `Schema warm-up ${path}: ${response.status} ${await response.text()}`
    );
  }
  const db = await runtime.getD1Database("DB");
  // Only this newly-created ephemeral database is cleared. No credentials,
  // remote D1 options, or production database identifiers enter the harness.
  for (const table of [
    "workspace_state",
    "credit_accounts",
    "billing_accounts",
  ])
    await db.prepare(`DELETE FROM ${table}`).run();
  const timestamp = workspace.updatedAt;
  const template = JSON.stringify(workspace);
  report.workspaceTemplateBytes = Buffer.byteLength(template);
  const seedStart = performance.now();
  for (let start = 1; start <= users; start += 1000) {
    const end = Math.min(users, start + 999);
    const cte = `WITH RECURSIVE ids(n) AS (SELECT ${start} UNION ALL SELECT n+1 FROM ids WHERE n<${end}), owners AS (SELECT n, printf('scale-%06d@example.invalid',n) AS email FROM ids)`;
    await db.batch([
      db
        .prepare(
          `${cte} INSERT INTO workspace_state(owner_email,document,updated_at,revision) SELECT email,json_set(?,'$.profile.email',email),?,0 FROM owners`
        )
        .bind(template, timestamp),
      db
        .prepare(
          `${cte} INSERT INTO credit_accounts(owner_email,included_balance,topup_balance,created_at,updated_at) SELECT email,1000,0,?,? FROM owners`
        )
        .bind(timestamp, timestamp),
      db
        .prepare(
          `${cte} INSERT INTO billing_accounts(owner_email,plan_id,billing_cycle,status,created_at,updated_at) SELECT email,'creator','monthly','inactive',?,? FROM owners`
        )
        .bind(timestamp, timestamp),
      db
        .prepare(
          `${cte} INSERT INTO brand_workspaces(id,owner_email,name,created_at) SELECT 'brand-'||n,email,'Synthetic brand',? FROM owners`
        )
        .bind(timestamp),
      db
        .prepare(
          `${cte}, slots(s) AS (VALUES(0),(1),(2),(3),(4)) INSERT INTO assets(id,owner_email,brand_id,name,kind,content_type,bytes,r2_key,created_at) SELECT 'asset-'||n||'-'||s,email,'default','Synthetic media '||s,'audio','audio/mpeg',100000,'synthetic/'||n||'/'||s,? FROM owners CROSS JOIN slots`
        )
        .bind(timestamp),
      db
        .prepare(
          `${cte}, slots(s) AS (VALUES(0),(1)) INSERT INTO generation_jobs(id,owner_email,brand_id,status,progress,payload,created_at,updated_at) SELECT 'job-'||n||'-'||s,email,'default','completed',100,'{}',?,? FROM owners CROSS JOIN slots`
        )
        .bind(timestamp, timestamp),
      db
        .prepare(
          `${cte}, slots(s) AS (VALUES(0),(1),(2)) INSERT INTO credit_ledger(id,owner_email,amount,category,status,operation_key,description,applied,created_at,settled_at) SELECT 'ledger-'||n||'-'||s,email,-2,'speech','settled','synthetic-'||n||'-'||s,'Synthetic past use',1,?,? FROM owners CROSS JOIN slots`
        )
        .bind(timestamp, timestamp),
    ]);
    if (start === 1 || end % 10000 === 0 || end === users)
      console.log(
        JSON.stringify({
          phase: "seed",
          users: end,
          seconds: Math.round((performance.now() - seedStart) / 1000),
        })
      );
  }
  report.seedSeconds = (performance.now() - seedStart) / 1000;
  report.rows = {};
  for (const table of [
    "workspace_state",
    "assets",
    "generation_jobs",
    "credit_accounts",
    "billing_accounts",
    "brand_workspaces",
    "credit_ledger",
  ]) {
    report.rows[table] = (
      await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()
    ).n;
  }
  assert(report.rows.workspace_state === users, "User seed count mismatch");
  report.queryPlans = {};
  for (const [name, sql, args] of [
    [
      "workspace",
      "SELECT document,revision FROM workspace_state WHERE owner_email=?",
      [owner(1)],
    ],
    [
      "assets",
      "SELECT id FROM assets WHERE owner_email=? AND brand_id=? ORDER BY created_at DESC",
      [owner(1), "default"],
    ],
    [
      "jobs",
      "SELECT id FROM generation_jobs WHERE owner_email=? AND brand_id=? ORDER BY created_at DESC",
      [owner(1), "default"],
    ],
    [
      "ledger",
      "SELECT id FROM credit_ledger WHERE owner_email=? ORDER BY created_at DESC LIMIT 20",
      [owner(1)],
    ],
  ])
    report.queryPlans[name] = (
      await db
        .prepare("EXPLAIN QUERY PLAN " + sql)
        .bind(...args)
        .all()
    ).results;
  const storage = await db
    .prepare("SELECT COUNT(*) AS n FROM workspace_state")
    .all();
  report.databaseBytes = storage.meta?.size_after ?? null;
  await save();

  async function phase(name, total, parallel, offset = 0) {
    const latencies = [];
    const routeMetrics = {};
    let next = 0,
      completed = 0;
    const started = performance.now();
    let progress = started;
    await Promise.all(
      Array.from({ length: parallel }, async () => {
        while (next < total) {
          const i = next++;
          const id = ((i * 7919 + offset) % users) + 1;
          const route =
            i % 10 < 6
              ? "/api/workspace"
              : i % 10 < 9
                ? "/api/billing/summary"
                : "/api/brands";
          const time = performance.now();
          try {
            const response = await call(route, id);
            const data = await response.json();
            routeMetrics[route] ??= { requests: 0, errors: 0, queries: 0 };
            routeMetrics[route].queries += Number(
              response.headers.get("X-Test-D1-Queries")
            );
            assert(
              response.status === 200,
              `${route}: ${response.status} ${JSON.stringify(data).slice(0, 160)}`
            );
            if (route === "/api/workspace") {
              assert(
                data.workspace.profile.email === owner(id),
                "Owner isolation mismatch"
              );
              assert(data.workspace.assets.length === 5, "Wrong asset count");
              assert(
                data.workspace.assets.every(asset =>
                  asset.id.startsWith(`asset-${id}-`)
                ),
                "Asset owner mismatch"
              );
              assert(data.workspace.jobs.length === 2, "Wrong job count");
            } else if (route === "/api/billing/summary")
              assert(
                data.billing.availableCredits === 1000,
                "Credit balance mismatch"
              );
            else assert(data.brands.length === 2, "Wrong brand count");
          } catch (error) {
            if (report.failures.length < 30)
              report.failures.push({
                phase: name,
                i,
                route,
                error: String(error),
                cause: String(error.cause || ""),
                code: error.cause?.code,
              });
            routeMetrics[route] ??= { requests: 0, errors: 0, queries: 0 };
            routeMetrics[route].errors++;
          }
          const elapsed = performance.now() - time;
          latencies.push(elapsed);
          routeMetrics[route] ??= { requests: 0, errors: 0, queries: 0 };
          routeMetrics[route].requests++;
          completed++;
          if (performance.now() - progress > 10000) {
            progress = performance.now();
            console.log(
              JSON.stringify({
                phase: name,
                completed,
                total,
                rps: Math.round((completed * 1000) / (progress - started)),
              })
            );
          }
        }
      })
    );
    latencies.sort((a, b) => a - b);
    const elapsed = (performance.now() - started) / 1000;
    const percentile = p =>
      latencies[
        Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))
      ];
    const metrics = {
      name,
      requests: total,
      concurrency: parallel,
      seconds: elapsed,
      requestsPerSecond: total / elapsed,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: latencies.at(-1),
      routes: routeMetrics,
    };
    report.phases.push(metrics);
    console.log(JSON.stringify(metrics));
    await save();
  }
  for (const parallel of [1, 10, 50, 100, 250])
    await phase(`ramp-${parallel}`, Math.min(300, requests), parallel);
  await phase("mixed-user-workload", requests, concurrency, 10001);

  // Optimistic concurrency protects a workspace from simultaneous stale saves.
  const before = await (await call("/api/workspace", users)).json();
  before.workspace.brandKit.name = "Synthetic saved change";
  const saveResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      call("/api/workspace", users, "PUT", { workspace: before.workspace })
    )
  );
  report.concurrentSaves = { statuses: saveResults.map(r => r.status) };
  assert(
    saveResults.filter(r => r.status === 200).length === 1,
    "Expected one winning workspace save"
  );
  assert(
    saveResults.filter(r => r.status === 409).length === 19,
    "Expected stale saves to conflict"
  );
  const after = await (await call("/api/workspace", users)).json();
  assert(
    after.workspace.brandKit.name === "Synthetic saved change",
    "Winning save lost"
  );
  report.concurrentSaves.revision = after.workspace.revision;
  const foreign = await runtime.dispatchFetch(
    "https://scale.test/api/workspace",
    { headers: { ...headers(1), "X-Reelassati-Brand": `brand-${users}` } }
  );
  report.crossOwnerBrandStatus = foreign.status;
  assert(foreign.status === 404, "Foreign brand exposed");
  report.outboundCalls = outboundCalls;
  assert(outboundCalls === 0, "Unexpected external network attempted");
  report.completedAt = new Date().toISOString();
  report.passed = report.failures.length === 0;
  await save();
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.fatal = String(error);
  report.passed = false;
  await save();
  throw error;
} finally {
  await runtime.dispose();
}
