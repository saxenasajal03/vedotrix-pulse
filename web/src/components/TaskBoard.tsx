import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskItem, TaskStatus, TaskPriority } from '../types';
import {
  KanbanSquare,
  Plus,
  GitBranch,
  GitPullRequest,
  Target,
  Megaphone,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';

export const TaskBoard: React.FC = () => {
  const { currentOrg, tasks, createTask, updateTaskStatus, orgProfiles, currentProfile } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Tech Mode Fields
  const [gitBranch, setGitBranch] = useState('feature/new-module');
  const [prLink, setPrLink] = useState('');
  const [sprintName, setSprintName] = useState('Sprint 14 - Q4 Scaling');

  // Marketing Mode Fields
  const [campaignName, setCampaignName] = useState('Festive ROAS Blitz 2026');
  const [clientName, setClientName] = useState('Zenith Apparel');
  const [adSpendTarget, setAdSpendTarget] = useState<number>(250000);
  const [targetKpi, setTargetKpi] = useState('4.2x Blended ROAS');

  const isTech = currentOrg.industry === 'Tech';

  const canAssignAll =
    currentProfile.role === 'superadmin' ||
    currentProfile.role === 'owner' ||
    currentProfile.role === 'hr';

  // Employees can assign only to employees managed by them, or self
  const assignableProfiles = canAssignAll
    ? orgProfiles
    : orgProfiles.filter((p) => p.managerId === currentProfile.id || p.id === currentProfile.id);

  const [assignedTo, setAssignedTo] = useState(assignableProfiles[0]?.id || currentProfile.id);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('2026-09-30T18:00:00Z');

  const [taskFilter, setTaskFilter] = useState<'all' | 'my' | 'team'>('all');
  const directReportIds = new Set(
    orgProfiles.filter((p) => p.managerId === currentProfile.id).map((p) => p.id)
  );

  const visibleTasks = tasks.filter((t) => {
    if (taskFilter === 'my') return t.assignedTo === currentProfile.id;
    if (taskFilter === 'team') return directReportIds.has(t.assignedTo) || t.assignedTo === currentProfile.id;
    return true;
  });

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'todo', title: 'To Do / Backlog', color: 'border-slate-700 bg-slate-900/50' },
    { id: 'in_progress', title: 'In Progress', color: 'border-indigo-500/40 bg-indigo-950/20' },
    { id: 'review', title: isTech ? 'Code Review / PR' : 'Client Review', color: 'border-amber-500/40 bg-amber-950/20' },
    { id: 'done', title: 'Completed', color: 'border-emerald-500/40 bg-emerald-950/20' }
  ];

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createTask({
      title: title.trim(),
      description: description.trim(),
      assignedTo: assignedTo || currentProfile.id,
      createdBy: currentProfile.id,
      category: isTech ? 'tech' : 'marketing',
      status: 'todo',
      priority,
      dueDate,
      gitBranch: isTech ? gitBranch : undefined,
      prLink: isTech ? prLink : undefined,
      sprintName: isTech ? sprintName : undefined,
      campaignName: !isTech ? campaignName : undefined,
      clientName: !isTech ? clientName : undefined,
      adSpendTarget: !isTech ? adSpendTarget : undefined,
      targetKpi: !isTech ? targetKpi : undefined
    });

    setTitle('');
    setDescription('');
    setIsModalOpen(false);
  };

  const [mobileCol, setMobileCol] = useState<'all' | TaskStatus>('all');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Mode Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              {isTech ? 'Tech Sprints & Git Tasks' : 'Campaign Deliverables & ROAS Tracker'}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {currentOrg.industry} Mode
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isTech
              ? 'Track sprint backlogs, feature git branches, and PR reviews across engineering teams.'
              : 'Manage client campaign launches, ad spend budgets, ROAS metrics, and creative approvals.'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isTech ? 'New Tech Task' : 'New Campaign Task'}</span>
        </button>
      </div>

      {/* Filter Tabs for HR / Managers and Individual Assignees */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTaskFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              taskFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setTaskFilter('my')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              taskFilter === 'my'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Assigned to Me ({tasks.filter((t) => t.assignedTo === currentProfile.id).length})
          </button>
          <button
            onClick={() => setTaskFilter('team')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
              taskFilter === 'team'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>My Team's Tasks</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded ml-1">
              {tasks.filter((t) => directReportIds.has(t.assignedTo) || t.assignedTo === currentProfile.id).length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400">
          Showing: <strong className="text-white">{visibleTasks.length}</strong> tasks
        </div>
      </div>

      {/* Mobile Column Switcher */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:hidden">
        <button
          onClick={() => setMobileCol('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
            mobileCol === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          All ({visibleTasks.length})
        </button>
        {columns.map((c) => {
          const count = visibleTasks.filter((t) => t.status === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setMobileCol(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                mobileCol === c.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {c.title.split(' ')[0]} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.filter((c) => mobileCol === 'all' || mobileCol === c.id).map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className={`rounded-xl border ${col.color} p-4 flex flex-col min-h-[480px]`}>
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-slate-200">{col.title}</span>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.map((task) => {
                  const assignee = orgProfiles.find((p) => p.id === task.assignedTo);
                  return (
                    <div
                      key={task.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl shadow-md transition space-y-2.5"
                    >
                      {/* Priority and Category Tag */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            task.priority === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : task.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {task.priority}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {assignee ? `${assignee.firstName} ${assignee.lastName[0]}.` : 'Assigned'}
                        </span>
                      </div>

                      {/* Title & Desc */}
                      <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Tech Mode Badges */}
                      {task.category === 'tech' && (
                        <div className="space-y-1 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                          {task.gitBranch && (
                            <div className="flex items-center space-x-1 truncate text-cyan-400">
                              <GitBranch className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.gitBranch}</span>
                            </div>
                          )}
                          {task.prLink && (
                            <a
                              href={task.prLink}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center space-x-1 text-indigo-400 hover:underline truncate"
                            >
                              <GitPullRequest className="w-3 h-3 shrink-0" />
                              <span className="truncate">PR Link</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Marketing Mode Badges */}
                      {task.category === 'marketing' && (
                        <div className="space-y-1 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                          {task.campaignName && (
                            <div className="flex items-center space-x-1 text-indigo-400 font-medium truncate">
                              <Megaphone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.campaignName}</span>
                            </div>
                          )}
                          {task.targetKpi && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-cyan-400 font-bold">{task.targetKpi}</span>
                              {task.adSpendTarget && (
                                <span className="font-mono text-slate-400">
                                  {formatCurrency(task.adSpendTarget)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Move Column Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px]">
                        <span className="text-slate-500 font-medium">Move:</span>
                        <div className="flex space-x-1">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'todo')}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              Todo
                            </button>
                          )}
                          {col.id !== 'in_progress' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'in_progress')}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300"
                            >
                              Prog
                            </button>
                          )}
                          {col.id !== 'review' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'review')}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300"
                            >
                              Rev
                            </button>
                          )}
                          {col.id !== 'done' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'done')}
                              className="px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30"
                            >
                              Done ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center">
                <KanbanSquare className="w-4 h-4 mr-2 text-indigo-400" />
                {isTech ? 'Create Tech Task (Sprint & Git)' : 'Create Marketing Campaign Task'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isTech
                      ? 'e.g. Optimize PostgreSQL connection pool in Supabase'
                      : 'e.g. Launch Festive Google Search Ads Campaign'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task specifications and acceptance criteria..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assignee {!canAssignAll && '(Direct Reports Only)'}
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {assignableProfiles.map((p) => {
                      const isMe = p.id === currentProfile.id;
                      const isDirectReport = p.managerId === currentProfile.id;
                      return (
                        <option key={p.id} value={p.id}>
                          {isMe ? '👤 [Self] ' : isDirectReport ? '★ [My Report] ' : ''}
                          {p.firstName} {p.lastName} ({p.role.toUpperCase()} - {p.designation || p.department})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical (Blocker)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Tech Mode Fields */}
              {isTech && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                    Tech & Git Specification
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Git Branch Name</label>
                      <input
                        type="text"
                        value={gitBranch}
                        onChange={(e) => setGitBranch(e.target.value)}
                        placeholder="feature/branch-name"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-cyan-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Sprint</label>
                      <input
                        type="text"
                        value={sprintName}
                        onChange={(e) => setSprintName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Marketing Mode Fields */}
              {!isTech && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                    Digital Marketing Campaign Specifics
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Campaign Name</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Target ROAS / KPI</label>
                      <input
                        type="text"
                        value={targetKpi}
                        onChange={(e) => setTargetKpi(e.target.value)}
                        placeholder="e.g. 4.5x ROAS"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-cyan-300 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
