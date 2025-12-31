'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';

export default function AdmitPatientPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formData, setFormData] = useState({
    // Demographics
    lastName: '',
    firstName: '',
    gender: '',
    dob: '',
    dobTime: '',
    mrn: '',
    // Birth Info
    gaWeeks: '',
    gaDays: '',
    birthWeight: '',
    apgar1: '',
    apgar5: '',
    deliveryType: '',
    // Mother Info
    motherName: '',
    motherMRN: '',
    motherAge: '',
    bloodType: '',
    gbs: '',
    // Admission
    admitDate: '',
    admitTime: '',
    admitSource: '',
    attendingPhysician: '',
    primaryNurse: '',
    bed: '',
    // Clinical
    admitDiagnosis: [],
    ventilation: '',
    fio2: '',
    ivAccess: '',
  });
  
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const diagnoses = [
    'Prematurity',
    'RDS',
    'Apnea of Prematurity',
    'Hypoglycemia',
    'Hyperbilirubinemia',
    'Sepsis - Rule Out',
    'PDA',
    'NEC - Rule Out',
    'Feeding Difficulty',
    'Birth Asphyxia',
    'Meconium Aspiration',
    'TTN',
  ];
  
  const beds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  // Validation rules per step
  const validateStep = (stepNum) => {
    const newErrors = {};

    switch (stepNum) {
      case 1: // Demographics
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.gender) newErrors.gender = 'Gender is required';
        if (!formData.dob) newErrors.dob = 'Date of birth is required';
        if (!formData.dobTime) newErrors.dobTime = 'Time of birth is required';
        break;
      case 2: // Birth Info
        if (!formData.gaWeeks) newErrors.gaWeeks = 'Gestational age is required';
        else if (formData.gaWeeks < 22 || formData.gaWeeks > 42) newErrors.gaWeeks = 'GA must be 22-42 weeks';
        if (!formData.birthWeight) newErrors.birthWeight = 'Birth weight is required';
        else if (formData.birthWeight < 0.3 || formData.birthWeight > 6) newErrors.birthWeight = 'Weight must be 0.3-6 kg';
        if (!formData.deliveryType) newErrors.deliveryType = 'Delivery type is required';
        break;
      case 3: // Mother Info - no required fields
        break;
      case 4: // Admission
        if (!formData.admitDate) newErrors.admitDate = 'Admit date is required';
        if (!formData.admitTime) newErrors.admitTime = 'Admit time is required';
        if (!formData.attendingPhysician) newErrors.attendingPhysician = 'Attending physician is required';
        if (!formData.bed) newErrors.bed = 'Bed assignment is required';
        break;
      case 5: // Clinical - no required fields
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    setErrors({});
    setStep(step - 1);
  };

  const handleSubmit = () => {
    if (validateStep(step)) {
      setShowConfirmModal(true);
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const confirmAdmission = () => {
    setShowConfirmModal(false);
    toast.success(`Patient ${formData.lastName}, ${formData.firstName || 'Baby'} admitted to Bed ${formData.bed}`);
    router.push('/patients');
  };

  // Helper to get input class with error state
  const getInputClass = (fieldName, baseClass = '') => {
    const hasError = errors[fieldName];
    return `w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none ${
      hasError ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-cyan-500'
    } ${baseClass}`;
  };

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/patients" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Admit New Patient</h1>
              <p className="text-sm text-slate-400 mt-1">Complete all required fields to admit a patient</p>
            </div>
          </div>
          <Link 
            href="/patients"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </Link>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          {['Demographics', 'Birth Info', 'Mother Info', 'Admission', 'Clinical'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(i + 1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  step === i + 1 
                    ? 'bg-cyan-600 text-white' 
                    : step > i + 1 
                    ? 'bg-cyan-500/20 text-cyan-400' 
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-sm">
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < 4 && <div className="w-8 h-px bg-slate-700" />}
            </div>
          ))}
        </div>
        
        {/* Form */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          {/* Step 1: Demographics */}
          {step === 1 && (
            <div className="space-y-6" role="group" aria-labelledby="step1-heading">
              <h2 id="step1-heading" className="text-lg font-bold text-white">Patient Demographics</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-400 mb-2">Last Name *</label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Patient last name"
                    className={getInputClass('lastName')}
                    aria-required="true"
                    aria-invalid={errors.lastName ? 'true' : undefined}
                    aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                  />
                  {errors.lastName && <p id="lastName-error" className="mt-1 text-xs text-red-400" role="alert">{errors.lastName}</p>}
                </div>
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-400 mb-2">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="Baby"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-slate-400 mb-2">Gender *</label>
                  <select
                    id="gender"
                    value={formData.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className={getInputClass('gender')}
                    aria-required="true"
                    aria-invalid={errors.gender ? 'true' : undefined}
                    aria-describedby={errors.gender ? 'gender-error' : undefined}
                  >
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="U">Unknown</option>
                  </select>
                  {errors.gender && <p id="gender-error" className="mt-1 text-xs text-red-400" role="alert">{errors.gender}</p>}
                </div>
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-slate-400 mb-2">Date of Birth *</label>
                  <input
                    id="dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => updateField('dob', e.target.value)}
                    className={getInputClass('dob')}
                    aria-required="true"
                    aria-invalid={errors.dob ? 'true' : undefined}
                    aria-describedby={errors.dob ? 'dob-error' : undefined}
                  />
                  {errors.dob && <p id="dob-error" className="mt-1 text-xs text-red-400" role="alert">{errors.dob}</p>}
                </div>
                <div>
                  <label htmlFor="dobTime" className="block text-sm font-medium text-slate-400 mb-2">Time of Birth *</label>
                  <input
                    id="dobTime"
                    type="time"
                    value={formData.dobTime}
                    onChange={(e) => updateField('dobTime', e.target.value)}
                    className={getInputClass('dobTime')}
                    aria-required="true"
                    aria-invalid={errors.dobTime ? 'true' : undefined}
                    aria-describedby={errors.dobTime ? 'dobTime-error' : undefined}
                  />
                  {errors.dobTime && <p id="dobTime-error" className="mt-1 text-xs text-red-400" role="alert">{errors.dobTime}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="mrn" className="block text-sm font-medium text-slate-400 mb-2">MRN</label>
                <input
                  id="mrn"
                  type="text"
                  value={formData.mrn}
                  onChange={(e) => updateField('mrn', e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}
          
          {/* Step 2: Birth Info */}
          {step === 2 && (
            <div className="space-y-6" role="group" aria-labelledby="step2-heading">
              <h2 id="step2-heading" className="text-lg font-bold text-white">Birth Information</h2>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="gaWeeks" className="block text-sm font-medium text-slate-400 mb-2">GA Weeks *</label>
                  <input
                    id="gaWeeks"
                    type="number"
                    min="22"
                    max="42"
                    value={formData.gaWeeks}
                    onChange={(e) => updateField('gaWeeks', e.target.value)}
                    placeholder="Weeks"
                    className={getInputClass('gaWeeks')}
                    aria-required="true"
                    aria-invalid={errors.gaWeeks ? 'true' : undefined}
                    aria-describedby={errors.gaWeeks ? 'gaWeeks-error' : undefined}
                  />
                  {errors.gaWeeks && <p id="gaWeeks-error" className="mt-1 text-xs text-red-400" role="alert">{errors.gaWeeks}</p>}
                </div>
                <div>
                  <label htmlFor="gaDays" className="block text-sm font-medium text-slate-400 mb-2">GA Days</label>
                  <input
                    id="gaDays"
                    type="number"
                    min="0"
                    max="6"
                    value={formData.gaDays}
                    onChange={(e) => updateField('gaDays', e.target.value)}
                    placeholder="Days"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label htmlFor="birthWeight" className="block text-sm font-medium text-slate-400 mb-2">Birth Weight (kg) *</label>
                  <input
                    id="birthWeight"
                    type="number"
                    step="0.01"
                    min="0.3"
                    max="6"
                    value={formData.birthWeight}
                    onChange={(e) => updateField('birthWeight', e.target.value)}
                    placeholder="kg"
                    className={getInputClass('birthWeight')}
                    aria-required="true"
                    aria-invalid={errors.birthWeight ? 'true' : undefined}
                    aria-describedby={errors.birthWeight ? 'birthWeight-error' : undefined}
                  />
                  {errors.birthWeight && <p id="birthWeight-error" className="mt-1 text-xs text-red-400" role="alert">{errors.birthWeight}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="apgar1" className="block text-sm font-medium text-slate-400 mb-2">APGAR 1 min</label>
                  <input
                    id="apgar1"
                    type="number"
                    min="0"
                    max="10"
                    value={formData.apgar1}
                    onChange={(e) => updateField('apgar1', e.target.value)}
                    placeholder="0-10"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label htmlFor="apgar5" className="block text-sm font-medium text-slate-400 mb-2">APGAR 5 min</label>
                  <input
                    id="apgar5"
                    type="number"
                    min="0"
                    max="10"
                    value={formData.apgar5}
                    onChange={(e) => updateField('apgar5', e.target.value)}
                    placeholder="0-10"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label htmlFor="deliveryType" className="block text-sm font-medium text-slate-400 mb-2">Delivery Type *</label>
                  <select
                    id="deliveryType"
                    value={formData.deliveryType}
                    onChange={(e) => updateField('deliveryType', e.target.value)}
                    className={getInputClass('deliveryType')}
                    aria-required="true"
                    aria-invalid={errors.deliveryType ? 'true' : undefined}
                    aria-describedby={errors.deliveryType ? 'deliveryType-error' : undefined}
                  >
                    <option value="">Select</option>
                    <option value="vaginal">Vaginal</option>
                    <option value="csection">C-Section</option>
                    <option value="csection-emergency">C-Section (Emergency)</option>
                    <option value="assisted">Assisted Vaginal</option>
                  </select>
                  {errors.deliveryType && <p id="deliveryType-error" className="mt-1 text-xs text-red-400" role="alert">{errors.deliveryType}</p>}
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: Mother Info */}
          {step === 3 && (
            <div className="space-y-6" role="group" aria-labelledby="step3-heading">
              <h2 id="step3-heading" className="text-lg font-bold text-white">Mother Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="motherName" className="block text-sm font-medium text-slate-400 mb-2">Mother's Name</label>
                  <input
                    id="motherName"
                    type="text"
                    value={formData.motherName}
                    onChange={(e) => updateField('motherName', e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label htmlFor="motherMRN" className="block text-sm font-medium text-slate-400 mb-2">Mother's MRN</label>
                  <input
                    id="motherMRN"
                    type="text"
                    value={formData.motherMRN}
                    onChange={(e) => updateField('motherMRN', e.target.value)}
                    placeholder="MRN"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="motherAge" className="block text-sm font-medium text-slate-400 mb-2">Mother's Age</label>
                  <input
                    id="motherAge"
                    type="number"
                    min="12"
                    max="60"
                    value={formData.motherAge}
                    onChange={(e) => updateField('motherAge', e.target.value)}
                    placeholder="Years"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label htmlFor="bloodType" className="block text-sm font-medium text-slate-400 mb-2">Blood Type</label>
                  <select
                    id="bloodType"
                    value={formData.bloodType}
                    onChange={(e) => updateField('bloodType', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="gbs" className="block text-sm font-medium text-slate-400 mb-2">GBS Status</label>
                  <select
                    id="gbs"
                    value={formData.gbs}
                    onChange={(e) => updateField('gbs', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 4: Admission */}
          {step === 4 && (
            <div className="space-y-6" role="group" aria-labelledby="step4-heading">
              <h2 id="step4-heading" className="text-lg font-bold text-white">Admission Details</h2>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="admitDate" className="block text-sm font-medium text-slate-400 mb-2">Admit Date *</label>
                  <input
                    id="admitDate"
                    type="date"
                    value={formData.admitDate}
                    onChange={(e) => updateField('admitDate', e.target.value)}
                    className={getInputClass('admitDate')}
                    aria-required="true"
                    aria-invalid={errors.admitDate ? 'true' : undefined}
                    aria-describedby={errors.admitDate ? 'admitDate-error' : undefined}
                  />
                  {errors.admitDate && <p id="admitDate-error" className="mt-1 text-xs text-red-400" role="alert">{errors.admitDate}</p>}
                </div>
                <div>
                  <label htmlFor="admitTime" className="block text-sm font-medium text-slate-400 mb-2">Admit Time *</label>
                  <input
                    id="admitTime"
                    type="time"
                    value={formData.admitTime}
                    onChange={(e) => updateField('admitTime', e.target.value)}
                    className={getInputClass('admitTime')}
                    aria-required="true"
                    aria-invalid={errors.admitTime ? 'true' : undefined}
                    aria-describedby={errors.admitTime ? 'admitTime-error' : undefined}
                  />
                  {errors.admitTime && <p id="admitTime-error" className="mt-1 text-xs text-red-400" role="alert">{errors.admitTime}</p>}
                </div>
                <div>
                  <label htmlFor="admitSource" className="block text-sm font-medium text-slate-400 mb-2">Admit Source</label>
                  <select
                    id="admitSource"
                    value={formData.admitSource}
                    onChange={(e) => updateField('admitSource', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="delivery">Delivery Room</option>
                    <option value="or">Operating Room</option>
                    <option value="nursery">Newborn Nursery</option>
                    <option value="transfer">External Transfer</option>
                    <option value="ed">Emergency Department</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="attendingPhysician" className="block text-sm font-medium text-slate-400 mb-2">Attending Physician *</label>
                  <select
                    id="attendingPhysician"
                    value={formData.attendingPhysician}
                    onChange={(e) => updateField('attendingPhysician', e.target.value)}
                    className={getInputClass('attendingPhysician')}
                    aria-required="true"
                    aria-invalid={errors.attendingPhysician ? 'true' : undefined}
                    aria-describedby={errors.attendingPhysician ? 'attendingPhysician-error' : undefined}
                  >
                    <option value="">Select</option>
                    <option value="chen">Dr. Sarah Chen</option>
                    <option value="roberts">Dr. Michael Roberts</option>
                    <option value="wong">Dr. Lisa Wong</option>
                  </select>
                  {errors.attendingPhysician && <p id="attendingPhysician-error" className="mt-1 text-xs text-red-400" role="alert">{errors.attendingPhysician}</p>}
                </div>
                <div>
                  <label htmlFor="primaryNurse" className="block text-sm font-medium text-slate-400 mb-2">Primary Nurse</label>
                  <select
                    id="primaryNurse"
                    value={formData.primaryNurse}
                    onChange={(e) => updateField('primaryNurse', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="moore">RN Jessica Moore</option>
                    <option value="clark">RN Amanda Clark</option>
                    <option value="park">RN David Park</option>
                    <option value="adams">RN Jennifer Adams</option>
                  </select>
                </div>
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-slate-400 mb-2">Assign Bed *</legend>
                <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-required="true">
                  {beds.map(bed => (
                    <button
                      key={bed}
                      type="button"
                      role="radio"
                      aria-checked={formData.bed === bed}
                      onClick={() => updateField('bed', bed)}
                      className={`p-3 rounded-lg border text-center font-mono font-bold transition-colors ${
                        formData.bed === bed
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : errors.bed
                          ? 'bg-slate-800 border-red-500 text-slate-300 hover:border-red-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Bed {bed}
                    </button>
                  ))}
                </div>
                {errors.bed && <p className="mt-2 text-xs text-red-400" role="alert">{errors.bed}</p>}
              </fieldset>
            </div>
          )}
          
          {/* Step 5: Clinical */}
          {step === 5 && (
            <div className="space-y-6" role="group" aria-labelledby="step5-heading">
              <h2 id="step5-heading" className="text-lg font-bold text-white">Clinical Information</h2>

              <fieldset>
                <legend className="block text-sm font-medium text-slate-400 mb-2">Admitting Diagnosis</legend>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Select one or more diagnoses">
                  {diagnoses.map((dx, index) => (
                    <label
                      key={dx}
                      htmlFor={`diagnosis-${index}`}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.admitDiagnosis.includes(dx)
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <input
                        id={`diagnosis-${index}`}
                        type="checkbox"
                        checked={formData.admitDiagnosis.includes(dx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateField('admitDiagnosis', [...formData.admitDiagnosis, dx]);
                          } else {
                            updateField('admitDiagnosis', formData.admitDiagnosis.filter(d => d !== dx));
                          }
                        }}
                        className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-sm">{dx}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ventilation" className="block text-sm font-medium text-slate-400 mb-2">Respiratory Support</label>
                  <select
                    id="ventilation"
                    value={formData.ventilation}
                    onChange={(e) => updateField('ventilation', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="room-air">Room Air</option>
                    <option value="low-flow">Low Flow O2</option>
                    <option value="high-flow">High Flow</option>
                    <option value="cpap">CPAP</option>
                    <option value="nippv">NIPPV</option>
                    <option value="simv">SIMV</option>
                    <option value="hfov">HFOV</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fio2" className="block text-sm font-medium text-slate-400 mb-2">FiO₂ (%)</label>
                  <input
                    id="fio2"
                    type="number"
                    min="21"
                    max="100"
                    value={formData.fio2}
                    onChange={(e) => updateField('fio2', e.target.value)}
                    placeholder="21-100"
                    aria-describedby="fio2-hint"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <span id="fio2-hint" className="sr-only">Enter a value between 21 and 100 percent</span>
                </div>
                <div>
                  <label htmlFor="ivAccess" className="block text-sm font-medium text-slate-400 mb-2">IV Access</label>
                  <select
                    id="ivAccess"
                    value={formData.ivAccess}
                    onChange={(e) => updateField('ivAccess', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select</option>
                    <option value="none">None</option>
                    <option value="piv">PIV</option>
                    <option value="uvc">UVC</option>
                    <option value="uac">UAC</option>
                    <option value="picc">PICC</option>
                    <option value="uvc-uac">UVC + UAC</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={step === 1}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Previous
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                Complete Admission
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmAdmission}
          title="Confirm Admission"
          message={`Are you sure you want to admit ${formData.firstName || 'Baby'} ${formData.lastName} to Bed ${formData.bed}? This will create a new patient record.`}
          confirmText="Confirm Admission"
          variant="success"
        />
      </div>
    </AppShell>
  );
}
