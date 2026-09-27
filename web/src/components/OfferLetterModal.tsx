import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  FilePlus,
  X,
  Mail,
  User,
  Briefcase,
  Calendar,
  ShieldCheck,
  Send,
  UploadCloud,
  CheckCircle2,
  FileText,
  Loader2,
  KeyRound,
  Users,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';
import { uploadFileToStorage } from '../lib/storage';

interface OfferLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfferLetterModal: React.FC<OfferLetterModalProps> = ({ isOpen, onClose }) => {
  const { currentOrg, currentProfile, createOfferLetter, orgProfiles, addToast } = useApp();

  // Mode: Existing Employee vs New Candidate
  const [recipientType, setRecipientType] = useState<'existing_employee' | 'new_candidate'>('existing_employee');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const [serialNumber, setSerialNumber] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [hrDepartment, setHrDepartment] = useState('HR & Talent Acquisition');
  const [managerId, setManagerId] = useState('');

  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('+91 ');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [joiningDate, setJoiningDate] = useState('2026-10-15');
  const [annualCtc, setAnnualCtc] = useState<number>(1200000);

  // Manual Document Upload State
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>('');
  const [uploadedDocName, setUploadedDocName] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Auto-calculated components
  const monthlyTotal = Math.round(annualCtc / 12);
  const basicMonthly = Math.round(monthlyTotal * 0.5);
  const hraMonthly = Math.round(monthlyTotal * 0.25);
  const specialAllowance = monthlyTotal - (basicMonthly + hraMonthly);

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;

