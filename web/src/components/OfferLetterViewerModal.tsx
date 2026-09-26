import React from 'react';
import { useApp } from '../context/AppContext';
import { OfferLetter } from '../types';
import {
  FileText,
  Printer,
  CheckCircle,
  X,
  ShieldCheck,
  Building,
  QrCode,
  Calendar,
  Lock,
  ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';

interface OfferLetterViewerModalProps {
  offer: OfferLetter | null;
  onClose: () => void;
  onOpenVerify: (serial: string) => void;
}

export const OfferLetterViewerModal: React.FC<OfferLetterViewerModalProps> = ({
  offer,
  onClose,
  onOpenVerify
}) => {
  const { currentOrg, acceptOfferLetter } = useApp();

  if (!offer) return null;

  const handleAccept = () => {
    acceptOfferLetter(offer.serialNumber);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[90vh] overflow-y-auto">
        {/* Controls Toolbar (Non-printable) */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center justify-between sm:justify-start space-x-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-slate-900 px-2.5 py-1 rounded border border-cyan-500/30">
              {offer.serialNumber}
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                offer.status === 'accepted'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              Status: {offer.status}
            </span>
          </div>

          <div className="flex items-center justify-end space-x-2">
            {offer.pdfUrl && (
              <a
                href={offer.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>View Uploaded Doc</span>
              </a>
            )}
            <button
              onClick={() => onOpenVerify(offer.serialNumber)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/40 transition"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verify Portal</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Letterhead Document */}
        <div className="p-4 sm:p-8 md:p-12 bg-white text-slate-900 space-y-6 text-sm selection:bg-indigo-100 selection:text-indigo-900">
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="flex items-start space-x-4">
              <img
                src="/vedotrix-logo.png"
                alt="Vedotrix Logo"
                className="w-14 h-14 object-contain rounded-xl p-1 bg-slate-950 border-2 border-slate-900"
              />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 uppercase">
                  {currentOrg.name}
                </h1>
                <p className="text-xs text-slate-600 mt-1 max-w-sm leading-snug">
                  {currentOrg.address} • {currentOrg.phone}
                </p>
                <p className="text-xs text-indigo-700 font-semibold">{currentOrg.website}</p>
              </div>
            </div>

            {/* Cryptographic Verification Stamp Box */}
            <div className="text-right border-2 border-slate-900 p-3 rounded-lg bg-slate-50">
              <div className="flex items-center justify-end space-x-1 text-emerald-800 font-bold text-xs uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Vedotrix Verified</span>
              </div>
              <p className="font-mono text-xs font-bold text-slate-900 mt-1">{offer.serialNumber}</p>
              <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-500 font-mono">
                <QrCode className="w-3.5 h-3.5 text-slate-700" />
                <span>Scan for authenticity</span>
              </div>
            </div>
          </div>

          {/* Recipient Details & Date */}
          <div className="flex justify-between items-start text-xs pt-2">
            <div>
              <p className="font-bold text-slate-900 text-sm">To,</p>
              <p className="font-bold text-slate-950 text-base">{offer.candidateName}</p>
              <p className="text-slate-600">{offer.candidateEmail}</p>
              <p className="text-slate-600">{offer.candidatePhone}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Date of Issuance:</p>
              <p className="font-semibold text-slate-900">{new Date(offer.createdAt).toLocaleDateString()}</p>
              <p className="text-slate-500 mt-1">Scheduled Joining:</p>
              <p className="font-semibold text-slate-900">{new Date(offer.joiningDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Letter Body */}
          <div className="space-y-3 leading-relaxed text-slate-800">
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-200 pb-1">
              OFFICIAL OFFER OF EMPLOYMENT
            </h2>
            <p>
              Dear <strong>{offer.candidateName}</strong>,
            </p>
            <p>
              On behalf of <strong>{currentOrg.name}</strong>, we are thrilled to extend an offer of employment for the position of{' '}
              <strong className="text-slate-950 underline">{offer.designation}</strong> in our{' '}
              <strong>{offer.department}</strong> division.
            </p>
            <p>
              Your skills, track record, and passion align with our team's mission. We are confident you will make a substantial contribution to our organizational milestones.
            </p>
          </div>

          {/* Compensation Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Annexure A: Annual Compensation Structure
            </h3>
            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="text-left p-2.5">Salary Component</th>
                  <th className="text-right p-2.5">Monthly (₹)</th>
                  <th className="text-right p-2.5">Annual (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="p-2.5 font-medium">Basic Salary (50%)</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.basicMonthly)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.basicMonthly * 12)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium">House Rent Allowance (HRA - 25%)</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.hraMonthly)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.hraMonthly * 12)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium">Special Allowance / Performance Stack</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.specialAllowance)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.specialAllowance * 12)}</td>
                </tr>
                <tr className="bg-slate-50 font-bold text-slate-950 border-t-2 border-slate-400">
                  <td className="p-2.5">Total Cost to Company (CTC)</td>
                  <td className="p-2.5 text-right font-mono">
                    {formatCurrency(Math.round(offer.annualCtc / 12))}
                  </td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(offer.annualCtc)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures & Seal */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 items-end">
            <div>
              <div className="border-b border-slate-900 pb-1 w-48 mb-2">
                <span className="font-serif italic text-base text-indigo-900 font-bold">
                  Authorized Signatory
                </span>
              </div>
              <p className="font-bold text-xs text-slate-950">Head of Human Resources</p>
              <p className="text-[11px] text-slate-600">{currentOrg.name}</p>
              <div className="inline-flex items-center space-x-1 mt-1 text-[10px] text-emerald-700 font-bold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>HR Identity Verified via System</span>
              </div>
            </div>

            <div className="text-right">
              {offer.status === 'accepted' ? (
                <div className="border border-emerald-600 bg-emerald-50 p-2.5 rounded-lg inline-block text-left">
                  <p className="text-xs font-bold text-emerald-800 flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Digitally Accepted by Candidate
                  </p>
                  <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                    Timestamp: {new Date(offer.candidateAcceptedAt || offer.createdAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Candidate Digital Acceptance Pending</p>
                  <button
                    onClick={handleAccept}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition print:hidden"
                  >
                    Accept Offer as Candidate
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Document Footer */}
          <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500 space-y-1">
            <p>
              This is a cryptographically secured electronic document issued through{' '}
              <strong className="text-slate-800 font-semibold">Vedotrix Pulse HRMS</strong>.
            </p>
            <p className="font-semibold text-indigo-900">
              Designed & Managed by Vedotrix Technologies
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
