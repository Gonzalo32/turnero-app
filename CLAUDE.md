# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first** — it holds the mandatory architecture rules (in Spanish). This file only adds what you need to be productive and where the code currently deviates from those rules.

## Commands

Requires MongoDB running locally on 27017 and Keycloak (`docker compose up -d` at the repo root, port 8080, realm imported from `keycloak/realm-senza.json`). Two independent apps, run each from its own folder:

```bash
# backend/  (port 3001 by default)
cp .env.example .env        # needs MONGODB_URI, TOTEM_API_KEY, KEYCLOAK_ADMIN_CLIENT_SECRET, or startup throws
npm install
npm run seed                # loads professionals + default sede into senza_sistema (once)
npm start                   # ts-node-dev with hot reload
npm run build               # tsc → dist/ ; also the only type-check available
npm run start:prod          # node dist/server.js

# frontend/  (Angular 18, http://localhost:4300)
npm install
npm start
npm run build:prod
```

There are no tests and no linter configured. Type-check with `npm run build` in each app.

Simulate a tótem arrival: `backend/simulate_totem.ps1` (POSTs to `/api/v1/integrations/totem/patient` with header `x-totem-api-key: $TOTEM_API_KEY`).

## Architecture

- **Databases:** `senza_sistema` (this system, read/write) and `senza_totem` (legacy tótem, `odonto-app` sibling project — never write to it).
- **Tótem integration is push-based:** the tótem calls `POST /api/v1/integrations/totem/patient` (shared-key auth with `timingSafeEqual` in `integrations/totem/totem.routes.ts`). `totem.service.ts` maps the free-text `profesional` name to a `Professional` by first/last-name regex, upserts the patient by DNI, and skips re-sends while the patient is already active for the same professional (idempotency).
- **Persist then emit:** controllers call the service, which saves to Mongo; only then do controllers/integration call the `emitPatient*` helpers in `modules/queue/queue.socket.ts`.
- **Socket rooms per professional:** clients emit `queue:join-professional <professionalId>`; the backend emits `queue:patient-*` events only to `professional:<id>`. Payloads go through `sanitizeEntry` (minimal fields + legacy aliases). On transfer between professionals, a `queue:patient-cancelled` is sent to the old professional's room.
- **Frontend:** `core/services/socket.service.ts` owns the single socket connection and re-joins the room on reconnect; `features/queue/services/queue.service.ts` subscribes to events, reloads via `GET /api/v1/queue?professionalId=` on connect, and also re-syncs every 15s as a fallback.
- **API envelope:** `{ success, data, message, code? }`; errors are thrown with `createError(msg, status, CODE)` and formatted by `middlewares/error.middleware.ts`.

## Current state vs. AGENTS.md (know before changing things)

- Field names mix Spanish (`profesionalId`, `nombre`, `obraSocial`) and English (`professionalId`, `patientFirstName`); socket payloads and services accept both. Preserve the aliases unless you migrate all consumers.
- **Auth is Keycloak (OIDC + PKCE):** the Angular app requires a Keycloak session at bootstrap (`app.config.ts`, `onLoad: 'login-required'`); `KeycloakBearerInterceptor` attaches the token to `environment.apiUrl` calls and `SocketService` sends it in the handshake. The backend verifies tokens with `jose` in `middlewares/auth.middleware.ts` (`verifyAccessToken`, shared by HTTP and Socket.IO) and loads the `User` (`modules/users`) by `sub`.
- **Roles are Keycloak realm roles** (`admin`, `odontologo`, `secretaria`); `User.role` is a copy for listing. Adding a role = create it in Keycloak + add to `ROLES` in `user.model.ts` and `Role`/`ROLE_LABELS` in `frontend/src/app/core/models/user.model.ts`.
- **Users ≠ professionals:** `users.professionalId` optionally links a user to a `Professional` (required for `odontologo`). A professional's sede is the sede of its linked user. Queue scope (`canAccessProfessional`): admin → all, odontólogo → own, secretaria → professionals of their sede.
- Admin creates users via `/api/v1/users`, which calls the Keycloak Admin REST API (`integrations/keycloak/keycloak-admin.service.ts`, service account of client `turnero-backend`) and rolls back the Keycloak user if the Mongo save fails. The first `admin` is auto-provisioned on first login.
- After Keycloak login, `/login` is a workspace picker (consultorio from the user's sede; secretaria/admin also pick the professional whose queue they work). Selection lives in `localStorage` via `SessionService`.
- `anyComponentStyle` budget in `angular.json` is 4kB warning / 8kB error; several component styles exceed the warning.
