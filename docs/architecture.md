# Estructura del Proyecto — Senza Sistema Odontológico

## Organización de carpetas

```
turnero-app/
├── frontend/     ← FRONTEND  (Angular + TypeScript)
├── backend/      ← BACKEND   (Node.js + TypeScript + Socket.IO)
├── docs/         ← Documentación (architecture.md, running.txt)
├── AGENTS.md     ← Reglas arquitectónicas obligatorias
└── README.md
```

---

## Cómo iniciar

```bash
# Backend
cd backend && npm start

# Frontend
cd frontend && npm start
```

---

## FRONTEND — `frontend/`

### Estructura base

```
frontend/src/app/
│
├── core/                        # Servicios globales, singleton
│   ├── models/
│   │   └── api-response.model.ts  # Tipo ApiResponse<T> usado en toda la app
│   ├── services/
│   │   ├── session.service.ts     # Sesión del profesional activo
│   │   └── socket.service.ts      # Conexión Socket.IO centralizada
│   └── utils/
│       └── logger.ts              # Logger frontend
│
├── shared/                      # Componentes, pipes y directivas reutilizables
│   └── components/              # (crear cuando haya componentes compartidos)
│
├── features/                    # Cada pantalla/dominio tiene su carpeta
│   ├── auth/                    # Feature: Autenticación
│   │   ├── login/
│   │   │   ├── login.component.ts
│   │   │   ├── login.component.html
│   │   │   └── login.component.scss
│   │   └── auth.routes.ts       ← Rutas de la feature
│   │
│   ├── dashboard/               # Feature: Shell principal (sidebar + contenido)
│   │   ├── dashboard.component.ts
│   │   ├── dashboard.component.html
│   │   ├── dashboard.component.scss
│   │   └── dashboard.routes.ts  ← Rutas del dashboard (incluye rutas hijas)
│   │
│   └── queue/                   # Feature: Cola de pacientes
│       ├── components/          # Componentes visuales de esta feature
│       │   └── queue-list/
│       │       ├── queue-list.component.ts
│       │       ├── queue-list.component.html
│       │       └── queue-list.component.scss
│       ├── models/              # Interfaces y tipos de esta feature
│       │   └── queue.model.ts
│       ├── services/            # Servicios HTTP + lógica de esta feature
│       │   └── queue.service.ts
│       └── queue.routes.ts      ← Rutas de la feature
│
├── app.component.ts
├── app.config.ts
└── app.routes.ts                ← Solo delega a las features
```

### Regla de rutas del frontend

- `app.routes.ts` → **solo** delega a features con `loadChildren`
- Cada feature tiene su `[feature].routes.ts` con sus rutas internas
- Los componentes hijos del dashboard se registran en `dashboard.routes.ts`

### Patrón para agregar una nueva feature

```
features/
└── [nombre-feature]/
    ├── components/
    │   └── [nombre-componente]/
    │       ├── [nombre-componente].component.ts
    │       ├── [nombre-componente].component.html
    │       └── [nombre-componente].component.scss
    ├── models/
    │   └── [nombre-feature].model.ts      # interfaces, enums, tipos
    ├── services/
    │   └── [nombre-feature].service.ts    # llamadas HTTP + lógica
    └── [nombre-feature].routes.ts         # rutas de la feature
```

Luego registrarla en `dashboard.routes.ts` como hijo o en `app.routes.ts` si es una ruta raíz.

---

## BACKEND — `backend/`

### Estructura base

```
backend/src/
│
├── config/
│   └── env.ts                   # Variables de entorno tipadas y validadas
│
├── database/
│   └── connection.ts            # Conexión a MongoDB
│
├── integrations/                # Sistemas externos (siempre aislados)
│   └── totem/
│       ├── totem.service.ts     # Único punto de entrada del tótem
│       └── totem.types.ts       # Tipos del sistema legado
│
├── middlewares/
│   └── error.middleware.ts      # Manejo centralizado de errores HTTP
│
├── modules/                     # Cada dominio tiene su módulo
│   ├── queue/                   # Módulo: Cola de espera
│   │   ├── queue.controller.ts  # Lee request → llama service → responde HTTP
│   │   ├── queue.model.ts       # Schema Mongoose
│   │   ├── queue.routes.ts      # Define rutas /api/v1/queue
│   │   ├── queue.service.ts     # Toda la lógica de negocio
│   │   ├── queue.socket.ts      # Emisión de eventos Socket.IO
│   │   └── queue.types.ts       # Interfaces, enums, DTOs
│   │
│   └── professionals/
│       ├── professional.controller.ts
│       ├── professional.model.ts
│       ├── professional.routes.ts
│       ├── professional.service.ts
│       └── professional.types.ts  (agregar cuando sea necesario)
│
├── seeds/
│   └── seed.ts                  # Datos iniciales (profesionales, etc.)
│
├── utils/
│   └── logger.ts                # Logger sin datos sensibles
│
├── app.ts                       # Express + Socket.IO + registro de rutas
└── server.ts                    # Entry point: conecta DB → inicia HTTP
```

### Flujo obligatorio backend

```
Request HTTP
    ↓
routes.ts          → solo define el path y el método
    ↓
controller.ts      → lee params/body, llama service, formatea respuesta HTTP
    ↓
service.ts         → TODA la lógica de negocio aquí
    ↓
model.ts           → consulta a MongoDB
    ↓
Persistencia OK
    ↓
socket.ts          → emite evento Socket.IO DESPUÉS de persistir
```

### Patrón para agregar un nuevo módulo backend

```
modules/
└── [nombre-modulo]/
    ├── [nombre].controller.ts   # Fino, sin lógica de negocio
    ├── [nombre].model.ts        # Schema Mongoose + índices
    ├── [nombre].routes.ts       # /api/v1/[nombre]
    ├── [nombre].service.ts      # Lógica de negocio
    ├── [nombre].socket.ts       # Eventos Socket.IO (si aplica)
    └── [nombre].types.ts        # Interfaces, enums, DTOs
```

Luego registrar las rutas en `app.ts`:
```typescript
app.use('/api/v1/[nombre]', [nombre]Routes);
```

---

## Convenciones de nomenclatura

| Tipo | Convención | Ejemplo |
|---|---|---|
| Carpetas | kebab-case | `queue-list/`, `auth/` |
| Archivos TS | kebab-case + sufijo | `queue.service.ts` |
| Clases Angular | PascalCase | `QueueListComponent` |
| Interfaces | PascalCase con I o sin | `QueueEntry`, `IProfessional` |
| Enums | PascalCase | `QueueStatus` |
| Eventos Socket | `entidad:accion` | `queue:patient-added` |
| Endpoints API | `/api/v1/[recurso]` | `/api/v1/queue` |
| Variables TS | camelCase | `professionalId`, `joinedAt` |

---

## Formato de respuestas API

Todas las respuestas siguen este formato:

```json
// Éxito
{ "success": true,  "data": { ... }, "message": null }

// Error
{ "success": false, "data": null,    "message": "Descripción", "code": "ERROR_CODE" }
```
