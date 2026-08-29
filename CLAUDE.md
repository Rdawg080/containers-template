# containers-template

Cloudflare Workers + Containers starter. A Hono Worker (`src/index.ts`) routes
requests to a Go HTTP server (`container_src/main.go`) running in a Container
backed by a Durable Object.

## Layout

| Path | What it is |
| :--- | :--- |
| `src/index.ts` | Worker entrypoint. Hono routes + the `MyContainer` Durable Object class. |
| `container_src/` | Go server that runs inside the container. Listens on `:8080`. |
| `Dockerfile` | Multi-stage build of `container_src` into a `scratch` image. |
| `wrangler.jsonc` | Worker config: container image, DO binding `MY_CONTAINER`, migrations. |
| `worker-configuration.d.ts` | Generated Workers types. Regenerate with `npm run cf-typegen`; do not hand-edit. |

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install Worker dependencies. |
| `npm run dev` | Local dev server on http://localhost:8787 (requires Docker for the container). |
| `npx tsc --noEmit` | Typecheck the Worker. This is the closest thing to a lint step. |
| `gofmt -l container_src` | Check Go formatting. Any output means a file needs `gofmt -w`. |
| `cd container_src && go vet ./...` | Vet the container source. |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc`. |
| `npm run deploy` | Deploy to Cloudflare. |

There is no test suite in this template. If you add tests, add the runner to
`package.json` scripts and to `.claude/hooks/session-start.sh` so remote
sessions have it available.

## Conventions

- TypeScript is `strict`; `noEmit` is on, so `tsc` is a checker, not a build step.
- Tabs for indentation in TS and JSON, matching the existing files.
- Changing the container's port means changing three places: `EXPOSE` in the
  `Dockerfile`, the listener address in `container_src/main.go`, and
  `defaultPort` on `MyContainer`.
- Adding or renaming a Durable Object class requires a new entry in the
  `migrations` array in `wrangler.jsonc`.
- After editing bindings in `wrangler.jsonc`, run `npm run cf-typegen` so `Env`
  stays in sync.

## Session setup

`.claude/hooks/session-start.sh` runs on session start in Claude Code on the web
(`CLAUDE_CODE_REMOTE=true`) and installs npm dependencies plus Go modules. It
no-ops in local sessions.
