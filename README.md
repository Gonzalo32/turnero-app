# Turnero App — Sistema Odontológico Senza

Sistema de gestión odontológica y cola de espera de pacientes en tiempo real.

Cuando un paciente se registra en el tótem (proyecto hermano `odonto-app`), el tótem notifica a este backend, que persiste la llegada y la emite en tiempo real por Socket.IO a la pantalla del profesional y a la pantalla del televisor de la sala de espera.

---

## 🏗️ Estructura del Proyecto

```text
turnero-app/
├── frontend/   ← App Angular 18 (pantalla de odontólogos y pantalla de TV)
├── backend/    ← Servidor Express + TypeScript + Socket.IO + MongoDB
├── docs/       ← Documentación (architecture.md, running.txt)
└── AGENTS.md   ← Reglas de arquitectura
```

---

## 📋 Requisitos Previos

Tener instalado en tu computadora:
- **Node.js** (v18 o superior)
- **MongoDB** en ejecución (puerto `27017`)

---

## 🚀 PASO 1: Instalación Inicial (Solo se hace UNA vez)

> ⚠️ **NO repitas estos pasos cada vez.** Solo se realizan la primera vez que descargas o configuras el proyecto.

Abre una terminal en la carpeta principal `turnero-app`:

### 1.1 Configurar el Backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed
```
*(El comando `npm run seed` carga los 14 odontólogos en la base de datos `senza_sistema`)*

### 1.2 Configurar el Frontend
```bash
cd ../frontend
npm install
```

¡Listo! Ya quedó todo instalado y listo para usar.

---

## ⚡ PASO 2: Iniciar el Sistema (Uso diario)

> Cada vez que quieras usar la página, necesitas tener **2 terminales abiertas al mismo tiempo**:

### 🟦 Terminal 1 — Iniciar el Servidor (Backend)
```bash
cd backend
npm start
```
*Debe decir: `Servidor iniciado en puerto 3001` y `Socket.IO listo`.*

---

### 🟩 Terminal 2 — Iniciar la Pantalla Web (Frontend)
```bash
cd frontend
npm start
```
*Debe decir: `Application bundle generation complete`.*

---

## 🌐 URLs de Acceso en el Navegador

Una vez que ambas terminales estén corriendo, abre tu navegador:

- **Panel de Odontólogos:** [http://localhost:4300](http://localhost:4300)  
  *(Permite elegir odontólogo y consultorio para atender la cola)*
- **Pantalla para TV (Sala de Espera):** [http://localhost:4300/turnero-tv](http://localhost:4300/turnero-tv)  
  *(Muestra los turnos llamados en pantalla completa)*
- **Comprobación de la API:** [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)

---

## 🛑 Cómo detener el sistema
Para apagar cualquiera de los dos servicios, presiona `Ctrl + C` en su respectiva terminal.
