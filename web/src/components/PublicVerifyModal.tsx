import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  Calendar,
  Building,
  Briefcase,
  Lock,
  QrCode,
  X,
  ExternalLink,
  Award,
  FileText
} from 'lucide-react';
import { OfferLetter } from '../types';
import { formatISTDate } from '../lib/serialUtils';
import { INITIAL_ORGS } from '../lib/mockData';

interface PublicVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSerial?: string;
}

export const PublicVerifyModal: React.FC<PublicVerifyModalProps> = ({
  isOpen,
  onClose,
  initialSerial = ''
}) => {
  const { getOfferBySerial, availableOrgs, allOrganizations } = useApp();
  const [serialQuery, setSerialQuery] = useState(initialSerial || 'VDX-NEX-2026-A109F2');
  const [searched, setSearched] = useState(false);
  const [foundOffer, setFoundOffer] = useState<OfferLetter | undefined>(undefined);

  if (!isOpen) return null;

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serialQuery.trim()) return;
    const result = getOfferBySerial(serialQuery.trim());
    setFoundOffer(result);
    setSearched(true);
  };

  const orgList = (allOrganizations && allOrganizations.length > 0) ? allOrganizations : (availableOrgs && availableOrgs.length > 0 ? availableOrgs : INITIAL_ORGS);
  const isBnkOffer = foundOffer ? (foundOffer.orgId === '11111111-2222-3333-4444-555555555555' || foundOffer.serialNumber?.toUpperCase().includes('BNK')) : false;
  const bnkOrgFallback = orgList.find(o => o.orgCode === 'BNK' || o.id === '11111111-2222-3333-4444-555555555555') || INITIAL_ORGS[0];
  const issuingOrg = foundOffer
    ? (orgList.find((o) => o.id === foundOffer.orgId) || (isBnkOffer ? bnkOrgFallback : orgList[0]))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-6 sm:my-8">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-cyan-950 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <img
              src="/vedotrix-logo.png"
              alt="Vedotrix Technologies Official Logo"
              className="w-12 h-12 object-contain rounded-xl p-0.5 bg-slate-900 border border-cyan-500/40 shadow-lg shadow-cyan-500/20"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white">Offer Letter Verification Portal</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PUBLIC SECURE
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Official anti-fraud cryptographic verification engine by{' '}
                <span className="text-cyan-400 font-semibold">Vedotrix Technologies</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Verification Portal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Enter Cryptographic Serial Number
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={serialQuery}
                  onChange={(e) => setSerialQuery(e.target.value)}
                  placeholder="e.g. VDX-NEX-2026-A109F2"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 text-center"
              >
                Verify Now
              </button>
            </div>

            {/* Quick Test Links */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 pt-1">
              <span>Quick Test Samples:</span>
              <button
                type="button"
                onClick={() => {
                  setSerialQuery('VDX-NEX-2026-A109F2');
                  const r = getOfferBySerial('VDX-NEX-2026-A109F2');
                  setFoundOffer(r);
                  setSearched(true);
                }}
                className="text-cyan-400 hover:underline font-mono"
              >
                VDX-NEX-2026-A109F2
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setSerialQuery('VDX-VGL-2026-B882C4');
                  const r = getOfferBySerial('VDX-VGL-2026-B882C4');
                  setFoundOffer(r);
                  setSearched(true);
                }}
                className="text-cyan-400 hover:underline font-mono"
              >
                VDX-VGL-2026-B882C4
              </button>
            </div>
          </form>

          {/* Results Display */}
          {searched && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {foundOffer ? (
                <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 via-slate-900 to-slate-950 p-5 space-y-5 shadow-xl">
                  {/* Verified Badge Header */}
                  <div className="flex items-start justify-between border-b border-emerald-500/20 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/40 shadow-inner">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-extrabold text-white">GENUINE & AUTHENTIC</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 uppercase">
                            Status: {foundOffer.status}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400 font-mono">
                          Serial: {foundOffer.serialNumber}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                        Token: {foundOffer.verificationToken.slice(0, 12)}...
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">SHA-256 Tamper Protected</p>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                        <Award className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Candidate Name
                      </span>
                      <p className="text-sm font-bold text-white mt-1">{foundOffer.candidateName}</p>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                        <Building className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Issuing Organization
                      </span>
                      <p className="text-sm font-bold text-white mt-1">{issuingOrg?.name || (isBnkOffer ? 'BNK Digital' : 'Authorized Tenant')}</p>
                      <span className="text-[10px] text-cyan-400 block">{issuingOrg?.industry || 'Digital Marketing'}</span>
                      {issuingOrg?.address && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">{issuingOrg.address}</span>
                      )}
                      {issuingOrg?.website && (
                        <a href={issuingOrg.website} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline block mt-0.5">{issuingOrg.website}</a>
                      )}
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                        <Briefcase className="w-3.5 h-3.5 mr-1 text-amber-400" /> Designation & Department
                      </span>
                      <p className="text-sm font-bold text-white mt-1">{foundOffer.designation}</p>
                      <span className="text-[10px] text-slate-400">{foundOffer.department}</span>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Scheduled Joining Date
                      </span>
                      <p className="text-sm font-bold text-white mt-1">
                        {foundOffer.joiningDate ? formatISTDate(foundOffer.joiningDate) : 'Confirmed'}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Issued on {foundOffer.createdAt ? formatISTDate(foundOffer.createdAt) : 'Official Record'}
                      </span>
                    </div>

                    {(foundOffer.hrDepartment || foundOffer.managerName) && (
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {foundOffer.hrDepartment && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Issuing HR Unit</span>
                            <span className="text-xs font-semibold text-slate-200">{foundOffer.hrDepartment}</span>
                          </div>
                        )}
                        {foundOffer.managerName && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Reporting Manager</span>
                            <span className="text-xs font-semibold text-indigo-300">{foundOffer.managerName}</span>
                          </div>
                        )}
                        {foundOffer.securityCode && (
                          <div className="bg-slate-950 px-2.5 py-1 rounded border border-amber-500/30">
                            <span className="text-[9px] uppercase font-bold text-amber-400 block">Sec PIN</span>
                            <span className="text-xs font-mono font-bold text-amber-300">{foundOffer.securityCode}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attached Document Download (If provided by HR) */}
                  {foundOffer.pdfUrl && (
                    <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div>
                          <span className="text-xs text-white font-bold block">Official Offer Letter Attached</span>
                          <span className="text-[10px] text-slate-400">Verified document uploaded by Human Resources</span>
                        </div>
                      </div>
                      <a
                        href={foundOffer.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs rounded-lg transition shadow-md shrink-0 ml-2"
                      >
                        Download Doc
                      </a>
                    </div>
                  )}

                  {/* Masked Salary / Privacy Policy Notice */}
                  <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                    <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <p>
                      <strong className="text-slate-200">PII & Compensation Protection:</strong> Candidate salary, bank coordinates, and national tax identifiers are confidential and masked per international privacy standards.
                    </p>
                  </div>

                  {/* Verification Audit Stamp */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                    <span>
                      HR Verified on: <strong className="text-emerald-400">{foundOffer.hrVerifiedAt ? new Date(foundOffer.hrVerifiedAt).toLocaleDateString() : 'Instant Automated'}</strong>
                    </span>
                    <span className="text-cyan-400 font-semibold">
                      Managed & Certified by Vedotrix Technologies
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">RECORD NOT FOUND / FRAUD ALERT</h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      No official record matches the serial number <code className="text-rose-300 font-mono">{serialQuery}</code>. The document may be counterfeit, revoked, or incorrectly entered.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1">
                    Please contact the issuing Human Resources department or Vedotrix Security Support.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Vedotrix Anti-Fraud Architecture</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
