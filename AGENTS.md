# LinkSight RF (`rf-link-planner`)

## Architecture & Runtime
- Monorepo with workspaces: `@linksight/rf-engine`, `@linksight/api`, `@linksight/web`.
- API served via PM2 (`rf-link-planner-api`, `apps/api/dist/index.js`) bound to `127.0.0.1:3003`.
- Static SPA served via OpenResty (`https://rf.andresptr.site`) from `/opt/1panel/apps/openresty/openresty/www/sites/rf.andresptr.site/index`.

## Verification Commands
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`

## Guardrails
- Always build `@linksight/rf-engine` before `api`/`web` (handled automatically by root `npm run build`, `typecheck`, and `test` scripts).
- Keep API bound strictly to `127.0.0.1:3003`.
- Never commit secrets or credentials.
