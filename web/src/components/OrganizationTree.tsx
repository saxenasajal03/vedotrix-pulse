import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Profile, UserRole } from '../types';
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Shield,
  Briefcase,
  Mail,
  Phone,
  UserCheck,
  Edit2,
  Check,
  X,
  Building,
  ArrowRight,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface TreeNodeProps {
  profile: Profile;
  allProfiles: Profile[];
  childrenProfiles: Profile[];
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  canManage: boolean;
  onOpenReassign: (emp: Profile) => void;
  searchQuery: string;
}

const getRoleBadgeStyle = (role: UserRole) => {
  switch (role) {
    case 'owner':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/50';
    case 'superadmin':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50';
    case 'hr':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50';
    case 'manager':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50';
  }
};

const TreeNode: React.FC<TreeNodeProps> = ({
  profile,
  allProfiles,
  childrenProfiles,
  level,
  expandedIds,
  toggleExpand,
  canManage,
  onOpenReassign,
  searchQuery
}) => {
  const isExpanded = expandedIds.has(profile.id);
  const hasChildren = childrenProfiles.length > 0;

  // Resolve manager
  const manager = profile.managerId ? allProfiles.find((p) => p.id === profile.managerId) : null;

  // Match highlight
  const isMatch =
    searchQuery &&
    (`${profile.firstName} ${profile.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.designation || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.department || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col items-start relative pl-4 sm:pl-6 my-2 transition-all">
      {/* Connector lines */}
      {level > 0 && (
        <div className="absolute left-0 top-6 w-4 sm:w-6 h-[1.5px] bg-slate-300 dark:bg-slate-700" />
      )}
      {level > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-slate-300 dark:bg-slate-700 -mt-2" />
      )}

      {/* Employee Card */}
      <div
        className={`w-full max-w-xl p-4 rounded-2xl border transition shadow-sm hover:shadow-md ${
          isMatch
            ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/20 dark:border-amber-600'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <img
                src={profile.avatarUrl || '/vedotrix-logo.png'}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/vedotrix-logo.png';
                }}
              />
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                  profile.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={profile.isActive ? 'Active Employee' : 'Inactive'}
              />
            </div>

            {/* Employee Details */}
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {profile.firstName} {profile.lastName}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(
                    profile.role
                  )}`}
                >
                  {profile.role}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                {profile.designation || 'Team Member'}
              </p>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span className="inline-flex items-center">
                  <Building className="w-3 h-3 mr-1 text-slate-400" />
                  {profile.department || 'Operations'}
                </span>
                <span>•</span>
                <span className="truncate">{profile.email}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {canManage && profile.role !== 'owner' && (
              <button
                onClick={() => onOpenReassign(profile)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                title="Change Reporting Manager"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {hasChildren && (
              <button
                onClick={() => toggleExpand(profile.id)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
              >
                <span>{childrenProfiles.length}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Reporting Manager Info Pill */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">Managed By:</span>
            {manager ? (
              <span className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
                👔 {manager.firstName} {manager.lastName}
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">
                  ({manager.designation || manager.role})
                </span>
              </span>
            ) : profile.role === 'owner' ? (
              <span className="inline-flex items-center font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                👑 Organization Head (Root Leadership)
              </span>
            ) : (
              <span className="inline-flex items-center font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                Direct Board / Management
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {hasChildren ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                👥 {childrenProfiles.length} Direct {childrenProfiles.length === 1 ? 'Report' : 'Reports'}
              </span>
            ) : (
              <span className="text-slate-400">Individual Contributor</span>
            )}
          </div>
        </div>
      </div>

      {/* Children Sub-Tree */}
      {hasChildren && isExpanded && (
        <div className="w-full flex flex-col relative pl-2 sm:pl-4 mt-2">
          {childrenProfiles.map((child) => {
            const grandChildren = allProfiles.filter((p) => p.managerId === child.id && p.id !== child.id);
            return (
              <TreeNode
                key={child.id}
                profile={child}
                allProfiles={allProfiles}
                childrenProfiles={grandChildren}
                level={level + 1}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                canManage={canManage}
                onOpenReassign={onOpenReassign}
                searchQuery={searchQuery}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const OrganizationTree: React.FC = () => {
  const { currentOrg, currentProfile, orgProfiles, isVedotrixSuperadmin, updateEmployeeManager, addToast } = useApp();

  const isTopLeadership =
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'hr' ||
    isVedotrixSuperadmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'tree' | 'department'>('tree');

  // Expanded nodes state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default: expand all leaders and managers
    const set = new Set<string>();
    orgProfiles.forEach((p) => {
      if (p.role === 'owner' || p.role === 'superadmin' || p.role === 'manager' || p.role === 'hr') {
        set.add(p.id);
      }
    });
    return set;
  });

  // Reassign Modal State
  const [reassignEmployee, setReassignEmployee] = useState<Profile | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [isSavingManager, setIsSavingManager] = useState(false);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    orgProfiles.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set);
  }, [orgProfiles]);

  // Filter profiles based on department and search
  const filteredProfiles = useMemo(() => {
    return orgProfiles.filter((p) => {
      if (deptFilter !== 'all' && p.department !== deptFilter) return false;
      return true;
    });
  }, [orgProfiles, deptFilter]);

  // Build hierarchical root nodes
  // A profile is a root if:
  // 1. Role is 'owner'
  // 2. OR they have no managerId
  // 3. OR their managerId points to themselves
  // 4. OR their managerId is not found in orgProfiles
  const rootProfiles = useMemo(() => {
    const roots: Profile[] = [];
    const nonRoots: Profile[] = [];

    // Find owners first
    const owners = orgProfiles.filter((p) => p.role === 'owner');
    if (owners.length > 0) {
      roots.push(...owners);
    }

    orgProfiles.forEach((p) => {
      if (p.role === 'owner') return;

      const hasValidManagerInOrg = p.managerId && orgProfiles.some((m) => m.id === p.managerId && m.id !== p.id);
      if (!hasValidManagerInOrg) {
        roots.push(p);
      } else {
        nonRoots.push(p);
      }
    });

    // Sort roots: owners first, then superadmins, then managers
    return roots.sort((a, b) => {
      const order: Record<UserRole, number> = {
        owner: 1,
        superadmin: 2,
        hr: 3,
        manager: 4,
        employee: 5
      };
      return (order[a.role] || 99) - (order[b.role] || 99);
    });
  }, [orgProfiles]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const next = new Set<string>();
    orgProfiles.forEach((p) => next.add(p.id));
    setExpandedIds(next);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleOpenReassign = (emp: Profile) => {
    setReassignEmployee(emp);
    setSelectedManagerId(emp.managerId || '');
  };

  const handleSaveReassignment = async () => {
    if (!reassignEmployee) return;
    setIsSavingManager(true);
    try {
      await updateEmployeeManager(reassignEmployee.id, selectedManagerId || null);
      setReassignEmployee(null);
    } catch (err) {
      console.error('Error reassigning manager:', err);
      addToast('Update Failed', 'Could not update reporting manager. Please try again.', 'error');
    } finally {
      setIsSavingManager(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organization Hierarchy Tree</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              {orgProfiles.length} Total Members
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete management hierarchy and direct reporting lines for {currentOrg.name}.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search member or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Expand / Collapse All */}
          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
              title="Expand All Hierarchy Branches"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
              title="Collapse All Hierarchy Branches"
            >
              Collapse
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('tree')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'tree'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Tree View</span>
            </button>
            <button
              onClick={() => setViewMode('department')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'department'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Department Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Hierarchy Container */}
      {viewMode === 'tree' ? (
        <div className="bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto min-h-[420px]">
          <div className="min-w-[680px]">
            {rootProfiles.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No organizational records found</p>
                <p className="text-xs text-slate-400 mt-0.5">Add employees or check your filters to view the tree.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rootProfiles.map((root) => {
                  const children = orgProfiles.filter((p) => p.managerId === root.id && p.id !== root.id);
                  return (
                    <TreeNode
                      key={root.id}
                      profile={root}
                      allProfiles={orgProfiles}
                      childrenProfiles={children}
                      level={0}
                      expandedIds={expandedIds}
                      toggleExpand={toggleExpand}
                      canManage={isTopLeadership}
                      onOpenReassign={handleOpenReassign}
                      searchQuery={searchQuery}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Department Matrix Grouping View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const deptEmps = filteredProfiles.filter((p) => p.department === dept);
            if (deptEmps.length === 0) return null;

            return (
              <div
                key={dept}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{dept}</h3>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {deptEmps.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {deptEmps.map((emp) => {
                    const mgr = emp.managerId ? orgProfiles.find((p) => p.id === emp.managerId) : null;
                    return (
                      <div
                        key={emp.id}
                        className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img
                              src={emp.avatarUrl || '/vedotrix-logo.png'}
                              alt={emp.firstName}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/vedotrix-logo.png';
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{emp.designation || 'Team Member'}</p>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${getRoleBadgeStyle(
                              emp.role
                            )}`}
                          >
                            {emp.role}
                          </span>
                        </div>

                        {/* Managed by in department view */}
                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            Managed by:{' '}
                            <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                              {mgr ? `${mgr.firstName} ${mgr.lastName}` : emp.role === 'owner' ? 'Root' : 'Management'}
                            </strong>
                          </span>
                          {isTopLeadership && emp.role !== 'owner' && (
                            <button
                              onClick={() => handleOpenReassign(emp)}
                              className="text-blue-600 hover:text-blue-700 text-[10px] font-bold"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reassign Reporting Manager Modal */}
      {reassignEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Reassign Reporting Manager</h3>
              </div>
              <button
                onClick={() => setReassignEmployee(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Employee Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center space-x-3">
              <img
                src={reassignEmployee.avatarUrl || '/vedotrix-logo.png'}
                alt={reassignEmployee.firstName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {reassignEmployee.firstName} {reassignEmployee.lastName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {reassignEmployee.designation || 'Team Member'} • {reassignEmployee.department}
                </p>
              </div>
            </div>

            {/* Select Reporting Manager */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Designated Reporting Manager:
              </label>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">No Manager (Direct Management / Top Level)</option>
                {orgProfiles
                  .filter((p) => p.id !== reassignEmployee.id)
                  .map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.firstName} {mgr.lastName} — {mgr.designation || mgr.role} ({mgr.department || 'Operations'})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-1">
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                <span>
                  Updates hierarchy instantly and persists to Supabase. All leave and access approvals will route to the selected manager.
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReassignEmployee(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingManager}
                onClick={handleSaveReassignment}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-50 inline-flex items-center space-x-1.5"
              >
                {isSavingManager ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Hierarchy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
