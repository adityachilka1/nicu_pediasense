# NICU Dashboard Testing Roadmap
**Comprehensive Testing Implementation Plan**

---

## Current State Assessment

### Test Coverage Status
```
Unit Tests:           0% ⚠️ CRITICAL GAP
Integration Tests:    0% ⚠️ CRITICAL GAP
E2E Tests:           15% ⚠️ Surface level only
Component Tests:      0% ⚠️ CRITICAL GAP
Medical Calculations: 0% ⚠️ PATIENT SAFETY RISK
```

### Risk Level: **HIGH - NOT PRODUCTION READY**

---

## Quick Start - First 48 Hours

### Step 1: Install Testing Infrastructure (2 hours)

```bash
# Navigate to project directory
cd /Users/adityachilka/Downloads/nicu-dashboard

# Install Jest and React Testing Library
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Install Jest DOM environment
npm install --save-dev jest-environment-jsdom

# Install coverage tools
npm install --save-dev @jest/globals

# Install testing utilities
npm install --save-dev @testing-library/react-hooks
```

### Step 2: Create Jest Configuration (30 minutes)

Create `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx}',
    'components/**/*.{js,jsx}',
    'lib/**/*.{js,jsx}',
    '!**/*.test.{js,jsx}',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // CRITICAL: Medical calculations must have 95%+ coverage
    './app/calculators/*.{js,jsx}': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './lib/data.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
};
```

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
}));

// Mock Web Audio API for alarm sound tests
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { setValueAtTime: jest.fn() },
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
  })),
  destination: {},
  currentTime: 0,
  state: 'running',
  resume: jest.fn(),
  close: jest.fn(),
}));
```

### Step 3: Update package.json (5 minutes)

Add test scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:critical": "jest --testPathPattern='(drug-dosing|bilirubin|blood-gas|ventilator|ett-depth)' --coverage"
  }
}
```

### Step 4: Create Test Directory Structure (10 minutes)

```bash
mkdir -p __tests__/unit/calculators
mkdir -p __tests__/unit/components
mkdir -p __tests__/unit/lib
mkdir -p __tests__/integration
mkdir -p __tests__/e2e
mkdir -p __tests__/fixtures
mkdir -p __tests__/utils
```

### Step 5: Create First Critical Test (1 hour)

Create `__tests__/unit/calculators/drug-dosing.test.js`:

