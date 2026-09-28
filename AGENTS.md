# AGENTS.md — Arquitectura y reglas del sistema odontológico

## 1. Propósito

Este documento define las reglas arquitectónicas obligatorias para todo el proyecto.

El sistema será una aplicación web para gestión odontológica. La primera versión tendrá:

- autenticación/login;
- turnero/lista de espera;
- comunicación en tiempo real con los profesionales.

El sistema crecerá progresivamente para incorporar:

- pacientes;
- odontólogos/profesionales;
- consultorios;
- agenda;
- turnos;
- historial;
- notificaciones;
- administración;
- reportes;
- auditoría;
- otras funcionalidades de gestión.

La arquitectura debe permitir agregar funcionalidades sin reorganizar completamente el proyecto.

---

# 2. Principios obligatorios

Priorizar siempre:

1. Separación de responsabilidades.
2. Modularidad.
3. Mantenibilidad.
4. Seguridad.
5. Escalabilidad.
6. Reutilización.
7. Integridad de datos.
8. Comunicación en tiempo real.
9. Persistencia y trazabilidad.
10. Simplicidad razonable.

No implementar una solución rápida si rompe la arquitectura existente.

No sobreingenierizar. La arquitectura debe ser robusta pero simple.

---

# 3. Stack tecnológico

## Frontend

- Angular
- TypeScript
- Angular Router
- HttpClient
- Socket.IO Client para tiempo real

## Backend

- Node.js
- Express
- TypeScript
- Mongoose
- Socket.IO
- dotenv

## Base de datos

- MongoDB

---

# 4. Separación general

El proyecto debe separar claramente frontend y backend:

```text
project/
├── frontend/
└── backend/
```

Aunque estén dentro del mismo repositorio, son aplicaciones independientes.

El frontend nunca debe conectarse directamente a MongoDB.

La comunicación normal será:

```text
Angular → API Backend → MongoDB
```

La comunicación en tiempo real será:

```text
Backend → Socket.IO → Angular
```

---

# 5. Arquitectura general con el tótem

Actualmente existe un tótem que registra pacientes y utiliza MongoDB local.

El nuevo sistema no debe asumir que la base del tótem es su propia base de datos.

Arquitectura conceptual:

```text
                    TÓTEM
                      │
                      ▼
             MongoDB DEL TÓTEM
                      │
                Integración
                      │
                      ▼
             Backend nuevo sistema
                      │
             ┌────────┴────────┐
             ▼                 ▼
       MongoDB SISTEMA      Socket.IO
             │                 │
             │                 ▼
             │            Profesionales
             ▼
       Angular / API
```

La separación física definitiva de servidores o bases puede cambiar posteriormente. La separación lógica de responsabilidades debe existir desde el inicio.

---

# 6. Base de datos del tótem

El tótem actualmente utiliza:

- Node.js
- Express
- Mongoose
- MongoDB
- variable de entorno `MONGODB_URI`
- fallback actual:

```text
mongodb://localhost:27017/senza_totem
```

Los modelos actuales utilizan Mongoose y se encuentran actualmente en la aplicación del tótem.

El nuevo sistema debe tratar esta base como un sistema externo/legado.

---

# 7. Regla crítica: no modificar directamente la base del tótem

El nuevo sistema NO debe modificar arbitrariamente las colecciones originales del tótem.

No:

- modificar pacientes del tótem directamente;
- eliminar pacientes del tótem;
- cambiar formularios existentes;
- alterar esquemas existentes;
- agregar campos arbitrariamente a documentos del tótem;
- depender innecesariamente de detalles internos de la implementación del tótem.

El tótem debe considerarse inicialmente como una fuente externa de información.

---

# 8. Base de datos del nuevo sistema

El nuevo sistema debe disponer de una base MongoDB propia.

El nuevo sistema será responsable de sus propios datos operativos:

- pacientes utilizados por el sistema;
- profesionales;
- consultorios;
- cola de espera;
- turnos;
- agenda;
- usuarios;
- permisos;
- notificaciones;
- auditoría;
- configuraciones.

