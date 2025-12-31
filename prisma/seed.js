import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

// =====================================================
// DEMO USERS - FOR DEVELOPMENT/TESTING ONLY
// =====================================================
//
// WARNING: These passwords meet security requirements but are
// publicly known. In production, users must be created through
// a secure registration process or imported from an identity provider.
//
// Password requirements: 12+ chars, uppercase, lowercase, number, special char
//
// Demo accounts for testing:
//   admin@hospital.org     / Admin#Secure2024!
//   dr.chen@hospital.org   / Doctor#Secure2024!
//   nurse.moore@hospital.org / Nurse#Secure2024!
//
const users = [
  { email: 'admin@hospital.org', password: 'Admin#Secure2024!', fullName: 'System Administrator', role: 'admin', initials: 'SA' },
  { email: 'dr.chen@hospital.org', password: 'Doctor#Secure2024!', fullName: 'Dr. Sarah Chen', role: 'physician', initials: 'SC' },
  { email: 'dr.roberts@hospital.org', password: 'Doctor#Secure2024!', fullName: 'Dr. Michael Roberts', role: 'physician', initials: 'MR' },
  { email: 'dr.wong@hospital.org', password: 'Doctor#Secure2024!', fullName: 'Dr. Lisa Wong', role: 'physician', initials: 'LW' },
  { email: 'nurse.moore@hospital.org', password: 'Nurse#Secure2024!', fullName: 'Jessica Moore', role: 'charge_nurse', initials: 'JM' },
  { email: 'staff.clark@hospital.org', password: 'Staff#Secure2024!', fullName: 'Amanda Clark', role: 'staff_nurse', initials: 'AC' },
  { email: 'staff.park@hospital.org', password: 'Staff#Secure2024!', fullName: 'David Park', role: 'staff_nurse', initials: 'DP' },
  { email: 'staff.adams@hospital.org', password: 'Staff#Secure2024!', fullName: 'Jennifer Adams', role: 'staff_nurse', initials: 'JA' },
  { email: 'staff.santos@hospital.org', password: 'Staff#Secure2024!', fullName: 'Maria Santos', role: 'staff_nurse', initials: 'MS' },
  { email: 'staff.obrien@hospital.org', password: 'Staff#Secure2024!', fullName: "Kevin O'Brien", role: 'staff_nurse', initials: 'KO' },
  { email: 'clerk@hospital.org', password: 'Clerk#Secure2024!', fullName: 'Administrative Clerk', role: 'administrative', initials: 'CK' },
];

// Beds in the NICU
const beds = [
  { bedNumber: '01', unit: 'NICU', status: 'occupied' },
  { bedNumber: '02', unit: 'NICU', status: 'occupied' },
  { bedNumber: '03', unit: 'NICU', status: 'occupied' },
  { bedNumber: '04', unit: 'NICU', status: 'occupied' },
  { bedNumber: '05', unit: 'NICU', status: 'occupied' },
  { bedNumber: '06', unit: 'NICU', status: 'occupied' },
  { bedNumber: '07', unit: 'NICU', status: 'occupied' },
  { bedNumber: '08', unit: 'NICU', status: 'occupied' },
  { bedNumber: '09', unit: 'NICU', status: 'available' },
  { bedNumber: '10', unit: 'NICU', status: 'available' },
  { bedNumber: '11', unit: 'NICU', status: 'cleaning' },
  { bedNumber: '12', unit: 'NICU', status: 'available' },
];

