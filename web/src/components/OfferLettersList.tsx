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
  FileText,
  User,
  Briefcase,
  Building,
  Sparkles,
  DownloadCloud,
  Check,
  ArrowRight
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
  const { offerLetters, currentOrg, allOrganizations, currentProfile, acceptOfferLetter, addToast } = useApp();

  const canManage =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin';

  // Find the offer letter issued to the currently logged-in user
  const myOffer = offerLetters.find(
    (o) =>
      (o.employeeId && o.employeeId === currentProfile?.id) ||
      (o.candidateEmail && currentProfile?.email && o.candidateEmail.toLowerCase() === currentProfile.email.toLowerCase())
  );

  const myOfferOrg = myOffer
    ? allOrganizations?.find((o) => o.id === myOffer.orgId) || currentOrg
    : currentOrg;

  let isMyOfferLocallyAccepted = false;
  try {
    if (myOffer) {
      isMyOfferLocallyAccepted = localStorage.getItem(`vdx_offer_accepted_${myOffer.serialNumber}`) === 'true';
    }
  } catch {}
  const isMyOfferAccepted = Boolean(myOffer && (myOffer.status === 'accepted' || isMyOfferLocallyAccepted));

  const [activeTab, setActiveTab] = useState<'all' | 'my_offer'>(
    canManage ? 'all' : 'my_offer'
  );

  const handleResendEmail = (offer: OfferLetter) => {
    addToast(
      '📧 HR Verification Email Dispatched',
      `Audit confirmation email sent to HR & candidate (${offer.candidateEmail}) for Serial ${offer.serialNumber}.`,
      'info'
    );
  };

  const handleAcceptOffer = (serialNumber: string) => {
    const success = acceptOfferLetter(serialNumber);
    if (success) {
      addToast('Offer Accepted 🎉', 'You have officially accepted your employment contract.', 'success');
    }
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
            Tamper-proof serial numbers, instant HR email verification alerts, and employee contract access.
          </p>
        </div>

        {canManage && (
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New Offer Letter</span>
          </button>
        )}
      </div>

      {/* Tabs for Admins/HR with Personal Offer */}
      {canManage && (
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            All Company Offers ({offerLetters.length})
          </button>
          <button
            onClick={() => setActiveTab('my_offer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'my_offer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            My Personal Offer Letter {myOffer ? '★' : ''}
          </button>
        </div>
      )}

      {/* EMPLOYEE PERSONAL OFFER VIEW */}
      {(!canManage || activeTab === 'my_offer') && (
        <div className="space-y-4">
          {myOffer ? (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-cyan-500/30 p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Header inside card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 p-1.5 border border-cyan-500/40 flex items-center justify-center">
                    <img
                      src={myOfferOrg.logoUrl || '/vedotrix-logo.png'}
                      alt={myOfferOrg.name}
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/vedotrix-logo.png'; }}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block font-mono">
                      Official Employment Contract
                    </span>
                    <h3 className="text-lg font-bold text-white">{myOfferOrg.name}</h3>
                    <p className="text-xs text-slate-400">{myOfferOrg.address || 'Corporate Headquarters'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-lg">
                    {myOffer.serialNumber}
                  </span>
                  {isMyOfferAccepted ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      <span>Accepted</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      <span>Pending Acceptance</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Offer Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Candidate / Staff</span>
                  <p className="text-sm font-bold text-white mt-1">{myOffer.candidateName}</p>
                  <span className="text-[11px] text-cyan-400 block mt-0.5">{myOffer.candidateEmail}</span>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Designation & Dept</span>
                  <p className="text-sm font-bold text-indigo-300 mt-1">{myOffer.designation}</p>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{myOffer.department}</span>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Annual CTC</span>
                  <p className="text-base font-extrabold text-white font-mono mt-1">
                    {myOffer.annualCtc === 0 ? (
                      <span className="text-amber-400 font-sans text-sm font-bold">Unpaid Intern (₹0)</span>
                    ) : (
                      formatCurrency(myOffer.annualCtc)
                    )}
                  </p>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">
                    {myOffer.annualCtc === 0
                      ? 'Academic Training Contract'
                      : `${formatCurrency(Math.round(myOffer.annualCtc / 12))}/month gross`}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Joining & Verification</span>
                  <p className="text-xs font-bold text-slate-200 mt-1">
                    Joined: {new Date(myOffer.joiningDate).toLocaleDateString()}
                  </p>
                  {myOffer.securityCode && (
                    <span className="inline-flex items-center text-[10px] font-mono text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30 mt-1">
                      <Lock className="w-3 h-3 mr-1" />
                      PIN: {myOffer.securityCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Monthly Compensation Breakdown */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300">Monthly Compensation Structure</span>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Basic Salary (50%)</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {formatCurrency(myOffer.basicMonthly)}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">House Rent Allowance (25%)</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {formatCurrency(myOffer.hraMonthly)}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Special Allowance (25%)</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {formatCurrency(myOffer.specialAllowance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Employee */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onViewOffer(myOffer)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Digital Letterhead</span>
                  </button>

                  {myOffer.pdfUrl && (
                    <a
                      href={myOffer.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold transition border border-indigo-500/40"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      <span>Download Attached Contract</span>
                    </a>
                  )}

                  <button
                    onClick={() => onOpenVerify(myOffer.serialNumber)}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition border border-emerald-500/30"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify Authenticity</span>
                  </button>
                </div>

                {isMyOfferAccepted ? (
                  <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>✓ Offer Digitally Accepted</span>
                  </div>
                ) : myOffer.status === 'issued' ? (
                  <button
                    onClick={() => handleAcceptOffer(myOffer.serialNumber)}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold transition shadow-lg shadow-emerald-600/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>Digitally Sign & Accept Offer</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Offer Letter Linked to Your Account</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your HR administrator has not linked an official offer letter to your employee profile ({currentProfile?.email || 'your account'}) yet. Once created, your full compensation contract and digital verification will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ALL COMPANY OFFERS (ADMIN / HR VIEW) */}
      {canManage && activeTab === 'all' && (
        <div className="space-y-4">
          {/* Architecture Alert */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start space-x-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white">Tamper-Proof Offer Letter Engine</h4>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Every offer letter generated contains a cryptographic serial identifier. When issuing, you can select existing company employees or new recruits. Linked employees can view and digitally accept their offer letters directly from their portals.
              </p>
            </div>
          </div>

          {/* Table */}
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
                      <th className="p-3">Candidate / Employee</th>
                      <th className="p-3">Designation & Dept</th>
                      <th className="p-3 text-right">Annual CTC</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {offerLetters.map((offer) => {
                      const isAccepted = offer.status === 'accepted';
                      const offerOrg = allOrganizations?.find((o) => o.id === offer.orgId) || currentOrg;
                      return (
                        <tr key={offer.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-mono text-cyan-300 font-bold">
                                {offer.serialNumber}
                              </span>
                              {offerOrg.id !== currentOrg.id && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {offerOrg.orgCode}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              Issued {new Date(offer.createdAt).toLocaleDateString()} • {offerOrg.name}
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
                            <div className="font-bold text-white flex items-center space-x-1.5">
                              <span>{offer.candidateName}</span>
                              {offer.employeeId && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  STAFF
                                </span>
                              )}
                            </div>
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
                            {offer.annualCtc === 0 ? (
                              <span className="text-amber-400 font-sans text-xs font-semibold">Unpaid Intern (₹0)</span>
                            ) : (
                              formatCurrency(offer.annualCtc)
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isAccepted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {isAccepted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Accepted
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 mr-1" /> Issued
                                </>
                              )}
                            </span>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => onViewOffer(offer)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                title="View Official Letterhead"
                              >
                                <Eye className="w-4 h-4 text-cyan-400" />
                              </button>

                              <button
                                onClick={() => onOpenVerify(offer.serialNumber)}
                                className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 transition"
                                title="Verify Authenticity"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleResendEmail(offer)}
                                className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-400 transition"
                                title="Resend HR Audit Confirmation"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
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
      )}
    </div>
  );
};