La arquitectura debe evitar tener dos fuentes de verdad para el mismo dato sin una razón explícita.

---

# 9. Fuente de verdad

Inicialmente:

```text
Datos originales del formulario
    → Tótem

Cola de espera
    → Nuevo sistema

Profesionales
    → Nuevo sistema

Consultorios
    → Nuevo sistema

Agenda
    → Nuevo sistema

Turnos
    → Nuevo sistema

Usuarios
    → Nuevo sistema
```

Si una futura decisión cambia esta distribución, debe documentarse.

---

# 10. Integración con el tótem

La integración debe estar desacoplada.

Flujo conceptual:

```text
Paciente utiliza tótem
        ↓
Tótem guarda información
        ↓
Evento / integración
        ↓
Nuevo sistema detecta paciente
        ↓
Nuevo sistema crea o actualiza paciente
        ↓
Nuevo sistema agrega paciente a cola
        ↓
MongoDB confirma persistencia
        ↓
Backend emite evento Socket.IO
        ↓
Profesional recibe actualización
```

La implementación concreta podrá utilizar:

- API interna;
- eventos;
- MongoDB Change Streams;
- proceso/servicio de integración;
- mecanismo híbrido.

No decidir una tecnología de sincronización definitiva sin evaluar el entorno real.

No utilizar polling agresivo como solución definitiva si existe una alternativa basada en eventos.

---

# 11. Identidad del paciente

El nuevo sistema debe tener una identidad estable para cada paciente.

Ejemplo:

```text
Patient
├── _id
├── dni
├── nombre
├── apellido
└── ...
```

El DNI puede utilizarse para localizar un paciente, pero no debe reemplazar automáticamente el `_id` interno de MongoDB.

Cuando corresponda, guardar referencia al origen:

```text
sourceSystem: "totem"
sourcePatientId: "..."
```

No asumir que el `_id` del tótem será necesariamente el `_id` del nuevo sistema.

---

# 12. Información actualmente conocida del paciente

El tótem puede registrar información como:

```text
_id
dni
apellido
createdAt
domicilio
fechaNacimiento
localidad
nombre
numeroAfiliado
obraSocial
observacion
profesional
telefono
```

El nuevo sistema NO debe copiar automáticamente todos estos datos si no los necesita.

Aplicar principio de mínima información:

> Cada endpoint, evento y pantalla debe recibir únicamente los datos necesarios para cumplir su función.

---

# 13. Turnero inicial

La primera funcionalidad operativa será la lista de espera.

Flujo:

```text
Paciente
   ↓
Utiliza tótem
   ↓
Selecciona profesional
   ↓
Completa formulario
   ↓
Acepta
   ↓
Se imprime comprobante
   ↓
Tótem registra paciente
   ↓
Integración detecta llegada
   ↓
Nuevo sistema crea entrada en cola
   ↓
Persistencia en MongoDB
   ↓
Evento Socket.IO
   ↓
Profesional recibe actualización
```

La primera versión NO necesita resolver todavía toda la agenda ni el historial.

---

# 14. Cola de espera

La cola debe ser una entidad propia del nuevo sistema.

No asumir:

> "Paciente existente en Mongo = paciente esperando."

Debe existir un concepto explícito como:

```text
QueueEntry
├── _id
├── patientId
├── professionalId
├── status
├── joinedAt
├── calledAt
├── attentionStartedAt
├── completedAt
└── source
```

Los campos exactos pueden evolucionar, pero la cola debe representar el estado operativo del paciente.

---

# 15. Estados de la cola

Los estados deben estar centralizados y ser consistentes.

Inicialmente:

```text
WAITING
CALLED
IN_ATTENTION
COMPLETED
CANCELLED
```

No utilizar strings arbitrarios en diferentes partes del código.

Evitar:

```text
"esperando"
"en espera"
"waiting"
```

para representar el mismo estado.

Usar un enum, constantes o mecanismo equivalente.

---

# 16. Orden de la cola

La cola debe tener un criterio explícito de orden.

Inicialmente:

```text
joinedAt
```

No depender del orden accidental en que MongoDB devuelva documentos.

Si existen empates, utilizar un criterio adicional estable.

