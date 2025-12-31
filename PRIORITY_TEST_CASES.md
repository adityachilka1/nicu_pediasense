# NICU Dashboard - Priority Test Cases
**Medical Application - Critical Test Specifications**

---

## PRIORITY 1: CRITICAL - Patient Safety (MUST IMPLEMENT IMMEDIATELY)

---

### 1. Drug Dosing Calculator - CRITICAL SEVERITY

#### Test File: `/tests/unit/calculators/drug-dosing.test.js`

**Risk:** Medication errors leading to patient death or serious harm

#### Gentamicin Dosing Tests (15 tests)

```javascript
describe('Gentamicin Dosing Calculator', () => {

  // Dosing by GA and PNA
  test('PCA <29 weeks, PNA 0-7 days: 5mg/kg q48h', () => {
    const dose = calculateGentamicin({ weight: 1000, ga: 26, pna: 3 });
    expect(dose.amount).toBe(5.0); // 5mg/kg * 1kg
    expect(dose.interval).toBe(48);
    expect(dose.unit).toBe('hours');
  });

  test('PCA 30-34 weeks, PNA 0-7 days: 4.5mg/kg q36h', () => {
    const dose = calculateGentamicin({ weight: 1500, ga: 32, pna: 5 });
    expect(dose.amount).toBe(6.75); // 4.5mg/kg * 1.5kg
    expect(dose.interval).toBe(36);
  });

  test('PCA ≥35 weeks, PNA >7 days: 4mg/kg q24h', () => {
    const dose = calculateGentamicin({ weight: 2500, ga: 38, pna: 10 });
    expect(dose.amount).toBe(10.0); // 4mg/kg * 2.5kg
    expect(dose.interval).toBe(24);
  });

  // Edge cases
  test('Rejects negative weight', () => {
    expect(() => calculateGentamicin({ weight: -500, ga: 32, pna: 5 }))
      .toThrow('Weight must be positive');
  });

  test('Rejects GA < 22 weeks (non-viable)', () => {
    expect(() => calculateGentamicin({ weight: 500, ga: 21, pna: 1 }))
      .toThrow('GA must be 22-42 weeks');
  });

  test('Extreme micro-preemie (400g, 23 weeks)', () => {
    const dose = calculateGentamicin({ weight: 400, ga: 23, pna: 1 });
    expect(dose.amount).toBe(2.0); // 5mg/kg * 0.4kg
    expect(dose.interval).toBe(48);
    expect(dose.warning).toContain('extremely low birth weight');
  });

  test('Maximum dose capped at 200mg (safety)', () => {
    const dose = calculateGentamicin({ weight: 50000, ga: 40, pna: 10 });
    expect(dose.amount).toBeLessThanOrEqual(200);
    expect(dose.warning).toContain('maximum dose');
  });

  // Decimal precision
  test('Rounds to 2 decimal places', () => {
    const dose = calculateGentamicin({ weight: 1333, ga: 30, pna: 8 });
    expect(dose.amount).toBe(5.33); // 4mg/kg * 1.333kg
  });

  // PNA boundary cases
  test('PNA exactly 7 days uses 0-7 day protocol', () => {
    const dose = calculateGentamicin({ weight: 1000, ga: 32, pna: 7 });
    expect(dose.interval).toBe(36); // Still 36h at day 7
  });

  test('PNA 8 days transitions to >7 day protocol', () => {
    const dose = calculateGentamicin({ weight: 1000, ga: 32, pna: 8 });
    expect(dose.interval).toBe(24); // Now 24h
  });

  // PCA (Postmenstrual age) calculation
  test('Calculates PCA correctly (GA + PNA in weeks)', () => {
    const dose = calculateGentamicin({ weight: 1200, ga: 28, pna: 14 }); // 28 + 2 weeks = 30 weeks PCA
    expect(dose.calculatedPCA).toBe(30);
  });

  // Warning messages
  test('Warns for renal impairment risk factors', () => {
    const dose = calculateGentamicin({
      weight: 800, ga: 26, pna: 2,
      renaImpairment: true
    });
    expect(dose.warning).toContain('renal impairment');
    expect(dose.warning).toContain('monitor levels');
  });

  test('Requires pharmacy verification for all doses', () => {
    const dose = calculateGentamicin({ weight: 1500, ga: 32, pna: 5 });
    expect(dose.pharmacyVerificationRequired).toBe(true);
  });

  test('Displays mg and mg/kg for clarity', () => {
    const dose = calculateGentamicin({ weight: 1200, ga: 30, pna: 9 });
    expect(dose.display).toBe('4.8 mg (4 mg/kg) IV q24h');
  });

  // Concurrent medication warnings
  test('Warns about concurrent Vancomycin (nephrotoxicity)', () => {
    const dose = calculateGentamicin({
      weight: 1500, ga: 32, pna: 5,
      concurrentMeds: ['vancomycin']
    });
    expect(dose.warning).toContain('concurrent nephrotoxic medications');
  });
});
```

