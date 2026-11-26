# Newly Enhanced Cocolytics

Clean full-stack setup with:

- Node.js backend API (Express)
- Vue 3 frontend (Vite)
- PWA support for installable frontend

## Folder Structure

- `backend/src/controllers/`, `routes/`, `middlewares/`, and `realtime/` — API and transport
- `backend/src/models/` and `services/` — database access and application services
- `backend/src/utils/` — backend helpers
- `database/migrations/` — ordered MySQL schema and data migrations
- `frontend/src/components/`, `pages/`, and `services/` — Vue UI and API clients
- `frontend/src/assets/` and `frontend/public/` — bundled and static assets
- `frontend/android/` — Capacitor Android project
- `Dockerfile` and root config files — deployment and repository configuration

## Quick Start

1. Install backend dependencies:

```bash
npm --prefix backend install
```

2. Install frontend dependencies:

```bash
npm --prefix frontend install
```

3. Start backend:

```bash
npm --prefix backend run dev
```

4. Start frontend:

```bash
npm --prefix frontend run dev
```

Backend runs at `http://localhost:4000`.
Frontend runs at `http://localhost:7904`.

## PWA Installability

The Vue app is configured with `vite-plugin-pwa` and includes:

- Web app manifest
- Service worker registration
- App icons
- `display: standalone` for installable behavior

To verify installability, run the frontend and open it in Chrome/Edge. You should see an install option.

## Signup by Email or Phone

New accounts can register with either an email address or an international-format phone number. Email verification uses SMTP; phone verification sends a six-digit OTP by SMS through Twilio. Phone numbers must be entered in E.164 format, such as `+639171234567`.

To enable email verification and password-reset OTP delivery, set `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM_EMAIL` in `backend/.env`. For Gmail, use a Google App Password (with 2-Step Verification enabled), not the mailbox's regular password. Keep these credentials out of the frontend, source control, and chat; restart the backend and confirm its startup log says Gmail SMTP is ready.

Password-reset OTPs are sent only to the email address registered to the account being reset. Do not forward reset codes to a shared administrator mailbox, because anyone with access to that mailbox could take over users' accounts.

To enable SMS, add these values to `backend/.env` and restart the backend:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- Either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`

Create a Twilio account and sender/messaging service first. Twilio trial accounts may only send to phone numbers verified with Twilio. Do not put these credentials in the frontend or APK.

## Dokploy Production Setup

1. In Dokploy, create a MySQL service and deploy this repository as an application using the root `docker-compose.yml`. The Compose file builds the app from the root `Dockerfile`; it does not create a database container, so the app connects to your separate MySQL service.
2. Set the application environment variables. Use `NODE_ENV=production`, `PORT=5000`, `DB_HOST` set to the MySQL service's internal hostname, `DB_PORT=3306`, `DB_NAME=new_cocolytics`, `DB_USER=cocolytics_user`, and `DB_PASSWORD` set to the actual MySQL password configured for that service. `mysql` is valid for `DB_HOST` only if that is the internal hostname Dokploy assigns.
3. Set `JWT_SECRET` to a new random value. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"` and paste the output into Dokploy's secret environment variable field. Do not commit the generated value or reuse the placeholder. Also set `CLIENT_ORIGIN` to the app's HTTPS domain.
4. Keep the Compose named volume mounted at `/data`; it stores user uploads under `/data/uploads` across deployments.
5. Configure the app's internal/domain target port as `5000` and its pre-deploy command as `node backend/src/migrate.js`. Ensure the MySQL service is running and reachable before the migration command runs.
6. After deployment, open `/api/health` on the HTTPS domain and confirm it returns a healthy response. Keep the database private and configure backups before moving live data.

## Railway Production Setup

The backend is the only service that connects to MySQL. Keep the database private and attach it to the API service using Railway's MySQL service variables (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`), or its `MYSQL_URL`. Production refuses to use local MySQL defaults.

1. In Railway, create a project, add a MySQL service, and deploy this repository as a Docker service from its root directory.
2. On the application service, add `MYSQL_URL=${{MySQL.MYSQL_URL}}` (or reference all five `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables). Set `CLIENT_ORIGIN` to the app's HTTPS domain, `JWT_SECRET` to a new random value of at least 32 characters, and `DB_CONNECTION_LIMIT` to a value within the database plan's connection limit. Keep MySQL private.
3. Attach a Railway volume mounted at `/data`. The container requires this volume and stores user-uploaded images and documents in `/data/uploads`.
4. Configure the service's pre-deploy command as `node backend/src/migrate.js`. Production startup checks the database but does not create databases or run migrations automatically.
5. Enable Railway database backups before moving live data. Take a fresh export of the current local MySQL database, import it into the new Railway database, and verify table/row counts before directing users to the new site. Schema migrations do not transfer existing records. For the one-time transfer, use Railway's public TCP proxy only as needed, then disable public database networking; the deployed app should use the private MySQL variables.
6. Open `/api/health` on the generated HTTPS domain. Build the Android app only after setting `VITE_API_BASE_URL` in `frontend/.env.production` to that HTTPS API origin; web requests use the same domain automatically. The Docker build excludes local APKs; add the newly built release APK to the hosted downloads location only after it points at the deployed API.

The current chat/presence stream keeps connection state in process memory. Start with one API replica; move that state to shared Redis/pub-sub before enabling multiple replicas. Increase the Railway database/app plan and connection pool deliberately as real traffic and database limits are measured.

## Useful Commands

```bash
npm --prefix backend run start
npm --prefix frontend run build
npm --prefix frontend run preview
```
