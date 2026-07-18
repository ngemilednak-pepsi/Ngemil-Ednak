import React from 'react';
import { Printer } from 'lucide-react';

export interface PayslipRecord {
  payslipNo: string;
  month: string;
  userId: string;
  createdAt: string;
  basicSalary: number;
  allowance: number;
  bonus: number;
  overtime: number;
  deductions: number;
  netSalary: number;
}

interface DashboardPayslipModalProps {
  payslip: PayslipRecord | null;
  onClose: () => void;
  getEmployeeName: (userId: string) => string;
  getEmployeeRole: (userId: string) => string;
}

export default function DashboardPayslipModal({
  payslip,
  onClose,
  getEmployeeName,
  getEmployeeRole,
}: DashboardPayslipModalProps) {
  if (!payslip) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4 print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-12 print:w-full print:max-w-none print:h-full print:text-black print:dark:text-black print:rounded-none print:shadow-none print:border-none">
        
        {/* Header */}
        <div className="text-center border-b pb-3 border-dashed border-slate-200 dark:border-slate-800 space-y-1">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider print:text-black print:text-base">
            E-Payslip Slip Gaji Resmi
          </h3>
          <p className="font-mono text-[10px] text-slate-400 print:text-xs">
            SLIP NO: {payslip.payslipNo} &bull; {payslip.month}
          </p>
        </div>

        {/* Employee info */}
        <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 print:text-sm print:text-slate-800">
          <div className="flex justify-between">
            <span>Nama Karyawan:</span>
            <strong className="text-slate-800 dark:text-slate-900">
              {getEmployeeName(payslip.userId)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Jabatan Staf:</span>
            <strong className="text-slate-800 dark:text-slate-900">
              {getEmployeeRole(payslip.userId)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Tanggal Rilis:</span>
            <span>{new Date(payslip.createdAt).toLocaleDateString('id-ID')}</span>
          </div>
        </div>

        {/* Computations list */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border rounded-xl text-xs space-y-2 font-mono print:bg-white print:text-black print:border-slate-300 print:text-sm">
          <div className="flex justify-between text-slate-500 print:text-slate-700">
            <span>Gaji Pokok</span>
            <span>Rp {payslip.basicSalary.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-slate-500 print:text-slate-700">
            <span>Tunjangan Kehadiran</span>
            <span>Rp {payslip.allowance.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-slate-500 print:text-slate-700">
            <span>Bonus Prestasi</span>
            <span>Rp {payslip.bonus.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-slate-500 print:text-slate-700">
            <span>Lemburan</span>
            <span>Rp {payslip.overtime.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-red-500 border-b border-dashed border-slate-200 pb-2 print:border-slate-300">
            <span>Potongan Kasbon</span>
            <span>- Rp {payslip.deductions.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between font-black text-slate-900 dark:text-white pt-1 print:text-black">
            <span>Net Salary</span>
            <span className="text-orange-500 print:text-black font-extrabold text-sm">
              Rp {payslip.netSalary.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic text-center print:text-xs print:text-slate-600">
          "Pembayaran sah melalui transfer kas bank perusahaan."
        </p>

        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => {
              window.print();
            }}
            className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer size={12} />
            Cetak Slip
          </button>
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-250 font-bold rounded text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
