# Cloudflare Containers deployment

The web app is served by Cloudflare Workers Assets. Requests under `/api` are forwarded to the Express backend running in a Cloudflare Container. MongoDB/GridFS remains the persistent data store; container disks are disposable and must never be used for user data.

## Platform prerequisites

- A Cloudflare **Workers Paid** plan, because Containers are a paid-plan feature.
- Docker or a Docker-compatible engine for local `wrangler deploy`, unless deployment is built through a supported Workers Builds setup.
- A MongoDB connection reachable from the container, with GridFS enabled on the same database.
- Worker secrets configured before deploying. Do not commit secret values to this repository.

## Required Worker secrets

Run each command from the repository root and enter the existing production value at the prompt:

```sh
npx wrangler secret put MONGODB_CONNECTIONSTRING
npx wrangler secret put JWT_SECRET
npx wrangler secret put OTP_SECRET
npx wrangler secret put INTERNAL_JOB_SECRET
```

Use the existing production MongoDB URI and secrets. Do not rotate `JWT_SECRET` or `OTP_SECRET` as part of this migration unless a deliberate session/OTP invalidation is approved. `INTERNAL_JOB_SECRET` must be a new random secret of at least 32 characters; it authorizes scheduled jobs and must remain private.

Optional secrets/variables, if those features are enabled:

- `SENDGRID_API_KEY`, `RESEND_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `EMAIL_PROVIDER`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `ADMIN_EMAIL`, `CORS_ORIGINS`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`, `EMAIL_VERIFICATION_REQUIRED`

`FRONTEND_URL` is set in `wrangler.jsonc` to the current `workers.dev` app origin. Update that public URL if the production origin changes.

## Scheduled jobs

Cloudflare Cron invokes the backend's secret-protected internal endpoint:

- Every minute: due-task email reminders and in-app/push notifications.
- Hourly: inactive-account cleanup and expired trash cleanup.

The container's own maintenance intervals are disabled in production so they do not duplicate Cron executions. The API endpoint is mounted before browser-origin enforcement and requires `X-Internal-Job-Secret`; do not expose that secret to frontend code.

## Deploy and verify manually

This branch is not deployed automatically by these instructions. After configuring secrets and confirming the Workers Paid plan:

```sh
docker info
npm run deploy:cloudflare
npx wrangler containers list
```

Then verify `GET /api/health`, sign-in, task CRUD, attachment upload/download, email delivery, push delivery, and the Cron logs in the Cloudflare dashboard. A successful Worker deployment alone does not prove the container has finished provisioning.

## Operational notes

- The backend container is configured as one named `standard-1` instance (4 GiB memory) for the initial migration so Node/Express/Mongoose do not start on the 256 MiB `lite` size. Review Cloudflare pricing before deployment. Scale-out should follow after shared rate limiting and background-job ownership are explicitly designed; the current in-memory rate limiter is per process.
- MongoDB/GridFS is the source of truth. Container filesystem contents are ephemeral.
- Do not merge this branch or deploy production until CI passes and the required Cloudflare secrets/account prerequisites are confirmed.
