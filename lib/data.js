// Shared patient data and utilities for NICU Dashboard

// === SpO2 TARGET RANGES (Evidence-Based) ===
// Based on SUPPORT, BOOST-II, and COT trials (>5000 infants <1250g)
// - Targeting 85-89%: Higher mortality, higher NEC
// - Targeting 91-95%: Higher ROP, lower mortality
// Recommended targets by GA:
//   <32 weeks (ELBW/VLBW): 88-95% (balance mortality vs ROP risk)
//   32-37 weeks (preterm):  88-98%
//   ≥37 weeks (term):       92-100%
// Reference: Askie LM et al. Lancet 2018; doi:10.1016/S0140-6736(18)31554-0

// === IEC 60601-1-8 COLOR STANDARDS ===
// Reference: IEC 60601-1-8:2006+AMD1:2012+AMD2:2020
// Medical electrical equipment - Part 1-8: General requirements for basic safety
// and essential performance - Collateral Standard: General requirements, tests and
// guidance for alarm systems in medical electrical equipment and medical electrical systems
export const COLORS = {
  spo2: '#00FFFF',      // Cyan - SpO2/Pleth (IEC standard for pulse oximetry)
  pr: '#00FF00',        // Green - Pulse Rate (cardiac parameters)
  prFromSpo2: '#00FFFF', // Cyan when PR derived from pleth (source indicator)
  rr: '#FFFF00',        // Yellow - Respiratory parameters
  temp: '#FF99FF',      // Magenta/Pink - Temperature
  fio2: '#FFFFFF',      // White - General/Delivered O2
  alarm: '#FF0000',     // Red - High priority alarm (crisis)
  warning: '#FFFF00',   // Yellow - Medium priority alarm (warning)
  advisory: '#00FFFF',  // Cyan - Low priority alarm (advisory)
};

// === MEDICAL REFERENCE RANGES (Neonatal) ===
// Reference: AAP Guidelines, NRP 8th Edition, WHO Standards
export const NEONATAL_REFERENCE_RANGES = {
  // Pulse Oximetry SpO2 - varies by GA per SUPPORT/BOOST-II/COT trials
  spo2: {
    microPreemie: { min: 88, max: 95, target: [90, 94] },    // <28 weeks
    veryPreterm: { min: 88, max: 95, target: [90, 95] },     // 28-32 weeks
    moderatePreterm: { min: 88, max: 98, target: [92, 97] }, // 32-37 weeks
    term: { min: 92, max: 100, target: [95, 100] },          // ≥37 weeks
  },
  // Heart Rate (BPM) - based on GA and state
  heartRate: {
    preterm: { min: 100, max: 180, alarmLow: 80, alarmHigh: 200 },
    term: { min: 100, max: 160, alarmLow: 80, alarmHigh: 180 },
    bradycardia: 100, // Definition per AAP
    tachycardia: 180,
  },
  // Respiratory Rate (breaths/min)
  respiratoryRate: {
    preterm: { min: 30, max: 60, alarmLow: 20, alarmHigh: 70 },
    term: { min: 30, max: 60, alarmLow: 20, alarmHigh: 70 },
    apnea: 20, // Cessation >20 seconds
  },
  // Temperature (°C) - WHO thermal care standards
  temperature: {
    coldStress: 36.0,
    normal: { min: 36.5, max: 37.5 },
    fever: 38.0,
    hyperthermia: 38.5,
    hypothermia: { mild: 36.0, moderate: 32.0, severe: 28.0 },
  },
  // Blood Pressure (mmHg) - varies significantly by weight/GA
  bloodPressure: {
    // MAP ≈ GA in weeks (rough guide)
    mapByGA: (gaWeeks) => gaWeeks, // Minimum acceptable MAP
  },
};

