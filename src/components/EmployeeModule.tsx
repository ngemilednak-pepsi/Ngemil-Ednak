/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Camera, 
  Clock, 
  DollarSign, 
  PlusCircle, 
  Trash2, 
  Printer, 
  FileText,
  UserCheck,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { User } from '../types';

interface Payslip {
  id: string;
  payslipNo: string;
  userId: string;
  branchId: string;
  month: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  operatorId: string;
  note: string;
  createdAt: string;
}

interface LocalAttendance {
  id: string;
  userId: string;
  branchId: string;
  clockIn: string;
  selfieUrl: string;
  latitude: number;
  longitude: number;
  status: 'On Time' | 'Late';
}

interface EmployeeModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function EmployeeModule({ currentBranchId, currentUser, dbVersion }: EmployeeModuleProps) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<LocalAttendance[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const isHRAdmin = currentUser.role === 'Owner' || currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

  // View state: 'list' | 'attendance' | 'payslip' | 'shift' | 'calculator'
  const [currentView, setCurrentView] = useState<'list' | 'attendance' | 'payslip' | 'shift' | 'calculator'>(
    isHRAdmin ? 'list' : 'attendance'
  );

  useEffect(() => {
    if (currentView === 'shift' && currentUser.role !== 'Owner') {
      setCurrentView(isHRAdmin ? 'list' : 'attendance');
    }
    if (!isHRAdmin && currentView !== 'attendance' && currentView !== 'shift' && currentView !== 'calculator') {
      setCurrentView('attendance');
    }
  }, [currentView, isHRAdmin, currentUser.role]);

  // Attendance Selfie emulation states
  const [selfieSrc, setSelfieSrc] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Payslip creator form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [daysWorked, setDaysWorked] = useState<number>(26);
  const [allowancePerDay, setAllowancePerDay] = useState<number>(15000);
  const [overtimePay, setOvertimePay] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [bonusPay, setBonusPay] = useState<number>(0);
  const [payrollNote, setPayrollNote] = useState('');
  const [computedDays, setComputedDays] = useState<number>(0);
  const [computedLateCount, setComputedLateCount] = useState<number>(0);

  // View Payslip Modal
  const [activePayslip, setActivePayslip] = useState<Payslip | null>(null);

  // Interactive Calculator states
  const [calcEmpId, setCalcEmpId] = useState('');
  const [calcDaysWorked, setCalcDaysWorked] = useState<number>(26);
  const [calcLateCount, setCalcLateCount] = useState<number>(0);
  const [calcAllowancePerDay, setCalcAllowancePerDay] = useState<number>(15000);
  const [calcOvertimeHours, setCalcOvertimeHours] = useState<number>(0);
  const [calcOvertimeRate, setCalcOvertimeRate] = useState<number>(25000);
  const [calcDeductions, setCalcDeductions] = useState<number>(0);
  const [calcBonus, setCalcBonus] = useState<number>(0);

  // Staff Registration/Edit Modal states
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<'Owner' | 'Admin' | 'Supervisor' | 'Kasir' | 'Gudang' | 'Produksi' | 'Finance'>('Kasir');
  const [empBranchId, setEmpBranchId] = useState(currentBranchId);
  const [empAssignedBranchIds, setEmpAssignedBranchIds] = useState<string[]>([]);
  const [empAssignedWarehouseIds, setEmpAssignedWarehouseIds] = useState<string[]>([]);
  const [empPassword, setEmpPassword] = useState('admin123');
  const [empIsActive, setEmpIsActive] = useState(true);
  const [empBaseSalary, setEmpBaseSalary] = useState<number>(0);

  // Shift Settings states
  const [targetInTime, setTargetInTime] = useState(() => localStorage.getItem('erp_shift_target_in') || '09:00');
  const [targetOutTime, setTargetOutTime] = useState(() => localStorage.getItem('erp_shift_target_out') || '17:00');
  const [workDaysDesc, setWorkDaysDesc] = useState(() => localStorage.getItem('erp_shift_work_days') || 'Senin - Sabtu (6 Hari)');
  const [isEditingShiftSettings, setIsEditingShiftSettings] = useState(false);

  // Attendance filter states
  const [attFilterStartDate, setAttFilterStartDate] = useState('');
  const [attFilterEndDate, setAttFilterEndDate] = useState('');
  const [attFilterEmployeeId, setAttFilterEmployeeId] = useState('');

  const saveShiftSettings = () => {
    localStorage.setItem('erp_shift_target_in', targetInTime);
    localStorage.setItem('erp_shift_target_out', targetOutTime);
    localStorage.setItem('erp_shift_work_days', workDaysDesc);
    setIsEditingShiftSettings(false);
    LocalDb.logAudit(currentUser.id, 'Shift_Settings_Update', `Memperbarui ketentuan jam kerja: Masuk ${targetInTime}, Keluar ${targetOutTime}, Hari ${workDaysDesc}`);
    alert('Ketentuan jam kerja berhasil diperbarui!');
  };

  useEffect(() => {
    loadData();
    setEmpBranchId(currentBranchId);
  }, [currentBranchId, dbVersion]);

  // Auto-calculate payroll stats when selected employee changes
  useEffect(() => {
    if (selectedEmpId) {
      // Find all attendances for the selected employee
      const empAttendances = attendances.filter(a => a.userId === selectedEmpId);
      
      // Calculate unique days worked based on clockIn dates (YYYY-MM-DD)
      const uniqueDays = new Set(empAttendances.map(a => a.clockIn.split('T')[0]));
      const daysCount = uniqueDays.size;
      
      // Calculate how many times they were late based on 'Late' status
      const lateCount = empAttendances.filter(a => a.status === 'Late').length;
      
      setComputedDays(daysCount);
      setComputedLateCount(lateCount);
      
      // Update form values automatically:
      // If employee has logged attendance days, use that; otherwise default to standard 26 days
      setDaysWorked(daysCount > 0 ? daysCount : 26);
      
      // Auto-calculate deductions based on late count (e.g., Rp 50.000 fine per late clock-in)
      setDeductions(lateCount * 50000);
      
      // Auto-set note
      const empNameStr = getEmployeeName(selectedEmpId);
      setPayrollNote(`Gaji ${empNameStr} - Kehadiran: ${daysCount > 0 ? daysCount : '26 (standar)'} hari, Terlambat: ${lateCount}x`);
    } else {
      setComputedDays(0);
      setComputedLateCount(0);
      setDaysWorked(26);
      setDeductions(0);
      setPayrollNote('');
    }
  }, [selectedEmpId, attendances]);

  // Auto-calculate calculator stats when selected calculator employee changes
  useEffect(() => {
    if (calcEmpId) {
      const emp = employees.find(e => e.id === calcEmpId);
      const empAttendances = attendances.filter(a => a.userId === calcEmpId);
      
      const uniqueDays = new Set(empAttendances.map(a => a.clockIn.split('T')[0]));
      const daysCount = uniqueDays.size;
      const lateCount = empAttendances.filter(a => a.status === 'Late').length;
      
      setCalcDaysWorked(daysCount > 0 ? daysCount : 26);
      setCalcLateCount(lateCount);
      setCalcAllowancePerDay(15000);
      setCalcOvertimeHours(0);
      setCalcOvertimeRate(25000);
      setCalcDeductions(lateCount * 50000);
      setCalcBonus(0);
    } else {
      setCalcDaysWorked(26);
      setCalcLateCount(0);
      setCalcAllowancePerDay(15000);
      setCalcOvertimeHours(0);
      setCalcOvertimeRate(25000);
      setCalcDeductions(0);
      setCalcBonus(0);
    }
  }, [calcEmpId, attendances, employees]);

  const loadData = () => {
    // Only display workers for current branch (all branches for owner role)
    const allUsers = LocalDb.getUsers();
    const filteredUsers = currentUser.role === 'Owner' 
      ? allUsers 
      : allUsers.filter(u => u.branchId === currentBranchId);
    setEmployees(filteredUsers);

    // Filter attendances & payslips for current branch
    const allAtt = LocalDb.getAttendancesReal();
    setAttendances(allAtt.filter(a => a.branchId === currentBranchId).reverse());

    const allPay = LocalDb.getPayslipsReal();
    setPayslips(allPay.filter(p => p.branchId === currentBranchId).reverse());
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'manageEmployees')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengedit atau mendaftarkan pegawai.');
      return;
    }
    if (!empName || !empEmail || !empPhone) {
      alert('Mohon isi nama, email, dan telepon!');
      return;
    }

    const allUsers = LocalDb.getUsers();

    if (editingEmployee) {
      // Update existing
      const updatedUsers = allUsers.map(u => {
        if (u.id === editingEmployee.id) {
          return {
            ...u,
            name: empName.trim(),
            email: empEmail.toLowerCase().trim(),
            phone: empPhone.trim(),
            role: empRole,
            branchId: empBranchId,
            assignedBranchIds: empAssignedBranchIds.length > 0 ? empAssignedBranchIds : [empBranchId],
            assignedWarehouseIds: empAssignedWarehouseIds,
            isActive: empIsActive,
            password: empPassword || (u as any).password || 'admin123',
            baseSalary: Number(empBaseSalary) || 0
          };
        }
        return u;
      });
      LocalDb.saveUsers(updatedUsers);
      LocalDb.logAudit(currentUser.id, 'Employee_Update', `Mengubah profil staf: ${empName} (${empRole})`);
      alert('Profil staf berhasil diupdate!');
    } else {
      // Create new
      const emailExists = allUsers.some(u => u.email.toLowerCase() === empEmail.toLowerCase().trim());
      if (emailExists) {
        alert('Email sudah digunakan! Silakan pakai email lain.');
        return;
      }

      const newUser: User & { password?: string } = {
        id: `u-${Date.now()}`,
        name: empName.trim(),
        email: empEmail.toLowerCase().trim(),
        phone: empPhone.trim(),
        role: empRole,
        branchId: empBranchId,
        assignedBranchIds: empAssignedBranchIds.length > 0 ? empAssignedBranchIds : [empBranchId],
        assignedWarehouseIds: empAssignedWarehouseIds,
        isActive: empIsActive,
        createdAt: new Date().toISOString(),
        password: empPassword,
        baseSalary: Number(empBaseSalary) || 0
      };

      allUsers.push(newUser);
      LocalDb.saveUsers(allUsers);
      LocalDb.logAudit(currentUser.id, 'Employee_Create', `Mendaftarkan staf baru oleh Owner/Admin: ${empName} sebagai ${empRole}`);
      alert('Karyawan baru sukses terdaftar ke sistem!');
    }

    // Reset and close
    resetEmployeeForm();
    loadData();
  };

  const resetEmployeeForm = () => {
    setIsAddingEmployee(false);
    setEditingEmployee(null);
    setEmpName('');
    setEmpEmail('');
    setEmpPhone('');
    setEmpRole('Kasir');
    setEmpBranchId(currentBranchId);
    setEmpAssignedBranchIds([currentBranchId]);
    setEmpAssignedWarehouseIds([]);
    setEmpPassword('admin123');
    setEmpIsActive(true);
    setEmpBaseSalary(0);
  };

  const startEditEmployee = (emp: User) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpPhone(emp.phone);
    setEmpRole(emp.role);
    setEmpBranchId(emp.branchId);
    setEmpAssignedBranchIds(emp.assignedBranchIds || [emp.branchId]);
    setEmpAssignedWarehouseIds(emp.assignedWarehouseIds || []);
    setEmpPassword((emp as any).password || 'admin123');
    setEmpIsActive(emp.isActive);
    setEmpBaseSalary(emp.baseSalary || 0);
    setIsAddingEmployee(true);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    if (!LocalDb.hasPermission(currentUser, 'manageEmployees')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk menghapus pegawai.');
      return;
    }
    if (id === currentUser.id) {
      alert('Anda tidak bisa menghapus diri sendiri!');
      return;
    }
    if (id === 'u-01') {
      alert('Owner Utama sistem tidak dapat dihapus!');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus staf ${name} dari database?`)) {
      const allUsers = LocalDb.getUsers().filter(u => u.id !== id);
      LocalDb.saveUsers(allUsers);
      LocalDb.logAudit(currentUser.id, 'Employee_Delete', `Menghapus staf: ${name} (ID: ${id})`);
      loadData();
      alert('Karyawan berhasil dihapus.');
    }
  };

  const getEmployeeName = (id: string) => {
    return LocalDb.getUsers().find(u => u.id === id)?.name || 'Unknown Employee';
  };

  const getEmployeeRole = (id: string) => {
    return LocalDb.getUsers().find(u => u.id === id)?.role || 'Staf';
  };

  // Perform clock-in attendance emulation with camera selfie & gps
  const handleClockInSelfie = () => {
    setIsCapturing(true);

    // Simulate geolocation coordinates near the selected branch office
    const lat = -6.200000 + (Math.random() * 0.005);
    const lng = 106.816666 + (Math.random() * 0.005);

    setTimeout(() => {
      // Mock base64 selfie image
      const mockSelfie = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f97316"/><circle cx="50" cy="40" r="20" fill="white"/><path d="M20,80 Q50,50 80,80 Z" fill="white"/></svg>';
      
      const newAttendance: LocalAttendance = {
        id: `att-${Date.now()}`,
        userId: currentUser.id,
        branchId: currentBranchId,
        clockIn: new Date().toISOString(),
        selfieUrl: mockSelfie,
        latitude: lat,
        longitude: lng,
        status: (() => {
          const [targetHour, targetMin] = targetInTime.split(':').map(Number);
          const now = new Date();
          if (now.getHours() > targetHour || (now.getHours() === targetHour && now.getMinutes() > targetMin)) {
            return 'Late';
          }
          return 'On Time';
        })()
      };

      const allAtt = LocalDb.getAttendancesReal();
      LocalDb.saveAttendancesReal([...allAtt, newAttendance]);

      LocalDb.logAudit(currentUser.id, 'Employee_Attendance', `Melakukan Clock-In Absensi Selfie harian (${newAttendance.status})`);

      setIsCapturing(false);
      loadData();
      alert(`Absen Masuk Sukses!\nStatus: ${newAttendance.status}\nKoordinat Outlet: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }, 1500);
  };

  // Calculate live payroll figures
  const getSelectedEmployeeBaseSalary = () => {
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return 0;
    if (emp.baseSalary && emp.baseSalary > 0) {
      return emp.baseSalary;
    }
    return emp.role === 'Manager' ? 4500000 : 2500000;
  };

  const baseSalary = getSelectedEmployeeBaseSalary();
  const totalAllowance = daysWorked * allowancePerDay;
  const netTakeHomePay = baseSalary + totalAllowance + overtimePay + bonusPay - deductions;

  // Derived filtered attendances
  const filteredAttendances = attendances.filter(a => {
    // Only Owner is allowed to filter by employee or date range
    if (currentUser.role === 'Owner') {
      // 1. Employee filter
      if (attFilterEmployeeId && a.userId !== attFilterEmployeeId) {
        return false;
      }
      // 2. Date Range filter
      if (attFilterStartDate) {
        const start = new Date(attFilterStartDate + 'T00:00:00');
        const clockInDate = new Date(a.clockIn);
        if (clockInDate < start) return false;
      }
      if (attFilterEndDate) {
        const end = new Date(attFilterEndDate + 'T23:59:59');
        const clockInDate = new Date(a.clockIn);
        if (clockInDate > end) return false;
      }
    }
    return true;
  });

  const resetAttendanceFilters = () => {
    setAttFilterStartDate('');
    setAttFilterEndDate('');
    setAttFilterEmployeeId('');
  };

  // Submit Payroll calculation payslip
  const handleSavePayslip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'manageEmployees')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengalkulasi gaji & menerbitkan slip gaji.');
      return;
    }
    if (!selectedEmpId || netTakeHomePay <= 0) {
      alert('Pilih karyawan & lengkapi data absensi kerja!');
      return;
    }

    const payNo = `SLIP-${Date.now().toString().slice(-6)}`;
    const newPayslip: Payslip = {
      id: `p-${Date.now()}`,
      payslipNo: payNo,
      userId: selectedEmpId,
      branchId: currentBranchId,
      month: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
      basicSalary: baseSalary,
      allowance: totalAllowance,
      overtime: overtimePay,
      bonus: bonusPay,
      deductions,
      netSalary: netTakeHomePay,
      operatorId: currentUser.id,
      note: payrollNote || 'Gaji reguler bulanan',
      createdAt: new Date().toISOString()
    };

    // Store in LocalStorage/Firebase
    const allPay = LocalDb.getPayslipsReal();
    LocalDb.savePayslipsReal([...allPay, newPayslip]);

    // Register cash out ledger automatically!
    const ledgers = LocalDb.getFinanceLedgers();
    ledgers.push({
      id: `f-${Date.now()}`,
      branchId: currentBranchId,
      type: 'Out',
      category: 'Payroll_Expense',
      amount: netTakeHomePay,
      note: `Gaji Bulanan [${payNo}] Karyawan: ${getEmployeeName(selectedEmpId)}`,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    });
    LocalDb.saveFinanceLedgers(ledgers);

    LocalDb.logAudit(currentUser.id, 'Employee_Payroll_Paid', `Merilis & mencairkan slip gaji ${payNo} untuk ${getEmployeeName(selectedEmpId)} senilai Rp ${netTakeHomePay.toLocaleString('id-ID')}`);

    // Reset Form
    setSelectedEmpId('');
    setDaysWorked(26);
    setBonusPay(0);
    setOvertimePay(0);
    setDeductions(0);
    setPayrollNote('');
    setCurrentView('list');
    loadData();
    alert('Slip Gaji Karyawan sukses diterbitkan & pengeluaran gaji langsung dibukukan ke Laporan Keuangan!');
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Navigation Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">SDM, Absensi & Payroll Gaji</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">Kelola profil staf outlet, absen masuk selfie koordinat GPS, kalkulasi rincian BPJS/Lembur, dan rilis slip gaji.</p>
        </div>

        <div className="flex gap-2">
          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
            {isHRAdmin && (
              <button
                onClick={() => setCurrentView('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'list' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Daftar Staf
              </button>
            )}
            <button
              onClick={() => setCurrentView('attendance')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentView === 'attendance' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Absensi Selfie
            </button>
            {isHRAdmin && (
              <button
                onClick={() => setCurrentView('payslip')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'payslip' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                E-Payslip Gaji
              </button>
            )}
            {currentUser.role === 'Owner' && (
              <button
                onClick={() => setCurrentView('shift')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'shift' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Ketentuan Jam Kerja
              </button>
            )}
            <button
              onClick={() => setCurrentView('calculator')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentView === 'calculator' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kalkulator Gaji & Jam Kerja
            </button>
          </div>
        </div>
      </div>

      {currentView === 'list' && (
        /* EMPLOYEES REGISTER DIRECTORY */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b flex justify-between items-center border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Karyawan Terdaftar di Outlet Cabang</h3>
            {(() => {
              const canManageEmp = LocalDb.hasPermission(currentUser, 'manageEmployees');
              return (
                <button
                  onClick={() => {
                    if (!canManageEmp) {
                      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengelola data staf karyawan.');
                      return;
                    }
                    resetEmployeeForm();
                    setIsAddingEmployee(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    canManageEmp 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {canManageEmp ? <PlusCircle size={14} /> : <Lock size={14} />}
                  Tambah Karyawan Baru
                </button>
              );
            })()}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold uppercase">Nama Pegawai</th>
                  <th className="py-3 px-4 font-bold uppercase">Jabatan / Role</th>
                  <th className="py-3 px-4 font-bold uppercase">Cabang Tugas</th>
                  <th className="py-3 px-4 font-bold uppercase text-right">Gaji Pokok</th>
                  <th className="py-3 px-4 font-bold uppercase text-center">Status</th>
                  {LocalDb.hasPermission(currentUser, 'manageEmployees') && (
                    <th className="py-3 px-4 font-bold uppercase text-center">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {employees.map((emp, idx) => {
                  const basic = emp.role === 'Owner' ? 7500000 : emp.role === 'Admin' ? 5000000 : emp.role === 'Supervisor' ? 4500000 : 2500000;
                  const branchName = LocalDb.getBranches().find(b => b.id === emp.branchId)?.name.replace('Cabang ', '') || 'Semua Cabang';
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                      <td className="py-3.5 px-4 font-bold text-slate-850 dark:text-white">
                        <div>
                          <p className="flex items-center gap-1.5">
                            {emp.name}
                            {emp.id === currentUser.id && (
                              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1 rounded">Anda</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">ID: {emp.id} &bull; Email: {emp.email} &bull; HP: {emp.phone}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-300">
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">{branchName}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">Rp {basic.toLocaleString('id-ID')}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          emp.isActive 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
                        }`}>
                          {emp.isActive ? 'AKTIF' : 'PENDING / NON-AKTIF'}
                        </span>
                      </td>
                      {LocalDb.hasPermission(currentUser, 'manageEmployees') && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => startEditEmployee(emp)}
                              className="py-1 px-2 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white font-bold text-[10px] transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              className="py-1 px-2 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold text-[10px] transition-colors"
                              disabled={emp.id === currentUser.id || emp.id === 'u-01'}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentView === 'attendance' && (
        /* DAILY ATTENDANCE WITH GPS & SELFIE EMULATOR */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Clock-in Emulator Panel */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Presensi Harian Selfie GPS</h3>
            <p className="text-[11px] text-slate-400">Gunakan simulator kamera depan dan pelacak GPS di bawah untuk melakukan absen masuk pagi hari.</p>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border flex flex-col items-center justify-center space-y-4 h-56 relative overflow-hidden">
              <Camera size={40} className="text-orange-500 animate-pulse" />
              
              <div className="text-center">
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Kamera Selfie Outlet Siap</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Koordinat Wi-Fi IP di-bypass aman.</p>
              </div>

              {isCapturing ? (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 border-4 border-t-orange-500 border-slate-700 rounded-full animate-spin" />
                  <p className="text-white text-xs font-bold font-mono">Melacak GPS & Selfie...</p>
                </div>
              ) : null}
            </div>

            <button
              onClick={handleClockInSelfie}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-lg transition-all shadow cursor-pointer"
            >
              Ambil Selfie & Clock-In
            </button>
          </div>

          {/* Attendances list panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck size={16} className="text-orange-500" />
                Riwayat Absensi Selfie
              </h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Total: {filteredAttendances.length} data
              </span>
            </div>

            {/* Filter Bar */}
            {currentUser.role === 'Owner' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-850">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400">Pegawai</label>
                  <select
                    value={attFilterEmployeeId}
                    onChange={(e) => setAttFilterEmployeeId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  >
                    <option value="">Semua Pegawai</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400">Mulai Tanggal</label>
                  <input
                    type="date"
                    value={attFilterStartDate}
                    onChange={(e) => setAttFilterStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-400">Sampai Tanggal</label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={attFilterEndDate}
                      onChange={(e) => setAttFilterEndDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                    />
                    {(attFilterStartDate || attFilterEndDate || attFilterEmployeeId) && (
                      <button
                        type="button"
                        onClick={resetAttendanceFilters}
                        className="px-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-md text-xs font-bold transition-colors cursor-pointer"
                        title="Reset Filter"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 pb-2">
                    <th className="pb-2">Waktu Absen</th>
                    <th className="pb-2">Nama Pegawai</th>
                    <th className="pb-2">Jabatan</th>
                    <th className="pb-2">Selfie</th>
                    <th className="pb-2">Titik Koordinat GPS</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-650 dark:text-slate-400">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        {attendances.length === 0 ? 'Belum ada absen terekam hari ini.' : 'Tidak ada absensi yang cocok dengan kriteria filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((a, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-mono text-[10px] text-slate-400">{new Date(a.clockIn).toLocaleString('id-ID')}</td>
                        <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{getEmployeeName(a.userId)}</td>
                        <td className="py-3">{getEmployeeRole(a.userId)}</td>
                        <td className="py-3">
                          <img src={a.selfieUrl} alt="Selfie absensi" className="w-7 h-7 rounded-full border bg-orange-500 p-0.5" />
                        </td>
                        <td className="py-3 font-mono text-[10px] text-slate-400">{a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}</td>
                        <td className="py-3 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            a.status === 'On Time' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {a.status === 'On Time' ? 'Tepat Waktu' : 'TERLAMBAT'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {currentView === 'payslip' && (
        /* DYNAMIC PAYSLIP GENERATOR & HISTORY VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Payroll Generator Form */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Penerbitan Slip Gaji Pegawai</h3>
            <p className="text-[11px] text-slate-400">Hitung total kehadiran kerja, kalkulasi tunjangan makan harian, lemburan, dan potongan kasbon.</p>

            <form onSubmit={handleSavePayslip} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[9px] uppercase font-bold text-slate-400">Pilih Karyawan</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              {selectedEmpId && (
                <div className="bg-orange-50 dark:bg-slate-950/60 p-3 rounded-lg border border-orange-100 dark:border-slate-800/80 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400">Asisten Kalkulator Gaji</span>
                    <span className="inline-block px-1.5 py-0.5 text-[8px] bg-orange-100 dark:bg-slate-850 text-orange-700 dark:text-orange-300 font-bold rounded font-mono">
                      Sesuai Absensi
                    </span>
                  </div>
                  
                  <div className="text-[10px] space-y-1 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Ketentuan Jam Masuk:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{targetInTime} WIB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Kehadiran Terdata:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{computedDays} Hari</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Terlambat Absen:</span>
                      <span className="font-mono font-bold text-red-500">{computedLateCount} kali</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/50 pt-1 mt-1 text-[10px]">
                      <span>Estimasi Denda Telat:</span>
                      <span className="font-mono font-black text-red-500">Rp {(computedLateCount * 50000).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Hari Hadir Kerja</label>
                  <input
                    type="number"
                    value={daysWorked}
                    onChange={(e) => setDaysWorked(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded px-2 py-1 font-mono text-center font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Tunjangan Harian</label>
                  <input
                    type="number"
                    value={allowancePerDay}
                    onChange={(e) => setAllowancePerDay(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded px-2 py-1 font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Uang Lembur</label>
                  <input
                    type="number"
                    value={overtimePay}
                    onChange={(e) => setOvertimePay(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 rounded px-2 py-1 font-mono text-center font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Bonus Prestasi</label>
                  <input
                    type="number"
                    value={bonusPay}
                    onChange={(e) => setBonusPay(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 rounded px-2 py-1 font-mono text-center font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-red-500">Potongan BPJS/Telat</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 rounded px-2 py-1 font-mono text-center font-bold text-red-500"
                  />
                </div>
              </div>

              {/* Take-home pay math info */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Gaji Pokok Jabatan</span>
                  <span className="font-mono">Rp {baseSalary.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Tunjangan Uang Makan ({daysWorked} Hari)</span>
                  <span className="font-mono">Rp {totalAllowance.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Tambahan Lembur & Bonus</span>
                  <span className="font-mono">Rp {(overtimePay + bonusPay).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[10px] text-red-400">
                  <span>Potongan Kasbon / Denda</span>
                  <span className="font-mono">- Rp {deductions.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-xs text-slate-900 dark:text-white border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                  <span>Take Home Pay Bersih</span>
                  <span className="font-mono text-orange-500">Rp {netTakeHomePay.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] uppercase font-bold text-slate-400">Keterangan Transfer</label>
                <input
                  type="text"
                  placeholder="Contoh: Gaji bulan Agustus lengkap..."
                  value={payrollNote}
                  onChange={(e) => setPayrollNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded px-2 py-1.5"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedEmpId}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded"
              >
                Rilis Gaji & Cairkan Kas
              </button>
            </form>
          </div>

          {/* Payslip History Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={16} className="text-orange-500" />
              Histori Penggajian & Pengeluaran SDM
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">No. Slip</th>
                    <th className="py-2.5 px-3">Karyawan</th>
                    <th className="py-2.5 px-3">Periode</th>
                    <th className="py-2.5 px-3 text-right">Gaji Bersih</th>
                    <th className="py-2.5 px-3 text-center">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {payslips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Belum ada pengiriman slip gaji bulan ini.</td>
                    </tr>
                  ) : (
                    payslips.map((slip, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">{slip.payslipNo}</td>
                        <td className="py-3 px-3">
                          <p className="font-medium">{getEmployeeName(slip.userId)}</p>
                          <p className="text-[10px] text-slate-400">{getEmployeeRole(slip.userId)}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{slip.month}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-950 dark:text-white">Rp {slip.netSalary.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setActivePayslip(slip)}
                            className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 font-bold text-[10px]"
                          >
                            Lihat Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Dynamic Payslip accounting invoice modal emulation */}
      {activePayslip && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4">
            
            {/* Header */}
            <div className="text-center border-b pb-3 border-dashed border-slate-200 dark:border-slate-800 space-y-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">E-Payslip Slip Gaji Resmi</h3>
              <p className="font-mono text-[10px] text-slate-400">SLIP NO: {activePayslip.payslipNo} &bull; {activePayslip.month}</p>
            </div>

            {/* Employee info */}
            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Nama Karyawan:</span>
                <strong className="text-slate-800 dark:text-slate-200">{getEmployeeName(activePayslip.userId)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Jabatan Staf:</span>
                <strong>{getEmployeeRole(activePayslip.userId)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tanggal Rilis:</span>
                <span>{new Date(activePayslip.createdAt).toLocaleDateString('id-ID')}</span>
              </div>
            </div>

            {/* Computations list */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border rounded-xl text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Gaji Pokok</span>
                <span>Rp {activePayslip.basicSalary.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tunjangan Kehadiran</span>
                <span>Rp {activePayslip.allowance.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Bonus Prestasi</span>
                <span>Rp {activePayslip.bonus.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Lemburan</span>
                <span>Rp {activePayslip.overtime.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-red-500 border-b border-dashed border-slate-200 pb-2">
                <span>Potongan Kasbon</span>
                <span>- Rp {activePayslip.deductions.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 dark:text-white pt-1">
                <span>Net Salary</span>
                <span className="text-orange-500">Rp {activePayslip.netSalary.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic text-center">"Pembayaran sah melalui transfer kas bank perusahaan."</p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert('Melakukan print slip gaji kuitansi penggajian...');
                  window.print();
                }}
                className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5"
              >
                <Printer size={12} />
                Cetak Slip
              </button>
              <button
                onClick={() => setActivePayslip(null)}
                className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-250 font-bold rounded text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'shift' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Bagian Kiri: Ketentuan Jam Kerja (Settings & General Rules) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={16} className="text-orange-500" />
                Ketentuan Jam Kerja Cabang
              </h3>
              {currentUser.role === 'Owner' && !isEditingShiftSettings && (
                <button
                  onClick={() => setIsEditingShiftSettings(true)}
                  className="text-xs font-bold text-orange-500 hover:underline cursor-pointer text-right"
                >
                  Edit Ketentuan
                </button>
              )}
            </div>

            {!isEditingShiftSettings ? (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-850 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Target Jam Masuk:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono bg-orange-500/10 text-orange-500 px-2 py-1 rounded text-[12px]">{targetInTime} WIB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Target Jam Keluar:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-[12px]">{targetOutTime} WIB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Hari Kerja Aktif:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{workDaysDesc}</span>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30">
                  <p className="text-[11px] leading-relaxed font-semibold">
                    Informasi Jam Kerja:
                  </p>
                  <p className="text-[10px] leading-relaxed mt-1 text-slate-600 dark:text-slate-400 font-normal">
                    Sistem akan mencatat absensi karyawan secara otomatis. Absen masuk yang melebihi batas waktu <strong>{targetInTime}</strong> akan ditandai dengan status <span className="text-red-500 font-bold">Terlambat (Late)</span>. Pastikan semua karyawan melakukan absensi di outlet menggunakan fitur "Absensi Selfie".
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Target Jam Masuk</label>
                  <input
                    type="time"
                    value={targetInTime}
                    onChange={(e) => setTargetInTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Target Jam Keluar</label>
                  <input
                    type="time"
                    value={targetOutTime}
                    onChange={(e) => setTargetOutTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Hari Kerja Aktif</label>
                  <input
                    type="text"
                    placeholder="Contoh: Senin - Sabtu (6 Hari)"
                    value={workDaysDesc}
                    onChange={(e) => setWorkDaysDesc(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={saveShiftSettings}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-lg shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInTime(localStorage.getItem('erp_shift_target_in') || '09:00');
                      setTargetOutTime(localStorage.getItem('erp_shift_target_out') || '17:00');
                      setWorkDaysDesc(localStorage.getItem('erp_shift_work_days') || 'Senin - Sabtu (6 Hari)');
                      setIsEditingShiftSettings(false);
                    }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bagian Kanan: Status Ketentuan Tersambung di Setiap Karyawan */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={16} className="text-orange-500" />
                Ketentuan Terkoneksi Pada Setiap Karyawan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Berikut adalah daftar seluruh staf karyawan aktif dan ringkasan kepatuhan absensi mereka terhadap Ketentuan Jam Kerja ({targetInTime} - {targetOutTime}).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 pb-2">
                    <th className="pb-2">Karyawan</th>
                    <th className="pb-2">Jabatan</th>
                    <th className="pb-2">Ketentuan Jam</th>
                    <th className="pb-2">Hari Kerja</th>
                    <th className="pb-2 text-center">Tepat Waktu</th>
                    <th className="pb-2 text-center">Terlambat</th>
                    <th className="pb-2 text-right">Tingkat Kepatuhan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-650 dark:text-slate-400 font-sans">
                  {employees.map(emp => {
                    // Filter attendances for this specific employee
                    const empAtts = attendances.filter(a => a.userName === emp.name || a.userId === emp.id);
                    const onTimeCount = empAtts.filter(a => a.status === 'On Time').length;
                    const lateCount = empAtts.filter(a => a.status === 'Late').length;
                    const totalAtt = empAtts.length;
                    const rate = totalAtt > 0 ? Math.round((onTimeCount / totalAtt) * 100) : 100;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex flex-col">
                            <span>{emp.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">{emp.email}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350">
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {targetInTime} - {targetOutTime}
                        </td>
                        <td className="py-3 text-slate-500">
                          {workDaysDesc}
                        </td>
                        <td className="py-3 text-center text-emerald-500 font-bold font-mono">
                          {onTimeCount}x
                        </td>
                        <td className="py-3 text-center text-red-500 font-bold font-mono">
                          {lateCount}x
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`font-mono font-black text-xs ${
                              rate >= 90 ? 'text-emerald-500' : rate >= 75 ? 'text-orange-500' : 'text-red-500'
                            }`}>{rate}%</span>
                            <span className="text-[9px] text-slate-400 font-normal">dari {totalAtt} presensi</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {currentView === 'calculator' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Section 1: Edukasi Asal-Usul Gaji Pokok & Jam Kerja */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
              <Clock size={250} />
            </div>
            <div className="max-w-2xl space-y-2 relative z-10">
              <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono">
                Pusat Edukasi & Regulasi SDM
              </span>
              <h3 className="text-2xl font-black tracking-tight">Dari mana Gaji Pokok didapatkan?</h3>
              <p className="text-sm text-orange-50/90 leading-relaxed font-sans">
                Sistem menghitung Gaji Pokok karyawan berdasarkan dua sumber prioritas utama:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-sans">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-250 text-sm">
                    <span className="bg-orange-500/30 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                    Profil Karyawan (Kustom)
                  </div>
                  <p className="text-orange-50 font-medium">
                    Ditentukan oleh Owner/Admin saat mendaftarkan atau mengedit staf di menu <strong className="text-white">"Daftar Staf"</strong>. Jika diisi secara spesifik (misal Rp 3.000.000), maka nominal kustom inilah yang akan terus digunakan sebagai acuan slip gaji.
                  </p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-250 text-sm">
                    <span className="bg-orange-500/30 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                    Standar Jabatan (Bawaan)
                  </div>
                  <p className="text-orange-50 font-medium">
                    Jika nilai Gaji Pokok kustom pada profil dikosongkan (atau Rp 0), sistem otomatis menggunakan standar jabatan:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-orange-200 font-mono font-bold text-[11px]">
                    <li>Manager: Rp 4.500.000</li>
                    <li>Staf & Lainnya: Rp 2.500.000</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Salary Calculator */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Box: Controls */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Simulasi Perhitungan Gaji</h4>
                <p className="text-xs text-slate-400">Pilih karyawan untuk memuat data absensi nyata, kemudian sesuaikan parameter jam kerja untuk mensimulasikan rincian payroll.</p>
              </div>

              <div className="space-y-3.5 text-xs font-sans">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Pilih Karyawan untuk Simulasi</label>
                  <select
                    value={calcEmpId}
                    onChange={(e) => setCalcEmpId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Hari Hadir Kerja</label>
                    <input
                      type="number"
                      value={calcDaysWorked}
                      onChange={(e) => setCalcDaysWorked(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Tunjangan Harian (Rp)</label>
                    <input
                      type="number"
                      value={calcAllowancePerDay}
                      onChange={(e) => setCalcAllowancePerDay(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Jumlah Terlambat</label>
                    <input
                      type="number"
                      value={calcLateCount}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setCalcLateCount(val);
                        setCalcDeductions(val * 50000); // Auto-suggest denda
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center text-red-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Jam Lembur (Jam)</label>
                    <input
                      type="number"
                      value={calcOvertimeHours}
                      onChange={(e) => setCalcOvertimeHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Tarif Lembur (Rp/Jam)</label>
                    <input
                      type="number"
                      value={calcOvertimeRate}
                      onChange={(e) => setCalcOvertimeRate(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Bonus Prestasi (Rp)</label>
                    <input
                      type="number"
                      value={calcBonus}
                      onChange={(e) => setCalcBonus(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-center text-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Potongan Denda / Kasbon (Rp)</label>
                  <input
                    type="number"
                    value={calcDeductions}
                    onChange={(e) => setCalcDeductions(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 font-mono font-bold text-red-500"
                  />
                </div>

                {calcEmpId && (
                  <button
                    onClick={() => {
                      // Apply simulated inputs directly to the real E-Payslip creator form!
                      setSelectedEmpId(calcEmpId);
                      setDaysWorked(calcDaysWorked);
                      setAllowancePerDay(calcAllowancePerDay);
                      setOvertimePay(calcOvertimeHours * calcOvertimeRate);
                      setDeductions(calcDeductions);
                      setBonusPay(calcBonus);
                      
                      const simulatedName = getEmployeeName(calcEmpId);
                      setPayrollNote(`[Simulasi Kalkulator] Gaji ${simulatedName} - ${calcDaysWorked} Hari Hadir, ${calcLateCount}x Terlambat`);
                      
                      setCurrentView('payslip');
                      alert(`Hasil kalkulasi ${simulatedName} berhasil ditransfer ke form rilis slip gaji!`);
                    }}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-all text-xs"
                  >
                    <FileText size={14} />
                    Terapkan Hasil ke Form E-Payslip
                  </button>
                )}
              </div>
            </div>

            {/* Right Box: Results & Mathematical breakdown */}
            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-950/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 border-b pb-2 border-slate-200 dark:border-slate-800">
                <DollarSign size={16} className="text-orange-500" />
                Matriks Perhitungan Gaji & Ketentuan Jam Kerja
              </h4>

              {calcEmpId ? (
                (() => {
                  const emp = employees.find(e => e.id === calcEmpId);
                  const isCustom = emp && emp.baseSalary && emp.baseSalary > 0;
                  const eSalary = emp ? (isCustom ? emp.baseSalary! : (emp.role === 'Manager' ? 4500000 : 2500000)) : 0;
                  const eAllowance = calcDaysWorked * calcAllowancePerDay;
                  const eOvertime = calcOvertimeHours * calcOvertimeRate;
                  const eNet = eSalary + eAllowance + eOvertime + calcBonus - calcDeductions;

                  return (
                    <div className="space-y-4 text-xs font-sans animate-in fade-in duration-300">
                      
                      {/* Live Breakdown Table */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white">{emp?.name}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">Jabatan: {emp?.role}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full font-mono ${
                            isCustom ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {isCustom ? 'Gaji Pokok Kustom' : 'Gaji Pokok Standar Jabatan'}
                          </span>
                        </div>

                        {/* Mathematical Walkthrough */}
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-start text-[11px]">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-300">1. Gaji Pokok</p>
                              <p className="text-[10px] text-slate-400 italic font-normal leading-relaxed">
                                {isCustom 
                                  ? '* Diambil dari nilai kustom profil karyawan yang telah diatur di database.' 
                                  : `* Karyawan menggunakan tarif default untuk jabatan ${emp?.role || 'Staf'}.`}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">Rp {eSalary.toLocaleString('id-ID')}</span>
                          </div>

                          <div className="flex justify-between items-start text-[11px] border-t border-slate-50 dark:border-slate-800 pt-2">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-300">2. Tunjangan Harian (Uang Makan & Transport)</p>
                              <p className="text-[10px] text-slate-400 italic font-normal leading-relaxed">
                                * Rumus: {calcDaysWorked} Hari Hadir × Rp {calcAllowancePerDay.toLocaleString('id-ID')} per hari.
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">Rp {eAllowance.toLocaleString('id-ID')}</span>
                          </div>

                          <div className="flex justify-between items-start text-[11px] border-t border-slate-50 dark:border-slate-800 pt-2">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-300">3. Jam Lembur Terhitung</p>
                              <p className="text-[10px] text-slate-400 italic font-normal leading-relaxed">
                                * Rumus: {calcOvertimeHours} Jam Kerja Lembur × Rp {calcOvertimeRate.toLocaleString('id-ID')}/jam.
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">Rp {eOvertime.toLocaleString('id-ID')}</span>
                          </div>

                          <div className="flex justify-between items-start text-[11px] border-t border-slate-50 dark:border-slate-800 pt-2">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-300">4. Bonus Kinerja</p>
                              <p className="text-[10px] text-slate-400 italic font-normal leading-relaxed">
                                * Tambahan opsional pencapaian performa kerja.
                              </p>
                            </div>
                            <span className="font-mono font-bold text-emerald-500">Rp {calcBonus.toLocaleString('id-ID')}</span>
                          </div>

                          <div className="flex justify-between items-start text-[11px] border-t border-slate-50 dark:border-slate-800 pt-2 text-red-500">
                            <div>
                              <p className="font-bold">5. Potongan Denda / Keterlambatan</p>
                              <p className="text-[10px] text-red-400/80 italic font-normal leading-relaxed">
                                * Dikalkulasi berdasarkan {calcLateCount} kali absensi melebihi jam masuk ({targetInTime}).
                              </p>
                            </div>
                            <span className="font-mono font-bold">- Rp {calcDeductions.toLocaleString('id-ID')}</span>
                          </div>
                        </div>

                        {/* Grand Total */}
                        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs uppercase font-bold text-slate-400">Total Take-Home Pay</span>
                            <span className="text-[9px] block text-slate-400 leading-none">Formula: (Gaji Pokok + Tunjangan + Lembur + Bonus) - Potongan</span>
                          </div>
                          <span className="font-mono text-xl font-black text-orange-500">
                            Rp {eNet.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Informative Guidance */}
                      <div className="bg-orange-50 dark:bg-slate-950 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed font-sans">
                        <p className="font-bold text-orange-700 dark:text-orange-400">Hubungan Jam Kerja & Kepatuhan Absensi:</p>
                        <ul className="list-decimal list-inside space-y-1 text-[10.5px]">
                          <li>
                            Waktu masuk yang ditargetkan cabang adalah <strong className="text-slate-800 dark:text-white">{targetInTime} WIB</strong>. Kehadiran melewati jam ini diklasifikasikan sebagai <span className="text-red-500 font-bold">Terlambat (Late)</span> di modul absensi.
                          </li>
                          <li>
                            Total kehadiran dan keterlambatan real-time otomatis dimuat dari histori <strong>Absensi Selfie</strong>. Hal ini mempermudah operator keuangan dalam meminimalkan denda yang tidak akurat.
                          </li>
                        </ul>
                      </div>

                    </div>
                  );
                })()
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
                  <Clock size={32} className="mb-2 text-slate-300 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-350">Belum Ada Karyawan Terpilih</p>
                  <p className="text-[10px] max-w-xs mt-1 text-slate-500 dark:text-slate-400">Silakan pilih salah satu staf dari dropdown menu di bagian kiri untuk memulai simulasi rincian perhitungan gaji sesuai jam kerja mereka.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Staff Add/Edit Administration Modal */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4">
            
            <div className="border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingEmployee ? 'Otorisasi Jabatan & Cabang Tugas' : 'Daftarkan Staf Baru'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {editingEmployee 
                  ? 'Tentukan Peran (Roles), Cabang Outlet Penugasan, dan aktifkan status akun untuk memberikan izin masuk sistem.' 
                  : 'Pendaftaran karyawan baru secara manual dengan penentuan jabatan dan cabang tugas secara langsung oleh Owner/Admin.'}
              </p>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Nama Lengkap Karyawan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Fauzi"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Email Login</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@dapurrisol.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                    disabled={!!editingEmployee}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Nomor Handphone</label>
                  <input
                    type="tel"
                    required
                    placeholder="0812XXXXXXXX"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Jabatan / Peran (Role)</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans font-medium"
                    disabled={editingEmployee?.id === 'u-01'} // Owner utama can't change their role
                  >
                    <option value="Kasir">Kasir</option>
                    <option value="Admin">Admin</option>
                    <option value="Gudang">Gudang</option>
                    <option value="Produksi">Produksi</option>
                    <option value="Finance">Finance</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Cabang Utama (Default)</label>
                  <select
                    value={empBranchId}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setEmpBranchId(selectedVal);
                      if (!empAssignedBranchIds.includes(selectedVal)) {
                        setEmpAssignedBranchIds(prev => [...prev, selectedVal]);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans font-medium"
                  >
                    {LocalDb.getBranches().map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Branch Penugasan Checkboxes */}
              <div className="space-y-1.5 border-t pt-2 border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono">Semua Cabang Penugasan (Bisa Lebih Dari 1)</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 max-h-[100px] overflow-y-auto">
                  {LocalDb.getBranches().map(b => {
                    const isChecked = empAssignedBranchIds.includes(b.id) || empBranchId === b.id;
                    return (
                      <label key={b.id} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={empBranchId === b.id} // Primary branch must be assigned
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmpAssignedBranchIds(prev => [...prev, b.id]);
                            } else {
                              setEmpAssignedBranchIds(prev => prev.filter(id => id !== b.id));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate" title={b.name}>
                          {b.name.replace('Cabang ', '')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Warehouse Access Checkboxes */}
              <div className="space-y-1.5 border-t pt-2 border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono">Asal Stok Gudang Terpilih (Bisa Lebih Dari 1)</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 max-h-[100px] overflow-y-auto">
                  {LocalDb.getWarehouses().map(w => {
                    const isChecked = empAssignedWarehouseIds.includes(w.id);
                    return (
                      <label key={w.id} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmpAssignedWarehouseIds(prev => [...prev, w.id]);
                            } else {
                              setEmpAssignedWarehouseIds(prev => prev.filter(id => id !== w.id));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate" title={w.name}>
                          {w.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Gaji Pokok Custom Configuration */}
              <div className="space-y-1.5 border-t pt-2 border-slate-100 dark:border-slate-800">
                <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono">Gaji Pokok Karyawan (Rp)</label>
                <input
                  type="number"
                  placeholder="Isi angka rupiah. Jika 0, standar jabatan berlaku (Manager: 4.5jt, Staf: 2.5jt)"
                  value={empBaseSalary || ''}
                  onChange={(e) => setEmpBaseSalary(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono text-xs font-bold"
                />
                <span className="text-[9px] text-slate-400 block italic leading-none">
                  * Gaji pokok ini akan terisi otomatis sebagai acuan perhitungan slip gaji karyawan bersangkutan.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Kata Sandi Login</label>
                  <input
                    type="text"
                    required
                    placeholder="Sandi default: admin123"
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Status Akun</label>
                  <select
                    value={empIsActive ? 'Active' : 'Inactive'}
                    onChange={(e) => setEmpIsActive(e.target.value === 'Active')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans font-medium"
                    disabled={editingEmployee?.id === currentUser.id} // Cannot disable self
                  >
                    <option value="Active">Aktif / Berikan Akses</option>
                    <option value="Inactive">Non-Aktif / Bekukan</option>
                  </select>
                </div>
              </div>

              {/* Review Dokumen Upload Staf */}
              {editingEmployee && ((editingEmployee as any).ktpFiles || (editingEmployee as any).supportingDocument) && (
                <div className="bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 rounded-xl p-3 space-y-2">
                  <span className="text-[10px] font-black uppercase text-orange-500 block">Verifikasi Dokumen Pendaftaran</span>
                  
                  {/* KTP/SIM */}
                  {(editingEmployee as any).ktpFiles && (editingEmployee as any).ktpFiles.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">File KTP / SIM ({(editingEmployee as any).ktpFiles.length} file)</p>
                      <div className="space-y-1 max-h-[80px] overflow-y-auto">
                        {(editingEmployee as any).ktpFiles.map((file: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-150 dark:border-slate-800 text-[9px] font-mono shadow-xs">
                            <span className="truncate pr-2 text-slate-600 dark:text-slate-350">{file.name}</span>
                            <a 
                              href={file.data} 
                              download={file.name}
                              className="text-orange-500 hover:underline shrink-0 font-bold"
                            >
                              Unduh / Lihat
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supporting Document */}
                  {(editingEmployee as any).supportingDocument && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Dokumen Pendukung</p>
                      <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-150 dark:border-slate-800 text-[9px] font-mono shadow-xs">
                        <span className="truncate pr-2 text-slate-600 dark:text-slate-350">{(editingEmployee as any).supportingDocument.name}</span>
                        <a 
                          href={(editingEmployee as any).supportingDocument.data} 
                          download={(editingEmployee as any).supportingDocument.name}
                          className="text-orange-500 hover:underline shrink-0 font-bold"
                        >
                          Unduh / Lihat
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 justify-end">
                <button
                  type="button"
                  onClick={resetEmployeeForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-lg transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all shadow-md shadow-orange-500/10"
                >
                  {editingEmployee ? 'Simpan Perubahan' : 'Daftarkan Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
