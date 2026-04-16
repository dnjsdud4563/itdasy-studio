#!/usr/bin/env node
// 부하 테스트: autocannon으로 주요 엔드포인트 검증
// 사용: npx autocannon 필요 → npm i -g autocannon 또는 npx로 실행
// node scripts/load-test.mjs

import { execSync } from 'node:child_process';

const BASE = process.env.BASE || 'http://localhost:3001';
const endpoints = [
  { path: '/healthz', method: 'GET' },
];

for (const ep of endpoints) {
  console.log(`\n=== ${ep.method} ${ep.path} ===`);
  try {
    execSync(
      `npx autocannon -c 100 -d 10 -p 10 ${BASE}${ep.path}`,
      { stdio: 'inherit' }
    );
  } catch {
    console.error(`FAILED: ${ep.path}`);
  }
}
console.log('\n=== Load test complete ===');