// === FENTON GROWTH CHART REFERENCE DATA ===
// Reference: Fenton TR, Kim JH. A systematic review and meta-analysis to revise
// the Fenton growth chart for preterm infants. BMC Pediatr. 2013;13:59.
// Percentile curves for weight (grams), length (cm), and head circumference (cm)
// Data points at gestational age weeks 22-50
export const FENTON_PERCENTILES = {
  male: {
    weight: {
      // GA weeks: { p3, p10, p50, p90, p97 }
      22: { p3: 388, p10: 429, p50: 530, p90: 654, p97: 720 },
      24: { p3: 465, p10: 530, p50: 691, p90: 900, p97: 1015 },
      26: { p3: 580, p10: 674, p50: 908, p90: 1222, p97: 1402 },
      28: { p3: 736, p10: 869, p50: 1198, p90: 1653, p97: 1920 },
      30: { p3: 951, p10: 1132, p50: 1580, p90: 2207, p97: 2575 },
      32: { p3: 1231, p10: 1474, p50: 2066, p90: 2895, p97: 3381 },
      34: { p3: 1576, p10: 1890, p50: 2650, p90: 3709, p97: 4326 },
      36: { p3: 1970, p10: 2365, p50: 3310, p90: 4618, p97: 5380 },
      38: { p3: 2388, p10: 2865, p50: 3999, p90: 5563, p97: 6474 },
      40: { p3: 2790, p10: 3340, p50: 4650, p90: 6450, p97: 7490 },
    },
    length: {
      22: { p3: 25.0, p10: 26.0, p50: 28.5, p90: 31.0, p97: 32.5 },
      24: { p3: 28.0, p10: 29.5, p50: 32.0, p90: 35.0, p97: 36.5 },
      26: { p3: 31.0, p10: 32.5, p50: 35.5, p90: 38.5, p97: 40.5 },
      28: { p3: 33.5, p10: 35.5, p50: 38.5, p90: 42.0, p97: 44.0 },
      30: { p3: 36.0, p10: 38.0, p50: 41.5, p90: 45.0, p97: 47.0 },
      32: { p3: 38.5, p10: 40.5, p50: 44.0, p90: 48.0, p97: 50.0 },
      34: { p3: 41.0, p10: 43.0, p50: 46.5, p90: 50.5, p97: 52.5 },
      36: { p3: 43.5, p10: 45.5, p50: 49.0, p90: 53.0, p97: 55.0 },
      38: { p3: 46.0, p10: 48.0, p50: 51.5, p90: 55.0, p97: 57.0 },
      40: { p3: 48.0, p10: 50.0, p50: 53.5, p90: 57.0, p97: 59.0 },
    },
    headCircumference: {
      22: { p3: 18.0, p10: 18.8, p50: 20.5, p90: 22.2, p97: 23.0 },
      24: { p3: 20.0, p10: 21.0, p50: 23.0, p90: 25.0, p97: 26.0 },
      26: { p3: 21.8, p10: 23.0, p50: 25.2, p90: 27.5, p97: 28.5 },
      28: { p3: 23.5, p10: 24.8, p50: 27.2, p90: 29.8, p97: 30.8 },
      30: { p3: 25.2, p10: 26.5, p50: 29.2, p90: 32.0, p97: 33.2 },
      32: { p3: 26.8, p10: 28.2, p50: 31.0, p90: 34.0, p97: 35.2 },
      34: { p3: 28.5, p10: 30.0, p50: 32.8, p90: 35.8, p97: 37.0 },
      36: { p3: 30.0, p10: 31.5, p50: 34.5, p90: 37.5, p97: 38.8 },
      38: { p3: 31.5, p10: 33.0, p50: 36.0, p90: 39.0, p97: 40.2 },
      40: { p3: 32.8, p10: 34.2, p50: 37.2, p90: 40.2, p97: 41.5 },
    },
  },
  female: {
    weight: {
      22: { p3: 360, p10: 398, p50: 496, p90: 618, p97: 682 },
      24: { p3: 430, p10: 492, p50: 648, p90: 854, p97: 968 },
      26: { p3: 534, p10: 624, p50: 856, p90: 1172, p97: 1356 },
      28: { p3: 676, p10: 802, p50: 1128, p90: 1588, p97: 1860 },
      30: { p3: 870, p10: 1044, p50: 1490, p90: 2126, p97: 2500 },
      32: { p3: 1124, p10: 1360, p50: 1954, p90: 2808, p97: 3310 },
      34: { p3: 1440, p10: 1750, p50: 2516, p90: 3616, p97: 4260 },
      36: { p3: 1810, p10: 2200, p50: 3162, p90: 4536, p97: 5342 },
      38: { p3: 2210, p10: 2684, p50: 3850, p90: 5508, p97: 6482 },
      40: { p3: 2600, p10: 3150, p50: 4500, p90: 6420, p97: 7540 },
    },
    length: {
      22: { p3: 24.5, p10: 25.5, p50: 28.0, p90: 30.5, p97: 32.0 },
      24: { p3: 27.5, p10: 29.0, p50: 31.5, p90: 34.5, p97: 36.0 },
      26: { p3: 30.5, p10: 32.0, p50: 35.0, p90: 38.0, p97: 40.0 },
      28: { p3: 33.0, p10: 35.0, p50: 38.0, p90: 41.5, p97: 43.5 },
      30: { p3: 35.5, p10: 37.5, p50: 41.0, p90: 44.5, p97: 46.5 },
      32: { p3: 38.0, p10: 40.0, p50: 43.5, p90: 47.5, p97: 49.5 },
      34: { p3: 40.5, p10: 42.5, p50: 46.0, p90: 50.0, p97: 52.0 },
      36: { p3: 43.0, p10: 45.0, p50: 48.5, p90: 52.5, p97: 54.5 },
      38: { p3: 45.5, p10: 47.5, p50: 51.0, p90: 54.5, p97: 56.5 },
      40: { p3: 47.5, p10: 49.5, p50: 53.0, p90: 56.5, p97: 58.5 },
    },
    headCircumference: {
      22: { p3: 17.8, p10: 18.5, p50: 20.2, p90: 21.8, p97: 22.5 },
      24: { p3: 19.8, p10: 20.8, p50: 22.8, p90: 24.8, p97: 25.8 },
      26: { p3: 21.5, p10: 22.8, p50: 25.0, p90: 27.2, p97: 28.2 },
      28: { p3: 23.2, p10: 24.5, p50: 27.0, p90: 29.5, p97: 30.5 },
      30: { p3: 25.0, p10: 26.2, p50: 29.0, p90: 31.8, p97: 32.8 },
      32: { p3: 26.5, p10: 28.0, p50: 30.8, p90: 33.8, p97: 35.0 },
      34: { p3: 28.2, p10: 29.8, p50: 32.5, p90: 35.5, p97: 36.8 },
      36: { p3: 29.8, p10: 31.2, p50: 34.2, p90: 37.2, p97: 38.5 },
      38: { p3: 31.2, p10: 32.8, p50: 35.8, p90: 38.8, p97: 40.0 },
      40: { p3: 32.5, p10: 34.0, p50: 37.0, p90: 40.0, p97: 41.2 },
    },
  },
};

