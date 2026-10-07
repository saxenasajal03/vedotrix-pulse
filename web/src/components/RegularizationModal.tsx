import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileEdit, X, Send, AlertCircle, Clock, Calendar } from 'lucide-react';
import { formatISTDate } from '../lib/serialUtils';

interface RegularizationModalProps {
  attendanceId: string | null;
  targetDate?: string | null;
  onClose: () => void;
}

export const RegularizationModal: React.FC<RegularizationModalProps> = ({
  attendanceId,
  targetDate,
  onClose
}) => {
  const { requestRegularization, currentOrg, attendanceRecords } = useApp();
  
  // Resolve existing record if attendanceId is provided
  const existingRecord = attendanceRecords.find((a) => a.id === attendanceId);
  const effectiveDate = targetDate || existingRecord?.date || new Date().toISOString().split('T')[0];

  const shiftStart = currentOrg.settings?.shiftStartTime || '09:30';
  const shiftEnd = currentOrg.settings?.shiftEndTime || '18:30';

  const [reasonCategory, setReasonCategory] = useState('Missed Punch-In / Punch-Out');
  const [requestedInTime, setRequestedInTime] = useState(shiftStart);
  const [requestedOutTime, setRequestedOutTime] = useState(shiftEnd);
  const [detailedReason, setDetailedReason] = useState('');
  const [selectedDate, setSelectedDate] = useState(effectiveDate);

  if (!attendanceId && !targetDate) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedReason.trim()) return;

    const fullReason = `[${reasonCategory}] Expected Shift: ${requestedInTime} - ${requestedOutTime} IST. Details: ${detailedReason.trim()}`;
    requestRegularization(attendanceId || selectedDate, fullReason, selectedDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Attendance Regularization Request
              </h3>
              <p className="text-[11px] text-slate-400">
                Routed to designated Manager / HR Administrator for review
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Target Date Header Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="block text-[11px] font-semibold text-slate-400">Target Attendance Date:</span>
                <span className="text-xs font-bold text-white font-mono">{formatISTDate(selectedDate)}</span>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              IST Zone
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Regularization Category *
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Missed Punch-In / Punch-Out">Missed Punch-In / Punch-Out (Forgot to record)</option>
              <option value="Client On-Site Visit">Client On-Site Visit / Field Duty</option>
              <option value="Approved Work-From-Home">Approved Work-From-Home (WFH)</option>
              <option value="Official Travel">Official Travel / Corporate Conference</option>
              <option value="Biometric / Network Glitch">Biometric / GPS Network Glitch</option>
              <option value="Medical / Family Emergency">Medical / Emergency Late Reporting</option>
              <option value="Shift Timing Misalignment">Shift Timing / Schedule Adjustment</option>
            </select>
          </div>

          {/* Requested Shift In / Out Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Actual Shift In (IST)</span>
              </label>
              <input
                type="time"
                required
                value={requestedInTime}
                onChange={(e) => setRequestedInTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Actual Shift Out (IST)</span>
              </label>
              <input
                type="time"
                required
                value={requestedOutTime}
                onChange={(e) => setRequestedOutTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Detailed Justification / Official Remarks *
            </label>
            <textarea
              required
              rows={3}
              value={detailedReason}
              onChange={(e) => setDetailedReason(e.target.value)}
              placeholder="e.g. Was present at office premises from 09:30 AM to 06:30 PM working on client sprint release. Faced biometric GPS timeout during morning login."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Once approved by your Manager or HR, attendance status will automatically update to <strong>Present (Regularized)</strong> with full work hours credited.
            </span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-md active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Verification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
