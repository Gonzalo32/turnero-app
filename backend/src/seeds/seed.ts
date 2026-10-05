import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Professional } from '../modules/professionals/professional.model';

/**
 * Seed data: profesionales iniciales del consultorio.
 * AGENTS.md §49: Los datos de negocio no deben estar hardcodeados en el código de aplicación.
 * Este script de seed es el único lugar donde aparecen estos nombres.
 */
const INITIAL_PROFESSIONALS = [
  { firstName: 'Kevin',    lastName: 'Anzoategui' },
  { firstName: 'Beatriz',  lastName: 'Baleiron' },
  { firstName: 'Martin',   lastName: 'Chaparro' },
  { firstName: 'Gustavo',  lastName: "D'archivio" },
  { firstName: 'Aldana',   lastName: 'Diaz' },
  { firstName: 'Ana',      lastName: 'Diaz Pantoja' },
  { firstName: 'Ignacio',  lastName: 'Faes' },
  { firstName: 'Lucas',    lastName: 'Garritano' },
  { firstName: 'Agustina', lastName: 'Grispino' },
  { firstName: 'Fabian',   lastName: 'Grispino' },
  { firstName: 'Eliana',   lastName: 'Lopez' },
  { firstName: 'Julian',   lastName: 'Nicolini' },
  { firstName: 'Amparo',   lastName: 'Suter' },
  { firstName: 'Karla',    lastName: 'Useche' },
];

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI no definida');

  await mongoose.connect(uri);
  console.log('[Seed] Conectado a MongoDB:', mongoose.connection.name);

  for (const prof of INITIAL_PROFESSIONALS) {
    const existing = await Professional.findOne({
      firstName: prof.firstName,
      lastName: prof.lastName,
    });

    if (!existing) {
      await Professional.create(prof);
      console.log(`[Seed] Creado: ${prof.firstName} ${prof.lastName}`);
    } else {
      console.log(`[Seed] Ya existe: ${prof.firstName} ${prof.lastName}`);
    }
  }

  await mongoose.disconnect();
  console.log('[Seed] Finalizado.');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