// Helper function to get percentile for a given GA and measurement
export const getFentonPercentile = (gender, measurementType, gaWeeks, value) => {
  const genderData = FENTON_PERCENTILES[gender]?.[measurementType];
  if (!genderData) return null;

  // Find closest GA week
  const availableWeeks = Object.keys(genderData).map(Number);
  const closestWeek = availableWeeks.reduce((prev, curr) =>
    Math.abs(curr - gaWeeks) < Math.abs(prev - gaWeeks) ? curr : prev
  );

  const percentiles = genderData[closestWeek];
  if (!percentiles) return null;

  // Determine percentile range
  if (value <= percentiles.p3) return '<3rd';
  if (value <= percentiles.p10) return '3-10th';
  if (value <= percentiles.p50) return '10-50th';
  if (value <= percentiles.p90) return '50-90th';
  if (value <= percentiles.p97) return '90-97th';
  return '>97th';
};

// === PATIENT DATA ===
// === NEC (Necrotizing Enterocolitis) RISK CALCULATOR ===
// Based on modified Bell staging criteria and GutCheck NEC risk factors
// Reference: Bell MJ et al. Ann Surg. 1978;187(1):1-7
// Risk factors validated in Gordon PV et al. J Perinatol. 2020
export const calculateNECRisk = (patient, feedingData = {}) => {
  let riskScore = 0;
  const riskFactors = [];

  // Gestational age risk (major factor)
  if (patient.gaWeeks < 28) {
    riskScore += 3;
    riskFactors.push({ factor: 'Extreme prematurity (<28 weeks)', weight: 3 });
  } else if (patient.gaWeeks < 32) {
    riskScore += 2;
    riskFactors.push({ factor: 'Very preterm (28-32 weeks)', weight: 2 });
  } else if (patient.gaWeeks < 34) {
    riskScore += 1;
    riskFactors.push({ factor: 'Moderate preterm (32-34 weeks)', weight: 1 });
  }

  // Birth weight risk
  if (patient.birthWeight < 1.0) {
    riskScore += 3;
    riskFactors.push({ factor: 'ELBW (<1000g)', weight: 3 });
  } else if (patient.birthWeight < 1.5) {
    riskScore += 2;
    riskFactors.push({ factor: 'VLBW (<1500g)', weight: 2 });
  }

  // Formula feeding (vs breast milk)
  if (feedingData.milkType === 'Formula') {
    riskScore += 2;
    riskFactors.push({ factor: 'Formula feeding (no breast milk)', weight: 2 });
  } else if (feedingData.milkType === 'Donor') {
    riskScore += 1;
    riskFactors.push({ factor: 'Donor milk (vs own mother\'s milk)', weight: 1 });
  }

  // Rapid feed advancement (>30 mL/kg/day)
  if (feedingData.advancementRate > 30) {
    riskScore += 2;
    riskFactors.push({ factor: 'Rapid feed advancement (>30 mL/kg/day)', weight: 2 });
  } else if (feedingData.advancementRate > 20) {
    riskScore += 1;
    riskFactors.push({ factor: 'Moderate feed advancement (20-30 mL/kg/day)', weight: 1 });
  }

  // PDA (hemodynamically significant)
  if (patient.diagnosis?.some(d => d.toLowerCase().includes('pda'))) {
    riskScore += 1;
    riskFactors.push({ factor: 'Patent Ductus Arteriosus', weight: 1 });
  }

  // Sepsis
  if (patient.diagnosis?.some(d => d.toLowerCase().includes('sepsis'))) {
    riskScore += 2;
    riskFactors.push({ factor: 'Sepsis/suspected sepsis', weight: 2 });
  }

  // Blood transfusion in last 48h
  if (feedingData.recentTransfusion) {
    riskScore += 2;
    riskFactors.push({ factor: 'Recent blood transfusion (<48h)', weight: 2 });
  }

  // Feeding intolerance
  if (feedingData.feedingIntolerance) {
    riskScore += 2;
    riskFactors.push({ factor: 'Feeding intolerance (residuals/emesis)', weight: 2 });
  }

  // Calculate risk level
  let riskLevel, riskColor, recommendation;
  if (riskScore >= 8) {
    riskLevel = 'HIGH';
    riskColor = 'red';
    recommendation = 'Consider holding feeds, close monitoring for NEC signs';
  } else if (riskScore >= 5) {
    riskLevel = 'MODERATE';
    riskColor = 'yellow';
    recommendation = 'Advance feeds cautiously (10-15 mL/kg/day), monitor closely';
  } else if (riskScore >= 2) {
    riskLevel = 'LOW-MODERATE';
    riskColor = 'amber';
    recommendation = 'Standard advancement (15-20 mL/kg/day) appropriate';
  } else {
    riskLevel = 'LOW';
    riskColor = 'green';
    recommendation = 'Standard or faster advancement (20-30 mL/kg/day) may be appropriate';
  }

  return {
    score: riskScore,
    maxScore: 18,
    riskLevel,
    riskColor,
    riskFactors,
    recommendation,
    suggestedAdvancement: riskScore >= 8 ? 0 : riskScore >= 5 ? 15 : riskScore >= 2 ? 20 : 30,
  };
};