```javascript
/**
 * CRITICAL PATIENT SAFETY TESTS
 * Drug Dosing Calculator - Gentamicin
 *
 * Risk: Medication errors can cause patient death
 * Coverage Required: 100%
 */

import { describe, test, expect } from '@jest/globals';

// TODO: Import actual calculator function once extracted
// For now, we'll create a placeholder

function calculateGentamicin({ weight, ga, pna }) {
  // Validate inputs
  if (weight <= 0) throw new Error('Weight must be positive');
  if (ga < 22 || ga > 42) throw new Error('GA must be 22-42 weeks');
  if (pna < 0) throw new Error('PNA must be non-negative');

  const weightKg = weight / 1000;
  const pca = ga + Math.floor(pna / 7);

  let dosePerKg, interval;

  // Dosing algorithm based on PCA and PNA
  if (pca < 29) {
    dosePerKg = 5;
    interval = pna <= 7 ? 48 : 36;
  } else if (pca >= 29 && pca <= 34) {
    dosePerKg = 4.5;
    interval = pna <= 7 ? 36 : 24;
  } else {
    dosePerKg = 4;
    interval = pna <= 7 ? 36 : 24;
  }

  const amount = parseFloat((dosePerKg * weightKg).toFixed(2));

  return {
    amount,
    dosePerKg,
    interval,
    unit: 'hours',
    calculatedPCA: pca,
    pharmacyVerificationRequired: true,
  };
}

describe('Drug Dosing - Gentamicin (CRITICAL)', () => {

  describe('Dosing by GA and PNA', () => {
    test('PCA <29 weeks, PNA 0-7 days: 5mg/kg q48h', () => {
      const dose = calculateGentamicin({ weight: 1000, ga: 26, pna: 3 });
      expect(dose.amount).toBe(5.0);
      expect(dose.dosePerKg).toBe(5);
      expect(dose.interval).toBe(48);
    });

    test('PCA 30-34 weeks, PNA 0-7 days: 4.5mg/kg q36h', () => {
      const dose = calculateGentamicin({ weight: 1500, ga: 32, pna: 5 });
      expect(dose.amount).toBe(6.75);
      expect(dose.dosePerKg).toBe(4.5);
      expect(dose.interval).toBe(36);
    });

    test('PCA ≥35 weeks, PNA >7 days: 4mg/kg q24h', () => {
      const dose = calculateGentamicin({ weight: 2500, ga: 38, pna: 10 });
      expect(dose.amount).toBe(10.0);
      expect(dose.dosePerKg).toBe(4);
      expect(dose.interval).toBe(24);
    });
  });

  describe('Input Validation', () => {
    test('Rejects negative weight', () => {
      expect(() => calculateGentamicin({ weight: -500, ga: 32, pna: 5 }))
        .toThrow('Weight must be positive');
    });

    test('Rejects GA < 22 weeks (non-viable)', () => {
      expect(() => calculateGentamicin({ weight: 500, ga: 21, pna: 1 }))
        .toThrow('GA must be 22-42 weeks');
    });

    test('Rejects GA > 42 weeks', () => {
      expect(() => calculateGentamicin({ weight: 3500, ga: 43, pna: 1 }))
        .toThrow('GA must be 22-42 weeks');
    });

    test('Rejects negative PNA', () => {
      expect(() => calculateGentamicin({ weight: 1000, ga: 30, pna: -5 }))
        .toThrow('PNA must be non-negative');
    });
  });

  describe('Edge Cases', () => {
    test('Extreme micro-preemie (400g, 23 weeks)', () => {
      const dose = calculateGentamicin({ weight: 400, ga: 23, pna: 1 });
      expect(dose.amount).toBe(2.0);
      expect(dose.interval).toBe(48);
      expect(dose.calculatedPCA).toBe(23);
    });

    test('Decimal precision to 2 places', () => {
      const dose = calculateGentamicin({ weight: 1333, ga: 30, pna: 8 });
      expect(dose.amount).toBe(5.33);
    });

    test('PNA exactly 7 days uses 0-7 day protocol', () => {
      const dose = calculateGentamicin({ weight: 1000, ga: 32, pna: 7 });
      expect(dose.interval).toBe(36);
    });

    test('PNA 8 days transitions to >7 day protocol', () => {
      const dose = calculateGentamicin({ weight: 1000, ga: 32, pna: 8 });
      expect(dose.interval).toBe(24);
    });
  });

  describe('Safety Requirements', () => {
    test('All doses require pharmacy verification', () => {
      const dose = calculateGentamicin({ weight: 1500, ga: 32, pna: 5 });
      expect(dose.pharmacyVerificationRequired).toBe(true);
    });
  });
});
```

Run the test:
```bash
npm test -- drug-dosing.test.js
```

---

## Week 1: Critical Medical Calculations (40 hours)

### Day 1-2: Drug Dosing (16 hours)
- [ ] Extract calculator logic from `/app/calculators/page.jsx` to `/lib/calculators/drugDosing.js`
- [ ] Write 40+ tests for Gentamicin
- [ ] Write 30+ tests for Vancomycin
- [ ] Write 20+ tests for Ampicillin
- [ ] Write 15+ tests for Caffeine Citrate
- [ ] Achieve 100% coverage

### Day 3-4: Bilirubin Calculator (16 hours)
- [ ] Extract bilirubin logic to `/lib/calculators/bilirubin.js`
- [ ] Implement AAP 2004 nomogram data
- [ ] Write 30+ tests covering all risk zones
- [ ] Test phototherapy thresholds
- [ ] Test exchange transfusion thresholds
- [ ] Achieve 100% coverage

