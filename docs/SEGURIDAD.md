# Seguridad: turnero-app y odonto-app (KAN-7)

Resultado de la auditoría de los dos sistemas, qué se corrigió en la rama `feature/KAN-7-seguridad`
de cada repositorio, y qué queda por hacer a mano (variables de entorno y rotación de claves).

## 1. Pendientes manuales (no se pueden resolver desde el código)

Hacer en este orden. Hasta completar los pasos 1 a 4 las claves viejas siguen siendo válidas.

- [ ] **Rotar `TOTEM_API_KEY`.** La clave actual estuvo subida a GitHub en los dos repositorios.
      Generar una nueva (`openssl rand -hex 32`) y ponerla **idéntica** en el `.env` del servidor
      del turnero y en el `.env` de la PC del tótem. Reiniciar ambos.
- [ ] **Rotar `JWT_SECRET`** en el servidor del turnero (`openssl rand -hex 32`). Ahora es
      obligatoria: el backend no arranca sin ella. Al cambiarla, todos deben volver a iniciar sesión.
- [ ] **Revocar el secreto del cliente admin de Keycloak** (`KEYCLOAK_ADMIN_CLIENT_SECRET`), o borrar
      ese cliente. Estuvo subido en `backend/.env` y el código no lo usa.
- [ ] **Cambiar las contraseñas reales.** El admin tenía `1234` y los profesionales `12345678`
      (estaban en el seed). Cambiarlas desde la pantalla de Odontólogos (mínimo 8 caracteres).
- [ ] **Reemplazar `backend/.env.example` (turnero) y `.env.example` (odonto)** por las plantillas
      de la sección 5. El de turnero todavía tiene valores con forma de clave real. No se pudo hacer
      automáticamente porque la edición de archivos `.env*` está bloqueada en el entorno de trabajo.
- [ ] **Limpiar el `.env` real del turnero:** borrar `TOTEM_MONGODB_URI`, `TOTEM_API_URL` y las
      cuatro `KEYCLOAK_*` (ya no se leen). Agregar `JWT_EXPIRES_IN` si se quiere otro valor que `12h`.
- [ ] **Tótem: `CENTRAL_SERVER_URL` debe ser `https://`** en producción. El servidor ahora avisa al
      arrancar si no lo es.
- [ ] **Tótem: borrar `server/.env`.** No se lee (el servidor carga el `.env` de la raíz) y contiene
      una copia de la clave.
- [ ] `CORS_ORIGIN` del turnero en producción: el dominio real con `https://`.

Los `.env` reales dejaron de estar versionados (`git rm --cached`), pero **siguen en el historial
de git**. Por eso la rotación es obligatoria; no se reescribió el historial.

## 2. Qué se encontró y qué se hizo

### turnero-app

| Endpoint | Antes | Ahora |
|---|---|---|
| `POST /api/v1/auth/login` | Sin límite de intentos; no emitía token | Devuelve JWT (HS256, vence en `JWT_EXPIRES_IN`); 20 intentos fallidos / 15 min por IP |
| `GET /api/v1/queue` | Abierto (DNI y nombre de todos los pacientes) | Requiere sesión. Con `professionalId`: solo la cola propia (o admin). Sin filtro (pantalla TV): sin DNI ni obra social |
| `POST /api/v1/queue` | Abierto | Solo `ADMIN` |
| `PATCH /api/v1/queue/:id/{call,start,complete,cancel}` | Abierto | Requiere sesión; solo el profesional dueño de la entrada o un admin |
| `GET /api/v1/professionals` | Abierto (DNI, correo, teléfono, domicilio) | Requiere sesión; datos personales solo para admin |
| `GET /api/v1/professionals/:id` | Abierto | Solo `ADMIN` |
| `POST / PUT / DELETE /api/v1/professionals` | Abierto (cualquiera podía crear cuentas o cambiar la contraseña del admin) | Solo `ADMIN` |
| `/api/v1/integrations/totem/*` | Clave compartida | Sin cambios |
| `GET /api/v1/health` | Mostraba estado de la base y cantidad de sockets | Solo `ok` / `degraded` |
| Socket.IO | Cualquiera se conectaba y recibía DNI y nombre de todos los pacientes | JWT obligatorio en el handshake; cada profesional solo entra a su sala; la sala TV no recibe DNI ni obra social |

Además:

- Rol `ADMIN` / `PROFESSIONAL` en el modelo de profesional (`UserRole`). El usuario `admin`
  existente recibe el rol `ADMIN` automáticamente al arrancar el backend.