#### Vancomycin Dosing Tests (12 tests)

```javascript
describe('Vancomycin Dosing Calculator', () => {

  test('PCA <29 weeks, PNA 0-7 days: 15mg/kg q24h', () => {
    const dose = calculateVancomycin({ weight: 900, ga: 27, pna: 4 });
    expect(dose.amount).toBe(13.5);
    expect(dose.interval).toBe(24);
  });

  test('PCA 30-36 weeks, PNA 8-30 days: 15mg/kg q12h', () => {
    const dose = calculateVancomycin({ weight: 1500, ga: 33, pna: 15 });
    expect(dose.amount).toBe(22.5);
    expect(dose.interval).toBe(12);
  });

  test('PCA >37 weeks, PNA >30 days: 15mg/kg q8h', () => {
    const dose = calculateVancomycin({ weight: 3000, ga: 39, pna: 35 });
    expect(dose.amount).toBe(45.0);
    expect(dose.interval).toBe(8);
  });

  test('Target trough levels displayed (10-15 mcg/mL)', () => {
    const dose = calculateVancomycin({ weight: 1200, ga: 32, pna: 10 });
    expect(dose.targetTrough).toBe('10-15 mcg/mL');
    expect(dose.targetPeak).toBe('25-40 mcg/mL');
  });

  test('Warns to check trough before 4th dose', () => {
    const dose = calculateVancomycin({ weight: 1200, ga: 32, pna: 10 });
    expect(dose.monitoring).toContain('trough before 4th dose');
  });

  // ... more Vancomycin tests
});
```

#### Caffeine Citrate Tests (8 tests)

```javascript
describe('Caffeine Citrate Dosing', () => {

  test('Loading dose: 20mg/kg caffeine citrate (10mg/kg caffeine base)', () => {
    const dose = calculateCaffeine({ weight: 1200, loading: true });
    expect(dose.amount).toBe(24); // 20mg/kg * 1.2kg
    expect(dose.caffeineBase).toBe(12); // 10mg/kg * 1.2kg
  });

  test('Maintenance dose: 5-10mg/kg/day caffeine citrate', () => {
    const dose = calculateCaffeine({ weight: 1200, loading: false });
    expect(dose.amount).toBeGreaterThanOrEqual(6); // 5mg/kg
    expect(dose.amount).toBeLessThanOrEqual(12); // 10mg/kg
  });

  test('Displays both caffeine citrate and caffeine base', () => {
    const dose = calculateCaffeine({ weight: 1000, loading: true });
    expect(dose.display).toContain('20 mg caffeine citrate');
    expect(dose.display).toContain('(10 mg caffeine base)');
  });

  // ... more Caffeine tests
});
```

---

### 2. Bilirubin Calculator - CRITICAL SEVERITY

#### Test File: `/tests/unit/calculators/bilirubin.test.js`

**Risk:** Missed kernicterus (permanent brain damage) or unnecessary treatment

#### AAP 2004 Nomogram Tests (30+ tests)

