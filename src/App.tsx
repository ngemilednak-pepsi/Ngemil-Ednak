/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LocalDb } from './db/localDb';
import { User, Branch } from './types';

// Component Imports
import AuthModule from './components/AuthModule';
import Sidebar from './components/Sidebar';
import DashboardModule from './components/DashboardModule';
import PosModule from './components/PosModule';
import InventoryModule from './components/InventoryModule';
import ProductionModule from './components/ProductionModule';
import PurchasingModule from './components/PurchasingModule';
import SupplierModule from './components/SupplierModule';
import CrmModule from './components/CrmModule';
import EmployeeModule from './components/EmployeeModule';
import FinanceModule from './components/FinanceModule';
import AuditLogModule from './components/AuditLogModule';
import SettingsModule from './components/SettingsModule';
import { Menu } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string>('b-01');
  const [currentModule, setCurrentModule] = useState<string>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [dbVersion, setDbVersion] = useState<number>(0);

  useEffect(() => {
    // Perform initial seed of LocalDb if empty
    LocalDb.init();
    LocalDb.getProducts(); // triggers seed
    setBranches(LocalDb.getBranches());
    
    // Read persisted user session if any
    const session = sessionStorage.getItem('erp_active_user');
    if (session) {
      const u = JSON.parse(session);
      setCurrentUser(u);
      if (u.assignedBranchIds && u.assignedBranchIds.length > 0) {
        setCurrentBranchId(u.assignedBranchIds[0]);
      } else if (u.branchId) {
        setCurrentBranchId(u.branchId);
      }
    }
  }, []);

  useEffect(() => {
    const handleDbSync = () => {
      setDbVersion(v => v + 1);
      setBranches(LocalDb.getBranches());
    };
    window.addEventListener('db-sync', handleDbSync);
    return () => window.removeEventListener('db-sync', handleDbSync);
  }, []);

  // Update light/dark mode class on HTML body
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('erp_active_user', JSON.stringify(user));
    
    // Automatically pre-select employee branch
    if (user.assignedBranchIds && user.assignedBranchIds.length > 0) {
      setCurrentBranchId(user.assignedBranchIds[0]);
    } else if (user.branchId) {
      setCurrentBranchId(user.branchId);
    }
    
    // Force default landing screen based on role permissions
    const allPermissions = LocalDb.getPermissions();
    const myPerm = allPermissions.find(p => p.role === user.role);
    if (user.role === 'Owner') {
      setCurrentModule('dashboard');
    } else if (myPerm) {
      const order = ['dashboard', 'pos', 'inventory', 'production', 'purchasing', 'suppliers', 'customers', 'employees', 'finance', 'audit', 'settings'];
      const allowed = order.find(m => myPerm.modules[m as keyof typeof myPerm.modules]);
      setCurrentModule(allowed || 'pos');
    } else {
      if (user.role === 'Kasir') {
        setCurrentModule('pos');
      } else if (user.role === 'Gudang') {
        setCurrentModule('inventory');
      } else if (user.role === 'Produksi') {
        setCurrentModule('production');
      } else {
        setCurrentModule('dashboard');
      }
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      LocalDb.logAudit(currentUser.id, 'User_Logout', `Pegawai ${currentUser.name} keluar sesi`);
    }
    setCurrentUser(null);
    sessionStorage.removeItem('erp_active_user');
  };

  const handleResetDb = () => {
    if (!currentUser) return;
    if (currentUser.role !== 'Owner') {
      alert('Hanya Owner utama yang memiliki hak melakukan pembersihan database!');
      return;
    }

    if (confirm('APAKAH ANDA YAKIN?\nSeluruh data transaksi, mutasi stok, absensi dan log akan di-reset ulang ke setelan awal pabrik.')) {
      LocalDb.resetFactory();
      LocalDb.logAudit(currentUser.id, 'Database_Manual_Reset', 'Melakukan reset database ke setelan awal');
      alert('Database berhasil dibersihkan.');
      window.location.reload();
    }
  };

  // Render Auth screen first if no active session
  if (!currentUser) {
    return <AuthModule onLoginSuccess={handleLoginSuccess} />;
  }

  // Render module workspace router
  const renderWorkspaceModule = () => {
    // Check module permission
    if (!LocalDb.hasModuleAccess(currentUser, currentModule)) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm m-4 animate-in fade-in duration-200">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 text-3xl mb-4">
            ⚠️
          </div>
          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Akses Ditolak / Dibatasi</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
            Maaf, peran akun Anda (<span className="font-bold text-orange-500 font-mono">{currentUser.role}</span>) tidak memiliki izin akses (hak akses) untuk modul <strong className="text-slate-800 dark:text-white font-mono">"{currentModule}"</strong>.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs leading-relaxed">
            Silakan hubungi Owner Utama atau Administrator untuk menyesuaikan setelan hak akses Anda pada menu Pengaturan Sistem.
          </p>
        </div>
      );
    }

    switch (currentModule) {
      case 'dashboard':
        return <DashboardModule currentBranchId={currentBranchId} dbVersion={dbVersion} />;
      case 'pos':
        return <PosModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'inventory':
        return <InventoryModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'production':
        return <ProductionModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'purchasing':
        return <PurchasingModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'suppliers':
        return <SupplierModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'customers':
        return <CrmModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'employees':
        return <EmployeeModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'finance':
        return <FinanceModule currentBranchId={currentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      case 'audit':
        return <AuditLogModule currentUser={currentUser} dbVersion={dbVersion} />;
      case 'settings':
        return <SettingsModule currentBranchId={currentBranchId} onChangeBranch={setCurrentBranchId} currentUser={currentUser} dbVersion={dbVersion} />;
      default:
        return <DashboardModule currentBranchId={currentBranchId} dbVersion={dbVersion} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      
      {/* Sidebar Navigation */}
      <Sidebar
        currentModule={currentModule}
        setCurrentModule={setCurrentModule}
        currentUser={currentUser}
        onLogout={handleLogout}
        branches={branches}
        currentBranchId={currentBranchId}
        setCurrentBranchId={setCurrentBranchId}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onResetDb={handleResetDb}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main workspace arena */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top bar indicators */}
        <header className="h-14 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors cursor-pointer"
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
            
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase text-slate-400 hidden sm:inline">Navigasi Aktif:</span>
              <span className="font-black text-xs text-orange-500 uppercase tracking-wider">
                {currentModule === 'customers' ? 'CRM & CUSTOMER' : currentModule}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Live UTC Clock Indicator */}
            <div className="font-mono text-[10px] text-slate-400 hidden md:block">
              SERVER TIME: <strong className="text-slate-600 dark:text-slate-300">{new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</strong>
            </div>

            {/* Role Badge Indicator */}
            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
              {currentUser.role} CHANNEL
            </span>
          </div>
        </header>

        {/* Dynamic Workspace screen */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderWorkspaceModule()}
          </div>
        </div>

      </main>

    </div>
  );
}