- `helmet`, límite general de 600 requests/min por IP, `trust proxy` para Caddy.
- Los errores inesperados responden un 500 genérico (antes devolvían el mensaje interno de Mongo).
- El seed ya no tiene contraseñas en el código ni pisa las de usuarios existentes.
- Los logs ya no incluyen nombres ni correos.
- Frontend: el token se envía en cada request y en el socket; un 401 cierra la sesión; la pantalla
  de Odontólogos solo aparece para el admin.

### odonto-app (tótem)

| Endpoint | Antes | Ahora |
|---|---|---|
| `GET /api/patients/dni/:dni` | Sin autenticación, CORS `*`, accesible desde toda la red | Solo `127.0.0.1`; sin CORS; DNI validado (7 u 8 dígitos) |
| `POST /api/patients` | Ídem; permitía pisar cualquier paciente desde la red | Solo `127.0.0.1`; exige DNI, nombre y apellido válidos |
| `POST /api/professionals/sync` y `/bulk-sync` | Con clave compartida | **Eliminados** (ver sección 4) |
| `GET /api/professionals`, `/events`, `/health` | Accesibles desde la red | Solo `127.0.0.1` |

Además: los avisos pendientes al turnero (`TurneroOutbox`) vencen a los 7 días; los logs ya no
incluyen DNI; un JSON mal formado ya no devuelve el stack trace.

## 3. Variables de entorno

### turnero-app (`backend/.env`)

| Variable | Obligatoria | Para qué | Acción |
|---|---|---|---|
| `MONGODB_URI` | Sí | Base propia del turnero | Sin cambios. Con usuario y contraseña si Mongo sale de la red interna de Docker |
| `TOTEM_API_KEY` | Sí | Clave compartida con el tótem | **Rotar** (igual en ambos lados) |
| `JWT_SECRET` | Sí (nueva obligatoria) | Firma de las sesiones | **Rotar**. Ya no existe valor por defecto |
| `JWT_EXPIRES_IN` | No (`12h`) | Duración de la sesión | Nueva |
| `CORS_ORIGIN` | No (`http://localhost:4300`) | Origen permitido del frontend | En producción, el dominio real con https |
| `PORT`, `NODE_ENV` | No | Puerto y entorno | Sin cambios |
| `SEED_ADMIN_PASSWORD`, `SEED_DEFAULT_PASSWORD` | Solo para el seed | Contraseñas iniciales al crear usuarios | Nuevas. No dejarlas en el `.env` del servidor |
| `PUBLIC_DIR` | Solo Docker | Build de Angular servido por Express | Sin cambios (la define el Dockerfile) |
| `DOMAIN` | Solo producción | Dominio para el HTTPS de Caddy | Sin cambios. Caddy ya no recibe el resto del `.env` |
| `TOTEM_API_URL` | — | Push del turnero al tótem | **Eliminar** (el push ya no existe) |
| `TOTEM_MONGODB_URI` | — | Nunca se usó | **Eliminar** |
| `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` | — | No las lee el código | **Eliminar** y revocar el secreto |

### odonto-app (`.env` en la raíz)

| Variable | Obligatoria | Para qué | Acción |
|---|---|---|---|
| `CENTRAL_SERVER_URL` | Sí | URL del turnero | Debe ser `https://` en producción |
| `TOTEM_API_KEY` | Sí | Clave compartida con el turnero | **Rotar**. Faltaba en `.env.example` |
| `MONGODB_URI` | No (`mongodb://localhost:27017/senza_totem`) | Base local del tótem | Sin cambios |
| `PORT` | No (`3000`) | Puerto local | Sin cambios |
| `DEV_CORS_ORIGIN` | No | Permite `ng serve` (puerto 5000) en desarrollo | Nueva. No definir en el tótem real |

## 4. Conexión turnero ↔ odonto

```text
   TÓTEM (odonto-app, PC del consultorio)              TURNERO (servidor)
   escucha solo en 127.0.0.1:3000                      https://dominio

   1. Paciente termina el formulario
      POST /api/v1/integrations/totem/patient  ─────────────►  crea/actualiza paciente
                                                               y lo agrega a la cola
   2. Al arrancar, cada 24 h y ante cada aviso
      GET  /api/v1/integrations/totem/professionals ────────►  lista de profesionales activos

   3. Conexión permanente (SSE)
      GET  /api/v1/integrations/totem/professionals/stream ─►  evento "professionals-updated"
                                                    ◄─ ─ ─ ─   (sin datos; dispara el paso 2)
```