---

# 17. Profesionales

Actualmente los profesionales pueden estar definidos de manera hardcodeada con:

- nombre;
- apellido;
- número profesional.

Esto es solamente una situación inicial.

La arquitectura debe permitir migrarlos a MongoDB.

Modelo conceptual:

```text
Professional
├── _id
├── nombre
├── apellido
├── numeroProfesional
├── activo
└── ...
```

Nunca identificar profesionales internamente por su nombre.

Incorrecto:

```typescript
if (professional === "Beatriz Baleiron") { ... }
```

Correcto:

```text
professionalId
```

El nombre puede cambiar. El ID debe permanecer estable.

---

# 18. Consultorios

Inicialmente existirán al menos 12 consultorios:

```text
Consultorio 1
Consultorio 2
...
Consultorio 12
```

El sistema NO debe asumir que el máximo será 12.

Los consultorios deben ser datos configurables.

No distribuir valores hardcodeados como:

```typescript
const offices = [
  "Consultorio 1",
  ...
]
```

La arquitectura debe permitir agregar consultorios posteriormente.

---

# 19. Relación profesional-consultorio

El sistema debe poder asociar dinámicamente:

```text
Profesional
+
Consultorio
```

No codificar relaciones como:

```text
Beatriz → Consultorio 1
Juan → Consultorio 2
```

en el código.

La relación debe estar representada por datos/configuración.

---

# 20. Tiempo real

El tiempo real es un requisito fundamental.

Cuando se agregue un paciente:

```text
MongoDB
   ↓
Backend
   ↓
Socket.IO
   ↓
Frontend del profesional
```

El profesional no debe tener que actualizar manualmente la página.

---

# 21. No utilizar polling como mecanismo principal

No utilizar como solución principal:

```text
GET /queue
GET /queue
GET /queue
GET /queue
```

cada pocos segundos.

La actualización principal debe utilizar eventos en tiempo real.

Un mecanismo periódico de recuperación podrá utilizarse como complemento si existe una justificación.

---

# 22. Persistencia antes de notificación

Una notificación Socket.IO no demuestra que la operación fue persistida.

Orden obligatorio para operaciones importantes:

```text
1. Validar
2. Ejecutar lógica de negocio
3. Persistir en MongoDB
4. Confirmar persistencia
5. Emitir evento Socket.IO
6. Actualizar clientes
```

Si el socket falla:

```text
Socket.IO ❌
MongoDB ✅
```

la información debe permanecer disponible.

---

# 23. Socket.IO no es almacenamiento

Socket.IO comunica eventos.

MongoDB conserva el estado.

Nunca almacenar información crítica únicamente:

- en memoria;
- en variables globales;
- en el estado del socket;
- en el frontend.

---

# 24. Reconexión

El sistema debe soportar:

- pérdida de conexión;
- reconexión;
- clientes que se conectan tarde;
- eventos duplicados;
- recuperación del estado.

Al reconectarse, el frontend debe poder recuperar el estado actual mediante la API.

Ejemplo:

```text
Socket desconectado
        ↓
Reconexión
        ↓
GET /api/v1/queue
        ↓
Estado actual
```

---

# 25. Idempotencia

La integración con el tótem puede generar el mismo evento más de una vez.

El nuevo sistema debe poder detectar duplicados.

No crear dos entradas de cola para el mismo registro del tótem.

Utilizar una referencia estable al origen, por ejemplo:

```text
sourceSystem
sourceRecordId
```

o un mecanismo equivalente.

---

# 26. Eventos Socket.IO

Los nombres de eventos deben ser claros y consistentes.

Ejemplos:

```text
queue:patient-added
queue:patient-called
queue:patient-started
queue:patient-completed
queue:patient-cancelled
```

No utilizar nombres ambiguos:

```text
update
change
refresh
event1
```

Un evento debe representar un hecho ocurrido, no contener la lógica de negocio.

---

# 27. Arquitectura del backend

Estructura base:

```text
backend/
└── src/
    ├── config/
    ├── database/
    ├── integrations/
    │   └── totem/
    ├── middlewares/
    ├── utils/
    ├── types/
    ├── modules/
    ├── app.ts
    └── server.ts
```