export const initialPatients = [
  {
    id: 1,
    bed: '01',
    mrn: 'MRN-48210',
    name: 'THOMPSON, BABY',
    firstName: 'Baby',
    lastName: 'Thompson',
    gender: 'F',
    dob: '2024-12-21',
    ga: '32+4',
    gaWeeks: 32,
    gaDays: 4,
    weight: 1.82,
    birthWeight: 1.65,
    dol: 8,
    status: 'normal',
    basePR: 145,
    baseSPO2: 96,
    baseRR: 42,
    baseTemp: 36.8,
    baseBP: { systolic: 62, diastolic: 38, map: 46 },
    fio2: 21,
    apnea: 0,
    brady: 0,
    alarmSilenced: 0,
    limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] },
    admitDate: '2024-12-21T14:30:00',
    attendingPhysician: 'Dr. Sarah Chen',
    primaryNurse: 'RN Jessica Moore',
    diagnosis: ['Prematurity', 'RDS - Resolved'],
    feedingType: 'NGT',
    feedingVolume: 45,
    feedingFrequency: 'q3h',
    ventilation: 'Room Air',
    ivAccess: 'PICC Line',
    medications: ['Caffeine citrate 10mg daily', 'Vitamin D 400IU daily'],
    notes: 'Stable, advancing feeds well. Plan to transition to PO feeds.',
  },
  { 
    id: 2, 
    bed: '02', 
    mrn: 'MRN-48222', 
    name: 'MARTINEZ, BABY', 
    firstName: 'Baby',
    lastName: 'Martinez',
    gender: 'M',
    dob: '2024-12-15',
    ga: '28+2', 
    gaWeeks: 28,
    gaDays: 2,
    weight: 1.12,
    birthWeight: 0.98,
    dol: 14, 
    status: 'warning',
    basePR: 167,
    baseSPO2: 90,
    baseRR: 58,
    baseTemp: 37.2,
    baseBP: { systolic: 48, diastolic: 28, map: 35 },
    fio2: 35, 
    apnea: 3, 
    brady: 2, 
    alarmSilenced: 0, 
    limits: { spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }, // ELBW: 88-95% per SUPPORT/BOOST/COT trials
    admitDate: '2024-12-15T08:15:00',
    attendingPhysician: 'Dr. Michael Roberts',
    primaryNurse: 'RN Amanda Clark',
    diagnosis: ['Extreme Prematurity', 'BPD', 'Apnea of Prematurity'],
    feedingType: 'TPN + Trophic',
    feedingVolume: 15,
    feedingFrequency: 'q3h',
    ventilation: 'CPAP 6cm',
    ivAccess: 'UVC, UAC',
    medications: ['Caffeine citrate 15mg daily', 'Vitamin D 400IU daily', 'Iron supplement'],
    notes: 'Frequent desats with feeds. A/B spells improving. Continue CPAP weaning trial.',
  },
  { 
    id: 3, 
    bed: '03', 
    mrn: 'MRN-48233', 
    name: 'CHEN, BABY', 
    firstName: 'Baby',
    lastName: 'Chen',
    gender: 'F',
    dob: '2024-12-24',
    ga: '34+0', 
    gaWeeks: 34,
    gaDays: 0,
    weight: 2.15,
    birthWeight: 2.08,
    dol: 5, 
    status: 'normal',
    basePR: 138,
    baseSPO2: 98,
    baseRR: 38,
    baseTemp: 36.6,
    baseBP: { systolic: 58, diastolic: 35, map: 43 },
    fio2: 21,
    apnea: 0,
    brady: 0,
    alarmSilenced: 0,
    limits: { spo2: [90, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] },
    admitDate: '2024-12-24T22:45:00',
    attendingPhysician: 'Dr. Sarah Chen',
    primaryNurse: 'RN David Park',
    diagnosis: ['Late Preterm', 'Hypoglycemia - Resolved'],
    feedingType: 'PO/Breast',
    feedingVolume: 55,
    feedingFrequency: 'On demand',
    ventilation: 'Room Air',
    ivAccess: 'None',
    medications: ['Vitamin D 400IU daily'],
    notes: 'Ready for discharge pending car seat test. Mom rooming in.',
  },
  { 
    id: 4, 
    bed: '04', 
    mrn: 'MRN-48244', 
    name: 'WILLIAMS, BABY', 
    firstName: 'Baby',
    lastName: 'Williams',
    gender: 'M',
    dob: '2024-12-08',
    ga: '26+5', 
    gaWeeks: 26,
    gaDays: 5,
    weight: 0.89,
    birthWeight: 0.72,
    dol: 21, 
    status: 'critical',
    basePR: 185,
    baseSPO2: 84,
    baseRR: 72,
    baseTemp: 38.1,
    baseBP: { systolic: 42, diastolic: 24, map: 30 },
    fio2: 55, 
    apnea: 8, 
    brady: 5, 
    alarmSilenced: 0, 
    limits: { spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }, // Micro preemie: 88-95% per SUPPORT/BOOST/COT trials
    admitDate: '2024-12-08T03:20:00',
    attendingPhysician: 'Dr. Michael Roberts',
    primaryNurse: 'RN Jennifer Adams',
    diagnosis: ['Micro Preemie', 'Severe BPD', 'PDA', 'Sepsis - Suspected'],
    feedingType: 'NPO',
    feedingVolume: 0,
    feedingFrequency: 'NPO',
    ventilation: 'HFOV',
    ivAccess: 'UVC, UAC, PICC',
    medications: ['Vancomycin', 'Gentamicin', 'Caffeine citrate', 'Dopamine 5mcg/kg/min', 'Hydrocortisone'],
    notes: 'CRITICAL: Deteriorating. Blood cultures pending. CXR shows worsening infiltrates. Family updated.',
  },
  { 
    id: 5, 
    bed: '05', 
    mrn: 'MRN-48255', 
    name: 'JOHNSON, BABY', 
    firstName: 'Baby',
    lastName: 'Johnson',
    gender: 'F',
    dob: '2024-12-18',
    ga: '31+1', 
    gaWeeks: 31,
    gaDays: 1,
    weight: 1.54,
    birthWeight: 1.42,
    dol: 11, 
    status: 'normal',
    basePR: 142,
    baseSPO2: 95,
    baseRR: 44,
    baseTemp: 36.7,
    baseBP: { systolic: 52, diastolic: 32, map: 39 },
    fio2: 25, 
    apnea: 1, 
    brady: 0, 
    alarmSilenced: 0, 
    limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] },
    admitDate: '2024-12-18T11:00:00',
    attendingPhysician: 'Dr. Lisa Wong',
    primaryNurse: 'RN Maria Santos',
    diagnosis: ['Prematurity', 'RDS', 'Anemia of Prematurity'],
    feedingType: 'NGT',
    feedingVolume: 38,
    feedingFrequency: 'q3h',
    ventilation: 'Low Flow O2 0.5L',
    ivAccess: 'PICC Line',
    medications: ['Caffeine citrate', 'Vitamin D', 'EPO'],
    notes: 'Weaning O2. Transfusion given yesterday. Hgb recheck tomorrow.',
  },
  { 
    id: 6, 
    bed: '06', 
    mrn: 'MRN-48266', 
    name: 'BROWN, BABY', 
    firstName: 'Baby',
    lastName: 'Brown',
    gender: 'M',
    dob: '2024-12-20',
    ga: '29+6', 
    gaWeeks: 29,
    gaDays: 6,
    weight: 1.28,
    birthWeight: 1.18,
    dol: 9, 
    status: 'warning',
    basePR: 158,
    baseSPO2: 89,
    baseRR: 56,
    baseTemp: 37.0,
    baseBP: { systolic: 50, diastolic: 30, map: 37 },
    fio2: 40, 
    apnea: 4, 
    brady: 2, 
    alarmSilenced: 90, 
    limits: { spo2: [88, 95], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] }, // Very preterm <30w: 88-95% per SUPPORT/BOOST/COT trials
    admitDate: '2024-12-20T16:30:00',
    attendingPhysician: 'Dr. Lisa Wong',
    primaryNurse: 'RN Kevin O\'Brien',
    diagnosis: ['Prematurity', 'RDS', 'Apnea of Prematurity', 'PDA - Small'],
    feedingType: 'NGT',
    feedingVolume: 28,
    feedingFrequency: 'q3h',
    ventilation: 'NIPPV',
    ivAccess: 'PICC Line',
    medications: ['Caffeine citrate 12mg daily', 'Vitamin D', 'Ibuprofen (for PDA)'],
    notes: 'On ibuprofen course for PDA. Echo scheduled tomorrow. Alarms silenced per RN request - frequent false alarms during cares.',
  },
  { 
    id: 7, 
    bed: '07', 
    mrn: 'MRN-48277', 
    name: 'DAVIS, BABY', 
    firstName: 'Baby',
    lastName: 'Davis',
    gender: 'F',
    dob: '2024-12-26',
    ga: '35+2', 
    gaWeeks: 35,
    gaDays: 2,
    weight: 2.34,
    birthWeight: 2.34,
    dol: 3, 
    status: 'normal',
    basePR: 134,
    baseSPO2: 97,
    baseRR: 36,
    baseTemp: 36.5,
    baseBP: { systolic: 60, diastolic: 36, map: 44 },
    fio2: 21,
    apnea: 0,
    brady: 0,
    alarmSilenced: 0,
    limits: { spo2: [90, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] },
    admitDate: '2024-12-26T09:15:00',
    attendingPhysician: 'Dr. Sarah Chen',
    primaryNurse: 'RN Jessica Moore',
    diagnosis: ['Late Preterm', 'Feeding Difficulty'],
    feedingType: 'Breast + Supplement',
    feedingVolume: 50,
    feedingFrequency: 'q3h',
    ventilation: 'Room Air',
    ivAccess: 'PIV',
    medications: ['Vitamin D 400IU daily'],
    notes: 'Working on breastfeeding with lactation consultant. Supplement volume decreasing.',
  },
  { 
    id: 8, 
    bed: '08', 
    mrn: 'MRN-48288', 
    name: 'GARCIA, BABY', 
    firstName: 'Baby',
    lastName: 'Garcia',
    gender: 'M',
    dob: '2024-12-22',
    ga: '30+3', 
    gaWeeks: 30,
    gaDays: 3,
    weight: 1.45,
    birthWeight: 1.32,
    dol: 7, 
    status: 'normal',
    basePR: 148,
    baseSPO2: 94,
    baseRR: 46,
    baseTemp: 36.9,
    baseBP: { systolic: 54, diastolic: 32, map: 39 },
    fio2: 28, 
    apnea: 1, 
    brady: 1, 
    alarmSilenced: 0, 
    limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70], temp: [36.0, 38.0] },
    admitDate: '2024-12-22T20:00:00',
    attendingPhysician: 'Dr. Michael Roberts',
    primaryNurse: 'RN Amanda Clark',
    diagnosis: ['Prematurity', 'RDS - Improving', 'Hyperbilirubinemia'],
    feedingType: 'NGT',
    feedingVolume: 32,
    feedingFrequency: 'q3h',
    ventilation: 'High Flow 3L',
    ivAccess: 'PICC Line',
    medications: ['Caffeine citrate', 'Vitamin D'],
    notes: 'Off phototherapy. Bili stable. Continue weaning respiratory support.',
  },
];