// Patients (matching lib/data.js)
const patients = [
  {
    mrn: 'MRN-48210',
    name: 'THOMPSON, BABY',
    dateOfBirth: new Date('2024-12-21'),
    gender: 'F',
    gestationalAge: '32+4',
    birthWeight: 1.65,
    currentWeight: 1.82,
    dayOfLife: 8,
    bedNumber: '01',
    status: 'normal',
    admitDate: new Date('2024-12-21T14:30:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48222',
    name: 'MARTINEZ, BABY',
    dateOfBirth: new Date('2024-12-15'),
    gender: 'M',
    gestationalAge: '28+2',
    birthWeight: 0.98,
    currentWeight: 1.12,
    dayOfLife: 14,
    bedNumber: '02',
    status: 'warning',
    admitDate: new Date('2024-12-15T08:15:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48233',
    name: 'CHEN, BABY',
    dateOfBirth: new Date('2024-12-24'),
    gender: 'F',
    gestationalAge: '34+0',
    birthWeight: 2.08,
    currentWeight: 2.15,
    dayOfLife: 5,
    bedNumber: '03',
    status: 'normal',
    admitDate: new Date('2024-12-24T22:45:00'),
    alarmLimits: JSON.stringify({ spo2: [90, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48244',
    name: 'WILLIAMS, BABY',
    dateOfBirth: new Date('2024-12-08'),
    gender: 'M',
    gestationalAge: '26+5',
    birthWeight: 0.72,
    currentWeight: 0.89,
    dayOfLife: 21,
    bedNumber: '04',
    status: 'critical',
    admitDate: new Date('2024-12-08T03:20:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48255',
    name: 'JOHNSON, BABY',
    dateOfBirth: new Date('2024-12-18'),
    gender: 'F',
    gestationalAge: '31+1',
    birthWeight: 1.42,
    currentWeight: 1.54,
    dayOfLife: 11,
    bedNumber: '05',
    status: 'normal',
    admitDate: new Date('2024-12-18T11:00:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48266',
    name: 'BROWN, BABY',
    dateOfBirth: new Date('2024-12-20'),
    gender: 'M',
    gestationalAge: '29+6',
    birthWeight: 1.18,
    currentWeight: 1.28,
    dayOfLife: 9,
    bedNumber: '06',
    status: 'warning',
    admitDate: new Date('2024-12-20T16:30:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48277',
    name: 'DAVIS, BABY',
    dateOfBirth: new Date('2024-12-26'),
    gender: 'F',
    gestationalAge: '35+2',
    birthWeight: 2.34,
    currentWeight: 2.34,
    dayOfLife: 3,
    bedNumber: '07',
    status: 'normal',
    admitDate: new Date('2024-12-26T09:15:00'),
    alarmLimits: JSON.stringify({ spo2: [90, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
  {
    mrn: 'MRN-48288',
    name: 'GARCIA, BABY',
    dateOfBirth: new Date('2024-12-22'),
    gender: 'M',
    gestationalAge: '30+3',
    birthWeight: 1.32,
    currentWeight: 1.45,
    dayOfLife: 7,
    bedNumber: '08',
    status: 'normal',
    admitDate: new Date('2024-12-22T20:00:00'),
    alarmLimits: JSON.stringify({ spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }),
  },
];

// Generate vitals for a patient
function generateVitals(patient, count = 50) {
  const vitals = [];
  const now = new Date();

  // Base values based on status
  const bases = {
    normal: { hr: 140, spo2: 96, rr: 42, temp: 36.7 },
    warning: { hr: 160, spo2: 90, rr: 55, temp: 37.1 },
    critical: { hr: 180, spo2: 84, rr: 70, temp: 38.0 },
  };

  const base = bases[patient.status] || bases.normal;
  const variance = patient.status === 'critical' ? 5 : patient.status === 'warning' ? 3 : 1;

  for (let i = 0; i < count; i++) {
    const recordedAt = new Date(now.getTime() - (count - i) * 5 * 60 * 1000); // 5-minute intervals
    vitals.push({
      heartRate: Math.round(base.hr + (Math.random() - 0.5) * variance * 4),
      spo2: Math.min(100, Math.max(70, Math.round(base.spo2 + (Math.random() - 0.5) * variance * 2))),
      respRate: Math.round(base.rr + (Math.random() - 0.5) * variance * 4),
      temperature: parseFloat((base.temp + (Math.random() - 0.5) * 0.3).toFixed(1)),
      fio2: patient.status === 'critical' ? 55 : patient.status === 'warning' ? 35 : 21,
      pi: parseFloat((0.5 + Math.random() * 4).toFixed(1)),
      source: 'monitor',
      recordedAt,
    });
  }

  return vitals;
}

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.alarmAcknowledgment.deleteMany();
  await prisma.alarm.deleteMany();
  await prisma.note.deleteMany();
  await prisma.vital.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create users with higher bcrypt cost factor for security
  const BCRYPT_SALT_ROUNDS = 12;
  const createdUsers = [];
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_SALT_ROUNDS);
    const created = await prisma.user.create({
      data: {
        email: user.email,
        passwordHash,
        fullName: user.fullName,
        role: user.role,
        initials: user.initials,
        active: true,
      },
    });
    createdUsers.push(created);
    console.log(`Created user: ${user.email}`);
  }

  // Create beds
  const createdBeds = [];
  for (const bed of beds) {
    const created = await prisma.bed.create({
      data: bed,
    });
    createdBeds.push(created);
  }
  console.log(`Created ${beds.length} beds`);

  // Create patients with vitals
  for (const patient of patients) {
    // Find the bed
    const bed = createdBeds.find(b => b.bedNumber === patient.bedNumber);

    const createdPatient = await prisma.patient.create({
      data: {
        mrn: patient.mrn,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        gestationalAge: patient.gestationalAge,
        birthWeight: patient.birthWeight,
        currentWeight: patient.currentWeight,
        dayOfLife: patient.dayOfLife,
        bedId: bed?.id,
        status: patient.status,
        admitDate: patient.admitDate,
        alarmLimits: patient.alarmLimits,
      },
    });

    // Generate and create vitals
    const vitals = generateVitals(patient, 50);
    for (const vital of vitals) {
      await prisma.vital.create({
        data: {
          ...vital,
          patientId: createdPatient.id,
        },
      });
    }

    console.log(`Created patient: ${patient.name} with ${vitals.length} vitals`);

    // Create some alarms for warning/critical patients
    if (patient.status === 'critical' || patient.status === 'warning') {
      const alarmType = patient.status === 'critical' ? 'critical' : 'warning';
      await prisma.alarm.create({
        data: {
          patientId: createdPatient.id,
          type: alarmType,
          parameter: 'spo2',
          value: patient.status === 'critical' ? 82 : 87,
          threshold: 88,
          message: `SpO2 ${patient.status === 'critical' ? 'critically low' : 'below target'}`,
          status: 'active',
        },
      });
      console.log(`Created ${alarmType} alarm for ${patient.name}`);
    }
  }

  // Create sample notes
  const patientForNotes = await prisma.patient.findFirst({ where: { mrn: 'MRN-48244' } }); // Critical patient
  const nurseUser = createdUsers.find(u => u.role === 'charge_nurse');

  if (patientForNotes && nurseUser) {
    await prisma.note.create({
      data: {
        patientId: patientForNotes.id,
        authorId: nurseUser.id,
        type: 'nursing',
        content: 'Patient remains on HFOV with high FiO2 requirements. Frequent desaturations requiring stimulation. Blood cultures sent, awaiting results. Family updated on condition.',
      },
    });
    console.log('Created sample note');
  }

  // Create audit log entry
  if (nurseUser) {
    await prisma.auditLog.create({
      data: {
        userId: nurseUser.id,
        action: 'login',
        resource: 'session',
        details: JSON.stringify({ method: 'credentials', userAgent: 'seed-script' }),
      },
    });
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
