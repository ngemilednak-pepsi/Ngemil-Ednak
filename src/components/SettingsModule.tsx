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
  Square,
  Database,
  LogIn,
  LogOut,
  AlertTriangle,
  Play,
  RefreshCw,
  ExternalLink,
  Globe,
  UserCheck
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Branch, User, UserRole, RolePermissions } from '../types';
import { 
  initGoogleAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from '../db/firebase';
import { 
  createDatabaseSpreadsheet, 
  pushAllLocalDataToSheets, 
  pullAllDataFromSheets,
  SHEET_KEYS
} from '../db/googleSheets';

interface SettingsModuleProps {
  currentBranchId: string;
  onChangeBranch: (id: string) => void;
  currentUser: User;
  dbVersion?: number;
}

export default function SettingsModule({ currentBranchId, onChangeBranch, currentUser, dbVersion }: SettingsModuleProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Tab control state
  const [settingsTab, setSettingsTab] = useState<'profile' | 'permissions' | 'sheets'>('profile');
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

  // Google Sheets state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [currentSyncTable, setCurrentSyncTable] = useState<string>('');
  const [manualSheetId, setManualSheetId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  useEffect(() => {
    // Listen to Google Auth state
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsAuthLoading(false);
      }
    );

    // Load active spreadsheet ID
    const savedSheetId = localStorage.getItem('erp_google_sheet_id') || '';
    setSpreadsheetId(savedSheetId);
    setManualSheetId(savedSheetId);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setSyncStatus('Menghubungkan ke akun Google...');
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setSyncStatus('Berhasil terhubung dengan Google!');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Gagal login Google: ${err.message || err}`);
      setSyncStatus('');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setGoogleToken(null);
      setSyncStatus('Koneksi Google diputuskan.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateSpreadsheet = async () => {
    const token = googleToken || getAccessToken();
    if (!token) {
      alert('Harap hubungkan akun Google Anda terlebih dahulu!');
      return;
    }

    try {
      setSyncStatus('Membuat spreadsheet baru di Google Drive...');
      setSyncProgress(10);
      const newSheetId = await createDatabaseSpreadsheet(token);
      localStorage.setItem('erp_google_sheet_id', newSheetId);
      setSpreadsheetId(newSheetId);
      setManualSheetId(newSheetId);
      setSyncStatus('Spreadsheet berhasil dibuat! Memulai ekspor data awal...');
      
      // Perform initial push
      await handlePushData(newSheetId);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal membuat spreadsheet: ${err.message || err}`);
      setSyncStatus('');
      setSyncProgress(0);
    }
  };

  const handlePushData = async (targetSheetId?: string) => {
    const token = googleToken || getAccessToken();
    const activeId = targetSheetId || spreadsheetId;
    if (!token || !activeId) {
      alert('Koneksi Google atau spreadsheet ID tidak terdeteksi!');
      return;
    }

    try {
      setSyncStatus('Mengekspor data lokal ke Google Sheets...');
      await pushAllLocalDataToSheets(token, activeId, (percent, table) => {
        setSyncProgress(percent);
        setCurrentSyncTable(table);
      });
      setSyncStatus('Data lokal berhasil diekspor sepenuhnya ke Google Sheets!');
      alert('Ekspor database ke Google Sheets selesai dengan sukses!');
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengekspor data: ${err.message || err}`);
      setSyncStatus('');
      setSyncProgress(0);
    }
  };

  const handlePullData = async () => {
    const token = googleToken || getAccessToken();
    if (!token || !spreadsheetId) {
      alert('Koneksi Google atau spreadsheet ID tidak terdeteksi!');
      return;
    }

    if (!confirm('APAKAH ANDA YAKIN?\nTindakan ini akan menimpa seluruh data ERP lokal Anda dengan data yang ada di Google Sheets!')) {
      return;
    }

    try {
      setSyncStatus('Mengimpor data dari Google Sheets...');
      const importedData = await pullAllDataFromSheets(token, spreadsheetId, (percent, table) => {
        setSyncProgress(percent);
        setCurrentSyncTable(table);
      });

      // Save imported keys to localStorage
      Object.keys(importedData).forEach(key => {
        localStorage.setItem(key, JSON.stringify(importedData[key]));
      });

      setSyncStatus('Data berhasil diimpor! Memperbarui database lokal...');
      alert('Impor database dari Google Sheets selesai! Halaman akan disegarkan.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengimpor data: ${err.message || err}`);
      setSyncStatus('');
      setSyncProgress(0);
    }
  };

  const handleSaveManualSheetId = () => {
    if (!manualSheetId.trim()) {
      alert('Masukkan Spreadsheet ID yang valid!');
      return;
    }
    localStorage.setItem('erp_google_sheet_id', manualSheetId.trim());
    setSpreadsheetId(manualSheetId.trim());
    alert('Spreadsheet ID berhasil dihubungkan!');
  };

  const handleDisconnectSpreadsheet = () => {
    if (confirm('Apakah Anda ingin memutuskan koneksi spreadsheet aktif?')) {
      localStorage.removeItem('erp_google_sheet_id');
      setSpreadsheetId('');
      setManualSheetId('');
      alert('Spreadsheet berhasil diputuskan.');
    }
  };

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
        <button
          onClick={() => setSettingsTab('sheets')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            settingsTab === 'sheets'
              ? 'border-orange-500 text-orange-500 bg-orange-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Database size={14} />
          Sinkronisasi Google Sheets
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
      ) : settingsTab === 'permissions' ? (
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
      ) : (
        /* Google Sheets Integration Panel */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Main Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-green-500 shrink-0">
                <Database size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  Penyimpanan & Sinkronisasi Database Google Sheets
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ubah Google Sheets menjadi master database cloud untuk sistem ERP Anda! Ketika terhubung, seluruh perubahan data transaksi kasir, logistik, katalog, dan payroll akan otomatis disinkronkan secara real-time ke spreadsheet Anda di Google Drive.
                </p>
              </div>
            </div>

            {/* Warning Alert */}
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 p-4 rounded-lg flex items-start gap-3 text-xs text-orange-800 dark:text-orange-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Informasi Integrasi:</span> Hubungkan akun Google Anda dan buat Spreadsheet database baru. Aplikasi ini akan otomatis membuat tab khusus untuk setiap tabel (users, branches, products, sales, dll.) dan menyinkronkan data di dalamnya.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Column 1: Google Account connection */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Globe size={16} className="text-orange-500" />
                1. Sambungkan Akun Google Anda
              </h4>
              <p className="text-xs text-slate-400">
                Hubungkan dengan Google Drive dan Google Sheets untuk memberikan wewenang aplikasi membuat dan menulis file spreadsheet.
              </p>

              {isAuthLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                  <RefreshCw className="animate-spin text-orange-500" size={16} />
                  Memeriksa koneksi Google...
                </div>
              ) : !googleUser ? (
                <div className="py-4 flex flex-col items-center justify-center space-y-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/20">
                  <button 
                    onClick={handleGoogleLogin}
                    className="gsi-material-button font-sans cursor-pointer hover:shadow-md transition-shadow"
                    style={{ margin: '0 auto' }}
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24.5c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents" style={{ fontSize: '13px', fontWeight: '500' }}>Hubungkan dengan Akun Google</span>
                    </div>
                  </button>
                  <span className="text-[10px] text-slate-400">Aman, token akses hanya disimpan sementara di memori browser Anda.</span>
                </div>
              ) : (
                <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} alt={googleUser.displayName} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-green-500 text-white flex items-center justify-center font-bold rounded-full">
                        {googleUser.displayName?.charAt(0) || 'G'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate">{googleUser.displayName}</h5>
                      <span className="text-[10px] text-slate-400 truncate block">{googleUser.email}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-bold border border-green-500/30 shrink-0">
                      Terhubung
                    </span>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleGoogleLogout}
                      className="text-[11px] text-red-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut size={12} />
                      Putuskan Akun
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Spreadsheet Connection */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Database size={16} className="text-orange-500" />
                2. Setup Spreadsheet Database
              </h4>
              <p className="text-xs text-slate-400">
                Tentukan atau buat spreadsheet di Google Drive Anda untuk digunakan sebagai media penyimpanan database ERP.
              </p>

              {!googleUser ? (
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-950/20">
                  Hubungkan akun Google Anda di langkah pertama terlebih dahulu untuk membuka pengaturan ini.
                </div>
              ) : !spreadsheetId ? (
                <div className="space-y-4">
                  <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/20 flex flex-col items-center justify-center gap-3">
                    <button
                      onClick={handleCreateSpreadsheet}
                      className="py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Play size={12} />
                      Buat Spreadsheet Database Baru
                    </button>
                    <p className="text-[10px] text-slate-400 text-center max-w-xs">
                      Sistem akan membuat Spreadsheet bernama <strong className="text-slate-600 dark:text-slate-300">"FB ERP System Database"</strong> di Drive Anda dan langsung melakukan sinkronisasi awal.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Atau hubungkan ID Spreadsheet yang sudah ada:</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Masukkan Google Spreadsheet ID..."
                        value={manualSheetId}
                        onChange={(e) => setManualSheetId(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-mono"
                      />
                      <button
                        onClick={handleSaveManualSheetId}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold rounded cursor-pointer shrink-0"
                      >
                        Hubungkan ID
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-orange-500/20 bg-orange-500/5 rounded-lg space-y-4 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-orange-500/10 text-orange-500 rounded">
                      <Database size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Google Spreadsheet Terhubung:</span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 truncate block mt-0.5">{spreadsheetId}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded flex items-center justify-center gap-1.5 text-[11px] border border-slate-700"
                    >
                      <ExternalLink size={12} />
                      Buka di Google Sheets
                    </a>
                    
                    <button
                      onClick={handleDisconnectSpreadsheet}
                      className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/15 text-red-500 font-bold rounded flex items-center justify-center gap-1 text-[11px] border border-red-500/20 cursor-pointer"
                    >
                      Putus Koneksi
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Tindakan Sinkronisasi Manual:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePushData()}
                        className="py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded flex items-center justify-center gap-1 text-[10px] cursor-pointer"
                        title="Ekspor seluruh data lokal saat ini untuk menggantikan sheets"
                      >
                        <Upload size={12} />
                        Push ke Sheets
                      </button>
                      
                      <button
                        onClick={handlePullData}
                        className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded flex items-center justify-center gap-1 text-[10px] border border-slate-200 dark:border-slate-750 cursor-pointer"
                        title="Impor dan timpa data lokal dengan isi di sheets"
                      >
                        <Download size={12} />
                        Pull dari Sheets
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Console / Status Logs */}
          {syncStatus && (
            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-[11px] text-slate-300 space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={12} className="text-orange-500 animate-spin" />
                <span className="font-bold text-orange-400">[SYSTEM SYNC] :</span>
                <span>{syncStatus}</span>
              </div>
              
              {syncProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Proses: {currentSyncTable ? `Sinkronisasi ${currentSyncTable}` : 'Sedang berjalan...'}</span>
                    <span>{syncProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auto-Sync Explanation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2.5">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare size={14} className="text-green-500" />
              Fitur Auto-Sync Real-Time Aktif
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ketika akun Google dan Spreadsheet Anda sudah terhubung di atas, sistem ERP ini secara otomatis akan menyinkronkan data di background tanpa mengganggu kenyamanan transaksi Anda. Setiap kali kasir mencetak struk, stok bahan baku dimutasi, atau pegawai melakukan absensi, sistem akan langsung mengirim pembaruan tersebut langsung ke tab spreadsheet Anda!
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
