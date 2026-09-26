import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PayrollRecord } from '../types';
import {
  Banknote,
  Download,
  CheckCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
  Building,
  User,
  ShieldCheck,
  X
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';

export const PayrollManager: React.FC = () => {
  const {
    currentOrg,
    orgProfiles,
    payrollRecords,
    processMonthlyPayroll,
    markPayrollPaid,
    exportBankPayoutCsv
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState(8);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);

  const monthRecords = payrollRecords.filter(
    (p) => p.month === selectedMonth && p.year === selectedYear
  );

  const totalDisbursed = monthRecords
    .filter((p) => p.payoutStatus === 'paid')
    .reduce((sum, r) => sum + r.netSalary, 0);

  const totalPending = monthRecords
    .filter((p) => p.payoutStatus === 'pending')
    .reduce((sum, r) => sum + r.netSalary, 0);

  const handleDownloadCsv = () => {
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
    monthRecords.forEach((record) => {
      if (record.payoutStatus === 'pending') {
        const ref = `NEFT-${currentOrg.orgCode}-${Date.now().toString().slice(-6)}`;
        markPayrollPaid(record.id, ref);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center">
            <Banknote className="w-5 h-5 mr-2 text-emerald-400" />
            Payouts & Payroll Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Attendance-driven salary calculations, batch NEFT/RTGS disbursals, and automated payslips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value={7}>July 2026</option>
            <option value={8}>August 2026</option>
            <option value={9}>September 2026</option>
          </select>

          {/* Compute Payroll Button */}
          <button
            onClick={() => processMonthlyPayroll(selectedMonth, selectedYear)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/20"
          >
            Compute Attendance Payroll
          </button>

          {/* Export Bank CSV Button */}
          <button
            onClick={handleDownloadCsv}
            disabled={monthRecords.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Bank Batch CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Net Payroll</span>
          <p className="text-xl font-extrabold text-white mt-1 font-mono">
            {formatCurrency(totalDisbursed + totalPending)}
          </p>
          <span className="text-[10px] text-slate-500">{monthRecords.length} Active Employees</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Disbursed (Paid)</span>
          <p className="text-xl font-extrabold text-emerald-300 mt-1 font-mono">
            {formatCurrency(totalDisbursed)}
          </p>
          <span className="text-[10px] text-emerald-500">Transferred via NEFT/RTGS</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Pending Payout</span>
            <p className="text-xl font-extrabold text-amber-300 mt-1 font-mono">
              {formatCurrency(totalPending)}
            </p>
            <span className="text-[10px] text-amber-500">Awaiting Bank Transfer</span>
          </div>
          {totalPending > 0 && (
            <button
              onClick={handleDisburseAll}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
            >
              Disburse All
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200">
            Payroll Ledger for {selectedMonth}/{selectedYear}
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">
            LOP Rule: Base Salary / Days × Absent Days
          </span>
        </div>

        {monthRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <p>No payroll computed for this cycle yet.</p>
            <button
              onClick={() => processMonthlyPayroll(selectedMonth, selectedYear)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold"
            >
              Generate Now Based on Attendance
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-center">Attendance / LOP</th>
                  <th className="p-3 text-right">Basic + HRA</th>
                  <th className="p-3 text-right">LOP Deduction</th>
                  <th className="p-3 text-right">Net Salary</th>
                  <th className="p-3 text-center">Payout Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {monthRecords.map((r) => {
                  const emp = orgProfiles.find((p) => p.id === r.employeeId);
                  const isPaid = r.payoutStatus === 'paid';
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <div className="font-bold text-white">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                        </div>
                        <span className="text-[10px] text-slate-400">{emp?.designation}</span>
                      </td>

                      <td className="p-3 text-center">
                        <span className="font-mono text-cyan-300 font-bold">
                          {r.presentDays}/{r.workingDays} days
                        </span>
                        {r.lossOfPayDays > 0 && (
                          <span className="block text-[10px] text-rose-400 font-semibold">
                            {r.lossOfPayDays} Day(s) LOP
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono">
                        {formatCurrency(r.basicPay + r.hra)}
                      </td>

                      <td className="p-3 text-right font-mono text-rose-400 font-medium">
                        {r.lopDeduction > 0 ? `-${formatCurrency(r.lopDeduction)}` : '₹0'}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(r.netSalary)}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {r.payoutStatus}
                        </span>
                        {r.paymentReference && (
                          <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                            {r.paymentReference}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right space-x-2">
                        {!isPaid && (
                          <button
                            onClick={() =>
                              markPayrollPaid(
                                r.id,
                                `NEFT-${currentOrg.orgCode}-${Date.now().toString().slice(-6)}`
                              )
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] transition shadow"
                          >
                            Disburse
                          </button>
                        )}
                        <button
                          onClick={() => setActivePayslip(r)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded text-[11px] transition"
                        >
                          Payslip
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

      {/* Payslip Modal */}
      {activePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-white">Monthly Payslip Preview</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Payslip Sheet (White Theme for Printability) */}
            <div className="p-8 bg-white text-slate-900 space-y-5 text-xs">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold uppercase text-slate-950">{currentOrg.name}</h2>
                  <p className="text-[11px] text-slate-600">{currentOrg.address}</p>
                  <p className="text-[11px] text-indigo-700 font-semibold">
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

              {/* Employee Summary */}
              {(() => {
                const emp = orgProfiles.find((p) => p.id === activePayslip.employeeId);
                return (
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 text-[11px]">
                    <div>
                      <p>
                        <strong>Name:</strong> {emp?.firstName} {emp?.lastName}
                      </p>
                      <p>
                        <strong>Designation:</strong> {emp?.designation}
                      </p>
                      <p>
                        <strong>Department:</strong> {emp?.department}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Account No:</strong> {activePayslip.bankAccountNumber}
                      </p>
                      <p>
                        <strong>IFSC:</strong> {activePayslip.bankIfsc}
                      </p>
                      <p>
                        <strong>Days Present:</strong> {activePayslip.presentDays} / {activePayslip.workingDays}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Earnings vs Deductions Table */}
              <div className="grid grid-cols-2 gap-4">
                {/* Earnings */}
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
                      <td className="p-2">House Rent Allowance</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.hra)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Special Allowances</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.allowances)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Deductions */}
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
                        {formatCurrency(activePayslip.lopDeduction)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2">Tax / PF Deductions</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(activePayslip.deductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Payable Highlight */}
              <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded font-bold">
                <span className="text-sm">NET SALARY PAYABLE</span>
                <span className="text-lg font-mono">{formatCurrency(activePayslip.netSalary)}</span>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-slate-200">
                <p>Generated by Vedotrix Pulse Multi-Tenant Payroll Architecture</p>
                <p className="font-bold text-slate-900">Designed & Managed by Vedotrix Technologies</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