```javascript
describe('Bilirubin Risk Stratification (AAP 2004)', () => {

  // Term, Healthy
  test('Term 38 weeks, no risk, 24h, 6mg/dL: Low risk zone', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 24,
      bilirubin: 6.0,
      riskFactors: false
    });
    expect(result.riskZone).toBe('low');
    expect(result.phototherapyNeeded).toBe(false);
  });

  test('Term 38 weeks, no risk, 48h, 12mg/dL: High-intermediate zone', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 48,
      bilirubin: 12.0,
      riskFactors: false
    });
    expect(result.riskZone).toBe('high-intermediate');
    expect(result.phototherapyNeeded).toBe(true);
  });

  test('Term 38 weeks, no risk, 72h, 18mg/dL: Phototherapy threshold', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 72,
      bilirubin: 18.0,
      riskFactors: false
    });
    expect(result.phototherapyNeeded).toBe(true);
    expect(result.urgency).toBe('immediate');
  });

  test('Term 38 weeks, no risk, 72h, 25mg/dL: Exchange transfusion range', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 72,
      bilirubin: 25.0,
      riskFactors: false
    });
    expect(result.exchangeTransfusionNeeded).toBe(true);
    expect(result.urgency).toBe('CRITICAL');
    expect(result.warning).toContain('EXCHANGE TRANSFUSION');
  });

  // Term with risk factors
  test('Term 38 weeks, WITH risk, 48h, 10mg/dL: Phototherapy needed', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 48,
      bilirubin: 10.0,
      riskFactors: true
    });
    expect(result.phototherapyNeeded).toBe(true);
  });

  // Late preterm 35-37 6/7 weeks
  test('Late preterm 36 weeks, no risk, 48h, 10mg/dL: Phototherapy threshold', () => {
    const result = calculateBilirubinRisk({
      ga: 36,
      ageHours: 48,
      bilirubin: 10.0,
      riskFactors: false
    });
    expect(result.phototherapyNeeded).toBe(true);
  });

  test('Late preterm 35 weeks, WITH risk, 72h, 13mg/dL: Exchange threshold', () => {
    const result = calculateBilirubinRisk({
      ga: 35,
      ageHours: 72,
      bilirubin: 13.0,
      riskFactors: true
    });
    expect(result.exchangeTransfusionNeeded).toBe(true);
  });

  // Edge cases
  test('Bili 0 mg/dL: Returns low risk', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 48,
      bilirubin: 0,
      riskFactors: false
    });
    expect(result.riskZone).toBe('low');
  });

  test('Negative bili: Throws error', () => {
    expect(() => calculateBilirubinRisk({
      ga: 38,
      ageHours: 48,
      bilirubin: -5,
      riskFactors: false
    })).toThrow('Bilirubin must be non-negative');
  });

  test('Age 0 hours: Uses newborn threshold', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 0,
      bilirubin: 2.0,
      riskFactors: false
    });
    expect(result.riskZone).toBe('low');
  });

  test('Age >14 days: Uses extended nomogram', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 360, // 15 days
      bilirubin: 15.0,
      riskFactors: false
    });
    expect(result.warning).toContain('prolonged jaundice');
  });

  // Hour-by-hour validation (sample points)
  test('Nomogram point: 38w, 12h, phototherapy at 8.5mg/dL', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 12,
      bilirubin: 8.5,
      riskFactors: false
    });
    expect(result.phototherapyNeeded).toBe(true);
  });

  test('Nomogram point: 38w, 36h, phototherapy at 11.5mg/dL', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 36,
      bilirubin: 11.5,
      riskFactors: false
    });
    expect(result.phototherapyNeeded).toBe(true);
  });

  test('Nomogram point: 38w, 60h, phototherapy at 14mg/dL', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 60,
      bilirubin: 14.0,
      riskFactors: false
    });
    expect(result.phototherapyNeeded).toBe(true);
  });

  // Risk factor definitions
  test('Risk factors include: G6PD, hemolysis, cephalohematoma', () => {
    const riskFactorsList = getBilirubinRiskFactors();
    expect(riskFactorsList).toContain('G6PD deficiency');
    expect(riskFactorsList).toContain('Isoimmune hemolytic disease');
    expect(riskFactorsList).toContain('Cephalohematoma or significant bruising');
  });

  // Trending
  test('Rate of rise >0.2mg/dL/hr flags rapid increase', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 48,
      bilirubin: 14.0,
      previousBili: 8.0,
      previousAgeHours: 24
    });
    const rateOfRise = (14.0 - 8.0) / 24; // 0.25 mg/dL/hr
    expect(result.rateOfRise).toBe(0.25);
    expect(result.warning).toContain('rapid rise');
  });

  // Conjugated fraction
  test('Conjugated >20% of total flags direct hyperbili', () => {
    const result = calculateBilirubinRisk({
      ga: 38,
      ageHours: 72,
      bilirubin: 10.0,
      conjugatedBili: 3.0
    });
    expect(result.conjugatedFraction).toBe(0.3); // 30%
    expect(result.warning).toContain('direct hyperbilirubinemia');
    expect(result.warning).toContain('cholestasis workup');
  });
});
```

