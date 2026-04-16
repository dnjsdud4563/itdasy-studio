.PHONY: install dev build typecheck smoke migrate functions-deploy key rls-audit

install:
	cd server && npm install
	cd packages/platform-sdk && npm install

dev:
	cd server && npm run dev

build:
	cd server && npm run build
	cd packages/platform-sdk && npm run build

typecheck:
	cd server && npm run typecheck
	cd packages/platform-sdk && npm run typecheck

smoke:
	bash scripts/smoke-test.sh

migrate:
	supabase db push

functions-deploy:
	supabase functions deploy reconcile-r2
	supabase functions deploy export-user-data
	supabase functions schedule create reconcile-r2 --cron "0 20 * * *" || true

key:
	@node scripts/gen-pii-key.mjs

rls-audit:
	node scripts/rls-audit.mjs