// Generate random vitals based on patient baseline
export const generateVitals = (patient) => {
  const variance = patient.status === 'critical' ? 5 : patient.status === 'warning' ? 2.5 : 1;
  return {
    pr: Math.round(patient.basePR + (Math.random() - 0.5) * variance * 2),
    spo2: Math.min(100, Math.max(0, Math.round(patient.baseSPO2 + (Math.random() - 0.5) * variance))),
    rr: Math.round(patient.baseRR + (Math.random() - 0.5) * variance * 2),
    temp: (patient.baseTemp + (Math.random() - 0.5) * 0.15).toFixed(1),
    fio2: patient.fio2,
    pi: (0.5 + Math.random() * 4).toFixed(1),
  };
};

// Generate trend data for charts
export const generateTrendData = (hours = 24, baseValue, variance = 5) => {
  const data = [];
  const now = Date.now();
  const interval = (hours * 60 * 60 * 1000) / 288; // 5-minute intervals
  
  for (let i = 288; i >= 0; i--) {
    const timestamp = new Date(now - (i * interval));
    const value = baseValue + (Math.random() - 0.5) * variance * 2;
    data.push({
      time: timestamp.toISOString(),
      value: Math.round(value * 10) / 10,
    });
  }
  return data;
};

// Alarm history mock data
export const alarmHistory = [
  { id: 1, patientId: 4, bed: '04', type: 'critical', param: 'SpO₂', value: 78, limit: 85, timestamp: '2024-12-29T18:45:00', acknowledged: true, acknowledgedBy: 'RN Adams' },
  { id: 2, patientId: 4, bed: '04', type: 'critical', param: 'PR', value: 198, limit: 180, timestamp: '2024-12-29T18:42:00', acknowledged: true, acknowledgedBy: 'RN Adams' },
  { id: 3, patientId: 2, bed: '02', type: 'warning', param: 'SpO₂', value: 86, limit: 88, timestamp: '2024-12-29T18:30:00', acknowledged: true, acknowledgedBy: 'RN Clark' },
  { id: 4, patientId: 6, bed: '06', type: 'warning', param: 'RR', value: 68, limit: 70, timestamp: '2024-12-29T18:15:00', acknowledged: false, acknowledgedBy: null },
  { id: 5, patientId: 4, bed: '04', type: 'critical', param: 'TEMP', value: 38.6, limit: 38.0, timestamp: '2024-12-29T17:50:00', acknowledged: true, acknowledgedBy: 'Dr. Roberts' },
  { id: 6, patientId: 2, bed: '02', type: 'apnea', param: 'Apnea', value: '22s', limit: '20s', timestamp: '2024-12-29T17:30:00', acknowledged: true, acknowledgedBy: 'RN Clark' },
  { id: 7, patientId: 6, bed: '06', type: 'brady', param: 'Brady', value: 72, limit: 80, timestamp: '2024-12-29T17:15:00', acknowledged: true, acknowledgedBy: 'RN O\'Brien' },
  { id: 8, patientId: 4, bed: '04', type: 'critical', param: 'SpO₂', value: 75, limit: 85, timestamp: '2024-12-29T16:45:00', acknowledged: true, acknowledgedBy: 'RN Adams' },
];

