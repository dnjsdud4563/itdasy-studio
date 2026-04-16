#!/usr/bin/env bash
# E2E smoke test: 헬스체크 → 인증 없는 생성 거부 → 약관/처방침 파일 존재
set -euo pipefail

BASE=${BASE:-http://localhost:3001}

echo "1) healthz"
curl -fsS "$BASE/healthz" | grep -q '"ok":true'

echo "2) auth required on generate"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/ai/generate-image" -H 'content-type: application/json' -d '{"prompt":"x"}')
[ "$code" = "401" ]

echo "3) webhook sig check"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/billing/webhooks/revenuecat" -H 'content-type: application/json' -d '{}')
[ "$code" = "401" ]

echo "4) docs present"
test -f docs/privacy-policy-ko.md
test -f docs/terms-of-service-ko.md

echo "ALL PASS"