---

# 28. Arquitectura modular

El backend debe organizarse por dominio/feature.

Inicialmente:

```text
modules/
├── auth/
├── queue/
├── patients/
├── professionals/
└── offices/
```

No es obligatorio implementar todos inmediatamente.

Crear módulos únicamente cuando exista funcionalidad real.

---

# 29. Futuros módulos

La arquitectura debe permitir:

```text
modules/
├── auth/
├── patients/
├── professionals/
├── offices/
├── queue/
├── appointments/
├── scheduling/
├── notifications/
├── audit/
└── reports/
```

No implementar funcionalidades futuras antes de necesitarlas.

---

# 30. Estructura de un módulo backend

Ejemplo:

```text
queue/
├── queue.model.ts
├── queue.controller.ts
├── queue.service.ts
├── queue.routes.ts
├── queue.validation.ts
├── queue.types.ts
└── queue.socket.ts
```

No todos los módulos necesitan obligatoriamente todos los archivos.

Crear solamente los necesarios.

---

# 31. Flujo backend

El flujo normal debe ser:

```text
ROUTE
  ↓
CONTROLLER
  ↓
SERVICE
  ↓
MODEL / DATABASE
```

Las rutas no deben contener lógica de negocio.

Los controllers no deben realizar consultas complejas a MongoDB.

Los services deben contener la lógica de negocio.

---

# 32. Controllers

Responsabilidades:

- recibir request;
- leer params;
- leer query;
- leer body;
- llamar al service;
- convertir resultado a respuesta HTTP;
- manejar códigos HTTP.

No deben contener lógica de negocio compleja.

---

# 33. Services

Los services contienen las reglas de negocio.

Por ejemplo, `queue.service.ts` puede encargarse de:

- ingresar paciente;
- detectar duplicados;
- cambiar estados;
- llamar paciente;
- iniciar atención;
- finalizar atención;
- cancelar;
- determinar orden;
- persistir cambios;
- coordinar eventos.

---

# 34. Sockets backend

Los sockets no deben duplicar la lógica de los services.

Preferir:

```text
Socket / evento
      ↓
Service
      ↓
MongoDB
      ↓
Evento
      ↓
Socket
```

La lógica de negocio debe permanecer en los services.

---

# 35. Integración con tótem

Las comunicaciones con sistemas externos deben permanecer aisladas:

```text
integrations/
└── totem/
    ├── totem.service.ts
    ├── totem.types.ts
    └── ...
```

No contaminar `patients`, `queue` u otros módulos con detalles específicos de la implementación del tótem.

---

# 36. Frontend Angular

Estructura:

```text
frontend/
└── src/
    └── app/
        ├── core/
        ├── shared/
        ├── features/
        ├── app.routes.ts
        └── app.config.ts
```

---

# 37. Core

`core/` contiene funcionalidades globales.

Ejemplo:

```text
core/
├── guards/
├── interceptors/
├── services/
├── models/
└── layout/
```

Ejemplos:

```text
auth.service.ts
auth.guard.ts
api.interceptor.ts
socket.service.ts
```

No colocar funcionalidades específicas de una feature dentro de `core`.

---

# 38. Shared

`shared/` contiene elementos reutilizables:

```text
shared/
├── components/
├── directives/
├── pipes/
└── models/
```

Si algo solamente pertenece al turnero, debe estar dentro de:

```text
features/queue/
```

No dentro de `shared`.

---

# 39. Features

Cada dominio importante debe tener su feature:

```text
features/
├── auth/
├── queue/
├── patients/
├── professionals/
└── offices/
```

Ejemplo:

```text
queue/
├── components/
│   ├── queue-list/
│   ├── queue-item/
│   └── queue-status/
├── services/
├── models/
└── queue.routes.ts
```

---

# 40. Servicios Angular

Los componentes no deben realizar llamadas HTTP directamente.

Incorrecto:

```text
Component
   ↓
HttpClient
   ↓
API
```

Correcto:

```text
Component
   ↓
Service
   ↓
HttpClient
   ↓
API
```

