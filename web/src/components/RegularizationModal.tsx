import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileEdit, X, Send, AlertCircle } from 'lucide-react';

interface RegularizationModalProps {
  attendanceId: string | null;
  onClose: () => void;
}

export const RegularizationModal: React.FC<RegularizationModalProps> = ({ attendanceId, onClose }) => {
  const { requestRegularization } = useApp();
  const [reasonCategory, setReasonCategory] = useState('Client On-Site Visit');
  const [detailedReason, setDetailedReason] = useState('');

  if (!attendanceId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedReason.trim()) return;

    const fullReason = `${reasonCategory}: ${detailedReason.trim()}`;
    requestRegularization(attendanceId, fullReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Attendance Regularization Request</h3>
              <p className="text-[11px] text-slate-400">Sent to Reporting Lead & HR for Approval</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Regularization Category
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Client On-Site Visit">Client On-Site Visit / Field Work</option>
              <option value="Approved Work-From-Home">Approved Work-From-Home (WFH)</option>
              <option value="Missed Punch-In / Punch-Out">Missed Punch-In / Punch-Out</option>
              <option value="Biometric / Network Glitch">Biometric / Network Glitch</option>
              <option value="Official Travel">Official Travel / Conference</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Detailed Justification *
            </label>
            <textarea
              required
              rows={3}
              value={detailedReason}
              onChange={(e) => setDetailedReason(e.target.value)}
              placeholder="e.g. Attended campaign strategy session at Zenith Apparel corporate office from 10:30 AM to 6:00 PM."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Regularized attendance will count as full present day upon manager approval.</span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Approval</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
