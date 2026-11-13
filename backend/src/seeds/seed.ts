import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Professional, UserRole } from '../modules/professionals/professional.model';

/**
 * Seed data: profesionales iniciales del consultorio con correos ficticios.
 * Las contraseñas iniciales salen del entorno (SEED_ADMIN_PASSWORD, SEED_DEFAULT_PASSWORD), nunca del código.
 * El seed NUNCA pisa la contraseña de un usuario que ya existe.
 * AGENTS.md §49: Los datos de negocio no deben estar hardcodeados en el código de aplicación.
 * Este script de seed es el único lugar donde aparecen estos nombres.
 */
const INITIAL_PROFESSIONALS = [
  { firstName: 'Kevin',    lastName: 'Anzoategui',  email: 'kanz@gmail.com',   licenseNumber: 'MN-1001' },
  { firstName: 'Beatriz',  lastName: 'Baleiron',    email: 'bbal@gmail.com',   licenseNumber: 'MN-1002' },
  { firstName: 'Martin',   lastName: 'Chaparro',    email: 'mchp@gmail.com',   licenseNumber: 'MN-1003' },
  { firstName: 'Gustavo',  lastName: "D'archivio",  email: 'gdar@gmail.com',   licenseNumber: 'MN-1004' },
  { firstName: 'Aldana',   lastName: 'Diaz',        email: 'adia@gmail.com',   licenseNumber: 'MN-1005' },
  { firstName: 'Ana',      lastName: 'Diaz Pantoja',email: 'adiazp@gmail.com', licenseNumber: 'MN-1006' },
  { firstName: 'Ignacio',  lastName: 'Faes',        email: 'ifae@gmail.com',   licenseNumber: 'MN-1007' },
  { firstName: 'Lucas',    lastName: 'Garritano',   email: 'lgar@gmail.com',   licenseNumber: 'MN-1008' },
  { firstName: 'Agustina', lastName: 'Grispino',   email: 'agri@gmail.com',   licenseNumber: 'MN-1009' },
  { firstName: 'Fabian',   lastName: 'Grispino',    email: 'fgri@gmail.com',   licenseNumber: 'MN-1010' },
  { firstName: 'Eliana',   lastName: 'Lopez',       email: 'elop@gmail.com',   licenseNumber: 'MN-1011' },
  { firstName: 'Julian',   lastName: 'Nicolini',    email: 'jnic@gmail.com',   licenseNumber: 'MN-1012' },
  { firstName: 'Amparo',   lastName: 'Suter',       email: 'asut@gmail.com',   licenseNumber: 'MN-1013' },
  { firstName: 'Karla',    lastName: 'Useche',      email: 'kuse@gmail.com',   licenseNumber: 'MN-1014' },
];

/** Usuario Administrador del sistema */
const ADMIN_USER = {
  firstName: 'Administrador',
  lastName: 'Admin',
  email: 'admin',
  licenseNumber: 'ADM-001',
  active: true,
  role: UserRole.ADMIN,
};

/** Contraseña inicial tomada del entorno; solo se exige si hay que crear un usuario. */
function initialPassword(key: string): string {
  const val = process.env[key];
  if (!val || val.length < 8) throw new Error(`${key} no definida o con menos de 8 caracteres`);
  return val;
}

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI no definida');

  await mongoose.connect(uri);
  console.log('[Seed] Conectado a MongoDB:', mongoose.connection.name);

  // 1. Crear los profesionales que falten. A los existentes solo se les completa lo que no tengan.
  for (const prof of INITIAL_PROFESSIONALS) {
    const existing = await Professional.findOne({
      firstName: prof.firstName,
      lastName: prof.lastName,
    });

    if (!existing) {
      await Professional.create({
        ...prof,
        password: initialPassword('SEED_DEFAULT_PASSWORD'),
        active: true,
      });
      console.log(`[Seed] Creado: ${prof.firstName} ${prof.lastName}`);
    } else {
      if (!existing.email) existing.email = prof.email;
      if (!existing.licenseNumber) existing.licenseNumber = prof.licenseNumber;
      await existing.save();
    }
  }

  // 2. Usuario administrador: se crea si no existe; si existe solo se asegura su rol.
  const existingAdmin = await Professional.findOne({ email: 'admin' });

  if (!existingAdmin) {
    await Professional.create({ ...ADMIN_USER, password: initialPassword('SEED_ADMIN_PASSWORD') });
    console.log('[Seed] Creado usuario administrador');
  } else {
    existingAdmin.role = UserRole.ADMIN;
    await existingAdmin.save();
    console.log('[Seed] Usuario administrador ya existía (contraseña sin cambios)');
  }

  // 3. Limpiar campos no usados directamente en MongoDB nativo
  await mongoose.connection
    .collection('professionals')
    .updateMany({}, { $unset: { specialty: '', colorTag: '', notes: '' } });

  await mongoose.disconnect();
  console.log('[Seed] Finalizado exitosamente.');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