---

# 41. Socket Angular

La conexión Socket.IO debe estar centralizada.

No crear múltiples conexiones independientes desde cada componente.

Preferir:

```text
core/services/socket.service.ts
```

Las features deben consumir eventos a través de servicios apropiados.

---

# 42. API

Utilizar versionado:

```text
/api/v1/auth
/api/v1/queue
/api/v1/patients
/api/v1/professionals
/api/v1/offices
```

No crear endpoints públicos sin versión.

---

# 43. Respuestas de API

Mantener formato consistente.

Éxito:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "message": "Paciente no encontrado",
  "code": "PATIENT_NOT_FOUND"
}
```

No crear formatos diferentes arbitrariamente.

---

# 44. Errores

Debe existir manejo centralizado de errores.

No exponer al frontend:

- stack traces;
- secretos;
- URI de MongoDB;
- credenciales;
- información interna innecesaria.

Los errores deben tener mensajes útiles para el cliente y logs útiles para el servidor.

---

# 45. Validación

Todo dato proveniente del frontend debe validarse también en backend.

Debe existir:

```text
Validación frontend
+
Validación backend
```

Nunca confiar exclusivamente en Angular.

Las validaciones específicas de una feature deben permanecer dentro de su módulo.

---

# 46. TypeScript

Utilizar TypeScript estrictamente.

Evitar `any` salvo justificación concreta.

Preferir:

- interfaces;
- types;
- enums;
- tipos explícitos;
- DTOs cuando realmente sean necesarios.

No duplicar tipos innecesariamente.

---

# 47. MongoDB

Las consultas deben ser eficientes.

Utilizar:

- filtros;
- proyecciones;
- índices;
- paginación;
- agregaciones cuando corresponda.

Evitar obtener grandes cantidades de datos innecesariamente.

Evitar:

```javascript
find({})
```

cuando solamente se necesita una pequeña cantidad de documentos.

---

# 48. Índices

Evaluar índices para consultas frecuentes, especialmente:

- DNI;
- IDs de referencia;
- professionalId;
- patientId;
- estado de cola;
- fechas;
- timestamps;
- sourceRecordId.

No crear índices indiscriminadamente.

Cada índice debe responder a una necesidad real de consulta.

---

# 49. Datos hardcodeados

No hardcodear datos de negocio.

Incorrecto:

```typescript
const professionals = [
  "Beatriz Baleiron"
];
```

Incorrecto:

```typescript
const offices = [
  "Consultorio 1",
  "Consultorio 2"
];
```

Si durante desarrollo se necesitan datos iniciales, utilizar seed data.

Separar:

```text
datos iniciales
```

de:

```text
lógica de aplicación
```

---

# 50. Nombres

Elegir una nomenclatura y mantenerla.

Preferir conceptos consistentes:

```text
patient
professional
office
queue
appointment
```

No mezclar arbitrariamente:

```text
patient
paciente
client
cliente
```

para representar el mismo concepto.

---

# 51. IDs y referencias

Las relaciones entre entidades deben utilizar IDs estables.

Ejemplo:

```text
QueueEntry
├── patientId
└── professionalId
```

No utilizar nombres como referencia principal.

Incorrecto:

```text
professional: "Beatriz Baleiron"
```

Correcto:

```text
professionalId: "..."
```

---

# 52. Denormalización

MongoDB permite duplicar información, pero hacerlo solamente con una razón concreta.

Por ejemplo, podría justificarse guardar un nombre histórico junto a un ID si se necesita conservar el estado histórico.

Toda duplicación relevante debe tener una justificación.

---

# 53. Eliminación

Para entidades importantes, preferir eliminación lógica cuando corresponda.

Ejemplos:

```text
activo: false
```

o:

```text
eliminado: true
```

No eliminar físicamente información importante sin una razón explícita.

---

# 54. Seguridad

El sistema funcionará por Internet.

La seguridad es obligatoria desde el inicio.

Nunca:

- almacenar passwords en texto plano;
- colocar secretos en Angular;
- subir `.env` al repositorio;
- exponer MongoDB directamente a Internet;
- permitir acceso directo del frontend a MongoDB;
- incluir credenciales en logs.

MongoDB debe estar protegido y solamente accesible por los servicios autorizados.

---

# 55. Variables de entorno

Utilizar variables de entorno para configuración sensible.

Ejemplos:

```text
MONGODB_URI
JWT_SECRET
PORT
CORS_ORIGIN
```

Crear:

```text
.env.example
```

Nunca subir el `.env` real al repositorio.

---

# 56. Autenticación

La primera versión solamente necesita login.

Sin embargo, la arquitectura debe estar preparada para incorporar:

```text
ADMIN
RECEPTIONIST
PROFESSIONAL
SUPERVISOR
```

en el futuro.

No implementar ahora permisos complejos si todavía no son necesarios, pero no diseñar el login de forma que agregar roles posteriormente requiera reemplazarlo.

---

# 57. Auditoría futura

Las operaciones importantes deberán poder auditarse.

La arquitectura debe permitir registrar:

```text
usuario
acción
entidad
entidadId
fecha
datos relevantes
```

Ejemplos:

```text
CALL_PATIENT
CANCEL_APPOINTMENT
UPDATE_PATIENT
CREATE_PROFESSIONAL
DELETE_PROFESSIONAL
```

La auditoría completa puede implementarse cuando sea necesaria.

---

# 58. Datos personales

El sistema manejará información personal.

Aplicar principio de mínima exposición.

No devolver datos innecesarios.

Por ejemplo, para una lista de espera el frontend puede necesitar:

```text
nombre
apellido
hora de llegada
estado
```

pero no necesariamente:

```text
domicilio
obraSocial
numeroAfiliado
telefono
```

No enviar datos personales completos mediante Socket.IO si el evento no los necesita.

---

# 59. Logs

Los logs deben servir para diagnosticar problemas.

No registrar:

```text
passwords
tokens
credenciales
MONGODB_URI
datos completos de pacientes
```

Registrar suficiente contexto técnico sin exponer información sensible.

---

# 60. Producción

El sistema debe estar preparado para ejecutarse en un servidor.

Arquitectura conceptual:

```text
Internet
   ↓
