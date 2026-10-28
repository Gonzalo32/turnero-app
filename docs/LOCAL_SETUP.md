#### CAMBIAR ".env copy" a ".env"


# Ejecutar Tótem + Turnero en local (`master`)



Levantar los dos sistemas en una misma máquina, registrar un paciente en el tótem y verlo aparecer en el turnero.

| Proyecto | Rama | Partes |
|---|---|---|
| `odonto-app` (tótem) | `master` | `server/` (API + app Angular compilada) |
| `turnero-app` | `master` | `backend/` (API + Socket.IO), `frontend/` (Angular) |

## Cómo se conectan

Cuando un paciente se registra en el tótem, el servidor del tótem lo guarda en `senza_totem` y envía un `POST` al turnero:

```
POST http://localhost:3001/api/v1/integrations/totem/patient
x-totem-api-key: <TOTEM_API_KEY>
```

El turnero agrega al paciente a la cola en `senza_sistema` y lo envía por Socket.IO, así que aparece al instante. Si el turnero está caído, el tótem guarda el aviso (colección `turnerooutboxes`) y lo reintenta.

## Puertos

| Puerto | Servicio |
|---|---|
| 27017 | MongoDB (Docker) |
| 3000 | Servidor del tótem (formulario + API) |
| 3001 | Backend del turnero |
| 4300 | Frontend del turnero |

## 1. MongoDB (Docker)

Las dos apps comparten el contenedor `senza-totem-mongo` (`mongo:7`, sin autenticación). Contiene las dos bases: `senza_totem` y `senza_sistema`.

### Primera vez: crear el contenedor

1. Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/) y abrirlo.
2. Crear el contenedor. Docker descarga la imagen oficial `mongo:7` de Docker Hub si no está en la máquina:

```bash
docker run -d --name senza-totem-mongo --restart unless-stopped -p 27017:27017 -v senza_totem_data:/data/db mongo:7
```

| Parte | Qué hace |
|---|---|
| `mongo:7` | Imagen oficial de MongoDB 7. |
| `--name senza-totem-mongo` | El nombre que usa el resto de esta guía. |
| `-p 27017:27017` | Expone Mongo en `localhost:27017`, el puerto que usan los `.env`. |
| `-v senza_totem_data:/data/db` | Guarda los datos en un volumen con nombre, así no se pierden si se borra el contenedor. |
| `--restart unless-stopped` | Arranca solo cuando arranca Docker. |

Las bases `senza_totem` y `senza_sistema` no hay que crearlas: MongoDB las crea cuando las apps escriben por primera vez.

### Uso diario

```bash
docker start senza-totem-mongo
```

```bash
docker ps --filter name=senza-totem-mongo
```

> Los datos viven en el volumen `senza_totem_data`. `docker stop`, `docker start` y hasta `docker rm` del contenedor son seguros. Solo se pierden con `docker volume rm senza_totem_data`.

## 2. Clave compartida (solo la primera vez)

Generar una clave:

```bash
openssl rand -hex 32
```

Poner **el mismo valor** en los dos `.env` de abajo. Nunca subirla al repositorio ni ponerla en un frontend.

## 3. Configurar el turnero (solo la primera vez)

`turnero-app/backend/.env`:

```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/senza_sistema
CORS_ORIGIN=http://localhost:4300
TOTEM_API_KEY=<clave generada>
```

El backend no arranca sin `MONGODB_URI` y `TOTEM_API_KEY`.

Instalar el backend y cargar los profesionales:

```bash
cd turnero-app/backend && npm install && npm run seed
```

Instalar el frontend:

```bash
cd turnero-app/frontend && npm install
```

El frontend no usa `.env`. Lee `src/environments/environment.ts`, que ya apunta a `http://localhost:3001`.

## 4. Configurar el tótem (solo la primera vez)

`odonto-app/.env`:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/senza_totem
CENTRAL_SERVER_URL=http://localhost:3001
TOTEM_API_KEY=<la misma clave generada>
```

El servidor se cierra al arrancar si falta `CENTRAL_SERVER_URL` o `TOTEM_API_KEY`.

Instalar las dos partes:

```bash
cd odonto-app && npm install && cd server && npm install
```

Compilar la app Angular. El servidor del tótem sirve la compilación en el puerto 3000:

```bash
cd odonto-app && npm run build
```

> No usar `npm start` (`ng serve` en :5000) para esta prueba. El servidor del tótem no tiene CORS, así que el formulario en :5000 no puede guardar pacientes.

## 5. Ejecutar (3 terminales)

```bash
cd turnero-app/backend && npm start
```

```bash
cd turnero-app/frontend && npm start
```

```bash
cd odonto-app/server && npm start
```

El tótem debe mostrar `Server running on http://127.0.0.1:3000 → turnero http://localhost:3001`.

## 6. Probar

1. Abrir http://localhost:4300 e ingresar como un profesional (por ejemplo **Kevin Anzoategui**) con un consultorio.
2. Abrir **http://localhost:3000** y registrar un paciente con **ese mismo profesional**.
3. La terminal del tótem muestra `[Turnero] ✓ Paciente notificado (DNI …)`.
4. El paciente aparece al instante en la cola de ese profesional, en el dashboard del turnero.

Cada profesional ve solo su propia cola. El turnero no tiene una pantalla de pacientes aparte.

## Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| No llega nada al turnero y el tótem no muestra logs | El servidor del tótem no está corriendo. Verificar que haya algo escuchando en :3000. |
| El formulario en :5000 no guarda | Usar http://localhost:3000 después de `npm run build`. |
| `Clave rechazada … revisar TOTEM_API_KEY` | Las claves de los dos `.env` no coinciden. Corregir y reiniciar. El tótem reintenta los avisos pendientes. |
| `422 PROFESSIONAL_NOT_FOUND` | El nombre del profesional en el tótem no coincide con el seed ("Nombre Apellido"). Ejecutar `npm run seed`. |
| El backend del turnero se cierra al arrancar | Falta `MONGODB_URI` o `TOTEM_API_KEY` en `backend/.env`. |
| El paciente se guardó pero no aparece en la lista | Se ingresó al turnero con otro profesional. |

Ver qué puertos están escuchando:

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|3001|4300) '
```

Revisar los datos:

```bash
docker exec -it senza-totem-mongo mongosh senza_sistema
```

Después ejecutar `db.queueentries.find().sort({_id:-1}).limit(5)` para ver la cola, o `use senza_totem` y `db.turnerooutboxes.find()` para ver los avisos pendientes.