// Staff list
export const staffList = [
  { id: 1, name: 'Dr. Sarah Chen', role: 'Attending Neonatologist', shift: 'Day', onDuty: true },
  { id: 2, name: 'Dr. Michael Roberts', role: 'Attending Neonatologist', shift: 'Day', onDuty: true },
  { id: 3, name: 'Dr. Lisa Wong', role: 'Fellow', shift: 'Day', onDuty: true },
  { id: 4, name: 'RN Jessica Moore', role: 'Charge Nurse', shift: 'Day', onDuty: true },
  { id: 5, name: 'RN Amanda Clark', role: 'Staff Nurse', shift: 'Day', onDuty: true },
  { id: 6, name: 'RN David Park', role: 'Staff Nurse', shift: 'Day', onDuty: true },
  { id: 7, name: 'RN Jennifer Adams', role: 'Staff Nurse', shift: 'Day', onDuty: true },
  { id: 8, name: 'RN Maria Santos', role: 'Staff Nurse', shift: 'Day', onDuty: true },
  { id: 9, name: 'RN Kevin O\'Brien', role: 'Staff Nurse', shift: 'Day', onDuty: true },
];

// Format time ago
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return then.toLocaleDateString();
};

// Get status color
export const getStatusColor = (status) => {
  switch (status) {
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  }
};

export const getStatusBgColor = (status) => {
  switch (status) {
    case 'critical': return 'bg-red-900/50';
    case 'warning': return 'bg-yellow-900/30';
    default: return 'bg-slate-800/50';
  }
};