---

### 3. Blood Gas Interpreter - CRITICAL SEVERITY

#### Test File: `/tests/unit/calculators/blood-gas.test.js`

**Risk:** Misdiagnosis of life-threatening acid-base disorders

```javascript
describe('Blood Gas Interpretation', () => {

  // Normal
  test('Normal ABG: pH 7.40, pCO2 40, HCO3 24', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.40,
      pco2: 40,
      hco3: 24,
      po2: 90,
      lactate: 1.5,
      be: 0
    });
    expect(result.primary).toBe('Normal');
    expect(result.compensation).toBe('N/A');
  });

  // Respiratory Acidosis
  test('Acute Respiratory Acidosis: pH 7.25, pCO2 60, HCO3 26', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.25,
      pco2: 60,
      hco3: 26,
      po2: 60,
      lactate: 1.2,
      be: 0
    });
    expect(result.primary).toBe('Acute Respiratory Acidosis');
    expect(result.compensation).toBe('Uncompensated');
    expect(result.severity).toBe('moderate');
  });

  test('Chronic Respiratory Acidosis: pH 7.35, pCO2 60, HCO3 32', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.35,
      pco2: 60,
      hco3: 32,
      po2: 70,
      lactate: 1.0,
      be: +6
    });
    expect(result.primary).toBe('Chronic Respiratory Acidosis');
    expect(result.compensation).toBe('Partially Compensated');
  });

  // Metabolic Acidosis
  test('High Anion Gap Metabolic Acidosis (Lactic): pH 7.15, pCO2 25, HCO3 10, Lactate 8', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.15,
      pco2: 25,
      hco3: 10,
      po2: 95,
      lactate: 8.0,
      be: -15,
      na: 140,
      cl: 105
    });
    expect(result.primary).toBe('High Anion Gap Metabolic Acidosis');
    expect(result.likelyCause).toContain('Lactic acidosis');
    expect(result.anionGap).toBeGreaterThan(12);
    expect(result.severity).toBe('severe');
  });

  test('Normal Anion Gap Metabolic Acidosis: pH 7.30, pCO2 35, HCO3 16', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.30,
      pco2: 35,
      hco3: 16,
      po2: 95,
      lactate: 1.5,
      be: -8,
      na: 140,
      cl: 112
    });
    expect(result.primary).toBe('Normal Anion Gap Metabolic Acidosis');
    expect(result.anionGap).toBeLessThanOrEqual(12);
    expect(result.likelyCause).toContain('GI losses or RTA');
  });

  // Respiratory Alkalosis
  test('Respiratory Alkalosis: pH 7.50, pCO2 28, HCO3 22', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.50,
      pco2: 28,
      hco3: 22,
      po2: 110,
      lactate: 1.0,
      be: -2
    });
    expect(result.primary).toBe('Respiratory Alkalosis');
    expect(result.compensation).toBe('Uncompensated');
  });

  // Metabolic Alkalosis
  test('Metabolic Alkalosis: pH 7.52, pCO2 48, HCO3 38', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.52,
      pco2: 48,
      hco3: 38,
      po2: 85,
      lactate: 1.2,
      be: +12
    });
    expect(result.primary).toBe('Metabolic Alkalosis');
    expect(result.compensation).toBe('Partially Compensated');
  });

  // Mixed Disorders
  test('Mixed: Metabolic Acidosis + Respiratory Alkalosis', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.40, // Normal pH
      pco2: 25, // Low (respiratory alkalosis)
      hco3: 15, // Low (metabolic acidosis)
      po2: 95,
      lactate: 3.0,
      be: -10
    });
    expect(result.primary).toBe('Mixed Disorder');
    expect(result.components).toContain('Metabolic Acidosis');
    expect(result.components).toContain('Respiratory Alkalosis');
  });

  // VBG Conversion
  test('VBG to ABG conversion: pH -0.03, pCO2 +5', () => {
    const vbg = {
      type: 'venous',
      ph: 7.33,
      pco2: 50,
      hco3: 26
    };
    const estimatedABG = convertVBGtoABG(vbg);
    expect(estimatedABG.ph).toBeCloseTo(7.36, 2);
    expect(estimatedABG.pco2).toBeCloseTo(45, 1);
  });

  // Anion Gap Calculation
  test('Anion Gap = Na - (Cl + HCO3)', () => {
    const ag = calculateAnionGap({ na: 140, cl: 105, hco3: 24 });
    expect(ag).toBe(11); // 140 - (105 + 24)
  });

  test('High Anion Gap >12', () => {
    const ag = calculateAnionGap({ na: 140, cl: 100, hco3: 15 });
    expect(ag).toBe(25);
    expect(ag).toBeGreaterThan(12);
  });

  // Compensation Rules
  test('Expected compensation for metabolic acidosis: pCO2 = 1.5*HCO3 + 8', () => {
    const expected = calculateExpectedCompensation({
      disorder: 'metabolic acidosis',
      hco3: 15
    });
    expect(expected.pco2).toBeCloseTo(30.5, 1); // 1.5*15 + 8 = 30.5
  });

  // Edge Cases
  test('pH <6.8 (incompatible with life): Critical warning', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 6.75,
      pco2: 80,
      hco3: 10,
      po2: 50,
      lactate: 15.0,
      be: -20
    });
    expect(result.severity).toBe('CRITICAL');
    expect(result.warning).toContain('incompatible with life');
  });

  test('pH >7.8: Critical alkalemia', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.82,
      pco2: 20,
      hco3: 40,
      po2: 120,
      lactate: 1.0,
      be: +15
    });
    expect(result.severity).toBe('CRITICAL');
    expect(result.warning).toContain('severe alkalemia');
  });

  // Oxygenation
  test('PaO2 <50 on room air: Severe hypoxemia', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.40,
      pco2: 40,
      hco3: 24,
      po2: 45,
      fio2: 21,
      lactate: 1.5,
      be: 0
    });
    expect(result.oxygenation).toBe('Severe Hypoxemia');
    expect(result.warning).toContain('increase FiO2');
  });

  test('P/F ratio <200: ARDS criteria', () => {
    const result = interpretBloodGas({
      type: 'arterial',
      ph: 7.35,
      pco2: 42,
      hco3: 23,
      po2: 60,
      fio2: 40,
      lactate: 2.0,
      be: -2
    });
    const pfRatio = 60 / 0.40; // 150
    expect(result.pfRatio).toBe(150);
    expect(result.pfRatio).toBeLessThan(200);
    expect(result.oxygenation).toContain('ARDS');
  });
});
```

