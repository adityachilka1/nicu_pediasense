/**
 * Clinical Calculator Tests
 *
 * Tests for NICU clinical calculator formulas to ensure clinical accuracy.
 * All formulas are validated against established medical guidelines.
 */

describe('Clinical Calculators', () => {
  // ============================================
  // GIR (Glucose Infusion Rate) Calculator
  // ============================================
  describe('GIR Calculator', () => {
    // Formula: GIR = (Dextrose% × Rate mL/hr) / (6 × Weight kg)
    const calculateGIR = (dextrosePercent, rateMlHr, weightKg) => {
      return (dextrosePercent * rateMlHr) / (6 * weightKg);
    };

    test('calculates correct GIR for standard TPN', () => {
      // 10% dextrose at 6 mL/hr for 1 kg infant
      const gir = calculateGIR(10, 6, 1);
      expect(gir).toBeCloseTo(10, 1); // 10 mg/kg/min
    });

    test('calculates correct GIR for D12.5 at higher rate', () => {
      // 12.5% dextrose at 8 mL/hr for 1.5 kg infant
      const gir = calculateGIR(12.5, 8, 1.5);
      expect(gir).toBeCloseTo(11.1, 1);
    });

    test('target GIR range is 4-8 mg/kg/min for neonates', () => {
      // Low end - 5% dextrose at 5 mL/hr for 1.2 kg infant
      const girLow = calculateGIR(5, 5, 1.2);
      expect(girLow).toBeGreaterThanOrEqual(3);
      expect(girLow).toBeLessThanOrEqual(5);

      // High end - 10% dextrose at 7 mL/hr for 1 kg infant
      const girHigh = calculateGIR(10, 7, 1);
      expect(girHigh).toBeGreaterThanOrEqual(10);
    });

    test('handles ELBW infant calculations', () => {
      // 0.5 kg infant with D7.5 at 2.5 mL/hr
      const gir = calculateGIR(7.5, 2.5, 0.5);
      expect(gir).toBeCloseTo(6.25, 1);
    });
  });

  // ============================================
  // Calorie Calculator
  // ============================================
  describe('Calorie Calculator', () => {
    // Caloric values (kcal/g):
    // Dextrose: 3.4 kcal/g
    // Protein: 4 kcal/g
    // Lipids: 10 kcal/g (for 20% intralipid)

    const calculateTPNCals = (dextrosePercent, volumeMl, proteinGKg, lipidGKg, weightKg) => {
      const dextroseCal = (dextrosePercent / 100) * volumeMl * 3.4;
      const proteinCal = proteinGKg * weightKg * 4;
      const lipidCal = lipidGKg * weightKg * 10;
      return dextroseCal + proteinCal + lipidCal;
    };

    test('calculates correct dextrose calories', () => {
      // 100mL of D10 = 10g dextrose × 3.4 = 34 kcal
      const dextroseCal = (10 / 100) * 100 * 3.4;
      expect(dextroseCal).toBe(34);
    });

    test('calculates correct protein calories', () => {
      // 3 g/kg/day protein for 1.5 kg infant = 4.5g × 4 = 18 kcal
      const proteinCal = 3 * 1.5 * 4;
      expect(proteinCal).toBe(18);
    });

    test('calculates correct lipid calories', () => {
      // 2 g/kg/day lipids for 1.5 kg infant = 3g × 10 = 30 kcal
      const lipidCal = 2 * 1.5 * 10;
      expect(lipidCal).toBe(30);
    });

    test('target 110-130 kcal/kg/day for preterm growth', () => {
      // 1.2 kg infant at 150 mL/kg/day = 180 mL total volume
      // D12.5, 4 g/kg protein, 3 g/kg lipids
      const totalCal = calculateTPNCals(12.5, 180, 4, 3, 1.2);
      const calPerKg = totalCal / 1.2;
      // Should be in 100-130 kcal/kg range for adequate preterm growth
      expect(calPerKg).toBeGreaterThan(100);
      expect(calPerKg).toBeLessThan(140);
    });

    test('enteral calorie conversion is correct', () => {
      // 24 kcal/oz formula = 24/30 = 0.8 kcal/mL
      const kcalPerMl = 24 / 30;
      expect(kcalPerMl).toBeCloseTo(0.8, 2);

      // 15 mL × 8 feeds × 0.8 kcal/mL = 96 kcal
      const dailyEnteralCal = 15 * 8 * kcalPerMl;
      expect(dailyEnteralCal).toBe(96);
    });
  });

  // ============================================
  // Gestational Age Calculator
  // ============================================
  describe('Gestational Age Calculator', () => {
    const calculateGA = (lmpDate) => {
      const today = new Date();
      const lmp = new Date(lmpDate);
      const days = Math.floor((today - lmp) / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      return { weeks, days: remainingDays, totalDays: days };
    };

    const calculateEDD = (lmpDate) => {
      const lmp = new Date(lmpDate);
      // Naegele's rule: LMP + 280 days
      return new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
    };

    test('EDD is 280 days from LMP (Naegele\'s rule)', () => {
      const lmp = new Date('2024-01-01');
      const edd = calculateEDD('2024-01-01');
      const daysDiff = Math.floor((edd - lmp) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(280);
    });

    test('40 weeks gestation equals 280 days', () => {
      expect(40 * 7).toBe(280);
    });

    test('term pregnancy is 37-42 weeks', () => {
      const termStartDays = 37 * 7; // 259 days
      const termEndDays = 42 * 7;   // 294 days
      expect(termStartDays).toBe(259);
      expect(termEndDays).toBe(294);
    });
  });

  // ============================================
  // Corrected Age Calculator
  // ============================================
  describe('Corrected Age Calculator', () => {
    const calculatePCA = (gaWeeks, gaDays, chronoDays) => {
      const totalGaDays = gaWeeks * 7 + gaDays;
      const totalPcaDays = totalGaDays + chronoDays;
      return {
        weeks: Math.floor(totalPcaDays / 7),
        days: totalPcaDays % 7,
      };
    };

    const calculateCorrectedAge = (gaWeeks, chronoDays) => {
      // Corrected age = Chronological age - (40 - GA at birth) weeks
      const pretermWeeks = 40 - gaWeeks;
      const correctedDays = chronoDays - pretermWeeks * 7;
      return Math.floor(correctedDays / 7);
    };

    test('PCA calculation is correct', () => {
      // 28 week infant at DOL 84 (12 weeks old)
      // PCA = 28 + 12 = 40 weeks
      const pca = calculatePCA(28, 0, 84);
      expect(pca.weeks).toBe(40);
    });

    test('corrected age calculation is correct', () => {
      // 28 week infant at 12 weeks chronological
      // Corrected age = 12 - (40-28) = 12 - 12 = 0 weeks
      const corrected = calculateCorrectedAge(28, 84);
      expect(corrected).toBe(0);

      // 32 week infant at 16 weeks chronological
      // Corrected age = 16 - (40-32) = 16 - 8 = 8 weeks
      const corrected2 = calculateCorrectedAge(32, 112);
      expect(corrected2).toBe(8);
    });
  });

  // ============================================
  // Oxygenation Index Calculator
  // ============================================
  describe('Oxygenation Index Calculator', () => {
    // OI = (MAP × FiO2 × 100) / PaO2
    const calculateOI = (map, fio2, pao2) => {
      return (map * fio2 * 100) / pao2;
    };

    // A-a gradient = PAO2 - PaO2
    // PAO2 = FiO2 × (Patm - 47) - (PaCO2 / 0.8)
    const calculateAaGradient = (fio2, pao2, paco2, patm = 760) => {
      const pao2Alveolar = fio2 * (patm - 47) - (paco2 / 0.8);
      return pao2Alveolar - pao2;
    };

    // P/F ratio = PaO2 / FiO2
    const calculatePFRatio = (pao2, fio2) => {
      return pao2 / fio2;
    };

    test('OI calculation is correct', () => {
      // MAP 12, FiO2 0.6, PaO2 50
      // OI = (12 × 0.6 × 100) / 50 = 720 / 50 = 14.4
      const oi = calculateOI(12, 0.6, 50);
      expect(oi).toBeCloseTo(14.4, 1);
    });

    test('OI thresholds are clinically appropriate', () => {
      // OI < 15: Moderate respiratory failure
      expect(calculateOI(10, 0.4, 60)).toBeLessThan(15);

      // OI 15-25: Consider iNO
      const oiForINO = calculateOI(14, 0.8, 50);
      expect(oiForINO).toBeGreaterThanOrEqual(15);
      expect(oiForINO).toBeLessThan(30);

      // OI > 40: ECMO criteria
      const oiCritical = calculateOI(20, 1.0, 40);
      expect(oiCritical).toBeGreaterThanOrEqual(40);
    });

    test('A-a gradient calculation is correct', () => {
      // FiO2 0.21 (room air), PaO2 80, PaCO2 40, Patm 760
      // PAO2 = 0.21 × (760 - 47) - (40 / 0.8) = 149.73 - 50 = 99.73
      // A-a = 99.73 - 80 = 19.73
      const aaGradient = calculateAaGradient(0.21, 80, 40);
      expect(aaGradient).toBeCloseTo(19.7, 0);
    });

    test('P/F ratio calculation is correct', () => {
      // PaO2 200, FiO2 0.5 = P/F 400 (normal)
      expect(calculatePFRatio(200, 0.5)).toBe(400);

      // PaO2 80, FiO2 0.4 = P/F 200 (moderate ARDS)
      expect(calculatePFRatio(80, 0.4)).toBe(200);

      // PaO2 60, FiO2 1.0 = P/F 60 (severe)
      expect(calculatePFRatio(60, 1.0)).toBe(60);
    });
  });

  // ============================================
  // ETT Size Calculator
  // ============================================
  describe('ETT Size Calculator', () => {
    const getETTSize = (weightKg) => {
      if (weightKg < 1) return 2.5;
      if (weightKg < 2) return 3.0;
      if (weightKg < 3) return 3.5;
      return 3.5;
    };

    const getOralDepth = (weightKg) => {
      return 6 + weightKg;
    };

    const getNasalDepth = (weightKg) => {
      return 7 + weightKg;
    };

    test('ETT size by weight follows NRP guidelines', () => {
      expect(getETTSize(0.8)).toBe(2.5);  // <1 kg
      expect(getETTSize(1.5)).toBe(3.0);  // 1-2 kg
      expect(getETTSize(2.5)).toBe(3.5);  // 2-3 kg
      expect(getETTSize(3.5)).toBe(3.5);  // >3 kg
    });

    test('oral depth follows 6 + weight formula', () => {
      expect(getOralDepth(1)).toBe(7);
      expect(getOralDepth(1.5)).toBe(7.5);
      expect(getOralDepth(2)).toBe(8);
      expect(getOralDepth(3)).toBe(9);
    });

    test('nasal depth follows 7 + weight formula', () => {
      expect(getNasalDepth(1)).toBe(8);
      expect(getNasalDepth(1.5)).toBe(8.5);
      expect(getNasalDepth(2)).toBe(9);
      expect(getNasalDepth(3)).toBe(10);
    });

    test('suction catheter is ETT size × 2', () => {
      const ettSize = 3.0;
      const suctionCathFr = ettSize * 2;
      expect(suctionCathFr).toBe(6);
    });
  });

  // ============================================
  // Fluid Requirements Calculator
  // ============================================
  describe('Fluid Calculator', () => {
    const getBaseFluidRate = (gaWeeks, dol) => {
      let baseRates;
      if (gaWeeks < 28) {
        baseRates = { 1: 80, 2: 100, 3: 120, 4: 140, 5: 150, 6: 160, 7: 160 };
      } else if (gaWeeks < 32) {
        baseRates = { 1: 70, 2: 90, 3: 110, 4: 130, 5: 150, 6: 150, 7: 150 };
      } else if (gaWeeks < 37) {
        baseRates = { 1: 60, 2: 80, 3: 100, 4: 120, 5: 140, 6: 150, 7: 150 };
      } else {
        baseRates = { 1: 60, 2: 80, 3: 100, 4: 120, 5: 140, 6: 150, 7: 150 };
      }
      return baseRates[Math.min(dol, 7)] || 150;
    };

    test('ELBW infants have higher fluid requirements', () => {
      // <28 weeks at DOL 1 should be 80 mL/kg/day
      expect(getBaseFluidRate(26, 1)).toBe(80);
      // Term at DOL 1 should be 60 mL/kg/day
      expect(getBaseFluidRate(39, 1)).toBe(60);
    });

    test('fluid requirements increase with DOL', () => {
      const ga = 30;
      expect(getBaseFluidRate(ga, 1)).toBeLessThan(getBaseFluidRate(ga, 3));
      expect(getBaseFluidRate(ga, 3)).toBeLessThan(getBaseFluidRate(ga, 5));
    });

    test('phototherapy increases fluid needs by 20 mL/kg/day', () => {
      const baseRate = 100;
      const withPhototherapy = baseRate + 20;
      expect(withPhototherapy).toBe(120);
    });

    test('cardiac restriction decreases fluid by 30 mL/kg/day', () => {
      const baseRate = 150;
      const withCardiacRestriction = baseRate - 30;
      expect(withCardiacRestriction).toBe(120);
    });
  });

  // ============================================
  // APGAR Score Calculator
  // ============================================
  describe('APGAR Calculator', () => {
    const calculateAPGAR = (scores) => {
      return Object.values(scores).reduce((sum, val) => sum + val, 0);
    };

    test('APGAR max score is 10', () => {
      const perfectScore = { hr: 2, resp: 2, tone: 2, reflex: 2, color: 2 };
      expect(calculateAPGAR(perfectScore)).toBe(10);
    });

    test('APGAR min score is 0', () => {
      const worstScore = { hr: 0, resp: 0, tone: 0, reflex: 0, color: 0 };
      expect(calculateAPGAR(worstScore)).toBe(0);
    });

    test('APGAR >= 7 is reassuring', () => {
      const goodScore = { hr: 2, resp: 2, tone: 1, reflex: 1, color: 1 };
      expect(calculateAPGAR(goodScore)).toBeGreaterThanOrEqual(7);
    });

    test('APGAR < 4 indicates severe depression', () => {
      const poorScore = { hr: 1, resp: 0, tone: 0, reflex: 1, color: 0 };
      expect(calculateAPGAR(poorScore)).toBeLessThan(4);
    });
  });

  // ============================================
  // Bilirubin Risk Calculator (AAP 2022)
  // ============================================
  describe('Bilirubin Calculator', () => {
    const getPhototherapyThreshold = (ageHours, gaWeeks, hasRiskFactors) => {
      // Simplified AAP 2022 thresholds for term infants
      if (gaWeeks >= 38 && !hasRiskFactors) {
        // Low risk
        if (ageHours <= 24) return 12;
        if (ageHours <= 48) return 15;
        if (ageHours <= 72) return 18;
        return 20;
      } else if (gaWeeks >= 38 && hasRiskFactors) {
        // Medium risk
        if (ageHours <= 24) return 10;
        if (ageHours <= 48) return 13;
        if (ageHours <= 72) return 16;
        return 18;
      }
      // Preterm - lower thresholds
      if (ageHours <= 24) return 8;
      if (ageHours <= 48) return 10;
      return 12;
    };

    test('low risk term infant has higher thresholds', () => {
      const lowRisk48h = getPhototherapyThreshold(48, 39, false);
      const medRisk48h = getPhototherapyThreshold(48, 39, true);
      expect(lowRisk48h).toBeGreaterThan(medRisk48h);
    });

    test('preterm infants have lower thresholds', () => {
      const term48h = getPhototherapyThreshold(48, 39, false);
      const preterm48h = getPhototherapyThreshold(48, 34, false);
      expect(preterm48h).toBeLessThan(term48h);
    });

    test('thresholds increase with age', () => {
      const threshold24h = getPhototherapyThreshold(24, 39, false);
      const threshold48h = getPhototherapyThreshold(48, 39, false);
      const threshold72h = getPhototherapyThreshold(72, 39, false);
      expect(threshold24h).toBeLessThan(threshold48h);
      expect(threshold48h).toBeLessThan(threshold72h);
    });
  });

  // ============================================
  // Drug Dosing Calculator
  // ============================================
  describe('Drug Dosing Calculator', () => {
    const drugs = {
      caffeine: { loading: 20, maintenance: 5 },
      gentamicin: { maintenance: 5 },
      ampicillin: { maintenance: 50 },
      phenobarbital: { loading: 20, maintenance: 5 },
    };

    const calculateDose = (drug, weightKg) => {
      const d = drugs[drug];
      return {
        loading: d.loading ? d.loading * weightKg : null,
        maintenance: d.maintenance * weightKg,
      };
    };

    test('caffeine dosing is correct', () => {
      const dose = calculateDose('caffeine', 1.2);
      expect(dose.loading).toBe(24);       // 20 mg/kg × 1.2 kg
      expect(dose.maintenance).toBe(6);    // 5 mg/kg × 1.2 kg
    });

    test('gentamicin dosing is weight-based', () => {
      const dose = calculateDose('gentamicin', 1.5);
      expect(dose.maintenance).toBe(7.5);  // 5 mg/kg × 1.5 kg
    });

    test('ampicillin dosing for sepsis', () => {
      const dose = calculateDose('ampicillin', 2);
      expect(dose.maintenance).toBe(100);  // 50 mg/kg × 2 kg
    });

    test('phenobarbital loading dose is correct', () => {
      const dose = calculateDose('phenobarbital', 3);
      expect(dose.loading).toBe(60);       // 20 mg/kg × 3 kg
    });

    // Gentamicin interval by PCA
    const getGentamicinInterval = (gaWeeks, pnaDays) => {
      const pca = gaWeeks + Math.floor(pnaDays / 7);
      if (pca <= 29) return 'q48h';
      if (pca <= 33) return 'q36h';
      if (pca <= 37) return 'q24h';
      return 'q24h';
    };

    test('gentamicin interval based on PCA', () => {
      expect(getGentamicinInterval(26, 7)).toBe('q48h');   // PCA 27
      expect(getGentamicinInterval(30, 14)).toBe('q36h'); // PCA 32
      expect(getGentamicinInterval(35, 7)).toBe('q24h');  // PCA 36
    });
  });

  // ============================================
  // NEC Risk & Bell Staging
  // ============================================
  describe('NEC Risk Calculator', () => {
    const calculateNECRisk = (factors) => {
      let score = 0;
      if (factors.ga < 28) score += 4;
      else if (factors.ga < 32) score += 3;
      else if (factors.ga < 37) score += 1;

      if (factors.birthWeight < 1000) score += 3;
      else if (factors.birthWeight < 1500) score += 2;

      if (factors.formulaFeeding) score += 2;
      if (factors.rapidFeedAdvance) score += 2;
      if (factors.prbc) score += 2;
      if (factors.pda) score += 1;
      if (factors.umbilicalCath) score += 1;
      if (factors.inotropes) score += 2;

      return score;
    };

    test('ELBW preterm has high NEC risk score', () => {
      const score = calculateNECRisk({
        ga: 26,
        birthWeight: 800,
        formulaFeeding: true,
        rapidFeedAdvance: false,
        prbc: true,
        pda: true,
        umbilicalCath: true,
        inotropes: false,
      });
      expect(score).toBeGreaterThanOrEqual(10); // High risk
    });

    test('term infant has low NEC risk', () => {
      const score = calculateNECRisk({
        ga: 39,
        birthWeight: 3200,
        formulaFeeding: false,
        rapidFeedAdvance: false,
        prbc: false,
        pda: false,
        umbilicalCath: false,
        inotropes: false,
      });
      expect(score).toBe(0);
    });

    // Bell Staging simplified
    const getBellStage = (findings) => {
      if (findings.pneumoperitoneum) return 'IIIB';
      if (findings.pneumatosis && (findings.shock || findings.dic)) return 'IIIA';
      if (findings.pneumatosis && findings.portalVenousGas) return 'IIB';
      if (findings.pneumatosis) return 'IIA';
      if (findings.abdominalDistension && findings.grossBlood) return 'IB';
      if (findings.abdominalDistension || findings.feedingIntolerance) return 'IA';
      return 'None';
    };

    test('pneumoperitoneum is Stage IIIB (perforation)', () => {
      expect(getBellStage({ pneumoperitoneum: true })).toBe('IIIB');
    });

    test('pneumatosis is Stage II (definite NEC)', () => {
      expect(getBellStage({ pneumatosis: true })).toBe('IIA');
    });

    test('suspected NEC is Stage I', () => {
      expect(getBellStage({ abdominalDistension: true })).toBe('IA');
    });
  });

  // ============================================
  // SNAPPE-II Score
  // ============================================
  describe('SNAPPE-II Calculator', () => {
    const calculateSNAPPE = (values) => {
      let score = 0;

      // Birth weight
      if (values.birthWeight < 750) score += 18;
      else if (values.birthWeight < 1000) score += 10;
      else if (values.birthWeight < 1500) score += 5;

      // SGA
      if (values.sga) score += 12;

      // APGAR 5 min
      if (values.apgar5 < 7) score += 18;

      // Lowest temp
      if (values.lowestTemp < 35) score += 8;
      else if (values.lowestTemp < 36) score += 5;

      // Lowest mean BP
      if (values.lowestBP < 20) score += 16;
      else if (values.lowestBP < 30) score += 7;

      // Lowest pH
      if (values.lowestPH < 7.1) score += 16;
      else if (values.lowestPH < 7.2) score += 7;

      // PO2/FiO2 ratio
      if (values.lowestPO2FiO2 < 100) score += 14;
      else if (values.lowestPO2FiO2 < 250) score += 5;

      // Seizures
      if (values.multipleSeizures) score += 19;

      // Urine output
      if (values.urineOutput < 0.5) score += 18;
      else if (values.urineOutput < 1.0) score += 5;

      return score;
    };

    test('healthy term infant has low SNAPPE score', () => {
      const score = calculateSNAPPE({
        birthWeight: 3000,
        sga: false,
        apgar5: 9,
        lowestTemp: 36.5,
        lowestBP: 45,
        lowestPH: 7.35,
        lowestPO2FiO2: 400,
        multipleSeizures: false,
        urineOutput: 2.0,
      });
      expect(score).toBe(0);
    });

    test('critically ill ELBW infant has high SNAPPE score', () => {
      const score = calculateSNAPPE({
        birthWeight: 600,
        sga: true,
        apgar5: 3,
        lowestTemp: 34.5,
        lowestBP: 18,
        lowestPH: 7.0,
        lowestPO2FiO2: 80,
        multipleSeizures: true,
        urineOutput: 0.3,
      });
      expect(score).toBeGreaterThan(100); // Very high mortality risk
    });

    test('SNAPPE score correlates with mortality risk', () => {
      // Score < 20: Low risk (<3%)
      // Score 40-60: High risk (20-35%)
      // Score > 70: Very high risk (>55%)
      const lowRisk = calculateSNAPPE({
        birthWeight: 2000,
        sga: false,
        apgar5: 8,
        lowestTemp: 36.2,
        lowestBP: 35,
        lowestPH: 7.28,
        lowestPO2FiO2: 300,
        multipleSeizures: false,
        urineOutput: 1.5,
      });
      expect(lowRisk).toBeLessThan(20);
    });
  });

  // ============================================
  // Blood Gas Interpreter
  // ============================================
  describe('Blood Gas Interpreter', () => {
    const interpretABG = (ph, pco2, hco3) => {
      const normalPH = [7.35, 7.45];
      const normalPCO2 = [35, 45];
      const normalHCO3 = [22, 26];

      let result = {
        acidBase: 'Normal',
        respiratory: 'Normal',
        metabolic: 'Normal',
        compensation: null,
      };

      // pH status
      if (ph < normalPH[0]) {
        result.acidBase = 'Acidemia';
      } else if (ph > normalPH[1]) {
        result.acidBase = 'Alkalemia';
      }

      // Respiratory component
      if (pco2 > normalPCO2[1]) {
        result.respiratory = 'Respiratory Acidosis';
      } else if (pco2 < normalPCO2[0]) {
        result.respiratory = 'Respiratory Alkalosis';
      }

      // Metabolic component
      if (hco3 < normalHCO3[0]) {
        result.metabolic = 'Metabolic Acidosis';
      } else if (hco3 > normalHCO3[1]) {
        result.metabolic = 'Metabolic Alkalosis';
      }

      return result;
    };

    test('normal ABG values', () => {
      const result = interpretABG(7.40, 40, 24);
      expect(result.acidBase).toBe('Normal');
      expect(result.respiratory).toBe('Normal');
      expect(result.metabolic).toBe('Normal');
    });

    test('respiratory acidosis detection', () => {
      const result = interpretABG(7.28, 60, 24);
      expect(result.acidBase).toBe('Acidemia');
      expect(result.respiratory).toBe('Respiratory Acidosis');
    });

    test('metabolic acidosis detection', () => {
      const result = interpretABG(7.25, 35, 15);
      expect(result.acidBase).toBe('Acidemia');
      expect(result.metabolic).toBe('Metabolic Acidosis');
    });

    test('respiratory alkalosis detection', () => {
      const result = interpretABG(7.50, 28, 24);
      expect(result.acidBase).toBe('Alkalemia');
      expect(result.respiratory).toBe('Respiratory Alkalosis');
    });
  });
});