- **El tótem inicia siempre la conexión.** El turnero nunca llama al tótem, así que el tótem no
  necesita puerto abierto ni IP pública y puede estar detrás de NAT.
- **Autenticación:** header `x-totem-api-key` con la clave compartida, comparada en tiempo
  constante en el turnero. Las tres rutas la exigen.
- **Transporte:** HTTPS (Caddy en el turnero). Por este canal viajan DNI, nombre, apellido, obra
  social y profesional elegido.
- **Sin base compartida.** Cada sistema tiene su MongoDB; el turnero no se conecta a la del tótem
  (AGENTS.md §7). `TOTEM_MONGODB_URI` nunca se usó y se eliminó.
- **Si el turnero no responde,** el tótem guarda el aviso en su `TurneroOutbox` y reintenta cada
  60 s. Los avisos vencen a los 7 días.
- **Cambio respecto de antes:** se eliminó el push turnero → tótem (`/api/professionals/sync` y
  `/bulk-sync`, y la tarea diaria del turnero). En producción ya estaba apagado
  (`TOTEM_API_URL` vacío) y obligaba a exponer el tótem a la red.

### Limitaciones conocidas

- Una sola clave compartida para todo el canal. Si se filtra, quien la tenga puede inyectar
  pacientes en la cola y leer la lista de profesionales. Rotarla es cambiarla en los dos `.env`
  y reiniciar ambos servicios.
- El turnero importa en cada `GET /queue` las filas de la colección legada `queueentries` de su
  propia base. Ahora se validan, pero cualquiera con acceso a esa base puede insertar entradas.
- Un usuario desactivado conserva acceso hasta que vence su token (máximo `JWT_EXPIRES_IN`).
- El token se guarda en `localStorage` del navegador.
- En el tótem, quien escriba un DNI en la pantalla ve los datos de esa persona. Es el
  comportamiento del formulario, no un acceso por red.

## 5. Plantillas de `.env.example`

`turnero-app/backend/.env.example`:

```dotenv
# Copiar a backend/.env y completar. NUNCA subir el .env real al repositorio.
# Generar cada secreto con:  openssl rand -hex 32

PORT=3001
NODE_ENV=development

# Origen exacto del frontend. En producción, el dominio real con https (sin barra final).
CORS_ORIGIN=http://localhost:4300

# Base de datos propia del turnero.
MONGODB_URI=mongodb://localhost:27017/senza_sistema

# Sesiones (obligatoria: el servidor no arranca sin ella).
JWT_SECRET=CAMBIAR_generar_con_openssl_rand_hex_32
JWT_EXPIRES_IN=12h

# Clave compartida con el tótem: IDÉNTICA al TOTEM_API_KEY del .env del tótem.
TOTEM_API_KEY=CAMBIAR_generar_con_openssl_rand_hex_32

# Solo para `npm run seed`: contraseñas iniciales (mínimo 8 caracteres).
# Solo se usan al CREAR usuarios; el seed no pisa contraseñas existentes.
SEED_ADMIN_PASSWORD=
SEED_DEFAULT_PASSWORD=

# Solo producción / Docker:
# DOMAIN=turnero.ejemplo.com
```

`odonto-app/.env.example`:

```dotenv
# Copiar a .env (raíz del proyecto) y completar. NUNCA subir el .env real al repositorio.

# Puerto local del tótem. El servidor solo escucha en 127.0.0.1.
PORT=3000

# Base de datos propia y local del tótem.
MONGODB_URI=mongodb://localhost:27017/senza_totem

# URL del turnero central. En producción DEBE ser https://
CENTRAL_SERVER_URL=http://localhost:3001

# Clave compartida con el turnero: IDÉNTICA al TOTEM_API_KEY del turnero.
# Generar con:  openssl rand -hex 32
TOTEM_API_KEY=CAMBIAR_generar_con_openssl_rand_hex_32

# Solo desarrollo con `ng serve` (puerto 5000). En el tótem real dejar sin definir.
# DEV_CORS_ORIGIN=http://localhost:5000
```

## 6. Verificación

- `cd backend && npm test`: comprueba que sin token, con token adulterado, vencido o de otro rol,
  la API responde 401 / 403.
- Queda fuera de ese test, por necesitar MongoDB: el login completo y el recorrido en el navegador.
