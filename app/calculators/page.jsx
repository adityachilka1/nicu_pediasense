'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const calculators = [
  { id: 'ga', name: 'Gestational Age', icon: '📅', description: 'Calculate GA from LMP or EDD' },
  { id: 'corrected', name: 'Corrected Age', icon: '👶', description: 'PCA and corrected age' },
  { id: 'bilirubin', name: 'Bilirubin Risk', icon: '🟡', description: 'AAP phototherapy thresholds' },
  { id: 'fluids', name: 'Fluid Calculator', icon: '💧', description: 'Daily fluid requirements' },
  { id: 'gir', name: 'GIR Calculator', icon: '🍬', description: 'Glucose infusion rate' },
  { id: 'calories', name: 'Calorie Calculator', icon: '⚡', description: 'TPN & enteral calories' },
  { id: 'apgar', name: 'APGAR Score', icon: '❤️', description: 'Newborn assessment' },
  { id: 'snappe', name: 'SNAPPE-II', icon: '📊', description: 'Mortality risk score' },
  { id: 'dosing', name: 'Drug Dosing', icon: '💊', description: 'Weight-based dosing' },
  { id: 'etco2', name: 'ETT Size', icon: '🫁', description: 'Endotracheal tube sizing' },
  { id: 'pain', name: 'Pain Assessment', icon: '😢', description: 'NIPS & FLACC scales' },
  { id: 'abg', name: 'Blood Gas', icon: '🩸', description: 'ABG/VBG interpreter' },
  { id: 'vent', name: 'Ventilator', icon: '🌬️', description: 'Initial vent settings' },
  { id: 'oi', name: 'Oxygenation Index', icon: '🫀', description: 'OI & A-a gradient' },
  { id: 'nec', name: 'NEC Risk', icon: '🔬', description: 'Bell staging & risk factors' },
];