---

### 4. Ventilator Settings Calculator - CRITICAL SEVERITY

#### Test File: `/tests/unit/calculators/ventilator.test.js`

**Risk:** Barotrauma, volutrauma, inadequate ventilation

```javascript
describe('Ventilator Settings Calculator', () => {

  describe('Conventional Ventilation', () => {

    test('Micro-preemie (600g, 24w) RDS: Low TV, gentle settings', () => {
      const settings = calculateVentilatorSettings({
        weight: 0.6,
        ga: 24,
        diagnosis: 'RDS',
        mode: 'conventional'
      });
      expect(settings.tidalVolume).toBeCloseTo(2.4, 1); // 4 mL/kg for <28w
      expect(settings.pip).toBeGreaterThanOrEqual(18);
      expect(settings.pip).toBeLessThanOrEqual(22);
      expect(settings.peep).toBe(5);
      expect(settings.rate).toBeGreaterThanOrEqual(40);
      expect(settings.rate).toBeLessThanOrEqual(60);
    });

    test('VLBW (1.2kg, 30w) BPD: Moderate settings', () => {
      const settings = calculateVentilatorSettings({
        weight: 1.2,
        ga: 30,
        diagnosis: 'BPD',
        mode: 'conventional'
      });
      expect(settings.tidalVolume).toBeCloseTo(6.0, 1); // 5 mL/kg for 28-32w
      expect(settings.pip).toBeGreaterThanOrEqual(16);
      expect(settings.pip).toBeLessThanOrEqual(20);
      expect(settings.peep).toBeGreaterThanOrEqual(5);
    });

    test('MAS (Meconium Aspiration): Higher PEEP', () => {
      const settings = calculateVentilatorSettings({
        weight: 3.2,
        ga: 39,
        diagnosis: 'MAS',
        mode: 'conventional'
      });
      expect(settings.peep).toBeGreaterThanOrEqual(6);
      expect(settings.iTime).toBeCloseTo(0.4, 1);
    });

    test('PPHN: Higher MAP for recruitment', () => {
      const settings = calculateVentilatorSettings({
        weight: 3.0,
        ga: 38,
        diagnosis: 'PPHN',
        mode: 'conventional'
      });
      expect(settings.map).toBeGreaterThan(10);
      expect(settings.fio2).toBeGreaterThanOrEqual(60);
    });
  });

  describe('High Frequency Oscillatory Ventilation (HFO)', () => {

    test('Micro-preemie (800g, 26w) failing conventional: HFO settings', () => {
      const settings = calculateVentilatorSettings({
        weight: 0.8,
        ga: 26,
        diagnosis: 'Severe RDS',
        mode: 'HFO'
      });
      expect(settings.map).toBeCloseTo(10, 1); // Higher than conventional
      expect(settings.amplitude).toBeGreaterThanOrEqual(20);
      expect(settings.frequency).toBe(10); // 10 Hz typical
      expect(settings.iTime).toBe(0.33); // 33% for HFO
    });

    test('Term CDH (Congenital Diaphragmatic Hernia): Gentle HFO', () => {
      const settings = calculateVentilatorSettings({
        weight: 3.0,
        ga: 39,
        diagnosis: 'CDH',
        mode: 'HFO'
      });
      expect(settings.map).toBeLessThan(12); // Gentle for CDH
      expect(settings.amplitude).toBeLessThan(40);
      expect(settings.permissiveHypercapnia).toBe(true);
    });
  });

  describe('Safety Limits', () => {

    test('PIP limited to <30 cmH2O (lung protection)', () => {
      const settings = calculateVentilatorSettings({
        weight: 1.0,
        ga: 28,
        diagnosis: 'Severe RDS',
        mode: 'conventional'
      });
      expect(settings.pip).toBeLessThan(30);
    });

    test('MAP limited to <15 cmH2O for preemies (avoid barotrauma)', () => {
      const settings = calculateVentilatorSettings({
        weight: 1.0,
        ga: 28,
        diagnosis: 'RDS',
        mode: 'conventional'
      });
      expect(settings.map).toBeLessThan(15);
    });

    test('Warns if FiO2 >60% (toxicity risk)', () => {
      const settings = calculateVentilatorSettings({
        weight: 0.9,
        ga: 27,
        diagnosis: 'Severe RDS',
        mode: 'conventional',
        targetSpO2: 95
      });
      if (settings.fio2 > 60) {
        expect(settings.warning).toContain('FiO2 >60%');
        expect(settings.warning).toContain('oxygen toxicity');
      }
    });
  });

  describe('Edge Cases', () => {

    test('Negative weight: Error', () => {
      expect(() => calculateVentilatorSettings({
        weight: -1.0,
        ga: 30,
        diagnosis: 'RDS',
        mode: 'conventional'
      })).toThrow('Weight must be positive');
    });

    test('Extreme settings flag for review', () => {
      const settings = calculateVentilatorSettings({
        weight: 0.4, // 400g extreme micro-preemie
        ga: 23,
        diagnosis: 'Severe RDS',
        mode: 'conventional'
      });
      expect(settings.warning).toContain('extreme settings');
      expect(settings.attendingReviewRequired).toBe(true);
    });
  });
});
```

