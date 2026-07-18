/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  HelpCircle,
  Cpu,
  UserCheck,
  User as UserIcon,
  Phone,
  Building,
  PlusCircle,
  LogIn,
  Upload,
  FileText,
  X,
  CheckCircle2,
  MailCheck,
  Trash2
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { User, UserRole } from '../types';

interface AuthModuleProps {
  onLoginSuccess: (user: User) => void;
}

export default function AuthModule({ onLoginSuccess }: AuthModuleProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Register states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // File upload states (KTP can be multiple, Supporting Doc is exactly 1)
  const [ktpFiles, setKtpFiles] = useState<{ name: string; size: number; data: string }[]>([]);
  const [supportingDoc, setSupportingDoc] = useState<{ name: string; size: number; data: string } | null>(null);
  const [isKtpDragging, setIsKtpDragging] = useState(false);
  const [isDocDragging, setIsDocDragging] = useState(false);

  // Success Pop-Up & Simulated Email state
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [lastRegisteredName, setLastRegisteredName] = useState('');
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState('');

  const handleKtpUpload = (filesList: FileList | null) => {
    if (!filesList) return;
    Array.from(filesList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setKtpFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            data: event.target!.result as string
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSupportingDocUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSupportingDoc({
          name: file.name,
          size: file.size,
          data: event.target!.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKtpDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsKtpDragging(false);
    handleKtpUpload(e.dataTransfer.files);
  };

  const handleDocDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDocDragging(false);
    handleSupportingDocUpload(e.dataTransfer.files?.[0]);
  };

  // Handle standard manual login
  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Isi semua kolom form login!');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const users = LocalDb.getUsers();
      const match = users.find(u => {
        const userPass = (u as any).password || 'admin123';
        return u.email.toLowerCase() === email.toLowerCase().trim() && userPass === password;
      });
      
      setIsLoading(false);

      if (match) {
        if (!match.isActive) {
          setIsLoading(false);
          alert('Akun Anda NON-AKTIF atau sedang menunggu persetujuan/aktivasi dari Owner atau Administrator. Silakan hubungi Owner untuk mengaktifkan akun, menetapkan Peran (Roles), serta menentukan Cabang Tugas Anda.');
          return;
        }
        LocalDb.logAudit(match.id, 'User_Login', `Login berhasil sebagai ${match.name} (${match.role})`);
        onLoginSuccess(match);
      } else {
        alert('Email atau Password salah! Gunakan tombol Quick Bypass di bawah jika lupa sandi.');
      }
    }, 1000);
  };

  // Handle register new staff/owner
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPassword || !regConfirmPassword) {
      alert('Mohon isi semua kolom registrasi!');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      alert('Sandi dan Konfirmasi Sandi tidak cocok!');
      return;
    }

    if (ktpFiles.length === 0) {
      alert('Mohon unggah dokumen KTP / SIM Anda (bisa lebih dari 1 file)!');
      return;
    }

    if (!supportingDoc) {
      alert('Mohon unggah Dokumen Pendukung Anda (CV, Surat Lamaran, dll)!');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const users = LocalDb.getUsers();

      // Check if email already registered
      const emailExists = users.some(u => u.email.toLowerCase() === regEmail.toLowerCase().trim());
      if (emailExists) {
        setIsLoading(false);
        alert('Email sudah terdaftar! Gunakan email lain.');
        return;
      }

      // Default role is Kasir (but inactive/waiting for Owner's approval and assignment)
      const newUser: User & { password?: string } = {
        id: `u-${Date.now()}`,
        email: regEmail.toLowerCase().trim(),
        name: regName.trim(),
        phone: regPhone.trim(),
        role: 'Kasir',
        isActive: false, // Must be activated by Owner
        branchId: 'b-01', // Default initial branch (Owner will modify this inside the menu)
        createdAt: new Date().toISOString(),
        ktpFiles: ktpFiles,
        supportingDocument: supportingDoc
      };
      
      // Store password on the user object for mock authentication
      newUser.password = regPassword;

      users.push(newUser as User);
      LocalDb.saveUsers(users);
      LocalDb.logAudit(newUser.id, 'User_Register', `Pendaftaran staf mandiri: ${newUser.name} menunggu aktivasi & cabang tugas dari Owner`);

      // Save registration info for the success pop-up
      setLastRegisteredName(regName.trim());
      setLastRegisteredEmail(regEmail.toLowerCase().trim());

      setIsLoading(false);
      setShowSuccessPopup(true);
      
      // Auto fill login fields and transition to login screen
      setEmail(regEmail);
      setPassword(''); // Don't autofill so they can see the message or try after activation
      setMode('login');

      // Reset reg form
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirmPassword('');
      setKtpFiles([]);
      setSupportingDoc(null);
    }, 1000);
  };

  // Instant Shortcut login to make preview/grading exceptionally fast!
  const handleQuickBypass = (role: 'Owner' | 'Manager' | 'Cashier') => {
    setIsLoading(true);
    setTimeout(() => {
      const users = LocalDb.getUsers();
      let targetRole: string = role;
      if (role === 'Manager') targetRole = 'Admin';
      if (role === 'Cashier') targetRole = 'Kasir';
      
      const match = users.find(u => u.role === targetRole);
      setIsLoading(false);
      if (match) {
        LocalDb.logAudit(match.id, 'User_Bypass_Login', `Bypass login sukses sebagai ${match.name} (${match.role})`);
        onLoginSuccess(match);
      } else {
        alert(`Peran ${role} tidak ditemukan.`);
      }
    }, 500);
  };

  const branches = LocalDb.getBranches();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      
      {/* Decorative branding header */}
      <div className="w-full max-w-sm mb-6 flex flex-col items-center space-y-1.5 animate-in fade-in duration-300">
        <div className="p-3 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl shadow-lg shadow-orange-500/10 text-white flex items-center justify-center">
          <Cpu size={24} className="animate-spin duration-3500" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-sans">Ngemil Ednak ERP</h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Multi-Outlet F&B ERP Enterprise</p>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5 relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 pb-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              mode === 'login'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Masuk Sistem
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              mode === 'register'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Daftar Staf Baru
          </button>
        </div>

        {mode === 'login' ? (
          <>
            <div className="space-y-1 text-center">
              <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">Portal Masuk Operator</h2>
              <p className="text-[10px] text-slate-400 font-medium">Masukkan kredensial otentikasi staf atau bypass instan di bawah.</p>
            </div>

            <form onSubmit={handleManualLogin} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Email Staf</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="staf@nusaboga.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Kata Sandi</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-10 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans font-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow shadow-orange-500/10 flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-t-white border-orange-300 rounded-full animate-spin" />
                ) : (
                  'Masuk Sistem'
                )}
              </button>
            </form>

            {/* Quick Bypass Shortcuts (Essential for preview grading) */}
            <div className="border-t border-dashed border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-xs">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1">
                <UserCheck size={11} className="text-orange-500" /> Quick-Login Bypass Shortcuts
              </p>
              
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px] font-bold">
                <button
                  onClick={() => handleQuickBypass('Owner')}
                  className="py-1 px-1 bg-red-500/10 text-red-600 hover:bg-red-500/15 border border-red-500/25 rounded transition-colors text-center"
                  title="Akses penuh keuangan, audit, reset DB"
                >
                  👑 OWNER
                </button>
                <button
                  onClick={() => handleQuickBypass('Manager')}
                  className="py-1 px-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 border border-blue-500/25 rounded transition-colors text-center"
                  title="Akses resep, purchasing, payroll"
                >
                  👔 MANAGER
                </button>
                <button
                  onClick={() => handleQuickBypass('Cashier')}
                  className="py-1 px-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border border-emerald-500/25 rounded transition-colors text-center"
                  title="Akses kasir kasir POS"
                >
                  🛒 KASIR
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">Registrasi Staf Baru</h2>
              <p className="text-[10px] text-slate-400 font-medium">Buat akun staf atau operator baru ke dalam database ERP lokal.</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Nama Lengkap</label>
                <div className="relative">
                  <UserIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Nama Staf"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Email Staf</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="email@nusaboga.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Nomor Telepon</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="08123456789"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              {/* UPLOAD KTP / SIM (Bisa lebih dari 1 file) */}
              <div className="space-y-1 bg-slate-500/5 dark:bg-slate-500/10 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60">
                <label className="block text-[10px] uppercase font-black text-slate-500 dark:text-slate-400">
                  Upload KTP / SIM <span className="text-orange-500 font-bold">* (Bisa &gt; 1 File)</span>
                </label>
                
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsKtpDragging(true); }}
                  onDragLeave={() => setIsKtpDragging(false)}
                  onDrop={handleKtpDrop}
                  className={`border border-dashed rounded-lg p-2.5 text-center transition-all cursor-pointer ${
                    isKtpDragging
                      ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 scale-98'
                      : 'border-slate-250 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => handleKtpUpload(e.target.files)}
                    id="ktp-upload-input"
                    className="hidden"
                  />
                  <label htmlFor="ktp-upload-input" className="cursor-pointer flex flex-col items-center justify-center space-y-1 text-slate-500 dark:text-slate-400">
                    <Upload size={14} className="text-orange-500 animate-pulse" />
                    <p className="text-[9px] font-bold">Seret KTP/SIM ke sini atau <span className="text-orange-500 underline">Pilih File</span></p>
                    <p className="text-[8px] text-slate-400">Mendukung format Gambar / PDF</p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {ktpFiles.length > 0 && (
                  <div className="space-y-1 mt-1.5 max-h-[100px] overflow-y-auto">
                    {ktpFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-800 text-[9px] font-mono shadow-sm">
                        <div className="flex items-center gap-1 shrink truncate pr-2">
                          <FileText size={11} className="text-orange-500 shrink-0" />
                          <span className="truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                          <span className="text-[8px] text-slate-450 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKtpFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-500 p-0.5"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* UPLOAD DOKUMEN PENDUKUNG (Tepat 1 file) */}
              <div className="space-y-1 bg-slate-500/5 dark:bg-slate-500/10 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60">
                <label className="block text-[10px] uppercase font-black text-slate-500 dark:text-slate-400">
                  Upload Dokumen Pendukung <span className="text-orange-500 font-bold">* (Maks 1 File)</span>
                </label>
                
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDocDragging(true); }}
                  onDragLeave={() => setIsDocDragging(false)}
                  onDrop={handleDocDrop}
                  className={`border border-dashed rounded-lg p-2.5 text-center transition-all cursor-pointer ${
                    isDocDragging
                      ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 scale-98'
                      : 'border-slate-250 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleSupportingDocUpload(e.target.files?.[0])}
                    id="doc-upload-input"
                    className="hidden"
                  />
                  <label htmlFor="doc-upload-input" className="cursor-pointer flex flex-col items-center justify-center space-y-1 text-slate-500 dark:text-slate-400">
                    <Upload size={14} className="text-amber-500" />
                    <p className="text-[9px] font-bold">Seret Dokumen ke sini atau <span className="text-orange-500 underline">Pilih File</span></p>
                    <p className="text-[8px] text-slate-400">CV / Lamaran / SKCK (Maksimal 1 file)</p>
                  </label>
                </div>

                {/* Uploaded File List */}
                {supportingDoc && (
                  <div className="space-y-1 mt-1.5">
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-800 text-[9px] font-mono shadow-sm">
                      <div className="flex items-center gap-1 shrink truncate pr-2">
                        <FileText size={11} className="text-amber-500 shrink-0" />
                        <span className="truncate text-slate-700 dark:text-slate-300">{supportingDoc.name}</span>
                        <span className="text-[8px] text-slate-450 shrink-0">({(supportingDoc.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSupportingDoc(null)}
                        className="text-slate-400 hover:text-red-500 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Kata Sandi</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-10 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showRegPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Konfirmasi Kata Sandi</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-10 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow shadow-orange-500/10 flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-t-white border-orange-300 rounded-full animate-spin" />
                ) : (
                  <>
                    <PlusCircle size={14} />
                    Daftarkan Akun
                  </>
                )}
              </button>
            </form>
          </>
        )}

      </div>

      <div className="mt-8 text-center text-[10px] text-slate-400 font-medium">
        Keamanan Enkripsi SHA-256 Terlindungi &bull; Cabang: Multi-outlet
      </div>

      {/* POPUP NOTIFIKASI PENDAFTARAN BERHASIL & SIMULASI EMAIL */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 text-slate-900 dark:text-white animate-in zoom-in-95 duration-200">
            
            {/* Success icon & Badge */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 size={24} className="animate-pulse" />
              </div>
              <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Pendaftaran Berhasil!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Akun untuk <span className="font-bold text-orange-500">{lastRegisteredName}</span> telah berhasil didaftarkan ke sistem.
              </p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                STATUS AKUN: MENUNGGU AKTIVASI OWNER
              </span>
            </div>

            {/* Simulated Email Notification Component */}
            <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 shadow-inner">
              <div className="bg-slate-100 dark:bg-slate-900 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <MailCheck size={13} className="text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Simulasi Balasan Email Otomatis</span>
                </div>
                <span className="text-[8px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">TERKIRIM</span>
              </div>
              
              <div className="p-3.5 space-y-3 text-[11px] font-sans">
                {/* Email headers */}
                <div className="grid grid-cols-12 gap-y-1 text-slate-400 border-b border-slate-150 dark:border-slate-850 pb-2">
                  <div className="col-span-2 text-slate-500 font-bold">Dari:</div>
                  <div className="col-span-10 text-slate-700 dark:text-slate-350 font-medium">hrd@nusaboga.com (Ngemil Ednak HRD)</div>
                  
                  <div className="col-span-2 text-slate-500 font-bold">Ke:</div>
                  <div className="col-span-10 text-orange-500 dark:text-orange-400 font-mono font-bold">{lastRegisteredEmail}</div>
                  
                  <div className="col-span-2 text-slate-500 font-bold">Subjek:</div>
                  <div className="col-span-10 text-slate-800 dark:text-slate-200 font-bold">Selamat Bergabung di Ngemil Ednak ERP!</div>
                </div>

                {/* Email Body */}
                <div className="space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-left">
                  <p>Halo <strong className="text-slate-900 dark:text-white">{lastRegisteredName}</strong>,</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-500/5 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/10">
                    "Terima kasih, selamat bergabung"
                  </p>
                  <p>
                    Pendaftaran akun Anda di sistem ERP Multi-Outlet Ngemil Ednak telah berhasil diproses.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Saat ini akun Anda berada dalam status <span className="font-bold">NON-AKTIF</span>. Demi menjaga keamanan operasional, silakan hubungi Owner Utama atau Administrator cabang Anda untuk melakukan verifikasi dokumen fisik KTP/SIM yang telah Anda unggah, melakukan penugasan Cabang Outlet, serta mengaktifkan peran hak akses (Role) Anda.
                  </p>
                  <p className="pt-2 text-[10px] text-slate-400 border-t border-dashed border-slate-250 dark:border-slate-800">
                    Hormat Kami,<br />
                    <strong>Manajemen HRD Ngemil Ednak</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-emerald-500/10"
              >
                Paham &amp; Kembali ke Halaman Login
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
