const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// URL del backend del nuevo sistema (configurable por entorno)
const TURNERO_API_URL = process.env.TURNERO_API_URL || 'http://localhost:4000';

/**
 * Notifica al backend del nuevo sistema (turnero) que un paciente llegó al tótem.
 * Fire-and-forget: si el servidor del turnero no está disponible, el tótem sigue funcionando.
 * El backend del turnero es idempotente (ignora duplicados por sourceRecordId).
 *
 * @param {object} turno - Documento de turno recién guardado en MongoDB.
 * @param {object} patientData - Datos adicionales del paciente si los hubiera.
 */
async function notifyTurneroApi(turno) {
  const endpoint = `${TURNERO_API_URL}/api/v1/integrations/totem/patient`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _id: turno._id.toString(),
        dni: turno.pacienteDni,
        nombre: turno.pacienteNombre,
        apellido: turno.pacienteApellido,
        obraSocial: turno.obraSocial,
        profesional: turno.profesional,
        createdAt: turno.creadoEn || turno.createdAt,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.warn(`[Turnero] El backend respondió con error ${response.status}:`, body);
    } else {
      console.log('[Turnero] Paciente notificado al backend del nuevo sistema OK.');
    }
  } catch (err) {
    // No bloquear el flujo del tótem si el backend no está disponible
    console.warn('[Turnero] No se pudo notificar al backend del nuevo sistema:', err.message);
  }
}

// ÔöÇÔöÇ WebSocket Server ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const wss = new WebSocket.Server({ server });

/**
 * Emite un mensaje JSON a todos los clientes WebSocket conectados.
 * @param {object} payload - Objeto a enviar serializado como JSON.
 */
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WS] Cliente conectado. Total:', wss.clients.size);
  ws.on('close', () => console.log('[WS] Cliente desconectado. Total:', wss.clients.size));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

// ÔöÇÔöÇ Middleware ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
app.use(cors());
app.use(express.json());

// ÔöÇÔöÇ MongoDB ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/senza_totem';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// ÔöÇÔöÇ Models ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const Patient = require('./models/Patient');
const Turno = require('./models/Turno');

// ÔöÇÔöÇ Patient Endpoints ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

app.post('/api/patients', async (req, res) => {
  try {
    const patientData = req.body;

    if (!patientData.dni) {
      return res.status(400).json({ error: 'DNI es requerido' });
    }

    const patient = await Patient.findOneAndUpdate(
      { dni: patientData.dni },
      { $set: patientData },
      { upsert: true, new: true }
    );

    const wasNew = !patient.createdAt || patient.createdAt === patient.updatedAt;
    res.status(200).json({ message: wasNew ? 'Paciente creado' : 'Paciente actualizado', data: patient });
  } catch (error) {
    console.error('Error guardando paciente:', error);
    res.status(500).json({ error: 'Failed to save patient' });
  }
});

app.get('/api/patients/dni/:dni', async (req, res) => {
  try {
    const patient = await Patient.findOne({ dni: req.params.dni });
    if (patient) {
      res.json(patient);
    } else {
      res.status(404).json({ error: 'No encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error buscando paciente' });
  }
});

app.get('/api/patients', async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// ÔöÇÔöÇ Turnos Endpoints ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

/**
 * POST /api/turnos
 * Crea un nuevo turno cuando el paciente imprime en el t├│tem.
 * Emite el evento 'turno:nuevo' por WebSocket a todos los clientes.
 */
app.post('/api/turnos', async (req, res) => {
  try {
    const { pacienteNombre, pacienteApellido, pacienteDni, obraSocial, profesional } = req.body;

    if (!pacienteNombre || !pacienteApellido || !pacienteDni || !profesional) {
      return res.status(400).json({ error: 'Faltan campos requeridos: pacienteNombre, pacienteApellido, pacienteDni, profesional' });
    }

    const turno = await Turno.create({
      pacienteNombre,
      pacienteApellido,
      pacienteDni,
      obraSocial: obraSocial || 'Particular',
      profesional,
      estado: 'esperando'
    });

    // Notificar en tiempo real a todos los odontólogos conectados (WebSocket)
    broadcast({ tipo: 'turno:nuevo', turno });

    // Notificar al backend del nuevo sistema (turnero) — fire-and-forget
    // No se awaita para no bloquear la respuesta al tótem.
    notifyTurneroApi(turno).catch(() => {}); // el error ya se loguea dentro de la función

    res.status(201).json({ message: 'Turno creado', data: turno });
  } catch (error) {
    console.error('Error creando turno:', error);
    res.status(500).json({ error: 'Error al crear turno' });
  }
});

/**
 * GET /api/turnos
 * Devuelve la cola actual de turnos en estado 'esperando'.
 * Opcionalmente filtra por profesional: ?profesional=Nombre
 */
app.get('/api/turnos', async (req, res) => {
  try {
    const query = { estado: 'esperando' };
    if (req.query.profesional) {
      query.profesional = req.query.profesional;
    }
    const turnos = await Turno.find(query).sort({ creadoEn: 1 });
    res.json(turnos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
});

/**
 * PATCH /api/turnos/:id/atendido
 * Marca un turno como atendido y lo elimina de la cola activa.
 * Emite el evento 'turno:atendido' por WebSocket.
 */
app.patch('/api/turnos/:id/atendido', async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(
      req.params.id,
      { estado: 'atendido' },
      { new: true }
    );

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    broadcast({ tipo: 'turno:atendido', turnoId: turno._id, profesional: turno.profesional });

    res.json({ message: 'Turno marcado como atendido', data: turno });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar turno' });
  }
});

/**
 * DELETE /api/turnos/:id
 * Elimina un turno permanentemente (uso administrativo).
 * Emite el evento 'turno:eliminado' por WebSocket.
 */
app.delete('/api/turnos/:id', async (req, res) => {
  try {
    const turno = await Turno.findByIdAndDelete(req.params.id);

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    broadcast({ tipo: 'turno:eliminado', turnoId: turno._id, profesional: turno.profesional });

    res.json({ message: 'Turno eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar turno' });
  }
});

// ÔöÇÔöÇ Health ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    wsClients: wss.clients.size
  });
});

// ÔöÇÔöÇ Angular static build ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const angularBuildPath = path.join(__dirname, '../dist/turnero-app/browser');
app.use(express.static(angularBuildPath));

// Catch-all: debe ir al final para que el routing de Angular funcione
app.get('*', (req, res) => {
  res.sendFile(path.join(angularBuildPath, 'index.html'));
});

// ÔöÇÔöÇ Start ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});