---

### 5. ETT Depth Calculator - HIGH SEVERITY

#### Test File: `/tests/unit/calculators/ett-depth.test.js`

**Risk:** Extubation or right main bronchus intubation

```javascript
describe('ETT Depth Calculator', () => {

  // Weight-based formula: 6 + weight(kg)
  test('Weight-based (Tochen): 1kg = 7cm', () => {
    const depth = calculateETTDepth({ weight: 1.0, formula: 'weight' });
    expect(depth.lipDepth).toBe(7); // 6 + 1
    expect(depth.tipPosition).toBe('mid-trachea');
  });

  test('Weight-based: 2kg = 8cm', () => {
    const depth = calculateETTDepth({ weight: 2.0, formula: 'weight' });
    expect(depth.lipDepth).toBe(8);
  });

  test('Weight-based: 3.5kg = 9.5cm', () => {
    const depth = calculateETTDepth({ weight: 3.5, formula: 'weight' });
    expect(depth.lipDepth).toBe(9.5);
  });

  // GA-based formula: GA/10 + 6
  test('GA-based: 28 weeks = 8.8cm', () => {
    const depth = calculateETTDepth({ ga: 28, formula: 'ga' });
    expect(depth.lipDepth).toBeCloseTo(8.8, 1); // 28/10 + 6
  });

  test('GA-based: 32 weeks = 9.2cm', () => {
    const depth = calculateETTDepth({ ga: 32, formula: 'ga' });
    expect(depth.lipDepth).toBeCloseTo(9.2, 1);
  });

  // ETT Size Recommendations
  test('Micro-preemie (600g, 24w): 2.5mm ETT', () => {
    const result = calculateETTDepth({ weight: 0.6, ga: 24 });
    expect(result.ettSize).toBe(2.5);
  });

  test('VLBW (1.2kg, 30w): 3.0mm ETT', () => {
    const result = calculateETTDepth({ weight: 1.2, ga: 30 });
    expect(result.ettSize).toBe(3.0);
  });

  test('Term (3.5kg, 40w): 3.5mm ETT', () => {
    const result = calculateETTDepth({ weight: 3.5, ga: 40 });
    expect(result.ettSize).toBe(3.5);
  });

  // Nasal vs Oral
  test('Nasal depth: Add 2cm to oral depth', () => {
    const oral = calculateETTDepth({ weight: 1.5, route: 'oral' });
    const nasal = calculateETTDepth({ weight: 1.5, route: 'nasal' });
    expect(nasal.lipDepth).toBe(oral.lipDepth + 2);
  });

  // Confirmation
  test('Provides chest X-ray confirmation guidance', () => {
    const result = calculateETTDepth({ weight: 1.0, ga: 28 });
    expect(result.xrayConfirmation).toContain('T2-T3');
    expect(result.xrayConfirmation).toContain('above carina');
  });

  // Safety warnings
  test('Warns if depth <6cm (too shallow)', () => {
    const result = calculateETTDepth({ weight: 0.4, ga: 23 });
    if (result.lipDepth < 6) {
      expect(result.warning).toContain('minimum depth');
    }
  });

  test('Warns if depth >11cm for neonate (too deep)', () => {
    const result = calculateETTDepth({ weight: 4.5, ga: 42 });
    if (result.lipDepth > 11) {
      expect(result.warning).toContain('consider re-measuring');
    }
  });

  // Edge cases
  test('Extreme micro-preemie (400g): Still provides estimate', () => {
    const result = calculateETTDepth({ weight: 0.4, ga: 23 });
    expect(result.lipDepth).toBeGreaterThan(0);
    expect(result.warning).toContain('extreme prematurity');
  });
});
```

