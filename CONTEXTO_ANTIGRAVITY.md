# Contexto del proyecto - turnero-app
# Abrí este archivo con Antigravity para continuar desde donde quedamos

## Que es este proyecto

`turnero-app` es un proyecto separado que fue extraido de `odonto-app` el 16/09/2026.
Contiene el sistema de cola de espera en tiempo real para los odontologos del consultorio.

El proyecto hermano (`odonto-app`) es el totem donde se registran los pacientes.
Cuando un paciente termina de registrarse e imprime en el totem, este proyecto recibe la notificacion y la muestra en la pantalla del odontologo.

## Lo que ya esta hecho

### Backend (server/)
- `server/server.js` — Servidor Express + WebSocket (puerto 3001)
  - POST /api/turnos → crea un turno nuevo y hace broadcast por WS
  - GET /api/turnos → lista turnos en estado "esperando" (filtra por ?profesional=)
  - PATCH /api/turnos/:id/atendido → marca como atendido, broadcast WS
  - DELETE /api/turnos/:id → elimina turno, broadcast WS
  - GET /api/health → estado del servidor y DB
- `server/models/Turno.js` — Modelo mongoose (pacienteNombre, pacienteApellido, pacienteDni, obraSocial, profesional, estado)
- `server/package.json` — dependencias: express, mongoose, cors, ws, dotenv
- `server/.env` — MONGODB_URI=mongodb://localhost:27017/senza_totem, PORT=3001
- Dependencias instaladas (`server/node_modules/` existe)

### Frontend Angular (src/)
- `src/app/features/turnero/turnero.component.*` — Panel de cola de espera
  - Muestra la lista de turnos en tiempo real
  - Filtro por profesional
  - Boton "Atendido" por cada turno
  - Indicador de minutos de espera (urgente si >= 15 min)
  - Indicador de conexion WebSocket
- `src/app/core/models/turno.model.ts` — Interface Turno + tipos WsEventTurno
- `src/app/core/services/turno.service.ts` — Servicio con signals, HTTP y WebSocket con reconexion automatica
- `src/environments/environment.ts` — apiUrl: localhost:3001/api, wsUrl: ws://localhost:3001
- `src/app/app.routes.ts` — Solo la ruta /turnero (redirige '/' a '/turnero')
- Dependencias instaladas (`node_modules/` existe)

## Como levantar en desarrollo

Terminal 1 (backend):
  cd server
  npm run dev        <- arranca en puerto 3001

Terminal 2 (frontend):
  npm start          <- arranca en http://localhost:4300/turnero

## Pendiente / Proximos pasos

1. SUBIR A SERVIDOR
   - El servidor necesita estar desplegado para que los odontologos accedan desde cualquier dispositivo
   - Opciones: Railway, Render, VPS propio
   - El .env de produccion necesita la MONGODB_URI de Atlas (o la BD en el servidor)

2. CONECTAR ODONTO-APP CON ESTE SERVIDOR
   - En odonto-app, el step-review.component.ts tiene que llamar a POST http://[servidor]:3001/api/turnos cuando el paciente imprime
   - Actualmente odonto-app fue revertido al 3/ago y NO tiene esa llamada
   - Hay que agregar la notificacion al TurnoService o directamente con HttpClient

3. AUTENTICACION (opcional pero recomendable)
   - Actualmente cualquiera que acceda a /turnero puede ver y marcar turnos
   - Se podria agregar un login simple por profesional

4. PANTALLA DE DISPLAY (opcional)
   - Una pantalla grande en la sala de espera que muestre el numero de turno llamado
   - Podria ser otro componente Angular que escuche los mismos eventos WS

5. PERSISTENCIA DE TURNOS HISTORICOS
   - Actualmente los turnos "atendidos" quedan en la BD pero no se muestran
   - Se podria agregar una vista de historial del dia

## Estructura de archivos

```
turnero-app/
├── server/
│   ├── models/
│   │   └── Turno.js
│   ├── .env                  <- contiene MONGODB_URI real
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── node_modules/         <- instalado
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/turno.model.ts
│   │   │   └── services/turno.service.ts
│   │   ├── features/
│   │   │   └── turnero/
│   │   │       ├── turnero.component.html
│   │   │       ├── turnero.component.scss
│   │   │       └── turnero.component.ts
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── environments/
│   │   ├── environment.ts         <- dev: localhost:3001
│   │   └── environment.production.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── .gitignore
├── README.md
└── node_modules/              <- instalado
```

## Proyecto hermano

odonto-app esta en: C:\Users\gonza\OneDrive\Desktop\odonto-app
Fue revertido al commit 0a2da41 (3 de agosto 2026) con git revert.
El historial esta preservado.