HTTPS
   ↓
Reverse Proxy
   ↓
Backend
   ↓
MongoDB
```

Angular puede ser servido como archivos estáticos mediante la estrategia de despliegue elegida.

MongoDB no debe exponerse directamente a Internet.

---

# 61. Red y disponibilidad

El sistema debe funcionar correctamente aunque temporalmente exista una pérdida de conexión de Socket.IO.

La persistencia en MongoDB es la fuente de recuperación.

Si el servidor pierde conexión con el tótem, la información ya sincronizada no debe perderse.

Si el tótem deja de funcionar, el nuevo sistema debe conservar sus datos previamente sincronizados.

---

# 62. Estructura inicial del repositorio

La estructura inicial esperada:

```text
project/
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── core/
│   │       ├── shared/
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   └── queue/
│   │       ├── app.routes.ts
│   │       └── app.config.ts
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── integrations/
│   │   │   └── totem/
│   │   ├── middlewares/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   └── queue/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
├── .gitignore
├── AGENTS.md
└── README.md
```

No crear `patients`, `professionals`, `offices`, etc. hasta que exista funcionalidad real para ellos.

---

# 63. Regla de creación de archivos

Antes de crear un archivo:

1. Revisar la estructura existente.
2. Buscar implementaciones relacionadas.
3. Determinar si puede reutilizarse código existente.
4. Determinar a qué módulo pertenece.
5. Crear el archivo solamente si representa una responsabilidad concreta.

No crear archivos como:

```text
service2.ts
service-new.ts
service-final.ts
helper2.ts
utils2.ts
```

para resolver problemas arquitectónicos.

---

# 64. Regla de creación de carpetas

No crear carpetas vacías.

No crear carpetas solamente para completar una estructura teórica.

Una carpeta debe contener una responsabilidad real.

Ejemplo:

Si `queue` todavía no necesita validaciones específicas, no crear obligatoriamente:

```text
queue.validation.ts
queue.mapper.ts
queue.repository.ts
queue.dto.ts
```

sin necesidad.

---

# 65. Regla contra sobreingeniería

No agregar automáticamente:

- Repository Pattern;
- Factory Pattern;
- Adapter Pattern;
- mappers;
- DTOs;
- clases abstractas;
- interfaces duplicadas;
- capas adicionales;

si no existe una necesidad concreta.

Agregar una abstracción cuando resuelva un problema real, no solamente porque es una práctica conocida.

---

# 66. Reutilización

Antes de escribir código nuevo:

```text
1. Buscar código existente.
2. Buscar servicios existentes.
3. Buscar componentes existentes.
4. Buscar modelos existentes.
5. Buscar utilidades existentes.
6. Reutilizar si corresponde.
7. Refactorizar antes de duplicar.
```

No duplicar código simplemente por evitar investigar el proyecto.

---

# 67. Cambios arquitectónicos

Antigravity NO debe reorganizar masivamente el proyecto durante una tarea funcional.

Si una tarea requiere un cambio arquitectónico importante:

1. Identificar el problema.
2. Explicar por qué la arquitectura actual no alcanza.
3. Proponer la modificación.
4. Evaluar impacto.
5. Implementar solamente después de validar que la modificación es necesaria.

---

# 68. Migraciones de datos

Si una modificación afecta MongoDB existente:

- considerar datos actuales;
- considerar documentos antiguos;
- considerar compatibilidad;
- considerar índices;
- considerar rollback;
- evitar romper el tótem.

Nunca asumir que la base contiene únicamente documentos creados por el código nuevo.

---

# 69. Testing

Las partes críticas deben poder probarse independientemente.

Prioridad:

- login;
- integración con tótem;
- ingreso a cola;
- detección de duplicados;
- cambio de estados;
- emisión de eventos;
- reconexión;
- recuperación del estado;
- persistencia.

---

# 70. Evolución del sistema

Primera versión:

```text
LOGIN
  +