### Day 5: Blood Gas Interpreter (8 hours)
- [ ] Extract blood gas logic to `/lib/calculators/bloodGas.js`
- [ ] Write 50+ tests for all acid-base disorders
- [ ] Test anion gap calculations
- [ ] Test compensation formulas
- [ ] Test VBG to ABG conversion
- [ ] Achieve 95%+ coverage

### Deliverables:
- 155+ passing tests
- 100% coverage on drug dosing
- 100% coverage on bilirubin
- 95%+ coverage on blood gas
- CI/CD pipeline configured

---

## Week 2: Respiratory & Alarm Safety (30 hours)

### Day 1: Ventilator Calculator (8 hours)
- [ ] Extract ventilator logic to `/lib/calculators/ventilator.js`
- [ ] Write 30+ tests for conventional ventilation
- [ ] Write 15+ tests for HFO settings
- [ ] Test safety limits (PIP, PEEP, MAP)
- [ ] Achieve 95%+ coverage

### Day 2: ETT Depth Calculator (6 hours)
- [ ] Extract ETT logic to `/lib/calculators/ettDepth.js`
- [ ] Write 15+ tests for depth calculations
- [ ] Test both weight-based and GA-based formulas
- [ ] Test ETT size recommendations
- [ ] Achieve 100% coverage

### Day 3-4: Alarm System Tests (16 hours)
- [ ] Write 15+ unit tests for alarm threshold detection
- [ ] Write 10+ tests for IEC 60601-1-8 sound patterns
- [ ] Write 10+ tests for alarm silencing safety
- [ ] Write 15+ integration tests for alarm flow
- [ ] Test GA-specific SpO2 targets
- [ ] Achieve 90%+ coverage

### Deliverables:
- 95+ passing tests
- Ventilator safety validated
- ETT calculations verified
- Alarm system reliability confirmed

---

## Week 3: Nutritional & Pain Management (30 hours)

### Day 1: Fluid Calculator (8 hours)
- [ ] Extract fluid logic to `/lib/calculators/fluids.js`
- [ ] Write 25+ tests for fluid requirements
- [ ] Test IWL modifiers
- [ ] Test electrolyte calculations
- [ ] Achieve 90%+ coverage

### Day 2: GIR & TPN Calculators (10 hours)
- [ ] Extract GIR logic to `/lib/calculators/gir.js`
- [ ] Write 10+ tests for GIR calculations
- [ ] Extract TPN logic to `/lib/calculators/tpn.js`
- [ ] Write 20+ tests for calorie calculations
- [ ] Achieve 90%+ coverage

### Day 3: Pain Assessment (6 hours)
- [ ] Extract pain logic to `/lib/calculators/painAssessment.js`
- [ ] Write 20+ tests for NIPS score
- [ ] Write 15+ tests for FLACC score
- [ ] Test interpretation thresholds
- [ ] Achieve 95%+ coverage

### Day 4: GA & Age Calculators (6 hours)
- [ ] Extract GA calculator to `/lib/calculators/gestationalAge.js`
- [ ] Write 20+ tests for GA calculations
- [ ] Write 15+ tests for corrected age
- [ ] Test date/time edge cases
- [ ] Achieve 95%+ coverage

### Deliverables:
- 125+ passing tests
- Nutritional calculations validated
- Pain assessment accuracy confirmed
- Age calculations verified

---

## Week 4: Integration & Component Tests (30 hours)

### Day 1-2: Patient Data Flow Integration (12 hours)
- [ ] Write 20+ tests for patient data validation
- [ ] Test vitals generation accuracy
- [ ] Test alarm triggering from vitals
- [ ] Test status transitions (normal → warning → critical)
- [ ] Achieve 85%+ integration coverage

### Day 3: Growth Tracking Integration (8 hours)
- [ ] Write 25+ tests for Fenton percentile calculations
- [ ] Test all GA weeks (22-40)
- [ ] Test gender-specific curves
- [ ] Validate data integrity
- [ ] Achieve 95%+ coverage

