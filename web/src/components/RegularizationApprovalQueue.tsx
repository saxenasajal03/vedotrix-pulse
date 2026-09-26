import React from 'react';
import { useApp } from '../context/AppContext';
import { Check, X, Clock, AlertCircle, User, Calendar, MapPin } from 'lucide-react';

export const RegularizationApprovalQueue: React.FC = () => {
  const { attendanceRecords, resolveRegularization, orgProfiles, currentProfile } = useApp();

  const isReviewer = currentProfile.role === 'hr' || currentProfile.role === 'owner' || currentProfile.role === 'manager';
  const pendingRequests = attendanceRecords.filter((a) => a.regularizationStatus === 'pending');

  if (pendingRequests.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Pending Attendance Regularizations</h3>
            <p className="text-[11px] text-slate-400">
              {pendingRequests.length} request(s) awaiting approval
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
          Requires Action
        </span>
      </div>

      <div className="divide-y divide-slate-800">
        {pendingRequests.map((req) => {
          const emp = orgProfiles.find((p) => p.id === req.employeeId);
          return (
            <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white">
                    {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    {emp?.designation}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] italic bg-slate-950 p-2 rounded border border-slate-800">
                  "{req.regularizationReason || 'On-site regularized punch'}"
                </p>
                <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1 text-slate-500" />
                    Date: {req.date}
                  </span>
                  {req.distanceMeters && (
                    <span className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1 text-slate-500" />
                      Distance: {Math.round(req.distanceMeters)}m
                    </span>
                  )}
                </div>
              </div>

              {/* Review Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                {isReviewer ? (
                  <>
                    <button
                      onClick={() => resolveRegularization(req.id, 'approved')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => resolveRegularization(req.id, 'rejected')}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-amber-400 italic">
                    Reviewable by HR / Owner (Switch role to test)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