---

## PRIORITY 2: HIGH - Clinical Safety

---

### 6. Alarm System Integration Tests

#### Test File: `/tests/integration/alarm-system.test.js`

```javascript
describe('Alarm System Integration', () => {

  test('Critical SpO2 violation triggers critical alarm', () => {
    const patient = { id: 1, limits: { spo2: [88, 95] } };
    const vitals = { spo2: 82 }; // Below threshold

    const alarm = checkAlarms(patient, vitals);

    expect(alarm.triggered).toBe(true);
    expect(alarm.type).toBe('critical');
    expect(alarm.parameter).toBe('SpO2');
    expect(alarm.value).toBe(82);
    expect(alarm.threshold).toBe(88);
  });

  test('Critical alarm triggers IEC 60601-1-8 sound pattern', async () => {
    const soundSpy = jest.spyOn(AlarmSound, 'playCriticalAlarm');

    triggerCriticalAlarm({ patientId: 1, parameter: 'SpO2' });

    expect(soundSpy).toHaveBeenCalled();
    // Verify 10-pulse pattern played
  });

  test('Alarm silencing lasts max 2 minutes for critical', () => {
    jest.useFakeTimers();

    const alarm = triggerCriticalAlarm({ patientId: 1, parameter: 'HR' });
    silenceAlarm(alarm.id);

    expect(alarm.silenced).toBe(true);

    jest.advanceTimersByTime(120000); // 2 minutes

    // Alarm should re-activate
    expect(getAlarmState(alarm.id).silenced).toBe(false);
  });

  test('GA-specific SpO2 targets enforced', () => {
    const microPreemie = { id: 1, gaWeeks: 24, limits: { spo2: [88, 95] } };
    const term = { id: 2, gaWeeks: 39, limits: { spo2: [92, 100] } };

    const vitals = { spo2: 91 };

    const alarm1 = checkAlarms(microPreemie, vitals);
    const alarm2 = checkAlarms(term, vitals);

    expect(alarm1.triggered).toBe(false); // 91% OK for 24w
    expect(alarm2.triggered).toBe(true);  // 91% LOW for 39w
  });
});
```

