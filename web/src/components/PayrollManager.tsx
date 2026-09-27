import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PayrollRecord } from '../types';
import {
  Banknote,
  Download,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  Building,
  User,
  ShieldCheck,
  X,
  Edit3,
  Save,
  FileText,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { formatCurrency, formatSalaryOrStipend } from '../lib/serialUtils';

export const PayrollManager: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    isVedotrixSuperadmin,
    orgProfiles,
    payrollRecords,
    processMonthlyPayroll,
    markPayrollPaid,
    updatePayrollRecord,
    exportBankPayoutCsv,
    addToast
  } = useApp();

  const canManage =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  // Tabs matching reference screenshot
  const [activeTab, setActiveTab] = useState<'overview' | 'salary_slips' | 'deductions' | 'settings'>('overview');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);

  // Edit / Custom Deductions Modal State
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [editBasic, setEditBasic] = useState<number>(0);
  const [editAllowances, setEditAllowances] = useState<number>(0);
  const [editDeductions, setEditDeductions] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Scoped records: Non-managers only see their own payslips
  const monthRecords = payrollRecords.filter((p) => {
    if (p.month !== selectedMonth || p.year !== selectedYear) return false;
    if (!canManage) {
      return p.employeeId === currentProfile.id;
    }
    return true;
  });

  const totalDisbursed = monthRecords
    .filter((p) => p.payoutStatus === 'paid')
    .reduce((sum, r) => sum + r.netSalary, 0);

  const totalPending = monthRecords
    .filter((p) => p.payoutStatus === 'pending')
    .reduce((sum, r) => sum + r.netSalary, 0);

  const totalPayrollAmount = totalDisbursed + totalPending;
  const totalEmployeesCount = orgProfiles.length;
  const paidCount = monthRecords.filter((p) => p.payoutStatus === 'paid').length;
  const pendingCount = monthRecords.filter((p) => p.payoutStatus === 'pending').length;

  const handleDownloadCsv = () => {
    if (!canManage) return;
    const csvData = exportBankPayoutCsv(selectedMonth, selectedYear);
    if (!csvData) return;

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Batch_Payout_${currentOrg.orgCode}_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDisburseAll = () => {
    if (!canManage) return;
    monthRecords.forEach((record) => {
      if (record.payoutStatus === 'pending') {
        const ref = `NEFT-${currentOrg.orgCode}-${Date.now().toString().slice(-6)}`;
        markPayrollPaid(record.id, ref);
      }
    });
    addToast('All Disbursed 🚀', 'Marked all pending salary disbursements as paid via NEFT.', 'success');
  };

  const handleOpenEdit = (rec: PayrollRecord) => {
    setEditingRecord(rec);
    setEditBasic(rec.basicPay);
    setEditAllowances(rec.allowances || 0);
    setEditDeductions(rec.deductions || 0);
    setEditNotes(rec.deductionNotes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSavingEdit(true);

    const netSalary = Math.max(
      0,
      editBasic + editingRecord.hra + editAllowances - editDeductions - editingRecord.lopDeduction
    );

    updatePayrollRecord(editingRecord.id, {
      basicPay: editBasic,
      allowances: editAllowances,
      deductions: editDeductions,
      deductionNotes: editNotes.trim(),
      netSalary
    });

    setIsSavingEdit(false);
    setEditingRecord(null);
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Title matching Payroll screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {canManage ? 'Payroll' : 'My Payslips'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? `Automated attendance compensation and disbursements for ${currentOrg.name}.`
              : 'View and download your official monthly salary slips and tax statements.'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Bank CSV</span>
            </button>
            <button
              onClick={() => processMonthlyPayroll(selectedMonth, selectedYear)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <Banknote className="w-4 h-4" />
              <span>Process Payroll</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Tabs matching reference screenshot: Overview | Salary Slips | Deductions | Settings */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('salary_slips')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'salary_slips'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Salary Slips
        </button>
        <button
          onClick={() => setActiveTab('deductions')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'deductions'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Deductions
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Settings
        </button>
      </div>

      {/* 3. Top Metrics Row matching reference screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Total Payroll Big Card */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Total Payroll ({new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'short' })} {selectedYear})
              </span>
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span>{new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'short' })} {selectedYear}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
              {formatCurrency(totalPayrollAmount)}
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-block">
              {paidCount} Disbursed • {pendingCount} Pending
            </span>
          </div>

          {canManage && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Awaiting transfer: {formatCurrency(totalPending)}</span>
              <button
                onClick={() => processMonthlyPayroll(selectedMonth, selectedYear)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
              >
                Process Payroll
              </button>
            </div>
          )}
        </div>

        {/* 3 Right Stat Cards matching screenshot: Total Employees | Paid | Pending */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Employees */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Employees</span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono my-2">
              {totalEmployeesCount}
            </div>
            <span className="text-[11px] text-slate-400">Headcount</span>
          </div>

          {/* Paid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">Paid</span>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono my-2">
              {paidCount}
            </div>
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 w-fit">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
            </span>
          </div>

          {/* Pending */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">Pending</span>
            <div className="text-2xl font-extrabold text-amber-600 font-mono my-2">
              {pendingCount}
            </div>
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit">
              <Clock className="w-3 h-3 mr-1" /> Pending
            </span>
          </div>
        </div>
      </div>

      {/* 4. Recent Salary Disbursements Table matching reference screenshot */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800">
            Recent Salary Disbursements
          </h2>
          <span className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">
            View All →
          </span>
        </div>

        {monthRecords.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-2">
            <Banknote className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No payroll records generated for this cycle yet.</p>
            {canManage && (
              <button
                onClick={() => processMonthlyPayroll(selectedMonth, selectedYear)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Generate Now Based on Attendance
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4 text-center">Attendance / LOP</th>
                  <th className="p-4 text-right">Net Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {monthRecords.map((r) => {
                  const emp = orgProfiles.find((p) => p.id === r.employeeId) || currentProfile;
                  const isPaid = r.payoutStatus === 'paid';
                  const isUnpaidIntern = emp?.baseSalary === 0 || r.netSalary === 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      {/* Employee */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                            {emp.avatarUrl && emp.avatarUrl !== '/vedotrix-logo.png' ? (
                              <img src={emp.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.firstName[0]}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{emp.designation}</span>
                          </div>
                        </div>
                      </td>

                      {/* Attendance */}
                      <td className="p-4 text-center font-mono text-slate-600">
                        {r.presentDays}/{r.workingDays} days
                        {r.lossOfPayDays > 0 && (
                          <span className="block text-[10px] text-rose-500 font-semibold">
                            {r.lossOfPayDays} LOP
                          </span>
                        )}
                      </td>

                      {/* Net Amount */}
                      <td className="p-4 text-right font-mono font-bold text-slate-900 text-xs">
                        {isUnpaidIntern ? (
                          <span className="text-amber-600 font-sans text-[11px] font-semibold">
                            Unpaid Intern (₹0)
                          </span>
                        ) : (
                          formatCurrency(r.netSalary)
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setActivePayslip(r)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition"
                          >
                            View Slip
                          </button>

                          {canManage && (
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-[11px] transition border border-slate-200"
                              title="Adjust deductions & variations"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
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

      {/* Modal: Adjust Deductions & Variations */}
      {editingRecord && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">Adjust Deductions & Variations</h3>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Basic Pay (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editBasic}
                    onChange={(e) => setEditBasic(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Allowances / Bonus (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editAllowances}
                    onChange={(e) => setEditAllowances(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Custom Deductions (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editDeductions}
                  onChange={(e) => setEditDeductions(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Deduction Notes / Remarks</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. TDS: ₹500, Laptop Advance: ₹1000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Saving...' : 'Apply Variations'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Payslip Preview Sheet */}
      {activePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-slate-900">Monthly Payslip Preview</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 bg-white text-slate-900 space-y-5 text-xs">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold uppercase text-slate-950">{currentOrg.name}</h2>
                  <p className="text-[11px] text-slate-600">{currentOrg.address || 'Corporate Headquarters'}</p>
                  <p className="text-[11px] text-blue-700 font-semibold">
                    Payslip for Month: {activePayslip.month}/{activePayslip.year}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                    Status: {activePayslip.payoutStatus.toUpperCase()}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Ref: {activePayslip.paymentReference || 'CONFIDENTIAL'}
                  </p>
                </div>
              </div>

              {(() => {
                const emp = orgProfiles.find((p) => p.id === activePayslip.employeeId) || currentProfile;
                const isUnpaidIntern = emp?.baseSalary === 0 || activePayslip.netSalary === 0;

                return (
                  <div className="space-y-3">
                    {isUnpaidIntern && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-[11px] font-semibold flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Internship Program Record: Academic Training & Experience Program (Zero Net Stipend).</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 text-[11px]">
                      <div>
                        <p><strong>Name:</strong> {emp?.firstName} {emp?.lastName}</p>
                        <p><strong>Designation:</strong> {emp?.designation}</p>
                        <p><strong>Department:</strong> {emp?.department}</p>
                      </div>
                      <div>
                        <p><strong>Account No:</strong> {activePayslip.bankAccountNumber}</p>
                        <p><strong>IFSC:</strong> {activePayslip.bankIfsc}</p>
                        <p><strong>Days Present:</strong> {activePayslip.presentDays} / {activePayslip.workingDays}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <table className="w-full text-[11px] border border-slate-200">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-left">Earnings</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2">Basic Pay</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.basicPay)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">House Rent Allowance (HRA)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.hra)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Special Allowances</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.allowances)}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full text-[11px] border border-slate-200">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-left">Deductions</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2">Loss of Pay (LOP)</td>
                      <td className="p-2 text-right font-mono text-rose-600">
                        -{formatCurrency(activePayslip.lopDeduction)}
                      </td>
                    </tr>

                    <tr>
                      <td className="p-2">Custom Deductions / Notes</td>
                      <td className="p-2 text-right font-mono text-rose-600">
                        -{formatCurrency(activePayslip.deductions)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Take Home</span>
                  <span className="text-xl font-black font-mono text-slate-900">
                    {formatCurrency(activePayslip.netSalary)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Digitally Certified</span>
                  <span className="text-emerald-700 font-bold flex items-center text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> System Approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