    const emp = orgProfiles.find((p) => p.id === empId);
    if (emp) {
      setCandidateName(`${emp.firstName} ${emp.lastName}`);
      setCandidateEmail(emp.email);
      setCandidatePhone(emp.phone || '+91 ');
      setDesignation(emp.designation || 'Team Member');
      setDepartment(emp.department || 'Engineering');
      setJoiningDate(emp.joiningDate || new Date().toISOString().split('T')[0]);
      if (emp.baseSalary !== undefined && emp.baseSalary !== null) {
        setAnnualCtc(Number(emp.baseSalary) * 12);
      }
      if (emp.managerId) {
        setManagerId(emp.managerId);
      }
      if (!serialNumber) {
        setSerialNumber(`VDX-${currentOrg.orgCode}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      }
      addToast('Employee Selected 👤', `Loaded credentials for ${emp.firstName} ${emp.lastName}`, 'info');
    }
  };

  const handleGenerateSecurityCode = () => {
    const code = `SEC-${Math.floor(1000 + Math.random() * 9000)}`;
    setSecurityCode(code);
    addToast('Security PIN Generated', `PIN: ${code}`, 'info');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    const res = await uploadFileToStorage(file, 'documents', 'offer_doc');
    if (res.success && res.url) {
      setUploadedDocUrl(res.url);
      setUploadedDocName(file.name);
      addToast('Document Uploaded 📄', `Attached "${file.name}" to offer letter.`, 'success');
    } else {
      addToast('Upload Failed', res.error || 'Could not upload document to storage.', 'error');
    }
    setIsUploadingDoc(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) {
      addToast('Required Field', 'Please enter a manual Serial Number for this offer letter.', 'warning');
      return;
    }
    if (!candidateName.trim() || !candidateEmail.trim() || !designation.trim()) {
      addToast('Required Fields', 'Candidate Name, Email, and Designation are required.', 'warning');
      return;
    }

    const selectedManager = orgProfiles.find((p) => p.id === managerId);

    createOfferLetter({
      serialNumber: serialNumber.trim().toUpperCase(),
      candidateName: candidateName.trim(),
      candidateEmail: candidateEmail.trim(),
      candidatePhone: candidatePhone.trim(),
      designation: designation.trim(),
      department,
      joiningDate,
      annualCtc,
      basicMonthly,
      hraMonthly,
      specialAllowance,
      pdfUrl: uploadedDocUrl || undefined,
      securityCode: securityCode.trim() || undefined,
      hrDepartment: hrDepartment.trim() || undefined,
      managerId: managerId || undefined,
      managerName: selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : undefined,
      employeeId: recipientType === 'existing_employee' && selectedEmployeeId ? selectedEmployeeId : undefined,
      issuedBy: currentProfile.id
    });

    onClose();
  };

  const linkedEmployee = orgProfiles.find((p) => p.id === selectedEmployeeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Official Offer Letter</h3>
              <p className="text-xs text-slate-400">
                Organization: <span className="text-cyan-400 font-semibold">{currentOrg.name}</span> • Employee Linking & Security
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Recipient Selection Toggle */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center">
                <Users className="w-4 h-4 mr-1.5 text-cyan-400" />
                Select Recipient Type *
              </label>
              <span className="text-[10px] text-slate-400">Link directly to employee portal</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRecipientType('existing_employee');
                  if (!selectedEmployeeId && orgProfiles.length > 0) {
                    handleSelectEmployee(orgProfiles[0].id);
                  }
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition border ${
                  recipientType === 'existing_employee'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Existing Staff Member</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecipientType('new_candidate');
                  setSelectedEmployeeId('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition border ${
                  recipientType === 'new_candidate'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>New External Candidate</span>
              </button>
            </div>

            {/* Existing Employee Selector Dropdown */}
            {recipientType === 'existing_employee' && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Choose Employee from Organization:
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-cyan-500/40 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Choose Existing Employee Profile --</option>
                  {orgProfiles.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} — {emp.designation} ({emp.department} • {emp.email})
                    </option>
                  ))}
                </select>

                {linkedEmployee && (
                  <div className="flex items-center space-x-2 text-[11px] text-cyan-400 bg-cyan-950/40 p-2 rounded border border-cyan-500/30">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Linked to <strong>{linkedEmployee.firstName} {linkedEmployee.lastName}</strong>. They will be able to view and accept this contract directly in their portal!
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reference & Security Code Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Manual Serial Number Entry */}
            <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-2">
              <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center text-cyan-300">
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-cyan-400" />
                  Offer Serial Number *
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">HR Manual</span>
              </label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                placeholder={`e.g. ${currentOrg.orgCode}/2026/001`}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono uppercase text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
              <p className="text-[10px] text-slate-400">
                Mandatory reference serial code entered manually by HR.
              </p>
            </div>

            {/* Optional Security Code / PIN */}
            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center text-indigo-300">
                  <KeyRound className="w-4 h-4 mr-1.5 text-indigo-400" />
                  Security Code (Optional PIN)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSecurityCode}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                >
                  Generate PIN
                </button>
              </div>
              <input
                type="text"
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
                placeholder="e.g. SEC-8291"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono uppercase text-indigo-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <p className="text-[10px] text-slate-400">
                Optional verification PIN sent to candidate to access offer letter.
              </p>
            </div>
          </div>

          {/* Manual Document / Letterhead Upload Option */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center text-slate-200">
                <UploadCloud className="w-4 h-4 mr-1.5 text-indigo-400" />
                Upload Official Company Offer Letter (PDF / Document)
              </span>
              {isUploadingDoc && (
                <span className="text-[10px] text-indigo-400 flex items-center">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading to cloud...
                </span>
              )}
            </label>

            {uploadedDocUrl ? (
              <div className="flex items-center justify-between p-3 bg-slate-900 border border-emerald-500/40 rounded-xl">
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs text-emerald-300 font-semibold block truncate">
                      {uploadedDocName || 'Attached Offer Letter Document'}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block">{uploadedDocUrl}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0 ml-2">
                  <a
                    href={uploadedDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:underline font-semibold"
                  >
                    View File
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedDocUrl('');
                      setUploadedDocName('');
                    }}
                    className="text-slate-400 hover:text-rose-400 text-xs p-1"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingDoc}
                  className="w-full py-3 px-4 border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-900/50 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Click to Browse & Upload Official Offer Letter (PDF / DOCX)</span>
                </button>
                <p className="text-[10px] text-slate-500 mt-1">
                  Upload signed company letterhead document. Stored securely for download and verification.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Candidate / Employee Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Candidate / Employee Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Candidate / Employee Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="priya@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={candidatePhone}
                onChange={(e) => setCandidatePhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Joining Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Joining Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Designation *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Software Architect"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Engineering">Engineering & Tech</option>
                <option value="Product Design">Product & Design</option>
                <option value="Growth Marketing">Growth Marketing & Performance</option>
                <option value="HR & Operations">HR, Talent & People Ops</option>
                <option value="Finance & Legal">Finance & Corporate Law</option>
                <option value="Client Services">Client Solutions & Account Mgmt</option>
              </select>
            </div>

            {/* HR Department of Issuing Profile */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>HR / Talent Unit</span>
                <span className="text-[10px] text-slate-500">Issuing Dept</span>
              </label>
              <input
                type="text"
                value={hrDepartment}
                onChange={(e) => setHrDepartment(e.target.value)}
                placeholder="e.g. Global Talent Acquisition"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Designated Reporting Manager */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                  Designated Reporting Manager
                </span>
                <span className="text-[10px] text-slate-500">Optional</span>
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Select Reporting Manager / Lead --</option>
                {orgProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.role.toUpperCase()} - {p.designation || p.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CTC and Breakdown */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                Annual Fixed CTC (₹ INR)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {annualCtc === 0 ? '₹0 (Unpaid Intern)' : formatCurrency(annualCtc)}
              </span>
            </div>

            {/* Quick CTC Presets */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAnnualCtc(0)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                  annualCtc === 0
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-amber-950/40'
                }`}
              >
                Unpaid Intern (₹0)
              </button>
              <button
                type="button"
                onClick={() => setAnnualCtc(120000)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                  annualCtc === 120000
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-900 text-blue-300 border border-blue-500/30 hover:bg-blue-950/40'
                }`}
              >
                Stipend (₹1.2L / ₹10k mo)
              </button>
              <button
                type="button"
                onClick={() => setAnnualCtc(360000)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                  annualCtc === 360000
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
              >
                Junior (₹3.6L / ₹30k mo)
              </button>
              <button
                type="button"
                onClick={() => setAnnualCtc(1200000)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                  annualCtc === 1200000
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
              >
                Senior (₹12L / ₹1L mo)
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0"
                max="5000000"
                step="25000"
                value={annualCtc}
                onChange={(e) => setAnnualCtc(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <input
                type="number"
                min="0"
                step="10000"
                value={annualCtc}
                onChange={(e) => setAnnualCtc(Number(e.target.value))}
                className="w-28 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white text-right"
              />
            </div>

            {annualCtc === 0 ? (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-300">
                <span className="font-semibold block">Academic / Unpaid Training Contract:</span>
                Non-monetary offer letter. Candidate receives training, mentorship, and completion certificate with zero INR basic salary.
              </div>
            ) : (
              /* Monthly Breakup Preview */
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] border-t border-slate-800">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Basic (50%)</span>
                  <span className="font-semibold text-slate-200 font-mono">{formatCurrency(basicMonthly)}/mo</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">HRA (25%)</span>
                  <span className="font-semibold text-slate-200 font-mono">{formatCurrency(hraMonthly)}/mo</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Special Allow. (25%)</span>
                  <span className="font-semibold text-slate-200 font-mono">{formatCurrency(specialAllowance)}/mo</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Offer & Link to Employee</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
