#!/usr/bin/env node
// 모든 public 스키마 테이블에 RLS가 활성화되었는지 확인
// 사용: SUPABASE_DB_URL=postgres://... node scripts/rls-audit.mjs

import pg from 'pg';
const { Client } = pg;

const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const { rows } = await c.query(`
  select c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
`);
let fail = 0;
for (const r of rows) {
  const mark = r.relrowsecurity ? 'OK' : 'MISSING';
  if (!r.relrowsecurity) fail++;
  console.log(`[${mark}] ${r.relname}`);
}
await c.end();
if (fail > 0) {
  console.error(`\n${fail} table(s) without RLS.`);
  process.exit(1);
}
console.log('\nAll public tables have RLS enabled.');