---

### 7. Growth Tracking Tests

#### Test File: `/tests/unit/growth/fenton-percentiles.test.js`

```javascript
describe('Fenton Growth Percentile Calculations', () => {

  test('Male 28 weeks, 1198g = 50th percentile', () => {
    const percentile = getFentonPercentile({
      gender: 'male',
      measurement: 'weight',
      ga: 28,
      value: 1198
    });
    expect(percentile).toBe('50th');
  });

  test('Male 28 weeks, 736g = 3rd percentile', () => {
    const percentile = getFentonPercentile({
      gender: 'male',
      measurement: 'weight',
      ga: 28,
      value: 736
    });
    expect(percentile).toBe('3rd');
  });

  test('Male 28 weeks, 650g = <3rd percentile (growth failure)', () => {
    const percentile = getFentonPercentile({
      gender: 'male',
      measurement: 'weight',
      ga: 28,
      value: 650
    });
    expect(percentile).toBe('<3rd');
    expect(percentile).toContain('growth failure');
  });

  test('Female 32 weeks, 1954g = 50th percentile', () => {
    const percentile = getFentonPercentile({
      gender: 'female',
      measurement: 'weight',
      ga: 32,
      value: 1954
    });
    expect(percentile).toBe('50th');
  });

  test('Gender-specific curves differ', () => {
    const male50 = FENTON_PERCENTILES.male.weight[32].p50;
    const female50 = FENTON_PERCENTILES.female.weight[32].p50;
    expect(male50).not.toBe(female50);
  });

  // Data integrity tests
  test('All GA weeks 22-40 have weight data (male)', () => {
    for (let ga = 22; ga <= 40; ga += 2) {
      expect(FENTON_PERCENTILES.male.weight[ga]).toBeDefined();
      expect(FENTON_PERCENTILES.male.weight[ga].p50).toBeGreaterThan(0);
    }
  });

  test('Percentiles increase monotonically (p3 < p10 < p50 < p90 < p97)', () => {
    const data = FENTON_PERCENTILES.male.weight[30];
    expect(data.p3).toBeLessThan(data.p10);
    expect(data.p10).toBeLessThan(data.p50);
    expect(data.p50).toBeLessThan(data.p90);
    expect(data.p90).toBeLessThan(data.p97);
  });
});
```

---

## TEST EXECUTION PRIORITIES

### Week 1: CRITICAL MEDICAL CALCULATIONS
- [ ] Drug dosing (Gentamicin, Vancomycin, Caffeine) - 35 tests
- [ ] Bilirubin risk stratification - 30 tests
- [ ] Blood gas interpretation - 25 tests
- [ ] Total: ~90 tests

### Week 2: CRITICAL RESPIRATORY & SAFETY
- [ ] Ventilator settings - 20 tests
- [ ] ETT depth - 15 tests
- [ ] Alarm threshold detection - 15 tests
- [ ] Total: ~50 tests

### Week 3: HIGH PRIORITY CALCULATIONS
- [ ] Fluid calculator - 20 tests
- [ ] GIR calculator - 10 tests
- [ ] TPN/Calorie calculator - 15 tests
- [ ] Pain assessment - 15 tests
- [ ] Total: ~60 tests

### Week 4: INTEGRATION & E2E
- [ ] Alarm system integration - 15 tests
- [ ] Patient data flow - 15 tests
- [ ] Growth tracking - 15 tests
- [ ] E2E critical workflows - 10 tests
- [ ] Total: ~55 tests

---

## SUMMARY

**Total Priority 1 Tests to Implement: ~300 tests**
**Total Priority 2 Tests to Implement: ~150 tests**
**Grand Total: ~450 comprehensive tests**

**Estimated Implementation Time:**
- Priority 1 (Critical): 120 hours (3 weeks, 2 developers)
- Priority 2 (High): 80 hours (2 weeks, 2 developers)
- Total: 200 hours (5 weeks)

**Risk Mitigation:**
Implementing these tests will reduce patient safety risk from HIGH to LOW and ensure medical calculation accuracy, alarm reliability, and regulatory compliance.

---

**Next Steps:**
1. Set up Jest + React Testing Library
2. Create test directory structure
3. Begin with Priority 1, Week 1 tests
4. Achieve 95%+ coverage on medical calculations before clinical deployment
