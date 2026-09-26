import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OfferLetter } from '../types';
import {
  FileCheck2,
  Plus,
  ShieldCheck,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  Eye,
  Calendar,
  Lock,
  FileText
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';

interface OfferLettersListProps {
  onOpenCreate: () => void;
  onViewOffer: (offer: OfferLetter) => void;
  onOpenVerify: (serial: string) => void;
}

export const OfferLettersList: React.FC<OfferLettersListProps> = ({
  onOpenCreate,
  onViewOffer,
  onOpenVerify
}) => {
  const { offerLetters, currentOrg, addToast } = useApp();

  const handleResendEmail = (offer: OfferLetter) => {
    addToast(
      '📧 HR Verification Email Dispatched',
      `Audit confirmation email sent to HR & candidate (${offer.candidateEmail}) for Serial ${offer.serialNumber}.`,
      'info'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white">Offer Letter & Verification Engine</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Anti-Fraud Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-proof serial numbers, instant HR email verification alerts, and public authentication.
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Issue New Offer Letter</span>
        </button>
      </div>

      {/* Architecture Alert / Security Note */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start space-x-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-white">Tamper-Proof Offer Letter Architecture</h4>
          <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
            Every offer letter generated contains a unique cryptographic serial identifier formatted as{' '}
            <code className="text-cyan-300 font-mono">VDX-{currentOrg.orgCode}-YYYY-[HEX]</code>. 
            Third parties (background verification firms, visa authorities, candidates) can verify authenticity on the public verification portal without exposing candidate compensation or sensitive PII.
          </p>
        </div>
      </div>

      {/* Offer Letters Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200">
            Registered Offer Letters ({offerLetters.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            Tenant: {currentOrg.name} ({currentOrg.orgCode})
          </span>
        </div>

        {offerLetters.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No offer letters issued for this tenant yet. Click "Issue New Offer Letter" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Designation & Dept</th>
                  <th className="p-3 text-right">Annual CTC</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {offerLetters.map((offer) => {
                  const isAccepted = offer.status === 'accepted';
                  return (
                    <tr key={offer.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-mono text-cyan-300 font-bold">
                            {offer.serialNumber}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          Issued {new Date(offer.createdAt).toLocaleDateString()}
                        </span>
                        {offer.pdfUrl && (
                          <a
                            href={offer.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-[10px] text-cyan-400 hover:underline mt-1 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30"
                          >
                            <FileText className="w-3 h-3 text-cyan-400" />
                            <span>Attached Doc</span>
                          </a>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-white">{offer.candidateName}</div>
                        <span className="text-[10px] text-slate-400 block">{offer.candidateEmail}</span>
                        {offer.securityCode && (
                          <span className="inline-flex items-center text-[10px] font-mono font-semibold text-amber-300 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-500/30 mt-1 mr-1">
                            <Lock className="w-2.5 h-2.5 mr-1" />
                            {offer.securityCode}
                          </span>
                        )}
                        {offer.managerName && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Reporting to: <strong className="text-slate-300">{offer.managerName}</strong>
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{offer.designation}</div>
                        <span className="text-[10px] text-indigo-400 block">{offer.department}</span>
                        {offer.hrDepartment && (
                          <span className="text-[9px] text-slate-500 block">Unit: {offer.hrDepartment}</span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-white">
                        {formatCurrency(offer.annualCtc)}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isAccepted
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {offer.status}
                        </span>
                      </td>

                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => onViewOffer(offer)}
                          className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition"
                        >
                          View Document
                        </button>
                        <button
                          onClick={() => onOpenVerify(offer.serialNumber)}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded text-[11px] font-semibold transition"
                          title="Open public verification page"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleResendEmail(offer)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                          title="Simulate Resend email trigger to HR and candidate"
                        >
                          <Mail className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
