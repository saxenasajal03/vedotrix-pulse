import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, X, Send, Sparkles, CheckSquare, HelpCircle } from 'lucide-react';

interface DailyStandupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyStandupModal: React.FC<DailyStandupModalProps> = ({ isOpen, onClose }) => {
  const { currentOrg, submitStandup, tasks, currentProfile } = useApp();

  // Pre-fill completed tasks if any
  const myCompletedTasks = tasks
    .filter((t) => t.assignedTo === currentProfile.id && t.status === 'done')
    .map((t) => t.title)
    .join(', ');

  const [completedToday, setCompletedToday] = useState(
    myCompletedTasks ? `Completed: ${myCompletedTasks}` : ''
  );
  const [plannedTomorrow, setPlannedTomorrow] = useState('');
  const [blockers, setBlockers] = useState('');
  const [hoursLogged, setHoursLogged] = useState(8);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedToday.trim() || !plannedTomorrow.trim()) return;

    submitStandup(completedToday.trim(), plannedTomorrow.trim(), blockers.trim(), hoursLogged);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Daily EOD Standup Submission</h3>
              <p className="text-[11px] text-slate-400">
                Synced with punch-out & team daily dashboard ({currentOrg.industry} Mode)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center">
              <CheckSquare className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              1. What did you accomplish today? *
            </label>
            <textarea
              required
              rows={2}
              value={completedToday}
              onChange={(e) => setCompletedToday(e.target.value)}
              placeholder={
                currentOrg.industry === 'Tech'
                  ? 'e.g. Fixed Redis connection pool leak and pushed branch feature/auth-cache for code review.'
                  : 'e.g. Launched 3 Advantage+ ad campaigns with 4.2x ROAS target for Zenith Apparel.'
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              2. What are your key priorities for tomorrow? *
            </label>
            <textarea
              required
              rows={2}
              value={plannedTomorrow}
              onChange={(e) => setPlannedTomorrow(e.target.value)}
              placeholder={
                currentOrg.industry === 'Tech'
                  ? 'e.g. Run automated load tests on staging and prepare release notes.'
                  : 'e.g. Review ROAS ad-spend metrics with client and adjust creative bid caps.'
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center">
              <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-400" />
              3. Any blockers, dependencies, or impediments? (Optional)
            </label>
            <input
              type="text"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="e.g. Waiting for staging AWS credentials or client creative assets."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-400">Total Hours Logged:</label>
              <input
                type="number"
                min="1"
                max="16"
                step="0.5"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(Number(e.target.value))}
                className="w-20 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Skip
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-indigo-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Standup Log</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
