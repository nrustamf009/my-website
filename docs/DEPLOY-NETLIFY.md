# Deploy to Netlify

The app runs on Netlify as-is: Netlify detects Next.js, `netlify.toml` sets the build, and four
scheduled functions in `netlify/functions/` call the same `/api/cron/*` routes Vercel Cron would.

## 1. Database (free)
Create a Postgres database at neon.tech and copy its connection string (`postgresql://…?sslmode=require`).
The build switches Prisma to Postgres and creates the tables automatically.

## 2. Netlify site
Netlify → Add new site → Import an existing project → GitHub → `nrustamf009/my-website`,
branch `ccr-6019c963-k8fn89` (or `main` after merging). Build settings come from `netlify.toml`.

## 3. Environment variables
Site configuration → Environment variables, before the first deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string |
| `AUTH_SECRET` | any random 32+ characters (`openssl rand -base64 32`) |
| `CRON_SECRET` | another random string |
| `DEMO_LOGIN` | `true` for a hosted demo (one-click demo accounts on `/login`) |
| `SEED_IF_EMPTY` | `true` to load the demo brokers on the first deploy. It only seeds an empty database and never wipes data. |
| `APP_URL` | optional; defaults to the Netlify site URL. Set it when you add a custom domain. |

Optional keys (`RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `RENTCAST_API_KEY`, Turnstile) are the same as in the README.
Without them every integration uses its mock.

## 4. Deploy
Trigger the deploy. Open `https://<site>.netlify.app/login` and pick a demo account.
Without `RESEND_API_KEY` emails are not sent; with `DEMO_LOGIN=true` you do not need them to sign in.
