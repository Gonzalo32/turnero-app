import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose, { Types } from 'mongoose';
import { QueueStatus, ACTIVE_QUEUE_STATUSES } from '../modules/queue/queue.types';

/**
 * Migración: la cola deja de vivir en `patients` y pasa a `queueentries` (AGENTS.md §14, §68).
 *
 *   npm run migrate:queue            → simulación, no escribe nada
 *   npm run migrate:queue -- --apply → escribe
 *
 * 1. Cada visita de `patients.visitas` (o el estado suelto del paciente) → una QueueEntry.
 * 2. QueueEntries escritas directo por el tótem (sin patientId) → se vinculan al paciente.
 * 3. Entradas activas de días anteriores → CANCELLED (la cola es del día).
 * 4. Si un paciente queda con más de una entrada activa, se conserva la más reciente.
 *
 * Idempotente: las entradas creadas llevan sourceRecordId "migration:patient:<id>:<n>".
 * No borra campos viejos de `patients` (rollback: borrar las entradas "migration:*").
 */

// Documentos legados de forma variable: se leen sin esquema a propósito.
type Raw = Record<string, any>;

const apply = process.argv.includes('--apply');
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const ACTIVE: string[] = ACTIVE_QUEUE_STATUSES;
const ALL: string[] = Object.values(QueueStatus);

/** Estado final de una entrada migrada; activas viejas o reemplazadas se cancelan */
function finalStatus(raw: unknown, joinedAt: Date, superseded: boolean): string {
  const status = typeof raw === 'string' && ALL.includes(raw) ? raw : QueueStatus.CANCELLED;
  if (ACTIVE.includes(status) && (superseded || joinedAt < startOfToday)) return QueueStatus.CANCELLED;
  return status;
}

async function migrate(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI no definida');
  await mongoose.connect(uri);
  const db = mongoose.connection;
  const patients = db.collection<Raw>('patients');
  const entries = db.collection<Raw>('queueentries');
  console.log(`[Migración] Base: ${db.name} — modo ${apply ? 'APPLY' : 'SIMULACIÓN'}`);

  // ── 1. Visitas guardadas en patients ────────────────────────────────────────
  let created = 0, skipped = 0, noProfessional = 0;
  const legacy = patients.find({
    $or: [{ status: { $exists: true } }, { estado: { $exists: true } }, { 'visitas.0': { $exists: true } }],
  });
  for await (const p of legacy) {
    const visits: Raw[] = Array.isArray(p.visitas) && p.visitas.length
      ? p.visitas
      : [{ fecha: p.joinedAt ?? p.createdAt, profesionalId: p.profesionalId, obraSocial: p.obraSocial }];

    for (let i = 0; i < visits.length; i++) {
      const v = visits[i];
      const sourceRecordId = `migration:patient:${p._id}:${i}`;
      if (await entries.findOne({ sourceRecordId }, { projection: { _id: 1 } })) { skipped++; continue; }
      if (!v.profesionalId) { noProfessional++; continue; }

      const isLast = i === visits.length - 1;
      const joinedAt = new Date(v.fecha ?? p.createdAt ?? now);
      const status = finalStatus(isLast ? (p.status ?? p.estado ?? v.estado) : v.estado, joinedAt, !isLast);
      const doc: Raw = {
        patientId: p._id,
        patientFirstName: p.nombre,
        patientLastName: p.apellido,
        patientDni: p.dni,
        healthInsurance: v.obraSocial || p.obraSocial || 'Particular',
        professionalId: new Types.ObjectId(String(v.profesionalId)),
        status,
        source: v.profesional ? 'totem' : 'manual',
        sourceRecordId,
        visitNumber: v.numeroVisita ?? i + 1,
        joinedAt,
        calledAt: isLast ? p.calledAt ?? undefined : undefined,
        attentionStartedAt: isLast ? p.attentionStartedAt ?? undefined : undefined,
        completedAt: status === QueueStatus.COMPLETED ? v.atendidoAt ?? (isLast ? p.completedAt : undefined) ?? undefined : undefined,
        cancelledAt: status === QueueStatus.CANCELLED ? (isLast ? p.cancelledAt : undefined) ?? now : undefined,
        createdAt: now,
        updatedAt: now,
      };
      if (apply) await entries.insertOne(doc);
      created++;
    }
  }
  console.log(`[1] Entradas desde patients: ${created} nuevas, ${skipped} ya migradas, ${noProfessional} sin profesional (omitidas)`);

  // ── 2. Entradas escritas directo por el tótem, sin patientId ────────────────
  let linked = 0, patientsCreated = 0;
  for await (const e of entries.find({ patientId: { $exists: false } })) {
    let patient = await patients.findOne({ dni: e.patientDni }, { projection: { _id: 1 } });
    if (!patient) {
      const res = { insertedId: new Types.ObjectId() };
      if (apply) {
        Object.assign(res, await patients.insertOne({
          dni: e.patientDni, nombre: e.patientFirstName, apellido: e.patientLastName,
          sourceSystem: 'totem', sourcePatientId: e.sourceRecordId, createdAt: e.joinedAt ?? now,
        }));
      }
      patient = { _id: res.insertedId };
      patientsCreated++;
    }
    const joinedAt = new Date(e.joinedAt ?? now);
    const status = finalStatus(e.status, joinedAt, false);
    const set: Raw = { patientId: patient._id, source: 'totem', status, updatedAt: now };
    if (status === QueueStatus.CANCELLED && !e.cancelledAt) set['cancelledAt'] = now;
    if (apply) await entries.updateOne({ _id: e._id }, { $set: set });
    linked++;
  }
  console.log(`[2] Entradas del tótem vinculadas: ${linked} (pacientes creados: ${patientsCreated})`);

  if (!apply) {
    console.log('[3-4] Se calculan al aplicar. Ejecutar con --apply para escribir.');
    return mongoose.disconnect();
  }

  // ── 3. Activas de días anteriores → CANCELLED ───────────────────────────────
  const stale = await entries.updateMany(
    { status: { $in: ACTIVE }, joinedAt: { $lt: startOfToday } },
    { $set: { status: QueueStatus.CANCELLED, cancelledAt: now, updatedAt: now } }
  );
  console.log(`[3] Activas de días anteriores canceladas: ${stale.modifiedCount}`);

  // ── 4. Una sola entrada activa por paciente ─────────────────────────────────
  let deduped = 0;
  const dupes = entries.aggregate<Raw>([
    { $match: { status: { $in: ACTIVE } } },
    { $sort: { joinedAt: -1, _id: -1 } },
    { $group: { _id: '$patientId', ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  for await (const g of dupes) {
    const older = (g.ids as Types.ObjectId[]).slice(1);
    const res = await entries.updateMany(
      { _id: { $in: older } },
      { $set: { status: QueueStatus.CANCELLED, cancelledAt: now, updatedAt: now } }
    );
    deduped += res.modifiedCount;
  }
  console.log(`[4] Entradas activas duplicadas canceladas: ${deduped}`);

  // ── Números de visita para entradas vinculadas en el paso 2 ─────────────────
  for await (const e of entries.find({ source: 'totem', sourceRecordId: { $not: /^migration:/ } })) {
    const before = await entries.countDocuments({ patientId: e.patientId, joinedAt: { $lt: e.joinedAt } });
    await entries.updateOne({ _id: e._id }, { $set: { visitNumber: before + 1 } });
  }

  await mongoose.disconnect();
  console.log('[Migración] Finalizada.');
}

migrate().catch((err) => {
  console.error('[Migración] Error:', err);
  process.exit(1);
});
