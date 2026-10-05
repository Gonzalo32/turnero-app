# Manual testing guide — tótem + turnero

How to run both projects locally and check the full flow:
patient registers at the tótem → appears on the dentist's screen in real time.

## 1. What runs where

| App | Folder | Port | Open |
|---|---|---|---|
| MongoDB | — | 27017 | — |
| Turnero backend | `turnero-app/backend` | 4000 | http://localhost:4000/api/v1/health |
| Turnero frontend (dentists) | `turnero-app/frontend` | 4300 | http://localhost:4300 |
| Tótem server | `odonto-app/server` | 3000 | — |
| Tótem kiosk | `odonto-app` | 5050 | http://localhost:5050 |

> The turnero frontend calls the API on port **4000** (`frontend/src/environments/environment.ts`),
> so the backend must run with `PORT=4000`. The kiosk runs on 5050 because macOS AirPlay uses 5000.

Both servers must share the same `TOTEM_API_KEY`. Any string works locally.

## 2. Start everything (5 terminals)

MongoDB must be running on `localhost:27017` first.

```bash
# Terminal 1 — turnero backend (first time also: npm install && MONGODB_URI=mongodb://localhost:27017/senza_sistema npm run seed)
cd turnero-app/backend
PORT=4000 MONGODB_URI=mongodb://localhost:27017/senza_sistema TOTEM_API_KEY=dev-local-key npm start

# Terminal 2 — turnero frontend
cd turnero-app/frontend
npm start

# Terminal 3 — tótem server
cd odonto-app/server
PORT=3000 MONGODB_URI=mongodb://localhost:27017/senza_totem CENTRAL_SERVER_URL=http://localhost:4000 TOTEM_API_KEY=dev-local-key node server.js

# Terminal 4 — tótem kiosk
cd odonto-app
npx ng serve --port 5050
```

Health check: http://localhost:4000/api/v1/health should show `"db":"connected"`.

## 3. Test cases

Log in first: open http://localhost:4300, pick **Beatriz Baleiron** + any consultorio → **Ingresar**.
The header should show **En vivo** (green).

| # | Do this | Expect |
|---|---|---|
| 1 | In the kiosk (http://localhost:5050) fill the form choosing **Beatriz Baleiron** and finish (cancel the print dialog if it opens) | Within a second the patient appears on Beatriz's screen, **no refresh**, with a sound |
| 2 | Register the **same DNI** again with Beatriz | Nothing new appears (no duplicate) |
| 3 | In a second browser window log in as **Kevin Anzoategui**. Register the same DNI choosing Kevin | Patient disappears from Beatriz and appears on Kevin with **Visita #2** |
| 4 | Click **Atendido** on a patient | Patient leaves the list; reload the page — still gone |
| 5 | Click **✕** (cancel) on a patient | Patient leaves the list |
| 6 | Stop the turnero backend (Ctrl+C in terminal 1), register a patient in the kiosk | Kiosk still works; terminal 3 logs `No se pudo notificar al turnero` |
| 7 | Restart the backend | Header goes back to **En vivo**; queue reloads from the database |
| 8 | Run `curl -X POST localhost:4000/api/v1/integrations/totem/patient -H 'Content-Type: application/json' -d '{}'` | `401 No autorizado` (key required) |

Without the kiosk, you can simulate a tótem registration with:

```bash
curl -X POST localhost:3000/api/patients -H 'Content-Type: application/json' \
  -d '{"dni":"30111222","nombre":"Carlos","apellido":"Prueba","obraSocial":"OSDE","profesional":"Beatriz Baleiron"}'
```

## 4. Testing the migration (old data → queueentries)

Only needed against a copy of real data. **Back up `senza_sistema` first.**

```bash
cd turnero-app/backend
MONGODB_URI=mongodb://localhost:27017/senza_sistema npm run migrate:queue            # dry run, prints counts
MONGODB_URI=mongodb://localhost:27017/senza_sistema npm run migrate:queue -- --apply # writes
```

Expect: running `--apply` twice → the second run reports `0 nuevas`. Only today's active
patients show up on the dentists' screens; older ones are migrated as cancelled.

## 5. Known gotchas

- **`Cannot find module 'tailwindcss'` when starting Angular:** a `postcss.config.js` in a parent folder
  (e.g. `~/Documents`) is being picked up. Remove it, or create `.angular/.postcssrc.json` containing
  `{ "plugins": {} }` inside the Angular project.
- **`npm ci` fails in `odonto-app`:** its `package-lock.json` is out of sync; use `npm install`.
- `localhost:3000/` shows an error page — normal, the tótem server only serves the kiosk build in production.