### Day 4-5: Critical Component Tests (10 hours)
- [ ] Write 20+ tests for AlarmSound component
- [ ] Write 15+ tests for NotificationsPanel
- [ ] Write 15+ tests for Calculator components
- [ ] Write 10+ tests for VitalSignDisplay
- [ ] Achieve 80%+ component coverage

### Deliverables:
- 105+ passing tests
- Integration workflows validated
- Critical components tested
- 80%+ overall test coverage achieved

---

## Week 5: E2E & Performance (20 hours)

### Day 1-2: Enhanced E2E Tests (10 hours)
- [ ] Expand Playwright tests to validate calculation results
- [ ] Add error scenario coverage
- [ ] Test multi-patient workflows
- [ ] Add accessibility tests (WCAG 2.1 AA)
- [ ] Achieve 60%+ E2E coverage

### Day 3: Performance Testing (6 hours)
- [ ] Write load tests for multiple concurrent patients
- [ ] Test real-time vitals update performance
- [ ] Measure alarm response latency
- [ ] Optimize slow paths

### Day 4: Documentation & Reporting (4 hours)
- [ ] Generate coverage reports
- [ ] Document test methodology
- [ ] Create testing guidelines for future development
- [ ] Prepare regulatory compliance documentation

### Deliverables:
- 30+ E2E tests
- Performance benchmarks established
- Complete test documentation
- Regulatory compliance package

---

## Success Metrics

### Coverage Targets (End of Week 5)
```
Unit Tests:               85%+ ✓
Integration Tests:        75%+ ✓
E2E Tests:               60%+ ✓
Medical Calculations:     95%+ ✓ CRITICAL
Component Tests:          80%+ ✓
Alarm System:            90%+ ✓ CRITICAL
```

### Quality Gates
- [ ] All Priority 1 tests passing (100%)
- [ ] Zero critical bugs in medical calculations
- [ ] IEC 60601-1-8 alarm compliance verified
- [ ] Accessibility WCAG 2.1 AA compliance
- [ ] Performance benchmarks met (<100ms alarm response)
- [ ] Regulatory documentation complete

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run critical medical calculation tests
        run: npm run test:critical

      - name: Run all unit tests
        run: npm test -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Run E2E tests
        run: npx playwright test

      - name: Check coverage thresholds
        run: npm run test:coverage -- --coverageThreshold='{"global":{"lines":80}}'

  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run accessibility tests
        run: npm run test:a11y
```

### Pre-commit Hooks

Install Husky:
```bash
npm install --save-dev husky
npx husky install
```

Create `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run critical tests before commit
npm run test:critical
```

---

## Team Responsibilities

### Developer 1: Medical Calculations Lead
- Drug dosing calculators
- Bilirubin calculator
- Blood gas interpreter
- Ventilator calculator
- Total: ~100 hours

### Developer 2: Integration & Components Lead
- Alarm system tests
- Integration tests
- Component tests
- E2E test expansion
- Total: ~100 hours

### Both Developers: Code Review
- Peer review all test code
- Validate medical accuracy against references
- Ensure 100% coverage on critical paths
- Total: ~20 hours

---

## Medical Reference Materials Required

### Essential Guidelines
1. **AAP Clinical Practice Guideline: Management of Hyperbilirubinemia** (2004)
2. **NeoFax 2024** - Drug dosing reference
3. **Pediatric & Neonatal Dosage Handbook** (Lexicomp)
4. **Fenton TR, Kim JH. BMC Pediatr. 2013** - Growth charts
5. **IEC 60601-1-8:2020** - Alarm system standards
6. **IEC 60601-2-49:2011** - Vital signs monitoring
7. **AAP/AHA NRP 8th Edition** - Resuscitation protocols
8. **SUPPORT, BOOST-II, COT Trials** - SpO2 targets

### Access Required
- Hospital formulary for institutional dosing protocols
- Neonatology attending physician for validation
- Clinical pharmacist for drug dosing review
- Medical librarian for guideline access

---

## Risk Mitigation

### Pre-Production Checklist
- [ ] All Priority 1 tests passing
- [ ] Medical calculations validated by neonatologist
- [ ] Drug dosing reviewed by clinical pharmacist
- [ ] Alarm system tested in simulated clinical environment
- [ ] Accessibility tested with screen readers
- [ ] Performance tested under load
- [ ] Regulatory documentation complete
- [ ] User acceptance testing completed
- [ ] Training materials prepared
- [ ] Incident response plan established

### Deployment Gates
```
Stage 1: Internal Testing
├── 95%+ medical calculation coverage
├── 100% critical path tests passing
└── Neonatologist sign-off