LISTA DE ESPERA
  +
TIEMPO REAL
```

Evolución prevista:

```text
LOGIN
  ↓
USUARIOS / ROLES
  ↓
PROFESIONALES
  ↓
PACIENTES
  ↓
CONSULTORIOS
  ↓
TURNERO
  ↓
AGENDA
  ↓
TURNOS
  ↓
HISTORIAL
  ↓
NOTIFICACIONES
  ↓
REPORTES
  ↓
AUDITORÍA
```

La arquitectura debe crecer agregando dominios/módulos, no convirtiendo módulos existentes en archivos gigantes.

---

# 71. Preguntas obligatorias antes de implementar una nueva funcionalidad

Antes de modificar el proyecto, verificar:

```text
¿A qué dominio pertenece esta funcionalidad?

¿Existe un módulo para ese dominio?

¿Estoy colocando la lógica en la capa correcta?

¿Estoy duplicando código?

¿Estoy creando una nueva fuente de verdad?

¿Estoy acoplando innecesariamente el nuevo sistema con el tótem?

¿La operación se persiste antes de emitir eventos?

¿Qué ocurre si Socket.IO se desconecta?

¿La información puede recuperarse desde MongoDB?

¿Estoy exponiendo datos personales innecesarios?

¿Estoy hardcodeando datos que deberían ser configurables?

¿Estoy agregando complejidad sin necesidad?

¿Estoy rompiendo alguna funcionalidad existente?
```

---

# 72. Regla final

La arquitectura debe crecer agregando módulos y responsabilidades bien definidas.

Preferir:

```text
nuevo dominio
    ↓
nuevo módulo
```

antes que:

```text
un módulo gigante
    ↓
muchos if/else
    ↓
lógica mezclada
```

El objetivo es que el proyecto pueda crecer durante años manteniendo una estructura comprensible, segura, testeable y mantenible.

## Regla absoluta

No sacrificar la arquitectura por velocidad de implementación.

No cambiar silenciosamente las reglas establecidas en este documento.

Si una nueva necesidad entra en conflicto con estas reglas, primero analizar y documentar el conflicto antes de modificar la arquitectura.
