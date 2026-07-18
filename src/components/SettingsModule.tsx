/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Download, 
  Upload, 
  RefreshCcw, 
  MapPin, 
  Save, 
  Building,
  Percent,
  Shield,
  Lock,
  CheckSquare,
  Square
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Branch, User, UserRole, RolePermissions } from '../types';

interface SettingsModuleProps {
  currentBranchId: string;
  onChangeBranch: (id: string) => void;
  currentUser: User;
  dbVersion?: number;
}

export default function SettingsModule({ currentBranchId, onChangeBranch, currentUser, dbVersion }: SettingsModuleProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Tab control state
  const [settingsTab, setSettingsTab] = useState<'profile' | 'permissions'>('profile');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const [rolePermissionsList, setRolePermissionsList] = useState<RolePermissions[]>([]);

  // Edit Branch Info temp states
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  // Tax configuration states
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [taxEnabledByDefault, setTaxEnabledByDefault] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    const list = LocalDb.getBranches();
    setBranches(list);
    
    const active = list.find(b => b.id === currentBranchId) || null;
    setActiveBranch(active);
    if (active) {
      setBranchName(active.name);
      setBranchPhone(active.phone);
      setBranchAddress(active.address);
    }

    const settings = LocalDb.getSettings();
    setTaxPercent(settings.taxPercent);
    setTaxEnabledByDefault(!!settings.taxEnabledByDefault);

    const perms = LocalDb.getPermissions();
    setRolePermissionsList(perms);
  };

  // Update Branch Info
  const handleUpdateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName || !branchPhone || !branchAddress) {
      alert('Isi seluruh rincian informasi outlet cabang!');
      return;
    }

    const updatedBranches = branches.map(b => {
      if (b.id === currentBranchId) {
        return { ...b, name: branchName, phone: branchPhone, address: branchAddress };
      }
      return b;
    });

    LocalDb.saveBranches(updatedBranches);
    LocalDb.logAudit(currentUser.id, 'Branch_Updated', `Memperbarui rincian profil cabang: ${branchName}`);
    loadData();
    alert('Profil informasi cabang berhasil disimpan.');
  };

  // Update Tax Config Settings
  const handleUpdateTaxSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const settings = LocalDb.getSettings();
    const updatedSettings = {
      ...settings,
      taxPercent: Number(taxPercent) || 0,
      taxEnabledByDefault: taxEnabledByDefault
    };
    LocalDb.saveSettings(updatedSettings);
    LocalDb.logAudit(currentUser.id, 'Settings_Tax_Updated', `Memperbarui konfigurasi pajak sistem: ${taxPercent}% (Aktif default: ${taxEnabledByDefault ? 'Ya' : 'Tidak'})`);
    alert('Konfigurasi setelan pajak berhasil disimpan!');
  };

  // Reset database back to default initial seed data
  const handleResetDatabase = () => {
    if (currentUser.role !== 'Owner') {
      alert('Hanya Owner utama yang memiliki izin melakukan factory reset database ERP!');
      return;
    }

    if (confirm('APAKAH ANDA SANGAT YAKIN?\nSeluruh data transaksi kasir, logistik gudang, pendaftaran member, penggajian, dan log audit akan dihapus permanen, diganti kembali ke kondisi factory seed defaults.')) {
      LocalDb.resetFactory();
      LocalDb.logAudit(currentUser.id, 'Database_Factory_Reset', 'Melakukan hard factory-reset seluruh database ERP');
      alert('Database ERP berhasil di-reset ke kondisi setelan pabrik!');
      window.location.reload();
    }
  };

  // Download entire localStorage state as a backup JSON file
  const handleDownloadBackup = () => {
    if (!LocalDb.hasPermission(currentUser, 'exportBackup')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengunduh cadangan data (Backup JSON).');
      return;
    }
    const backupObj: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('erp_')) {
        backupObj[key] = JSON.parse(localStorage.getItem(key)!);
      }
    }

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `erp_fb_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    LocalDb.logAudit(currentUser.id, 'Database_Backup_Download', 'Mengunduh file salinan cadangan JSON database ERP');
    alert('File backup JSON berhasil digenerate & diunduh.');
  };

  // Restore state from selected JSON file upload
  const handleUploadRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (currentUser.role !== 'Owner') {
      alert('Hanya Owner utama yang memiliki otoritas memulihkan cadangan database!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Confirm first
        if (confirm('Apakah Anda ingin menimpa seluruh database aktif saat ini dengan data cadangan ini? Halaman akan otomatis disegarkan.')) {
          // Clean existing erp_ prefixes
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('erp_')) {
              localStorage.removeItem(key);
            }
          }

          // Import parsing
          Object.keys(parsed).forEach(key => {
            if (key.startsWith('erp_')) {
              localStorage.setItem(key, JSON.stringify(parsed[key]));
            }
          });

          alert('Database ERP sukses direstore dari salinan cadangan!');
          window.location.reload();
        }
      } catch (err) {
        alert('Format file JSON tidak valid atau rusak!');
      }
    };
    reader.readAsText(file);
  };

  const MODULE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard Analytics',
    pos: 'Point of Sale (POS) / Kasir',
    inventory: 'Inventory & Stock / Gudang',
    production: 'BOM & Produksi Dapur',
    purchasing: 'Pembelian Bahan Baku (PO)',
    suppliers: 'Supplier & Hutang Dagang',
    customers: 'CRM & Manajemen Customer',
    employees: 'HR, Absensi & Payroll Gaji',
    finance: 'Keuangan & Buku Kas Utama',
    audit: 'Audit Logs (Jurnal Log Aktivitas)',
    settings: 'Pengaturan Sistem & Database',
  };

  const ACTION_LABELS: Record<string, string> = {
    editProduct: 'Tambah & Edit Katalog Produk/Bahan Baku',
    adjustStock: 'Penyesuaian Selisih Stok (Stock Opname)',
    transferStock: 'Mutasi/Transfer Stok Antar Gudang Cabang',
    checkoutSales: 'Proses Penyelesaian Pembayaran POS',
    refundSales: 'Void / Refund Transaksi Kasir POS',
    manageProduction: 'Kelola Formula BOM & Eksekusi Produksi',
    addPurchase: 'Buat Dokumen Purchase Order (PO) Supplier',
    manageEmployees: 'Pendaftaran Pegawai, Shift Absensi & Gaji',
    manageFinance: 'Entri Jurnal Kas & Pengeluaran Finansial',
    exportBackup: 'Download Salinan Cadangan Database (JSON)',
    resetDb: 'Factory Reset / Pembersihan Database Utama',
  };

  // Toggle Module
  const handleToggleModule = (roleName: UserRole, moduleKey: string) => {
    if (roleName === 'Owner') return;
    const updated = rolePermissionsList.map(rp => {
      if (rp.role === roleName) {
        return {
          ...rp,
          modules: {
            ...rp.modules,
            [moduleKey]: !rp.modules[moduleKey as keyof typeof rp.modules]
          }
        };
      }
      return rp;
    });
    setRolePermissionsList(updated);
  };

  // Toggle Action
  const handleToggleAction = (roleName: UserRole, actionKey: string) => {
    if (roleName === 'Owner') return;
    const updated = rolePermissionsList.map(rp => {
      if (rp.role === roleName) {
        return {
          ...rp,
          actions: {
            ...rp.actions,
            [actionKey]: !rp.actions[actionKey as keyof typeof rp.actions]
          }
        };
      }
      return rp;
    });
    setRolePermissionsList(updated);
  };

  // Save Role Permissions
  const handleSavePermissions = () => {
    LocalDb.savePermissions(rolePermissionsList);
    LocalDb.logAudit(currentUser.id, 'Permissions_Updated', `Memperbarui konfigurasi hak akses sistem untuk seluruh peran`);
    alert('Hak akses peran berhasil disimpan! Perubahan akan berdampak pada pegawai saat login ulang atau navigasi.');
    loadData();
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Pengaturan Sistem & Database</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Konfigurasi profil outlet aktif, manajemen hak akses peran, backup/restore data transaksi, dan kelola setelan database.</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setSettingsTab('profile')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            settingsTab === 'profile'
              ? 'border-orange-500 text-orange-500 bg-orange-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building size={14} />
          Profil Outlet & Pajak POS
        </button>
        <button
          onClick={() => setSettingsTab('permissions')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            settingsTab === 'permissions'
              ? 'border-orange-500 text-orange-500 bg-orange-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Shield size={14} />
          Manajemen Hak Akses & Peran (RBAC)
        </button>
      </div>

      {settingsTab === 'profile' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Branch Profile & Tax Settings Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Branch Profile Form */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building size={16} className="text-orange-500" />
                Konfigurasi Profil Outlet Terpilih
              </h3>
              <p className="text-[11px] text-slate-400">Rincian nama dan alamat di bawah ini akan otomatis tercetak di kuitansi struk pembelian kasir POS.</p>

              <form onSubmit={handleUpdateBranch} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Nama Outlet Cabang</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">No. Telepon Outlet</label>
                    <input
                      type="text"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Alamat Lengkap Outlet Cabang</label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Save size={12} />
                    Simpan Profil Outlet
                  </button>
                </div>
              </form>
            </div>

            {/* Setelan Pajak POS Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Percent size={16} className="text-orange-500" />
                Setelan Pajak POS (Optional)
              </h3>
              <p className="text-[11px] text-slate-400">Atur besaran persentase pajak transaksi kasir, serta kendalikan apakah pajak otomatis dikenakan secara default atau opsional.</p>

              <form onSubmit={handleUpdateTaxSettings} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Besaran Pajak (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-bold text-slate-800 dark:text-white"
                      />
                      <span className="absolute right-3 top-1.5 text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 pt-5">
                    <input
                      type="checkbox"
                      id="taxEnabledByDefault"
                      checked={taxEnabledByDefault}
                      onChange={(e) => setTaxEnabledByDefault(e.target.checked)}
                      className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 focus:ring-opacity-20 cursor-pointer"
                    />
                    <label htmlFor="taxEnabledByDefault" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      Kenakan Pajak Secara Default
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Catatan Setelan Opsional:</span>
                  Jika "Kenakan Pajak Secara Default" aktif, pesanan baru akan langsung otomatis menghitung pajak {taxPercent}%. 
                  Kasir/User tetap dapat mematikan (uncheck) atau menghidupkan pilihan pajak ini secara dinamis pada panel checkout transaksi kasir.
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Save size={12} />
                    Simpan Setelan Pajak
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Database backup restore utilities */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Pemeliharaan & Cadangan Data</h3>
              <p className="text-[11px] text-slate-400">Unduh salinan data ERP lokal Anda dalam format JSON untuk dipindahkan atau disimpan sebagai backup harian.</p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={12} />
                  Download Backup (.json)
                </button>

                {/* Upload File Wrapper */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadRestore}
                    disabled={currentUser.role !== 'Owner'}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded flex items-center justify-center gap-1.5 border border-dashed border-slate-300 dark:border-slate-700"
                  >
                    <Upload size={12} />
                    Restore Backup (.json)
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 space-y-2">
                <h4 className="font-bold text-red-500 uppercase text-[9px] tracking-wider">Zona Bahaya / Danger Zone</h4>
                <button
                  onClick={handleResetDatabase}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/15 text-red-500 font-bold rounded border border-red-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCcw size={12} />
                  Factory Reset Database
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* RBAC Dynamic Permission configuration panel */
        currentUser.role !== 'Owner' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 mb-4 text-xl">
              <Lock size={20} />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Akses Terbatas</h4>
            <p className="text-slate-500 text-xs mt-1 max-w-sm">
              Hanya pengguna dengan peran <strong className="text-orange-500 font-mono">Owner</strong> yang diizinkan untuk melihat dan memodifikasi kebijakan hak akses serta wewenang peran di sistem ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in duration-200">
            {/* Left Side: Roles list selection */}
            <div className="md:col-span-1 space-y-3">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <h4 className="text-[10px] uppercase font-extrabold text-slate-400 mb-3 tracking-wider flex items-center gap-1.5">
                  <Shield size={12} className="text-orange-500" />
                  PILIH PERAN PEGAWAI
                </h4>
                <div className="space-y-1">
                  {(['Admin', 'Supervisor', 'Kasir', 'Gudang', 'Produksi', 'Finance'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                        selectedRole === r
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{r}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        selectedRole === r
                          ? 'bg-orange-600 text-orange-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        Config
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 text-[10.5px] text-slate-500 dark:text-slate-400 space-y-1.5">
                <span className="font-extrabold text-orange-600 dark:text-orange-400 block uppercase tracking-wider text-[9px]">💡 ATURAN HAK AKSES</span>
                <p className="leading-relaxed">
                  Sebagai <strong className="text-slate-800 dark:text-white font-mono">Owner</strong>, akun Anda memiliki kekuasaan penuh (superuser) di seluruh sistem dan tidak dapat dibatasi.
                </p>
                <p className="leading-relaxed">
                  Untuk peran lain, mematikan modul akan menyembunyikannya dari sidebar navigasi mereka dan memblokir akses halamannya secara langsung.
                </p>
              </div>
            </div>

            {/* Right Side: Checklists for dynamic module access and authorities */}
            <div className="md:col-span-3 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                
                {/* Header info */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Kebijakan Keamanan Peran:</span>
                      <span className="px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-mono text-xs font-black">
                        {selectedRole}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">Konfigurasikan modul mana saja yang dapat dibuka dan fitur apa saja yang boleh dijalankan oleh staf.</p>
                  </div>
                  <button
                    onClick={handleSavePermissions}
                    className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-lg flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/10 shrink-0 self-start sm:self-center cursor-pointer"
                  >
                    <Save size={12} />
                    Simpan Hak Akses {selectedRole}
                  </button>
                </div>

                {/* Checklist fields */}
                {(() => {
                  const currentPerm = rolePermissionsList.find(rp => rp.role === selectedRole);
                  if (!currentPerm) return <p className="text-xs text-slate-400 font-mono">Memuat setelan...</p>;

                  return (
                    <div className="space-y-6">
                      {/* Module Access Checkboxes */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                          <Shield size={10} className="text-orange-500" />
                          Izin Akses Menu Modul (Sidebar Navigasi)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.keys(currentPerm.modules).map(moduleKey => {
                            const isAllowed = !!currentPerm.modules[moduleKey as keyof typeof currentPerm.modules];
                            return (
                              <div
                                key={moduleKey}
                                onClick={() => handleToggleModule(selectedRole, moduleKey)}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                                  isAllowed
                                    ? 'bg-orange-500/5 border-orange-500/20 dark:border-orange-500/10'
                                    : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                <div className="mt-0.5">
                                  {isAllowed ? (
                                    <CheckSquare size={16} className="text-orange-500" />
                                  ) : (
                                    <Square size={16} className="text-slate-300 dark:text-slate-700" />
                                  )}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold block ${isAllowed ? 'text-slate-800 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {MODULE_LABELS[moduleKey] || moduleKey}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    Status: {isAllowed ? 'Diberikan Izin' : 'Diblokir'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Access Checkboxes */}
                      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                          <Lock size={10} className="text-orange-500" />
                          Wewenang Tindakan & Otoritas Khusus (Sistem)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.keys(currentPerm.actions).map(actionKey => {
                            const isAllowed = !!currentPerm.actions[actionKey as keyof typeof currentPerm.actions];
                            return (
                              <div
                                key={actionKey}
                                onClick={() => handleToggleAction(selectedRole, actionKey)}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                                  isAllowed
                                    ? 'bg-orange-500/5 border-orange-500/20 dark:border-orange-500/10'
                                    : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                <div className="mt-0.5">
                                  {isAllowed ? (
                                    <CheckSquare size={16} className="text-orange-500" />
                                  ) : (
                                    <Square size={16} className="text-slate-300 dark:text-slate-700" />
                                  )}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold block ${isAllowed ? 'text-slate-800 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {ACTION_LABELS[actionKey] || actionKey}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block mt-0.5">
                                    Aksi Administratif Khusus
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
        )
      )}

    </div>
  );
}
