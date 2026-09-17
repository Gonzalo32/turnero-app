# Turnero App

Sistema de cola de espera en tiempo real para consultorios odontologicos.

## Descripcion

Esta aplicacion es el panel que ven los odontologos cuando un paciente se registra en el totem (odonto-app).
Al imprimir, el totem notifica a este servidor y la pantalla del odontologo se actualiza en tiempo real por WebSocket.

## Estructura

```
turnero-app/
├── server/           <- Backend Node.js (Express + WebSocket + MongoDB)
│   ├── models/
│   │   └── Turno.js  <- Modelo de turno
│   └── server.js     <- Servidor HTTP + WebSocket
├── src/              <- Frontend Angular
│   └── app/
│       └── features/
│           └── turnero/   <- Panel de cola de espera
└── package.json
```

## Setup

### 1. Configurar el servidor

```bash
cd server
cp .env.example .env
# Editar .env con tu MONGODB_URI real
npm install
```

### 2. Instalar dependencias del frontend

```bash
npm install
```

### 3. Desarrollo

Terminal 1 - Backend:
```bash
npm run server:dev
```

Terminal 2 - Frontend:
```bash
npm start        # corre en http://localhost:4300
```

Ir a: http://localhost:4300/turnero

### 4. Produccion

```bash
npm run build:prod
node server/server.js
```

## Puerto del servidor

Por defecto el servidor corre en el puerto **3001** (configurable en .env).
El odonto-app (totem) debe apuntar a este puerto para notificar turnos.

## API

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/turnos | Crear turno nuevo (llamado desde el totem) |
| GET | /api/turnos | Listar turnos en espera |
| PATCH | /api/turnos/:id/atendido | Marcar turno como atendido |
| DELETE | /api/turnos/:id | Eliminar turno |
| GET | /api/health | Estado del servidor y DB |

## WebSocket

El servidor emite los siguientes eventos:
- `turno:nuevo` - cuando llega un paciente nuevo
- `turno:atendido` - cuando el odontologo marca como atendido
- `turno:eliminado` - cuando se elimina un turno
