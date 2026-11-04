import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Professional } from '../modules/professionals/professional.model';

/**
 * Seed data: profesionales iniciales del consultorio con correos ficticios y contraseñas de prueba.
 * AGENTS.md §49: Los datos de negocio no deben estar hardcodeados en el código de aplicación.
 * Este script de seed es el único lugar donde aparecen estos nombres.
 */
const INITIAL_PROFESSIONALS = [
  { firstName: 'Kevin',    lastName: 'Anzoategui',  email: 'kanz@gmail.com',   password: '12345678', licenseNumber: 'MN-1001' },
  { firstName: 'Beatriz',  lastName: 'Baleiron',    email: 'bbal@gmail.com',   password: '12345678', licenseNumber: 'MN-1002' },
  { firstName: 'Martin',   lastName: 'Chaparro',    email: 'mchp@gmail.com',   password: '12345678', licenseNumber: 'MN-1003' },
  { firstName: 'Gustavo',  lastName: "D'archivio",  email: 'gdar@gmail.com',   password: '12345678', licenseNumber: 'MN-1004' },
  { firstName: 'Aldana',   lastName: 'Diaz',        email: 'adia@gmail.com',   password: '12345678', licenseNumber: 'MN-1005' },
  { firstName: 'Ana',      lastName: 'Diaz Pantoja',email: 'adiazp@gmail.com', password: '12345678', licenseNumber: 'MN-1006' },
  { firstName: 'Ignacio',  lastName: 'Faes',        email: 'ifae@gmail.com',   password: '12345678', licenseNumber: 'MN-1007' },
  { firstName: 'Lucas',    lastName: 'Garritano',   email: 'lgar@gmail.com',   password: '12345678', licenseNumber: 'MN-1008' },
  { firstName: 'Agustina', lastName: 'Grispino',   email: 'agri@gmail.com',   password: '12345678', licenseNumber: 'MN-1009' },
  { firstName: 'Fabian',   lastName: 'Grispino',    email: 'fgri@gmail.com',   password: '12345678', licenseNumber: 'MN-1010' },
  { firstName: 'Eliana',   lastName: 'Lopez',       email: 'elop@gmail.com',   password: '12345678', licenseNumber: 'MN-1011' },
  { firstName: 'Julian',   lastName: 'Nicolini',    email: 'jnic@gmail.com',   password: '12345678', licenseNumber: 'MN-1012' },
  { firstName: 'Amparo',   lastName: 'Suter',       email: 'asut@gmail.com',   password: '12345678', licenseNumber: 'MN-1013' },
  { firstName: 'Karla',    lastName: 'Useche',      email: 'kuse@gmail.com',   password: '12345678', licenseNumber: 'MN-1014' },
];

/** Usuario Administrador del sistema con credenciales admin / 1234 */
const ADMIN_USER = {
  firstName: 'Administrador',
  lastName: 'Admin',
  email: 'admin',
  password: '1234',
  licenseNumber: 'ADM-001',
  active: true,
};

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI no definida');

  await mongoose.connect(uri);
  console.log('[Seed] Conectado a MongoDB:', mongoose.connection.name);

  // 1. Sembrar / actualizar profesionales con correos ficticios y contraseña 12345678
  for (const prof of INITIAL_PROFESSIONALS) {
    const existing = await Professional.findOne({
      firstName: prof.firstName,
      lastName: prof.lastName,
    });

    if (!existing) {
      await Professional.create({
        ...prof,
        active: true,
      });
      console.log(`[Seed] Creado: ${prof.firstName} ${prof.lastName} (${prof.email})`);
    } else {
      existing.email = prof.email;
      existing.password = prof.password;
      if (prof.licenseNumber && !existing.licenseNumber) existing.licenseNumber = prof.licenseNumber;
      await existing.save();
      console.log(`[Seed] Actualizado con credenciales: ${prof.firstName} ${prof.lastName} (${prof.email})`);
    }
  }

  // 2. Sembrar / actualizar usuario administrador (admin / 1234)
  const existingAdmin = await Professional.findOne({ email: 'admin' });

  if (!existingAdmin) {
    await Professional.create(ADMIN_USER);
    console.log(`[Seed] Creado usuario administrador: admin (password: 1234)`);
  } else {
    existingAdmin.email = ADMIN_USER.email;
    existingAdmin.password = ADMIN_USER.password;
    existingAdmin.firstName = ADMIN_USER.firstName;
    existingAdmin.lastName = ADMIN_USER.lastName;
    await existingAdmin.save();
    console.log(`[Seed] Actualizado usuario administrador: admin (password: 1234)`);
  }

  // 3. Limpiar campos no usados (specialty, colorTag, role, notes) directamente en MongoDB nativo
  const rawCollection = mongoose.connection.collection('professionals');
  await rawCollection.updateMany(
    {},
    {
      $unset: {
        specialty: '',
        colorTag: '',
        role: '',
        notes: '',
      },
    }
  );
  console.log('[Seed] Campos no utilizados (specialty, colorTag, role, notes) eliminados de la colección.');

  await mongoose.disconnect();
  console.log('[Seed] Finalizado exitosamente.');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