export default function CalculatorsPage() {
  const [activeCalc, setActiveCalc] = useState('ga');

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Clinical Calculators</h1>
          <p className="text-slate-400 text-sm">NICU clinical decision support tools</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Calculator List */}
          <div className="col-span-3 space-y-2">
            {calculators.map((calc) => (
              <button
                key={calc.id}
                onClick={() => setActiveCalc(calc.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3 ${
                  activeCalc === calc.id
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span className="text-xl">{calc.icon}</span>
                <div>
                  <div className="font-medium text-white text-sm">{calc.name}</div>
                  <div className="text-xs text-slate-400">{calc.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Calculator Panel */}
          <div className="col-span-9">
            {activeCalc === 'ga' && <GACalculator />}
            {activeCalc === 'corrected' && <CorrectedAgeCalculator />}
            {activeCalc === 'bilirubin' && <BilirubinCalculator />}
            {activeCalc === 'fluids' && <FluidCalculator />}
            {activeCalc === 'gir' && <GIRCalculator />}
            {activeCalc === 'calories' && <CalorieCalculator />}
            {activeCalc === 'apgar' && <APGARCalculator />}
            {activeCalc === 'snappe' && <SNAPPECalculator />}
            {activeCalc === 'dosing' && <DosingCalculator />}
            {activeCalc === 'etco2' && <ETTCalculator />}
            {activeCalc === 'pain' && <PainAssessmentCalculator />}
            {activeCalc === 'abg' && <BloodGasCalculator />}
            {activeCalc === 'vent' && <VentilatorCalculator />}
            {activeCalc === 'oi' && <OxygenationIndexCalculator />}
            {activeCalc === 'nec' && <NECRiskCalculator />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function GACalculator() {
  const [lmp, setLmp] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    if (lmp) {
      const lmpDate = new Date(lmp);
      const today = new Date();
      const days = Math.floor((today - lmpDate) / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      const edd = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
      setResult({ weeks, days: remainingDays, edd: edd.toISOString().split('T')[0] });
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Gestational Age Calculator</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Last Menstrual Period (LMP)</label>
          <input
            type="date"
            value={lmp}
            onChange={(e) => setLmp(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
          />
        </div>
        <button onClick={calculate} className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          Calculate
        </button>
        {result && (
          <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Gestational Age</span>
                <p className="text-2xl font-bold text-cyan-400">{result.weeks}+{result.days} weeks</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Estimated Due Date</span>
                <p className="text-2xl font-bold text-white">{result.edd}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CorrectedAgeCalculator() {
  const [ga, setGa] = useState({ weeks: 28, days: 0 });
  const [dob, setDob] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    if (dob) {
      const birth = new Date(dob);
      const today = new Date();
      const chronoDays = Math.floor((today - birth) / (1000 * 60 * 60 * 24));
      const chronoWeeks = Math.floor(chronoDays / 7);
      const pcaWeeks = ga.weeks + Math.floor((ga.days + chronoDays) / 7);
      const pcaDays = (ga.days + chronoDays) % 7;
      const pretermWeeks = 40 - ga.weeks;
      const correctedDays = chronoDays - pretermWeeks * 7;
      const correctedWeeks = Math.floor(correctedDays / 7);
      setResult({ chronoWeeks, pcaWeeks, pcaDays, correctedWeeks });
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Corrected Age Calculator</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">GA at Birth (weeks)</label>
            <input
              type="number"
              value={ga.weeks}
              onChange={(e) => setGa({ ...ga, weeks: parseInt(e.target.value) })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">GA at Birth (days)</label>
            <input
              type="number"
              value={ga.days}
              onChange={(e) => setGa({ ...ga, days: parseInt(e.target.value) })}
              max={6}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
          />
        </div>
        <button onClick={calculate} className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          Calculate
        </button>
        {result && (
          <div className="mt-4 p-4 bg-slate-700/50 rounded-lg grid grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-slate-400">Chronological Age</span>
              <p className="text-xl font-bold text-white">{result.chronoWeeks} weeks</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">PCA</span>
              <p className="text-xl font-bold text-cyan-400">{result.pcaWeeks}+{result.pcaDays} weeks</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Corrected Age</span>
              <p className="text-xl font-bold text-green-400">{result.correctedWeeks} weeks</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BilirubinCalculator() {
  const [bili, setBili] = useState('');
  const [ageHours, setAgeHours] = useState('');
  const [ga, setGa] = useState('38');
  const [riskFactors, setRiskFactors] = useState(false);
  const [result, setResult] = useState(null);

  const calculate = () => {
    const biliVal = parseFloat(bili);
    const hours = parseInt(ageHours);
    const gaVal = parseInt(ga);

    // AAP 2022 Phototherapy Thresholds (mg/dL) based on GA and risk factors
    // Low risk: ≥38 weeks + no risk factors
    // Medium risk: ≥38 weeks + risk factors OR 35-37 6/7 weeks + no risk factors
    // High risk: 35-37 6/7 weeks + risk factors
    let photoThreshold, exchangeThreshold;

    if (gaVal >= 38 && !riskFactors) {
      // Low risk thresholds (AAP 2022)
      if (hours <= 12) photoThreshold = 8;
      else if (hours <= 24) photoThreshold = 12;
      else if (hours <= 36) photoThreshold = 14;
      else if (hours <= 48) photoThreshold = 15;
      else if (hours <= 60) photoThreshold = 17;
      else if (hours <= 72) photoThreshold = 18;
      else if (hours <= 84) photoThreshold = 19;
      else photoThreshold = 20;
      exchangeThreshold = photoThreshold + 5;
    } else if ((gaVal >= 38 && riskFactors) || (gaVal >= 35 && gaVal < 38 && !riskFactors)) {
      // Medium risk thresholds
      if (hours <= 12) photoThreshold = 6;
      else if (hours <= 24) photoThreshold = 10;
      else if (hours <= 36) photoThreshold = 12;
      else if (hours <= 48) photoThreshold = 13;
      else if (hours <= 60) photoThreshold = 15;
      else if (hours <= 72) photoThreshold = 16;
      else if (hours <= 84) photoThreshold = 17;
      else photoThreshold = 18;
      exchangeThreshold = photoThreshold + 4;
    } else if (gaVal >= 35 && gaVal < 38 && riskFactors) {
      // High risk thresholds
      if (hours <= 12) photoThreshold = 5;
      else if (hours <= 24) photoThreshold = 8;
      else if (hours <= 36) photoThreshold = 10;
      else if (hours <= 48) photoThreshold = 12;
      else if (hours <= 60) photoThreshold = 13;
      else if (hours <= 72) photoThreshold = 14;
      else if (hours <= 84) photoThreshold = 15;
      else photoThreshold = 16;
      exchangeThreshold = photoThreshold + 3;
    } else {
      // Preterm <35 weeks - use institutional guidelines
      if (hours <= 24) photoThreshold = 5;
      else if (hours <= 48) photoThreshold = 7;
      else if (hours <= 72) photoThreshold = 9;
      else photoThreshold = 10;
      exchangeThreshold = photoThreshold + 2;
    }

    const risk = biliVal >= exchangeThreshold ? 'critical' : biliVal >= photoThreshold ? 'high' : biliVal >= photoThreshold * 0.85 ? 'intermediate' : 'low';
    setResult({ biliVal, photoThreshold, exchangeThreshold, risk, needsPhoto: biliVal >= photoThreshold });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Bilirubin Risk Assessment (AAP 2022)</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Total Bilirubin (mg/dL)</label>
            <input
              type="number"
              step="0.1"
              value={bili}
              onChange={(e) => setBili(e.target.value)}
              placeholder="12.5"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Age (hours)</label>
            <input
              type="number"
              value={ageHours}
              onChange={(e) => setAgeHours(e.target.value)}
              placeholder="48"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Gestational Age</label>
            <select value={ga} onChange={(e) => setGa(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
              <option value="34">&lt;35 weeks (Preterm)</option>
              <option value="35">35-37 6/7 weeks</option>
              <option value="38">≥38 weeks</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer p-2">
              <input
                type="checkbox"
                checked={riskFactors}
                onChange={(e) => setRiskFactors(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm text-slate-300">Neurotoxicity Risk Factors*</span>
            </label>
          </div>
        </div>
        <div className="text-xs text-slate-500 p-2 bg-slate-700/30 rounded">
          *Risk factors: isoimmune hemolytic disease, G6PD deficiency, asphyxia, sepsis, acidosis, albumin &lt;3.0 g/dL
        </div>
        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          Calculate
        </button>
        {result && (
          <div className="mt-4 space-y-4">
            <div className={`p-4 rounded-lg border ${
              result.risk === 'critical' ? 'bg-red-500/20 border-red-500' :
              result.risk === 'high' ? 'bg-yellow-500/20 border-yellow-500' :
              result.risk === 'intermediate' ? 'bg-orange-500/20 border-orange-500' :
              'bg-green-500/20 border-green-500'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-400">Risk Zone</span>
                  <p className={`text-xl font-bold ${
                    result.risk === 'critical' ? 'text-red-400' :
                    result.risk === 'high' ? 'text-yellow-400' :
                    result.risk === 'intermediate' ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {result.risk.toUpperCase()} RISK
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-slate-400">Recommendation</span>
                  <p className="text-lg font-medium text-white">
                    {result.risk === 'critical' ? 'URGENT: Consider Exchange' :
                     result.needsPhoto ? 'Start Phototherapy' : 'Monitor / Repeat in 12-24h'}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-400">Phototherapy Threshold</span>
                <p className="text-lg font-bold text-yellow-400">{result.photoThreshold} mg/dL</p>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-400">Exchange Threshold</span>
                <p className="text-lg font-bold text-red-400">{result.exchangeThreshold} mg/dL</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Based on AAP 2022 Clinical Practice Guideline. Always verify with BiliTool or institutional protocol.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FluidCalculator() {
  const [weight, setWeight] = useState('');
  const [ga, setGa] = useState('32');
  const [dol, setDol] = useState('1');
  const [modifiers, setModifiers] = useState({
    phototherapy: false,
    radiantWarmer: false,
    lowHumidity: false,
    renalIssues: false,
    cardiacIssues: false,
  });
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight) / 1000; // Convert to kg
    const day = parseInt(dol);
    const gaWeeks = parseInt(ga);

    // Base fluid requirements by DOL (mL/kg/day)
    // Standard NICU guidelines - adjustments based on GA
    let baseRates;
    if (gaWeeks < 28) {
      // Extremely preterm - higher insensible losses
      baseRates = { 1: 80, 2: 100, 3: 120, 4: 140, 5: 150, 6: 160, 7: 160 };
    } else if (gaWeeks < 32) {
      // Very preterm
      baseRates = { 1: 70, 2: 90, 3: 110, 4: 130, 5: 150, 6: 150, 7: 150 };
    } else if (gaWeeks < 37) {
      // Late preterm
      baseRates = { 1: 60, 2: 80, 3: 100, 4: 120, 5: 140, 6: 150, 7: 150 };
    } else {
      // Term
      baseRates = { 1: 60, 2: 80, 3: 100, 4: 120, 5: 140, 6: 150, 7: 150 };
    }

    let baseRate = baseRates[Math.min(day, 7)] || 150;

    // Apply modifiers based on clinical conditions
    let adjustedRate = baseRate;
    let adjustmentNotes = [];

    if (modifiers.phototherapy) {
      adjustedRate += 20;
      adjustmentNotes.push('+20 mL/kg/day (phototherapy)');
    }
    if (modifiers.radiantWarmer) {
      adjustedRate += 20;
      adjustmentNotes.push('+20 mL/kg/day (radiant warmer)');
    }
    if (modifiers.lowHumidity) {
      adjustedRate += 10;
      adjustmentNotes.push('+10 mL/kg/day (low humidity <60%)');
    }
    if (modifiers.renalIssues) {
      adjustedRate -= 20;
      adjustmentNotes.push('-20 mL/kg/day (renal issues - adjust per output)');
    }
    if (modifiers.cardiacIssues) {
      adjustedRate -= 30;
      adjustmentNotes.push('-30 mL/kg/day (cardiac restriction)');
    }

    const totalMl = adjustedRate * w;
    const hourlyMl = totalMl / 24;

    // Calculate sodium and potassium needs
    // Standard: Na 2-4 mEq/kg/day, K 1-2 mEq/kg/day (start K after DOL 2 and with urine output)
    const sodiumNeed = day === 1 ? 0 : (3 * w).toFixed(1);
    const potassiumNeed = day <= 2 ? 0 : (2 * w).toFixed(1);

    setResult({
      baseRate,
      adjustedRate,
      totalMl: totalMl.toFixed(1),
      hourlyMl: hourlyMl.toFixed(2),
      adjustmentNotes,
      sodiumNeed,
      potassiumNeed,
      gaCategory: gaWeeks < 28 ? 'Extremely Preterm' : gaWeeks < 32 ? 'Very Preterm' : gaWeeks < 37 ? 'Late Preterm' : 'Term'
    });
  };

  const toggleModifier = (key) => {
    setModifiers({ ...modifiers, [key]: !modifiers[key] });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-2">Fluid Requirements Calculator</h3>
      <p className="text-sm text-slate-400 mb-4">Based on GA and clinical conditions</p>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="1500"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">GA (weeks)</label>
            <input
              type="number"
              value={ga}
              onChange={(e) => setGa(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Day of Life</label>
            <select value={dol} onChange={(e) => setDol(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
              {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>DOL {d}</option>)}
              <option value="8">DOL 7+</option>
            </select>
          </div>
        </div>

        {/* Clinical Modifiers */}
        <div className="border-t border-slate-700 pt-4">
          <label className="block text-sm text-slate-400 mb-2">Clinical Adjustments</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'phototherapy', label: 'Phototherapy', color: 'yellow' },
              { key: 'radiantWarmer', label: 'Radiant Warmer', color: 'orange' },
              { key: 'lowHumidity', label: 'Low Humidity', color: 'blue' },
              { key: 'renalIssues', label: 'Renal Issues', color: 'red' },
              { key: 'cardiacIssues', label: 'Cardiac Restriction', color: 'purple' },
            ].map((mod) => (
              <button
                key={mod.key}
                onClick={() => toggleModifier(mod.key)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  modifiers[mod.key]
                    ? `bg-${mod.color}-500/30 text-${mod.color}-400 border border-${mod.color}-500/50`
                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                {modifiers[mod.key] ? '✓ ' : ''}{mod.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          Calculate Fluid Requirements
        </button>

        {result && (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-cyan-400">Fluid Requirements ({result.gaCategory})</h4>
                {result.adjustmentNotes.length > 0 && (
                  <span className="text-xs text-yellow-400">Adjusted</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-slate-400">Base Rate</span>
                  <p className="text-lg font-bold text-slate-300">{result.baseRate} mL/kg/d</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Adjusted Rate</span>
                  <p className="text-xl font-bold text-cyan-400">{result.adjustedRate} mL/kg/d</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Total/24hr</span>
                  <p className="text-xl font-bold text-white">{result.totalMl} mL</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Hourly Rate</span>
                  <p className="text-xl font-bold text-green-400">{result.hourlyMl} mL/hr</p>
                </div>
              </div>
            </div>

            {result.adjustmentNotes.length > 0 && (
              <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/30">
                <span className="text-xs text-yellow-400 font-medium">Adjustments Applied:</span>
                <ul className="text-xs text-yellow-300 mt-1">
                  {result.adjustmentNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <span className="text-xs text-slate-400">Sodium (DOL {dol})</span>
                <p className="text-lg font-bold text-white">
                  {result.sodiumNeed === 0 ? 'None DOL 1' : `${result.sodiumNeed} mEq/day`}
                </p>
                <span className="text-xs text-slate-500">Target: 2-4 mEq/kg/day</span>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <span className="text-xs text-slate-400">Potassium (DOL {dol})</span>
                <p className="text-lg font-bold text-white">
                  {result.potassiumNeed === 0 ? 'Hold until UOP' : `${result.potassiumNeed} mEq/day`}
                </p>
                <span className="text-xs text-slate-500">Target: 1-2 mEq/kg/day after DOL 2</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 p-2 bg-slate-700/20 rounded">
              <p className="font-medium text-slate-400 mb-1">Clinical Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Target urine output: 1-3 mL/kg/hr</li>
                <li>Monitor weight daily (expect 5-10% loss in first week)</li>
                <li>Adjust based on serum Na, fluid balance, clinical status</li>
                <li>Higher rates for ELBW infants in first week due to insensible losses</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GIRCalculator() {
  const [weight, setWeight] = useState('');
  const [dextrose, setDextrose] = useState('10');
  const [rate, setRate] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight) / 1000;
    const d = parseFloat(dextrose);
    const r = parseFloat(rate);
    const gir = (d * r) / (6 * w);
    setResult({ gir: gir.toFixed(1), isOptimal: gir >= 4 && gir <= 8 });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">GIR Calculator</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Dextrose (%)</label>
            <input type="number" value={dextrose} onChange={(e) => setDextrose(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rate (mL/hr)</label>
            <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
        </div>
        <button onClick={calculate} className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Calculate</button>
        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.isOptimal ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
            <span className="text-sm text-slate-400">GIR</span>
            <p className={`text-2xl font-bold ${result.isOptimal ? 'text-green-400' : 'text-yellow-400'}`}>
              {result.gir} mg/kg/min
            </p>
            <p className="text-xs text-slate-400 mt-1">Target: 4-8 mg/kg/min</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalorieCalculator() {
  const [weight, setWeight] = useState('');
  const [tpnVolume, setTpnVolume] = useState('');
  const [dextrose, setDextrose] = useState('10');
  const [aminoAcids, setAminoAcids] = useState('3');
  const [lipids, setLipids] = useState('2');
  const [enteralVolume, setEnteralVolume] = useState('');
  const [enteralCal, setEnteralCal] = useState('24');
  const [feedsPerDay, setFeedsPerDay] = useState('8');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight) / 1000; // kg
    if (w <= 0) return;

    const tpnVol = parseFloat(tpnVolume) || 0; // mL/day
    const dex = parseFloat(dextrose) || 0; // %
    const aa = parseFloat(aminoAcids) || 0; // g/kg/day
    const lip = parseFloat(lipids) || 0; // g/kg/day
    const entVol = parseFloat(enteralVolume) || 0; // mL per feed
    const entCal = parseFloat(enteralCal) || 0; // kcal/oz
    const feeds = parseInt(feedsPerDay) || 8;

    // TPN Calorie Calculations (Standard values):
    // Dextrose: 3.4 kcal/g, concentration in g/100mL = dex%
    // Amino acids: 4 kcal/g (provided as g/kg/day)
    // Lipids 20%: 2 kcal/mL (or 10 kcal/g fat)
    const dextroseCal = (dex / 100) * tpnVol * 3.4; // g * kcal/g
    const aminoCal = aa * w * 4; // g/kg/day * kg * kcal/g
    const lipidCal = lip * w * 10; // g/kg/day * kg * kcal/g (20% lipids = 2kcal/mL * g delivered)
    const tpnCalPerDay = dextroseCal + aminoCal + lipidCal;

    // Enteral Calorie Calculation
    // Convert kcal/oz to kcal/mL: 1 oz = 30 mL
    const kcalPerMl = entCal / 30;
    const totalEnteralCal = entVol * feeds * kcalPerMl;

    const totalCal = tpnCalPerDay + totalEnteralCal;
    const calPerKg = totalCal / w;
    const proteinPerKg = aa + (totalEnteralCal > 0 ? (entVol * feeds * 0.01) / w : 0); // Approximate enteral protein

    // Optimal range for preterm: 110-130 kcal/kg/day
    const isOptimal = calPerKg >= 110 && calPerKg <= 130;
    const isLow = calPerKg < 90;
    const isHigh = calPerKg > 140;

    setResult({
      dextroseCal: dextroseCal.toFixed(1),
      aminoCal: aminoCal.toFixed(1),
      lipidCal: lipidCal.toFixed(1),
      tpnCal: tpnCalPerDay.toFixed(1),
      enteralCal: totalEnteralCal.toFixed(1),
      totalCal: totalCal.toFixed(1),
      calPerKg: calPerKg.toFixed(1),
      proteinPerKg: proteinPerKg.toFixed(1),
      isOptimal,
      isLow,
      isHigh
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Calorie Calculator</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" placeholder="1200" />
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-cyan-400 mb-3">TPN/Parenteral Nutrition</h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Volume (mL/day)</label>
              <input type="number" value={tpnVolume} onChange={(e) => setTpnVolume(e.target.value)} placeholder="100" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dextrose (%)</label>
              <input type="number" value={dextrose} onChange={(e) => setDextrose(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amino Acids (g/kg/d)</label>
              <input type="number" step="0.5" value={aminoAcids} onChange={(e) => setAminoAcids(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lipids (g/kg/d)</label>
              <input type="number" step="0.5" value={lipids} onChange={(e) => setLipids(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Caloric values: Dextrose 3.4 kcal/g, Protein 4 kcal/g, Lipids 10 kcal/g</p>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-green-400 mb-3">Enteral Feeds</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Volume per feed (mL)</label>
              <input type="number" value={enteralVolume} onChange={(e) => setEnteralVolume(e.target.value)} placeholder="15" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Feeds per day</label>
              <select value={feedsPerDay} onChange={(e) => setFeedsPerDay(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="8">8 (q3h)</option>
                <option value="6">6 (q4h)</option>
                <option value="12">12 (q2h)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Caloric density (kcal/oz)</label>
              <select value={enteralCal} onChange={(e) => setEnteralCal(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="20">20 kcal/oz (Standard)</option>
                <option value="22">22 kcal/oz</option>
                <option value="24">24 kcal/oz (Fortified)</option>
                <option value="27">27 kcal/oz</option>
                <option value="30">30 kcal/oz</option>
              </select>
            </div>
          </div>
        </div>

        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Calculate Total Calories</button>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${result.isOptimal ? 'bg-green-500/20 border-green-500/50' : result.isLow ? 'bg-red-500/20 border-red-500/50' : 'bg-yellow-500/20 border-yellow-500/50'}`}>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-slate-700/50 p-3 rounded">
                <span className="text-xs text-slate-400">TPN Breakdown</span>
                <div className="text-sm mt-1">
                  <div className="flex justify-between"><span className="text-slate-300">Dextrose:</span><span className="text-cyan-400">{result.dextroseCal} kcal</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">Protein:</span><span className="text-cyan-400">{result.aminoCal} kcal</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">Lipids:</span><span className="text-cyan-400">{result.lipidCal} kcal</span></div>
                  <div className="flex justify-between border-t border-slate-600 pt-1 mt-1"><span className="text-white font-medium">TPN Total:</span><span className="text-cyan-400 font-bold">{result.tpnCal} kcal</span></div>
                </div>
              </div>
              <div className="bg-slate-700/50 p-3 rounded">
                <span className="text-xs text-slate-400">Enteral</span>
                <p className="text-2xl font-bold text-green-400 mt-1">{result.enteralCal} kcal</p>
                <span className="text-xs text-slate-400">Total Daily:</span>
                <p className="text-xl font-bold text-white">{result.totalCal} kcal</p>
              </div>
            </div>
            <div className="border-t border-slate-600 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-400">Calories per kg/day:</span>
                  <span className={`ml-2 text-xl font-bold ${result.isOptimal ? 'text-green-400' : result.isLow ? 'text-red-400' : 'text-yellow-400'}`}>{result.calPerKg} kcal/kg</span>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${result.isOptimal ? 'bg-green-500/30 text-green-400' : result.isLow ? 'bg-red-500/30 text-red-400' : 'bg-yellow-500/30 text-yellow-400'}`}>
                  {result.isOptimal ? 'Optimal' : result.isLow ? 'Low - Increase' : result.isHigh ? 'High' : 'Adjust intake'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Target: 110-130 kcal/kg/day for optimal preterm growth. Protein: {result.proteinPerKg} g/kg/day (target 3.5-4 g/kg/day)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function APGARCalculator() {
  const [scores, setScores] = useState({ hr: 0, resp: 0, tone: 0, reflex: 0, color: 0 });
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">APGAR Score Calculator</h3>
      <div className="space-y-4">
        {[
          { key: 'hr', label: 'Heart Rate', opts: ['Absent', '<100', '≥100'] },
          { key: 'resp', label: 'Respiratory Effort', opts: ['Absent', 'Slow/Irregular', 'Good/Crying'] },
          { key: 'tone', label: 'Muscle Tone', opts: ['Limp', 'Some Flexion', 'Active Motion'] },
          { key: 'reflex', label: 'Reflex Irritability', opts: ['No Response', 'Grimace', 'Cry/Cough'] },
          { key: 'color', label: 'Color', opts: ['Blue/Pale', 'Body Pink', 'All Pink'] },
        ].map((item) => (
          <div key={item.key} className="flex items-center gap-4">
            <span className="w-40 text-sm text-slate-300">{item.label}</span>
            <div className="flex gap-2">
              {item.opts.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setScores({ ...scores, [item.key]: i })}
                  className={`px-3 py-1 rounded text-sm ${
                    scores[item.key] === i
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {i} - {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className={`mt-4 p-4 rounded-lg text-center ${
          total >= 7 ? 'bg-green-500/20' : total >= 4 ? 'bg-yellow-500/20' : 'bg-red-500/20'
        }`}>
          <span className="text-sm text-slate-400">Total APGAR Score</span>
          <p className={`text-4xl font-bold ${
            total >= 7 ? 'text-green-400' : total >= 4 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {total}/10
          </p>
        </div>
      </div>
    </div>
  );
}

function SNAPPECalculator() {
  const [values, setValues] = useState({
    birthWeight: '',
    sga: false,
    apgar5: '',
    lowestTemp: '',
    lowestBP: '',
    lowestPH: '',
    lowestPO2FiO2: '',
    multipleSeizures: false,
    urineOutput: '',
  });
  const [result, setResult] = useState(null);

  const calculate = () => {
    let score = 0;

    // Birth Weight scoring
    const bw = parseFloat(values.birthWeight);
    if (bw < 750) score += 18;
    else if (bw < 1000) score += 10;
    else if (bw < 1500) score += 5;

    // Small for Gestational Age
    if (values.sga) score += 12;

    // APGAR at 5 minutes
    const apgar = parseInt(values.apgar5);
    if (apgar < 7) score += 18;

    // Lowest Temperature (first 12 hours)
    const temp = parseFloat(values.lowestTemp);
    if (temp < 35) score += 8;
    else if (temp < 36) score += 5;

    // Lowest Mean BP (first 12 hours)
    const bp = parseFloat(values.lowestBP);
    if (bp < 20) score += 16;
    else if (bp < 30) score += 7;

    // Lowest pH
    const ph = parseFloat(values.lowestPH);
    if (ph < 7.1) score += 16;
    else if (ph < 7.2) score += 7;

    // Lowest PO2/FiO2 ratio
    const ratio = parseFloat(values.lowestPO2FiO2);
    if (ratio < 100) score += 14;
    else if (ratio < 250) score += 5;

    // Multiple Seizures
    if (values.multipleSeizures) score += 19;

    // Urine Output (mL/kg/hr in first 12 hours)
    const urine = parseFloat(values.urineOutput);
    if (urine < 0.5) score += 18;
    else if (urine < 1.0) score += 5;

    // Calculate mortality risk based on score
    let mortalityRisk;
    if (score < 10) mortalityRisk = '< 1%';
    else if (score < 20) mortalityRisk = '1-3%';
    else if (score < 30) mortalityRisk = '3-5%';
    else if (score < 40) mortalityRisk = '5-10%';
    else if (score < 50) mortalityRisk = '10-20%';
    else if (score < 60) mortalityRisk = '20-35%';
    else if (score < 70) mortalityRisk = '35-55%';
    else mortalityRisk = '> 55%';

    const riskLevel = score < 20 ? 'low' : score < 40 ? 'moderate' : score < 60 ? 'high' : 'critical';

    setResult({ score, mortalityRisk, riskLevel });
  };

  const updateValue = (key, value) => {
    setValues({ ...values, [key]: value });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-2">SNAPPE-II Score Calculator</h3>
      <p className="text-sm text-slate-400 mb-4">Score for Neonatal Acute Physiology with Perinatal Extension-II</p>

      <div className="space-y-4">
        {/* Birth Parameters */}
        <div className="border-b border-slate-700 pb-4">
          <h4 className="text-sm font-medium text-cyan-400 mb-3">Birth Parameters</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Birth Weight (g)</label>
              <input
                type="number"
                value={values.birthWeight}
                onChange={(e) => updateValue('birthWeight', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="1200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">APGAR at 5 min</label>
              <input
                type="number"
                min="0"
                max="10"
                value={values.apgar5}
                onChange={(e) => updateValue('apgar5', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="7"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.sga}
                  onChange={(e) => updateValue('sga', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                />
                <span className="text-sm text-slate-300">Small for GA (&lt;3rd %ile)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Physiological Parameters (First 12 hours) */}
        <div className="border-b border-slate-700 pb-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-3">Worst Values in First 12 Hours</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lowest Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={values.lowestTemp}
                onChange={(e) => updateValue('lowestTemp', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="36.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lowest Mean BP</label>
              <input
                type="number"
                value={values.lowestBP}
                onChange={(e) => updateValue('lowestBP', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="35"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lowest pH</label>
              <input
                type="number"
                step="0.01"
                value={values.lowestPH}
                onChange={(e) => updateValue('lowestPH', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="7.30"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lowest PO2/FiO2</label>
              <input
                type="number"
                value={values.lowestPO2FiO2}
                onChange={(e) => updateValue('lowestPO2FiO2', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="300"
              />
            </div>
          </div>
        </div>

        {/* Additional Parameters */}
        <div className="pb-4">
          <h4 className="text-sm font-medium text-purple-400 mb-3">Additional Parameters</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Urine Output (mL/kg/hr)</label>
              <input
                type="number"
                step="0.1"
                value={values.urineOutput}
                onChange={(e) => updateValue('urineOutput', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="1.5"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.multipleSeizures}
                  onChange={(e) => updateValue('multipleSeizures', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                />
                <span className="text-sm text-slate-300">Multiple Seizures</span>
              </label>
            </div>
          </div>
        </div>

        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          Calculate SNAPPE-II Score
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${
            result.riskLevel === 'critical' ? 'bg-red-500/20 border-red-500/50' :
            result.riskLevel === 'high' ? 'bg-orange-500/20 border-orange-500/50' :
            result.riskLevel === 'moderate' ? 'bg-yellow-500/20 border-yellow-500/50' :
            'bg-green-500/20 border-green-500/50'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-sm text-slate-400">SNAPPE-II Score</span>
                <p className={`text-3xl font-bold ${
                  result.riskLevel === 'critical' ? 'text-red-400' :
                  result.riskLevel === 'high' ? 'text-orange-400' :
                  result.riskLevel === 'moderate' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {result.score}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-400">Predicted Mortality</span>
                <p className="text-2xl font-bold text-white">{result.mortalityRisk}</p>
              </div>
            </div>
            <div className={`text-center py-2 rounded ${
              result.riskLevel === 'critical' ? 'bg-red-500/30 text-red-300' :
              result.riskLevel === 'high' ? 'bg-orange-500/30 text-orange-300' :
              result.riskLevel === 'moderate' ? 'bg-yellow-500/30 text-yellow-300' :
              'bg-green-500/30 text-green-300'
            }`}>
              {result.riskLevel.toUpperCase()} RISK
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Based on Richardson et al. SNAPPE-II scoring system for neonatal mortality prediction
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DosingCalculator() {
  const [weight, setWeight] = useState('');
  const [ga, setGa] = useState('28');
  const [pna, setPna] = useState('7'); // postnatal age in days
  const [drug, setDrug] = useState('caffeine');
  const [result, setResult] = useState(null);

  // Standard NICU drug dosing based on NeoFax/Lexicomp guidelines
  const drugs = {
    caffeine: { name: 'Caffeine Citrate', loading: 20, maintenance: 5, unit: 'mg/kg', freq: 'Once daily', notes: 'For apnea of prematurity. Can increase to 10mg/kg/day if needed.' },
    gentamicin: { name: 'Gentamicin', loading: 0, maintenance: 5, unit: 'mg/kg', freq: 'See interval', notes: 'Extended interval dosing preferred. Check levels.' },
    ampicillin: { name: 'Ampicillin', loading: 0, maintenance: 50, unit: 'mg/kg/dose', freq: 'See interval', notes: 'For early-onset sepsis. Meningitis dose: 100mg/kg/dose.' },
    vancomycin: { name: 'Vancomycin', loading: 0, maintenance: 15, unit: 'mg/kg/dose', freq: 'See interval', notes: 'For late-onset sepsis/MRSA. Target trough 10-20 mcg/mL.' },
    acyclovir: { name: 'Acyclovir', loading: 0, maintenance: 20, unit: 'mg/kg/dose', freq: 'q8h', notes: 'For HSV. Duration 14-21 days depending on CNS involvement.' },
    fluconazole: { name: 'Fluconazole (Prophylaxis)', loading: 0, maintenance: 3, unit: 'mg/kg', freq: 'Twice weekly', notes: 'For fungal prophylaxis in ELBW. Treatment: 12mg/kg loading, then 6mg/kg/day.' },
    indomethacin: { name: 'Indomethacin (PDA)', loading: 0.2, maintenance: 0.1, unit: 'mg/kg', freq: 'q12-24h x3', notes: 'For PDA closure. Adjust interval based on urine output and age.' },
    ibuprofen: { name: 'Ibuprofen (PDA)', loading: 10, maintenance: 5, unit: 'mg/kg', freq: 'q24h x3', notes: 'For PDA closure. Day 1: 10mg/kg, Days 2-3: 5mg/kg each.' },
    surfactant: { name: 'Surfactant (Curosurf)', loading: 0, maintenance: 200, unit: 'mg/kg', freq: 'First dose', notes: 'Initial: 200mg/kg, Repeat: 100mg/kg if needed. Max 3 doses.' },
    phenobarbital: { name: 'Phenobarbital', loading: 20, maintenance: 5, unit: 'mg/kg', freq: 'Once daily', notes: 'For seizures. Loading: 20mg/kg IV (can give additional 10mg/kg x2). Maintenance starts 12-24h after loading.' },
    fentanyl: { name: 'Fentanyl', loading: 0, maintenance: 1, unit: 'mcg/kg/dose', freq: 'q2-4h PRN', notes: 'For pain/sedation. Continuous: 1-5 mcg/kg/hr. Bolus: 1-2 mcg/kg. Monitor for chest rigidity.' },
    morphine: { name: 'Morphine', loading: 0, maintenance: 0.05, unit: 'mg/kg/dose', freq: 'q4h PRN', notes: 'For pain/sedation. Continuous: 10-20 mcg/kg/hr. Use with caution in preterm.' },
    dopamine: { name: 'Dopamine', loading: 0, maintenance: 5, unit: 'mcg/kg/min', freq: 'Continuous', notes: 'Low dose (2-5): renal. Medium (5-10): cardiac. High (10-20): vasopressor. Central line preferred.' },
    dobutamine: { name: 'Dobutamine', loading: 0, maintenance: 5, unit: 'mcg/kg/min', freq: 'Continuous', notes: 'For cardiac output. Range: 2.5-20 mcg/kg/min. Inotrope, minimal vasopressor effect.' },
    epinephrine: { name: 'Epinephrine', loading: 0, maintenance: 0.1, unit: 'mcg/kg/min', freq: 'Continuous', notes: 'For refractory hypotension. Range: 0.05-1 mcg/kg/min. Central line required.' },
    hydrocortisone: { name: 'Hydrocortisone (Stress)', loading: 0, maintenance: 1, unit: 'mg/kg/dose', freq: 'q8h', notes: 'For refractory hypotension/adrenal insufficiency. Taper over 5-7 days.' },
    vitaminK: { name: 'Vitamin K (Prophylaxis)', loading: 0, maintenance: 1, unit: 'mg', freq: 'Once at birth', notes: 'Term: 1mg IM. Preterm <1500g: 0.5mg IM. For hemorrhagic disease prevention.' },
  };

  const getGentamicinInterval = (gaWeeks, pnaDays) => {
    const pca = gaWeeks + Math.floor(pnaDays / 7);
    if (pca <= 29) return 'q48h';
    if (pca <= 33) return 'q36h';
    if (pca <= 37) return 'q24h';
    return 'q24h';
  };

  const getAmpicillinInterval = (gaWeeks, pnaDays) => {
    if (pnaDays <= 7) {
      if (gaWeeks <= 29) return 'q12h';
      if (gaWeeks <= 36) return 'q8h';
      return 'q8h';
    }
    return 'q8h';
  };

  const getVancomycinInterval = (gaWeeks, pnaDays) => {
    const pca = gaWeeks + Math.floor(pnaDays / 7);
    if (pca <= 29) return 'q18-24h';
    if (pca <= 35) return 'q12-18h';
    return 'q8-12h';
  };

  const calculate = () => {
    const w = parseFloat(weight) / 1000;
    const gaWeeks = parseInt(ga);
    const pnaDays = parseInt(pna);
    const d = drugs[drug];

    let freq = d.freq;
    if (drug === 'gentamicin') freq = getGentamicinInterval(gaWeeks, pnaDays);
    if (drug === 'ampicillin') freq = getAmpicillinInterval(gaWeeks, pnaDays);
    if (drug === 'vancomycin') freq = getVancomycinInterval(gaWeeks, pnaDays);

    const loadingDose = d.loading ? (d.loading * w).toFixed(2) : null;
    const maintenanceDose = (d.maintenance * w).toFixed(2);
    setResult({ ...d, loadingDose, maintenanceDose, freq });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Drug Dosing Calculator</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1200" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">GA at Birth (weeks)</label>
            <input type="number" value={ga} onChange={(e) => setGa(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Postnatal Age (days)</label>
            <input type="number" value={pna} onChange={(e) => setPna(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Medication</label>
          <select value={drug} onChange={(e) => setDrug(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
            {Object.entries(drugs).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Calculate Dose</button>
        {result && (
          <div className="mt-4 p-4 bg-slate-700/50 rounded-lg space-y-3">
            <p className="font-semibold text-lg text-white">{result.name}</p>
            <div className="grid grid-cols-2 gap-4">
              {result.loadingDose && (
                <div className="bg-cyan-500/20 p-3 rounded">
                  <span className="text-xs text-slate-400">Loading Dose</span>
                  <p className="text-xl font-bold text-cyan-400">{result.loadingDose} mg</p>
                </div>
              )}
              <div className="bg-green-500/20 p-3 rounded">
                <span className="text-xs text-slate-400">Maintenance Dose</span>
                <p className="text-xl font-bold text-green-400">{result.maintenanceDose} mg</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Frequency:</span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm font-medium">{result.freq}</span>
            </div>
            <p className="text-xs text-slate-500 border-t border-slate-600 pt-2">{result.notes}</p>
            <p className="text-xs text-yellow-500">⚠️ Always verify with pharmacy and institutional protocols. Consider renal function.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ETTCalculator() {
  const [weight, setWeight] = useState('');
  const [ga, setGa] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight) / 1000; // Convert to kg
    const weeks = parseInt(ga);

    // ETT Size based on weight (NRP 8th Edition Guidelines)
    // Weight-based sizing is preferred for neonates
    let size, altSize;
    if (w < 1) {
      size = 2.5;
      altSize = '2.5';
    } else if (w < 2) {
      size = 3.0;
      altSize = '2.5-3.0';
    } else if (w < 3) {
      size = 3.5;
      altSize = '3.0-3.5';
    } else {
      size = 3.5;
      altSize = '3.5-4.0';
    }

    // GA-based sizing (alternative method per NRP)
    // Generally: GA/10 for term, but weight-based preferred
    let gaSizeRec = '';
    if (weeks < 28) gaSizeRec = '2.5';
    else if (weeks < 34) gaSizeRec = '3.0';
    else if (weeks < 38) gaSizeRec = '3.0-3.5';
    else gaSizeRec = '3.5';

    // Depth of insertion formulas (NRP Guidelines):
    // Nasal (NTL): 7 + weight(kg) from nares
    // Oral (OTL): 6 + weight(kg) from lip
    // Alternative for preterm: Sternal notch to nasal tip (SNAP)
    const oralDepth = 6 + w;
    const nasalDepth = 7 + w;

    // Weight-based quick reference (cm at lip)
    // Commonly used: Weight(kg) + 6 for oral
    let depthByWeight = '';
    if (w < 1) depthByWeight = '6.5-7';
    else if (w < 1.5) depthByWeight = '7-7.5';
    else if (w < 2) depthByWeight = '7.5-8';
    else if (w < 2.5) depthByWeight = '8-8.5';
    else if (w < 3) depthByWeight = '8.5-9';
    else depthByWeight = '9-10';

    // Suction catheter size (French) = ETT size × 2
    const suctionCath = size * 2;

    setResult({
      size,
      altSize,
      gaSizeRec,
      oralDepth: oralDepth.toFixed(1),
      nasalDepth: nasalDepth.toFixed(1),
      depthByWeight,
      suctionCath,
      weightKg: w.toFixed(2)
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-2">ETT Size & Depth Calculator</h3>
      <p className="text-sm text-slate-400 mb-4">Based on NRP 8th Edition Guidelines</p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1500" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">GA (weeks)</label>
            <input type="number" value={ga} onChange={(e) => setGa(e.target.value)} placeholder="32" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
          </div>
        </div>
        <button onClick={calculate} className="w-full px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Calculate</button>
        {result && (
          <div className="mt-4 space-y-4">
            {/* ETT Size */}
            <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <h4 className="text-sm font-medium text-cyan-400 mb-3">ETT Size (Uncuffed)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-slate-400">Recommended</span>
                  <p className="text-2xl font-bold text-cyan-400">{result.size} mm</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Range by Weight</span>
                  <p className="text-lg font-bold text-white">{result.altSize} mm</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">By GA ({ga} wks)</span>
                  <p className="text-lg font-bold text-slate-300">{result.gaSizeRec} mm</p>
                </div>
              </div>
            </div>

            {/* Depth of Insertion */}
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <h4 className="text-sm font-medium text-green-400 mb-3">Depth of Insertion</h4>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-slate-700/50 p-3 rounded">
                  <span className="text-xs text-slate-400">Oral (OTL) at lip</span>
                  <p className="text-2xl font-bold text-green-400">{result.oralDepth} cm</p>
                  <span className="text-xs text-slate-500">Formula: 6 + Weight(kg)</span>
                </div>
                <div className="bg-slate-700/50 p-3 rounded">
                  <span className="text-xs text-slate-400">Nasal (NTL) at nares</span>
                  <p className="text-2xl font-bold text-yellow-400">{result.nasalDepth} cm</p>
                  <span className="text-xs text-slate-500">Formula: 7 + Weight(kg)</span>
                </div>
              </div>
              <div className="text-sm text-slate-400">
                <span className="text-slate-500">Quick Reference for {result.weightKg} kg: </span>
                <span className="text-white font-medium">{result.depthByWeight} cm at lip</span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Suction Catheter Size</span>
                  <p className="text-lg font-bold text-purple-400">{result.suctionCath} Fr</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>ETT × 2 = Suction catheter (Fr)</div>
                  <div>Always have size above & below available</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 p-2 bg-slate-700/20 rounded">
              <p className="font-medium text-yellow-500 mb-1">⚠️ Clinical Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Confirm placement with CO2 detector and chest X-ray</li>
                <li>ETT tip should be at T1-T2 level on CXR</li>
                <li>Adjust depth if asymmetric breath sounds</li>
                <li>Consider cuffed ETT only for infants &gt;3kg with high airway pressures</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Pain Assessment Calculator (NIPS & FLACC)
function PainAssessmentCalculator() {
  const [scale, setScale] = useState('nips');
  const [scores, setScores] = useState({});
  const [result, setResult] = useState(null);

  // NIPS (Neonatal Infant Pain Scale) - for preterm and term newborns
  const nipsCategories = [
    {
      id: 'facial',
      name: 'Facial Expression',
      options: [
        { value: 0, label: 'Relaxed muscles', desc: 'Restful face, neutral expression' },
        { value: 1, label: 'Grimace', desc: 'Tight facial muscles, furrowed brow, chin, jaw' },
      ],
    },
    {
      id: 'cry',
      name: 'Cry',
      options: [
        { value: 0, label: 'No cry', desc: 'Quiet, not crying' },
        { value: 1, label: 'Whimper', desc: 'Mild moaning, intermittent' },
        { value: 2, label: 'Vigorous cry', desc: 'Loud scream, rising, shrill, continuous' },
      ],
    },
    {
      id: 'breathing',
      name: 'Breathing Patterns',
      options: [
        { value: 0, label: 'Relaxed', desc: 'Usual pattern for infant' },
        { value: 1, label: 'Change in breathing', desc: 'Irregular, faster than usual, gagging, breath holding' },
      ],
    },
    {
      id: 'arms',
      name: 'Arms',
      options: [
        { value: 0, label: 'Relaxed/restrained', desc: 'No muscular rigidity, occasional random movements' },
        { value: 1, label: 'Flexed/extended', desc: 'Tense, straight arms, rigid, rapid extension/flexion' },
      ],
    },
    {
      id: 'legs',
      name: 'Legs',
      options: [
        { value: 0, label: 'Relaxed/restrained', desc: 'No muscular rigidity, occasional random movements' },
        { value: 1, label: 'Flexed/extended', desc: 'Tense, straight legs, rigid, rapid extension/flexion' },
      ],
    },
    {
      id: 'arousal',
      name: 'State of Arousal',
      options: [
        { value: 0, label: 'Sleeping/awake', desc: 'Quiet, peaceful, sleeping or alert and settled' },
        { value: 1, label: 'Fussy', desc: 'Alert, restless, thrashing' },
      ],
    },
  ];

  // FLACC (Face, Legs, Activity, Cry, Consolability) - for 2 months to 7 years
  const flaccCategories = [
    {
      id: 'face',
      name: 'Face',
      options: [
        { value: 0, label: 'No expression or smile', desc: 'No particular expression or smile' },
        { value: 1, label: 'Occasional grimace', desc: 'Occasional grimace or frown, withdrawn, disinterested' },
        { value: 2, label: 'Frequent grimace', desc: 'Frequent to constant quivering chin, clenched jaw' },
      ],
    },
    {
      id: 'legs',
      name: 'Legs',
      options: [
        { value: 0, label: 'Normal position', desc: 'Normal position or relaxed' },
        { value: 1, label: 'Uneasy, restless', desc: 'Uneasy, restless, tense' },
        { value: 2, label: 'Kicking', desc: 'Kicking, or legs drawn up' },
      ],
    },
    {
      id: 'activity',
      name: 'Activity',
      options: [
        { value: 0, label: 'Lying quietly', desc: 'Lying quietly, normal position, moves easily' },
        { value: 1, label: 'Squirming', desc: 'Squirming, shifting back and forth, tense' },
        { value: 2, label: 'Arched, rigid', desc: 'Arched, rigid, or jerking' },
      ],
    },
    {
      id: 'cry',
      name: 'Cry',
      options: [
        { value: 0, label: 'No cry', desc: 'No cry (awake or asleep)' },
        { value: 1, label: 'Moans, whimpers', desc: 'Moans or whimpers, occasional complaint' },
        { value: 2, label: 'Crying steadily', desc: 'Crying steadily, screams, sobs, frequent complaints' },
      ],
    },
    {
      id: 'consolability',
      name: 'Consolability',
      options: [
        { value: 0, label: 'Content, relaxed', desc: 'Content, relaxed' },
        { value: 1, label: 'Reassured', desc: 'Reassured by occasional touching, hugging, being talked to' },
        { value: 2, label: 'Difficult to console', desc: 'Difficult to console or comfort' },
      ],
    },
  ];

  const categories = scale === 'nips' ? nipsCategories : flaccCategories;
  const maxScore = scale === 'nips' ? 7 : 10;

  const calculate = () => {
    const total = Object.values(scores).reduce((sum, val) => sum + (val || 0), 0);
    let interpretation = '';
    let severity = '';

    if (scale === 'nips') {
      if (total <= 2) {
        interpretation = 'No pain to mild discomfort';
        severity = 'low';
      } else if (total <= 4) {
        interpretation = 'Mild to moderate pain';
        severity = 'medium';
      } else {
        interpretation = 'Severe pain - intervention recommended';
        severity = 'high';
      }
    } else {
      if (total === 0) {
        interpretation = 'Relaxed and comfortable';
        severity = 'low';
      } else if (total <= 3) {
        interpretation = 'Mild discomfort';
        severity = 'low';
      } else if (total <= 6) {
        interpretation = 'Moderate pain';
        severity = 'medium';
      } else {
        interpretation = 'Severe discomfort/pain';
        severity = 'high';
      }
    }

    setResult({ total, interpretation, severity, maxScore });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Pain Assessment Scale</h3>

      {/* Scale Selection */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setScale('nips'); setScores({}); setResult(null); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            scale === 'nips' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          NIPS (Neonates)
        </button>
        <button
          onClick={() => { setScale('flacc'); setScores({}); setResult(null); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            scale === 'flacc' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          FLACC (Infants/Children)
        </button>
      </div>

      {/* Categories */}
      <div className="space-y-4 mb-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-slate-900/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">{cat.name}</label>
            <div className="space-y-2">
              {cat.options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${
                    scores[cat.id] === opt.value ? 'bg-cyan-500/20' : 'hover:bg-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={cat.id}
                    checked={scores[cat.id] === opt.value}
                    onChange={() => setScores({ ...scores, [cat.id]: opt.value })}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-white text-sm">{opt.value} - {opt.label}</span>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={calculate}
        disabled={Object.keys(scores).length < categories.length}
        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
      >
        Calculate Score
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.severity === 'high' ? 'bg-red-900/30 border border-red-500/50' :
          result.severity === 'medium' ? 'bg-yellow-900/30 border border-yellow-500/50' :
          'bg-green-900/30 border border-green-500/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">Total Score:</span>
            <span className={`text-2xl font-bold ${
              result.severity === 'high' ? 'text-red-400' :
              result.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {result.total} / {result.maxScore}
            </span>
          </div>
          <p className={`text-sm font-medium ${
            result.severity === 'high' ? 'text-red-400' :
            result.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {result.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

// Blood Gas Interpreter
function BloodGasCalculator() {
  const [values, setValues] = useState({
    ph: '',
    pco2: '',
    hco3: '',
    po2: '',
    sao2: '',
    lactate: '',
    baseExcess: '',
  });
  const [sampleType, setSampleType] = useState('arterial');
  const [result, setResult] = useState(null);

  const normalRanges = {
    arterial: {
      ph: [7.35, 7.45],
      pco2: [35, 45],
      hco3: [22, 26],
      po2: [80, 100],
      sao2: [95, 100],
      baseExcess: [-2, 2],
    },
    venous: {
      ph: [7.31, 7.41],
      pco2: [41, 51],
      hco3: [22, 26],
      po2: [35, 45],
      sao2: [70, 80],
      baseExcess: [-2, 2],
    },
    capillary: {
      ph: [7.32, 7.42],
      pco2: [38, 48],
      hco3: [22, 26],
      po2: [60, 80],
      sao2: [90, 95],
      baseExcess: [-2, 2],
    },
  };

  const interpret = () => {
    const ph = parseFloat(values.ph);
    const pco2 = parseFloat(values.pco2);
    const hco3 = parseFloat(values.hco3);
    const ranges = normalRanges[sampleType];

    if (isNaN(ph) || isNaN(pco2) || isNaN(hco3)) {
      return;
    }

    let acidBase = '';
    let respiratory = '';
    let metabolic = '';
    let compensation = '';
    let severity = 'normal';

    // Determine acid-base status
    if (ph < ranges.ph[0]) {
      acidBase = 'Acidemia';
      severity = 'abnormal';
    } else if (ph > ranges.ph[1]) {
      acidBase = 'Alkalemia';
      severity = 'abnormal';
    } else {
      acidBase = 'Normal pH';
    }

    // Determine respiratory component
    if (pco2 > ranges.pco2[1]) {
      respiratory = 'Respiratory Acidosis';
    } else if (pco2 < ranges.pco2[0]) {
      respiratory = 'Respiratory Alkalosis';
    } else {
      respiratory = 'Normal respiratory component';
    }

    // Determine metabolic component
    if (hco3 < ranges.hco3[0]) {
      metabolic = 'Metabolic Acidosis';
    } else if (hco3 > ranges.hco3[1]) {
      metabolic = 'Metabolic Alkalosis';
    } else {
      metabolic = 'Normal metabolic component';
    }

    // Determine primary disorder and compensation
    if (ph < ranges.ph[0]) {
      if (pco2 > ranges.pco2[1] && hco3 >= ranges.hco3[0]) {
        compensation = 'Primary Respiratory Acidosis';
        if (hco3 > ranges.hco3[1]) compensation += ' with metabolic compensation';
      } else if (hco3 < ranges.hco3[0] && pco2 <= ranges.pco2[1]) {
        compensation = 'Primary Metabolic Acidosis';
        if (pco2 < ranges.pco2[0]) compensation += ' with respiratory compensation';
      } else if (pco2 > ranges.pco2[1] && hco3 < ranges.hco3[0]) {
        compensation = 'Mixed Respiratory and Metabolic Acidosis';
        severity = 'critical';
      }
    } else if (ph > ranges.ph[1]) {
      if (pco2 < ranges.pco2[0] && hco3 <= ranges.hco3[1]) {
        compensation = 'Primary Respiratory Alkalosis';
        if (hco3 < ranges.hco3[0]) compensation += ' with metabolic compensation';
      } else if (hco3 > ranges.hco3[1] && pco2 >= ranges.pco2[0]) {
        compensation = 'Primary Metabolic Alkalosis';
        if (pco2 > ranges.pco2[1]) compensation += ' with respiratory compensation';
      } else if (pco2 < ranges.pco2[0] && hco3 > ranges.hco3[1]) {
        compensation = 'Mixed Respiratory and Metabolic Alkalosis';
      }
    } else {
      // Normal pH
      if (pco2 !== ranges.pco2[0] && hco3 !== ranges.hco3[0]) {
        compensation = 'Fully Compensated or Mixed Disorder';
      } else {
        compensation = 'Normal acid-base status';
      }
    }

    // Check oxygenation
    let oxygenation = '';
    const po2 = parseFloat(values.po2);
    if (!isNaN(po2)) {
      if (po2 < ranges.po2[0]) {
        oxygenation = 'Hypoxemia';
        severity = severity === 'critical' ? 'critical' : 'abnormal';
      } else if (po2 > ranges.po2[1]) {
        oxygenation = 'Hyperoxemia';
      } else {
        oxygenation = 'Normal oxygenation';
      }
    }

    setResult({
      acidBase,
      respiratory,
      metabolic,
      compensation,
      oxygenation,
      severity,
      ranges,
    });
  };

  const getValueStatus = (key, value) => {
    const ranges = normalRanges[sampleType];
    const num = parseFloat(value);
    if (isNaN(num) || !ranges[key]) return 'normal';
    if (num < ranges[key][0] || num > ranges[key][1]) return 'abnormal';
    return 'normal';
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Blood Gas Interpreter</h3>

      {/* Sample Type */}
      <div className="flex gap-2 mb-6">
        {['arterial', 'venous', 'capillary'].map((type) => (
          <button
            key={type}
            onClick={() => setSampleType(type)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              sampleType === type ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {type === 'arterial' ? 'ABG' : type === 'venous' ? 'VBG' : 'CBG'}
          </button>
        ))}
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { key: 'ph', label: 'pH', unit: '' },
          { key: 'pco2', label: 'pCO₂', unit: 'mmHg' },
          { key: 'hco3', label: 'HCO₃⁻', unit: 'mEq/L' },
          { key: 'po2', label: 'pO₂', unit: 'mmHg' },
          { key: 'baseExcess', label: 'Base Excess', unit: 'mEq/L' },
          { key: 'lactate', label: 'Lactate', unit: 'mmol/L' },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-sm text-slate-400 mb-1">
              {field.label} {field.unit && <span className="text-slate-500">({field.unit})</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={values[field.key]}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              className={`w-full bg-slate-700 border rounded-lg px-4 py-2 text-white ${
                getValueStatus(field.key, values[field.key]) === 'abnormal'
                  ? 'border-red-500'
                  : 'border-slate-600'
              }`}
              placeholder={normalRanges[sampleType][field.key]?.join(' - ') || ''}
            />
          </div>
        ))}
      </div>

      <button
        onClick={interpret}
        disabled={!values.ph || !values.pco2 || !values.hco3}
        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
      >
        Interpret
      </button>

      {result && (
        <div className="mt-4 space-y-3">
          <div className={`p-4 rounded-lg ${
            result.severity === 'critical' ? 'bg-red-900/30 border border-red-500/50' :
            result.severity === 'abnormal' ? 'bg-yellow-900/30 border border-yellow-500/50' :
            'bg-green-900/30 border border-green-500/50'
          }`}>
            <h4 className="font-semibold text-white mb-2">Interpretation</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-400">pH Status:</span> <span className="text-white">{result.acidBase}</span></p>
              <p><span className="text-slate-400">Respiratory:</span> <span className="text-white">{result.respiratory}</span></p>
              <p><span className="text-slate-400">Metabolic:</span> <span className="text-white">{result.metabolic}</span></p>
              <p className="font-medium text-cyan-400 pt-2">{result.compensation}</p>
              {result.oxygenation && (
                <p><span className="text-slate-400">Oxygenation:</span> <span className="text-white">{result.oxygenation}</span></p>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 p-2 bg-slate-700/20 rounded">
            <p className="font-medium text-slate-400 mb-1">Reference Ranges ({sampleType.toUpperCase()}):</p>
            <div className="grid grid-cols-3 gap-2">
              <span>pH: {result.ranges.ph.join('-')}</span>
              <span>pCO₂: {result.ranges.pco2.join('-')}</span>
              <span>HCO₃⁻: {result.ranges.hco3.join('-')}</span>
              <span>pO₂: {result.ranges.po2.join('-')}</span>
              <span>BE: {result.ranges.baseExcess.join(' to ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ventilator Settings Calculator
function VentilatorCalculator() {
  const [patient, setPatient] = useState({
    weight: '',
    ga: '',
    diagnosis: 'rds',
  });
  const [mode, setMode] = useState('conventional');
  const [result, setResult] = useState(null);

  const diagnoses = [
    { id: 'rds', name: 'RDS (Respiratory Distress Syndrome)' },
    { id: 'mec', name: 'MAS (Meconium Aspiration)' },
    { id: 'pphn', name: 'PPHN' },
    { id: 'bpd', name: 'BPD (Chronic Lung Disease)' },
    { id: 'pneumo', name: 'Pneumothorax' },
    { id: 'apnea', name: 'Apnea of Prematurity' },
  ];

  const calculate = () => {
    const weight = parseFloat(patient.weight);
    const ga = parseFloat(patient.ga);

    if (isNaN(weight) || isNaN(ga)) return;

    let settings = {};
    let notes = [];

    if (mode === 'conventional') {
      // Conventional ventilation settings
      const tidalVolume = weight * (ga < 28 ? 4 : ga < 32 ? 5 : 6); // mL

      settings = {
        mode: 'SIMV or AC/VG',
        pip: ga < 28 ? '16-20' : ga < 32 ? '18-22' : '20-25',
        peep: ga < 28 ? '5-6' : '4-6',
        rate: ga < 28 ? '40-60' : ga < 32 ? '30-50' : '25-40',
        it: ga < 28 ? '0.30-0.35' : '0.35-0.40',
        fio2: patient.diagnosis === 'pphn' ? '1.0' : '0.30-0.40',
        tidalVolume: `${tidalVolume.toFixed(1)} mL (${ga < 28 ? '4' : ga < 32 ? '5' : '6'} mL/kg)`,
        flow: '6-10 L/min',
      };

      notes = [
        'Start with lower settings and titrate to achieve target gases',
        'Target SpO₂: ' + (ga < 28 ? '90-94%' : '91-95%'),
        'Target pH: 7.25-7.35, pCO₂: 45-55 mmHg (permissive hypercapnia)',
        'Wean FiO₂ before pressures when improving',
      ];

      if (patient.diagnosis === 'rds') {
        notes.push('Consider surfactant if FiO₂ >0.30-0.40 and worsening');
      } else if (patient.diagnosis === 'pphn') {
        notes.push('Consider iNO if OI >15-25');
        notes.push('Target pre-ductal SpO₂ 95-99%');
      } else if (patient.diagnosis === 'mec') {
        notes.push('May need higher PIP/PEEP for poor compliance');
        notes.push('Watch for air leak syndromes');
      }
    } else {
      // High-frequency ventilation (HFOV/HFJV)
      settings = {
        mode: 'HFOV',
        map: ga < 28 ? '10-14' : ga < 32 ? '12-16' : '14-18',
        amplitude: 'Start at MAP × 2, titrate for adequate chest wiggle',
        frequency: ga < 28 ? '12-15 Hz' : ga < 32 ? '10-12 Hz' : '8-10 Hz',
        fio2: patient.diagnosis === 'pphn' ? '1.0' : '0.30-0.60',
        it: '33%',
      };

      notes = [
        'MAP typically 1-2 cmH₂O higher than CMV',
        'Chest wiggle should be visible from clavicle to umbilicus',
        'Increase amplitude for higher pCO₂, increase frequency for lower pCO₂',
        'CXR should show 8-9 posterior rib expansion',
      ];

      if (patient.diagnosis === 'air') {
        notes.push('Consider lower MAP for air leak');
      }
    }

    setResult({ settings, notes, weight, ga });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Ventilator Settings Calculator</h3>

      {/* Mode Selection */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('conventional')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'conventional' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Conventional
        </button>
        <button
          onClick={() => setMode('hfo')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'hfo' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          High Frequency
        </button>
      </div>

      {/* Patient Info */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.01"
              value={patient.weight}
              onChange={(e) => setPatient({ ...patient, weight: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
              placeholder="e.g., 1.2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Gestational Age (weeks)</label>
            <input
              type="number"
              value={patient.ga}
              onChange={(e) => setPatient({ ...patient, ga: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
              placeholder="e.g., 28"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Primary Diagnosis</label>
          <select
            value={patient.diagnosis}
            onChange={(e) => setPatient({ ...patient, diagnosis: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
          >
            {diagnoses.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={calculate}
        disabled={!patient.weight || !patient.ga}
        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
      >
        Calculate Initial Settings
      </button>

      {result && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-slate-900/50 rounded-lg">
            <h4 className="font-semibold text-cyan-400 mb-3">Suggested Initial Settings</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(result.settings).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="text-white font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500 p-3 bg-slate-700/20 rounded">
            <p className="font-medium text-yellow-400 mb-2">⚠️ Clinical Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              {result.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-600 italic">
            These are suggested starting parameters only. Always individualize based on clinical response,
            blood gases, and chest X-ray findings.
          </p>
        </div>
      )}
    </div>
  );
}

// Oxygenation Index & A-a Gradient Calculator
function OxygenationIndexCalculator() {
  const [values, setValues] = useState({
    map: '',
    fio2: '',
    pao2: '',
    paco2: '',
    patm: '760', // Default atmospheric pressure at sea level
  });
  const [result, setResult] = useState(null);

  const calculate = () => {
    const map = parseFloat(values.map);
    const fio2 = parseFloat(values.fio2);
    const pao2 = parseFloat(values.pao2);
    const paco2 = parseFloat(values.paco2);
    const patm = parseFloat(values.patm);

    if (isNaN(map) || isNaN(fio2) || isNaN(pao2)) {
      return;
    }

    // Oxygenation Index (OI) = (MAP × FiO2 × 100) / PaO2
    // Higher OI indicates worse oxygenation
    const oi = (map * fio2 * 100) / pao2;

    // OI Risk Stratification
    let oiInterpretation = '';
    let oiSeverity = 'normal';
    let recommendation = '';

    if (oi < 5) {
      oiInterpretation = 'Mild respiratory failure';
      oiSeverity = 'low';
    } else if (oi < 15) {
      oiInterpretation = 'Moderate respiratory failure';
      oiSeverity = 'medium';
    } else if (oi < 25) {
      oiInterpretation = 'Severe respiratory failure';
      oiSeverity = 'high';
      recommendation = 'Consider iNO therapy';
    } else if (oi < 40) {
      oiInterpretation = 'Very severe respiratory failure';
      oiSeverity = 'critical';
      recommendation = 'iNO indicated, consider ECMO evaluation';
    } else {
      oiInterpretation = 'Critical - ECMO criteria';
      oiSeverity = 'critical';
      recommendation = 'Urgent ECMO evaluation if sustained';
    }

    // A-a Gradient calculation if we have PaCO2
    let aaGradient = null;
    let aaInterpretation = '';
    if (!isNaN(paco2)) {
      // PAO2 = FiO2 × (Patm - 47) - (PaCO2 / 0.8)
      // Water vapor pressure at body temp = 47 mmHg
      // Respiratory quotient = 0.8
      const pao2Alveolar = fio2 * (patm - 47) - (paco2 / 0.8);
      aaGradient = pao2Alveolar - pao2;

      // Normal A-a gradient in neonates on room air: 5-15 mmHg
      // Increases with higher FiO2: normal = (Age/4) + 4 for adults
      // For neonates: typically <20 mmHg on room air
      const expectedAa = fio2 <= 0.21 ? 15 : fio2 * 50; // Rough estimate

      if (aaGradient < 15) {
        aaInterpretation = 'Normal - likely hypoventilation if hypoxic';
      } else if (aaGradient < 30) {
        aaInterpretation = 'Mildly elevated - possible V/Q mismatch';
      } else if (aaGradient < 50) {
        aaInterpretation = 'Moderately elevated - significant V/Q mismatch or shunt';
      } else {
        aaInterpretation = 'Severely elevated - major shunt physiology';
      }
    }

    // PF Ratio (PaO2/FiO2 ratio)
    const pfRatio = pao2 / fio2;
    let pfInterpretation = '';
    if (pfRatio >= 400) {
      pfInterpretation = 'Normal';
    } else if (pfRatio >= 300) {
      pfInterpretation = 'Mild impairment';
    } else if (pfRatio >= 200) {
      pfInterpretation = 'Moderate (ARDS criteria)';
    } else if (pfRatio >= 100) {
      pfInterpretation = 'Severe ARDS';
    } else {
      pfInterpretation = 'Critical';
    }

    setResult({
      oi: oi.toFixed(1),
      oiInterpretation,
      oiSeverity,
      recommendation,
      aaGradient: aaGradient !== null ? aaGradient.toFixed(1) : null,
      aaInterpretation,
      pfRatio: pfRatio.toFixed(0),
      pfInterpretation,
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-2">Oxygenation Index & A-a Gradient</h3>
      <p className="text-sm text-slate-400 mb-4">Critical metrics for respiratory failure assessment</p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">MAP (cmH2O)</label>
            <input
              type="number"
              step="0.1"
              value={values.map}
              onChange={(e) => setValues({ ...values, map: e.target.value })}
              placeholder="e.g., 12"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
            <span className="text-xs text-slate-500">Mean Airway Pressure</span>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">FiO2 (decimal)</label>
            <input
              type="number"
              step="0.01"
              min="0.21"
              max="1.0"
              value={values.fio2}
              onChange={(e) => setValues({ ...values, fio2: e.target.value })}
              placeholder="e.g., 0.60"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
            <span className="text-xs text-slate-500">0.21 to 1.0</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">PaO2 (mmHg)</label>
            <input
              type="number"
              value={values.pao2}
              onChange={(e) => setValues({ ...values, pao2: e.target.value })}
              placeholder="e.g., 55"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">PaCO2 (mmHg) - optional</label>
            <input
              type="number"
              value={values.paco2}
              onChange={(e) => setValues({ ...values, paco2: e.target.value })}
              placeholder="e.g., 45"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
            <span className="text-xs text-slate-500">For A-a gradient calculation</span>
          </div>
        </div>

        <button
          onClick={calculate}
          disabled={!values.map || !values.fio2 || !values.pao2}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg transition-colors"
        >
          Calculate
        </button>

        {result && (
          <div className="mt-4 space-y-4">
            {/* Oxygenation Index */}
            <div className={`p-4 rounded-lg border ${
              result.oiSeverity === 'critical' ? 'bg-red-900/30 border-red-500/50' :
              result.oiSeverity === 'high' ? 'bg-orange-900/30 border-orange-500/50' :
              result.oiSeverity === 'medium' ? 'bg-yellow-900/30 border-yellow-500/50' :
              'bg-green-900/30 border-green-500/50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Oxygenation Index (OI)</span>
                <span className={`text-3xl font-bold ${
                  result.oiSeverity === 'critical' ? 'text-red-400' :
                  result.oiSeverity === 'high' ? 'text-orange-400' :
                  result.oiSeverity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {result.oi}
                </span>
              </div>
              <p className={`text-sm ${
                result.oiSeverity === 'critical' ? 'text-red-300' :
                result.oiSeverity === 'high' ? 'text-orange-300' :
                result.oiSeverity === 'medium' ? 'text-yellow-300' : 'text-green-300'
              }`}>
                {result.oiInterpretation}
              </p>
              {result.recommendation && (
                <p className="text-sm text-white font-medium mt-2 p-2 bg-slate-700/50 rounded">
                  {result.recommendation}
                </p>
              )}
            </div>

            {/* P/F Ratio */}
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">P/F Ratio (PaO2/FiO2)</span>
                <span className="text-xl font-bold text-cyan-400">{result.pfRatio}</span>
              </div>
              <p className="text-sm text-slate-300">{result.pfInterpretation}</p>
            </div>

            {/* A-a Gradient */}
            {result.aaGradient && (
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">A-a Gradient</span>
                  <span className="text-xl font-bold text-purple-400">{result.aaGradient} mmHg</span>
                </div>
                <p className="text-sm text-slate-300">{result.aaInterpretation}</p>
              </div>
            )}

            {/* Reference */}
            <div className="text-xs text-slate-500 p-3 bg-slate-700/20 rounded">
              <p className="font-medium text-slate-400 mb-2">OI Thresholds (PPHN/Respiratory Failure):</p>
              <div className="grid grid-cols-2 gap-2">
                <span>OI 15-25: Consider iNO</span>
                <span>OI 25-40: iNO + ECMO evaluation</span>
                <span>OI &gt;40: ECMO criteria</span>
                <span>OI sustained &gt;40 for 4h: ECMO</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// NEC Risk Calculator with Bell Staging
function NECRiskCalculator() {
  const [mode, setMode] = useState('risk'); // 'risk' or 'staging'
  const [riskFactors, setRiskFactors] = useState({
    ga: '',
    birthWeight: '',
    formulaFeeding: false,
    rapidFeedAdvance: false,
    prbc: false,
    pda: false,
    umbilicalCath: false,
    inotropes: false,
    polycythemia: false,
    chorioamnionitis: false,
  });
  const [stagingFindings, setStagingFindings] = useState({
    abdominalDistension: false,
    feedingIntolerance: false,
    occultBlood: false,
    grossBlood: false,
    bilious: false,
    ileus: false,
    pneumatosis: false,
    portalVenousGas: false,
    pneumoperitoneum: false,
    lethargy: false,
    apnea: false,
    tempInstability: false,
    acidosis: false,
    thrombocytopenia: false,
    dic: false,
    shock: false,
  });
  const [result, setResult] = useState(null);

  const calculateRisk = () => {
    let riskScore = 0;
    let riskFactorsList = [];

    // GA-based risk
    const ga = parseInt(riskFactors.ga);
    if (ga < 28) {
      riskScore += 4;
      riskFactorsList.push('Extremely preterm (<28 weeks)');
    } else if (ga < 32) {
      riskScore += 3;
      riskFactorsList.push('Very preterm (28-31 weeks)');
    } else if (ga < 37) {
      riskScore += 1;
      riskFactorsList.push('Late preterm (32-36 weeks)');
    }

    // Weight-based risk
    const bw = parseInt(riskFactors.birthWeight);
    if (bw < 1000) {
      riskScore += 3;
      riskFactorsList.push('ELBW (<1000g)');
    } else if (bw < 1500) {
      riskScore += 2;
      riskFactorsList.push('VLBW (1000-1500g)');
    }

    // Other risk factors
    if (riskFactors.formulaFeeding) {
      riskScore += 2;
      riskFactorsList.push('Formula feeding (vs exclusive HM)');
    }
    if (riskFactors.rapidFeedAdvance) {
      riskScore += 2;
      riskFactorsList.push('Rapid feed advancement (>30mL/kg/day)');
    }
    if (riskFactors.prbc) {
      riskScore += 2;
      riskFactorsList.push('Recent PRBC transfusion');
    }
    if (riskFactors.pda) {
      riskScore += 1;
      riskFactorsList.push('Hemodynamically significant PDA');
    }
    if (riskFactors.umbilicalCath) {
      riskScore += 1;
      riskFactorsList.push('Umbilical catheter');
    }
    if (riskFactors.inotropes) {
      riskScore += 2;
      riskFactorsList.push('Inotrope use');
    }
    if (riskFactors.polycythemia) {
      riskScore += 1;
      riskFactorsList.push('Polycythemia');
    }
    if (riskFactors.chorioamnionitis) {
      riskScore += 1;
      riskFactorsList.push('Maternal chorioamnionitis');
    }

    // Risk category
    let riskCategory = '';
    let riskLevel = 'low';
    if (riskScore >= 10) {
      riskCategory = 'High Risk';
      riskLevel = 'high';
    } else if (riskScore >= 5) {
      riskCategory = 'Moderate Risk';
      riskLevel = 'medium';
    } else {
      riskCategory = 'Low Risk';
      riskLevel = 'low';
    }

    setResult({
      type: 'risk',
      score: riskScore,
      category: riskCategory,
      level: riskLevel,
      factors: riskFactorsList,
    });
  };

  const calculateStaging = () => {
    let stage = '';
    let stageDetails = '';
    let severity = 'low';
    let findings = [];

    // Collect present findings
    if (stagingFindings.abdominalDistension) findings.push('Abdominal distension');
    if (stagingFindings.feedingIntolerance) findings.push('Feeding intolerance');
    if (stagingFindings.occultBlood) findings.push('Occult blood in stool');
    if (stagingFindings.grossBlood) findings.push('Gross blood in stool');
    if (stagingFindings.bilious) findings.push('Bilious gastric residuals');
    if (stagingFindings.ileus) findings.push('Ileus on X-ray');
    if (stagingFindings.pneumatosis) findings.push('Pneumatosis intestinalis');
    if (stagingFindings.portalVenousGas) findings.push('Portal venous gas');
    if (stagingFindings.pneumoperitoneum) findings.push('Pneumoperitoneum');
    if (stagingFindings.lethargy) findings.push('Lethargy');
    if (stagingFindings.apnea) findings.push('Apnea/bradycardia');
    if (stagingFindings.tempInstability) findings.push('Temperature instability');
    if (stagingFindings.acidosis) findings.push('Metabolic acidosis');
    if (stagingFindings.thrombocytopenia) findings.push('Thrombocytopenia');
    if (stagingFindings.dic) findings.push('DIC');
    if (stagingFindings.shock) findings.push('Hypotension/shock');

    // Bell Staging Criteria
    if (stagingFindings.pneumoperitoneum) {
      stage = 'Stage IIIB';
      stageDetails = 'Advanced NEC - Intestinal perforation';
      severity = 'critical';
    } else if (stagingFindings.pneumatosis && (stagingFindings.shock || stagingFindings.dic || stagingFindings.acidosis)) {
      stage = 'Stage IIIA';
      stageDetails = 'Advanced NEC - Critically ill, intact bowel';
      severity = 'critical';
    } else if (stagingFindings.pneumatosis && (stagingFindings.portalVenousGas || stagingFindings.grossBlood)) {
      stage = 'Stage IIB';
      stageDetails = 'Definite NEC - Moderately ill';
      severity = 'high';
    } else if (stagingFindings.pneumatosis) {
      stage = 'Stage IIA';
      stageDetails = 'Definite NEC - Mildly ill';
      severity = 'high';
    } else if ((stagingFindings.abdominalDistension || stagingFindings.feedingIntolerance) && (stagingFindings.grossBlood || stagingFindings.ileus)) {
      stage = 'Stage IB';
      stageDetails = 'Suspected NEC - Systemic symptoms';
      severity = 'medium';
    } else if (stagingFindings.abdominalDistension || stagingFindings.feedingIntolerance || stagingFindings.occultBlood) {
      stage = 'Stage IA';
      stageDetails = 'Suspected NEC - Mild symptoms';
      severity = 'medium';
    } else {
      stage = 'Not NEC';
      stageDetails = 'Insufficient findings for NEC diagnosis';
      severity = 'low';
    }

    setResult({
      type: 'staging',
      stage,
      stageDetails,
      severity,
      findings,
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-2">NEC Risk Assessment & Bell Staging</h3>
      <p className="text-sm text-slate-400 mb-4">Necrotizing Enterocolitis evaluation</p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode('risk'); setResult(null); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'risk' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Risk Assessment
        </button>
        <button
          onClick={() => { setMode('staging'); setResult(null); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'staging' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Bell Staging
        </button>
      </div>

      {mode === 'risk' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Gestational Age (weeks)</label>
              <input
                type="number"
                value={riskFactors.ga}
                onChange={(e) => setRiskFactors({ ...riskFactors, ga: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                placeholder="e.g., 28"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Birth Weight (g)</label>
              <input
                type="number"
                value={riskFactors.birthWeight}
                onChange={(e) => setRiskFactors({ ...riskFactors, birthWeight: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                placeholder="e.g., 1000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'formulaFeeding', label: 'Formula feeding' },
              { key: 'rapidFeedAdvance', label: 'Rapid feed advancement' },
              { key: 'prbc', label: 'Recent PRBC transfusion' },
              { key: 'pda', label: 'Hemodynamically significant PDA' },
              { key: 'umbilicalCath', label: 'Umbilical catheter' },
              { key: 'inotropes', label: 'Inotrope use' },
              { key: 'polycythemia', label: 'Polycythemia' },
              { key: 'chorioamnionitis', label: 'Chorioamnionitis' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 p-2 bg-slate-700/30 rounded cursor-pointer hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  checked={riskFactors[item.key]}
                  onChange={(e) => setRiskFactors({ ...riskFactors, [item.key]: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={calculateRisk}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg"
          >
            Calculate Risk
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="border-b border-slate-700 pb-2">
              <h4 className="text-sm font-medium text-yellow-400">GI Symptoms</h4>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { key: 'abdominalDistension', label: 'Abdominal distension' },
                  { key: 'feedingIntolerance', label: 'Feeding intolerance/residuals' },
                  { key: 'occultBlood', label: 'Occult blood in stool' },
                  { key: 'grossBlood', label: 'Gross blood in stool' },
                  { key: 'bilious', label: 'Bilious gastric residuals' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 p-2 bg-slate-700/30 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stagingFindings[item.key]}
                      onChange={(e) => setStagingFindings({ ...stagingFindings, [item.key]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-b border-slate-700 pb-2">
              <h4 className="text-sm font-medium text-orange-400">Radiological Findings</h4>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { key: 'ileus', label: 'Ileus/dilated bowel loops' },
                  { key: 'pneumatosis', label: 'Pneumatosis intestinalis' },
                  { key: 'portalVenousGas', label: 'Portal venous gas' },
                  { key: 'pneumoperitoneum', label: 'Pneumoperitoneum (free air)' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 p-2 bg-slate-700/30 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stagingFindings[item.key]}
                      onChange={(e) => setStagingFindings({ ...stagingFindings, [item.key]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-red-400">Systemic Signs</h4>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { key: 'lethargy', label: 'Lethargy' },
                  { key: 'apnea', label: 'Apnea/bradycardia' },
                  { key: 'tempInstability', label: 'Temperature instability' },
                  { key: 'acidosis', label: 'Metabolic acidosis' },
                  { key: 'thrombocytopenia', label: 'Thrombocytopenia' },
                  { key: 'dic', label: 'DIC' },
                  { key: 'shock', label: 'Hypotension/shock' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 p-2 bg-slate-700/30 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stagingFindings[item.key]}
                      onChange={(e) => setStagingFindings({ ...stagingFindings, [item.key]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={calculateStaging}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg"
          >
            Determine Stage
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4">
          {result.type === 'risk' ? (
            <div className={`p-4 rounded-lg border ${
              result.level === 'high' ? 'bg-red-900/30 border-red-500/50' :
              result.level === 'medium' ? 'bg-yellow-900/30 border-yellow-500/50' :
              'bg-green-900/30 border-green-500/50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-300">Risk Score</span>
                <span className={`text-3xl font-bold ${
                  result.level === 'high' ? 'text-red-400' :
                  result.level === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {result.score}
                </span>
              </div>
              <p className={`text-lg font-medium mb-3 ${
                result.level === 'high' ? 'text-red-300' :
                result.level === 'medium' ? 'text-yellow-300' : 'text-green-300'
              }`}>
                {result.category}
              </p>
              {result.factors.length > 0 && (
                <div className="text-sm">
                  <span className="text-slate-400">Contributing factors:</span>
                  <ul className="list-disc list-inside text-slate-300 mt-1">
                    {result.factors.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-lg border ${
              result.severity === 'critical' ? 'bg-red-900/30 border-red-500/50' :
              result.severity === 'high' ? 'bg-orange-900/30 border-orange-500/50' :
              result.severity === 'medium' ? 'bg-yellow-900/30 border-yellow-500/50' :
              'bg-green-900/30 border-green-500/50'
            }`}>
              <div className="mb-3">
                <span className={`text-2xl font-bold ${
                  result.severity === 'critical' ? 'text-red-400' :
                  result.severity === 'high' ? 'text-orange-400' :
                  result.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {result.stage}
                </span>
                <p className="text-slate-300 mt-1">{result.stageDetails}</p>
              </div>
              {result.findings.length > 0 && (
                <div className="text-sm border-t border-slate-600 pt-2">
                  <span className="text-slate-400">Present findings:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.findings.map((f, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500 p-3 bg-slate-700/20 rounded">
            <p className="font-medium text-slate-400 mb-2">Bell Staging Criteria (Modified):</p>
            <div className="space-y-1">
              <p><span className="text-yellow-400">Stage I</span>: Suspected - non-specific signs, occult blood</p>
              <p><span className="text-orange-400">Stage II</span>: Definite - pneumatosis intestinalis</p>
              <p><span className="text-red-400">Stage III</span>: Advanced - perforation or critically ill</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
