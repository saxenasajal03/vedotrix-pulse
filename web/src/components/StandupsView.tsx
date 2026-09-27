import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Plus, CheckCircle2, AlertCircle, Sparkles, User, Calendar } from 'lucide-react';

interface StandupsViewProps {
  onOpenSubmitModal: () => void;
}

export const StandupsView: React.FC<StandupsViewProps> = ({ onOpenSubmitModal }) => {
  const { currentOrg, standups, orgProfiles, currentProfile } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const hasSubmittedToday = standups.some(
    (s) => s.employeeId === currentProfile?.id && s.date === todayStr
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white">Daily EOD Standup Logs</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {currentOrg.industry} Team Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            End of day progress check-ins, roadblock detection, and sprint/campaign accountability.
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{hasSubmittedToday ? 'Update Today\'s Standup' : 'Submit EOD Standup'}</span>
        </button>
      </div>

      {/* Standup Feed Cards */}
      <div className="space-y-4">
        {standups.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
            No standup logs recorded yet for this organization.
          </div>
        ) : (
          standups.map((standup) => {
            const emp = orgProfiles.find((p) => p.id === standup.employeeId);
            return (
              <div
                key={standup.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30 shrink-0">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : 'U'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member'}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {emp?.designation} • {emp?.department}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs self-start sm:self-auto pl-12 sm:pl-0">
                    <span className="text-slate-400 text-[11px] flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {standup.date}
                    </span>
                    <span className="font-mono text-cyan-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                      {standup.hoursLogged} hrs
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Completed Today
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed">{standup.completedToday}</p>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center mb-1">
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Planned for Tomorrow
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed">{standup.plannedTomorrow}</p>
                  </div>
                </div>

                {standup.blockers && (
                  <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-amber-300">Blocker / Dependency:</strong>{' '}
                      <span>{standup.blockers}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