Stage 2: Clinical Validation
├── Simulated clinical scenarios
├── Nurse workflow testing
└── Alarm system verification

Stage 3: Limited Production
├── Single NICU unit deployment
├── 24/7 monitoring for 2 weeks
└── Zero critical incidents

Stage 4: Full Production
└── All NICUs deployment
```

---

## Budget & Timeline Summary

### Total Effort
- **5 weeks** (200 development hours)
- **2 developers** full-time
- **Medical review**: 20 hours (neonatologist + pharmacist)
- **Total**: 220 hours

### Cost Estimate (Approximate)
- Development: $40,000 (2 developers × $100/hr × 200 hrs)
- Medical review: $4,000 (specialists × $200/hr × 20 hrs)
- Tools/Infrastructure: $1,000 (CI/CD, testing tools)
- **Total**: $45,000

### ROI Calculation
- **Cost of single medication error**: $100,000 - $1,000,000+ (legal, settlement, reputation)
- **Cost of kernicterus case**: $5,000,000+ (lifetime care, legal)
- **Cost of testing**: $45,000
- **Risk reduction**: 90%+
- **ROI**: 1000%+ (prevented single serious incident pays for testing 10x over)

---

## Next Immediate Steps (Today)

### Hour 1: Setup
```bash
cd /Users/adityachilka/Downloads/nicu-dashboard
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

### Hour 2: Configuration
- Create `jest.config.js`
- Create `jest.setup.js`
- Update `package.json` scripts
- Create test directory structure

### Hour 3: First Test
- Create `__tests__/unit/calculators/drug-dosing.test.js`
- Write first 5 Gentamicin tests
- Run and verify passing

### Hour 4: Refactoring
- Extract calculator logic from `app/calculators/page.jsx`
- Create `/lib/calculators/drugDosing.js`
- Update imports
- Verify application still works

### End of Day 1
- ✓ Testing infrastructure in place
- ✓ First 5 tests passing
- ✓ Calculator logic extracted and modular
- ✓ CI/CD pipeline configured
- ✓ Team aligned on testing strategy

---

## Support & Resources

### Documentation
- `/TEST_COVERAGE_ANALYSIS.md` - Comprehensive coverage analysis
- `/PRIORITY_TEST_CASES.md` - Detailed test specifications
- `/TESTING_ROADMAP.md` - This implementation plan (you are here)

### Communication
- **Daily standup**: Review test progress
- **Weekly medical review**: Validate calculations with neonatologist
- **Bi-weekly stakeholder update**: Report coverage metrics

### Escalation Path
- **Blocker**: Unclear medical reference → Consult neonatologist
- **Technical issue**: Test framework problems → Senior engineer review
- **Timeline risk**: Falling behind → Add developer or extend timeline
- **Quality concern**: Coverage below target → Stop and remediate

---

## Conclusion

This NICU Dashboard has significant patient safety risks due to **zero unit test coverage on critical medical calculations**. Implementing this testing roadmap is **MANDATORY** before clinical deployment.

**The application is currently NOT PRODUCTION READY.**

Following this roadmap will:
1. Reduce patient safety risk from HIGH to LOW
2. Ensure medical calculation accuracy
3. Validate alarm system reliability
4. Achieve regulatory compliance
5. Enable confident clinical deployment

**Start immediately with Week 1, Day 1 tasks.**

---

**Questions or Concerns?**
Contact the Test Automation Engineering team for support and guidance throughout implementation.

**Patient safety depends on comprehensive testing. Let's build it right.**
